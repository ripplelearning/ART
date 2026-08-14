import { commandRegistry } from './commandRegistry.js';
import {
    announce,
    canRedoState,
    canUndoState,
    clearUniversalSearchHistory,
    createUserTemplateFromSelection,
    closeCurrentReportSession,
    deleteReportById,
    deleteUserTemplate,
    getReportById,
    getTemplateById,
    addOrUpdateField,
    appState,
    currentReportSupportsAuditEntries,
    getAssignableActions,
    getRecentReports,
    getRedoStateDescription,
    getShortcutDefinitions,
    getUndoStateDescription,
    hasUnsavedProjectChanges,
    importReportWithConflictStrategy,
    importTemplateWithConflictStrategy,
    getCollaborationConfig,
    isProgressLogEnabled,
    loadReportById,
    loadTemplate,
    renameReportById,
    renameUserTemplateById,
    resetReportToBlank,
    reportNameExists,
    saveState,
    serializeArtxTemplatePayload,
    templateNameExists,
    updateCollaborationConfig,
    getActiveWorkspaceView,
} from './state.js';
import { removeResourceReferencesFromAllWorkspaces, replaceResourceReferencesAcrossWorkspaces } from './resourceRelationshipFramework.js';
import { openCommandPalette } from './commandPalette.js';
import { focusMenuBarFromCommand, focusMenuSearchFromCommand, openTopLevelMenuFromCommand } from './menuBar.js';
import { getTopLevelMenuShortcutDescriptor, mergeTopLevelMenuLabels } from './menuShortcuts.js';
import { openHelpDialog } from './help.js';
import {
    applySoloCollaborationPresetFromCommand,
    applyTeamCollaborationPresetFromCommand,
    clearCollaborationSessionsFromCommand,
    connectLiveCollaborationFromCommand,
    closeSettingsDialogFromCommand,
    createSettingsBackupFromCommand,
    disconnectLiveCollaborationFromCommand,
    generateCollaborationDiscoverySnapshotFromCommand,
    exportSettingsPluginFrameworkConfigFromCommand,
    importSettingsPluginFrameworkConfigFromCommand,
    openSettingsAnalyticsSectionFromCommand,
    openSettingsCollaborationSectionFromCommand,
    openSettingsIntegrationsSectionFromCommand,
    openSettingsPasteStandardTableFromCommand,
    openSettingsResetDialogFromCommand,
    openSettingsDialogFromCommand,
    refreshSettingsPluginManagerFromCommand,
    registerCollaborationPresenceSessionFromCommand,
    recordCollaborationSyncCheckpointFromCommand,
    resetCollaborationBaselineFromCommand,
    resolveOldestCollaborationConflictFromCommand,
    restoreSettingsShortcutsFromCommand,
    startSettingsPluginInstallFromCommand,
    startSettingsImportReportFileFromCommand,
    startSettingsImportStandardFromCommand,
    startSettingsImportTemplateFileFromCommand,
    queueCollaborationTestConflictFromCommand,
    quickStartLiveCollaborationFromCommand,
    publishAsyncCollaborationSnapshotFromCommand,
    pullAsyncCollaborationSnapshotFromCommand,
    startLiveCollaborationSessionFromCommand,
    toggleSettingsPrivacyModeFromCommand,
    validateSettingsPluginExtensionsFromCommand
} from './settings.js';
import {
    activateTabCommand,
    closeActiveSession,
    focusDashboardRegion,
    focusLookupRegion,
    focusMainContentArea,
    focusNavigationRegion,
    navigateApplicationLandmarks
} from './navigation.js';
import {
    activateAddEntryWorkflow,
    activateAttachFileWorkflow,
    executeSpellDialogActionFromCommand,
    renderEditor,
    startSpellCheckFromCommand,
    openEditorStatisticsDialog,
    openEditorValidationDialog
} from './reportEditor.js';
import { openProgressLogDialog } from './progressLog.js';
import { requestViewerExportDialog, requestViewerPrintPreview, renderViewer } from './reportViewer.js';
import { executeLookupCopyActionFromCommand, resetLookupFromCommand } from './lookupTool.js';
import { executeAddFieldFromCommand, executeDoneFromCommand, renderBuilder } from './reportBuilder.js';
import { getPresentationValidation, updatePresentationPreviewMode, updatePresentationSelection, updatePresentationUiSection } from './reportPresentationFramework.js';
import {
    openConfigureDashboardFromCommand,
    openDashboardProjectFromCommand,
    saveDashboardProjectAsFromCommand,
    saveDashboardProjectFromCommand,
    startDashboardImportReportFromCommand,
    startDashboardImportTemplateFromCommand
} from './dashboard.js';
import {
    clearUniversalSearchHighlights,
    findInCurrentResource,
    getActiveUniversalSearchSession,
    moveUniversalSearchSelection,
    openSearchEverywhereDialog,
    runUniversalSearch
} from './universalSearchFramework.js';
import {
    addActiveResourceToFavorites,
    addBookmarkForCurrentLocation,
    clearBookmarksFromCommand,
    clearRecentItemsFromCommand,
    openBookmarksDialog,
    openFavoritesDialog,
    openQuickOpen,
    openRecentItemsDialog,
    removeActiveResourceFromFavorites
} from './quickOpenFramework.js';
import {
    addProjectAssetFromCommand,
    closeProjectWorkspaceFromCommand,
    continueWorkingFromCommand,
    createAssetFolderFromCommand,
    createProjectWorkspaceFromCommand,
    deleteProjectWorkspaceFromCommand,
    duplicateProjectWorkspaceFromCommand,
    exportProjectWorkspaceFromCommand,
    importProjectWorkspaceFromCommand,
    openResourceDeletionAnalysisFromCommand,
    openResourceDependentsFromCommand,
    openProjectPropertiesFromCommand,
    openProjectStatisticsFromCommand,
    openProjectWorkspaceFromCommand,
    openResourceReferencesFromCommand,
    openResourceRelationshipsFromCommand,
    openRecentProjectWorkspaceFromCommand,
    openWorkspaceSettingsFromCommand,
    previewResourceDeletionImpactFromCommand,
    repairWorkspaceRelationshipsFromCommand,
    refreshWorkspaceAssetsFromCommand,
    removeProjectAssetFromCommand,
    renameProjectWorkspaceFromCommand,
    saveProjectWorkspaceAsFromCommand,
    saveProjectWorkspaceFromCommand
} from './projectWorkspaceFramework.js';
import {
    showDashboardViewFromCommand,
    showExplorerViewFromCommand,
    toggleWorkspaceViewFromCommand
} from './explorerFramework.js';
import {
    applyWorkingViewFromCommand,
    batchAddWorkingViewTagFromCommand,
    batchAssignWorkingViewReviewerFromCommand,
    batchSetWorkingViewSeverityFromCommand,
    batchSetWorkingViewStatusFromCommand,
    canCloseWorkingViewFromCommand,
    closeWorkingViewFromCommand,
    collapseAllWorkingViewGroupsFromCommand,
    deleteWorkingViewFromCommand,
    exitWorkingViewFromCommand,
    expandAllWorkingViewGroupsFromCommand,
    loadWorkingViewFromCommand,
    loadWorkingViewForReportFromCommand,
    nextWorkingViewFindingFromCommand,
    nextWorkingViewGroupFromCommand,
    openWorkingViewFromCommand,
    previousWorkingViewFindingFromCommand,
    previousWorkingViewGroupFromCommand,
    refreshWorkingViewFromCommand,
    resetWorkingViewFromCommand,
    revealWorkingViewInExplorerFromCommand,
    revealWorkingViewInReportFromCommand,
    saveWorkingViewFromCommand,
    setReportViewModeFromCommand,
    toggleReportViewModeFromCommand
} from './reportViewsFramework.js';
import {
    addSelectedResourceToCollectionFromCommand,
    assignTagToSelectedResourceFromCommand,
    createCollectionFromCommand,
    createSavedViewFromCurrentWorkingViewFromCommand,
    createTagFromCommand,
    deleteSavedViewFromCommand,
    exportResourceOrganizationMetadataFromCommand,
    importResourceOrganizationMetadataFromCommand,
    mergeTagsFromCommand,
    openCollectionManagerFromCommand,
    openSavedViewFromCommand,
    openSavedViewManagerFromCommand,
    openTagManagerFromCommand,
    removeSelectedResourceFromCollectionFromCommand,
    removeTagFromSelectedResourceFromCommand,
    replaceOrganizationResourceReferences,
    toggleFavorite
} from './resourceOrganizationFramework.js';
import {
    clearHistoryFromCommand,
    executeRedoFromCommand,
    executeUndoFromCommand,
    openCompareVersionsDialog,
    openHistoryDialogFromCommand,
    openVersionHistoryFromCommand,
    restorePreviousVersionFromCommand
} from './historyFramework.js';

let commandsRegistered = false;

function refreshActiveTabAfterHistoryAction() {
    const activeTab = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
    if (!(activeTab instanceof HTMLElement)) {
        window.dispatchEvent(new Event('art-state-updated'));
        return;
    }

    if (activeTab.id === 'tab-builder') {
        void renderBuilder();
        return;
    }

    if (activeTab.id === 'tab-editor') {
        renderEditor();
        return;
    }

    if (activeTab.id === 'tab-view') {
        renderViewer();
        return;
    }

    window.dispatchEvent(new Event('art-state-updated'));
}

function clearTemplateReferencesFromReports(templateId, templateName = '') {
    const targetId = String(templateId || '').trim();
    const targetName = String(templateName || '').trim().toLowerCase();
    if (!targetId && !targetName) return 0;

    let updatedCount = 0;
    appState.reports = (appState.reports || []).map((report) => {
        const currentTemplateId = String(report?.data?.templateOption || '').trim();
        const currentTemplateName = String(report?.data?.templateName || '').trim().toLowerCase();
        const matches = (targetId && currentTemplateId === targetId) || (targetName && currentTemplateName === targetName);
        if (!matches) return report;
        updatedCount += 1;
        return {
            ...report,
            data: {
                ...report.data,
                templateOption: '',
                templateName: ''
            }
        };
    });

    if (updatedCount > 0) {
        saveState({ action: `Removed deleted template references from ${updatedCount} report${updatedCount === 1 ? '' : 's'}` });
        window.dispatchEvent(new Event('art-reports-updated'));
    }

    return updatedCount;
}

function hasWorkspaceResourceTarget(context = {}) {
    const source = context && typeof context === 'object' ? context : {};
    if (String(source.resourceType || source.type || '').trim() && String(source.resourceId || source.id || '').trim()) {
        return true;
    }
    const anchor = source.triggerElement instanceof HTMLElement
        ? source.triggerElement
        : source.anchorElement instanceof HTMLElement
            ? source.anchorElement
            : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
    return Boolean(anchor?.closest?.('[data-resource-type][data-resource-id]'));
}

const shortcutByAction = new Map(getShortcutDefinitions().map((definition) => [definition.action, definition.shortcut]));
const labelByAction = new Map(getAssignableActions().map((item) => [item.action, item.label]));

function getDefaultMenuLocation(action, category) {
    switch (action) {
        case 'openWelcome': return 'View>Welcome Screen';
        case 'openCommandPalette': return 'View>Command Palette';
        case 'focusMenuBar': return 'View>Menu Bar';
        case 'focusMenuSearch': return 'View>Command Search';
        case 'undo': return 'Edit>History';
        case 'redo': return 'Edit>History';
        case 'openHistory': return 'Edit>History';
        case 'openVersionHistory': return 'Edit>History';
        case 'compareVersions': return 'Edit>History';
        case 'restorePreviousVersion': return 'Edit>History';
        case 'clearHistory': return 'Edit>History';
        case 'searchEverywhere':
        case 'quickOpen':
        case 'openRecentItems':
        case 'clearRecentItems':
        case 'addToFavorites':
        case 'removeFromFavorites':
        case 'openFavorites':
        case 'addBookmark':
        case 'openBookmarks':
        case 'clearBookmarks':
        case 'searchCurrentReport':
        case 'searchCurrentProjectWorkspace':
        case 'searchAllProjects':
        case 'searchAccessibilityStandards':
        case 'searchHelpDocumentation':
        case 'searchCommands':
        case 'searchKeyboardShortcuts':
        case 'searchProjectAssets':
        case 'searchTemplates':
        case 'searchDashboard':
        case 'findInCurrentResource':
        case 'findNextMatch':
        case 'findPreviousMatch':
        case 'nextSearchResult':
        case 'previousSearchResult':
        case 'clearSearchHighlights':
        case 'clearSearchHistory':
        case 'saveCurrentSearch':
        case 'openSavedSearches': return 'Search';
        case 'openBuilder': return 'View>Report Builder';
        case 'openEditor': return 'View>Report Editor';
        case 'openViewer': return 'View>Report Viewer';
        case 'focusNavigation': return 'View>Navigation';
        case 'focusDashboard': return 'View>Dashboard';
        case 'showDashboard':
        case 'showExplorer':
        case 'toggleWorkspaceView': return 'View>Workspace View';
        case 'configureDashboard': return 'View';
        case 'focusMainContent': return 'View>Main Content';
        case 'nextLandmark':
        case 'previousLandmark': return 'View>Application Landmarks';
        case 'openHelp': return 'Help>User Guide';
        case 'openProgressLog': return 'Tools>Progress Log';
        case 'focusLookup':
        case 'resetLookup': return 'Tools>Accessibility Lookup Tool';
        case 'spellCheck':
        case 'spellReplace':
        case 'spellReplaceAll':
        case 'spellIgnore':
        case 'spellIgnoreAll':
        case 'spellAddToDictionary':
        case 'spellUndoLastCorrection':
        case 'spellCancel': return 'Tools>Spell Check';
        case 'openSettings':
        case 'settingsClose':
        case 'settingsRestoreShortcuts':
        case 'settingsImportStandard':
        case 'settingsPasteStandardTable':
        case 'settingsImportReportFile':
        case 'settingsImportTemplateFile':
        case 'settingsOpenIntegrations':
        case 'settingsCustomizeAnalytics':
        case 'settingsCustomizeCollaboration':
        case 'settingsCollaborationApplySoloDefaults':
        case 'settingsCollaborationApplyTeamDefaults':
        case 'settingsCollaborationResetBaseline':
        case 'settingsCollaborationRecordSyncCheckpoint':
        case 'settingsCollaborationGenerateDiscoverySnapshot':
        case 'settingsCollaborationQueueTestConflict':
        case 'settingsCollaborationResolveOldestConflict':
        case 'settingsCollaborationRegisterPresenceSession':
        case 'settingsCollaborationClearSessions':
        case 'settingsCollaborationLiveQuickStart':
        case 'settingsCollaborationLiveConnect':
        case 'settingsCollaborationLiveDisconnect':
        case 'settingsCollaborationLiveStartSession':
        case 'settingsCollaborationPublishAsyncSnapshot':
        case 'settingsCollaborationPullAsyncSnapshot':
        case 'settingsPluginInstall':
        case 'settingsPluginValidate':
        case 'settingsPluginRefresh':
        case 'settingsPluginExportConfig':
        case 'settingsPluginImportConfig':
        case 'settingsTogglePrivacyMode':
        case 'settingsCreateBackup':
        case 'settingsResetApp':
        case 'settingsCloseReport': return 'Edit>Application Settings';
        case 'editCut':
        case 'editCopy':
        case 'editPaste':
        case 'editSelectAll': return 'Edit';
        case 'copyEntry':
        case 'copyName':
        case 'copyDescription':
        case 'copyFailures':
        case 'copyFixes':
        case 'copyLink': return 'Edit>Copy';
        case 'newReport': return 'File>New>Report';
        case 'newReportFromTemplate': return 'File>New>Report>New Report From Template';
        case 'newWorkingView': return 'File>New>Working View';
        case 'newProjectWorkspace': return 'File>New>Project Workspace';
        case 'newTemplate': return 'File>New>Template';
        case 'openProject': return 'File>Open>Project';
        case 'openReport':
        case 'importData': return 'File>Open>Report';
        case 'saveProject':
        case 'saveProjectAs': return 'File>Save>Report';
        case 'openProjectWorkspace':
        case 'openRecentProjectWorkspace':
            return 'File>Open>Project Workspace';
        case 'openWorkingView': return 'File>Open>Working View';
        case 'saveProjectWorkspace':
        case 'saveProjectWorkspaceAs':
        case 'renameProjectWorkspace':
        case 'duplicateProjectWorkspace':
        case 'importProjectWorkspace':
        case 'exportProjectWorkspace':
        case 'deleteProjectWorkspace': return 'File>Save>Project Workspace';
        case 'saveWorkingView': return 'File>Save>Working View';
        case 'closeProjectWorkspace': return 'File>Close>Project Workspace';
        case 'closeWorkingView': return 'File>Close>Working View';
        case 'closeReport': return 'File>Close>Report';
        case 'openProjectProperties':
        case 'openProjectStatistics':
        case 'openWorkspaceSettings': return 'View>Project Workspace';
        case 'openResourceRelationships':
        case 'openResourceDependents':
        case 'openResourceReferences':
        case 'previewResourceDeletionImpact':
        case 'repairWorkspaceRelationships':
        case 'openTagManager':
        case 'openCollectionManager':
        case 'openSavedViewManager': return 'View>Project Workspace';
        case 'createTag':
        case 'assignTagToSelectedResource':
        case 'removeTagFromSelectedResource':
        case 'mergeTags': return 'Tools>Tags';
        case 'createCollection':
        case 'addSelectedResourceToCollection':
        case 'removeSelectedResourceFromCollection': return 'Tools>Collections';
        case 'createSavedViewFromCurrentWorkingView':
        case 'openSavedView':
        case 'deleteSavedView': return 'Report>Saved Views';
        case 'exportResourceOrganizationMetadata':
        case 'importResourceOrganizationMetadata': return 'File>Project Workspace';
        case 'toggleTagFavorite':
        case 'toggleCollectionFavorite':
        case 'toggleSavedViewFavorite': return 'View>Favorites';
        case 'continueWorking': return 'View>Dashboard';
        case 'addProjectAsset':
        case 'createAssetFolder':
        case 'removeProjectAsset':
        case 'refreshWorkspaceAssets': return 'Tools>Project Assets';
        case 'exportReport':
        case 'printPreview': return 'File>Export';
        case 'configureReport':
        case 'renameReport':
        case 'replaceReport':
        case 'editReport':
        case 'viewReport':
        case 'deleteReport':
        case 'openWorkingView':
        case 'exitWorkingView':
        case 'applyWorkingView':
        case 'saveWorkingView':
        case 'loadWorkingView':
        case 'deleteWorkingView':
        case 'refreshWorkingView':
        case 'resetWorkingView':
        case 'nextWorkingViewFinding':
        case 'previousWorkingViewFinding':
        case 'nextWorkingViewGroup':
        case 'previousWorkingViewGroup':
        case 'revealWorkingViewInExplorer':
        case 'revealWorkingViewInReport':
        case 'expandAllWorkingViewGroups':
        case 'collapseAllWorkingViewGroups':
        case 'batchSetWorkingViewStatus':
        case 'batchAssignWorkingViewReviewer':
        case 'batchSetWorkingViewSeverity':
        case 'batchAddWorkingViewTag':
        case 'setStandardReportView':
        case 'setWorkingReportView':
        case 'setOutlineReportView':
        case 'setCompactReportView':
        case 'setExpandedReportView':
        case 'setReadingReportView':
        case 'setReviewReportView':
        case 'setTableReportView':
        case 'toggleReportViewMode':
        case 'addField':
        case 'done':
        case 'addEntry':
        case 'attachFile':
        case 'validateReport':
        case 'reportStatistics': return 'Report';
        case 'openPresentationDesigner':
        case 'presentationApplyDetailedAuditLayout':
        case 'presentationApplyExecutiveLayout':
        case 'presentationApplyDefaultTheme':
        case 'presentationApplyHighContrastTheme':
        case 'presentationApplyDefaultBranding':
        case 'presentationCyclePreviewMode':
        case 'presentationValidate': return 'Presentation';
        case 'newTemplate':
        case 'useTemplate':
        case 'openTemplate':
        case 'renameTemplate':
        case 'replaceTemplate':
        case 'editTemplate':
        case 'deleteTemplate':
        case 'importTemplate':
        case 'exportTemplate': return 'Templates';
        default: return category || 'Application';
    }
}

function clickElementById(id) {
    const element = document.getElementById(id);
    if (!element || typeof element.click !== 'function') return false;
    element.click();
    return true;
}

function isTabSelected(tabId) {
    const tab = document.getElementById(tabId);
    return Boolean(tab) && tab.getAttribute('aria-selected') === 'true';
}

function clickTabIfNeeded(tabId) {
    if (isTabSelected(tabId)) return true;
    return clickElementById(tabId);
}

function runLookupCopyWorkflow(action) {
    return executeLookupCopyActionFromCommand(action);
}

function getEditableTargetFromContext(context = {}) {
    const contextElement = context.activeElement instanceof HTMLElement ? context.activeElement : null;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const candidate = contextElement || activeElement;
    if (!candidate) return null;

    if (candidate instanceof HTMLTextAreaElement) return candidate;
    if (candidate instanceof HTMLInputElement) {
        const type = String(candidate.type || '').toLowerCase();
        const textTypes = new Set(['text', 'search', 'url', 'tel', 'password', 'email', 'number']);
        return textTypes.has(type) ? candidate : null;
    }
    if (candidate.isContentEditable) return candidate;
    return candidate.closest('[contenteditable="true"]');
}

function hasEditableSelection(target) {
    if (!target) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = Number.isFinite(target.selectionStart) ? target.selectionStart : 0;
        const end = Number.isFinite(target.selectionEnd) ? target.selectionEnd : 0;
        return end > start;
    }
    const selection = document.getSelection();
    return Boolean(selection && String(selection.toString() || '').trim());
}

function hasSelectedText(context = {}) {
    const selectedText = String(context?.selectedText || '').trim();
    if (selectedText) return true;
    const selection = document.getSelection();
    return Boolean(selection && String(selection.toString() || '').trim());
}

function selectAllContent(context = {}) {
    const editableTarget = getEditableTargetFromContext(context);
    if (editableTarget instanceof HTMLInputElement || editableTarget instanceof HTMLTextAreaElement) {
        editableTarget.focus();
        editableTarget.select();
        announce('All text selected.');
        return true;
    }

    if (editableTarget instanceof HTMLElement) {
        editableTarget.focus();
        const range = document.createRange();
        range.selectNodeContents(editableTarget);
        const selection = document.getSelection();
        if (!selection) return false;
        selection.removeAllRanges();
        selection.addRange(range);
        announce('All content selected.');
        return true;
    }

    const root = document.getElementById('main-inner') || document.body;
    if (!root) return false;
    const range = document.createRange();
    range.selectNodeContents(root);
    const selection = document.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    announce('All content selected.');
    return true;
}

function executeClipboardCommand(type) {
    try {
        const result = document.execCommand(type);
        if (result) {
            const verb = type === 'copy' ? 'copied' : type === 'cut' ? 'cut' : 'pasted';
            announce(`Selection ${verb}.`);
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

function getFirstTemplateOption() {
    const templateSelect = document.getElementById('template-selection');
    if (!templateSelect) return null;
    return [...templateSelect.options].find((option) => option.value && option.value !== 'scratch') || null;
}

function runAddFieldWorkflow() {
    clickTabIfNeeded('tab-builder');
    if (!document.getElementById('btn-add-field')) {
        document.getElementById('btn-toggle-config')?.click();
    }
    return executeAddFieldFromCommand();
}

function runDoneWorkflow() {
    clickTabIfNeeded('tab-builder');
    return executeDoneFromCommand();
}

function runAddEntryWorkflow() {
    if (!activateAddEntryWorkflow()) return false;
    appState.editorReadOnly = false;
    saveState({ action: 'Opened add entry workflow', recordHistory: false });

    const editorTab = document.getElementById('tab-editor');
    const isEditorActive = editorTab?.getAttribute('aria-selected') === 'true';

    if (isEditorActive) {
        renderEditor();
    } else {
        clickElementById('tab-editor');
    }
    return true;
}

function runAttachFileWorkflow(context = {}) {
    clickElementById('tab-editor');
    return activateAttachFileWorkflow(context);
}

function runExportWorkflow() {
    clickElementById('tab-view');
    requestViewerExportDialog();
    renderViewer();
    return true;
}

function runPrintPreviewWorkflow() {
    clickElementById('tab-view');
    requestViewerPrintPreview();
    renderViewer();
    return true;
}

function runSpellCheckWorkflow() {
    clickElementById('tab-editor');
    return startSpellCheckFromCommand();
}

async function runValidateReportWorkflow(context = {}) {
    clickTabIfNeeded('tab-editor');
    const triggerButton = context.triggerButton || document.getElementById('btn-editor-validate-report') || document.activeElement;
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (openEditorValidationDialog(triggerButton)) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    return false;
}

async function runReportStatisticsWorkflow(context = {}) {
    clickTabIfNeeded('tab-editor');
    const triggerButton = context.triggerButton || document.getElementById('btn-editor-report-statistics') || document.activeElement;
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (openEditorStatisticsDialog(triggerButton)) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    return false;
}

function runNewReportFromTemplateWorkflow(context = {}) {
    const selectedTemplateId = String(context.templateId || '').trim();
    const firstTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : getFirstTemplateOption();
    const templateSelect = document.getElementById('template-selection');
    if (templateSelect && firstTemplate) {
        templateSelect.value = firstTemplate.id || firstTemplate.value;
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return runUseTemplateWorkflow({ templateId: firstTemplate?.id || firstTemplate?.value || '' });
}

function getSelectedReportId(context = {}) {
    const contextReportId = String(context.reportId || '').trim();
    if (contextReportId) return contextReportId;

    const select = document.getElementById('recent-reports-select');
    const selected = String(select?.value || appState.selectedReportId || '').trim();
    if (!selected || selected.startsWith('project:')) return '';
    return selected;
}

function getSelectedTemplateId(context = {}) {
    const contextTemplateId = String(context.templateId || '').trim();
    if (contextTemplateId) return contextTemplateId;

    const select = document.getElementById('template-selection');
    const selected = String(select?.value || '').trim();
    return selected && selected !== 'scratch' ? selected : '';
}

function runNewReportWorkflow() {
    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    saveState();
    return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
}

function focusBuilderElementAfterRender(elementId) {
    window.setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element && typeof element.focus === 'function') {
            if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
            element.focus();
        }
    }, 0);
}

function openPresentationDesignerWorkflow(section = 'layout', focusId = 'presentation-config-heading') {
    updatePresentationUiSection(section, true, { action: `Opened presentation ${section} section` });
    const opened = activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
    renderBuilder();
    focusBuilderElementAfterRender(focusId);
    return opened;
}

function applyPresentationLayoutWorkflow(layoutId) {
    updatePresentationSelection({ layoutId, publishingProfileId: '' }, { action: 'Applied report presentation layout from command' });
    return openPresentationDesignerWorkflow('layout', 'presentation-layout-select');
}

function applyPresentationThemeWorkflow(themeId) {
    updatePresentationSelection({ themeId, publishingProfileId: '' }, { action: 'Applied report presentation theme from command' });
    return openPresentationDesignerWorkflow('theme', 'presentation-theme-select');
}

function applyPresentationBrandingWorkflow(brandingId) {
    updatePresentationSelection({ brandingId, publishingProfileId: '' }, { action: 'Applied report presentation branding from command' });
    return openPresentationDesignerWorkflow('branding', 'presentation-branding-select');
}

function cyclePresentationPreviewModeWorkflow() {
    const modes = ['screen', 'print', 'pdf', 'word', 'html'];
    const current = String(appState.presentation?.preview?.mode || 'screen').trim() || 'screen';
    const index = Math.max(0, modes.indexOf(current));
    const next = modes[(index + 1) % modes.length];
    updatePresentationPreviewMode(next, { action: `Updated presentation preview mode to ${next}` });
    announce(`Presentation preview mode ${next}.`);
    return openPresentationDesignerWorkflow('advanced', 'presentation-preview-mode');
}

function validatePresentationWorkflow() {
    const messages = getPresentationValidation();
    announce(messages.length === 0 ? 'Presentation validation passed.' : `Presentation validation found ${messages.length} issue${messages.length === 1 ? '' : 's'}.`);
    return openPresentationDesignerWorkflow('accessibility', 'presentation-accessibility-summary');
}

function runShowDashboardWorkflow() {
    return showDashboardViewFromCommand();
}

function runShowExplorerWorkflow() {
    return showExplorerViewFromCommand();
}

function runToggleWorkspaceViewWorkflow() {
    return toggleWorkspaceViewFromCommand();
}

function runOpenWorkingViewWorkflow(context = {}) {
    return openWorkingViewFromCommand(context);
}

function runSetReportViewModeWorkflow(mode) {
    return setReportViewModeFromCommand(mode);
}

function runOpenTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    if (!templateId) return false;

    const selected = loadTemplate(templateId);
    if (!selected) return false;

    appState.editorUsesReportTitle = true;
    appState.editorReadOnly = true;
    appState.templateCreateMode = false;
    appState.templateEditingId = null;
    saveState();
    return activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
}

function runUseTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    if (!templateId) return false;

    const selected = loadTemplate(templateId);
    if (!selected) return false;

    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    appState.templateCreateMode = true;
    appState.templateEditingId = null;
    saveState();
    return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
}

function runCreateTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const templateName = String(context.templateName || '').trim();

    if (!templateId) {
        resetReportToBlank();
        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        appState.templateCreateMode = true;
        appState.templateEditingId = null;
        saveState();
        return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
    }

    if (!templateName) return false;

    const loaded = loadTemplate(templateId);
    if (!loaded) return false;

    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    appState.templateCreateMode = true;
    appState.templateEditingId = null;
    appState.templateName = templateName;
    saveState();
    return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
}

function runEditTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const selected = getTemplateById(templateId);
    if (!selected) return false;

    let targetId = selected.id;
    if (context.createEditableCopy === true) {
        const editableCopy = createUserTemplateFromSelection(selected.id, `${selected.name} Editable Copy`);
        if (!editableCopy) return false;
        window.dispatchEvent(new Event('art-templates-updated'));
        const templateSelect = document.getElementById('template-selection');
        if (templateSelect) {
            window.setTimeout(() => {
                templateSelect.value = editableCopy.id;
                templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
        announce(`${editableCopy.name} created for editing`);
        targetId = editableCopy.id;
    }

    const loaded = loadTemplate(targetId);
    if (!loaded) return false;

    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    appState.templateCreateMode = false;
    appState.templateEditingId = targetId;
    saveState();
    return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
}

function replaceTemplateReferencesInReports(oldTemplate, newTemplate) {
    const oldId = String(oldTemplate?.id || '').trim();
    const oldName = String(oldTemplate?.name || '').trim().toLowerCase();
    const nextId = String(newTemplate?.id || '').trim();
    const nextName = String(newTemplate?.name || '').trim();
    if (!oldId || !nextId || !nextName) return 0;

    let updatedCount = 0;
    appState.reports = (appState.reports || []).map((report) => {
        const currentTemplateId = String(report?.data?.templateOption || '').trim();
        const currentTemplateName = String(report?.data?.templateName || '').trim().toLowerCase();
        const matches = currentTemplateId === oldId || (oldName && currentTemplateName === oldName);
        if (!matches) return report;
        updatedCount += 1;
        return {
            ...report,
            data: {
                ...report.data,
                templateOption: nextId,
                templateName: nextName
            }
        };
    });

    if (String(appState.templateOption || '').trim() === oldId || String(appState.templateName || '').trim().toLowerCase() === oldName) {
        appState.templateOption = nextId;
        appState.templateName = nextName;
    }

    if (updatedCount > 0) {
        saveState({ action: `Replaced template references in ${updatedCount} report${updatedCount === 1 ? '' : 's'}` });
        window.dispatchEvent(new Event('art-reports-updated'));
    }

    return updatedCount;
}

function runRenameTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const selected = getTemplateById(templateId);
    if (!selected || !String(selected.id || '').startsWith('user-')) return false;

    const nextName = String(window.prompt('Rename Template', selected.name) || '').trim();
    if (!nextName || nextName === selected.name) return false;
    if (templateNameExists(nextName)) {
        announce(`A template named ${nextName} already exists.`);
        return false;
    }

    const renamed = renameUserTemplateById(selected.id, nextName);
    if (!renamed) return false;

    const templateSelect = document.getElementById('template-selection');
    if (templateSelect instanceof HTMLSelectElement) {
        window.setTimeout(() => {
            templateSelect.value = renamed.id;
            templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            templateSelect.focus();
        }, 0);
    }

    announce(`Renamed template to ${renamed.name}.`);
    return true;
}

function runReplaceTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const selected = getTemplateById(templateId);
    if (!selected || !String(selected.id || '').startsWith('user-')) return false;

    const candidates = [
        ...document.querySelectorAll('#template-selection option')
    ]
        .map((option) => ({ id: String(option.value || '').trim(), name: String(option.textContent || '').trim() }))
        .filter((option) => option.id && option.id !== 'scratch' && option.id !== selected.id);
    if (!candidates.length) {
        announce('No replacement template is available.');
        return false;
    }

    const choice = Number(window.prompt(`Replace ${selected.name} with:\n${candidates.map((item, index) => `${index + 1}. ${item.name}`).join('\n')}`, '1')) - 1;
    if (!Number.isInteger(choice) || choice < 0 || choice >= candidates.length) return false;

    const replacement = getTemplateById(candidates[choice].id);
    if (!replacement) return false;

    const confirmed = window.confirm(`Replace ${selected.name} with ${replacement.name}? Reports and workspace references will point to the replacement template, and the original template will be deleted.`);
    if (!confirmed) return false;

    const updatedReports = replaceTemplateReferencesInReports(selected, replacement);
    const cleanup = replaceResourceReferencesAcrossWorkspaces('template', selected.id, replacement.id, {
        action: `Replaced workspace references from template ${selected.name} to ${replacement.name}`,
        persist: true
    });
    const organizationCleanup = replaceOrganizationResourceReferences('template', selected.id, replacement.id, appState.activeWorkspaceId);
    const deleted = deleteUserTemplate(selected.id);
    if (!deleted) return false;

    const templateSelect = document.getElementById('template-selection');
    if (templateSelect instanceof HTMLSelectElement) {
        window.setTimeout(() => {
            templateSelect.value = replacement.id;
            templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            templateSelect.focus();
        }, 0);
    }

    announce(`Replaced template ${selected.name} with ${replacement.name}.${updatedReports > 0 ? ` Updated ${updatedReports} report reference${updatedReports === 1 ? '' : 's'}.` : ''}${cleanup.replacedReferenceCount > 0 ? ` Updated ${cleanup.replacedReferenceCount} workspace reference${cleanup.replacedReferenceCount === 1 ? '' : 's'}.` : ''}${organizationCleanup.replacedCount > 0 ? ` Updated ${organizationCleanup.replacedCount} organization reference${organizationCleanup.replacedCount === 1 ? '' : 's'}.` : ''}`);
    return true;
}

function runDeleteTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const selected = getTemplateById(templateId);
    if (!selected) return false;

    const performDelete = () => {
        const clearedReportCount = clearTemplateReferencesFromReports(selected.id, selected.name);
        const cleanup = removeResourceReferencesFromAllWorkspaces('template', selected.id, {
            action: `Removed workspace references for deleted template ${selected.name}`,
            persist: true
        });
        const deleted = deleteUserTemplate(selected.id);
        if (!deleted) return false;

        const dialog = document.getElementById('template-delete-dialog');
        if (dialog) dialog.hidden = true;

        window.dispatchEvent(new Event('art-templates-updated'));

        const templateSelect = document.getElementById('template-selection');
        if (templateSelect) {
            window.setTimeout(() => {
                templateSelect.value = 'scratch';
                templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
                templateSelect.focus();
            }, 0);
        }

        const cleanupText = [];
        if (clearedReportCount > 0) cleanupText.push(`${clearedReportCount} report reference${clearedReportCount === 1 ? '' : 's'} cleared`);
        if (cleanup.removedReferenceCount > 0) cleanupText.push(`${cleanup.removedReferenceCount} workspace relationship${cleanup.removedReferenceCount === 1 ? '' : 's'} removed`);
        announce(cleanupText.length > 0 ? `${deleted.name} template deleted. ${cleanupText.join('. ')}.` : `${deleted.name} template deleted`);
        return true;
    };

    if (appState.activeWorkspaceId) {
        const opened = openResourceDeletionAnalysisFromCommand('template', selected.id, performDelete, context.triggerElement || document.activeElement || null);
        if (opened) return true;
    }

    if (context.confirm !== true && !window.confirm(`Delete template ${selected.name}?`)) return false;
    return performDelete();
}

function runExportTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    const selected = getTemplateById(templateId);
    if (!selected) return false;

    const safeName = String(selected.name || 'Template').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Template';
    const payload = serializeArtxTemplatePayload(selected);
    const blob = new Blob([payload], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${safeName}.artx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    announce(`Exported template ${selected.name}.`);
    return true;
}

function updateStatusMessage(elementId, message) {
    const status = document.getElementById(elementId);
    if (status) status.textContent = message;
    announce(message);
}

function runImportReportWorkflow(context = {}) {
    if (context.strategy) {
        const dialog = document.getElementById('import-conflict-dialog');
        const rawPayload = String(dialog?.dataset.importPayload || '').trim();
        const fileName = String(dialog?.dataset.importFileName || 'report').trim() || 'report';
        if (!rawPayload) return false;

        let payload;
        try {
            payload = JSON.parse(rawPayload);
        } catch (error) {
            updateStatusMessage('open-report-status', `Import failed for ${fileName}. Could not resolve the pending report payload.`);
            return false;
        }

        const imported = importReportWithConflictStrategy(payload, context.strategy);
        dialog?.removeAttribute('data-import-payload');
        dialog?.removeAttribute('data-import-file-name');
        if (dialog) dialog.hidden = true;
        if (!imported) {
            updateStatusMessage('open-report-status', `Import failed for ${fileName}.`);
            return false;
        }

        updateStatusMessage('open-report-status', `Imported ${fileName} successfully.`);
        return activateTabCommand('tab-view', 'viewer-heading', 'Report Viewer');
    }

    return startDashboardImportReportFromCommand();
}

function runImportTemplateWorkflow(context = {}) {
    if (context.strategy) {
        const dialog = document.getElementById('template-import-conflict-dialog');
        const rawPayload = String(dialog?.dataset.templatePayload || '').trim();
        const fileName = String(dialog?.dataset.templateFileName || 'template').trim() || 'template';
        if (!rawPayload) return false;

        let payload;
        try {
            payload = JSON.parse(rawPayload);
        } catch (error) {
            updateStatusMessage('template-status', `Template import failed for ${fileName}. Could not resolve the pending template payload.`);
            return false;
        }

        const imported = importTemplateWithConflictStrategy(payload, context.strategy);
        dialog?.removeAttribute('data-template-payload');
        dialog?.removeAttribute('data-template-file-name');
        if (dialog) dialog.hidden = true;
        if (!imported) {
            updateStatusMessage('template-status', `Template import failed for ${fileName}.`);
            return false;
        }

        window.dispatchEvent(new Event('art-templates-updated'));
        const templateSelect = document.getElementById('template-selection');
        if (templateSelect) {
            window.setTimeout(() => {
                templateSelect.value = imported.id;
                templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
                templateSelect.focus();
            }, 0);
        }
        updateStatusMessage('template-status', `Imported template ${imported.name} successfully.`);
        return true;
    }

    return startDashboardImportTemplateFromCommand();
}

function runConfigureReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    if (!reportId) return false;
    const report = loadReportById(reportId);
    if (!report) return false;
    return activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
}

function runEditReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    if (!reportId) return false;
    const report = loadReportById(reportId);
    if (!report) return false;
    appState.editorReadOnly = false;
    saveState({ action: `Opened report ${report.name} in editor`, recordHistory: false });
    return activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
}

function runViewReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    if (!reportId) return false;
    const report = loadReportById(reportId);
    if (!report) return false;
    return activateTabCommand('tab-view', 'viewer-heading', 'Report Viewer');
}

function canCloseActiveSession() {
    const templateSelect = document.getElementById('template-selection');
    return Boolean(
        String(appState.selectedReportId || '').trim()
        || (templateSelect && templateSelect.value && templateSelect.value !== 'scratch')
        || appState.templateCreateMode
        || appState.templateEditingId
        || String(appState.templateName || '').trim()
    );
}

function runCloseReportWorkflow() {
    if (!canCloseActiveSession()) return false;

    const templateSelect = document.getElementById('template-selection');
    const recentReportsSelect = document.getElementById('recent-reports-select');
    const hadTemplateSession = Boolean(
        (templateSelect && templateSelect.value && templateSelect.value !== 'scratch')
        || appState.templateCreateMode
        || appState.templateEditingId
        || String(appState.templateName || '').trim()
    );

    closeCurrentReportSession();

    if (templateSelect) {
        templateSelect.value = 'scratch';
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (recentReportsSelect) {
        recentReportsSelect.value = '';
        recentReportsSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    announce(hadTemplateSession ? 'Closed template session.' : 'Closed active report.');
    activateTabCommand('tab-welcome', 'welcome-heading', 'Welcome');
    return true;
}

function runCloseWorkingViewWorkflow() {
    if (!canCloseWorkingViewFromCommand()) return false;
    return closeWorkingViewFromCommand({ promptToSave: true });
}

function runDeleteReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    const report = reportId ? getReportById(reportId) : null;
    if (!report) return false;

    const performDelete = () => {
        const removed = deleteReportById(reportId);
        if (!removed) return false;

        const cleanup = removeResourceReferencesFromAllWorkspaces('report', reportId, {
            action: `Removed workspace references for deleted report ${removed.name}`,
            persist: true
        });

        const dialog = document.getElementById('report-delete-dialog');
        const confirmButton = document.getElementById('btn-report-delete-confirm');
        const recentReportsSelect = document.getElementById('recent-reports-select');
        if (dialog) dialog.hidden = true;
        if (confirmButton) confirmButton.removeAttribute('data-report-id');
        announce(cleanup.removedReferenceCount > 0
            ? `Deleted report ${removed.name}. Removed ${cleanup.removedReferenceCount} related workspace reference${cleanup.removedReferenceCount === 1 ? '' : 's'}.`
            : `Deleted report ${removed.name}`);
        window.setTimeout(() => {
            recentReportsSelect?.focus();
        }, 0);
        return true;
    };

    if (appState.activeWorkspaceId) {
        const opened = openResourceDeletionAnalysisFromCommand('report', reportId, performDelete, context.triggerElement || document.activeElement || null);
        if (opened) return true;
    }

    if (context.confirm !== true && !window.confirm(`Delete report ${report.name}?`)) return false;
    return performDelete();
}

function runRenameReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    const report = reportId ? getReportById(reportId) : null;
    if (!report) return false;

    const nextName = String(window.prompt('Rename Report', report.name) || '').trim();
    if (!nextName || nextName === report.name) return false;
    if (reportNameExists(nextName)) {
        announce(`A report named ${nextName} already exists.`);
        return false;
    }

    const renamed = renameReportById(reportId, nextName);
    if (!renamed) return false;

    const recentReportsSelect = document.getElementById('recent-reports-select');
    if (recentReportsSelect instanceof HTMLSelectElement) {
        window.setTimeout(() => {
            recentReportsSelect.value = renamed.id;
            recentReportsSelect.dispatchEvent(new Event('change', { bubbles: true }));
            recentReportsSelect.focus();
        }, 0);
    }

    announce(`Renamed report to ${renamed.name}.`);
    return true;
}

function runReplaceReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    const report = reportId ? getReportById(reportId) : null;
    if (!report) return false;

    const candidates = getRecentReports()
        .filter((item) => item.id !== report.id)
        .map((item) => ({ id: item.id, name: item.name }));
    if (!candidates.length) {
        announce('No replacement report is available.');
        return false;
    }

    const choice = Number(window.prompt(`Replace ${report.name} with:\n${candidates.map((item, index) => `${index + 1}. ${item.name}`).join('\n')}`, '1')) - 1;
    if (!Number.isInteger(choice) || choice < 0 || choice >= candidates.length) return false;

    const replacement = getReportById(candidates[choice].id);
    if (!replacement) return false;

    const confirmed = window.confirm(`Replace ${report.name} with ${replacement.name}? Workspace references will point to the replacement report, and the original report will be deleted.`);
    if (!confirmed) return false;

    const cleanup = replaceResourceReferencesAcrossWorkspaces('report', report.id, replacement.id, {
        action: `Replaced workspace references from report ${report.name} to ${replacement.name}`,
        persist: true
    });
    const organizationCleanup = replaceOrganizationResourceReferences('report', report.id, replacement.id, appState.activeWorkspaceId);
    const removed = deleteReportById(report.id);
    if (!removed) return false;

    if (String(appState.selectedReportId || '').trim() !== replacement.id) {
        loadReportById(replacement.id);
    }

    const recentReportsSelect = document.getElementById('recent-reports-select');
    if (recentReportsSelect instanceof HTMLSelectElement) {
        window.setTimeout(() => {
            recentReportsSelect.value = replacement.id;
            recentReportsSelect.dispatchEvent(new Event('change', { bubbles: true }));
            recentReportsSelect.focus();
        }, 0);
    }

    announce(`Replaced report ${report.name} with ${replacement.name}.${cleanup.replacedReferenceCount > 0 ? ` Updated ${cleanup.replacedReferenceCount} workspace reference${cleanup.replacedReferenceCount === 1 ? '' : 's'}.` : ''}${organizationCleanup.replacedCount > 0 ? ` Updated ${organizationCleanup.replacedCount} organization reference${organizationCleanup.replacedCount === 1 ? '' : 's'}.` : ''}`);
    return true;
}

function runSearchEverywhereWorkflow(context = {}) {
    return openSearchEverywhereDialog(context.triggerElement || document.activeElement || null, context.query || '', 'auto');
}

function runSearchWithScope(scope, context = {}) {
    const query = String(context.query || '').trim();
    const output = runUniversalSearch(query, {
        source: 'command-catalog',
        scope,
        limit: 60
    });
    if (!query) {
        return openSearchEverywhereDialog(context.triggerElement || document.activeElement || null, query, scope);
    }
    announce(`Search returned ${output.totalResults} result${output.totalResults === 1 ? '' : 's'} in ${scope.replace(/-/g, ' ')}.`);
    return true;
}

function runFindInCurrentResourceWorkflow(context = {}) {
    const query = String(context.query || '').trim();
    if (query) {
        return Boolean(findInCurrentResource(query)?.ok);
    }
    const active = getActiveUniversalSearchSession();
    if (active?.query) {
        return Boolean(findInCurrentResource(active.query)?.ok);
    }
    return openSearchEverywhereDialog(context.triggerElement || document.activeElement || null, '');
}

function runSaveCurrentSearchWorkflow() {
    const active = getActiveUniversalSearchSession();
    if (!active?.query) {
        announce('Run a search before saving.');
        return false;
    }
    const saveButton = document.getElementById('btn-search-everywhere-save');
    if (saveButton) {
        saveButton.click();
        return true;
    }
    return openSearchEverywhereDialog(document.activeElement || null, active.query);
}

function runOpenSavedSearchesWorkflow() {
    const savedButton = document.getElementById('btn-search-everywhere-saved');
    if (savedButton) {
        savedButton.click();
        return true;
    }
    return openSearchEverywhereDialog(document.activeElement || null, '');
}

function runClearSearchHistoryWorkflow() {
    const clearButton = document.getElementById('btn-search-everywhere-clear-history');
    if (clearButton) {
        clearButton.click();
        return true;
    }
    clearUniversalSearchHistory();
    announce('Universal search history cleared.');
    return true;
}

function runToggleFavoriteWorkflow(itemType, context = {}) {
    const source = context && typeof context === 'object' ? context : {};
    const directId = String(source.itemId || source.id || '').trim();
    const trigger = source.triggerElement instanceof HTMLElement
        ? source.triggerElement
        : source.anchorElement instanceof HTMLElement
            ? source.anchorElement
            : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
    const elementId = trigger?.getAttribute?.('data-organization-item-id') || '';
    const targetId = directId || elementId;
    if (!targetId) return false;
    const result = toggleFavorite(itemType, targetId);
    if (!result?.ok) return false;
    announce('Favorite status updated.');
    return true;
}

function getTopLevelMenuRoot(location, category) {
    const segments = String(location || '').split('>').map((part) => String(part || '').trim()).filter(Boolean);
    const root = segments[0] || String(category || '').trim();
    if (!root || root.toLowerCase() === 'application') return '';
    return root;
}

function getTopLevelMenusForShortcutCommands(definitions = []) {
    const roots = [];
    const addRoot = (label) => {
        const value = String(label || '').trim();
        if (!value) return;
        if (roots.some((item) => item.toLowerCase() === value.toLowerCase())) return;
        roots.push(value);
    };

    definitions.forEach((definition) => {
        const location = definition.menuLocation || getDefaultMenuLocation(definition.action, definition.category);
        addRoot(getTopLevelMenuRoot(location, definition.category));
    });

    return mergeTopLevelMenuLabels(roots);
}

function buildTopLevelMenuShortcutCommandDefinitions(definitions = []) {
    return getTopLevelMenusForShortcutCommands(definitions)
        .map((menuLabel) => getTopLevelMenuShortcutDescriptor(menuLabel))
        .filter(Boolean)
        .map((descriptor) => ({
            action: descriptor.action,
            id: descriptor.commandId,
            category: 'Application',
            description: `Open the ${descriptor.menuLabel} menu in the Menu Bar.`,
            menuLocation: 'View>Menu Bar',
            contextMenuVisible: false,
            handler: () => openTopLevelMenuFromCommand(descriptor.menuLabel)
        }));
}

const BASE_COMMAND_DEFINITIONS = [
    {
        action: 'openWelcome',
        id: 'Application.OpenWelcome',
        category: 'Application',
        description: 'Open the Welcome panel.',
        handler: () => activateTabCommand('tab-welcome', 'welcome-heading', 'Welcome')
    },
    {
        action: 'openHelp',
        id: 'Help.OpenHelp',
        category: 'Help',
        description: 'Open the integrated Help documentation.',
        handler: (context) => openHelpDialog(context?.triggerElement || context?.activeElement || null)
    },
    {
        action: 'openCommandPalette',
        id: 'Application.OpenCommandPalette',
        category: 'Application',
        description: 'Open the Command Palette.',
        handler: () => openCommandPalette(null)
    },
    {
        action: 'focusMenuBar',
        id: 'Application.FocusMenuBar',
        category: 'Application',
        description: 'Move focus to the Menu Bar.',
        handler: () => focusMenuBarFromCommand()
    },
    {
        action: 'focusMenuSearch',
        id: 'Application.FocusMenuSearch',
        category: 'Application',
        description: 'Move focus to the Menu Bar Command Search.',
        handler: () => focusMenuSearchFromCommand()
    },
    {
        action: 'undo',
        id: 'Edit.History.Undo',
        category: 'Edit',
        description: 'Undo the most recent undoable transaction.',
        enabled: () => canUndoState(),
        handler: () => {
            const result = executeUndoFromCommand();
            if (!result.ok) {
                announce('Nothing to undo.');
                return false;
            }
            refreshActiveTabAfterHistoryAction();
            return true;
        }
    },
    {
        action: 'redo',
        id: 'Edit.History.Redo',
        category: 'Edit',
        description: 'Redo the most recently undone transaction.',
        enabled: () => canRedoState(),
        handler: () => {
            const result = executeRedoFromCommand();
            if (!result.ok) {
                announce('Nothing to redo.');
                return false;
            }
            refreshActiveTabAfterHistoryAction();
            return true;
        }
    },
    {
        action: 'openHistory',
        id: 'Edit.History.Open',
        category: 'Edit',
        description: 'Open application change history.',
        handler: (context) => openHistoryDialogFromCommand(context)
    },
    {
        action: 'openVersionHistory',
        id: 'Edit.History.VersionHistory',
        category: 'Edit',
        description: 'Open version history for the active or selected resource.',
        handler: (context) => openVersionHistoryFromCommand(context)
    },
    {
        action: 'compareVersions',
        id: 'Edit.History.CompareVersions',
        category: 'Edit',
        description: 'Compare versions for the active or selected resource.',
        handler: (context) => openCompareVersionsDialog(context)
    },
    {
        action: 'restorePreviousVersion',
        id: 'Edit.History.RestorePreviousVersion',
        category: 'Edit',
        description: 'Restore the previous version for the active or selected resource.',
        handler: (context) => {
            const result = restorePreviousVersionFromCommand(context);
            if (!result?.ok) {
                announce('No previous version is available to restore.');
                return false;
            }
            refreshActiveTabAfterHistoryAction();
            return true;
        }
    },
    {
        action: 'clearHistory',
        id: 'Edit.History.Clear',
        category: 'Edit',
        description: 'Clear retained history entries and undo/redo stacks.',
        handler: (context) => {
            const confirmed = window.confirm('Clear history entries and undo/redo stacks? This cannot be undone.');
            if (!confirmed) return false;
            return Boolean(clearHistoryFromCommand(context)?.ok);
        }
    },
    {
        action: 'searchEverywhere',
        id: 'Search.Everywhere',
        category: 'Search',
        description: 'Open Search Everywhere for commands, reports, templates, workspaces, help, and standards.',
        handler: (context) => runSearchEverywhereWorkflow(context)
    },
    {
        action: 'quickOpen',
        id: 'Search.QuickOpen',
        category: 'Search',
        description: 'Quickly open a report, workspace, working view, finding, template, or other ART resource.',
        handler: (context) => openQuickOpen(context.triggerElement || document.activeElement || null, {
            query: String(context.query || '')
        })
    },
    {
        action: 'openRecentItems',
        id: 'Search.OpenRecentItems',
        category: 'Search',
        description: 'Open the list of recently opened ART resources.',
        handler: (context) => openRecentItemsDialog(context.triggerElement || document.activeElement || null)
    },
    {
        action: 'clearRecentItems',
        id: 'Search.ClearRecentItems',
        category: 'Search',
        description: 'Clear the locally stored list of recently opened resources.',
        handler: () => clearRecentItemsFromCommand()
    },
    {
        action: 'addToFavorites',
        id: 'Search.AddToFavorites',
        category: 'Search',
        description: 'Add the current resource or location to favorites.',
        handler: (context) => addActiveResourceToFavorites({
            sourceElement: context.triggerElement || context.activeElement || null
        })
    },
    {
        action: 'removeFromFavorites',
        id: 'Search.RemoveFromFavorites',
        category: 'Search',
        description: 'Remove the current resource or location from favorites.',
        handler: (context) => removeActiveResourceFromFavorites({
            sourceElement: context.triggerElement || context.activeElement || null
        })
    },
    {
        action: 'openFavorites',
        id: 'Search.OpenFavorites',
        category: 'Search',
        description: 'Open your favorite ART resources.',
        handler: (context) => openFavoritesDialog(context.triggerElement || document.activeElement || null)
    },
    {
        action: 'addBookmark',
        id: 'Search.AddBookmark',
        category: 'Search',
        description: 'Bookmark the current location so you can return to it later.',
        handler: (context) => addBookmarkForCurrentLocation({
            name: String(context.name || ''),
            sourceElement: context.triggerElement || context.activeElement || null
        })
    },
    {
        action: 'openBookmarks',
        id: 'Search.OpenBookmarks',
        category: 'Search',
        description: 'Open your bookmarked ART locations.',
        handler: (context) => openBookmarksDialog(context.triggerElement || document.activeElement || null)
    },
    {
        action: 'clearBookmarks',
        id: 'Search.ClearBookmarks',
        category: 'Search',
        description: 'Remove all bookmarks stored on this device.',
        handler: () => clearBookmarksFromCommand()
    },
    {
        action: 'searchCurrentReport',
        id: 'Search.CurrentReport',
        category: 'Search',
        description: 'Search in the current report scope.',
        handler: (context) => runSearchWithScope('current-report', context)
    },
    {
        action: 'searchCurrentProjectWorkspace',
        id: 'Search.CurrentProjectWorkspace',
        category: 'Search',
        description: 'Search in the active project workspace scope.',
        handler: (context) => runSearchWithScope('current-project-workspace', context)
    },
    {
        action: 'searchAllProjects',
        id: 'Search.AllProjects',
        category: 'Search',
        description: 'Search across all projects and reports.',
        handler: (context) => runSearchWithScope('workspace', context)
    },
    {
        action: 'searchAccessibilityStandards',
        id: 'Search.AccessibilityStandards',
        category: 'Search',
        description: 'Search imported accessibility standards and criteria.',
        handler: (context) => runSearchWithScope('standards', context)
    },
    {
        action: 'searchHelpDocumentation',
        id: 'Search.HelpDocumentation',
        category: 'Search',
        description: 'Search help documentation topics.',
        handler: (context) => runSearchWithScope('help', context)
    },
    {
        action: 'searchCommands',
        id: 'Search.Commands',
        category: 'Search',
        description: 'Search command definitions.',
        handler: (context) => runSearchWithScope('commands', context)
    },
    {
        action: 'searchKeyboardShortcuts',
        id: 'Search.KeyboardShortcuts',
        category: 'Search',
        description: 'Search keyboard shortcut assignments.',
        handler: (context) => runSearchWithScope('shortcuts', context)
    },
    {
        action: 'searchProjectAssets',
        id: 'Search.ProjectAssets',
        category: 'Search',
        description: 'Search project assets in workspaces.',
        handler: (context) => runSearchWithScope('project-assets', context)
    },
    {
        action: 'searchTemplates',
        id: 'Search.Templates',
        category: 'Search',
        description: 'Search report templates.',
        handler: (context) => runSearchWithScope('templates', context)
    },
    {
        action: 'searchDashboard',
        id: 'Search.Dashboard',
        category: 'Search',
        description: 'Search dashboard widgets and commands.',
        handler: (context) => runSearchWithScope('dashboard', context)
    },
    {
        action: 'findInCurrentResource',
        id: 'Search.FindInCurrentResource',
        category: 'Search',
        description: 'Find the active search query in the current resource.',
        handler: (context) => runFindInCurrentResourceWorkflow(context)
    },
    {
        action: 'findNextMatch',
        id: 'Search.FindNextMatch',
        category: 'Search',
        description: 'Move to the next search result match.',
        handler: () => Boolean(moveUniversalSearchSelection(1))
    },
    {
        action: 'findPreviousMatch',
        id: 'Search.FindPreviousMatch',
        category: 'Search',
        description: 'Move to the previous search result match.',
        handler: () => Boolean(moveUniversalSearchSelection(-1))
    },
    {
        action: 'nextSearchResult',
        id: 'Search.NextResult',
        category: 'Search',
        description: 'Select the next universal search result.',
        handler: () => Boolean(moveUniversalSearchSelection(1))
    },
    {
        action: 'previousSearchResult',
        id: 'Search.PreviousResult',
        category: 'Search',
        description: 'Select the previous universal search result.',
        handler: () => Boolean(moveUniversalSearchSelection(-1))
    },
    {
        action: 'clearSearchHighlights',
        id: 'Search.ClearHighlights',
        category: 'Search',
        description: 'Clear in-page search highlights.',
        handler: () => clearUniversalSearchHighlights()
    },
    {
        action: 'clearSearchHistory',
        id: 'Search.ClearHistory',
        category: 'Search',
        description: 'Clear universal search history.',
        handler: () => runClearSearchHistoryWorkflow()
    },
    {
        action: 'saveCurrentSearch',
        id: 'Search.SaveCurrent',
        category: 'Search',
        description: 'Save the active universal search query.',
        handler: () => runSaveCurrentSearchWorkflow()
    },
    {
        action: 'openSavedSearches',
        id: 'Search.OpenSaved',
        category: 'Search',
        description: 'Open the saved searches list.',
        handler: () => runOpenSavedSearchesWorkflow()
    },
    {
        action: 'openBuilder',
        id: 'Report.OpenBuilder',
        category: 'Report',
        description: 'Open the Report Builder panel.',
        handler: () => activateTabCommand('tab-builder', 'builder-heading', 'Report Builder')
    },
    {
        action: 'openEditor',
        id: 'Report.OpenEditor',
        category: 'Report',
        description: 'Open the Report Editor panel.',
        handler: () => activateTabCommand('tab-editor', 'editor-heading', 'Report Editor')
    },
    {
        action: 'openViewer',
        id: 'Report.OpenViewer',
        category: 'Report',
        description: 'Open the Report Viewer panel.',
        handler: () => activateTabCommand('tab-view', 'viewer-heading', 'Report Viewer')
    },
    {
        action: 'openWorkingView',
        id: 'ReportViews.OpenWorkingView',
        category: 'Report',
        description: 'Open a temporary Working View for the active report.',
        handler: (context) => runOpenWorkingViewWorkflow(context)
    },
    {
        action: 'newWorkingView',
        id: 'ReportViews.NewWorkingView',
        category: 'Report',
        description: 'Create a new Working View for the active report. This reuses the existing Working View workflow.',
        handler: (context) => runOpenWorkingViewWorkflow(context)
    },
    {
        action: 'exitWorkingView',
        id: 'ReportViews.ExitWorkingView',
        category: 'Report',
        description: 'Exit Working View and restore the previous report context.',
        handler: () => exitWorkingViewFromCommand()
    },
    {
        action: 'applyWorkingView',
        id: 'ReportViews.ApplyWorkingView',
        category: 'Report',
        description: 'Apply the current Working View ordering to this report.',
        handler: () => applyWorkingViewFromCommand()
    },
    {
        action: 'saveWorkingView',
        id: 'ReportViews.SaveWorkingView',
        category: 'Report',
        description: 'Save current Working View settings as a preset.',
        handler: () => saveWorkingViewFromCommand()
    },
    {
        action: 'loadWorkingView',
        id: 'ReportViews.LoadWorkingView',
        category: 'Report',
        description: 'Load a Working View preset.',
        handler: (context) => loadWorkingViewForReportFromCommand(context?.reportId || '')
    },
    {
        action: 'deleteWorkingView',
        id: 'ReportViews.DeleteWorkingView',
        category: 'Report',
        description: 'Delete a Working View preset.',
        handler: () => deleteWorkingViewFromCommand()
    },
    {
        action: 'refreshWorkingView',
        id: 'ReportViews.RefreshWorkingView',
        category: 'Report',
        description: 'Refresh Working View results from the latest report data.',
        handler: () => refreshWorkingViewFromCommand()
    },
    {
        action: 'resetWorkingView',
        id: 'ReportViews.ResetWorkingView',
        category: 'Report',
        description: 'Reset Working View configuration to default settings.',
        handler: () => resetWorkingViewFromCommand()
    },
    {
        action: 'batchSetWorkingViewStatus',
        id: 'ReportViews.BatchSetStatus',
        category: 'Report',
        description: 'Batch-set status for currently visible Working View findings.',
        handler: () => batchSetWorkingViewStatusFromCommand()
    },
    {
        action: 'batchAssignWorkingViewReviewer',
        id: 'ReportViews.BatchAssignReviewer',
        category: 'Report',
        description: 'Batch-assign reviewer for currently visible Working View findings.',
        handler: () => batchAssignWorkingViewReviewerFromCommand()
    },
    {
        action: 'batchSetWorkingViewSeverity',
        id: 'ReportViews.BatchSetSeverity',
        category: 'Report',
        description: 'Batch-set severity for currently visible Working View findings.',
        handler: () => batchSetWorkingViewSeverityFromCommand()
    },
    {
        action: 'batchAddWorkingViewTag',
        id: 'ReportViews.BatchAddTag',
        category: 'Report',
        description: 'Batch-add a tag for currently visible Working View findings.',
        handler: () => batchAddWorkingViewTagFromCommand()
    },
    {
        action: 'nextWorkingViewFinding',
        id: 'ReportViews.NextFinding',
        category: 'Report',
        description: 'Move focus to the next finding in Working View.',
        handler: () => nextWorkingViewFindingFromCommand()
    },
    {
        action: 'previousWorkingViewFinding',
        id: 'ReportViews.PreviousFinding',
        category: 'Report',
        description: 'Move focus to the previous finding in Working View.',
        handler: () => previousWorkingViewFindingFromCommand()
    },
    {
        action: 'nextWorkingViewGroup',
        id: 'ReportViews.NextGroup',
        category: 'Report',
        description: 'Move focus to the next group in Working View.',
        handler: () => nextWorkingViewGroupFromCommand()
    },
    {
        action: 'previousWorkingViewGroup',
        id: 'ReportViews.PreviousGroup',
        category: 'Report',
        description: 'Move focus to the previous group in Working View.',
        handler: () => previousWorkingViewGroupFromCommand()
    },
    {
        action: 'revealWorkingViewInExplorer',
        id: 'ReportViews.RevealInExplorer',
        category: 'Report',
        description: 'Reveal the selected Working View finding in Explorer.',
        handler: () => revealWorkingViewInExplorerFromCommand()
    },
    {
        action: 'revealWorkingViewInReport',
        id: 'ReportViews.RevealInReport',
        category: 'Report',
        description: 'Return from Working View to the report editor context.',
        handler: () => revealWorkingViewInReportFromCommand()
    },
    {
        action: 'expandAllWorkingViewGroups',
        id: 'ReportViews.ExpandAllGroups',
        category: 'Report',
        description: 'Expand all group sections in Working View.',
        handler: () => expandAllWorkingViewGroupsFromCommand()
    },
    {
        action: 'collapseAllWorkingViewGroups',
        id: 'ReportViews.CollapseAllGroups',
        category: 'Report',
        description: 'Collapse all group sections in Working View.',
        handler: () => collapseAllWorkingViewGroupsFromCommand()
    },
    {
        action: 'setStandardReportView',
        id: 'ReportViews.SetStandardMode',
        category: 'Report',
        description: 'Use the standard report presentation.',
        handler: () => runSetReportViewModeWorkflow('standard')
    },
    {
        action: 'setWorkingReportView',
        id: 'ReportViews.SetWorkingMode',
        category: 'Report',
        description: 'Use Working View mode.',
        handler: () => runSetReportViewModeWorkflow('working')
    },
    {
        action: 'setOutlineReportView',
        id: 'ReportViews.SetOutlineMode',
        category: 'Report',
        description: 'Use Outline View mode.',
        handler: () => runSetReportViewModeWorkflow('outline')
    },
    {
        action: 'setCompactReportView',
        id: 'ReportViews.SetCompactMode',
        category: 'Report',
        description: 'Use Compact View mode.',
        handler: () => runSetReportViewModeWorkflow('compact')
    },
    {
        action: 'setExpandedReportView',
        id: 'ReportViews.SetExpandedMode',
        category: 'Report',
        description: 'Use Expanded View mode.',
        handler: () => runSetReportViewModeWorkflow('expanded')
    },
    {
        action: 'setReadingReportView',
        id: 'ReportViews.SetReadingMode',
        category: 'Report',
        description: 'Use Reading View mode.',
        handler: () => runSetReportViewModeWorkflow('reading')
    },
    {
        action: 'setReviewReportView',
        id: 'ReportViews.SetReviewMode',
        category: 'Report',
        description: 'Use Review View mode.',
        handler: () => runSetReportViewModeWorkflow('review')
    },
    {
        action: 'setTableReportView',
        id: 'ReportViews.SetTableMode',
        category: 'Report',
        description: 'Use Table View mode.',
        handler: () => runSetReportViewModeWorkflow('table')
    },
    {
        action: 'toggleReportViewMode',
        id: 'ReportViews.ToggleMode',
        category: 'Report',
        description: 'Toggle between Standard View and Working View.',
        handler: () => toggleReportViewModeFromCommand()
    },
    {
        action: 'openProgressLog',
        id: 'Tools.OpenProgressLog',
        category: 'Tools',
        description: 'Open the Progress Log dialog.',
        enabled: () => isProgressLogEnabled(),
        handler: () => Boolean(openProgressLogDialog(document.activeElement || null))
    },
    {
        action: 'focusNavigation',
        id: 'Application.FocusNavigation',
        category: 'Application',
        description: 'Move focus to the navigation tablist.',
        handler: () => focusNavigationRegion()
    },
    {
        action: 'focusDashboard',
        id: 'Application.FocusDashboard',
        category: 'Application',
        description: 'Move focus to the dashboard region.',
        handler: () => focusDashboardRegion()
    },
    {
        action: 'showDashboard',
        id: 'View.ShowDashboard',
        category: 'View',
        description: 'Show the dashboard workspace view.',
        enabled: () => getActiveWorkspaceView() !== 'dashboard',
        handler: () => runShowDashboardWorkflow()
    },
    {
        action: 'showExplorer',
        id: 'View.ShowExplorer',
        category: 'View',
        description: 'Show the explorer workspace view.',
        enabled: () => getActiveWorkspaceView() !== 'explorer',
        handler: () => runShowExplorerWorkflow()
    },
    {
        action: 'toggleWorkspaceView',
        id: 'View.ToggleWorkspaceView',
        category: 'View',
        description: 'Toggle between dashboard and explorer workspace views.',
        handler: () => runToggleWorkspaceViewWorkflow()
    },
    {
        action: 'configureDashboard',
        id: 'Application.ConfigureDashboard',
        category: 'Application',
        description: 'Open the Configure Dashboard dialog.',
        handler: () => openConfigureDashboardFromCommand()
    },
    {
        action: 'focusMainContent',
        id: 'Application.FocusMainContent',
        category: 'Application',
        description: 'Move focus to the main content region.',
        handler: () => focusMainContentArea()
    },
    {
        action: 'focusLookup',
        id: 'Lookup.FocusSearch',
        category: 'Lookup',
        description: 'Move focus to the Accessibility Lookup search input.',
        handler: () => focusLookupRegion()
    },
    {
        action: 'nextLandmark',
        id: 'Application.NextLandmark',
        category: 'Application',
        description: 'Move to the next application landmark.',
        handler: () => navigateApplicationLandmarks(1)
    },
    {
        action: 'previousLandmark',
        id: 'Application.PreviousLandmark',
        category: 'Application',
        description: 'Move to the previous application landmark.',
        handler: () => navigateApplicationLandmarks(-1)
    },
    {
        action: 'addField',
        id: 'Report.AddField',
        category: 'Report',
        description: 'Add or update a report field.',
        handler: () => runAddFieldWorkflow()
    },
    {
        action: 'done',
        id: 'Report.CompleteBuilder',
        category: 'Report',
        description: 'Complete Builder setup and move to the Editor.',
        handler: () => runDoneWorkflow()
    },
    {
        action: 'openPresentationDesigner',
        id: 'Presentation.OpenDesigner',
        category: 'Presentation',
        menuLocation: 'Presentation',
        description: 'Open the Publishing Presentation designer in Report Builder.',
        handler: () => openPresentationDesignerWorkflow('layout', 'presentation-config-heading')
    },
    {
        action: 'presentationApplyDetailedAuditLayout',
        id: 'Presentation.ApplyDetailedAuditLayout',
        category: 'Presentation',
        menuLocation: 'Presentation>Layouts',
        description: 'Apply the Detailed Accessibility Audit report layout.',
        handler: () => applyPresentationLayoutWorkflow('layout-detailed-accessibility-audit')
    },
    {
        action: 'presentationApplyExecutiveLayout',
        id: 'Presentation.ApplyExecutiveLayout',
        category: 'Presentation',
        menuLocation: 'Presentation>Layouts',
        description: 'Apply the Executive Accessibility Report layout.',
        handler: () => applyPresentationLayoutWorkflow('layout-executive-accessibility-report')
    },
    {
        action: 'presentationApplyDefaultTheme',
        id: 'Presentation.ApplyDefaultTheme',
        category: 'Presentation',
        menuLocation: 'Presentation>Themes',
        description: 'Apply the ART Accessible Default report theme.',
        handler: () => applyPresentationThemeWorkflow('theme-art-accessible-default')
    },
    {
        action: 'presentationApplyHighContrastTheme',
        id: 'Presentation.ApplyHighContrastTheme',
        category: 'Presentation',
        menuLocation: 'Presentation>Themes',
        description: 'Apply the High Contrast Professional report theme.',
        handler: () => applyPresentationThemeWorkflow('theme-high-contrast-professional')
    },
    {
        action: 'presentationApplyDefaultBranding',
        id: 'Presentation.ApplyDefaultBranding',
        category: 'Presentation',
        menuLocation: 'Presentation>Branding',
        description: 'Apply the default ART branding resource.',
        handler: () => applyPresentationBrandingWorkflow('branding-art-default')
    },
    {
        action: 'presentationCyclePreviewMode',
        id: 'Presentation.CyclePreviewMode',
        category: 'Presentation',
        menuLocation: 'Presentation>Preview',
        description: 'Cycle the publishing preview between screen, print, PDF, Word, and HTML contexts.',
        handler: () => cyclePresentationPreviewModeWorkflow()
    },
    {
        action: 'presentationValidate',
        id: 'Presentation.Validate',
        category: 'Presentation',
        menuLocation: 'Presentation>Accessibility',
        description: 'Validate the current presentation configuration for accessibility and compatibility.',
        handler: () => validatePresentationWorkflow()
    },
    {
        action: 'addEntry',
        id: 'Report.AddEntry',
        category: 'Report',
        description: 'Add a new audit entry.',
        enabled: () => currentReportSupportsAuditEntries(),
        handler: () => runAddEntryWorkflow()
    },
    {
        action: 'attachFile',
        id: 'Report.AttachFile',
        category: 'Report',
        description: 'Open file picker for the active Attachment field.',
        handler: (context) => runAttachFileWorkflow(context)
    },
    {
        action: 'resetLookup',
        id: 'Lookup.Reset',
        category: 'Lookup',
        description: 'Clear the Accessibility Lookup search and filters.',
        handler: () => resetLookupFromCommand()
    },
    {
        action: 'openProject',
        id: 'File.OpenProject',
        category: 'File',
        description: 'Open an ART project file.',
        handler: () => openDashboardProjectFromCommand()
    },
    {
        action: 'newProjectWorkspace',
        id: 'Workspace.New',
        category: 'Workspace',
        description: 'Create a new Project Workspace.',
        handler: () => createProjectWorkspaceFromCommand()
    },
    {
        action: 'openProjectWorkspace',
        id: 'Workspace.Open',
        category: 'Workspace',
        description: 'Open an existing Project Workspace.',
        handler: () => openProjectWorkspaceFromCommand()
    },
    {
        action: 'openRecentProjectWorkspace',
        id: 'Workspace.OpenRecent',
        category: 'Workspace',
        description: 'Open the most recent Project Workspace from local state.',
        handler: (context) => openRecentProjectWorkspaceFromCommand(context)
    },
    {
        action: 'continueWorking',
        id: 'Workspace.ContinueWorking',
        category: 'Workspace',
        description: 'Restore the most recently used Project Workspace and working context.',
        handler: () => continueWorkingFromCommand()
    },
    {
        action: 'closeProjectWorkspace',
        id: 'Workspace.Close',
        category: 'Workspace',
        description: 'Close the active Project Workspace.',
        handler: () => closeProjectWorkspaceFromCommand()
    },
    {
        action: 'saveProjectWorkspace',
        id: 'Workspace.Save',
        category: 'Workspace',
        description: 'Save the active Project Workspace.',
        handler: () => saveProjectWorkspaceFromCommand()
    },
    {
        action: 'saveProjectWorkspaceAs',
        id: 'Workspace.SaveAs',
        category: 'Workspace',
        description: 'Save the active Project Workspace to a selected location.',
        handler: () => saveProjectWorkspaceAsFromCommand()
    },
    {
        action: 'renameProjectWorkspace',
        id: 'Workspace.Rename',
        category: 'Workspace',
        description: 'Rename the active Project Workspace.',
        handler: () => renameProjectWorkspaceFromCommand()
    },
    {
        action: 'duplicateProjectWorkspace',
        id: 'Workspace.Duplicate',
        category: 'Workspace',
        description: 'Duplicate the active Project Workspace in ART state.',
        handler: () => duplicateProjectWorkspaceFromCommand()
    },
    {
        action: 'importProjectWorkspace',
        id: 'Workspace.Import',
        category: 'Workspace',
        description: 'Import a Project Workspace from folder or project file.',
        handler: () => importProjectWorkspaceFromCommand()
    },
    {
        action: 'exportProjectWorkspace',
        id: 'Workspace.Export',
        category: 'Workspace',
        description: 'Export the active Project Workspace.',
        handler: () => exportProjectWorkspaceFromCommand()
    },
    {
        action: 'deleteProjectWorkspace',
        id: 'Workspace.Delete',
        category: 'Workspace',
        description: 'Delete the active Project Workspace from ART state.',
        handler: () => deleteProjectWorkspaceFromCommand()
    },
    {
        action: 'addProjectAsset',
        id: 'Workspace.AddAsset',
        category: 'Workspace',
        description: 'Add one or more project assets to the active Project Workspace.',
        handler: () => addProjectAssetFromCommand()
    },
    {
        action: 'createAssetFolder',
        id: 'Workspace.CreateAssetFolder',
        category: 'Workspace',
        description: 'Create a custom project asset folder.',
        handler: () => createAssetFolderFromCommand()
    },
    {
        action: 'removeProjectAsset',
        id: 'Workspace.RemoveAsset',
        category: 'Workspace',
        description: 'Remove a project asset from the active workspace.',
        handler: () => removeProjectAssetFromCommand()
    },
    {
        action: 'refreshWorkspaceAssets',
        id: 'Workspace.RefreshAssets',
        category: 'Workspace',
        description: 'Refresh workspace resources and validate project relationships.',
        handler: () => refreshWorkspaceAssetsFromCommand()
    },
    {
        action: 'openProjectProperties',
        id: 'Workspace.Properties',
        category: 'Workspace',
        description: 'Open Project Properties.',
        handler: () => openProjectPropertiesFromCommand()
    },
    {
        action: 'openProjectStatistics',
        id: 'Workspace.Statistics',
        category: 'Workspace',
        description: 'Open project statistics and health summary.',
        handler: () => openProjectStatisticsFromCommand()
    },
    {
        action: 'openWorkspaceSettings',
        id: 'Workspace.Settings',
        category: 'Workspace',
        description: 'Open workspace settings.',
        handler: () => openWorkspaceSettingsFromCommand()
    },
    {
        action: 'openResourceRelationships',
        id: 'Workspace.ResourceRelationships',
        category: 'Workspace',
        description: 'Open relationship details for the selected workspace resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => openResourceRelationshipsFromCommand(context)
    },
    {
        action: 'openResourceDependents',
        id: 'Workspace.ResourceDependents',
        category: 'Workspace',
        description: 'Show dependent resources for the selected workspace resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => openResourceDependentsFromCommand(context)
    },
    {
        action: 'openResourceReferences',
        id: 'Workspace.ResourceReferences',
        category: 'Workspace',
        description: 'Show references and outbound relationships for the selected workspace resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => openResourceReferencesFromCommand(context)
    },
    {
        action: 'previewResourceDeletionImpact',
        id: 'Workspace.ResourceDeletionImpact',
        category: 'Workspace',
        description: 'Preview the deletion impact for the selected workspace resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => previewResourceDeletionImpactFromCommand(context)
    },
    {
        action: 'repairWorkspaceRelationships',
        id: 'Workspace.RepairRelationships',
        category: 'Workspace',
        description: 'Repair invalid workspace relationships and remove broken references.',
        handler: (context) => repairWorkspaceRelationshipsFromCommand(context?.triggerElement || context?.anchorElement || null)
    },
    {
        action: 'openTagManager',
        id: 'Organization.OpenTagManager',
        category: 'Workspace',
        description: 'Open Tag Manager to browse, search, and review tag usage.',
        handler: (context) => openTagManagerFromCommand(context)
    },
    {
        action: 'createTag',
        id: 'Organization.CreateTag',
        category: 'Workspace',
        description: 'Create a new resource tag.',
        handler: () => createTagFromCommand()
    },
    {
        action: 'assignTagToSelectedResource',
        id: 'Organization.AssignTagToSelectedResource',
        category: 'Workspace',
        description: 'Assign an existing tag to the selected resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => assignTagToSelectedResourceFromCommand(context)
    },
    {
        action: 'removeTagFromSelectedResource',
        id: 'Organization.RemoveTagFromSelectedResource',
        category: 'Workspace',
        description: 'Remove a tag assignment from the selected resource.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => removeTagFromSelectedResourceFromCommand(context)
    },
    {
        action: 'mergeTags',
        id: 'Organization.MergeTags',
        category: 'Workspace',
        description: 'Merge one tag into another and transfer assignments.',
        handler: () => mergeTagsFromCommand()
    },
    {
        action: 'openCollectionManager',
        id: 'Organization.OpenCollectionManager',
        category: 'Workspace',
        description: 'Open Collection Manager to browse and manage collections.',
        handler: (context) => openCollectionManagerFromCommand(context)
    },
    {
        action: 'createCollection',
        id: 'Organization.CreateCollection',
        category: 'Workspace',
        description: 'Create a new collection of resource references.',
        handler: () => createCollectionFromCommand()
    },
    {
        action: 'addSelectedResourceToCollection',
        id: 'Organization.AddSelectedResourceToCollection',
        category: 'Workspace',
        description: 'Add the selected resource to a collection.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => addSelectedResourceToCollectionFromCommand(context)
    },
    {
        action: 'removeSelectedResourceFromCollection',
        id: 'Organization.RemoveSelectedResourceFromCollection',
        category: 'Workspace',
        description: 'Remove the selected resource from a collection.',
        visible: (context) => hasWorkspaceResourceTarget(context),
        handler: (context) => removeSelectedResourceFromCollectionFromCommand(context)
    },
    {
        action: 'openSavedViewManager',
        id: 'Organization.OpenSavedViewManager',
        category: 'Workspace',
        description: 'Open Saved View Manager for persistent Working View configurations.',
        handler: (context) => openSavedViewManagerFromCommand(context)
    },
    {
        action: 'createSavedViewFromCurrentWorkingView',
        id: 'Organization.CreateSavedViewFromCurrentWorkingView',
        category: 'Report',
        description: 'Create a Saved View from the active Working View configuration.',
        handler: () => createSavedViewFromCurrentWorkingViewFromCommand()
    },
    {
        action: 'openSavedView',
        id: 'Organization.OpenSavedView',
        category: 'Report',
        description: 'Open a Saved View and recreate its temporary Working View.',
        handler: (context) => openSavedViewFromCommand(context)
    },
    {
        action: 'deleteSavedView',
        id: 'Organization.DeleteSavedView',
        category: 'Report',
        description: 'Delete a Saved View definition.',
        handler: (context) => deleteSavedViewFromCommand(context)
    },
    {
        action: 'exportResourceOrganizationMetadata',
        id: 'Organization.ExportMetadata',
        category: 'Workspace',
        description: 'Export tags, collections, and saved view metadata.',
        handler: () => exportResourceOrganizationMetadataFromCommand()
    },
    {
        action: 'importResourceOrganizationMetadata',
        id: 'Organization.ImportMetadata',
        category: 'Workspace',
        description: 'Import tags, collections, and saved view metadata.',
        handler: () => importResourceOrganizationMetadataFromCommand()
    },
    {
        action: 'toggleTagFavorite',
        id: 'Organization.ToggleTagFavorite',
        category: 'Workspace',
        description: 'Toggle favorite status for the selected tag.',
        handler: (context) => runToggleFavoriteWorkflow('tag', context)
    },
    {
        action: 'toggleCollectionFavorite',
        id: 'Organization.ToggleCollectionFavorite',
        category: 'Workspace',
        description: 'Toggle favorite status for the selected collection.',
        handler: (context) => runToggleFavoriteWorkflow('collection', context)
    },
    {
        action: 'toggleSavedViewFavorite',
        id: 'Organization.ToggleSavedViewFavorite',
        category: 'Workspace',
        description: 'Toggle favorite status for the selected Saved View.',
        handler: (context) => runToggleFavoriteWorkflow('saved-view', context)
    },
    {
        action: 'saveProject',
        id: 'File.SaveProject',
        category: 'File',
        description: 'Save the current ART project.',
        enabled: () => hasUnsavedProjectChanges(),
        handler: () => saveDashboardProjectFromCommand()
    },
    {
        action: 'saveProjectAs',
        id: 'File.SaveProjectAs',
        category: 'File',
        description: 'Save the current ART project under a new name.',
        handler: () => saveDashboardProjectAsFromCommand()
    },
    {
        action: 'importData',
        id: 'File.ImportData',
        category: 'File',
        description: 'Import data into ART.',
        handler: (context) => runImportReportWorkflow(context)
    },
    {
        action: 'openReport',
        id: 'File.OpenReport',
        category: 'File',
        description: 'Open or import a report file.',
        handler: (context) => runImportReportWorkflow(context)
    },
    {
        action: 'exportReport',
        id: 'Report.Export',
        category: 'Report',
        description: 'Open the report export workflow.',
        handler: () => runExportWorkflow()
    },
    {
        action: 'printPreview',
        id: 'Report.PrintPreview',
        category: 'Report',
        description: 'Open print preview for the current report.',
        handler: () => runPrintPreviewWorkflow()
    },
    {
        action: 'newReport',
        id: 'File.NewReport',
        category: 'File',
        description: 'Create a new report.',
        handler: () => runNewReportWorkflow()
    },
    {
        action: 'newReportFromTemplate',
        id: 'File.NewReportFromTemplate',
        category: 'File',
        description: 'Create a new report from a template.',
        handler: () => runNewReportFromTemplateWorkflow()
    },
    {
        action: 'closeReport',
        id: 'Report.Close',
        category: 'Report',
        description: 'Close the active report session.',
        enabled: () => canCloseActiveSession(),
        handler: () => runCloseReportWorkflow()
    },
    {
        action: 'closeWorkingView',
        id: 'ReportViews.CloseWorkingView',
        category: 'Report',
        description: 'Close the active Working View session.',
        enabled: () => canCloseWorkingViewFromCommand(),
        handler: () => runCloseWorkingViewWorkflow()
    },
    {
        action: 'configureReport',
        id: 'Report.Configure',
        category: 'Report',
        description: 'Open the current report configuration.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runConfigureReportWorkflow(context)
    },
    {
        action: 'renameReport',
        id: 'Report.Rename',
        category: 'Report',
        description: 'Rename the selected report.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runRenameReportWorkflow(context)
    },
    {
        action: 'replaceReport',
        id: 'Report.Replace',
        category: 'Report',
        description: 'Replace the selected report with another report and update workspace references.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runReplaceReportWorkflow(context)
    },
    {
        action: 'editReport',
        id: 'Report.Edit',
        category: 'Report',
        description: 'Edit the selected report.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runEditReportWorkflow(context)
    },
    {
        action: 'viewReport',
        id: 'Report.View',
        category: 'Report',
        description: 'View the selected report.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runViewReportWorkflow(context)
    },
    {
        action: 'deleteReport',
        id: 'Report.Delete',
        category: 'Report',
        description: 'Delete the selected report.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runDeleteReportWorkflow(context)
    },
    {
        action: 'newTemplate',
        id: 'Template.New',
        category: 'Template',
        description: 'Create a new template from the current report.',
        handler: (context) => runCreateTemplateWorkflow(context)
    },
    {
        action: 'useTemplate',
        id: 'Template.Use',
        category: 'Template',
        description: 'Use the selected template to configure a report.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runUseTemplateWorkflow(context)
    },
    {
        action: 'openTemplate',
        id: 'Template.Open',
        category: 'Template',
        description: 'Open the selected template for viewing.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runOpenTemplateWorkflow(context)
    },
    {
        action: 'renameTemplate',
        id: 'Template.Rename',
        category: 'Template',
        description: 'Rename the selected template.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runRenameTemplateWorkflow(context)
    },
    {
        action: 'replaceTemplate',
        id: 'Template.Replace',
        category: 'Template',
        description: 'Replace the selected template and update references.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runReplaceTemplateWorkflow(context)
    },
    {
        action: 'editTemplate',
        id: 'Template.Edit',
        category: 'Template',
        description: 'Edit the selected template.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runEditTemplateWorkflow(context)
    },
    {
        action: 'deleteTemplate',
        id: 'Template.Delete',
        category: 'Template',
        description: 'Delete the selected template.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runDeleteTemplateWorkflow(context)
    },
    {
        action: 'importTemplate',
        id: 'Template.Import',
        category: 'Template',
        description: 'Import a template file.',
        handler: (context) => runImportTemplateWorkflow(context)
    },
    {
        action: 'exportTemplate',
        id: 'Template.Export',
        category: 'Template',
        description: 'Export the current template.',
        enabled: () => Boolean(getTemplateById(getSelectedTemplateId())),
        handler: (context) => runExportTemplateWorkflow(context)
    },
    {
        action: 'openSettings',
        id: 'Settings.Open',
        category: 'Settings',
        description: 'Open Application Settings.',
        handler: () => openSettingsDialogFromCommand()
    },
    {
        action: 'settingsClose',
        id: 'Settings.Close',
        category: 'Settings',
        description: 'Close Application Settings.',
        handler: () => closeSettingsDialogFromCommand()
    },
    {
        action: 'settingsRestoreShortcuts',
        id: 'Settings.RestoreShortcuts',
        category: 'Settings',
        description: 'Restore the default keyboard shortcuts.',
        handler: () => restoreSettingsShortcutsFromCommand()
    },
    {
        action: 'settingsImportStandard',
        id: 'Settings.ImportStandard',
        category: 'Settings',
        description: 'Import an accessibility standard.',
        handler: () => startSettingsImportStandardFromCommand()
    },
    {
        action: 'settingsPasteStandardTable',
        id: 'Settings.PasteStandardTable',
        category: 'Settings',
        description: 'Paste accessibility standards from a table.',
        handler: () => openSettingsPasteStandardTableFromCommand()
    },
    {
        action: 'settingsImportReportFile',
        id: 'Settings.ImportReportFile',
        category: 'Settings',
        description: 'Import a report file from the device.',
        handler: () => startSettingsImportReportFileFromCommand()
    },
    {
        action: 'settingsImportTemplateFile',
        id: 'Settings.ImportTemplateFile',
        category: 'Settings',
        description: 'Import a template file from the device.',
        handler: () => startSettingsImportTemplateFileFromCommand()
    },
    {
        action: 'settingsOpenIntegrations',
        id: 'Settings.OpenIntegrations',
        category: 'Settings',
        description: 'Open the Integrations section in Settings.',
        handler: () => openSettingsIntegrationsSectionFromCommand()
    },
    {
        action: 'settingsCustomizeAnalytics',
        id: 'Settings.CustomizeAnalytics',
        category: 'Settings',
        description: 'Open the Analytics section in Settings.',
        handler: () => openSettingsAnalyticsSectionFromCommand()
    },
    {
        action: 'settingsCustomizeCollaboration',
        id: 'Settings.CustomizeCollaboration',
        category: 'Settings',
        description: 'Open the Collaboration section in Settings.',
        menuLocation: 'Collaboration',
        handler: () => openSettingsCollaborationSectionFromCommand()
    },
    {
        action: 'toggleCollaboration',
        id: 'Collaboration.Toggle',
        category: 'Collaboration',
        description: 'Enable or disable Collaboration.',
        menuLocation: 'Collaboration',
        handler: () => {
            const collaboration = getCollaborationConfig();
            updateCollaborationConfig({
                enabled: !collaboration.enabled,
                showToolbar: !collaboration.enabled ? true : collaboration.showToolbar
            }, {
                action: collaboration.enabled ? 'Disabled collaboration' : 'Enabled collaboration'
            });
            return true;
        }
    },
    {
        action: 'toggleCollaborationToolbar',
        id: 'Collaboration.ToggleToolbar',
        category: 'Collaboration',
        description: 'Show or hide the Collaboration toolbar.',
        menuLocation: 'Collaboration',
        handler: () => {
            const collaboration = getCollaborationConfig();
            updateCollaborationConfig({
                showToolbar: !collaboration.showToolbar,
                enabled: collaboration.showToolbar ? collaboration.enabled : true
            }, {
                action: collaboration.showToolbar ? 'Hid collaboration toolbar' : 'Showed collaboration toolbar'
            });
            return true;
        }
    },
    {
        action: 'settingsCollaborationApplySoloDefaults',
        id: 'Collaboration.ApplySoloDefaults',
        category: 'Collaboration',
        description: 'Apply Solo collaboration defaults.',
        menuLocation: 'Collaboration',
        handler: () => applySoloCollaborationPresetFromCommand()
    },
    {
        action: 'settingsCollaborationApplyTeamDefaults',
        id: 'Collaboration.ApplyTeamDefaults',
        category: 'Collaboration',
        description: 'Apply Team collaboration defaults.',
        menuLocation: 'Collaboration',
        handler: () => applyTeamCollaborationPresetFromCommand()
    },
    {
        action: 'settingsCollaborationResetBaseline',
        id: 'Collaboration.ResetBaseline',
        category: 'Collaboration',
        description: 'Reset collaboration to the closest baseline and clear transient operational data.',
        menuLocation: 'Collaboration',
        handler: () => resetCollaborationBaselineFromCommand()
    },
    {
        action: 'settingsCollaborationRecordSyncCheckpoint',
        id: 'Collaboration.RecordSyncCheckpoint',
        category: 'Collaboration',
        description: 'Record a collaboration synchronization checkpoint timestamp.',
        menuLocation: 'Collaboration',
        handler: () => recordCollaborationSyncCheckpointFromCommand()
    },
    {
        action: 'settingsCollaborationGenerateDiscoverySnapshot',
        id: 'Collaboration.GenerateDiscoverySnapshot',
        category: 'Collaboration',
        description: 'Generate a collaboration discovery snapshot for the active workspace.',
        menuLocation: 'Collaboration',
        handler: () => generateCollaborationDiscoverySnapshotFromCommand()
    },
    {
        action: 'settingsCollaborationQueueTestConflict',
        id: 'Collaboration.QueueTestConflict',
        category: 'Collaboration',
        description: 'Queue a synthetic collaboration conflict for validation.',
        menuLocation: 'Collaboration',
        handler: () => queueCollaborationTestConflictFromCommand()
    },
    {
        action: 'settingsCollaborationResolveOldestConflict',
        id: 'Collaboration.ResolveOldestConflict',
        category: 'Collaboration',
        description: 'Resolve the oldest pending collaboration conflict using current strategy.',
        menuLocation: 'Collaboration',
        handler: () => resolveOldestCollaborationConflictFromCommand()
    },
    {
        action: 'settingsCollaborationRegisterPresenceSession',
        id: 'Collaboration.RegisterPresenceSession',
        category: 'Collaboration',
        description: 'Register a collaboration presence session for the active workspace.',
        menuLocation: 'Collaboration',
        handler: () => registerCollaborationPresenceSessionFromCommand()
    },
    {
        action: 'settingsCollaborationClearSessions',
        id: 'Collaboration.ClearSessions',
        category: 'Collaboration',
        description: 'Clear collaboration presence sessions.',
        menuLocation: 'Collaboration',
        handler: () => clearCollaborationSessionsFromCommand()
    },
    {
        action: 'settingsCollaborationLiveQuickStart',
        id: 'Collaboration.LiveQuickStart',
        category: 'Collaboration',
        description: 'Connect to live server and start a live collaboration session in one step.',
        menuLocation: 'Collaboration',
        handler: () => quickStartLiveCollaborationFromCommand()
    },
    {
        action: 'settingsCollaborationLiveConnect',
        id: 'Collaboration.LiveConnect',
        category: 'Collaboration',
        description: 'Connect to the configured live collaboration server.',
        menuLocation: 'Collaboration',
        handler: () => connectLiveCollaborationFromCommand()
    },
    {
        action: 'settingsCollaborationLiveDisconnect',
        id: 'Collaboration.LiveDisconnect',
        category: 'Collaboration',
        description: 'Disconnect from the live collaboration server.',
        menuLocation: 'Collaboration',
        handler: () => disconnectLiveCollaborationFromCommand()
    },
    {
        action: 'settingsCollaborationLiveStartSession',
        id: 'Collaboration.LiveStartSession',
        category: 'Collaboration',
        description: 'Start a live collaboration session for the active workspace.',
        menuLocation: 'Collaboration',
        handler: () => startLiveCollaborationSessionFromCommand()
    },
    {
        action: 'settingsCollaborationPublishAsyncSnapshot',
        id: 'Collaboration.PublishAsyncSnapshot',
        category: 'Collaboration',
        description: 'Publish collaboration metadata snapshot for asynchronous shared-folder workflows.',
        menuLocation: 'Collaboration',
        handler: () => publishAsyncCollaborationSnapshotFromCommand()
    },
    {
        action: 'settingsCollaborationPullAsyncSnapshot',
        id: 'Collaboration.PullAsyncSnapshot',
        category: 'Collaboration',
        description: 'Pull and apply collaboration metadata snapshot from asynchronous shared storage.',
        menuLocation: 'Collaboration',
        handler: () => pullAsyncCollaborationSnapshotFromCommand()
    },
    {
        action: 'settingsPluginInstall',
        id: 'Settings.PluginInstall',
        category: 'Settings',
        description: 'Install a plugin manifest in Plugin and Package Manager.',
        handler: () => startSettingsPluginInstallFromCommand()
    },
    {
        action: 'settingsPluginValidate',
        id: 'Settings.PluginValidate',
        category: 'Settings',
        description: 'Validate registered plugin and package extensions.',
        handler: () => validateSettingsPluginExtensionsFromCommand()
    },
    {
        action: 'settingsPluginRefresh',
        id: 'Settings.PluginRefresh',
        category: 'Settings',
        description: 'Refresh plugin and package manager lists.',
        handler: () => refreshSettingsPluginManagerFromCommand()
    },
    {
        action: 'settingsPluginExportConfig',
        id: 'Settings.PluginExportConfig',
        category: 'Settings',
        description: 'Export plugin framework configuration.',
        handler: () => exportSettingsPluginFrameworkConfigFromCommand()
    },
    {
        action: 'settingsPluginImportConfig',
        id: 'Settings.PluginImportConfig',
        category: 'Settings',
        description: 'Import plugin framework configuration.',
        handler: () => importSettingsPluginFrameworkConfigFromCommand()
    },
    {
        action: 'settingsTogglePrivacyMode',
        id: 'Settings.TogglePrivacyMode',
        category: 'Settings',
        description: 'Toggle Privacy Mode.',
        handler: () => toggleSettingsPrivacyModeFromCommand()
    },
    {
        action: 'settingsCreateBackup',
        id: 'Settings.CreateBackup',
        category: 'Settings',
        description: 'Create a backup of ART data.',
        handler: () => createSettingsBackupFromCommand()
    },
    {
        action: 'settingsResetApp',
        id: 'Settings.ResetApp',
        category: 'Settings',
        description: 'Reset ART application data.',
        handler: () => openSettingsResetDialogFromCommand()
    },
    {
        action: 'settingsCloseReport',
        id: 'Settings.CloseReport',
        category: 'Settings',
        description: 'Close the current report from Settings.',
        enabled: () => canCloseActiveSession(),
        handler: () => runCloseReportWorkflow()
    },
    {
        action: 'editSelectAll',
        id: 'Tools.EditSelectAll',
        category: 'Edit',
        description: 'Select all content in the current editable region when available.',
        handler: (context) => selectAllContent(context)
    },
    {
        action: 'editCopy',
        id: 'Tools.EditCopy',
        category: 'Edit',
        description: 'Copy the current selection when available.',
        enabled: (context) => hasSelectedText(context) || hasEditableSelection(getEditableTargetFromContext(context)),
        handler: () => executeClipboardCommand('copy')
    },
    {
        action: 'editCut',
        id: 'Tools.EditCut',
        category: 'Edit',
        description: 'Cut the current editable selection when available.',
        enabled: (context) => hasEditableSelection(getEditableTargetFromContext(context)),
        handler: () => executeClipboardCommand('cut')
    },
    {
        action: 'editPaste',
        id: 'Tools.EditPaste',
        category: 'Edit',
        description: 'Paste clipboard content into the current editable target when available.',
        enabled: (context) => Boolean(getEditableTargetFromContext(context)),
        handler: () => executeClipboardCommand('paste')
    },
    {
        action: 'copyEntry',
        id: 'Tools.CopyEntry',
        category: 'Tools',
        description: 'Copy the current entry.',
        handler: () => runLookupCopyWorkflow('copyEntry')
    },
    {
        action: 'copyName',
        id: 'Tools.CopyName',
        category: 'Tools',
        description: 'Copy the current name.',
        handler: () => runLookupCopyWorkflow('copyName')
    },
    {
        action: 'copyDescription',
        id: 'Tools.CopyDescription',
        category: 'Tools',
        description: 'Copy the current description.',
        handler: () => runLookupCopyWorkflow('copyDescription')
    },
    {
        action: 'copyFailures',
        id: 'Tools.CopyFailures',
        category: 'Tools',
        description: 'Copy failures text.',
        handler: () => runLookupCopyWorkflow('copyFailures')
    },
    {
        action: 'copyFixes',
        id: 'Tools.CopyFixes',
        category: 'Tools',
        description: 'Copy fixes text.',
        handler: () => runLookupCopyWorkflow('copyFixes')
    },
    {
        action: 'copyLink',
        id: 'Tools.CopyLink',
        category: 'Tools',
        description: 'Copy references or links.',
        handler: () => runLookupCopyWorkflow('copyLink')
    },
    {
        action: 'spellCheck',
        id: 'Tools.SpellCheck',
        category: 'Tools',
        description: 'Run spell checking for the current text.',
        handler: () => runSpellCheckWorkflow()
    },
    {
        action: 'validateReport',
        id: 'Report.Validate',
        category: 'Report',
        description: 'Validate the current report and show validation issues.',
        handler: (context) => runValidateReportWorkflow(context)
    },
    {
        action: 'reportStatistics',
        id: 'Report.Statistics',
        category: 'Report',
        description: 'Open report statistics for the current report.',
        handler: (context) => runReportStatisticsWorkflow(context)
    },
    {
        action: 'spellReplace',
        id: 'Tools.SpellReplace',
        category: 'Tools',
        description: 'Replace the selected misspelling.',
        handler: () => executeSpellDialogActionFromCommand('replace')
    },
    {
        action: 'spellReplaceAll',
        id: 'Tools.SpellReplaceAll',
        category: 'Tools',
        description: 'Replace all occurrences of the selected misspelling.',
        handler: () => executeSpellDialogActionFromCommand('replaceAll')
    },
    {
        action: 'spellIgnore',
        id: 'Tools.SpellIgnore',
        category: 'Tools',
        description: 'Ignore the selected misspelling.',
        handler: () => executeSpellDialogActionFromCommand('ignore')
    },
    {
        action: 'spellIgnoreAll',
        id: 'Tools.SpellIgnoreAll',
        category: 'Tools',
        description: 'Ignore all occurrences of the selected misspelling.',
        handler: () => executeSpellDialogActionFromCommand('ignoreAll')
    },
    {
        action: 'spellAddToDictionary',
        id: 'Tools.SpellAddToDictionary',
        category: 'Tools',
        description: 'Add a word to the spell dictionary.',
        handler: () => executeSpellDialogActionFromCommand('addDictionary')
    },
    {
        action: 'spellUndoLastCorrection',
        id: 'Tools.SpellUndoLastCorrection',
        category: 'Tools',
        description: 'Undo the last spell correction.',
        handler: () => executeSpellDialogActionFromCommand('undo')
    },
    {
        action: 'spellCancel',
        id: 'Tools.SpellCancel',
        category: 'Tools',
        description: 'Cancel spell checking.',
        handler: () => executeSpellDialogActionFromCommand('cancel')
    }
];

const COMMAND_DEFINITIONS = [
    ...BASE_COMMAND_DEFINITIONS,
    ...buildTopLevelMenuShortcutCommandDefinitions(BASE_COMMAND_DEFINITIONS)
];

function buildCommandDefinition(definition) {
    const baseDisplayName = labelByAction.get(definition.action) || definition.action;
    const undoDescription = definition.action === 'undo' ? String(getUndoStateDescription() || '').trim() : '';
    const redoDescription = definition.action === 'redo' ? String(getRedoStateDescription() || '').trim() : '';
    const displayName = definition.action === 'undo' && undoDescription
        ? `Undo ${undoDescription}`
        : definition.action === 'redo' && redoDescription
            ? `Redo ${redoDescription}`
            : baseDisplayName;
    const keyboardShortcut = shortcutByAction.get(definition.action) || '';
    const menuLocation = definition.menuLocation || getDefaultMenuLocation(definition.action, definition.category);

    return {
        action: definition.action,
        id: definition.id,
        displayName,
        description: definition.description,
        category: definition.category,
        handler: definition.handler || null,
        enabled: definition.enabled || (() => true),
        visible: definition.visible || (() => true),
        keyboardShortcut,
        helpTopic: definition.helpTopic || '',
        menuLocation,
        commandPaletteVisible: definition.commandPaletteVisible !== false,
        contextMenuVisible: definition.contextMenuVisible !== false,
        notes: definition.notes || ''
    };
}

export function registerApplicationCommands(registry = commandRegistry) {
    if (commandsRegistered) return registry;
    try {
        const definitions = COMMAND_DEFINITIONS.map(buildCommandDefinition);
        definitions.forEach((definition) => {
            try {
                registry.registerCommand(definition);
            } catch (error) {
                if (error?.code === 'duplicate-keyboard-shortcut-registration') {
                    const conflictingCommandId = String(error?.details?.existingCommandId || '').trim();
                    console.warn(
                        `[ART commands] Shortcut conflict for ${definition.id} (${definition.keyboardShortcut}) with ${conflictingCommandId || 'existing command'}. Registering command without shortcut.`
                    );
                    registry.registerCommand({
                        ...definition,
                        keyboardShortcut: ''
                    });
                    return;
                }
                throw error;
            }
        });

        commandsRegistered = true;
    } catch (error) {
        console.error('[ART commands] Application command registration failed.', error);
    }
    return registry;
}

export function getApplicationCommandDefinitions() {
    return COMMAND_DEFINITIONS.map(buildCommandDefinition);
}
