// Document Revision Framework for File-Based Collaboration
// Manages document identity, revision tracking, change sets, and merge metadata
// without requiring an external server.

import { getLocalUserProfile, getDeviceIdentity } from './identityFramework.js';

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeTimestamp(value) {
    if (!value) return new Date().toISOString();
    try {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch {
        return new Date().toISOString();
    }
}

/**
 * Creates a new document metadata structure for file-based collaboration.
 * @param {Object} options - Document configuration
 * @returns {Object} Document metadata with identity and revision info
 */
export function createDocumentMetadata(options = {}) {
    const documentId = String(options.documentId || '').trim() || createId('doc');
    return {
        documentId,
        createdAt: normalizeTimestamp(options.createdAt),
        createdBy: createUserReference(options.createdBy),
        currentRevisionId: String(options.currentRevisionId || '').trim() || createId('rev'),
        lastModifiedAt: normalizeTimestamp(options.lastModifiedAt),
        lastModifiedBy: createUserReference(options.lastModifiedBy),
        isCollaborative: options.isCollaborative === true,
        storageProvider: String(options.storageProvider || '').trim(),
        organizationId: String(options.organizationId || '').trim()
    };
}

/**
 * Creates a user reference for revision tracking.
 * Uses display name for readability and user ID for identity.
 * @param {Object} userInfo - User information
 * @returns {Object} User reference
 */
function createUserReference(userInfo) {
    const profile = getLocalUserProfile();
    const source = userInfo && typeof userInfo === 'object' ? userInfo : {};
    
    return {
        userId: String(source.userId || '').trim() || profile.localUserId,
        displayName: String(source.displayName || '').trim() || profile.displayName || profile.name || 'Unknown',
        name: String(source.name || '').trim() || profile.name || '',
        email: String(source.email || '').trim() || profile.email || '',
        artRole: String(source.artRole || '').trim() || profile.artRole || '',
        deviceId: String(source.deviceId || '').trim() || getDeviceIdentity().id
    };
}

/**
 * Creates a new revision with metadata.
 * @param {Object} options - Revision configuration
 * @returns {Object} Revision object
 */
export function createRevision(options = {}) {
    const profile = getLocalUserProfile();
    const timestamp = normalizeTimestamp(options.timestamp);
    
    return {
        revisionId: String(options.revisionId || '').trim() || createId('rev'),
        documentId: String(options.documentId || '').trim() || createId('doc'),
        parentRevisionId: String(options.parentRevisionId || '').trim() || null,
        author: createUserReference(options.author),
        timestamp,
        changeType: ['create', 'edit', 'merge', 'undo', 'redo'].includes(options.changeType)
            ? options.changeType
            : 'edit',
        changeDescription: String(options.changeDescription || '').trim(),
        isMerge: options.isMerge === true,
        mergeConflictResolution: options.isMerge ? options.mergeConflictResolution : undefined,
        associatedChangeSetId: String(options.associatedChangeSetId || '').trim() || null,
        hash: options.hash || null // Content hash for integrity verification
    };
}

/**
 * Creates a change set that tracks what was modified.
 * @param {Object} options - Change set configuration
 * @returns {Object} Change set object
 */
export function createChangeSet(options = {}) {
    return {
        changeSetId: String(options.changeSetId || '').trim() || createId('changeset'),
        revisionId: String(options.revisionId || '').trim() || createId('rev'),
        documentId: String(options.documentId || '').trim() || createId('doc'),
        author: createUserReference(options.author),
        timestamp: normalizeTimestamp(options.timestamp),
        changes: Array.isArray(options.changes) ? options.changes : [],
        affectedPaths: Array.isArray(options.affectedPaths)
            ? options.affectedPaths.map((p) => String(p || '').trim()).filter(Boolean)
            : [],
        summary: String(options.summary || '').trim(),
        isAutoMerge: options.isAutoMerge === true,
        mergeSource: options.mergeSource || null
    };
}

/**
 * Represents a single change within a change set.
 * @param {Object} options - Change configuration
 * @returns {Object} Change object
 */
export function createChange(options = {}) {
    const validTypes = ['added', 'modified', 'deleted', 'moved', 'renamed', 'merged'];
    const changeType = validTypes.includes(options.type) ? options.type : 'modified';
    
    return {
        changeId: String(options.changeId || '').trim() || createId('change'),
        type: changeType,
        path: String(options.path || '').trim(),
        oldValue: options.oldValue,
        newValue: options.newValue,
        context: options.context || {},
        fieldName: String(options.fieldName || '').trim(),
        timestamp: normalizeTimestamp(options.timestamp),
        author: createUserReference(options.author)
    };
}

/**
 * Creates a merge conflict entry.
 * @param {Object} options - Conflict configuration
 * @returns {Object} Conflict object
 */
export function createMergeConflict(options = {}) {
    return {
        conflictId: String(options.conflictId || '').trim() || createId('conflict'),
        changeSetId: String(options.changeSetId || '').trim() || createId('changeset'),
        path: String(options.path || '').trim(),
        fieldName: String(options.fieldName || '').trim(),
        ancestorValue: options.ancestorValue,
        currentUserValue: options.currentUserValue,
        otherUserValue: options.otherUserValue,
        otherUserInfo: createUserReference(options.otherUserInfo),
        timestamp: normalizeTimestamp(options.timestamp),
        isResolved: options.isResolved === true,
        resolvedValue: options.resolvedValue,
        resolvedBy: options.isResolved ? createUserReference(options.resolvedBy) : null,
        resolutionMethod: options.resolutionMethod || null // 'current', 'other', 'merged', 'manual'
    };
}

/**
 * Creates a revision history entry (for viewing revision timeline).
 * @param {Object} options - History configuration
 * @returns {Object} History entry
 */
export function createRevisionHistoryEntry(options = {}) {
    return {
        revisionId: String(options.revisionId || '').trim() || createId('rev'),
        documentId: String(options.documentId || '').trim() || createId('doc'),
        timestamp: normalizeTimestamp(options.timestamp),
        author: createUserReference(options.author),
        changeType: options.changeType || 'edit',
        changeDescription: String(options.changeDescription || '').trim(),
        isMerge: options.isMerge === true,
        parentRevisionId: String(options.parentRevisionId || '').trim() || null,
        affectedFields: Array.isArray(options.affectedFields)
            ? options.affectedFields.map((f) => String(f || '').trim()).filter(Boolean)
            : [],
        conflictCount: Number(options.conflictCount) || 0,
        contentHash: String(options.contentHash || '').trim()
    };
}

/**
 * Ensures document metadata has required fields.
 * @param {Object} metadata - Existing metadata
 * @returns {Object} Normalized document metadata
 */
export function normalizeDocumentMetadata(metadata) {
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    const documentId = String(source.documentId || '').trim() || createId('doc');
    
    return {
        documentId,
        createdAt: normalizeTimestamp(source.createdAt),
        createdBy: createUserReference(source.createdBy),
        currentRevisionId: String(source.currentRevisionId || '').trim() || createId('rev'),
        lastModifiedAt: normalizeTimestamp(source.lastModifiedAt),
        lastModifiedBy: createUserReference(source.lastModifiedBy),
        isCollaborative: source.isCollaborative === true,
        storageProvider: String(source.storageProvider || '').trim(),
        organizationId: String(source.organizationId || '').trim()
    };
}

/**
 * Ensures revision has required fields.
 * @param {Object} revision - Existing revision
 * @returns {Object} Normalized revision
 */
export function normalizeRevision(revision) {
    const source = revision && typeof revision === 'object' ? revision : {};
    return {
        revisionId: String(source.revisionId || '').trim() || createId('rev'),
        documentId: String(source.documentId || '').trim() || createId('doc'),
        parentRevisionId: String(source.parentRevisionId || '').trim() || null,
        author: createUserReference(source.author),
        timestamp: normalizeTimestamp(source.timestamp),
        changeType: ['create', 'edit', 'merge', 'undo', 'redo'].includes(source.changeType)
            ? source.changeType
            : 'edit',
        changeDescription: String(source.changeDescription || '').trim(),
        isMerge: source.isMerge === true,
        mergeConflictResolution: source.isMerge ? source.mergeConflictResolution : undefined,
        associatedChangeSetId: String(source.associatedChangeSetId || '').trim() || null,
        hash: source.hash || null
    };
}

/**
 * Computes a hash of document content for integrity checking.
 * @param {any} content - Document content to hash
 * @returns {string} Hash value
 */
export function computeContentHash(content) {
    if (!content) return '';
    const json = JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
        const char = json.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `hash-${Math.abs(hash).toString(36)}`;
}

/**
 * Detects if a document has changed by comparing revision IDs.
 * @param {string} currentRevisionId - Current working revision ID
 * @param {string} sharedRevisionId - Latest shared revision ID
 * @returns {Object} Change detection result
 */
export function detectDocumentChange(currentRevisionId, sharedRevisionId) {
    const isSame = String(currentRevisionId || '') === String(sharedRevisionId || '');
    
    return {
        hasChanged: !isSame,
        currentRevisionId: String(currentRevisionId || '').trim(),
        sharedRevisionId: String(sharedRevisionId || '').trim(),
        detectedAt: new Date().toISOString()
    };
}

/**
 * Creates revision ancestry information.
 * @param {Object} options - Ancestry configuration
 * @returns {Object} Ancestry object
 */
export function createRevisionAncestry(options = {}) {
    return {
        revisionId: String(options.revisionId || '').trim() || createId('rev'),
        ancestors: Array.isArray(options.ancestors) ? options.ancestors : [],
        depth: Number(options.depth) || 0,
        lineage: Array.isArray(options.lineage) ? options.lineage : [],
        branchPoints: Array.isArray(options.branchPoints) ? options.branchPoints : []
    };
}
