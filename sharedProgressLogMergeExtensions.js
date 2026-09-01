// Shared Progress Log Collaboration Extensions
// Extends progress log functionality to support file-based collaboration with merging

import { getLocalUserProfile } from './identityFramework.js';
import { createChange, createChangeSet } from './documentRevisionFramework.js';

/**
 * Prepares progress log for file-based collaboration.
 * Ensures all entries have required collaboration metadata.
 * @param {Object} progressLog - Progress log object
 * @returns {Object} Progress log with collaboration metadata
 */
export function prepareProgressLogForCollaboration(progressLog = {}) {
    const source = progressLog && typeof progressLog === 'object' ? progressLog : {};

    return {
        ...source,
        entries: Array.isArray(source.entries)
            ? source.entries.map((entry) => normalizeProgressEntryForCollaboration(entry))
            : [],
        isShared: source.isShared === true,
        collaborators: Array.isArray(source.collaborators) ? source.collaborators : [],
        lastSyncedAt: String(source.lastSyncedAt || '').trim(),
        syncMetadata: {
            version: '1.0.0',
            lastSync: new Date().toISOString(),
            syncSource: 'file-based-collaboration'
        }
    };
}

/**
 * Normalizes a progress entry for collaboration support.
 * @param {Object} entry - Progress log entry
 * @returns {Object} Normalized entry
 */
function normalizeProgressEntryForCollaboration(entry = {}) {
    const source = entry && typeof entry === 'object' ? entry : {};

    return {
        entryId: String(source.entryId || '').trim(),
        timestamp: String(source.timestamp || '').trim(),
        author: normalizeUserReference(source.author),
        text: String(source.text || '').trim(),
        status: String(source.status || 'logged').trim(),
        importance: String(source.importance || 'normal').trim(),
        category: String(source.category || 'general').trim(),
        tags: Array.isArray(source.tags) ? source.tags : [],
        assignedTo: normalizeUserReference(source.assignedTo),
        relatedReports: Array.isArray(source.relatedReports) ? source.relatedReports : [],
        mentions: Array.isArray(source.mentions) ? source.mentions.map(normalizeUserReference) : [],
        comments: Array.isArray(source.comments) ? source.comments : [],
        reactions: Array.isArray(source.reactions) ? source.reactions : [],
        lastModifiedAt: String(source.lastModifiedAt || '').trim(),
        lastModifiedBy: normalizeUserReference(source.lastModifiedBy),
        revisionId: String(source.revisionId || '').trim(),
        parentRevisionId: String(source.parentRevisionId || '').trim()
    };
}

/**
 * Normalizes a user reference.
 * @param {Object} userInfo - User information
 * @returns {Object|null} Normalized user reference or null
 */
function normalizeUserReference(userInfo = {}) {
    const source = userInfo && typeof userInfo === 'object' ? userInfo : {};

    if (!source.userId && !source.localUserId) {
        return null;
    }

    return {
        userId: String(source.userId || source.localUserId || '').trim(),
        displayName: String(source.displayName || source.name || '').trim(),
        email: String(source.email || '').trim(),
        jobTitle: String(source.jobTitle || '').trim(),
        artRole: String(source.artRole || '').trim()
    };
}

/**
 * Detects changes in progress log entries between versions.
 * @param {Object} baselineLog - Original version
 * @param {Object} currentLog - Current version
 * @returns {Object} Change detection result
 */
export function detectProgressLogChanges(baselineLog = {}, currentLog = {}) {
    const changes = [];
    const profile = getLocalUserProfile();

    // Get entry ID maps
    const baselineEntries = new Map((baselineLog.entries || []).map((e) => [e.entryId, e]));
    const currentEntries = new Map((currentLog.entries || []).map((e) => [e.entryId, e]));

    // Detect new entries
    currentEntries.forEach((entry, entryId) => {
        if (!baselineEntries.has(entryId)) {
            changes.push(
                createChange({
                    type: 'added',
                    path: `progress-log.entry.${entryId}`,
                    fieldName: 'entries',
                    newValue: entry,
                    author: profile
                })
            );
        }
    });

    // Detect modified entries
    currentEntries.forEach((entry, entryId) => {
        const baselineEntry = baselineEntries.get(entryId);
        if (baselineEntry && JSON.stringify(baselineEntry) !== JSON.stringify(entry)) {
            changes.push(
                createChange({
                    type: 'modified',
                    path: `progress-log.entry.${entryId}`,
                    fieldName: 'entry',
                    oldValue: baselineEntry,
                    newValue: entry,
                    author: profile
                })
            );
        }
    });

    // Detect deleted entries
    baselineEntries.forEach((entry, entryId) => {
        if (!currentEntries.has(entryId)) {
            changes.push(
                createChange({
                    type: 'deleted',
                    path: `progress-log.entry.${entryId}`,
                    fieldName: 'entries',
                    oldValue: entry,
                    author: profile
                })
            );
        }
    });

    return {
        hasChanges: changes.length > 0,
        changes,
        changeCount: changes.length,
        entriesAdded: Array.from(currentEntries.values()).filter((e) => !baselineEntries.has(e.entryId)).length,
        entriesModified: Array.from(currentEntries.values()).filter((e) =>
            baselineEntries.has(e.entryId) && JSON.stringify(baselineEntries.get(e.entryId)) !== JSON.stringify(e)
        ).length,
        entriesDeleted: Array.from(baselineEntries.keys()).filter((id) => !currentEntries.has(id)).length
    };
}

/**
 * Merges progress log entries from three versions.
 * @param {Object[]} baselineEntries - Baseline entries
 * @param {Object[]} localEntries - Local entries
 * @param {Object[]} sharedEntries - Shared entries
 * @returns {Object} Merge result
 */
export function mergeProgressLogEntries(baselineEntries = [], localEntries = [], sharedEntries = []) {
    const baseMap = new Map((baselineEntries || []).map((e) => [e.entryId, e]));
    const localMap = new Map((localEntries || []).map((e) => [e.entryId, e]));
    const sharedMap = new Map((sharedEntries || []).map((e) => [e.entryId, e]));

    const allIds = new Set([...baseMap.keys(), ...localMap.keys(), ...sharedMap.keys()]);
    const merged = [];
    const conflicts = [];

    allIds.forEach((entryId) => {
        const baseEntry = baseMap.get(entryId);
        const localEntry = localMap.get(entryId);
        const sharedEntry = sharedMap.get(entryId);

        // New entry in local
        if (!baseEntry && localEntry && !sharedEntry) {
            merged.push(localEntry);
            return;
        }

        // New entry in shared
        if (!baseEntry && !localEntry && sharedEntry) {
            merged.push(sharedEntry);
            return;
        }

        // Entry deleted in local, unchanged in shared
        if (baseEntry && !localEntry && sharedEntry) {
            conflicts.push({
                id: entryId,
                type: 'entry-deletion',
                baseEntry,
                localDeleted: true,
                sharedEntry
            });
            return;
        }

        // Entry deleted in shared, unchanged in local
        if (baseEntry && localEntry && !sharedEntry) {
            conflicts.push({
                id: entryId,
                type: 'entry-deletion',
                baseEntry,
                localEntry,
                sharedDeleted: true
            });
            return;
        }

        // Both modified the same entry
        if (baseEntry && localEntry && sharedEntry) {
            const localChanged = JSON.stringify(baseEntry) !== JSON.stringify(localEntry);
            const sharedChanged = JSON.stringify(baseEntry) !== JSON.stringify(sharedEntry);

            if (!localChanged) {
                merged.push(sharedEntry);
                return;
            }

            if (!sharedChanged) {
                merged.push(localEntry);
                return;
            }

            // Both changed - check for field-level conflicts
            const fieldConflicts = detectEntryFieldConflicts(baseEntry, localEntry, sharedEntry);
            if (fieldConflicts.length > 0) {
                conflicts.push({
                    id: entryId,
                    type: 'entry-modification',
                    baseEntry,
                    localEntry,
                    sharedEntry,
                    fieldConflicts
                });
                return;
            }

            // No field conflicts - merge fields
            const mergedEntry = mergeEntryFields(baseEntry, localEntry, sharedEntry);
            merged.push(mergedEntry);
            return;
        }

        // Unchanged entry
        if (baseEntry) {
            merged.push(baseEntry);
        }
    });

    return {
        success: true,
        mergedEntries: merged,
        conflicts,
        conflictCount: conflicts.length,
        summary: {
            totalEntries: merged.length + conflicts.length,
            mergedSuccessfully: merged.length,
            conflictingEntries: conflicts.length
        }
    };
}

/**
 * Detects field-level conflicts in an entry.
 * @param {Object} baseEntry - Base entry
 * @param {Object} localEntry - Local entry
 * @param {Object} sharedEntry - Shared entry
 * @returns {Object[]} Field conflicts
 */
function detectEntryFieldConflicts(baseEntry = {}, localEntry = {}, sharedEntry = {}) {
    const fieldConflicts = [];
    const fieldsToCheck = [
        'status', 'importance', 'category', 'assignedTo', 'text', 'tags'
    ];

    fieldsToCheck.forEach((field) => {
        const baseValue = baseEntry[field];
        const localValue = localEntry[field];
        const sharedValue = sharedEntry[field];

        // Check if local and shared changed to different values
        if (
            JSON.stringify(baseValue) !== JSON.stringify(localValue) &&
            JSON.stringify(baseValue) !== JSON.stringify(sharedValue) &&
            JSON.stringify(localValue) !== JSON.stringify(sharedValue)
        ) {
            fieldConflicts.push({
                field,
                baseValue,
                localValue,
                sharedValue
            });
        }
    });

    return fieldConflicts;
}

/**
 * Merges entry fields when there are no conflicts.
 * @param {Object} baseEntry - Base entry
 * @param {Object} localEntry - Local entry
 * @param {Object} sharedEntry - Shared entry
 * @returns {Object} Merged entry
 */
function mergeEntryFields(baseEntry = {}, localEntry = {}, sharedEntry = {}) {
    const merged = { ...baseEntry };
    const fieldsToCheck = [
        'status', 'importance', 'category', 'assignedTo', 'text', 'tags', 'comments', 'reactions'
    ];

    fieldsToCheck.forEach((field) => {
        const baseValue = baseEntry[field];
        const localValue = localEntry[field];
        const sharedValue = sharedEntry[field];

        // If only local changed
        if (JSON.stringify(baseValue) === JSON.stringify(sharedValue)) {
            merged[field] = localValue;
            return;
        }

        // If only shared changed
        if (JSON.stringify(baseValue) === JSON.stringify(localValue)) {
            merged[field] = sharedValue;
            return;
        }

        // Both changed to the same value - no conflict
        if (JSON.stringify(localValue) === JSON.stringify(sharedValue)) {
            merged[field] = localValue;
            return;
        }

        // For arrays like comments and reactions, concatenate unique items
        if (Array.isArray(baseValue) && Array.isArray(localValue) && Array.isArray(sharedValue)) {
            merged[field] = mergeArrayFields(baseValue, localValue, sharedValue);
            return;
        }

        // Default to local (user's version)
        merged[field] = localValue;
    });

    merged.lastModifiedAt = new Date().toISOString();
    merged.lastModifiedBy = getLocalUserProfile();

    return merged;
}

/**
 * Merges array fields by combining unique items.
 * @param {any[]} baseArray - Base array
 * @param {any[]} localArray - Local array
 * @param {any[]} sharedArray - Shared array
 * @returns {any[]} Merged array
 */
function mergeArrayFields(baseArray = [], localArray = [], sharedArray = []) {
    const seen = new Set();
    const merged = [];

    // Add from base
    baseArray.forEach((item) => {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    });

    // Add new from local
    localArray.forEach((item) => {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    });

    // Add new from shared
    sharedArray.forEach((item) => {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    });

    return merged;
}

/**
 * Resolves a progress log entry conflict.
 * @param {Object} conflict - Conflict object
 * @param {string} resolution - Resolution: 'local'|'shared'|'merged'
 * @param {Object} mergedEntry - Merged entry if resolution is 'merged'
 * @returns {Object} Resolution result
 */
export function resolveProgressConflict(conflict = {}, resolution = 'local', mergedEntry = null) {
    let resolvedEntry;

    switch (resolution) {
        case 'local':
            resolvedEntry = conflict.localEntry;
            break;
        case 'shared':
            resolvedEntry = conflict.sharedEntry;
            break;
        case 'merged':
            resolvedEntry = mergedEntry || conflict.localEntry;
            break;
        default:
            return { success: false, error: `Unknown resolution: ${resolution}` };
    }

    return {
        success: true,
        conflictId: conflict.id,
        resolvedEntry,
        resolutionMethod: resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: getLocalUserProfile()
    };
}

/**
 * Creates a change set for progress log modifications.
 * @param {Object} options - Change set options
 * @returns {Object} Change set
 */
export function createProgressLogChangeSet(options = {}) {
    const profile = getLocalUserProfile();

    return createChangeSet({
        documentId: String(options.logId || 'progress-log').trim(),
        changes: Array.isArray(options.changes) ? options.changes : [],
        summary: String(options.summary || '').trim() || 'Progress log updated',
        author: profile,
        isAutoMerge: options.isAutoMerge === true,
        mergeSource: String(options.mergeSource || '').trim()
    });
}
