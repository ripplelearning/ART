// Epic 52 foundation: a provider-independent storage interface so ART's core reporting,
// collaboration, and merge-conflict logic never depends on a specific storage provider's API.
// Cloud providers (Google Drive, OneDrive, Dropbox) and a future ART Server are registered here
// as placeholders; their real connections are implemented in Epics 53-56. Only the Local Computer
// and Network/Shared Folder providers are actually usable today, both backed by the operating
// system's normal filesystem access that ART already uses for opening/saving `.art` files.
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

export function connectStorageProvider(providerId) {
    const provider = getStorageProvider(providerId);
    if (!provider) return { ok: false, message: 'Unknown storage provider.' };
    if (provider.status === 'coming-soon') {
        return { ok: false, message: `${provider.name} integration is not yet available in this release. ART remains fully usable with local files in the meantime.` };
    }
    if (typeof provider.connect === 'function') return provider.connect();
    return { ok: true, message: `${provider.name} is already available through the operating system's file access.` };
}

export function disconnectStorageProvider(providerId) {
    const provider = getStorageProvider(providerId);
    if (!provider) return { ok: false, message: 'Unknown storage provider.' };
    if (typeof provider.disconnect === 'function') return provider.disconnect();
    return { ok: false, message: `${provider.name} does not require disconnecting.` };
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
    registerStorageProvider({
        id: 'google-drive',
        name: 'Google Drive',
        description: 'Planned in Epic 53. Will support connecting a Google account, browsing folders, and opening/saving .art files with minimum necessary permissions.',
        status: 'coming-soon',
        priority: 20,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true }
    });
    registerStorageProvider({
        id: 'onedrive',
        name: 'Microsoft OneDrive',
        description: 'Planned in Epic 54.',
        status: 'coming-soon',
        priority: 30,
        capabilities: { browse: true, versionHistory: true, offline: false, sync: true }
    });
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
