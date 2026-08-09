import { appState, getActiveProjectWorkspace, getCollaborationConfig, getProjectWorkspaces, normalizeCollaborationResourceMetadata, saveState, upsertProjectWorkspace, updateCollaborationConfig } from './state.js';

const COLLABORATION_FRAMEWORK_VERSION = '1.0.0';

const providerRegistry = new Map();
const LIVE_PROVIDER_ID = 'live-server';
const LIVE_DEFAULT_SERVER_URL = 'ws://localhost:8787/art-live';
const LIVE_CONNECT_TIMEOUT_MS = 8000;

const liveConnection = {
    socket: null,
    serverUrl: '',
    state: 'offline',
    lastError: '',
    lastConnectedAt: '',
    connectAttemptId: 0,
    pendingSnapshotRequests: new Map()
};

function normalizeText(value) {
    return String(value || '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function getLiveProviderCapabilities() {
    return {
        sharedWorkspaces: true,
        asynchronousCollaboration: true,
        synchronizedCollaboration: true,
        realtimeEditing: true,
        comments: true,
        sharing: true,
        permissions: true,
        versionHistory: true,
        presence: true,
        synchronization: true,
        offline: false
    };
}

function normalizeLiveServerUrl(value) {
    return normalizeText(value);
}

function updateLiveState(partial = {}, options = {}) {
    const config = getCollaborationConfig();
    const currentLive = config.live && typeof config.live === 'object' ? config.live : {};
    updateCollaborationConfig({
        live: {
            ...currentLive,
            ...partial
        }
    }, {
        action: String(options.action || 'Updated collaboration live connection state'),
        persist: options.persist !== false
    });
}

function ensureLiveProviderRegistered() {
    const existing = getCollaborationProvider(LIVE_PROVIDER_ID);
    if (existing) return existing;
    return registerCollaborationProvider({
        id: LIVE_PROVIDER_ID,
        name: 'Live collaboration server',
        description: 'Network collaboration provider for real-time multi-user sessions.',
        status: 'available',
        priority: 20,
        capabilities: getLiveProviderCapabilities()
    });
}

function clearLiveSocket() {
    const socket = liveConnection.socket;
    liveConnection.socket = null;
    if (!socket) return;
    try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
    } catch {
        // no-op
    }
}

function sendLiveMessage(payload = {}) {
    const socket = liveConnection.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
        socket.send(JSON.stringify(payload));
        return true;
    } catch {
        return false;
    }
}

function buildWorkspaceCollaborationSnapshot(workspaceId = '') {
    const workspace = resolveWorkspace(workspaceId);
    if (!workspace) return null;

    const collaborationResources = workspace?.resources?.extensions?.collaborationResources
        && typeof workspace.resources.extensions.collaborationResources === 'object'
        ? workspace.resources.extensions.collaborationResources
        : {};

    return {
        workspaceId: normalizeText(workspace.id),
        workspaceName: normalizeText(workspace.name || workspace.id),
        generatedAt: nowIso(),
        collaborationMode: normalizeText(getCollaborationConfig().mode),
        collaborationResources,
        meta: {
            source: 'art-client',
            userId: normalizeText(appState.auditors || 'User') || 'User'
        }
    };
}

function applyIncomingWorkspaceCollaborationSnapshot(snapshot = {}, options = {}) {
    const workspaceId = normalizeText(snapshot.workspaceId || options.workspaceId || appState.activeWorkspaceId);
    if (!workspaceId) return { ok: false, reason: 'missing-workspace' };

    const workspace = resolveWorkspace(workspaceId);
    if (!workspace) return { ok: false, reason: 'workspace-not-found' };

    const incomingResources = snapshot.collaborationResources && typeof snapshot.collaborationResources === 'object'
        ? snapshot.collaborationResources
        : {};

    const currentResources = workspace?.resources?.extensions?.collaborationResources
        && typeof workspace.resources.extensions.collaborationResources === 'object'
        ? workspace.resources.extensions.collaborationResources
        : {};

    const mergedResources = options.overwrite
        ? { ...incomingResources }
        : {
            ...currentResources,
            ...incomingResources
        };

    const nextWorkspace = {
        ...workspace,
        resources: {
            ...(workspace.resources && typeof workspace.resources === 'object' ? workspace.resources : {}),
            extensions: {
                ...((workspace.resources && typeof workspace.resources === 'object' && workspace.resources.extensions && typeof workspace.resources.extensions === 'object')
                    ? workspace.resources.extensions
                    : {}),
                collaborationResources: mergedResources
            }
        },
        lastModifiedAt: nowIso()
    };

    upsertProjectWorkspace(nextWorkspace, {
        action: 'Applied collaboration snapshot from live server',
        setActive: normalizeText(workspace.id) === normalizeText(appState.activeWorkspaceId),
        persist: true
    });

    updateCollaborationConfig({
        synchronization: {
            ...getCollaborationConfig().synchronization,
            lastSyncAt: nowIso()
        }
    }, {
        action: 'Applied incoming collaboration snapshot',
        persist: true
    });

    emitCollaborationEvent('Snapshot Applied', {
        providerId: LIVE_PROVIDER_ID,
        workspaceId,
        overwrite: Boolean(options.overwrite),
        resourceCount: Object.keys(mergedResources).length
    });

    return { ok: true, workspaceId, resourceCount: Object.keys(mergedResources).length };
}

export function getCollaborationLiveConnectionSnapshot() {
    const config = getCollaborationConfig();
    const live = config.live && typeof config.live === 'object' ? config.live : {};
    const connected = Boolean(liveConnection.socket && liveConnection.socket.readyState === WebSocket.OPEN);
    return {
        providerId: LIVE_PROVIDER_ID,
        serverUrl: normalizeLiveServerUrl(live.serverUrl || liveConnection.serverUrl || LIVE_DEFAULT_SERVER_URL),
        connectionState: normalizeText(live.connectionState || live.state || liveConnection.state || 'offline') || 'offline',
        lastConnectedAt: normalizeText(live.lastConnectedAt || liveConnection.lastConnectedAt),
        lastError: normalizeText(live.lastError || liveConnection.lastError),
        connected
    };
}

function emitCollaborationEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('art-collaboration-framework-event', {
        detail: {
            type,
            at: nowIso(),
            ...detail
        }
    }));
}

function normalizeProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Collaboration provider requires an id.');

    return {
        id,
        name: normalizeText(source.name || id),
        description: normalizeText(source.description),
        status: normalizeText(source.status || 'available') || 'available',
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 100,
        capabilities: {
            sharedWorkspaces: source.capabilities?.sharedWorkspaces !== false,
            asynchronousCollaboration: source.capabilities?.asynchronousCollaboration !== false,
            synchronizedCollaboration: Boolean(source.capabilities?.synchronizedCollaboration),
            realtimeEditing: Boolean(source.capabilities?.realtimeEditing),
            comments: Boolean(source.capabilities?.comments),
            sharing: Boolean(source.capabilities?.sharing),
            permissions: Boolean(source.capabilities?.permissions),
            versionHistory: Boolean(source.capabilities?.versionHistory),
            presence: Boolean(source.capabilities?.presence),
            synchronization: Boolean(source.capabilities?.synchronization),
            offline: source.capabilities?.offline !== false
        },
        getStatus: typeof source.getStatus === 'function' ? source.getStatus : null,
        getCapabilities: typeof source.getCapabilities === 'function' ? source.getCapabilities : null,
        getResourceMetadata: typeof source.getResourceMetadata === 'function' ? source.getResourceMetadata : null,
        setResourceMetadata: typeof source.setResourceMetadata === 'function' ? source.setResourceMetadata : null,
        connect: typeof source.connect === 'function' ? source.connect : null,
        disconnect: typeof source.disconnect === 'function' ? source.disconnect : null
    };
}

function getSortedProviders() {
    return [...providerRegistry.values()].sort((left, right) => left.priority - right.priority);
}

function normalizeCollaborationSession(session, index = 0) {
    const source = session && typeof session === 'object' ? session : {};
    const timestamp = nowIso();
    return {
        id: normalizeText(source.id || `collaboration-session-${index + 1}`),
        resourceType: normalizeText(source.resourceType),
        resourceId: normalizeText(source.resourceId),
        userId: normalizeText(source.userId || appState.auditors || 'User'),
        state: normalizeText(source.state || 'inactive') || 'inactive',
        providerId: normalizeText(source.providerId || getCollaborationConfig().providerId),
        connectionState: normalizeText(source.connectionState || 'offline') || 'offline',
        startedAt: normalizeText(source.startedAt || timestamp),
        lastActivityAt: normalizeText(source.lastActivityAt || timestamp),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
    };
}

function withUpdatedSessions(nextSessions, action) {
    updateCollaborationConfig({
        sessions: Array.isArray(nextSessions) ? nextSessions.map((session, index) => normalizeCollaborationSession(session, index)) : []
    }, {
        action: String(action || 'Updated collaboration sessions'),
        persist: true
    });
}

function normalizeConflictEntry(conflict, index = 0) {
    const source = conflict && typeof conflict === 'object' ? conflict : {};
    const timestamp = nowIso();
    return {
        id: normalizeText(source.id || `conflict-${index + 1}-${Date.now()}`),
        resourceType: normalizeText(source.resourceType || 'resource').toLowerCase(),
        resourceId: normalizeText(source.resourceId),
        workspaceId: normalizeText(source.workspaceId || appState.activeWorkspaceId),
        summary: normalizeText(source.summary || 'Collaboration synchronization conflict'),
        strategy: normalizeText(source.strategy || getCollaborationConfig().synchronization?.conflictStrategy || 'manual-review') || 'manual-review',
        status: normalizeText(source.status || 'pending') || 'pending',
        detectedAt: normalizeText(source.detectedAt || timestamp) || timestamp,
        resolvedAt: normalizeText(source.resolvedAt),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
    };
}

function normalizePendingConflicts(conflicts = []) {
    return Array.isArray(conflicts)
        ? conflicts.map((conflict, index) => normalizeConflictEntry(conflict, index)).filter((conflict) => conflict.id)
        : [];
}

function withUpdatedSynchronization(nextSynchronization = {}, action = 'Updated collaboration synchronization state') {
    const config = getCollaborationConfig();
    const current = config.synchronization && typeof config.synchronization === 'object' ? config.synchronization : {};
    const pendingConflicts = normalizePendingConflicts(nextSynchronization.pendingConflicts ?? current.pendingConflicts ?? []);
    updateCollaborationConfig({
        synchronization: {
            ...current,
            ...nextSynchronization,
            pendingConflicts
        }
    }, {
        action,
        persist: true
    });
}

function collectWorkspaceResourceRefs(workspace) {
    const safeWorkspace = workspace && typeof workspace === 'object' ? workspace : null;
    if (!safeWorkspace) return [];

    const reportIds = [
        ...(Array.isArray(safeWorkspace.resources?.reports) ? safeWorkspace.resources.reports : []),
        ...(Array.isArray(safeWorkspace.associatedReportIds) ? safeWorkspace.associatedReportIds : [])
    ].map((id) => normalizeText(id)).filter(Boolean);
    const templateIds = [
        ...(Array.isArray(safeWorkspace.resources?.templates) ? safeWorkspace.resources.templates : []),
        ...(Array.isArray(safeWorkspace.associatedTemplateIds) ? safeWorkspace.associatedTemplateIds : [])
    ].map((id) => normalizeText(id)).filter(Boolean);
    const assets = Array.isArray(safeWorkspace.resources?.projectAssets) ? safeWorkspace.resources.projectAssets : [];

    const refs = [
        ...reportIds.map((id) => ({ type: 'report', id })),
        ...templateIds.map((id) => ({ type: 'template', id })),
        ...assets.map((asset) => ({ type: 'asset', id: normalizeText(asset?.id) })).filter((asset) => asset.id)
    ];

    const seen = new Set();
    return refs.filter((item) => {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isDiscoverableVisibility(visibility, discoveryScope) {
    const value = normalizeText(visibility).toLowerCase();
    const scope = normalizeText(discoveryScope).toLowerCase();
    if (scope === 'organization') return value === 'organization' || value === 'public';
    if (scope === 'workspace') return value === 'workspace' || value === 'organization' || value === 'public' || value === 'shared';
    return value !== 'private';
}

export function getCollaborationConflictSummary() {
    const config = getCollaborationConfig();
    const conflicts = normalizePendingConflicts(config.synchronization?.pendingConflicts || []);
    const pending = conflicts.filter((conflict) => conflict.status === 'pending');
    const resolved = conflicts.filter((conflict) => conflict.status === 'resolved');

    return {
        totalCount: conflicts.length,
        pendingCount: pending.length,
        resolvedCount: resolved.length,
        oldestPending: pending[0] || null,
        latestResolved: resolved.length > 0 ? resolved[resolved.length - 1] : null,
        conflicts
    };
}

export function queueCollaborationConflict(conflict = {}, options = {}) {
    const config = getCollaborationConfig();
    const current = normalizePendingConflicts(config.synchronization?.pendingConflicts || []);
    const next = [
        ...current,
        normalizeConflictEntry({
            ...conflict,
            status: 'pending',
            strategy: normalizeText(conflict.strategy || config.synchronization?.conflictStrategy || 'manual-review') || 'manual-review',
            detectedAt: nowIso(),
            workspaceId: normalizeText(conflict.workspaceId || appState.activeWorkspaceId)
        }, current.length)
    ];

    withUpdatedSynchronization({ pendingConflicts: next }, options.action || 'Queued collaboration conflict');
    const queued = next[next.length - 1];
    emitCollaborationEvent('Conflict Queued', {
        conflictId: queued.id,
        resourceType: queued.resourceType,
        resourceId: queued.resourceId,
        workspaceId: queued.workspaceId
    });
    return queued;
}

function buildConflictMetadataUpdates(conflict, strategy) {
    const source = conflict?.metadata && typeof conflict.metadata === 'object' ? conflict.metadata : {};
    const incomingMetadata = source.incomingMetadata && typeof source.incomingMetadata === 'object' ? source.incomingMetadata : {};
    const incomingComments = Array.isArray(source.incomingComments)
        ? source.incomingComments
        : Array.isArray(incomingMetadata.comments)
            ? incomingMetadata.comments
            : [];

    if (strategy === 'latest-write-wins') {
        return {
            owner: normalizeText(incomingMetadata.owner),
            visibility: normalizeText(incomingMetadata.visibility),
            permissionProfile: normalizeText(incomingMetadata.permissionProfile),
            sharing: Array.isArray(incomingMetadata.sharing) ? incomingMetadata.sharing : undefined,
            permissionAssignments: Array.isArray(incomingMetadata.permissionAssignments) ? incomingMetadata.permissionAssignments : undefined,
            comments: incomingComments.length > 0 ? incomingComments : undefined
        };
    }

    if (strategy === 'metadata-priority') {
        return {
            owner: normalizeText(incomingMetadata.owner),
            visibility: normalizeText(incomingMetadata.visibility),
            permissionProfile: normalizeText(incomingMetadata.permissionProfile),
            sharing: Array.isArray(incomingMetadata.sharing) ? incomingMetadata.sharing : undefined,
            permissionAssignments: Array.isArray(incomingMetadata.permissionAssignments) ? incomingMetadata.permissionAssignments : undefined
        };
    }

    if (strategy === 'comments-append') {
        const workspaceId = normalizeText(conflict.workspaceId || appState.activeWorkspaceId);
        const current = getCollaborationResourceMetadata(conflict.resourceType, conflict.resourceId, workspaceId);
        const existingComments = Array.isArray(current.comments) ? current.comments : [];
        return {
            comments: [
                ...existingComments,
                ...incomingComments.map((comment) => ({
                    at: normalizeText(comment?.at || nowIso()) || nowIso(),
                    author: normalizeText(comment?.author || 'Remote collaborator') || 'Remote collaborator',
                    text: normalizeText(comment?.text)
                })).filter((comment) => comment.text)
            ]
        };
    }

    return null;
}

function applyConflictResolutionMutation(conflict, strategy) {
    if (!conflict?.resourceType || !conflict?.resourceId) {
        return { ok: false, reason: 'missing-resource' };
    }

    if (strategy === 'manual-review') {
        return { ok: true, applied: false, reason: 'manual-review' };
    }

    const updates = buildConflictMetadataUpdates(conflict, strategy);
    if (!updates) {
        return { ok: true, applied: false, reason: 'no-op' };
    }

    const result = setCollaborationResourceMetadata(conflict.resourceType, conflict.resourceId, updates, {
        workspaceId: normalizeText(conflict.workspaceId || appState.activeWorkspaceId),
        action: `Resolved conflict using ${strategy}`,
        author: 'Collaboration Engine'
    });

    if (!result?.ok) {
        return { ok: false, applied: false, reason: result?.reason || 'update-failed' };
    }

    return { ok: true, applied: true, reason: strategy };
}

export function resolveCollaborationConflict(conflictId, options = {}) {
    const id = normalizeText(conflictId);
    if (!id) return { ok: false, reason: 'missing-id' };

    const config = getCollaborationConfig();
    const current = normalizePendingConflicts(config.synchronization?.pendingConflicts || []);
    const index = current.findIndex((conflict) => conflict.id === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const strategy = normalizeText(options.strategy || config.synchronization?.conflictStrategy || current[index].strategy || 'manual-review') || 'manual-review';
    const mutation = applyConflictResolutionMutation(current[index], strategy);
    const next = [...current];
    next[index] = {
        ...next[index],
        strategy,
        status: 'resolved',
        resolvedAt: nowIso(),
        metadata: {
            ...next[index].metadata,
            resolution: normalizeText(options.resolution || strategy),
            resolutionApplied: mutation.ok && Boolean(mutation.applied),
            resolutionDetail: normalizeText(mutation.reason || '')
        }
    };

    withUpdatedSynchronization({
        pendingConflicts: next,
        lastSyncAt: nowIso()
    }, options.action || 'Resolved collaboration conflict');

    emitCollaborationEvent('Conflict Resolved', {
        conflictId: next[index].id,
        strategy,
        resourceType: next[index].resourceType,
        resourceId: next[index].resourceId,
        workspaceId: next[index].workspaceId
    });

    return {
        ok: true,
        conflict: next[index],
        mutation
    };
}

export function createCollaborationDiscoverySnapshot(options = {}) {
    const config = getCollaborationConfig();
    const workspace = resolveWorkspace(options.workspaceId);
    if (!workspace) {
        return {
            workspaceId: '',
            workspaceName: '',
            generatedAt: nowIso(),
            discoveryScope: config.sharing?.discoveryScope || 'workspace',
            entries: [],
            totalEntries: 0
        };
    }

    const discoveryScope = normalizeText(config.sharing?.discoveryScope || 'workspace').toLowerCase() || 'workspace';
    const allowDirectoryListing = Boolean(config.sharing?.allowDirectoryListing);
    const refs = collectWorkspaceResourceRefs(workspace);
    const entries = refs.map((ref) => {
        const metadata = getCollaborationResourceMetadata(ref.type, ref.id, workspace.id);
        const isDiscoverable = allowDirectoryListing || isDiscoverableVisibility(metadata.visibility, discoveryScope);
        return {
            resourceType: ref.type,
            resourceId: ref.id,
            visibility: metadata.visibility || 'private',
            sharing: Array.isArray(metadata.sharing) ? metadata.sharing : [],
            permissionProfile: metadata.permissionProfile || '',
            owner: metadata.owner || '',
            discoverable: isDiscoverable,
            reason: isDiscoverable ? 'discoverable' : 'visibility-restricted'
        };
    }).filter((entry) => entry.discoverable);

    const snapshot = {
        workspaceId: workspace.id,
        workspaceName: workspace.name || workspace.id,
        generatedAt: nowIso(),
        discoveryScope,
        allowDirectoryListing,
        channels: Array.isArray(config.sharing?.channels) ? config.sharing.channels : [],
        requireApproval: config.sharing?.requireApproval !== false,
        entries,
        totalEntries: entries.length
    };

    if (options.emitEvent !== false) {
        emitCollaborationEvent('Discovery Snapshot Generated', {
            workspaceId: workspace.id,
            entryCount: snapshot.totalEntries,
            discoveryScope
        });
    }

    return snapshot;
}

export function getCollaborationSessionSummary() {
    const config = getCollaborationConfig();
    const sessions = Array.isArray(config.sessions) ? config.sessions.map((session, index) => normalizeCollaborationSession(session, index)) : [];
    const activeSessions = sessions.filter((session) => session.state !== 'inactive');
    const connectedSessions = sessions.filter((session) => session.connectionState === 'connected');
    const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const latestActivityAt = sessions.reduce((latest, session) => {
        const candidate = session.lastActivityAt || session.startedAt || '';
        return candidate && (!latest || candidate > latest) ? candidate : latest;
    }, '');

    return {
        totalCount: sessions.length,
        activeCount: activeSessions.length,
        connectedCount: connectedSessions.length,
        latestSession,
        latestActivityAt,
        sessions
    };
}

export function upsertCollaborationSession(session, options = {}) {
    const source = normalizeCollaborationSession(session);
    const config = getCollaborationConfig();
    const sessions = Array.isArray(config.sessions) ? config.sessions.map((item, index) => normalizeCollaborationSession(item, index)) : [];
    const timestamp = nowIso();
    const matchIndex = sessions.findIndex((item) => item.id === source.id || (
        item.resourceType === source.resourceType &&
        item.resourceId === source.resourceId &&
        item.userId === source.userId
    ));
    const nextSession = {
        ...source,
        state: normalizeText(options.state || source.state || 'active') || 'active',
        connectionState: normalizeText(options.connectionState || source.connectionState || 'connected') || 'connected',
        startedAt: normalizeText(source.startedAt || timestamp),
        lastActivityAt: timestamp,
        metadata: {
            ...source.metadata,
            ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {})
        }
    };

    if (matchIndex >= 0) {
        sessions[matchIndex] = {
            ...sessions[matchIndex],
            ...nextSession,
            id: sessions[matchIndex].id || nextSession.id
        };
    } else {
        sessions.push(nextSession);
    }

    withUpdatedSessions(sessions, options.action || 'Updated collaboration session');
    emitCollaborationEvent('Session Updated', {
        sessionId: nextSession.id,
        resourceType: nextSession.resourceType,
        resourceId: nextSession.resourceId,
        userId: nextSession.userId
    });
    return nextSession;
}

export function clearCollaborationSessions(options = {}) {
    withUpdatedSessions([], options.action || 'Cleared collaboration sessions');
    emitCollaborationEvent('Sessions Cleared', {});
    return true;
}

export async function connectCollaborationLiveServer(options = {}) {
    if (typeof WebSocket === 'undefined') {
        return { ok: false, reason: 'websocket-unavailable' };
    }

    const config = getCollaborationConfig();
    const serverUrl = normalizeLiveServerUrl(options.serverUrl || config.live?.serverUrl || LIVE_DEFAULT_SERVER_URL);
    if (!serverUrl) {
        return { ok: false, reason: 'missing-server-url' };
    }
    if (!/^wss?:\/\//i.test(serverUrl)) {
        return { ok: false, reason: 'invalid-server-url' };
    }

    ensureLiveProviderRegistered();
    const attemptId = Date.now();
    liveConnection.connectAttemptId = attemptId;
    liveConnection.serverUrl = serverUrl;
    liveConnection.state = 'connecting';
    liveConnection.lastError = '';

    updateLiveState({
        serverUrl,
        connectionState: 'connecting',
        lastError: ''
    }, {
        action: 'Connecting to live collaboration server',
        persist: true
    });

    updateCollaborationConfig({
        providerId: LIVE_PROVIDER_ID,
        providerName: 'Live collaboration server',
        providerStatus: 'connecting',
        providerCapabilities: getLiveProviderCapabilities()
    }, {
        action: 'Preparing live collaboration provider',
        persist: true
    });

    clearLiveSocket();

    return await new Promise((resolve) => {
        let settled = false;
        let opened = false;
        const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(1000, Number(options.timeoutMs)) : LIVE_CONNECT_TIMEOUT_MS;
        const startedAt = nowIso();
        let socket;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };

        try {
            socket = new WebSocket(serverUrl);
        } catch {
            liveConnection.state = 'offline';
            liveConnection.lastError = 'Unable to create WebSocket connection.';
            updateLiveState({
                connectionState: 'offline',
                lastError: liveConnection.lastError
            }, {
                action: 'Live collaboration connection failed',
                persist: true
            });
            updateCollaborationProviderStatus(LIVE_PROVIDER_ID, 'degraded', {
                action: 'Live provider connection failed',
                persist: true
            });
            finish({ ok: false, reason: 'connect-failed' });
            return;
        }

        liveConnection.socket = socket;

        const timeoutId = window.setTimeout(() => {
            if (opened || settled || liveConnection.connectAttemptId !== attemptId) return;
            try {
                socket.close();
            } catch {
                // no-op
            }
            liveConnection.state = 'offline';
            liveConnection.lastError = 'Connection timed out.';
            updateLiveState({
                connectionState: 'offline',
                lastError: liveConnection.lastError
            }, {
                action: 'Live collaboration connection timed out',
                persist: true
            });
            updateCollaborationProviderStatus(LIVE_PROVIDER_ID, 'degraded', {
                action: 'Live provider timed out',
                persist: true
            });
            finish({ ok: false, reason: 'timeout' });
        }, timeoutMs);

        socket.onopen = () => {
            if (liveConnection.connectAttemptId !== attemptId) return;
            opened = true;
            window.clearTimeout(timeoutId);
            const connectedAt = nowIso();
            liveConnection.state = 'connected';
            liveConnection.lastError = '';
            liveConnection.lastConnectedAt = connectedAt;

            updateLiveState({
                serverUrl,
                connectionState: 'connected',
                lastConnectedAt: connectedAt,
                lastError: ''
            }, {
                action: 'Connected to live collaboration server',
                persist: true
            });

            updateCollaborationProviderStatus(LIVE_PROVIDER_ID, 'connected', {
                action: 'Live provider connected',
                persist: true
            });

            emitCollaborationEvent('Live Connection Opened', {
                providerId: LIVE_PROVIDER_ID,
                serverUrl,
                startedAt
            });

            const handshake = {
                type: 'art-collaboration-handshake',
                at: connectedAt,
                providerId: LIVE_PROVIDER_ID,
                workspaceId: normalizeText(appState.activeWorkspaceId),
                userId: normalizeText(appState.auditors || 'User'),
                token: normalizeText(options.authToken)
            };
            sendLiveMessage(handshake);

            finish({ ok: true, providerId: LIVE_PROVIDER_ID, serverUrl, connectedAt });
        };

        socket.onerror = () => {
            if (liveConnection.connectAttemptId !== attemptId) return;
            if (opened) return;
            liveConnection.state = 'offline';
            liveConnection.lastError = 'Connection error.';
            updateLiveState({
                connectionState: 'offline',
                lastError: liveConnection.lastError
            }, {
                action: 'Live collaboration connection error',
                persist: true
            });
            updateCollaborationProviderStatus(LIVE_PROVIDER_ID, 'degraded', {
                action: 'Live provider connection error',
                persist: true
            });
        };

        socket.onclose = () => {
            const wasOpened = opened;
            clearLiveSocket();
            if (liveConnection.connectAttemptId !== attemptId && !wasOpened) return;
            liveConnection.state = 'offline';
            updateLiveState({
                connectionState: 'offline'
            }, {
                action: 'Disconnected from live collaboration server',
                persist: true
            });
            updateCollaborationProviderStatus(LIVE_PROVIDER_ID, wasOpened ? 'available' : 'degraded', {
                action: 'Live provider disconnected',
                persist: true
            });
            emitCollaborationEvent('Live Connection Closed', {
                providerId: LIVE_PROVIDER_ID,
                serverUrl
            });
            if (!wasOpened) {
                window.clearTimeout(timeoutId);
                finish({ ok: false, reason: 'closed' });
            }
        };

        socket.onmessage = (event) => {
            const raw = String(event?.data || '');
            let payload = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = null;
            }

            const messageType = normalizeText(payload?.type);
            if (messageType === 'art-collaboration-snapshot-response') {
                const requestId = normalizeText(payload?.requestId);
                const pending = requestId ? liveConnection.pendingSnapshotRequests.get(requestId) : null;
                if (pending) {
                    liveConnection.pendingSnapshotRequests.delete(requestId);
                    const receivedSnapshot = payload?.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
                    if (!receivedSnapshot) {
                        pending.resolve({ ok: false, reason: 'empty-snapshot', requestId });
                    } else {
                        const applyResult = pending.apply
                            ? applyIncomingWorkspaceCollaborationSnapshot(receivedSnapshot, { workspaceId: pending.workspaceId })
                            : { ok: true, skipped: true };
                        pending.resolve({
                            ok: Boolean(applyResult?.ok),
                            requestId,
                            workspaceId: pending.workspaceId,
                            applied: Boolean(applyResult?.ok && !applyResult?.skipped),
                            applyResult,
                            snapshot: receivedSnapshot
                        });
                    }
                }
            }

            emitCollaborationEvent('Live Message Received', {
                providerId: LIVE_PROVIDER_ID,
                serverUrl,
                payload: raw
            });
        };
    });
}

export function disconnectCollaborationLiveServer(options = {}) {
    const hadSocket = Boolean(liveConnection.socket);
    const socket = liveConnection.socket;
    clearLiveSocket();

    if (socket) {
        try {
            socket.close();
        } catch {
            // no-op
        }
    }

    liveConnection.state = 'offline';
    updateLiveState({
        connectionState: 'offline'
    }, {
        action: String(options.action || 'Disconnected from live collaboration server'),
        persist: true
    });

    updateCollaborationProviderStatus(LIVE_PROVIDER_ID, 'available', {
        action: 'Live provider set to available',
        persist: true
    });

    emitCollaborationEvent('Live Disconnected', {
        providerId: LIVE_PROVIDER_ID
    });

    liveConnection.pendingSnapshotRequests.forEach((pending, requestId) => {
        pending.resolve({ ok: false, reason: 'disconnected', requestId, workspaceId: pending.workspaceId });
    });
    liveConnection.pendingSnapshotRequests.clear();

    return { ok: true, disconnected: hadSocket };
}

export function startLiveCollaborationSession(options = {}) {
    const snapshot = getCollaborationLiveConnectionSnapshot();
    if (!snapshot.connected) {
        return { ok: false, reason: 'not-connected' };
    }

    const config = getCollaborationConfig();
    const workspace = resolveWorkspace(options.workspaceId);
    const workspaceId = normalizeText(workspace?.id || appState.activeWorkspaceId || 'workspace') || 'workspace';
    const sessionLabel = normalizeText(options.sessionName || config.live?.sessionName || 'Live Session') || 'Live Session';
    const session = upsertCollaborationSession({
        id: `live-${workspaceId}-${Date.now()}`,
        resourceType: 'workspace',
        resourceId: workspaceId,
        userId: normalizeText(appState.auditors || 'User') || 'User',
        state: 'active',
        providerId: LIVE_PROVIDER_ID,
        connectionState: 'connected',
        metadata: {
            source: 'live-server',
            sessionName: sessionLabel,
            workspaceName: normalizeText(workspace?.name || workspaceId),
            serverUrl: snapshot.serverUrl
        }
    }, {
        action: 'Started live collaboration session',
        state: 'active',
        connectionState: 'connected',
        metadata: {
            source: 'live-server',
            sessionName: sessionLabel
        }
    });

    sendLiveMessage({
        type: 'art-collaboration-session-start',
        at: nowIso(),
        workspaceId,
        sessionId: session.id,
        sessionName: sessionLabel,
        userId: normalizeText(appState.auditors || 'User') || 'User'
    });

    emitCollaborationEvent('Live Session Started', {
        providerId: LIVE_PROVIDER_ID,
        sessionId: session.id,
        workspaceId
    });

    return { ok: true, session };
}

export function publishCollaborationWorkspaceSnapshot(options = {}) {
    const snapshot = getCollaborationLiveConnectionSnapshot();
    if (!snapshot.connected) {
        return { ok: false, reason: 'not-connected' };
    }

    const workspaceSnapshot = buildWorkspaceCollaborationSnapshot(options.workspaceId);
    if (!workspaceSnapshot) {
        return { ok: false, reason: 'workspace-not-found' };
    }

    const requestId = `snapshot-publish-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sent = sendLiveMessage({
        type: 'art-collaboration-snapshot-publish',
        at: nowIso(),
        requestId,
        workspaceId: workspaceSnapshot.workspaceId,
        persistence: normalizeText(options.persistence || 'shared-folder') || 'shared-folder',
        snapshot: workspaceSnapshot
    });

    if (!sent) {
        return { ok: false, reason: 'send-failed' };
    }

    updateCollaborationConfig({
        synchronization: {
            ...getCollaborationConfig().synchronization,
            lastSyncAt: nowIso()
        }
    }, {
        action: 'Published collaboration snapshot to live server',
        persist: true
    });

    emitCollaborationEvent('Snapshot Published', {
        providerId: LIVE_PROVIDER_ID,
        workspaceId: workspaceSnapshot.workspaceId,
        requestId
    });

    return {
        ok: true,
        requestId,
        workspaceId: workspaceSnapshot.workspaceId,
        generatedAt: workspaceSnapshot.generatedAt
    };
}

export async function requestCollaborationWorkspaceSnapshot(options = {}) {
    const snapshot = getCollaborationLiveConnectionSnapshot();
    if (!snapshot.connected) {
        return { ok: false, reason: 'not-connected' };
    }

    const workspaceId = normalizeText(options.workspaceId || appState.activeWorkspaceId);
    if (!workspaceId) {
        return { ok: false, reason: 'missing-workspace' };
    }

    const requestId = `snapshot-request-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const apply = options.apply !== false;
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(1000, Number(options.timeoutMs)) : 8000;

    return await new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
            liveConnection.pendingSnapshotRequests.delete(requestId);
            resolve({ ok: false, reason: 'timeout', requestId, workspaceId });
        }, timeoutMs);

        liveConnection.pendingSnapshotRequests.set(requestId, {
            workspaceId,
            apply,
            resolve: (payload) => {
                window.clearTimeout(timeoutId);
                resolve(payload);
            }
        });

        const sent = sendLiveMessage({
            type: 'art-collaboration-snapshot-request',
            at: nowIso(),
            requestId,
            workspaceId
        });

        if (!sent) {
            window.clearTimeout(timeoutId);
            liveConnection.pendingSnapshotRequests.delete(requestId);
            resolve({ ok: false, reason: 'send-failed', requestId, workspaceId });
        }
    });
}

export function removeCollaborationSession(sessionId, options = {}) {
    const id = normalizeText(sessionId);
    if (!id) return false;
    const config = getCollaborationConfig();
    const sessions = Array.isArray(config.sessions) ? config.sessions.map((item, index) => normalizeCollaborationSession(item, index)) : [];
    const nextSessions = sessions.filter((session) => session.id !== id);
    if (nextSessions.length === sessions.length) return false;

    withUpdatedSessions(nextSessions, options.action || 'Removed collaboration session');
    emitCollaborationEvent('Session Removed', { sessionId: id });
    return true;
}

export function touchCollaborationSession(sessionId, options = {}) {
    const id = normalizeText(sessionId);
    if (!id) return null;
    const config = getCollaborationConfig();
    const sessions = Array.isArray(config.sessions) ? config.sessions.map((item, index) => normalizeCollaborationSession(item, index)) : [];
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return null;

    sessions[index] = {
        ...sessions[index],
        state: normalizeText(options.state || sessions[index].state || 'active') || 'active',
        connectionState: normalizeText(options.connectionState || sessions[index].connectionState || 'connected') || 'connected',
        lastActivityAt: nowIso(),
        metadata: {
            ...sessions[index].metadata,
            ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {})
        }
    };

    withUpdatedSessions(sessions, options.action || 'Updated collaboration session activity');
    emitCollaborationEvent('Session Activity Updated', { sessionId: id });
    return sessions[index];
}

function resolveWorkspace(workspaceId = '') {
    const normalizedWorkspaceId = normalizeText(workspaceId || appState.activeWorkspaceId);
    if (!normalizedWorkspaceId) return getActiveProjectWorkspace() || null;
    return getProjectWorkspaces().find((workspace) => normalizeText(workspace.id) === normalizedWorkspaceId) || getActiveProjectWorkspace() || null;
}

function getResourceMetadataKey(resourceType, resourceId, workspaceId = '') {
    return `${normalizeText(workspaceId || appState.activeWorkspaceId) || 'workspace'}:${normalizeText(resourceType).toLowerCase()}:${normalizeText(resourceId)}`;
}

function syncDefaultProviderState() {
    const provider = getSortedProviders()[0] || null;
    if (!provider) return;

    const config = getCollaborationConfig();
    updateCollaborationConfig({
        providerId: provider.id,
        providerName: provider.name,
        providerStatus: provider.status,
        providerCapabilities: provider.capabilities,
        resourceDefaults: {
            ...config.resourceDefaults,
            visibility: config.resourceDefaults?.visibility || 'private'
        }
    }, {
        persist: false,
        action: 'Synced collaboration provider state'
    });
}

export function registerCollaborationProvider(provider) {
    const normalized = normalizeProvider(provider);
    providerRegistry.set(normalized.id, normalized);
    emitCollaborationEvent('Provider Registered', { providerId: normalized.id });
    syncDefaultProviderState();
    return normalized;
}

export function unregisterCollaborationProvider(providerId) {
    const id = normalizeText(providerId);
    if (!id) return false;
    const removed = providerRegistry.delete(id);
    if (removed) {
        emitCollaborationEvent('Provider Unregistered', { providerId: id });
        syncDefaultProviderState();
    }
    return removed;
}

export function getCollaborationProviders() {
    return getSortedProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        description: provider.description,
        status: provider.status,
        priority: provider.priority,
        capabilities: { ...provider.capabilities }
    }));
}

export function getCollaborationProvider(providerId) {
    return providerRegistry.get(normalizeText(providerId)) || null;
}

export function getCollaborationResourceMetadata(resourceType, resourceId, workspaceId = '') {
    const config = getCollaborationConfig();
    const normalizedType = normalizeText(resourceType).toLowerCase();
    const normalizedId = normalizeText(resourceId);
    const normalizedWorkspaceId = normalizeText(workspaceId);
    const workspace = resolveWorkspace(normalizedWorkspaceId);
    const key = getResourceMetadataKey(normalizedType, normalizedId, normalizedWorkspaceId || workspace?.id || '');
    const storedMetadata = workspace?.resources?.extensions?.collaborationResources && typeof workspace.resources.extensions.collaborationResources === 'object'
        ? workspace.resources.extensions.collaborationResources[key]
        : null;

    const permissionAssignments = normalizeCollaborationResourceMetadata(normalizedType || 'resource', {
        owner: config.resourceDefaults?.owner || '',
        visibility: config.resourceDefaults?.visibility || 'private',
        permissionAssignments: (config.permissions?.assignments || []).filter((assignment) => {
            const assignmentType = normalizeText(assignment?.resourceType).toLowerCase();
            const assignmentId = normalizeText(assignment?.resourceId);
            const assignmentWorkspaceId = normalizeText(assignment?.workspaceId || assignment?.scopeWorkspaceId);
            if (normalizedType && assignmentType && assignmentType !== normalizedType) return false;
            if (normalizedId && assignmentId && assignmentId !== normalizedId) return false;
            if (normalizedWorkspaceId && assignmentWorkspaceId && assignmentWorkspaceId !== normalizedWorkspaceId) return false;
            return Boolean(assignmentType || assignmentId || assignment?.principalId);
        }),
        sharing: config.resourceDefaults?.sharing || [],
        auditHistory: config.resourceDefaults?.auditHistory || []
    });
    const normalizedStoredMetadata = storedMetadata && typeof storedMetadata === 'object'
        ? normalizeCollaborationResourceMetadata(normalizedType || storedMetadata.resourceType || 'resource', storedMetadata)
        : null;

    const mergedMetadata = normalizedStoredMetadata
        ? {
            ...permissionAssignments,
            ...normalizedStoredMetadata,
            permissionAssignments: normalizedStoredMetadata.permissionAssignments,
            sharing: normalizedStoredMetadata.sharing,
            auditHistory: normalizedStoredMetadata.auditHistory
        }
        : permissionAssignments;

    return {
        ...mergedMetadata,
        workspaceId: normalizedWorkspaceId,
        collaborationEnabled: Boolean(config.enabled),
        collaborationMode: config.mode,
        providerId: config.providerId,
        providerName: config.providerName,
        providerStatus: config.providerStatus,
        commentsEnabled: Boolean(config.providerCapabilities?.comments),
        sharingEnabled: Boolean(config.providerCapabilities?.sharing),
        permissionsEnabled: Boolean(config.providerCapabilities?.permissions),
        sessionCount: (config.sessions || []).filter((session) => {
            const sessionType = normalizeText(session?.resourceType).toLowerCase();
            const sessionResourceId = normalizeText(session?.resourceId);
            if (normalizedType && sessionType && sessionType !== normalizedType) return false;
            if (normalizedId && sessionResourceId && sessionResourceId !== normalizedId) return false;
            return true;
        }).length,
        auditCount: Array.isArray(mergedMetadata.auditHistory) ? mergedMetadata.auditHistory.length : 0,
        commentCount: Array.isArray(mergedMetadata.comments) ? mergedMetadata.comments.length : 0,
        latestComment: Array.isArray(mergedMetadata.comments) && mergedMetadata.comments.length > 0
            ? mergedMetadata.comments[mergedMetadata.comments.length - 1]
            : null,
        latestAudit: Array.isArray(mergedMetadata.auditHistory) && mergedMetadata.auditHistory.length > 0
            ? mergedMetadata.auditHistory[mergedMetadata.auditHistory.length - 1]
            : null,
        comments: Array.isArray(mergedMetadata.comments) ? mergedMetadata.comments : []
    };
}

export function setCollaborationResourceMetadata(resourceType, resourceId, updates = {}, options = {}) {
    const normalizedType = normalizeText(resourceType).toLowerCase();
    const normalizedId = normalizeText(resourceId);
    const workspace = resolveWorkspace(options.workspaceId);
    if (!workspace || !normalizedType || !normalizedId) {
        return { ok: false, reason: 'invalid-resource' };
    }

    const key = getResourceMetadataKey(normalizedType, normalizedId, workspace.id);
    const currentMetadata = getCollaborationResourceMetadata(normalizedType, normalizedId, workspace.id);
    const timestamp = nowIso();
    const currentComments = Array.isArray(currentMetadata.comments) ? currentMetadata.comments : [];
    const nextComments = Array.isArray(updates.comments)
        ? updates.comments.map((comment) => ({
            at: String(comment?.at || timestamp).trim() || timestamp,
            author: String(comment?.author || '').trim(),
            text: String(comment?.text || '').trim()
        })).filter((comment) => comment.text)
        : updates.commentText
            ? [
                ...currentComments,
                {
                    at: timestamp,
                    author: String(options.author || options.userName || appState.auditors || 'User').trim() || 'User',
                    text: String(updates.commentText || '').trim()
                }
            ]
            : currentComments;
    const auditEntry = {
        at: timestamp,
        action: String(options.action || (updates.commentText ? 'Added collaboration comment' : 'Updated collaboration resource metadata')),
        detail: [
            updates.owner ? `owner=${normalizeText(updates.owner)}` : '',
            updates.visibility ? `visibility=${normalizeText(updates.visibility)}` : '',
            updates.permissionProfile ? `permissionProfile=${normalizeText(updates.permissionProfile)}` : '',
            Array.isArray(updates.sharing) && updates.sharing.length > 0 ? `sharing=${updates.sharing.map((item) => normalizeText(item)).filter(Boolean).join(', ')}` : '',
            updates.commentText ? `comment=${normalizeText(updates.commentText)}` : ''
        ].filter(Boolean).join('; ')
    };
    const nextMetadata = normalizeCollaborationResourceMetadata(normalizedType, {
        ...currentMetadata,
        ...updates,
        resourceType: normalizedType,
        auditHistory: [
            ...(Array.isArray(currentMetadata.auditHistory) ? currentMetadata.auditHistory : []),
            auditEntry
        ],
        comments: nextComments
    });

    const nextWorkspace = {
        ...workspace,
        resources: {
            ...(workspace.resources && typeof workspace.resources === 'object' ? workspace.resources : {}),
            extensions: {
                ...((workspace.resources && typeof workspace.resources === 'object' && workspace.resources.extensions && typeof workspace.resources.extensions === 'object') ? workspace.resources.extensions : {}),
                collaborationResources: {
                    ...((workspace.resources && typeof workspace.resources === 'object' && workspace.resources.extensions && workspace.resources.extensions.collaborationResources && typeof workspace.resources.extensions.collaborationResources === 'object')
                        ? workspace.resources.extensions.collaborationResources
                        : {}),
                    [key]: nextMetadata
                }
            }
        },
        lastModifiedAt: new Date().toISOString()
    };

    upsertProjectWorkspace(nextWorkspace, {
        action: `Updated collaboration metadata for ${normalizedType} ${normalizedId}`,
        setActive: normalizeText(workspace.id) === normalizeText(appState.activeWorkspaceId),
        persist: true
    });

    saveState({ action: `Updated collaboration metadata for ${normalizedType} ${normalizedId}`, recordHistory: false });
    emitCollaborationEvent('Resource Metadata Updated', {
        resourceType: normalizedType,
        resourceId: normalizedId,
        workspaceId: workspace.id
    });

    return { ok: true, metadata: nextMetadata };
}

export function getCollaborationFrameworkSnapshot() {
    return {
        frameworkVersion: COLLABORATION_FRAMEWORK_VERSION,
        providers: getCollaborationProviders(),
        activeProviderId: getCollaborationConfig().providerId,
        resourceDefaults: normalizeCollaborationResourceMetadata('application', getCollaborationConfig().resourceDefaults),
        state: getCollaborationConfig()
    };
}

export function updateCollaborationProviderStatus(providerId, status, options = {}) {
    const provider = providerRegistry.get(normalizeText(providerId));
    if (!provider) return null;

    const nextProvider = {
        ...provider,
        status: normalizeText(status || provider.status || 'available') || 'available'
    };
    providerRegistry.set(nextProvider.id, nextProvider);

    if (getCollaborationConfig().providerId === nextProvider.id) {
        updateCollaborationConfig({
            providerId: nextProvider.id,
            providerName: nextProvider.name,
            providerStatus: nextProvider.status,
            providerCapabilities: nextProvider.capabilities
        }, {
            persist: options.persist !== false,
            action: String(options.action || 'Updated collaboration provider status')
        });
    }

    emitCollaborationEvent('Provider Status Updated', {
        providerId: nextProvider.id,
        status: nextProvider.status
    });
    return nextProvider;
}

export function initializeCollaborationFramework() {
    if (providerRegistry.size > 0) return getCollaborationFrameworkSnapshot();

    registerCollaborationProvider({
        id: 'local',
        name: 'Local collaboration',
        description: 'Local-first collaboration configuration and metadata persistence.',
        status: 'available',
        priority: 10,
        capabilities: {
            sharedWorkspaces: true,
            asynchronousCollaboration: true,
            synchronizedCollaboration: false,
            realtimeEditing: false,
            comments: true,
            sharing: false,
            permissions: false,
            versionHistory: false,
            presence: true,
            synchronization: false,
            offline: true
        }
    });

    registerCollaborationProvider({
        id: LIVE_PROVIDER_ID,
        name: 'Live collaboration server',
        description: 'Network collaboration provider for real-time multi-user sessions.',
        status: 'available',
        priority: 20,
        capabilities: getLiveProviderCapabilities()
    });

    return getCollaborationFrameworkSnapshot();
}
