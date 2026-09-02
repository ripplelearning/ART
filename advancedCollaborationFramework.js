// Epic 61: local-first collaboration coordination.
// This layer records revision/attribution metadata, presence, and recoverable synchronization
// operations without requiring a server. Provider adapters can supply remote revisions later.
import { getDeviceIdentity, getLocalUserProfile } from './identityFramework.js';
import { computeContentHash } from './documentRevisionFramework.js';
import { markStorageConflict, markStorageSynchronized, markStorageSyncFailure, markLocalStorageChangesPending } from './storageSynchronizationFramework.js';

const COLLABORATION_KEY = 'art-advanced-collaboration-v1';
const OPERATION_LIMIT = 50;
let initialized = false;
let session = null;

function normalizeText(value) {
    return String(value ?? '').trim();
}

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readState() {
    try {
        const value = JSON.parse(localStorage.getItem(COLLABORATION_KEY) || '');
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

function persistState() {
    localStorage.setItem(COLLABORATION_KEY, JSON.stringify({
        session,
        updatedAt: new Date().toISOString()
    }));
    window.dispatchEvent(new CustomEvent('art-advanced-collaboration-updated', { detail: getCollaborationSession() }));
}

function currentActor() {
    const profile = getLocalUserProfile();
    return {
        userId: normalizeText(profile.localUserId),
        displayName: normalizeText(profile.displayName || profile.name) || 'Local ART user',
        deviceId: normalizeText(getDeviceIdentity().id)
    };
}

function normalizeSession(source = {}) {
    const actor = currentActor();
    return {
        sessionId: normalizeText(source.sessionId) || createId('collab-session'),
        resourceId: normalizeText(source.resourceId),
        resourceType: normalizeText(source.resourceType) || 'art-project',
        state: normalizeText(source.state) || 'local-only',
        actor,
        participants: Array.isArray(source.participants) ? source.participants : [],
        revisions: Array.isArray(source.revisions) ? source.revisions.slice(-OPERATION_LIMIT) : [],
        pendingOperations: Array.isArray(source.pendingOperations) ? source.pendingOperations.slice(-OPERATION_LIMIT) : [],
        lastSynchronizedAt: normalizeText(source.lastSynchronizedAt),
        updatedAt: normalizeText(source.updatedAt) || new Date().toISOString()
    };
}

export function getCollaborationSession() {
    if (!session) session = normalizeSession(readState().session || {});
    session.actor = currentActor();
    return JSON.parse(JSON.stringify(session));
}

export function startCollaborationSession(resource = {}) {
    session = normalizeSession({
        ...getCollaborationSession(),
        sessionId: createId('collab-session'),
        resourceId: resource.resourceId,
        resourceType: resource.resourceType || 'art-project',
        state: 'local-only'
    });
    persistState();
    return getCollaborationSession();
}

export function endCollaborationSession() {
    session = normalizeSession({ ...getCollaborationSession(), state: 'inactive', participants: [] });
    persistState();
    return getCollaborationSession();
}

export function updateCollaborationPresence(participant = {}) {
    const current = getCollaborationSession();
    const participantId = normalizeText(participant.userId) || normalizeText(participant.deviceId);
    if (!participantId) return current;
    const nextParticipant = {
        userId: normalizeText(participant.userId),
        displayName: normalizeText(participant.displayName) || 'ART collaborator',
        deviceId: normalizeText(participant.deviceId),
        activity: normalizeText(participant.activity) || 'viewing',
        updatedAt: new Date().toISOString()
    };
    const participants = current.participants.filter((entry) => (entry.userId || entry.deviceId) !== participantId);
    session = normalizeSession({ ...current, participants: [...participants, nextParticipant] });
    persistState();
    return getCollaborationSession();
}

export function removeCollaborationPresence(participantId) {
    const id = normalizeText(participantId);
    session = normalizeSession({
        ...getCollaborationSession(),
        participants: getCollaborationSession().participants.filter((entry) => entry.userId !== id && entry.deviceId !== id)
    });
    persistState();
    return getCollaborationSession();
}

export function recordLocalCollaborationRevision(content, metadata = {}) {
    const current = getCollaborationSession();
    const actor = currentActor();
    const revisionId = normalizeText(metadata.revisionId) || createId('revision');
    const hash = computeContentHash(content);
    const revision = {
        revisionId,
        parentRevisionId: normalizeText(metadata.parentRevisionId) || current.revisions.at(-1)?.revisionId || '',
        contentHash: hash,
        userId: actor.userId,
        displayName: actor.displayName,
        deviceId: actor.deviceId,
        changeType: normalizeText(metadata.changeType) || 'update',
        changeDescription: normalizeText(metadata.changeDescription) || 'Updated ART content',
        createdAt: new Date().toISOString()
    };
    session = normalizeSession({ ...current, revisions: [...current.revisions, revision], updatedAt: revision.createdAt });
    persistState();
    return revision;
}

export function queueCollaborationOperation(operation = {}) {
    const current = getCollaborationSession();
    const queued = {
        operationId: normalizeText(operation.operationId) || createId('collab-operation'),
        type: normalizeText(operation.type) || 'update',
        resourceId: normalizeText(operation.resourceId) || current.resourceId,
        revisionId: normalizeText(operation.revisionId) || '',
        payload: operation.payload && typeof operation.payload === 'object' ? { ...operation.payload } : {},
        queuedAt: new Date().toISOString(),
        state: 'pending'
    };
    session = normalizeSession({ ...current, state: 'offline-pending', pendingOperations: [...current.pendingOperations, queued] });
    persistState();
    markLocalStorageChangesPending('Collaboration changes are queued locally until synchronization is available.');
    return queued;
}

export function resolveCollaborationOperation(operationId, state = 'applied') {
    const id = normalizeText(operationId);
    const current = getCollaborationSession();
    const pendingOperations = current.pendingOperations.map((operation) => operation.operationId === id
        ? { ...operation, state, resolvedAt: new Date().toISOString() }
        : operation);
    session = normalizeSession({ ...current, pendingOperations, state: state === 'conflict' ? 'conflict' : 'local-only' });
    persistState();
    if (state === 'conflict') markStorageConflict('A collaboration operation requires conflict resolution.');
    else if (state === 'failed') markStorageSyncFailure('A collaboration operation failed; local data was preserved.');
    else markStorageSynchronized({});
    return getCollaborationSession();
}

export function getPendingCollaborationOperations() {
    return getCollaborationSession().pendingOperations.filter((operation) => operation.state === 'pending');
}

export function getCollaborationRevisionHistory() {
    return getCollaborationSession().revisions;
}

export function initializeAdvancedCollaborationFramework() {
    if (initialized) return true;
    initialized = true;
    session = normalizeSession(readState().session || {});
    return true;
}
