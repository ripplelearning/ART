import { commandRegistry } from './commandRegistry.js';
import {
    announce,
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
    getShortcutDefinitions,
    hasUnsavedProjectChanges,
    importReportWithConflictStrategy,
    importTemplateWithConflictStrategy,
    isProgressLogEnabled,
    loadReportById,
    loadTemplate,
    resetReportToBlank,
    saveState,
    serializeArtxTemplatePayload,
} from './state.js';
import { openHelpDialog } from './help.js';
import {
    closeSettingsDialogFromCommand,
    createSettingsBackupFromCommand,
    openSettingsPasteStandardTableFromCommand,
    openSettingsResetDialogFromCommand,
    openSettingsDialogFromCommand,
    restoreSettingsShortcutsFromCommand,
    startSettingsImportReportFileFromCommand,
    startSettingsImportStandardFromCommand,
    startSettingsImportTemplateFileFromCommand,
    toggleSettingsPrivacyModeFromCommand
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
    executeSpellDialogActionFromCommand,
    startSpellCheckFromCommand,
    openEditorStatisticsDialog,
    openEditorValidationDialog
} from './reportEditor.js';
import { openProgressLogDialog } from './progressLog.js';
import { requestViewerExportDialog, requestViewerPrintPreview, renderViewer } from './reportViewer.js';
import { executeLookupCopyActionFromCommand, resetLookupFromCommand } from './lookupTool.js';
import { executeAddFieldFromCommand, executeDoneFromCommand } from './reportBuilder.js';
import {
    openDashboardProjectFromCommand,
    saveDashboardProjectAsFromCommand,
    saveDashboardProjectFromCommand,
    startDashboardImportReportFromCommand,
    startDashboardImportTemplateFromCommand
} from './dashboard.js';

let commandsRegistered = false;

const shortcutByAction = new Map(getShortcutDefinitions().map((definition) => [definition.action, definition.shortcut]));
const labelByAction = new Map(getAssignableActions().map((item) => [item.action, item.label]));

function clickElementById(id) {
    const element = document.getElementById(id);
    if (!element || typeof element.click !== 'function') return false;
    element.click();
    return true;
}

function runLookupCopyWorkflow(action) {
    return executeLookupCopyActionFromCommand(action);
}

function getFirstTemplateOption() {
    const templateSelect = document.getElementById('template-selection');
    if (!templateSelect) return null;
    return [...templateSelect.options].find((option) => option.value && option.value !== 'scratch') || null;
}

function runAddFieldWorkflow() {
    clickElementById('tab-builder');
    if (!document.getElementById('btn-add-field')) {
        document.getElementById('btn-toggle-config')?.click();
    }
    return executeAddFieldFromCommand();
}

function runDoneWorkflow() {
    clickElementById('tab-builder');
    return executeDoneFromCommand();
}

function runAddEntryWorkflow() {
    if (!activateAddEntryWorkflow()) return false;
    appState.editorReadOnly = false;
    saveState({ action: 'Opened add entry workflow', recordHistory: false });
    clickElementById('tab-editor');
    return true;
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

function runValidateReportWorkflow(context = {}) {
    clickElementById('tab-editor');
    const triggerButton = context.triggerButton || document.getElementById('btn-editor-validate-report') || document.activeElement;
    return openEditorValidationDialog(triggerButton);
}

function runReportStatisticsWorkflow(context = {}) {
    clickElementById('tab-editor');
    const triggerButton = context.triggerButton || document.getElementById('btn-editor-report-statistics') || document.activeElement;
    return openEditorStatisticsDialog(triggerButton);
}

function runNewReportFromTemplateWorkflow() {
    const firstTemplate = getFirstTemplateOption();
    const templateSelect = document.getElementById('template-selection');
    if (templateSelect && firstTemplate) {
        templateSelect.value = firstTemplate.value;
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return runUseTemplateWorkflow({ templateId: firstTemplate?.value || '' });
}

function focusIntegrationsSection() {
    if (!openSettingsDialogFromCommand()) return false;
    window.setTimeout(() => {
        const integrationsHeading = document.getElementById('settings-integrations-heading');
        if (!integrationsHeading) return;
        integrationsHeading.scrollIntoView({ block: 'start' });
        if (!integrationsHeading.hasAttribute('tabindex')) integrationsHeading.setAttribute('tabindex', '-1');
        integrationsHeading.focus();
    }, 0);
    return true;
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

function runDeleteTemplateWorkflow(context = {}) {
    const templateId = getSelectedTemplateId(context);
    if (!templateId || context.confirm !== true) return false;

    const deleted = deleteUserTemplate(templateId);
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

    announce(`${deleted.name} template deleted`);
    return true;
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

function runDeleteReportWorkflow(context = {}) {
    const reportId = getSelectedReportId(context);
    const report = reportId ? getReportById(reportId) : null;
    if (!report) return false;

    const dialog = document.getElementById('report-delete-dialog');
    const message = document.getElementById('report-delete-message');
    const confirmButton = document.getElementById('btn-report-delete-confirm');
    const recentReportsSelect = document.getElementById('recent-reports-select');

    if (context.confirm === true) {
        const removed = deleteReportById(reportId);
        if (!removed) return false;

        if (dialog) dialog.hidden = true;
        if (confirmButton) confirmButton.removeAttribute('data-report-id');
        announce(`Deleted report ${removed.name}`);
        window.setTimeout(() => {
            recentReportsSelect?.focus();
        }, 0);
        return true;
    }

    if (!dialog || !message || !confirmButton) return false;

    message.innerHTML = `Are you sure you want to delete <strong>${report.name}</strong>?<br>This action cannot be undone.`;
    confirmButton.setAttribute('data-report-id', reportId);
    dialog.hidden = false;
    window.setTimeout(() => confirmButton.focus(), 0);
    return true;
}

const COMMAND_DEFINITIONS = [
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
        handler: () => openHelpDialog(null)
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
        action: 'addEntry',
        id: 'Report.AddEntry',
        category: 'Report',
        description: 'Add a new audit entry.',
        enabled: () => currentReportSupportsAuditEntries(),
        handler: () => runAddEntryWorkflow()
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
        action: 'configureReport',
        id: 'Report.Configure',
        category: 'Report',
        description: 'Open the current report configuration.',
        enabled: () => Boolean(getReportById(getSelectedReportId())),
        handler: (context) => runConfigureReportWorkflow(context)
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
        handler: () => focusIntegrationsSection()
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

function buildCommandDefinition(definition) {
    const displayName = labelByAction.get(definition.action) || definition.action;
    const keyboardShortcut = shortcutByAction.get(definition.action) || '';

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
        menuLocation: definition.menuLocation || definition.category,
        commandPaletteVisible: definition.commandPaletteVisible !== false,
        contextMenuVisible: Boolean(definition.contextMenuVisible),
        notes: definition.notes || ''
    };
}

export function registerApplicationCommands(registry = commandRegistry) {
    if (commandsRegistered) return registry;

    registry.registerCommands(COMMAND_DEFINITIONS.map(buildCommandDefinition));

    commandsRegistered = true;
    return registry;
}

export function getApplicationCommandDefinitions() {
    return COMMAND_DEFINITIONS.map(buildCommandDefinition);
}
