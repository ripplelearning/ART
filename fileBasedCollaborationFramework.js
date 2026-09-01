// File-Based Collaboration Framework
// Handles document synchronization, change detection, three-way merge, and conflict resolution

import { getLocalUserProfile, getDeviceIdentity } from './identityFramework.js';
import {
    createRevision,
    createChangeSet,
    createChange,
    createMergeConflict,
    computeContentHash,
    normalizeRevision,
    createRevisionAncestry
} from './documentRevisionFramework.js';

/**
 * Detects changes between local working version and shared version.
 * @param {Object} localDocument - Local working document state
 * @param {Object} sharedDocument - Latest shared document state
 * @param {Object} ancestorDocument - Common ancestor document (optional)
 * @returns {Object} Change detection result
 */
export function detectDocumentChanges(localDocument, sharedDocument, ancestorDocument = null) {
    const localDoc = normalizeDocument(localDocument);
    const sharedDoc = normalizeDocument(sharedDocument);
    const ancestorDoc = ancestorDocument ? normalizeDocument(ancestorDocument) : null;

    return {
        isUnchanged: localDoc.currentRevisionId === sharedDoc.currentRevisionId,
        localVersion: localDoc.currentRevisionId,
        sharedVersion: sharedDoc.currentRevisionId,
        ancestorVersion: ancestorDoc?.currentRevisionId || null,
        requiresMerge: localDoc.currentRevisionId !== sharedDoc.currentRevisionId && ancestorDoc !== null,
        detectedAt: new Date().toISOString(),
        userInfo: getLocalUserProfile()
    };
}

/**
 * Performs three-way merge on document content.
 * Compares ancestor, local version, and shared version to merge changes.
 * @param {Object} options - Merge configuration
 * @returns {Object} Merge result
 */
export function performThreeWayMerge(options = {}) {
    const ancestor = normalizeDocument(options.ancestor);
    const current = normalizeDocument(options.current);
    const other = normalizeDocument(options.other);

    const changes = {
        currentUserChanges: [],
        otherUserChanges: [],
        conflicts: [],
        mergedContent: {}
    };

    // Compare ancestor with current user's changes
    const currentChanges = detectPropertyChanges(ancestor, current);
    changes.currentUserChanges = currentChanges;

    // Compare ancestor with other user's changes
    const otherChanges = detectPropertyChanges(ancestor, other);
    changes.otherUserChanges = otherChanges;

    // Detect conflicts
    const conflicts = detectConflicts(ancestor, current, other, currentChanges, otherChanges);
    changes.conflicts = conflicts;

    // Merge non-conflicting changes
    const merged = mergeNonConflictingChanges(ancestor, current, other);
    changes.mergedContent = merged;

    return {
        success: conflicts.length === 0,
        conflictCount: conflicts.length,
        currentUserChanges,
        otherUserChanges,
        conflicts,
        mergedContent: merged,
        requiresUserReview: conflicts.length > 0,
        mergedAt: new Date().toISOString(),
        mergedBy: getLocalUserProfile()
    };
}

/**
 * Detects property-level changes between two document versions.
 * @param {Object} ancestor - Original version
 * @param {Object} current - New version
 * @returns {Object[]} Array of detected changes
 */
function detectPropertyChanges(ancestor, current) {
    const changes = [];
    const ancestorFlat = flattenObject(ancestor);
    const currentFlat = flattenObject(current);

    // Detect modifications and additions
    for (const [key, value] of Object.entries(currentFlat)) {
        if (!(key in ancestorFlat)) {
            changes.push({ type: 'added', path: key, newValue: value });
        } else if (!deepEqual(ancestorFlat[key], value)) {
            changes.push({
                type: 'modified',
                path: key,
                oldValue: ancestorFlat[key],
                newValue: value
            });
        }
    }

    // Detect deletions
    for (const key of Object.keys(ancestorFlat)) {
        if (!(key in currentFlat)) {
            changes.push({ type: 'deleted', path: key, oldValue: ancestorFlat[key] });
        }
    }

    return changes;
}

/**
 * Detects conflicts between current user's changes and other user's changes.
 * @param {Object} ancestor - Original version
 * @param {Object} current - Current user's version
 * @param {Object} other - Other user's version
 * @param {Object[]} currentChanges - Current user's detected changes
 * @param {Object[]} otherChanges - Other user's detected changes
 * @returns {Object[]} Array of conflicts
 */
function detectConflicts(ancestor, current, other, currentChanges, otherChanges) {
    const conflicts = [];
    const currentPaths = new Set(currentChanges.map((c) => c.path));
    const otherPaths = new Set(otherChanges.map((c) => c.path));
    const conflictPaths = [...currentPaths].filter((p) => otherPaths.has(p));

    for (const path of conflictPaths) {
        const currentChange = currentChanges.find((c) => c.path === path);
        const otherChange = otherChanges.find((c) => c.path === path);
        const ancestorFlat = flattenObject(ancestor);

        // Conflict if both changed the same field to different values
        if (currentChange.type === 'modified' && otherChange.type === 'modified') {
            if (!deepEqual(currentChange.newValue, otherChange.newValue)) {
                conflicts.push(
                    createMergeConflict({
                        path,
                        fieldName: path.split('.').pop(),
                        ancestorValue: ancestorFlat[path],
                        currentUserValue: currentChange.newValue,
                        otherUserValue: otherChange.newValue,
                        otherUserInfo: other.lastModifiedBy
                    })
                );
            }
        }
        // Conflict if one deleted and other modified
        else if (
            (currentChange.type === 'deleted' && otherChange.type === 'modified') ||
            (currentChange.type === 'modified' && otherChange.type === 'deleted')
        ) {
            conflicts.push(
                createMergeConflict({
                    path,
                    fieldName: path.split('.').pop(),
                    ancestorValue: ancestorFlat[path],
                    currentUserValue:
                        currentChange.type === 'deleted' ? null : currentChange.newValue,
                    otherUserValue: otherChange.type === 'deleted' ? null : otherChange.newValue,
                    otherUserInfo: other.lastModifiedBy
                })
            );
        }
    }

    return conflicts;
}

/**
 * Merges non-conflicting changes into a new document.
 * @param {Object} ancestor - Original version
 * @param {Object} current - Current user's version
 * @param {Object} other - Other user's version
 * @returns {Object} Merged document
 */
function mergeNonConflictingChanges(ancestor, current, other) {
    const ancestorFlat = flattenObject(ancestor);
    const currentFlat = flattenObject(current);
    const otherFlat = flattenObject(other);

    const merged = { ...currentFlat };

    // Apply changes from other user that don't conflict
    for (const [key, otherValue] of Object.entries(otherFlat)) {
        const ancestorValue = ancestorFlat[key];
        const currentValue = currentFlat[key];

        // If only other user changed this field, use their change
        if (!deepEqual(ancestorValue, otherValue) && deepEqual(ancestorValue, currentValue)) {
            merged[key] = otherValue;
        }
        // If other user deleted and we didn't change, keep it deleted
        else if (!(key in otherFlat) && deepEqual(ancestorValue, currentValue)) {
            delete merged[key];
        }
    }

    return unflattenObject(merged);
}

/**
 * Prepares document for refresh from shared source.
 * @param {Object} options - Refresh options
 * @returns {Object} Refresh preparation result
 */
export function prepareRefreshFromSharedFile(options = {}) {
    const currentDocument = normalizeDocument(options.currentDocument);
    const sharedDocument = normalizeDocument(options.sharedDocument);
    const ancestorDocument = options.ancestorDocument ? normalizeDocument(options.ancestorDocument) : null;

    const changeDetection = detectDocumentChanges(currentDocument, sharedDocument, ancestorDocument);

    if (changeDetection.isUnchanged) {
        return {
            action: 'none',
            message: 'The shared file is up-to-date with your current version.',
            changeDetection
        };
    }

    if (!ancestorDocument) {
        return {
            action: 'merge-required',
            message: 'The shared file has changed, but merge history is not available.',
            changeDetection,
            requiresManualMerge: true
        };
    }

    const mergeResult = performThreeWayMerge({
        ancestor: ancestorDocument,
        current: currentDocument,
        other: sharedDocument
    });

    return {
        action: mergeResult.success ? 'auto-merge' : 'conflict-resolution-required',
        message: mergeResult.success
            ? `Successfully merged ${mergeResult.otherUserChanges.length} changes from shared file.`
            : `Found ${mergeResult.conflicts.length} conflicts requiring your review.`,
        changeDetection,
        mergeResult,
        requiresUserReview: !mergeResult.success
    };
}

/**
 * Resolves a merge conflict by accepting one version.
 * @param {Object} conflict - Conflict to resolve
 * @param {string} resolution - 'current', 'other', or 'merged'
 * @param {any} mergedValue - Value for 'merged' resolution
 * @returns {Object} Resolved conflict
 */
export function resolveMergeConflict(conflict, resolution, mergedValue = null) {
    if (!['current', 'other', 'merged'].includes(resolution)) {
        throw new Error(`Invalid resolution method: ${resolution}`);
    }

    const resolved = { ...conflict };
    resolved.isResolved = true;
    resolved.resolutionMethod = resolution;
    resolved.resolvedBy = getLocalUserProfile();

    if (resolution === 'current') {
        resolved.resolvedValue = conflict.currentUserValue;
    } else if (resolution === 'other') {
        resolved.resolvedValue = conflict.otherUserValue;
    } else {
        resolved.resolvedValue = mergedValue;
    }

    return resolved;
}

/**
 * Creates a new revision after a merge is complete.
 * @param {Object} options - Merge completion options
 * @returns {Object} New revision
 */
export function createMergeRevision(options = {}) {
    const profile = getLocalUserProfile();

    return createRevision({
        documentId: options.documentId,
        parentRevisionId: options.parentRevisionId,
        author: profile,
        timestamp: new Date().toISOString(),
        changeType: 'merge',
        changeDescription: options.changeDescription || 'Merged changes from shared file',
        isMerge: true,
        mergeConflictResolution: options.mergeConflictResolution || {},
        hash: options.contentHash || null
    });
}

/**
 * Normalizes document structure.
 * @param {Object} doc - Document to normalize
 * @returns {Object} Normalized document
 */
function normalizeDocument(doc) {
    if (!doc || typeof doc !== 'object') return {};
    return {
        currentRevisionId: String(doc.currentRevisionId || doc.revisionId || '').trim(),
        lastModifiedAt: normalizeTimestamp(doc.lastModifiedAt || doc.timestamp),
        lastModifiedBy: doc.lastModifiedBy || doc.author || {},
        content: doc.content || doc,
        documentMetadata: doc.documentMetadata || {}
    };
}

/**
 * Normalizes timestamp values.
 * @param {any} value - Timestamp value
 * @returns {string} ISO timestamp
 */
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
 * Deep equality check for values.
 * @param {any} a - First value
 * @param {any} b - Second value
 * @returns {boolean} True if equal
 */
function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((key) => deepEqual(a[key], b[key]));
    }

    return false;
}

/**
 * Flattens nested object into dot-notation paths.
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix (internal)
 * @returns {Object} Flattened object
 */
function flattenObject(obj, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(obj || {})) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(result, flattenObject(value, fullKey));
        } else {
            result[fullKey] = value;
        }
    }

    return result;
}

/**
 * Unflattens dot-notation paths back into nested object.
 * @param {Object} flat - Flattened object
 * @returns {Object} Nested object
 */
function unflattenObject(flat) {
    const result = {};

    for (const [path, value] of Object.entries(flat || {})) {
        const parts = path.split('.');
        let current = result;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    return result;
}

/**
 * Creates a change notification for sharing.
 * @param {Object} options - Notification options
 * @returns {Object} Change notification
 */
export function createChangeNotification(options = {}) {
    return {
        notificationId: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        documentId: String(options.documentId || '').trim(),
        changeType: options.changeType || 'update',
        message: String(options.message || '').trim(),
        newRevisionId: String(options.newRevisionId || '').trim(),
        detectedAt: new Date().toISOString(),
        userInfo: getLocalUserProfile(),
        isExternal: options.isExternal === true
    };
}
