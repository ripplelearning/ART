// Refresh Workflow Engine for File-Based Collaboration
// Orchestrates document refresh, change detection, merging, and conflict resolution

import { prepareRefreshFromSharedFile, performThreeWayMerge } from './fileBasedCollaborationFramework.js';
import { createMergeRevision } from './documentRevisionFramework.js';
import { getLocalUserProfile } from './identityFramework.js';
import { getCollaborationMetadata, updateCollaborationMetadata, announce, saveState } from './state.js';
import { openMergeConflictDialog } from './mergeConflictFramework.js';

/**
 * Workflow status and progress tracking
 */
const workflowState = {
    isRefreshing: false,
    currentDocument: null,
    sharedDocument: null,
    ancestorDocument: null,
    lastRefreshResult: null,
    lastError: null
};

/**
 * Gets current workflow status.
 * @returns {Object} Workflow state
 */
export function getRefreshWorkflowStatus() {
    return {
        isRefreshing: workflowState.isRefreshing,
        hasError: workflowState.lastError !== null,
        lastError: workflowState.lastError,
        lastRefreshResult: workflowState.lastRefreshResult
    };
}

/**
 * Main refresh workflow orchestration.
 * Handles change detection, merging, and conflict resolution.
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} Workflow result
 */
export async function executeRefreshWorkflow(options = {}) {
    const {
        localDocument = {},
        sharedDocument = {},
        ancestorDocument = null,
        onConflictDetected = null,
        onMergeComplete = null,
        autoResolveNonConflicting = true,
        trigger = null
    } = options;

    // Prevent concurrent refreshes
    if (workflowState.isRefreshing) {
        announce('Refresh already in progress. Please wait.');
        return {
            success: false,
            action: 'cancelled',
            reason: 'concurrent-refresh-prevented',
            message: 'A refresh is already in progress.'
        };
    }

    try {
        workflowState.isRefreshing = true;
        workflowState.lastError = null;

        // Step 1: Prepare refresh (detect changes, decide action)
        const prepareResult = prepareRefreshFromSharedFile({
            localDocument,
            sharedDocument,
            ancestorDocument
        });

        if (prepareResult.error) {
            throw new Error(prepareResult.error);
        }

        // Step 2: Handle action based on detect result
        switch (prepareResult.action) {
            case 'none':
                return handleNoChangesAction(localDocument, prepareResult);

            case 'auto-merge':
                return handleAutoMergeAction(localDocument, sharedDocument, prepareResult, onMergeComplete);

            case 'conflict-resolution-required':
                return handleConflictResolutionAction(localDocument, sharedDocument, ancestorDocument, prepareResult, onConflictDetected, trigger);

            default:
                throw new Error(`Unknown merge action: ${prepareResult.action}`);
        }
    } catch (error) {
        workflowState.lastError = error.message || String(error);
        announce(`Refresh failed: ${workflowState.lastError}`);
        return {
            success: false,
            action: 'error',
            reason: 'refresh-failed',
            message: workflowState.lastError,
            error: error
        };
    } finally {
        workflowState.isRefreshing = false;
    }
}

/**
 * Handles case where document has not changed.
 * @param {Object} document - Current document
 * @param {Object} prepareResult - Prepare phase result
 * @returns {Object} Workflow result
 */
function handleNoChangesAction(document = {}, prepareResult = {}) {
    announce('Document is up to date. No changes detected.');
    workflowState.lastRefreshResult = prepareResult;
    return {
        success: true,
        action: 'none',
        message: 'Document is up to date.',
        document,
        mergedContent: document,
        changesSummary: {
            localChanges: 0,
            externalChanges: 0,
            merged: false,
            conflictCount: 0
        }
    };
}

/**
 * Handles automatic merge of non-conflicting changes.
 * @param {Object} localDocument - User's document version
 * @param {Object} sharedDocument - Shared/external version
 * @param {Object} prepareResult - Prepare phase result
 * @param {Function} onMergeComplete - Callback on merge completion
 * @returns {Object} Workflow result
 */
function handleAutoMergeAction(localDocument = {}, sharedDocument = {}, prepareResult = {}, onMergeComplete = null) {
    const mergeResult = performThreeWayMerge({
        ancestorDocument: prepareResult.ancestorVersion || {},
        localDocument: prepareResult.localVersion || localDocument,
        sharedDocument: prepareResult.sharedVersion || sharedDocument
    });

    if (!mergeResult.success) {
        throw new Error(`Merge failed: ${mergeResult.error || 'Unknown error'}`);
    }

    // Create merge revision
    const mergeRevision = createMergeRevision({
        documentId: localDocument.documentId,
        parentRevisionId: localDocument.currentRevisionId,
        mergeConflictCount: 0,
        mergeSource: sharedDocument.currentRevisionId,
        changeDescription: `Auto-merged ${mergeResult.nonConflictingChanges?.length || 0} non-conflicting changes from external version`
    });

    // Update merged document
    const mergedDocument = {
        ...mergeResult.mergedContent,
        currentRevisionId: mergeRevision.revisionId,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: getLocalUserProfile()
    };

    // Update collaboration metadata
    updateCollaborationMetadata({
        currentRevisionId: mergeRevision.revisionId,
        lastSyncedRevision: sharedDocument.currentRevisionId,
        pendingMergeConflicts: [],
        mergeInProgress: false
    });

    announce(`Merged ${mergeResult.nonConflictingChanges?.length || 0} non-conflicting changes. Document updated.`);

    workflowState.lastRefreshResult = mergeResult;
    if (onMergeComplete) {
        onMergeComplete(mergedDocument, mergeRevision);
    }

    return {
        success: true,
        action: 'auto-merge',
        message: 'Changes merged automatically.',
        document: mergedDocument,
        mergedContent: mergeResult.mergedContent,
        mergeRevision,
        changesSummary: {
            localChanges: mergeResult.currentUserChanges?.length || 0,
            externalChanges: mergeResult.otherUserChanges?.length || 0,
            merged: true,
            conflictCount: 0,
            autoMergedCount: mergeResult.nonConflictingChanges?.length || 0
        }
    };
}

/**
 * Handles conflict resolution workflow.
 * Opens merge dialog and waits for user resolution.
 * @param {Object} localDocument - User's document version
 * @param {Object} sharedDocument - Shared/external version
 * @param {Object} ancestorDocument - Common ancestor version
 * @param {Object} prepareResult - Prepare phase result
 * @param {Function} onConflictDetected - Callback when conflicts detected
 * @param {HTMLElement} trigger - Element that triggered the refresh
 * @returns {Object} Workflow result (promise-like for async resolution)
 */
function handleConflictResolutionAction(
    localDocument = {},
    sharedDocument = {},
    ancestorDocument = {},
    prepareResult = {},
    onConflictDetected = null,
    trigger = null
) {
    // Perform merge to get detailed conflict information
    const mergeResult = performThreeWayMerge({
        ancestorDocument: ancestorDocument || prepareResult.ancestorVersion || {},
        localDocument: prepareResult.localVersion || localDocument,
        sharedDocument: prepareResult.sharedVersion || sharedDocument
    });

    if (!mergeResult.success) {
        throw new Error(`Merge analysis failed: ${mergeResult.error || 'Unknown error'}`);
    }

    // Store merge state for resolution phase
    workflowState.currentDocument = localDocument;
    workflowState.sharedDocument = sharedDocument;
    workflowState.ancestorDocument = ancestorDocument;
    workflowState.lastRefreshResult = mergeResult;

    // Update collaboration metadata to track pending conflicts
    updateCollaborationMetadata({
        pendingMergeConflicts: mergeResult.conflicts || [],
        mergeInProgress: true
    });

    announce(`${mergeResult.conflicts?.length || 0} conflict${mergeResult.conflicts?.length === 1 ? '' : 's'} detected. Opening merge dialog.`);

    // Open merge dialog for user resolution
    const dialogResult = openMergeConflictDialog(mergeResult, (resolvedContent) => {
        completeConflictResolution(localDocument, resolvedContent, mergeResult);
    }, trigger);

    if (onConflictDetected) {
        onConflictDetected(mergeResult);
    }

    return {
        success: true,
        action: 'conflict-resolution-required',
        message: `${mergeResult.conflicts?.length || 0} conflict(s) require resolution.`,
        conflictCount: mergeResult.conflicts?.length || 0,
        conflicts: mergeResult.conflicts,
        changesSummary: {
            localChanges: mergeResult.currentUserChanges?.length || 0,
            externalChanges: mergeResult.otherUserChanges?.length || 0,
            merged: false,
            conflictCount: mergeResult.conflicts?.length || 0,
            requiresUserReview: true
        },
        userActionRequired: 'Resolve conflicts in the merge dialog'
    };
}

/**
 * Completes conflict resolution after user choices.
 * @param {Object} localDocument - Original local document
 * @param {Object} resolvedContent - User-resolved merged content
 * @param {Object} mergeResult - Original merge analysis result
 */
function completeConflictResolution(localDocument = {}, resolvedContent = {}, mergeResult = {}) {
    try {
        // Create merge revision with conflict resolution
        const mergeRevision = createMergeRevision({
            documentId: localDocument.documentId,
            parentRevisionId: localDocument.currentRevisionId,
            mergeConflictCount: mergeResult.conflicts?.length || 0,
            mergeSource: workflowState.sharedDocument?.currentRevisionId,
            changeDescription: `Resolved ${mergeResult.conflicts?.length || 0} conflicts and merged changes`
        });

        // Create final merged document
        const mergedDocument = {
            ...resolvedContent,
            currentRevisionId: mergeRevision.revisionId,
            lastModifiedAt: new Date().toISOString(),
            lastModifiedBy: getLocalUserProfile()
        };

        // Clear conflict state
        updateCollaborationMetadata({
            currentRevisionId: mergeRevision.revisionId,
            lastSyncedRevision: workflowState.sharedDocument?.currentRevisionId,
            pendingMergeConflicts: [],
            mergeInProgress: false
        });

        saveState();
        announce('Merge conflict resolution completed. Document updated with resolved changes.');

        return {
            success: true,
            action: 'conflict-resolved',
            document: mergedDocument,
            mergeRevision
        };
    } catch (error) {
        announce(`Conflict resolution failed: ${error.message}`);
        throw error;
    }
}

/**
 * Checks for external changes without performing merge.
 * @param {Object} currentDocument - Current document
 * @param {Object} sharedDocument - Shared version to check against
 * @returns {Object} Change detection result
 */
export function checkForExternalChanges(currentDocument = {}, sharedDocument = {}) {
    const currentRevision = currentDocument.currentRevisionId || '';
    const sharedRevision = sharedDocument.currentRevisionId || '';
    const hasChanged = currentRevision !== sharedRevision;

    return {
        hasExternalChanges: hasChanged,
        currentRevisionId: currentRevision,
        sharedRevisionId: sharedRevision,
        lastExternalChangeDetected: new Date().toISOString(),
        message: hasChanged ? 'External changes detected.' : 'No external changes.'
    };
}

/**
 * Aborts an in-progress refresh workflow.
 * @returns {boolean} True if abort was successful
 */
export function abortRefreshWorkflow() {
    if (!workflowState.isRefreshing) {
        return false;
    }

    workflowState.isRefreshing = false;
    announce('Refresh workflow aborted.');
    return true;
}

/**
 * Clears workflow state (for testing or reset).
 */
export function clearRefreshWorkflowState() {
    workflowState.isRefreshing = false;
    workflowState.currentDocument = null;
    workflowState.sharedDocument = null;
    workflowState.ancestorDocument = null;
    workflowState.lastRefreshResult = null;
    workflowState.lastError = null;
}
