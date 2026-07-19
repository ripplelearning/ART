// dashboard.js

import {
    addAuditEntry,
    announce,
    appState,
    createArtProjectPayload,
    createUserTemplateFromSelection,
    closeCurrentReportSession,
    clearProjectRecoveryMark,
    computeReportMetrics,
    deleteUserTemplate,
    deleteReportById,
    getAuditEntries,
    getBuiltInTemplates,
    getGoogleWorkspaceConfig,
    getProjectDocumentInfo,
    getRecentProjectFiles,
    getRecentReports,
    getReportById,
    getSecurityConfig,
    getTemplateById,
    getUserTemplates,
    hasUnsavedProjectChanges,
    importArtProjectPayload,
    importReportWithConflictStrategy,
    importTemplateWithConflictStrategy,
    importArtJsonPayload,
    loadReportById,
    loadTemplate,
    markProjectRecovered,
    reportNameExists,
    resetReportToBlank,
    saveState,
    serializeArtProjectPayload,
    serializeArtxTemplatePayload,
    templateNameExists,
    upsertCurrentReport,
    updateProjectDocumentInfo,
    validateArtProjectPayload,
    validateArtJsonPayload,
    validateArtxTemplatePayload,
    validateTemplateJsonPayload
} from './state.js';

function moveFocusToBuilderMetadataHeading() {
    const metadataHeading = document.getElementById('builder-metadata-heading');
    if (metadataHeading) metadataHeading.focus();
}

function moveFocusToBuilderHeading() {
    const builderHeading = document.getElementById('builder-heading');
    if (builderHeading) builderHeading.focus();
}

function moveFocusToEditorHeading() {
    const editorHeading = document.getElementById('editor-heading');
    if (editorHeading) editorHeading.focus();
}

let activeProjectFileHandle = null;

function sanitizeFileName(name, fallback = 'ART Project') {
    const safe = String(name || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim();
    return safe || fallback;
}

function buildProjectFileName() {
    const current = getProjectDocumentInfo();
    if (String(current.fileName || '').trim()) return current.fileName;
    const title = String(appState.projectName || appState.reportTitle || 'ART Project').trim();
    return `${sanitizeFileName(title, 'ART Project')}.art`;
}

async function writeTextToFileHandle(handle, text) {
    const writable = await handle.createWritable();
    await writable.write(String(text || ''));
    await writable.close();
}

function buildTemplateOptions(selectEl) {
    const builtIns = getBuiltInTemplates();
    const users = getUserTemplates();
    const current = selectEl.value;

    const optionSections = [`<option value="scratch">Start from Scratch</option>`];

    if (builtIns.length > 0) {
        optionSections.push(`
            <optgroup label="Built-in templates">
                ${builtIns.map((template) => `<option value="${template.id}">${template.name}</option>`).join('')}
            </optgroup>
        `);
    }

    if (users.length > 0) {
        optionSections.push(`
            <optgroup label="User templates">
                ${users.map((template) => `<option value="${template.id}">${template.name}</option>`).join('')}
            </optgroup>
        `);
    }

    selectEl.innerHTML = optionSections.join('');
    const validValue = [...selectEl.options].some((option) => option.value === current);
    selectEl.value = validValue ? current : 'scratch';
}

function updateTemplateButtons(selectEl, buttons) {
    const isScratch = selectEl.value === 'scratch';
    const isUserTemplate = !!selectEl.value && selectEl.value.startsWith('user-');

    buttons.create.hidden = !isScratch;
    buttons.use.hidden = isScratch;
    buttons.open.hidden = isScratch;
    buttons.edit.hidden = isScratch;
    buttons.delete.hidden = !isUserTemplate;
    buttons.export.hidden = isScratch;
}

function getDialogFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

/**
 * Initializes the dashboard buttons.
 * This is called by loader.js once the DOM is ready.
 */
export function renderDashboard() {
    const btnNew = document.getElementById('btn-new-report');
    const btnOpenReport = document.getElementById('btn-open-report');
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnSaveProjectAs = document.getElementById('btn-save-project-as');
    const btnImportData = document.getElementById('btn-import-data');
    const builderTab = document.getElementById('tab-builder');
    const editorTab = document.getElementById('tab-editor');
    const viewerTab = document.getElementById('tab-view');
    const templateSelect = document.getElementById('template-selection');
    const btnCreate = document.getElementById('btn-template-create');
    const btnUse = document.getElementById('btn-template-use');
    const btnOpen = document.getElementById('btn-template-open');
    const btnEdit = document.getElementById('btn-template-edit');
    const btnDelete = document.getElementById('btn-template-delete');
    const btnTemplateImport = document.getElementById('btn-template-import');
    const btnTemplateExport = document.getElementById('btn-template-export');
    const templateStatus = document.getElementById('template-status');
    const deleteDialog = document.getElementById('template-delete-dialog');
    const deleteMessage = document.getElementById('template-delete-message');
    const btnDeleteYes = document.getElementById('btn-template-delete-yes');
    const btnDeleteNo = document.getElementById('btn-template-delete-no');
    const createDialog = document.getElementById('template-create-dialog');
    const createNameInput = document.getElementById('template-create-name');
    const btnCreateSave = document.getElementById('btn-template-create-save');
    const btnCreateCancel = document.getElementById('btn-template-create-cancel');
    const editConfirmDialog = document.getElementById('template-edit-confirm-dialog');
    const editConfirmMessage = document.getElementById('template-edit-confirm-message');
    const btnEditYes = document.getElementById('btn-template-edit-yes');
    const btnEditNo = document.getElementById('btn-template-edit-no');
    const recentReportsSelect = document.getElementById('recent-reports-select');
    const btnCloseActiveReport = document.getElementById('btn-close-active-report');
    const btnConfigureReport = document.getElementById('btn-configure-report');
    const btnEditReportDashboard = document.getElementById('btn-edit-report-dashboard');
    const btnViewReportDashboard = document.getElementById('btn-view-report-dashboard');
    const btnDeleteReportDashboard = document.getElementById('btn-delete-report-dashboard');
    const reportMetricsList = document.getElementById('report-metrics-list');
    const reportDeleteDialog = document.getElementById('report-delete-dialog');
    const reportDeleteMessage = document.getElementById('report-delete-message');
    const btnReportDeleteConfirm = document.getElementById('btn-report-delete-confirm');
    const btnReportDeleteCancel = document.getElementById('btn-report-delete-cancel');
    const importConflictDialog = document.getElementById('import-conflict-dialog');
    const importConflictMessage = document.getElementById('import-conflict-message');
    const btnImportReplace = document.getElementById('btn-import-replace');
    const btnImportCopy = document.getElementById('btn-import-copy');
    const btnImportCancel = document.getElementById('btn-import-cancel');
    const templateImportConflictDialog = document.getElementById('template-import-conflict-dialog');
    const templateImportConflictDescription = document.getElementById('template-import-conflict-description');
    const templateImportOptionReplace = document.getElementById('template-import-option-replace');
    const templateImportConfirm = document.getElementById('btn-template-import-confirm');
    const templateImportCancel = document.getElementById('btn-template-import-cancel');
    const networkStatus = document.getElementById('network-activity-status');
    const networkDetail = document.getElementById('network-activity-detail');

    if (
        !btnNew || !btnOpenReport || !btnSaveProject || !btnSaveProjectAs || !btnImportData || !builderTab || !editorTab || !templateSelect || !btnCreate || !btnUse || !btnOpen || !btnEdit || !btnDelete || !btnTemplateImport || !btnTemplateExport || !templateStatus
        || !deleteDialog || !deleteMessage || !btnDeleteYes || !btnDeleteNo
        || !createDialog || !createNameInput || !btnCreateSave || !btnCreateCancel
        || !editConfirmDialog || !editConfirmMessage || !btnEditYes || !btnEditNo
        || !recentReportsSelect || !btnCloseActiveReport || !btnConfigureReport || !btnEditReportDashboard || !btnViewReportDashboard || !btnDeleteReportDashboard
        || !reportMetricsList || !reportDeleteDialog || !reportDeleteMessage || !btnReportDeleteConfirm || !btnReportDeleteCancel
        || !importConflictDialog || !importConflictMessage || !btnImportReplace || !btnImportCopy || !btnImportCancel
        || !templateImportConflictDialog || !templateImportConflictDescription || !templateImportOptionReplace || !templateImportConfirm || !templateImportCancel
    ) return;

    const renderNetworkActivityIndicator = () => {
        if (!networkStatus || !networkDetail) return;
        const security = getSecurityConfig();
        const google = getGoogleWorkspaceConfig();
        const privacyMode = Boolean(security.privacyModeEnabled);
        const googleConnected = String(google.status || '').toLowerCase() === 'connected';

        if (privacyMode) {
            networkStatus.textContent = 'Privacy Mode Enabled';
            networkDetail.textContent = 'External integrations are blocked until Privacy Mode is disabled.';
            return;
        }

        if (googleConnected) {
            networkStatus.textContent = 'Connected to Google Workspace';
            networkDetail.textContent = 'Google Workspace connection is active for user-initiated export actions.';
            return;
        }

        networkStatus.textContent = String(security.networkActivityStatus || 'Offline');
        networkDetail.textContent = String(security.networkActivityDetail || 'No external connection activity.');
    };

    renderNetworkActivityIndicator();
    window.addEventListener('art-security-updated', renderNetworkActivityIndicator);
    window.addEventListener('art-google-workspace-updated', renderNetworkActivityIndicator);

    const openProjectInput = document.createElement('input');
    openProjectInput.type = 'file';
    openProjectInput.accept = '.art,application/json';
    openProjectInput.hidden = true;
    openProjectInput.tabIndex = -1;
    openProjectInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(openProjectInput);

    const importReportInput = document.createElement('input');
    importReportInput.type = 'file';
    importReportInput.accept = '.json,application/json';
    importReportInput.hidden = true;
    importReportInput.tabIndex = -1;
    importReportInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(importReportInput);

    const importTemplateInput = document.createElement('input');
    importTemplateInput.type = 'file';
    importTemplateInput.accept = '.artx,.json,application/json';
    importTemplateInput.hidden = true;
    importTemplateInput.tabIndex = -1;
    importTemplateInput.setAttribute('aria-hidden', 'true');
    importTemplateInput.id = 'template-import-file-input';
    document.body.appendChild(importTemplateInput);

    const openStatus = document.createElement('p');
    openStatus.id = 'open-report-status';
    openStatus.className = 'open-report-status';
    openStatus.setAttribute('role', 'status');
    openStatus.setAttribute('aria-live', 'polite');
    const actionGroup = btnOpenReport.parentElement;
    if (actionGroup && actionGroup.parentElement) {
        actionGroup.parentElement.insertBefore(openStatus, actionGroup.nextSibling);
    }

    const reasonMap = {
        'invalid-json': 'File is not valid JSON.',
        'invalid-payload': 'JSON payload is not in ART format.',
        'invalid-format': 'File is not an ART Project (.art) file.',
        'missing-format-version': 'Project formatVersion is missing from the file header.',
        'missing-schema-version': 'Project schemaVersion is missing from the file header.',
        'unsupported-format-version': 'Project formatVersion is not supported by this ART version.',
        'unsupported-schema-version': 'Project schemaVersion is not supported by this ART version.',
        'missing-project-data': 'Project content is missing from the file.',
        'missing-metadata': 'Project metadata is missing from the file.',
        'missing-required-header': 'ART header is missing or invalid.',
        'missing-integrity': 'ART integrity metadata is missing.',
        'missing-report-state': 'ART report data is missing.',
        'checksum-mismatch': 'ART file appears modified or corrupted.',
        'ok': 'ART JSON precheck passed.'
    };

    const reportPrecheckStatus = (text) => {
        openStatus.textContent = text;
        announce(text);
    };

    const templateReasonMap = {
        'invalid-json': 'Template file is not valid JSON.',
        'invalid-payload': 'Template payload is not in ART Template format.',
        'missing-format-version': 'Template formatVersion is missing from the file header.',
        'missing-schema-version': 'Template schemaVersion is missing from the file header.',
        'unsupported-format-version': 'Template formatVersion is not supported by this ART version.',
        'unsupported-schema-version': 'Template schemaVersion is not supported by this ART version.',
        'missing-template-header': 'Template version metadata is missing or unsupported.',
        'missing-template': 'Template object is missing from the file.',
        'missing-template-name': 'Template name is required.',
        'missing-template-data': 'Template data is missing from the file.',
        'ok': 'Template file validated.'
    };

    const reportTemplateStatus = (text) => {
        templateStatus.textContent = text;
        announce(text);
    };

    const openProjectFromText = (fileText, selectedFileName = '') => {
        const validation = validateArtProjectPayload(fileText);
        if (!validation.isValid) {
            const detail = reasonMap[validation.reason] || 'Project file does not match the ART project schema.';
            reportPrecheckStatus(`Open failed for ${selectedFileName || 'project'}. ${detail}`);
            return false;
        }

        const result = importArtProjectPayload(validation.payload);
        if (!result.isValid) {
            reportPrecheckStatus(`Open failed for ${selectedFileName || 'project'}. Project data could not be loaded.`);
            return false;
        }

        const now = new Date().toISOString();
        updateProjectDocumentInfo({
            fileName: selectedFileName || buildProjectFileName(),
            filePath: activeProjectFileHandle?.name ? activeProjectFileHandle.name : '',
            createdAt: validation.payload.metadata.createdAt || now,
            lastModifiedAt: validation.payload.metadata.lastModifiedAt || now,
            createdWith: validation.payload.metadata.createdWith || '',
            lastSavedWith: validation.payload.metadata.lastSavedWith || '',
            hasRecoveredChanges: false,
            recoveryLabel: ''
        }, { action: 'Opened ART project file' });
        clearProjectRecoveryMark();
        reportPrecheckStatus(`Opened ${selectedFileName || 'project'} successfully.`);
        rebuildRecentReports();
        return true;
    };

    const runSaveProjectAs = async () => {
        const payloadText = serializeArtProjectPayload();
        const suggestedName = buildProjectFileName();
        const now = new Date().toISOString();

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName,
                    types: [{
                        description: 'ART Project Files',
                        accept: { 'application/json': ['.art'] }
                    }]
                });
                if (!handle) return false;
                await writeTextToFileHandle(handle, payloadText);
                activeProjectFileHandle = handle;
                updateProjectDocumentInfo({
                    fileName: handle.name || suggestedName,
                    filePath: '',
                    createdAt: getProjectDocumentInfo().createdAt || now,
                    lastModifiedAt: now,
                    createdWith: getProjectDocumentInfo().createdWith || '',
                    lastSavedWith: ''
                }, { action: 'Saved ART project as file' });
                saveState({ action: 'Saved ART project', markProjectSaved: true, recordHistory: false });
                announce(`Project saved as ${handle.name || suggestedName}.`);
                return true;
            } catch (error) {
                reportPrecheckStatus('Save As cancelled or failed. Your work remains in local recovery storage.');
                return false;
            }
        }

        try {
            const blob = new Blob([payloadText], { type: 'application/json' });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = suggestedName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
            updateProjectDocumentInfo({
                fileName: suggestedName,
                filePath: '',
                createdAt: getProjectDocumentInfo().createdAt || now,
                lastModifiedAt: now,
                createdWith: getProjectDocumentInfo().createdWith || '',
                lastSavedWith: ''
            }, { action: 'Saved ART project as download' });
            saveState({ action: 'Saved ART project', markProjectSaved: true, recordHistory: false });
            announce(`Project saved as ${suggestedName}.`);
            return true;
        } catch (error) {
            reportPrecheckStatus('Unable to save project. Your work has been preserved in recovery storage.');
            return false;
        }
    };

    const runSaveProject = async () => {
        const payloadText = serializeArtProjectPayload();
        const now = new Date().toISOString();
        const currentProject = getProjectDocumentInfo();

        if (activeProjectFileHandle) {
            try {
                await writeTextToFileHandle(activeProjectFileHandle, payloadText);
                updateProjectDocumentInfo({
                    fileName: activeProjectFileHandle.name || currentProject.fileName || buildProjectFileName(),
                    lastModifiedAt: now,
                    createdAt: currentProject.createdAt || now,
                    createdWith: currentProject.createdWith || '',
                    lastSavedWith: ''
                }, { action: 'Saved ART project' });
                saveState({ action: 'Saved ART project', markProjectSaved: true, recordHistory: false });
                announce('Changes saved.');
                return true;
            } catch (error) {
                reportPrecheckStatus('Unable to save changes. Please check storage permissions.');
                return false;
            }
        }

        return runSaveProjectAs();
    };

    const confirmProceedWithUnsavedChanges = async () => {
        if (!hasUnsavedProjectChanges()) return true;
        const saveNow = window.confirm('You have unsaved changes. Select OK to save before continuing, or Cancel to review your changes.');
        if (!saveNow) return false;
        return runSaveProject();
    };

    btnSaveProject.addEventListener('click', async () => {
        await runSaveProject();
    });

    btnSaveProjectAs.addEventListener('click', async () => {
        await runSaveProjectAs();
    });

    btnOpenReport.addEventListener('click', async () => {
        const proceed = await confirmProceedWithUnsavedChanges();
        if (!proceed) return;

        if (typeof window.showOpenFilePicker === 'function') {
            try {
                const [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{
                        description: 'ART Project Files',
                        accept: { 'application/json': ['.art'] }
                    }]
                });
                if (!handle) return;
                const file = await handle.getFile();
                const text = await file.text();
                activeProjectFileHandle = handle;
                openProjectFromText(text, file.name || handle.name || 'project.art');
                return;
            } catch (error) {
                // Fallback to hidden input when picker is unavailable or cancelled.
            }
        }

        openProjectInput.value = '';
        openProjectInput.click();
    });

    openProjectInput.addEventListener('change', async () => {
        const selectedFile = openProjectInput.files && openProjectInput.files[0];
        if (!selectedFile) return;
        try {
            const fileText = await selectedFile.text();
            activeProjectFileHandle = null;
            openProjectFromText(fileText, selectedFile.name);
        } catch (error) {
            reportPrecheckStatus(`Open failed for ${selectedFile.name}. Could not read file.`);
        }
    });

    btnImportData.addEventListener('click', () => {
        importReportInput.value = '';
        importReportInput.click();
    });

    importReportInput.addEventListener('change', async () => {
        const selectedFile = importReportInput.files && importReportInput.files[0];
        if (!selectedFile) return;

        try {
            const fileText = await selectedFile.text();
            const precheck = validateArtJsonPayload(fileText);
            if (!precheck.isValid) {
                const detail = reasonMap[precheck.reason] || 'Unknown validation error.';
                reportPrecheckStatus(`Import failed for ${selectedFile.name}. ${detail}`);
                return;
            }

            const payload = typeof fileText === 'string' ? JSON.parse(fileText) : null;
            const importState = payload?.reportState || {};
            const importName = String(importState.reportTitle || 'Untitled Report').trim() || 'Untitled Report';

            const finalizeImport = (strategy) => {
                const imported = importReportWithConflictStrategy(importState, strategy);
                if (!imported) return;
                window.dispatchEvent(new Event('art-templates-updated'));
                window.dispatchEvent(new Event('art-reports-updated'));
                reportPrecheckStatus(`Imported ${pendingImportFileName || selectedFile.name} successfully.`);
                rebuildRecentReports();
                if (viewerTab) {
                    viewerTab.click();
                    window.setTimeout(() => {
                        const viewerHeading = document.getElementById('viewer-heading');
                        if (viewerHeading) viewerHeading.focus();
                    }, 0);
                }
            };

            if (reportNameExists(importName)) {
                pendingImportPayload = importState;
                pendingImportFileName = selectedFile.name;
                importConflictMessage.innerHTML = `A report named <strong>${importName}</strong> already exists.`;
                openDialog(importConflictDialog, btnImportReplace, btnImportData);
                return;
            }

            finalizeImport('copy');
        } catch (error) {
            reportPrecheckStatus(`Import failed for ${selectedFile.name}. Could not read file.`);
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedProjectChanges()) return;
        markProjectRecovered('Recovered changes are available.');
        event.preventDefault();
        event.returnValue = '';
    });

    const finalizeTemplateImport = (templatePayload, strategy) => {
        const imported = importTemplateWithConflictStrategy(templatePayload, strategy);
        if (!imported) return null;
        window.dispatchEvent(new Event('art-templates-updated'));
        return imported;
    };

    btnTemplateImport.addEventListener('click', () => {
        importTemplateInput.value = '';
        importTemplateInput.click();
    });

    importTemplateInput.addEventListener('change', async () => {
        const selectedFile = importTemplateInput.files && importTemplateInput.files[0];
        if (!selectedFile) return;

        try {
            const fileText = await selectedFile.text();
            const artxValidation = validateArtxTemplatePayload(fileText);
            const validation = artxValidation.isValid
                ? artxValidation
                : validateTemplateJsonPayload(fileText);
            if (!validation.isValid) {
                const detail = templateReasonMap[validation.reason] || 'Unknown template validation error.';
                reportTemplateStatus(`Template import failed for ${selectedFile.name}. ${detail}`);
                return;
            }

            const templatePayload = validation.payload.template;
            if (templateNameExists(templatePayload.name)) {
                pendingTemplateImportPayload = templatePayload;
                pendingTemplateImportFileName = selectedFile.name;
                templateImportConflictDescription.innerHTML = `A template named <strong>${templatePayload.name}</strong> already exists.`;
                templateImportOptionReplace.checked = true;
                openDialog(templateImportConflictDialog, templateImportOptionReplace, btnTemplateImport);
                return;
            }

            const imported = finalizeTemplateImport(templatePayload, 'copy');
            if (!imported) return;

            buildTemplateOptions(templateSelect);
            templateSelect.value = imported.id;
            updateTemplateButtons(templateSelect, buttons);
            reportTemplateStatus(`Imported template ${imported.name} successfully.`);
            templateSelect.focus();
        } catch (error) {
            reportTemplateStatus(`Template import failed for ${selectedFile.name}. Could not read file.`);
        }
    });

    btnTemplateExport.addEventListener('click', () => {
        const selected = getTemplateById(templateSelect.value);
        if (!selected) {
            reportTemplateStatus('Select a template to export.');
            templateSelect.focus();
            return;
        }

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
        reportTemplateStatus(`Exported template ${selected.name}.`);
    });

    const buttons = {
        create: btnCreate,
        use: btnUse,
        open: btnOpen,
        edit: btnEdit,
        delete: btnDelete,
        export: btnTemplateExport
    };
    let pendingDeleteTemplateId = null;
    let pendingCreateSourceTemplateId = null;
    let pendingEditTemplateId = null;
    let pendingDeleteReportId = null;
    let pendingImportPayload = null;
    let pendingImportFileName = '';
    let pendingTemplateImportPayload = null;
    let pendingTemplateImportFileName = '';
    let activeDialog = null;

    const refreshReportMetrics = () => {
        const selectedReport = getReportById(recentReportsSelect.value);
        if (!selectedReport) {
            reportMetricsList.innerHTML = `
                <div><dd>There are no open reports to show metrics for.</dd></div>
            `;
            return;
        }
        const metrics = computeReportMetrics(selectedReport);
        reportMetricsList.innerHTML = `
            <div><dt>Total Issues</dt><dd>${metrics.totalIssues}</dd></div>
            <div><dt>Pages Tested</dt><dd>${metrics.pagesTested}</dd></div>
            <div><dt>Issues by Severity</dt><dd>${metrics.issuesBySeverity}</dd></div>
            <div><dt>WCAG Success Criteria Referenced</dt><dd>${metrics.wcagCriteria}</dd></div>
            <div><dt>Total Audit Entries</dt><dd>${metrics.totalAuditEntries}</dd></div>
        `;
    };

    const rebuildRecentReports = () => {
        const reports = getRecentReports();
        const recentProjects = getRecentProjectFiles();
        const projectInfo = getProjectDocumentInfo();
        const currentSelection = appState.selectedReportId;

        const projectOptions = recentProjects.map((project) => {
            const labelBase = project.filePath
                ? `${project.fileName} - ${project.filePath}`
                : project.fileName;
            const recoverySuffix = project.status === 'recovered' ? ' - Recovered Changes Available' : '';
            return `<option value="project:${project.id}">${labelBase}${recoverySuffix}</option>`;
        });
        if (projectInfo.hasRecoveredChanges) {
            projectOptions.unshift(`<option value="project:recovery">${projectInfo.fileName || 'Unsaved ART Project'} - Recovered Changes Available</option>`);
        }

        const reportOptions = reports.map((report) => `<option value="${report.id}">${report.name}</option>`);
        const emptyLabel = (projectOptions.length > 0 || reportOptions.length > 0)
            ? 'No item selected'
            : 'No recent projects or reports';

        recentReportsSelect.innerHTML = `<option value="">${emptyLabel}</option>${projectOptions.join('')}${reportOptions.join('')}`;

        if (reports.length > 0) {
            const hasCurrent = reports.some((report) => report.id === currentSelection);
            recentReportsSelect.value = hasCurrent ? currentSelection : '';
            appState.selectedReportId = recentReportsSelect.value || '';
            saveState({ action: 'Selected report from dashboard', recordHistory: false });
        } else {
            appState.selectedReportId = '';
        }

        const selected = String(recentReportsSelect.value || '');
        const hasReportSelection = Boolean(selected) && !selected.startsWith('project:');
        btnConfigureReport.disabled = !hasReportSelection;
        btnEditReportDashboard.disabled = !hasReportSelection;
        btnViewReportDashboard.disabled = !hasReportSelection;
        btnDeleteReportDashboard.disabled = !hasReportSelection;
        btnCloseActiveReport.disabled = !hasReportSelection;
        refreshReportMetrics();
    };

    const focusEditorHeadingSoon = () => {
        // Render is triggered by tab click; defer focus until DOM is updated.
        window.setTimeout(() => {
            moveFocusToEditorHeading();
        }, 0);
    };

    const closeEditConfirmDialog = (restoreFocus = true) => {
        editConfirmDialog.hidden = true;
        pendingEditTemplateId = null;
        activeDialog = null;
        if (restoreFocus) btnEdit.focus();
    };

    const openDialog = (dialog, focusTarget, triggerButton) => {
        activeDialog = { dialog, triggerButton };
        dialog.hidden = false;
        window.setTimeout(() => {
            if (focusTarget) {
                focusTarget.focus();
                return;
            }

            const focusables = getDialogFocusableElements(dialog);
            if (focusables[0]) focusables[0].focus();
        }, 0);
    };

    const closeDialog = (dialog, restoreFocus = true) => {
        dialog.hidden = true;
        if (activeDialog?.dialog === dialog) {
            const trigger = activeDialog.triggerButton;
            activeDialog = null;
            if (restoreFocus && trigger) trigger.focus();
        }
    };

    const trapActiveDialogFocus = (event) => {
        if (!activeDialog || activeDialog.dialog.hidden) return;
        if (event.type === 'focusin') {
            if (!activeDialog.dialog.contains(event.target)) {
                const focusables = getDialogFocusableElements(activeDialog.dialog);
                if (focusables[0]) focusables[0].focus();
            }
            return;
        }

        if (event.key !== 'Tab' && event.key !== 'Escape') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            if (activeDialog.dialog.id === 'template-create-dialog') {
                pendingCreateSourceTemplateId = null;
                closeDialog(activeDialog.dialog, true);
                btnCreate.focus();
                return;
            }
            if (activeDialog.dialog.id === 'template-delete-dialog') {
                pendingDeleteTemplateId = null;
                closeDialog(activeDialog.dialog, true);
                btnDelete.focus();
                return;
            }
            if (activeDialog.dialog.id === 'template-edit-confirm-dialog') {
                closeEditConfirmDialog(true);
                return;
            }
            if (activeDialog.dialog.id === 'report-delete-dialog') {
                pendingDeleteReportId = null;
                closeDialog(activeDialog.dialog, true);
                btnDeleteReportDashboard.focus();
                return;
            }
            if (activeDialog.dialog.id === 'import-conflict-dialog') {
                pendingImportPayload = null;
                pendingImportFileName = '';
                closeDialog(activeDialog.dialog, true);
                btnImportData.focus();
                return;
            }
            if (activeDialog.dialog.id === 'template-import-conflict-dialog') {
                pendingTemplateImportPayload = null;
                pendingTemplateImportFileName = '';
                closeDialog(activeDialog.dialog, true);
                btnTemplateImport.focus();
            }
            return;
        }

        const focusables = getDialogFocusableElements(activeDialog.dialog);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = event.target;

        if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    };

    document.addEventListener('keydown', trapActiveDialogFocus);
    document.addEventListener('focusin', trapActiveDialogFocus);

    const continueEditTemplate = (templateId) => {
        const loaded = loadTemplate(templateId);
        if (!loaded) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        appState.templateCreateMode = false;
        appState.templateEditingId = templateId;
        saveState();
        builderTab.click();
        window.setTimeout(() => moveFocusToBuilderHeading(), 0);
    };

    const continueCreateFromTemplate = (templateId, templateName) => {
        const loaded = loadTemplate(templateId);
        if (!loaded) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        appState.templateCreateMode = true;
        appState.templateEditingId = null;
        appState.templateName = templateName;
        saveState();
        builderTab.click();
    };

    buildTemplateOptions(templateSelect);
    if (appState.lastCreatedTemplateId && [...templateSelect.options].some((option) => option.value === appState.lastCreatedTemplateId)) {
        templateSelect.value = appState.lastCreatedTemplateId;
    }
    updateTemplateButtons(templateSelect, buttons);

    window.addEventListener('art-templates-updated', () => {
        const current = templateSelect.value;
        buildTemplateOptions(templateSelect);
        if (appState.lastCreatedTemplateId && [...templateSelect.options].some((option) => option.value === appState.lastCreatedTemplateId)) {
            templateSelect.value = appState.lastCreatedTemplateId;
        } else if ([...templateSelect.options].some((option) => option.value === current)) {
            templateSelect.value = current;
        }
        updateTemplateButtons(templateSelect, buttons);
    });

    const announceCurrentTemplateSelection = () => {
        const currentOption = templateSelect.options[templateSelect.selectedIndex];
        if (currentOption) {
            announce(`Template selection ${currentOption.text}`);
        }
    };

    btnNew.addEventListener('click', () => {
        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        saveState();
        builderTab.click();
        window.setTimeout(() => moveFocusToBuilderHeading(), 0);
    });

    templateSelect.addEventListener('change', () => {
        updateTemplateButtons(templateSelect, buttons);
        announceCurrentTemplateSelection();
    });

    templateSelect.addEventListener('input', () => {
        announceCurrentTemplateSelection();
    });

    templateSelect.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
        window.setTimeout(() => announceCurrentTemplateSelection(), 20);
    });

    templateSelect.addEventListener('focus', () => {
        announceCurrentTemplateSelection();
    });

    btnCreate.addEventListener('click', () => {
        if (templateSelect.value === 'scratch') {
            resetReportToBlank();
            appState.editorUsesReportTitle = false;
            appState.editorReadOnly = false;
            appState.templateCreateMode = true;
            appState.templateEditingId = null;
            saveState();
            builderTab.click();
            moveFocusToBuilderHeading();
            return;
        }

        const sourceTemplate = getTemplateById(templateSelect.value);
        if (!sourceTemplate) return;

        pendingCreateSourceTemplateId = sourceTemplate.id;
        createNameInput.value = `${sourceTemplate.name} Copy`;
        openDialog(createDialog, createNameInput, btnCreate);
    });

    btnCreateSave.addEventListener('click', () => {
        if (!pendingCreateSourceTemplateId) return;
        const templateName = createNameInput.value.trim();
        if (!templateName) {
            createNameInput.focus();
            return;
        }

        closeDialog(createDialog, false);
        const sourceTemplateId = pendingCreateSourceTemplateId;
        pendingCreateSourceTemplateId = null;
        continueCreateFromTemplate(sourceTemplateId, templateName);
    });

    btnCreateCancel.addEventListener('click', () => {
        closeDialog(createDialog, true);
        pendingCreateSourceTemplateId = null;
        btnCreate.focus();
    });

    btnOpen.addEventListener('click', () => {
        const selected = loadTemplate(templateSelect.value);
        if (!selected) return;

        appState.editorUsesReportTitle = true;
        appState.editorReadOnly = true;
        appState.templateCreateMode = false;
        appState.templateEditingId = null;
        saveState();
        editorTab.click();
        focusEditorHeadingSoon();
    });

    btnUse.addEventListener('click', () => {
        const selected = loadTemplate(templateSelect.value);
        if (!selected) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        // Using a template is the "create from existing" workflow.
        appState.templateCreateMode = true;
        appState.templateEditingId = null;
        saveState();
        builderTab.click();
        window.setTimeout(() => moveFocusToBuilderHeading(), 0);
    });

    btnEdit.addEventListener('click', () => {
        let selectedTemplateId = templateSelect.value;
        const selected = getTemplateById(selectedTemplateId);
        if (!selected) return;

        if (!selected.id.startsWith('user-')) {
            pendingEditTemplateId = selected.id;
            editConfirmMessage.textContent = `Editing ${selected.name} creates an editable user copy. Continue?`;
            openDialog(editConfirmDialog, btnEditYes, btnEdit);
            return;
        }

        continueEditTemplate(selectedTemplateId);
    });

    btnEditYes.addEventListener('click', () => {
        if (!pendingEditTemplateId) return;
        const sourceTemplate = getTemplateById(pendingEditTemplateId);
        if (!sourceTemplate) {
            closeEditConfirmDialog(true);
            return;
        }

        const editableCopy = createUserTemplateFromSelection(sourceTemplate.id, `${sourceTemplate.name} Editable Copy`);
        if (!editableCopy) {
            closeEditConfirmDialog(true);
            return;
        }

        buildTemplateOptions(templateSelect);
        templateSelect.value = editableCopy.id;
        updateTemplateButtons(templateSelect, buttons);
        closeEditConfirmDialog(true);
        announce(`${editableCopy.name} created for editing`);
        continueEditTemplate(editableCopy.id);
    });

    btnEditNo.addEventListener('click', () => {
        closeEditConfirmDialog(true);
    });

    btnDelete.addEventListener('click', () => {
        const selected = getTemplateById(templateSelect.value);
        if (!selected || !selected.id.startsWith('user-')) return;

        pendingDeleteTemplateId = selected.id;
        deleteMessage.textContent = `Deleting ${selected.name} cannot be undone.`;
        openDialog(deleteDialog, btnDeleteYes, btnDelete);
    });

    btnDeleteNo.addEventListener('click', () => {
        closeDialog(deleteDialog, true);
        pendingDeleteTemplateId = null;
        btnDelete.focus();
    });

    btnDeleteYes.addEventListener('click', () => {
        if (!pendingDeleteTemplateId) return;

        const deleted = deleteUserTemplate(pendingDeleteTemplateId);
        closeDialog(deleteDialog, false);
        pendingDeleteTemplateId = null;
        if (!deleted) return;

        buildTemplateOptions(templateSelect);
        templateSelect.value = 'scratch';
        updateTemplateButtons(templateSelect, buttons);
        templateSelect.focus();
        announce(`${deleted.name} template deleted`);
    });

    const loadSelectedRecentReport = () => {
        const reportId = recentReportsSelect.value;
        if (!reportId || reportId.startsWith('project:')) return null;
        const loaded = loadReportById(reportId);
        return loaded;
    };

    recentReportsSelect.addEventListener('change', () => {
        const selected = String(recentReportsSelect.value || '');
        appState.selectedReportId = selected.startsWith('project:') ? '' : selected;
        saveState({ action: 'Selected dashboard report', recordHistory: false });
        const hasReportSelection = Boolean(selected) && !selected.startsWith('project:');
        btnConfigureReport.disabled = !hasReportSelection;
        btnEditReportDashboard.disabled = !hasReportSelection;
        btnViewReportDashboard.disabled = !hasReportSelection;
        btnDeleteReportDashboard.disabled = !hasReportSelection;
        btnCloseActiveReport.disabled = !hasReportSelection;

        if (selected.startsWith('project:')) {
            announce('Recent project entry selected. Use Open ART Project to choose the project file from storage.');
        }
        refreshReportMetrics();
    });

    btnCloseActiveReport.addEventListener('click', () => {
        if (!recentReportsSelect.value) return;
        closeCurrentReportSession();
        recentReportsSelect.value = '';
        btnConfigureReport.disabled = true;
        btnEditReportDashboard.disabled = true;
        btnViewReportDashboard.disabled = true;
        btnDeleteReportDashboard.disabled = true;
        btnCloseActiveReport.disabled = true;
        refreshReportMetrics();
        announce('Closed active report.');
        const welcomeTab = document.getElementById('tab-welcome');
        welcomeTab?.click();
        window.setTimeout(() => {
            const heading = document.getElementById('dash-heading');
            if (!heading) return;
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus();
        }, 0);
    });

    btnConfigureReport.addEventListener('click', () => {
        const report = loadSelectedRecentReport();
        if (!report) return;
        builderTab.click();
        window.setTimeout(() => moveFocusToBuilderHeading(), 0);
    });

    btnEditReportDashboard.addEventListener('click', () => {
        const report = loadSelectedRecentReport();
        if (!report) return;
        appState.editorReadOnly = false;
        saveState({ action: `Opened report ${report.name} in editor`, recordHistory: false });
        editorTab.click();
        window.setTimeout(() => moveFocusToEditorHeading(), 0);
    });

    btnViewReportDashboard.addEventListener('click', () => {
        const report = loadSelectedRecentReport();
        if (!report) return;
        viewerTab?.click();
        window.setTimeout(() => {
            const viewerHeading = document.getElementById('viewer-heading');
            if (viewerHeading) viewerHeading.focus();
        }, 0);
    });

    btnDeleteReportDashboard.addEventListener('click', () => {
        const selected = getReportById(recentReportsSelect.value);
        if (!selected) return;
        pendingDeleteReportId = selected.id;
        reportDeleteMessage.innerHTML = `Are you sure you want to delete <strong>${selected.name}</strong>?<br>This action cannot be undone.`;
        openDialog(reportDeleteDialog, btnReportDeleteConfirm, btnDeleteReportDashboard);
    });

    btnReportDeleteCancel.addEventListener('click', () => {
        pendingDeleteReportId = null;
        closeDialog(reportDeleteDialog, true);
        btnDeleteReportDashboard.focus();
    });

    btnReportDeleteConfirm.addEventListener('click', () => {
        if (!pendingDeleteReportId) return;
        const removed = deleteReportById(pendingDeleteReportId);
        pendingDeleteReportId = null;
        closeDialog(reportDeleteDialog, false);
        if (!removed) return;
        rebuildRecentReports();
        recentReportsSelect.focus();
        announce(`Deleted report ${removed.name}`);
    });

    btnImportReplace.addEventListener('click', () => {
        if (!pendingImportPayload) return;
        const imported = importReportWithConflictStrategy(pendingImportPayload, 'replace');
        pendingImportPayload = null;
        closeDialog(importConflictDialog, false);
        if (!imported) return;
        rebuildRecentReports();
        reportPrecheckStatus(`Imported ${pendingImportFileName} successfully.`);
        pendingImportFileName = '';
        viewerTab?.click();
        window.setTimeout(() => {
            const viewerHeading = document.getElementById('viewer-heading');
            if (viewerHeading) viewerHeading.focus();
        }, 0);
    });

    btnImportCopy.addEventListener('click', () => {
        if (!pendingImportPayload) return;
        const imported = importReportWithConflictStrategy(pendingImportPayload, 'copy');
        pendingImportPayload = null;
        closeDialog(importConflictDialog, false);
        if (!imported) return;
        rebuildRecentReports();
        reportPrecheckStatus(`Imported ${pendingImportFileName} successfully.`);
        pendingImportFileName = '';
        viewerTab?.click();
        window.setTimeout(() => {
            const viewerHeading = document.getElementById('viewer-heading');
            if (viewerHeading) viewerHeading.focus();
        }, 0);
    });

    btnImportCancel.addEventListener('click', () => {
        pendingImportPayload = null;
        pendingImportFileName = '';
        closeDialog(importConflictDialog, true);
        btnImportData.focus();
    });

    templateImportConfirm.addEventListener('click', () => {
        if (!pendingTemplateImportPayload) return;

        const strategy = templateImportConflictDialog.querySelector('input[name="template-import-conflict"]:checked')?.value || 'replace';
        const imported = finalizeTemplateImport(pendingTemplateImportPayload, strategy);
        const sourceName = pendingTemplateImportFileName;
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
        closeDialog(templateImportConflictDialog, false);
        if (!imported) {
            reportTemplateStatus(`Template import failed for ${sourceName}.`);
            return;
        }

        buildTemplateOptions(templateSelect);
        templateSelect.value = imported.id;
        updateTemplateButtons(templateSelect, buttons);
        reportTemplateStatus(`Imported template ${imported.name} successfully.`);
        templateSelect.focus();
    });

    templateImportCancel.addEventListener('click', () => {
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
        closeDialog(templateImportConflictDialog, true);
        btnTemplateImport.focus();
    });

    deleteDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialog(deleteDialog, true);
        pendingDeleteTemplateId = null;
        btnDelete.focus();
    });

    createDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialog(createDialog, true);
        pendingCreateSourceTemplateId = null;
        btnCreate.focus();
    });

    editConfirmDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeEditConfirmDialog(true);
    });

    reportDeleteDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        pendingDeleteReportId = null;
        closeDialog(reportDeleteDialog, true);
        btnDeleteReportDashboard.focus();
    });

    importConflictDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        pendingImportPayload = null;
        pendingImportFileName = '';
        closeDialog(importConflictDialog, true);
        btnImportData.focus();
    });

    templateImportConflictDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
        closeDialog(templateImportConflictDialog, true);
        btnTemplateImport.focus();
    });

    window.addEventListener('art-reports-updated', rebuildRecentReports);
    window.addEventListener('art-state-restored', rebuildRecentReports);

    const projectInfo = getProjectDocumentInfo();
    if (projectInfo.hasRecoveredChanges || hasUnsavedProjectChanges()) {
        markProjectRecovered(projectInfo.recoveryLabel || 'Recovered changes are available.');
        announce(projectInfo.recoveryLabel || 'A previous unsaved version of this project was found.');
    }
    rebuildRecentReports();
}
