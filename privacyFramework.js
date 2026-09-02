// Epic 59: local privacy and user-data control boundary.
// This module inventories local data, creates a credential-free user export, and provides an
// explicit local reset. Server retention/account deletion remains a deployment responsibility.
import {
    createArtProjectPayload,
    getApplicationInfo,
    resetAllApplicationData
} from './state.js';
import { getLocalUserProfile } from './identityFramework.js';

const PRIVACY_CONFIG_KEY = 'art-privacy-config-v1';

function readConfig() {
    try {
        const value = JSON.parse(localStorage.getItem(PRIVACY_CONFIG_KEY) || '');
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

function writeConfig(config) {
    localStorage.setItem(PRIVACY_CONFIG_KEY, JSON.stringify(config));
}

export function getPrivacyConfig() {
    const source = readConfig();
    return {
        telemetryEnabled: source.telemetryEnabled === true,
        lastExportedAt: String(source.lastExportedAt || '')
    };
}

export function updatePrivacyConfig(updates = {}) {
    const next = {
        ...getPrivacyConfig(),
        ...(updates || {}),
        telemetryEnabled: updates.telemetryEnabled === true
    };
    writeConfig(next);
    window.dispatchEvent(new CustomEvent('art-privacy-config-updated', { detail: next }));
    return next;
}

export function getLocalDataInventory() {
    return [
        { id: 'art-state', label: 'Reports, projects, tasks, Progress Logs, settings, and local history', location: 'Browser local storage', userControlled: true },
        { id: 'art-local-user-profile-v1', label: 'Local profile and ART identity information', location: 'Browser local storage', userControlled: true },
        { id: 'art-device-identity-v1', label: 'Local device identity', location: 'Browser local storage', userControlled: true },
        { id: 'art-storage-provider-config-v1', label: 'Storage provider preferences', location: 'Browser local storage', userControlled: true },
        { id: 'art-external-integrations-v1', label: 'External integration connection and sharing preferences', location: 'Browser local storage', userControlled: true },
        { id: 'sessionStorage', label: 'Session-only authentication/provider tokens', location: 'Browser session storage', userControlled: true }
    ];
}

function credentialFreeProfile() {
    const profile = getLocalUserProfile();
    return {
        localUserId: profile.localUserId,
        name: profile.name,
        displayName: profile.displayName,
        jobTitle: profile.jobTitle,
        artRole: profile.artRole,
        email: profile.email
    };
}

export function createUserDataExport() {
    const exportPayload = {
        format: 'ART User Data Export',
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        privacy: {
            note: 'This export intentionally excludes authentication/provider session tokens and passwords.',
            localDataInventory: getLocalDataInventory()
        },
        profile: credentialFreeProfile(),
        project: createArtProjectPayload(),
        application: getApplicationInfo(),
        preferences: {
            privacy: getPrivacyConfig()
        }
    };
    updatePrivacyConfig({ lastExportedAt: exportPayload.exportedAt });
    return exportPayload;
}

export function serializeUserDataExport() {
    return JSON.stringify(createUserDataExport(), null, 2);
}

export function clearLocalUserData() {
    resetAllApplicationData();
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent('art-local-data-cleared'));
    return { ok: true, message: 'Local ART data and session credentials were cleared from this browser.' };
}

export function initializePrivacyFramework() {
    getPrivacyConfig();
    return true;
}
