// Epic 57: provider-independent external integration management.
// This module owns provider registration, optional connection/configuration state, sharing scope,
// and safe status transitions. Individual Jira, GitHub, Azure DevOps, and Google Workspace API
// adapters can plug in without adding provider-specific logic to ART's core report model.
const providerRegistry = new Map();
const CONFIG_KEY = 'art-external-integrations-v1';
const INTEGRATION_STATUSES = Object.freeze([
    'not-connected',
    'connecting',
    'connected',
    'authentication-required',
    'synchronization-required',
    'synchronizing',
    'synchronized',
    'synchronization-failed',
    'permission-denied',
    'service-unavailable',
    'configuration-incomplete'
]);
const SHARE_SCOPES = Object.freeze([
    'current-report',
    'current-project',
    'selected-findings',
    'selected-tasks',
    'selected-progress-log-entries',
    'selected-organization',
    'selected-workspace'
]);

function normalizeText(value) {
    return String(value ?? '').trim();
}

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '');
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeStatus(value) {
    return INTEGRATION_STATUSES.includes(value) ? value : 'not-connected';
}

function normalizeProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('External integrations require an id.');
    return {
        id,
        name: normalizeText(source.name) || id,
        description: normalizeText(source.description),
        status: normalizeStatus(source.status),
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 100,
        capabilities: {
            import: Boolean(source.capabilities?.import),
            export: Boolean(source.capabilities?.export),
            synchronize: Boolean(source.capabilities?.synchronize),
            issueCreation: Boolean(source.capabilities?.issueCreation),
            taskLinks: Boolean(source.capabilities?.taskLinks),
            findingLinks: Boolean(source.capabilities?.findingLinks),
            comments: Boolean(source.capabilities?.comments)
        },
        connect: typeof source.connect === 'function' ? source.connect : null,
        disconnect: typeof source.disconnect === 'function' ? source.disconnect : null,
        testConnection: typeof source.testConnection === 'function' ? source.testConnection : null,
        importData: typeof source.importData === 'function' ? source.importData : null,
        exportData: typeof source.exportData === 'function' ? source.exportData : null,
        synchronize: typeof source.synchronize === 'function' ? source.synchronize : null
    };
}

export function registerExternalIntegration(provider) {
    const normalized = normalizeProvider(provider);
    providerRegistry.set(normalized.id, normalized);
    return { ...normalized };
}

export function getExternalIntegrations() {
    return [...providerRegistry.values()]
        .sort((left, right) => left.priority - right.priority)
        .map((provider) => ({ ...provider }));
}

export function getExternalIntegration(providerId) {
    const provider = providerRegistry.get(normalizeText(providerId));
    return provider ? { ...provider } : null;
}

function normalizeIntegrationConfig(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const records = source.records && typeof source.records === 'object' ? source.records : {};
    return {
        records: Object.fromEntries(Object.entries(records).map(([id, record]) => [id, {
            status: normalizeStatus(record?.status),
            accountLabel: normalizeText(record?.accountLabel),
            configuration: record?.configuration && typeof record.configuration === 'object' ? { ...record.configuration } : {},
            shareScopes: Array.isArray(record?.shareScopes) ? record.shareScopes.filter((scope) => SHARE_SCOPES.includes(scope)) : [],
            lastSynchronizedAt: normalizeText(record?.lastSynchronizedAt),
            message: normalizeText(record?.message),
            updatedAt: normalizeText(record?.updatedAt) || new Date().toISOString()
        }]))
    };
}

export function getExternalIntegrationConfig() {
    return normalizeIntegrationConfig(readJson(CONFIG_KEY, {}));
}

function saveIntegrationConfig(config) {
    const normalized = normalizeIntegrationConfig(config);
    writeJson(CONFIG_KEY, normalized);
    window.dispatchEvent(new CustomEvent('art-external-integrations-updated', { detail: normalized }));
    return normalized;
}

export function getExternalIntegrationState(providerId) {
    const id = normalizeText(providerId);
    const config = getExternalIntegrationConfig();
    return config.records[id] || {
        status: 'not-connected',
        accountLabel: '',
        configuration: {},
        shareScopes: [],
        lastSynchronizedAt: '',
        message: '',
        updatedAt: ''
    };
}

export function updateExternalIntegrationState(providerId, updates = {}) {
    const id = normalizeText(providerId);
    if (!providerRegistry.has(id)) return null;
    const config = getExternalIntegrationConfig();
    const current = getExternalIntegrationState(id);
    config.records[id] = {
        ...current,
        ...(updates || {}),
        status: normalizeStatus(updates.status || current.status),
        shareScopes: Array.isArray(updates.shareScopes || current.shareScopes)
            ? (updates.shareScopes || current.shareScopes).filter((scope) => SHARE_SCOPES.includes(scope))
            : [],
        updatedAt: new Date().toISOString()
    };
    return saveIntegrationConfig(config).records[id];
}

export function setExternalIntegrationShareScopes(providerId, scopes) {
    return updateExternalIntegrationState(providerId, { shareScopes: Array.isArray(scopes) ? scopes : [] });
}

export function isExternalIntegrationConnected(providerId) {
    return getExternalIntegrationState(providerId).status === 'connected'
        || getExternalIntegrationState(providerId).status === 'synchronized';
}

export function getIntegrationStatusLabel(providerId) {
    const status = getExternalIntegrationState(providerId).status;
    return {
        'not-connected': 'Not connected',
        connecting: 'Connecting',
        connected: 'Connected',
        'authentication-required': 'Authentication required',
        'synchronization-required': 'Synchronization required',
        synchronizing: 'Synchronizing',
        synchronized: 'Synchronized',
        'synchronization-failed': 'Synchronization failed',
        'permission-denied': 'Permission denied',
        'service-unavailable': 'Service unavailable',
        'configuration-incomplete': 'Configuration incomplete'
    }[status] || 'Unknown';
}

export async function connectExternalIntegration(providerId) {
    const provider = providerRegistry.get(normalizeText(providerId));
    if (!provider) return { ok: false, message: 'Unknown external integration.' };
    updateExternalIntegrationState(provider.id, { status: 'connecting', message: `Connecting to ${provider.name}.` });
    if (typeof provider.connect !== 'function') {
        const message = `${provider.name} connection is not configured in this ART deployment.`;
        updateExternalIntegrationState(provider.id, { status: 'configuration-incomplete', message });
        return { ok: false, message };
    }
    try {
        const result = await provider.connect();
        updateExternalIntegrationState(provider.id, {
            status: result?.ok ? 'connected' : 'authentication-required',
            accountLabel: result?.accountLabel || '',
            message: result?.message || ''
        });
        return result || { ok: false, message: `${provider.name} connection returned no result.` };
    } catch (error) {
        const message = error.message || `${provider.name} connection failed.`;
        updateExternalIntegrationState(provider.id, { status: 'service-unavailable', message });
        return { ok: false, message };
    }
}

export async function disconnectExternalIntegration(providerId) {
    const provider = providerRegistry.get(normalizeText(providerId));
    if (!provider) return { ok: false, message: 'Unknown external integration.' };
    try {
        if (typeof provider.disconnect === 'function') await provider.disconnect();
        updateExternalIntegrationState(provider.id, { status: 'not-connected', accountLabel: '', message: `${provider.name} disconnected.` });
        return { ok: true, message: `${provider.name} disconnected.` };
    } catch (error) {
        const message = error.message || `${provider.name} could not be disconnected.`;
        updateExternalIntegrationState(provider.id, { message });
        return { ok: false, message };
    }
}

export async function testExternalIntegration(providerId) {
    const provider = providerRegistry.get(normalizeText(providerId));
    if (!provider) return { ok: false, message: 'Unknown external integration.' };
    if (!isExternalIntegrationConnected(provider.id)) return { ok: false, message: `${provider.name} is not connected.` };
    if (typeof provider.testConnection !== 'function') return { ok: true, message: `${provider.name} is connected; no provider-specific test is configured.` };
    return provider.testConnection();
}

export async function synchronizeExternalIntegration(providerId, payload = {}) {
    const provider = providerRegistry.get(normalizeText(providerId));
    if (!provider) return { ok: false, message: 'Unknown external integration.' };
    if (!isExternalIntegrationConnected(provider.id)) return { ok: false, message: `${provider.name} is not connected.` };
    if (typeof provider.synchronize !== 'function') {
        const message = `${provider.name} synchronization is not configured in this ART deployment.`;
        updateExternalIntegrationState(provider.id, { status: 'synchronization-required', message });
        return { ok: false, message };
    }
    updateExternalIntegrationState(provider.id, { status: 'synchronizing', message: `Synchronizing with ${provider.name}.` });
    try {
        const result = await provider.synchronize(payload);
        updateExternalIntegrationState(provider.id, {
            status: result?.ok ? 'synchronized' : 'synchronization-failed',
            lastSynchronizedAt: result?.ok ? new Date().toISOString() : getExternalIntegrationState(provider.id).lastSynchronizedAt,
            message: result?.message || ''
        });
        return result || { ok: false, message: `${provider.name} synchronization returned no result.` };
    } catch (error) {
        const message = error.message || `${provider.name} synchronization failed.`;
        updateExternalIntegrationState(provider.id, { status: 'synchronization-failed', message });
        return { ok: false, message };
    }
}

function registerBuiltInIntegrations() {
    registerExternalIntegration({
        id: 'jira',
        name: 'Jira',
        description: 'Optional Jira issue tracking integration. Requires a deployment-configured OAuth adapter.',
        priority: 10,
        capabilities: { import: true, export: true, synchronize: true, issueCreation: true, taskLinks: true, findingLinks: true, comments: true }
    });
    registerExternalIntegration({
        id: 'github-issues',
        name: 'GitHub Issues',
        description: 'Optional GitHub Issues integration. Requires a deployment-configured OAuth adapter.',
        priority: 20,
        capabilities: { import: true, export: true, synchronize: true, issueCreation: true, taskLinks: true, findingLinks: true, comments: true }
    });
    registerExternalIntegration({
        id: 'azure-devops',
        name: 'Microsoft Azure DevOps',
        description: 'Optional Azure DevOps work-item integration. Requires a deployment-configured OAuth adapter.',
        priority: 30,
        capabilities: { import: true, export: true, synchronize: true, issueCreation: true, taskLinks: true, findingLinks: true, comments: true }
    });
    registerExternalIntegration({
        id: 'google-workspace',
        name: 'Google Workspace',
        description: 'Optional Google Docs, Sheets, and Calendar integration. Separate from Google Drive storage.',
        priority: 40,
        capabilities: { import: true, export: true, synchronize: true, issueCreation: false, taskLinks: false, findingLinks: true, comments: false }
    });
}

export function initializeExternalIntegrationFramework() {
    if (providerRegistry.size === 0) registerBuiltInIntegrations();
    getExternalIntegrationConfig();
    return true;
}
