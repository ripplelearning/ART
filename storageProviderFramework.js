// Epic 52 foundation: a provider-independent storage interface so ART's core reporting,
// collaboration, and merge-conflict logic never depends on a specific storage provider's API.
// Google Drive (Epic 53) and OneDrive (Epic 54) have real OAuth/API implementations that require a
// configured Client ID; Dropbox and a future ART Server remain unimplemented placeholders (Epics
// 55-56). Only Local Computer and Network/Shared Folder are usable today with no extra
// configuration, both backed by the operating system's normal filesystem access that ART already
// uses for `.art` files.
import { connectGoogleDrive, disconnectGoogleDrive, getGoogleDriveClientId, getGoogleDriveConnectionStatus } from './googleDriveStorageProvider.js';
import { connectOneDrive, disconnectOneDrive, getOneDriveClientId, getOneDriveConnectionStatus } from './oneDriveStorageProvider.js';

const providerRegistry = new Map();
const CONFIG_KEY = 'art-storage-provider-config-v1';

function normalizeText(value) {
    return String(value ?? '').trim();
}

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '');
        return value && typeof value === 'object' ? value : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeStorageProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Storage providers require an id.');
    return {
        id,
        name: normalizeText(source.name) || id,
        description: normalizeText(source.description),
        status: ['available', 'not-connected', 'coming-soon'].includes(source.status) ? source.status : 'coming-soon',
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 100,
        capabilities: {
            browse: Boolean(source.capabilities?.browse),
            versionHistory: Boolean(source.capabilities?.versionHistory),
            offline: source.capabilities?.offline !== false,
            sync: Boolean(source.capabilities?.sync)
        },
        connect: typeof source.connect === 'function' ? source.connect : null,
        disconnect: typeof source.disconnect === 'function' ? source.disconnect : null
    };
}

export function registerStorageProvider(provider) {
    const normalized = normalizeStorageProvider(provider);
    providerRegistry.set(normalized.id, normalized);
    return { ...normalized };
}

export function unregisterStorageProvider(providerId) {
    return providerRegistry.delete(normalizeText(providerId));
}

export function getStorageProviders() {
    return [...providerRegistry.values()].sort((left, right) => left.priority - right.priority).map((provider) => ({ ...provider }));
}

export function getStorageProvider(providerId) {
    const provider = providerRegistry.get(normalizeText(providerId));
    return provider ? { ...provider } : null;
}

// Optional cloud providers (Google Drive, OneDrive, Dropbox, ART Server) are opt-in: their
// dedicated UI controls, menu entries, and keyboard shortcuts should only appear once the user has
// connected that provider. Local Computer and Network/Shared Folder are always considered connected.
export function isStorageProviderConnected(providerId) {
    const provider = getStorageProvider(providerId);
    return provider ? provider.status === 'available' : false;
}

function normalizeStorageConfig(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const defaultProviderId = normalizeText(source.defaultProviderId) || 'local';
    return { defaultProviderId: providerRegistry.has(defaultProviderId) ? defaultProviderId : 'local' };
}

export function getStorageConfig() {
    return normalizeStorageConfig(readJson(CONFIG_KEY, {}));
}

export function updateStorageConfig(updates = {}) {
    const config = normalizeStorageConfig({ ...getStorageConfig(), ...(updates || {}) });
    writeJson(CONFIG_KEY, config);
    window.dispatchEvent(new CustomEvent('art-storage-config-updated', { detail: config }));
    return config;
}

export async function connectStorageProvider(providerId) {
    const provider = getStorageProvider(providerId);
    if (!provider) return { ok: false, message: 'Unknown storage provider.' };
    if (typeof provider.connect === 'function') {
        const result = await provider.connect();
        refreshProviderStatus(provider.id);
        return result;
    }
    if (provider.status === 'coming-soon') {
        return { ok: false, message: `${provider.name} integration is not yet available in this release. ART remains fully usable with local files in the meantime.` };
    }
    return { ok: true, message: `${provider.name} is already available through the operating system's file access.` };
}

export function disconnectStorageProvider(providerId) {
    const provider = getStorageProvider(providerId);
    if (!provider) return { ok: false, message: 'Unknown storage provider.' };
    if (typeof provider.disconnect === 'function') {
        const result = provider.disconnect();
        refreshProviderStatus(provider.id);
        return result;
    }
    return { ok: false, message: `${provider.name} does not require disconnecting.` };
}

function refreshProviderStatus(providerId) {
    if (providerId === 'google-drive') refreshGoogleDriveProviderStatus();
    else if (providerId === 'onedrive') refreshOneDriveProviderStatus();
}

function registerBaselineProviders() {
    registerStorageProvider({
        id: 'local',
        name: 'Local Computer',
        description: 'Open and save .art files on this device using standard file dialogs. The reference storage provider implementation; always available.',
        status: 'available',
        priority: 0,
        capabilities: { browse: true, versionHistory: false, offline: true, sync: false }
    });
    registerStorageProvider({
        id: 'network-folder',
        name: 'Network or Shared Folder',
        description: 'A folder the operating system already exposes for file access, whether a network drive, shared folder, or synchronized cloud-drive folder. ART uses the same local file access as the Local Computer provider; it does not need to know how the folder is synchronized.',
        status: 'available',
        priority: 10,
        capabilities: { browse: true, versionHistory: false, offline: true, sync: true }
    });
    registerGoogleDriveProvider();
    registerOneDriveProvider();
    registerStorageProvider({
        id: 'dropbox',
        name: 'Dropbox',
        description: 'Planned in Epic 55.',
        status: 'coming-soon',
        priority: 40,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true }
    });
    registerStorageProvider({
        id: 'art-server',
        name: 'ART Server',
        description: 'Reserved for a future authenticated ART server providing organizations, shared workspaces, and server-side synchronization (Epics 49 and 51). Not required for file-based collaboration.',
        status: 'coming-soon',
        priority: 50,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true }
    });
}

export function initializeStorageProviderFramework() {
    if (providerRegistry.size === 0) registerBaselineProviders();
    getStorageConfig();
    return true;
}

function registerGoogleDriveProvider() {
    registerStorageProvider({
        id: 'google-drive',
        name: 'Google Drive',
        description: getGoogleDriveClientId()
            ? 'Connect your Google account to open and save .art files in a folder you choose. ART only requests access to files it creates or you open with Google\u2019s file picker (the drive.file scope), never your entire Drive.'
            : 'Requires a Google Drive OAuth Client ID, configured by an ART administrator, before it can be connected.',
        status: getGoogleDriveConnectionStatus().connected ? 'available' : 'not-connected',
        priority: 20,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true },
        connect: connectGoogleDrive,
        disconnect: disconnectGoogleDrive
    });
}

function registerOneDriveProvider() {
    registerStorageProvider({
        id: 'onedrive',
        name: 'Microsoft OneDrive',
        description: getOneDriveClientId()
            ? 'Connect your Microsoft account to open and save .art files. ART only requests access to its own App Folder (the Files.ReadWrite.AppFolder scope), never your entire OneDrive.'
            : 'Requires a Microsoft Azure AD Application (Client) ID, configured by an ART administrator, before it can be connected.',
        status: getOneDriveConnectionStatus().connected ? 'available' : 'not-connected',
        priority: 30,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true },
        connect: connectOneDrive,
        disconnect: disconnectOneDrive
    });
}

// Call after configuring a Client ID, or after connecting/disconnecting, so Settings reflects
// current state without needing a full page reload.
export function refreshGoogleDriveProviderStatus() {
    registerGoogleDriveProvider();
    window.dispatchEvent(new CustomEvent('art-storage-providers-updated'));
}

export function refreshOneDriveProviderStatus() {
    registerOneDriveProvider();
    window.dispatchEvent(new CustomEvent('art-storage-providers-updated'));
}
