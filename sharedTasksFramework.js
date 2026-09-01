// Shared Tasks Collaboration Framework
// Enables tasks to sync across users with assignment, status, and comment changes merged

import { mergeEntityCollections } from './mergeConflictFramework.js';
import { getLocalUserProfile } from './identityFramework.js';
import { createChangeSet, createChange } from './documentRevisionFramework.js';

/**
 * Prepares task collection for shared file-based collaboration.
 * Ensures all tasks have required collaboration metadata.
 * @param {Object[]} tasks - Tasks array
 * @returns {Object[]} Tasks with collaboration metadata
 */
export function prepareTasksForCollaboration(tasks = []) {
    if (!Array.isArray(tasks)) return [];

    return tasks.map((task) => {
        const normalized = normalizeTaskForCollaboration(task);
        return normalized;
    });
}

/**
 * Normalizes a single task for collaboration support.
 * @param {Object} task - Task object
 * @returns {Object} Normalized task
 */
export function normalizeTaskForCollaboration(task = {}) {
    const source = task && typeof task === 'object' ? task : {};
    const profile = getLocalUserProfile();

    return {
        // Core task fields
        taskId: String(source.taskId || '').trim(),
        name: String(source.name || '').trim(),
        description: String(source.description || '').trim(),
        status: String(source.status || 'pending').trim(), // 'pending', 'in-progress', 'completed', 'blocked'
        priority: String(source.priority || 'normal').trim(), // 'low', 'normal', 'high', 'critical'

        // Collaboration metadata
        createdAt: String(source.createdAt || '').trim() || new Date().toISOString(),
        createdBy: normalizeUserReference(source.createdBy),
        lastModifiedAt: String(source.lastModifiedAt || '').trim() || new Date().toISOString(),
        lastModifiedBy: normalizeUserReference(source.lastModifiedBy),

        // Assignment & ownership
        assignedTo: normalizeUserReference(source.assignedTo),
        owner: normalizeUserReference(source.owner || source.createdBy),

        // Task metadata
        dueAt: String(source.dueAt || '').trim(),
        deferredUntil: String(source.deferredUntil || '').trim(),
        estimatedHours: Number(source.estimatedHours) || 0,
        actualHours: Number(source.actualHours) || 0,

        // Collaboration tracking
        isShared: source.isShared === true,
        collaborators: Array.isArray(source.collaborators)
            ? source.collaborators.map(normalizeUserReference)
            : [],
        completedBy: normalizeUserReference(source.completedBy),
        completedAt: String(source.completedAt || '').trim(),

        // Comments & discussion
        comments: Array.isArray(source.comments)
            ? source.comments.map((comment) => normalizeTaskComment(comment))
            : [],

        // Change tracking
        revisionId: String(source.revisionId || '').trim(),
        parentRevisionId: String(source.parentRevisionId || '').trim(),
        lastSyncedAt: String(source.lastSyncedAt || '').trim()
    };
}

/**
 * Normalizes a task comment.
 * @param {Object} comment - Comment object
 * @returns {Object} Normalized comment
 */
function normalizeTaskComment(comment = {}) {
    const source = comment && typeof comment === 'object' ? comment : {};

    return {
        commentId: String(source.commentId || `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`).trim(),
        text: String(source.text || '').trim(),
        author: normalizeUserReference(source.author),
        createdAt: String(source.createdAt || '').trim() || new Date().toISOString(),
        mentions: Array.isArray(source.mentions)
            ? source.mentions.map((mention) => normalizeUserReference(mention))
            : [],
        reactions: Array.isArray(source.reactions) ? [...source.reactions] : []
    };
}

/**
 * Normalizes a user reference.
 * @param {Object} userInfo - User information
 * @returns {Object} Normalized user reference
 */
function normalizeUserReference(userInfo = {}) {
    const source = userInfo && typeof userInfo === 'object' ? userInfo : {};

    if (!source.userId && !source.localUserId) {
        return null; // No user reference
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
 * Merges task collections from three versions.
 * @param {Object[]} baselineTasks - Common ancestor tasks
 * @param {Object[]} localTasks - User's current tasks
 * @param {Object[]} sharedTasks - External/shared tasks
 * @returns {Object} Merge result
 */
export function mergeTaskCollections(baselineTasks = [], localTasks = [], sharedTasks = []) {
    // Ensure all tasks are normalized
    const base = prepareTasksForCollaboration(baselineTasks);
    const local = prepareTasksForCollaboration(localTasks);
    const shared = prepareTasksForCollaboration(sharedTasks);

    // Use entity merge with task ID as key
    const result = mergeEntityCollections(base, local, shared, 'taskId');

    // Track task-specific metadata
    return {
        success: true,
        state: result.state,
        mergedTasks: result.merged,
        conflicts: result.conflicts,
        changesSummary: {
            tasksMerged: result.merged.length,
            conflictsDetected: result.conflicts.length,
            newTasks: result.merged.filter((t) => !base.some((b) => b.taskId === t.taskId)).length,
            modifiedTasks: result.merged.filter((t) =>
                base.some((b) => b.taskId === t.taskId && JSON.stringify(b) !== JSON.stringify(t))
            ).length
        }
    };
}

/**
 * Detects changes in task-specific fields.
 * @param {Object} baselineTask - Original task
 * @param {Object} currentTask - Current task version
 * @returns {Object} Change detection result
 */
export function detectTaskChanges(baselineTask = {}, currentTask = {}) {
    const changes = [];
    const profile = getLocalUserProfile();
    const changedFields = new Set();

    // Check each important field
    const fieldsToCheck = [
        'status', 'priority', 'assignedTo', 'name', 'description',
        'dueAt', 'estimatedHours', 'actualHours', 'comments', 'completedAt'
    ];

    fieldsToCheck.forEach((field) => {
        const baseValue = JSON.stringify(baselineTask[field]);
        const currentValue = JSON.stringify(currentTask[field]);

        if (baseValue !== currentValue) {
            changedFields.add(field);
            changes.push(
                createChange({
                    type: 'modified',
                    path: `task.${currentTask.taskId}.${field}`,
                    fieldName: field,
                    oldValue: baselineTask[field],
                    newValue: currentTask[field],
                    author: profile
                })
            );
        }
    });

    return {
        hasChanges: changes.length > 0,
        changedFields: Array.from(changedFields),
        changes,
        changeCount: changes.length,
        lastModifiedAt: currentTask.lastModifiedAt,
        lastModifiedBy: currentTask.lastModifiedBy
    };
}

/**
 * Applies task-level merge conflict resolution.
 * @param {Object} conflict - Conflict from merge result
 * @param {string} resolution - Resolution method: 'current'|'other'|'merged'
 * @param {any} mergedValue - Value to use if resolution is 'merged'
 * @returns {Object} Resolution result
 */
export function resolveTaskConflict(conflict = {}, resolution = 'current', mergedValue = undefined) {
    if (!conflict || !conflict.id) {
        return { success: false, error: 'Invalid conflict' };
    }

    let resolvedValue;
    switch (resolution) {
        case 'current':
            resolvedValue = conflict.local;
            break;
        case 'other':
            resolvedValue = conflict.incoming;
            break;
        case 'merged':
            resolvedValue = mergedValue !== undefined ? mergedValue : conflict.base;
            break;
        default:
            return { success: false, error: `Unknown resolution method: ${resolution}` };
    }

    return {
        success: true,
        conflictId: conflict.id,
        field: conflict.field,
        resolvedValue,
        resolutionMethod: resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: getLocalUserProfile()
    };
}

/**
 * Creates a change set for task modifications.
 * @param {Object} options - Change set options
 * @returns {Object} Change set
 */
export function createTaskChangeSet(options = {}) {
    const profile = getLocalUserProfile();

    return createChangeSet({
        documentId: String(options.documentId || 'tasks-document').trim(),
        changes: Array.isArray(options.changes) ? options.changes : [],
        summary: String(options.summary || '').trim(),
        author: profile,
        isAutoMerge: options.isAutoMerge === true,
        mergeSource: String(options.mergeSource || '').trim()
    });
}

/**
 * Extracts task change summary for UI display.
 * @param {Object} mergeResult - Result from mergeTaskCollections
 * @returns {string} Human-readable summary
 */
export function getTaskMergeSummary(mergeResult = {}) {
    const summary = mergeResult.changesSummary || {};
    const parts = [];

    if (summary.newTasks > 0) {
        parts.push(`${summary.newTasks} new task${summary.newTasks === 1 ? '' : 's'}`);
    }

    if (summary.modifiedTasks > 0) {
        parts.push(`${summary.modifiedTasks} modified task${summary.modifiedTasks === 1 ? '' : 's'}`);
    }

    if (summary.conflictsDetected > 0) {
        parts.push(`${summary.conflictsDetected} conflict${summary.conflictsDetected === 1 ? '' : 's'}`);
    }

    if (parts.length === 0) {
        return 'No task changes detected.';
    }

    return parts.join(', ') + '.';
}

/**
 * Adds a comment to a task (with collaboration tracking).
 * @param {Object} task - Task object
 * @param {Object} options - Comment options
 * @returns {Object} Updated task
 */
export function addCommentToTask(task = {}, options = {}) {
    const source = task && typeof task === 'object' ? task : {};
    const profile = getLocalUserProfile();

    const newComment = normalizeTaskComment({
        text: options.text,
        author: profile,
        mentions: options.mentions
    });

    return {
        ...source,
        comments: [...(source.comments || []), newComment],
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: profile
    };
}

/**
 * Updates task assignment with collaboration tracking.
 * @param {Object} task - Task object
 * @param {Object} assignedTo - User to assign to
 * @returns {Object} Updated task
 */
export function assignTask(task = {}, assignedTo = {}) {
    const source = task && typeof task === 'object' ? task : {};
    const profile = getLocalUserProfile();

    return {
        ...source,
        assignedTo: normalizeUserReference(assignedTo),
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: profile
    };
}

/**
 * Completes a task with collaborator tracking.
 * @param {Object} task - Task object
 * @returns {Object} Updated task
 */
export function completeTask(task = {}) {
    const source = task && typeof task === 'object' ? task : {};
    const profile = getLocalUserProfile();

    return {
        ...source,
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: profile,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: profile
    };
}

/**
 * Reopens a completed task.
 * @param {Object} task - Task object
 * @returns {Object} Updated task
 */
export function reopenTask(task = {}) {
    const source = task && typeof task === 'object' ? task : {};
    const profile = getLocalUserProfile();

    return {
        ...source,
        status: 'pending',
        completedAt: '',
        completedBy: null,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: profile
    };
}
