// Epic 56: provider-neutral storage status and synchronization coordination.
// Provider adapters remain responsible for remote revision checks and content transfer;
// this module owns the shared state machine, accessible announcements, and safe local fallback.
import { getProjectDocumentInfo, hasUnsavedProjectChanges } from './state.js';
import { getStorageProvider, getStorageConfig, isStorageProviderConnected } from './storageProviderFramework.js';

const SYNC_STATUS_KEY = 'art-storage-sync-status-v1';
const SYNC_STATES = Object.freeze([
    'up-to-date',
    'local-changes-pending',
    'remote-changes-available',
    'synchronizing',
    'conflict-detected',
    'save-failed',
    'offline',
    'unknown'
]);

let syncStatus = null;
let initialized = false;

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeStatus(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const providerId = normalizeText(source.providerId) || 'local';
    const status = SYNC_STATES.includes(source.status) ? source.status : 'unknown';
    return {
        providerId,
        fileId: normalizeText(source.fileId),
        fileName: normalizeText(source.fileName),
        status,
        message: normalizeText(source.message) || 'Storage synchronization state is unknown.',
        lastSynchronizedAt: normalizeText(source.lastSynchronizedAt),
        lastKnownRemoteModifiedAt: normalizeText(source.lastKnownRemoteModifiedAt),
        updatedAt: normalizeText(source.updatedAt) || new Date().toISOString()
    };
}

function readStoredStatus() {
    try {
        const value = JSON.parse(localStorage.getItem(SYNC_STATUS_KEY) || '');
        return normalizeStatus(value);
    } catch {
        return normalizeStatus();
    }
}

function persistStatus(status) {
    syncStatus = normalizeStatus(status);
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(syncStatus));
    window.dispatchEvent(new CustomEvent('art-storage-sync-updated', { detail: syncStatus }));
    return { ...syncStatus };
}

export function getStorageSyncStates() {
    return [...SYNC_STATES];
}

export function getStorageSyncStatus() {
    if (!syncStatus) syncStatus = readStoredStatus();
    const project = getProjectDocumentInfo();
    const providerId = normalizeText(project.storageProviderId) || 'local';
    if (!syncStatus.fileName && project.fileName) {
        syncStatus = normalizeStatus({
            ...syncStatus,
            providerId,
            fileId: project.storageFileId,
            fileName: project.fileName
        });
    }
    return { ...syncStatus };
}

export function updateStorageSyncStatus(updates = {}, options = {}) {
    const next = normalizeStatus({ ...getStorageSyncStatus(), ...(updates || {}), updatedAt: new Date().toISOString() });
    if (options.persist === false) {
        syncStatus = next;
        window.dispatchEvent(new CustomEvent('art-storage-sync-updated', { detail: syncStatus }));
        return { ...syncStatus };
    }
    return persistStatus(next);
}

function getStatusLabel(status) {
    return {
        'up-to-date': 'Up to date',
        'local-changes-pending': 'Local changes pending',
        'remote-changes-available': 'Remote changes available',
        synchronizing: 'Synchronizing',
        'conflict-detected': 'Conflict detected',
        'save-failed': 'Save failed',
        offline: 'Offline',
        unknown: 'Unknown'
    }[status] || 'Unknown';
}

export function getStorageSyncStatusLabel() {
    return getStatusLabel(getStorageSyncStatus().status);
}

export function markLocalStorageChangesPending(message = 'Local changes are waiting to be synchronized.') {
    return updateStorageSyncStatus({ status: 'local-changes-pending', message });
}

export function markStorageSyncFailure(message = 'The storage operation failed. Your local work was preserved.') {
    return updateStorageSyncStatus({ status: 'save-failed', message });
}

export function markStorageConflict(message = 'Remote changes require conflict resolution before they can be synchronized.') {
    return updateStorageSyncStatus({ status: 'conflict-detected', message });
}

export function markStorageRemoteChangesAvailable(message = 'Remote changes are available. Refresh to review them.') {
    return updateStorageSyncStatus({ status: 'remote-changes-available', message });
}

export function markStorageSynchronized(metadata = {}) {
    const project = getProjectDocumentInfo();
    return updateStorageSyncStatus({
        providerId: normalizeText(metadata.providerId) || project.storageProviderId || 'local',
        fileId: normalizeText(metadata.fileId) || project.storageFileId,
        fileName: normalizeText(metadata.fileName) || project.fileName,
        status: 'up-to-date',
        message: 'The active file is up to date.',
        lastSynchronizedAt: new Date().toISOString(),
        lastKnownRemoteModifiedAt: normalizeText(metadata.remoteModifiedAt)
    });
}

export function getActiveStorageSummary() {
    const project = getProjectDocumentInfo();
    const config = getStorageConfig();
    const providerId = normalizeText(project.storageProviderId) || config.defaultProviderId || 'local';
    const provider = getStorageProvider(providerId) || getStorageProvider('local');
    const status = getStorageSyncStatus();
    return {
        providerId,
        providerName: provider?.name || providerId,
        fileId: project.storageFileId,
        fileName: project.fileName,
        connected: providerId === 'local' || providerId === 'network-folder' || isStorageProviderConnected(providerId),
        syncStatus: status.status,
        syncStatusLabel: getStatusLabel(status.status),
        syncMessage: status.message
    };
}

export function canSynchronizeActiveStorage() {
    const summary = getActiveStorageSummary();
    return summary.connected && Boolean(summary.fileId) && summary.providerId !== 'local' && summary.providerId !== 'network-folder';
}

export async function synchronizeActiveStorage(options = {}) {
    const summary = getActiveStorageSummary();
    if (!summary.connected) {
        return { ok: false, message: `${summary.providerName} is not connected. Your local work remains available.` };
    }
    if (!summary.fileId || summary.providerId === 'local' || summary.providerId === 'network-folder') {
        markStorageSynchronized({ providerId: summary.providerId, fileName: summary.fileName });
        return { ok: true, message: 'Local file state is current. External synchronization is not required.' };
    }
    if (hasUnsavedProjectChanges()) {
        markLocalStorageChangesPending('Save your local changes before synchronizing the remote file.');
        return { ok: false, message: 'Save your local changes before synchronizing the remote file.' };
    }
    updateStorageSyncStatus({ status: 'synchronizing', message: 'Checking the remote file for changes.' });
    // Provider-specific remote revision work will call updateStorageSyncStatus with its result.
    if (typeof options.providerSynchronize === 'function') {
        try {
            const result = await options.providerSynchronize(summary);
            if (result?.ok) markStorageSynchronized({ ...summary, ...(result.metadata || {}) });
            else markStorageSyncFailure(result?.message || 'Synchronization failed.');
            return result || { ok: false, message: 'Synchronization returned no result.' };
        } catch (error) {
            markStorageSyncFailure(error.message || 'Synchronization failed.');
            return { ok: false, message: error.message || 'Synchronization failed.' };
        }
    }
    const result = { ok: false, message: `${summary.providerName} synchronization is not available for this file yet. Your local work is unchanged.` };
    markStorageSyncFailure(result.message);
    return result;
}

export async function refreshActiveStorage(options = {}) {
    const summary = getActiveStorageSummary();
    if (!summary.connected) return { ok: false, message: `${summary.providerName} is not connected.` };
    if (typeof options.providerRefresh === 'function') {
        try {
            const result = await options.providerRefresh(summary);
            if (result?.remoteChanged) markStorageRemoteChangesAvailable(result.message);
            else if (result?.conflict) markStorageConflict(result.message);
            else if (result?.ok) markStorageSynchronized({ ...summary, ...(result.metadata || {}) });
            return result || { ok: false, message: 'Refresh returned no result.' };
        } catch (error) {
            markStorageSyncFailure(error.message || 'Refresh failed.');
            return { ok: false, message: error.message || 'Refresh failed.' };
        }
    }
    if (summary.providerId === 'local' || summary.providerId === 'network-folder') {
        markStorageSynchronized({ providerId: summary.providerId, fileName: summary.fileName });
        return { ok: true, message: 'Local storage is available. External change detection is not required for this local state.' };
    }
    const result = { ok: false, message: `${summary.providerName} refresh is not available for this file yet. Your local work is unchanged.` };
    markStorageSyncFailure(result.message);
    return result;
}

function updateOnlineStatus() {
    if (navigator.onLine === false) {
        updateStorageSyncStatus({ status: 'offline', message: 'Network is unavailable. Local work remains available.' });
    } else if (getStorageSyncStatus().status === 'offline') {
        updateStorageSyncStatus({ status: 'unknown', message: 'Connection restored. Refresh or synchronize to check the provider.' });
    }
}

export function initializeStorageSynchronizationFramework() {
    if (initialized) return true;
    initialized = true;
    syncStatus = readStoredStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('art-storage-config-updated', () => {
        const config = getStorageConfig();
        updateStorageSyncStatus({ providerId: config.defaultProviderId }, { persist: false });
    });
    updateOnlineStatus();
    return true;
}
