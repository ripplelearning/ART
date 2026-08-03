// dashboard.js

import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import {
    initializeDashboardWidgetFramework,
    openConfigureDashboardDialogFromCommand,
    refreshDashboardWidgetFramework,
    registerDashboardWidget
} from './dashboardWidgetFramework.js';
import {
    executeUniversalSearchResult,
    runUniversalSearch
} from './universalSearchFramework.js';
import { createSearchResultsController } from './searchResultsFramework.js';
import {
    getWorkspaceExplorerSummary,
    initProjectWorkspaceFramework
} from './projectWorkspaceFramework.js';

import {
    addAuditEntry,
    announce,
    appState,
    createArtProjectPayload,
    createUserTemplateFromSelection,
    closeCurrentReportSession,
    clearProjectRecoveryMark,
    computeReportMetrics,
    getProgressLogMetrics,
    deleteUserTemplate,
    deleteReportById,
    getAuditEntries,
    getBuiltInTemplates,
    getProjectDocumentInfo,
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

function moveFocusToEditorHeading() {
    const editorHeading = document.getElementById('editor-heading');
    if (editorHeading) editorHeading.focus();
}

let activeProjectFileHandle = null;
let runDashboardOpenProjectWorkflow = null;
let runDashboardSaveProjectWorkflow = null;
let runDashboardSaveProjectAsWorkflow = null;
let runDashboardImportReportPickerWorkflow = null;
let runDashboardImportTemplatePickerWorkflow = null;
let runDashboardConfigureWorkflow = null;
let dashboardWidgetsRegistered = false;

export async function openDashboardProjectFromCommand() {
    if (typeof runDashboardOpenProjectWorkflow !== 'function') return false;
    return runDashboardOpenProjectWorkflow();
}

export async function saveDashboardProjectFromCommand() {
    if (typeof runDashboardSaveProjectWorkflow !== 'function') return false;
    return runDashboardSaveProjectWorkflow();
}

export async function saveDashboardProjectAsFromCommand() {
    if (typeof runDashboardSaveProjectAsWorkflow !== 'function') return false;
    return runDashboardSaveProjectAsWorkflow();
}

export function startDashboardImportReportFromCommand() {
    if (typeof runDashboardImportReportPickerWorkflow !== 'function') return false;
    return runDashboardImportReportPickerWorkflow();
}

export function startDashboardImportTemplateFromCommand() {
    if (typeof runDashboardImportTemplatePickerWorkflow !== 'function') return false;
    return runDashboardImportTemplatePickerWorkflow();
}

export function openConfigureDashboardFromCommand() {
    if (typeof runDashboardConfigureWorkflow !== 'function') return false;
    return runDashboardConfigureWorkflow();
}

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

function ensureDashboardStateShape() {
    const defaults = {
        layout: 'cards',
        widgetOrder: [
            'quick-actions',
            'continue-working',
            'current-project',
            'current-report',
            'report-metrics',
            'recent-activity',
            'notifications',
            'dashboard-search'
        ],
        visibleWidgetIds: [
            'quick-actions',
            'continue-working',
            'current-project',
            'current-report',
            'report-metrics',
            'recent-activity',
            'notifications',
            'dashboard-search'
        ],
        collapsedWidgets: {},
        tabs: [
            { id: 'workspace', name: 'Workspace', widgetIds: ['quick-actions', 'continue-working', 'recent-activity', 'notifications', 'dashboard-search'] },
            { id: 'projects', name: 'Projects', widgetIds: ['current-project'] },
            { id: 'reports', name: 'Reports', widgetIds: ['current-report', 'report-metrics'] },
            { id: 'analytics', name: 'Analytics', widgetIds: ['recent-activity'] }
        ],
        customWidgets: []
    };

    const current = appState.dashboard && typeof appState.dashboard === 'object'
        ? appState.dashboard
        : {};

    appState.dashboard = {
        ...defaults,
        ...current,
        widgetOrder: Array.isArray(current.widgetOrder) && current.widgetOrder.length > 0
            ? current.widgetOrder
            : defaults.widgetOrder,
        visibleWidgetIds: Array.isArray(current.visibleWidgetIds) && current.visibleWidgetIds.length > 0
            ? current.visibleWidgetIds
            : defaults.visibleWidgetIds,
        collapsedWidgets: current.collapsedWidgets && typeof current.collapsedWidgets === 'object'
            ? current.collapsedWidgets
            : {},
        tabs: Array.isArray(current.tabs) && current.tabs.length > 0
            ? current.tabs
            : defaults.tabs,
        customWidgets: Array.isArray(current.customWidgets)
            ? current.customWidgets
            : []
    };

    return appState.dashboard;
}

function extractReportMetricsSection() {
    const container = document.getElementById('recent-reports-container');
    const metrics = document.getElementById('report-metrics');
    if (!container || !metrics) return;
    if (!container.contains(metrics)) return;
    container.parentElement?.insertBefore(metrics, container.nextSibling);
}

function renderCurrentProjectWidget(container) {
    const workspaceSummary = getWorkspaceExplorerSummary();
    if (workspaceSummary.hasWorkspace) {
        const stats = workspaceSummary.statistics || {};
        const health = workspaceSummary.health || {};
        container.innerHTML = `
            <dl class="dashboard-widget__definition-list">
                <div><dt>Workspace Name</dt><dd>${workspaceSummary.workspaceName || 'Untitled Workspace'}</dd></div>
                <div><dt>Total Reports</dt><dd>${stats.totalReports || 0}</dd></div>
                <div><dt>Project Assets</dt><dd>${stats.projectAssets || 0}</dd></div>
                <div><dt>Completion</dt><dd>${health.projectCompletion || 0}%</dd></div>
                <div><dt>Validation Issues</dt><dd>${Array.isArray(workspaceSummary.validationIssues) ? workspaceSummary.validationIssues.length : 0}</dd></div>
            </dl>
        `;
        return;
    }

    const documentInfo = getProjectDocumentInfo();
    const projectName = String(appState.projectName || '').trim();
    const hasProject = Boolean(projectName || documentInfo.fileName);

    if (!hasProject) {
        container.innerHTML = '<p>No project is currently open.</p>';
        return;
    }

    container.innerHTML = `
        <dl class="dashboard-widget__definition-list">
            <div><dt>Project Name</dt><dd>${projectName || 'Untitled Project'}</dd></div>
            <div><dt>Project File</dt><dd>${documentInfo.fileName || 'Not yet saved'}</dd></div>
            <div><dt>Last Modified</dt><dd>${documentInfo.lastModifiedAt ? new Date(documentInfo.lastModifiedAt).toLocaleString() : 'Unknown'}</dd></div>
            <div><dt>Unsaved Changes</dt><dd>${hasUnsavedProjectChanges() ? 'Yes' : 'No'}</dd></div>
        </dl>
    `;
}

function renderCurrentReportWidget(container) {
    const selectedId = String(appState.selectedReportId || '').trim();
    const report = selectedId ? getReportById(selectedId) : null;

    if (!report) {
        container.innerHTML = '<p>No report is currently open.</p>';
        return;
    }

    const reportData = report.data || {};
    container.innerHTML = `
        <dl class="dashboard-widget__definition-list">
            <div><dt>Report Name</dt><dd>${report.name || 'Untitled Report'}</dd></div>
            <div><dt>Report Type</dt><dd>${reportData.reportType || 'Not specified'}</dd></div>
            <div><dt>Template</dt><dd>${reportData.templateName || 'Not specified'}</dd></div>
            <div><dt>Last Modified</dt><dd>${report.updatedAt ? new Date(report.updatedAt).toLocaleString() : 'Unknown'}</dd></div>
        </dl>
    `;
}

function renderRecentActivityWidget(container) {
    const reports = getRecentReports().slice(0, 6);
    const security = getSecurityConfig();
    const audit = Array.isArray(security.auditLog) ? security.auditLog.slice(-6).reverse() : [];

    if (reports.length === 0 && audit.length === 0) {
        container.innerHTML = '<p>No recent activity is available yet.</p>';
        return;
    }

    const reportItems = reports.map((report) => `<li>Report updated: ${report.name} (${new Date(report.updatedAt || Date.now()).toLocaleString()})</li>`);
    const auditItems = audit.map((entry) => `<li>${entry.action} (${new Date(entry.at || Date.now()).toLocaleString()})</li>`);
    container.innerHTML = `
        <ul>
            ${[...reportItems, ...auditItems].slice(0, 8).join('')}
        </ul>
    `;
}

function renderNotificationsWidget(container) {
    const notices = [];
    const security = getSecurityConfig();

    if (hasUnsavedProjectChanges()) {
        notices.push('Project has unsaved changes.');
    }
    if (security.privacyModeEnabled) {
        notices.push('Privacy Mode is enabled. External integrations are blocked.');
    }
    if (String(security.networkActivityStatus || '').trim()) {
        notices.push(`Network activity status: ${security.networkActivityStatus}`);
    }

    if (notices.length === 0) {
        container.innerHTML = '<p>No notifications are available.</p>';
        return;
    }

    container.innerHTML = `<ul>${notices.map((notice) => `<li>${notice}</li>`).join('')}</ul>`;
}

function renderDashboardSearchWidget(container) {
    container.innerHTML = `
        <label for="dashboard-widget-search-input">Search Dashboard and Commands</label>
        <input id="dashboard-widget-search-input" type="search" autocomplete="off" spellcheck="false" aria-describedby="dashboard-widget-search-status" />
        <p id="dashboard-widget-search-status" class="open-report-status" role="status" aria-live="polite"></p>
        <div id="dashboard-widget-search-results" class="dashboard-widget__search-results" role="listbox" aria-label="Dashboard search results"></div>
    `;

    const input = container.querySelector('#dashboard-widget-search-input');
    const status = container.querySelector('#dashboard-widget-search-status');
    const results = container.querySelector('#dashboard-widget-search-results');
    if (!input || !status || !results) return;

    const controller = createSearchResultsController({
        container: results,
        statusElement: status,
        idPrefix: 'dashboard-search',
        listboxLabel: 'Dashboard search results',
        itemClass: 'dashboard-widget__search-result',
        itemActiveClass: 'is-selected',
        itemDisabledClass: 'is-disabled',
        titleClass: 'dashboard-widget__search-result-name',
        subtitleClass: 'dashboard-widget__search-result-meta',
        descriptionClass: 'dashboard-widget__search-result-description',
        emptyClass: 'dashboard-widget__status',
        emptyMessage: 'No matching dashboard content found.',
        onActivate: (item) => {
            executeUniversalSearchResult(item.result || item);
        },
        onSelectionChange: () => {
            const optionId = controller.getActiveOptionId();
            if (optionId) {
                input.setAttribute('aria-activedescendant', optionId);
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }
    });

    const renderResults = () => {
        const query = String(input.value || '').trim();

        const output = runUniversalSearch(query, {
            source: 'dashboard-widget-search',
            providerIds: ['commands', 'reports', 'dashboard-widgets'],
            scope: 'workspace',
            limit: 16
        });

        controller.setResults((output.results || []).map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: `${item.providerName}${item.subtitle ? ` | ${item.subtitle}` : ''}`,
            description: item.description,
            disabled: item.disabled,
            result: item
        })));

        status.textContent = `${output.totalResults} result${output.totalResults === 1 ? '' : 's'} available.`;
    };

    input?.addEventListener('input', renderResults);
    input?.addEventListener('keydown', (event) => {
        controller.handleKeydown(event);
    });
    renderResults();
}

function registerDashboardWidgetsIfNeeded() {
    if (dashboardWidgetsRegistered) return;

    registerDashboardWidget({
        id: 'quick-actions',
        name: 'Quick Actions',
        heading: 'Quick Actions',
        description: 'Primary project and report actions.',
        category: 'Workspace',
        resolveElement: () => document.querySelector('.action-group')
    });

    registerDashboardWidget({
        id: 'continue-working',
        name: 'Continue Working',
        heading: 'Continue Working',
        description: 'Resume recent report activity.',
        category: 'Workspace',
        resolveElement: () => document.getElementById('recent-reports-container')
    });

    registerDashboardWidget({
        id: 'current-project',
        name: 'Current Project',
        heading: 'Current Project',
        description: 'Project details and save state.',
        category: 'Projects',
        render: renderCurrentProjectWidget
    });

    registerDashboardWidget({
        id: 'current-report',
        name: 'Current Report',
        heading: 'Current Report',
        description: 'Current report details.',
        category: 'Reports',
        render: renderCurrentReportWidget
    });

    registerDashboardWidget({
        id: 'report-metrics',
        name: 'Report Metrics',
        heading: 'Report Metrics',
        description: 'Metrics for the selected report.',
        category: 'Reports',
        resolveElement: () => document.getElementById('report-metrics')
    });

    registerDashboardWidget({
        id: 'recent-activity',
        name: 'Recent Activity',
        heading: 'Recent Activity',
        description: 'Recent report and security activity.',
        category: 'Analytics',
        render: renderRecentActivityWidget
    });

    registerDashboardWidget({
        id: 'notifications',
        name: 'Notifications',
        heading: 'Notifications',
        description: 'Current dashboard notifications.',
        category: 'Workspace',
        render: renderNotificationsWidget
    });

    registerDashboardWidget({
        id: 'dashboard-search',
        name: 'Dashboard Search',
        heading: 'Dashboard Search',
        description: 'Search commands and recent reports.',
        category: 'Workspace',
        render: renderDashboardSearchWidget
    });

    dashboardWidgetsRegistered = true;
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
    const btnConfigureDashboard = document.getElementById('btn-configure-dashboard');
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
    const reportActionContainer = btnViewReportDashboard?.parentElement || btnConfigureReport?.parentElement || null;
    if (reportActionContainer && !document.getElementById('btn-open-working-view-dashboard')) {
        const openWorkingViewButton = document.createElement('button');
        openWorkingViewButton.type = 'button';
        openWorkingViewButton.id = 'btn-open-working-view-dashboard';
        openWorkingViewButton.textContent = 'Open Working View';
        reportActionContainer.appendChild(openWorkingViewButton);

        const loadWorkingViewButton = document.createElement('button');
        loadWorkingViewButton.type = 'button';
        loadWorkingViewButton.id = 'btn-load-working-view-dashboard';
        loadWorkingViewButton.textContent = 'Load Working View Preset';
        reportActionContainer.appendChild(loadWorkingViewButton);
    }
    const btnOpenWorkingViewDashboard = document.getElementById('btn-open-working-view-dashboard');
    const btnLoadWorkingViewDashboard = document.getElementById('btn-load-working-view-dashboard');
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
        const privacyMode = Boolean(security.privacyModeEnabled);

        if (privacyMode) {
            networkStatus.textContent = 'Privacy Mode Enabled';
            networkDetail.textContent = 'External integrations are blocked until Privacy Mode is disabled.';
            return;
        }

        networkStatus.textContent = String(security.networkActivityStatus || 'Offline');
        networkDetail.textContent = String(security.networkActivityDetail || 'No external connection activity.');
    };

    renderNetworkActivityIndicator();
    window.addEventListener('art-security-updated', renderNetworkActivityIndicator);

    const hasOpenReportWithUnsavedChanges = () => {
        if (!hasUnsavedProjectChanges()) return false;
        const selectedReportId = String(appState.selectedReportId || '').trim();
        if (!selectedReportId) return false;
        return Boolean(getReportById(selectedReportId));
    };

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
    importReportInput.id = 'report-import-file-input';
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

    const continueWorkingButton = document.createElement('button');
    continueWorkingButton.type = 'button';
    continueWorkingButton.id = 'btn-continue-working';
    continueWorkingButton.textContent = 'Continue Working';
    const recentReportsContainer = document.getElementById('recent-reports-container');
    if (recentReportsContainer && !document.getElementById('btn-continue-working')) {
        recentReportsContainer.insertBefore(continueWorkingButton, recentReportsContainer.firstChild);
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

    const executeDashboardAction = async (action, context = {}) => {
        const command = commandRegistry.findCommands({ action })[0] || null;
        if (!command?.id) return null;
        return commandExecutionService.executeCommand(command.id, {
            source: 'dashboard',
            action,
            ...context
        });
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

    const runOpenProjectPicker = async () => {
        const proceed = await confirmProceedWithUnsavedChanges();
        if (!proceed) return false;

        if (typeof window.showOpenFilePicker === 'function') {
            try {
                const [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{
                        description: 'ART Project Files',
                        accept: { 'application/json': ['.art'] }
                    }]
                });
                if (!handle) return false;
                const file = await handle.getFile();
                const text = await file.text();
                activeProjectFileHandle = handle;
                return openProjectFromText(text, file.name || handle.name || 'project.art');
            } catch (error) {
                // Fallback to hidden input when picker is unavailable or cancelled.
            }
        }

        openProjectInput.value = '';
        openProjectInput.click();
        return true;
    };

    runDashboardSaveProjectWorkflow = runSaveProject;
    runDashboardSaveProjectAsWorkflow = runSaveProjectAs;
    runDashboardOpenProjectWorkflow = runOpenProjectPicker;
    runDashboardImportReportPickerWorkflow = () => {
        importReportInput.value = '';
        importReportInput.click();
        return true;
    };
    runDashboardImportTemplatePickerWorkflow = () => {
        importTemplateInput.value = '';
        importTemplateInput.click();
        return true;
    };
    runDashboardConfigureWorkflow = () => openConfigureDashboardDialogFromCommand();

    initProjectWorkspaceFramework({
        onWorkspaceChanged: () => {
            refreshDashboardWidgetFramework();
        }
    });

    ensureDashboardStateShape();
    extractReportMetricsSection();
    registerDashboardWidgetsIfNeeded();
    initializeDashboardWidgetFramework({
        dashboardElement: document.getElementById('dashboard'),
        announce,
        executeAction: executeDashboardAction,
        loadConfig: () => appState.dashboard,
        persistConfig: (nextConfig, actionText) => {
            appState.dashboard = nextConfig;
            saveState({ action: actionText || 'Updated dashboard configuration', recordHistory: false });
            window.dispatchEvent(new Event('art-dashboard-config-updated'));
        },
        getContext: () => ({
            appState,
            reports: getRecentReports(),
            security: getSecurityConfig()
        })
    });

    btnSaveProject.addEventListener('click', async () => {
        await runSaveProject();
    });

    btnSaveProjectAs.addEventListener('click', async () => {
        await runSaveProjectAs();
    });

    btnOpenReport.addEventListener('click', async () => {
        await executeDashboardAction('openProject');
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
        void executeDashboardAction('importData');
    });

    btnConfigureDashboard?.addEventListener('click', () => {
        void executeDashboardAction('configureDashboard');
    });

    continueWorkingButton.addEventListener('click', () => {
        void executeDashboardAction('continueWorking');
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
                importConflictDialog.dataset.importPayload = JSON.stringify(importState);
                importConflictDialog.dataset.importFileName = selectedFile.name;
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
        if (!hasOpenReportWithUnsavedChanges()) return;
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
        void executeDashboardAction('importTemplate');
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
                templateImportConflictDialog.dataset.templatePayload = JSON.stringify(templatePayload);
                templateImportConflictDialog.dataset.templateFileName = selectedFile.name;
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
        void executeDashboardAction('exportTemplate', { templateId: templateSelect.value });
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
            refreshDashboardWidgetFramework();
            return;
        }
        const metrics = computeReportMetrics(selectedReport);
        const progressMetrics = getProgressLogMetrics(selectedReport);
        reportMetricsList.innerHTML = `
            <div><dt>Total Issues</dt><dd>${metrics.totalIssues}</dd></div>
            <div><dt>Pages Tested</dt><dd>${metrics.pagesTested}</dd></div>
            <div><dt>Issues by Severity</dt><dd>${metrics.issuesBySeverity}</dd></div>
            <div><dt>WCAG Success Criteria Referenced</dt><dd>${metrics.wcagCriteria}</dd></div>
            <div><dt>Total Audit Entries</dt><dd>${metrics.totalAuditEntries}</dd></div>
            ${progressMetrics.totalEvaluationItems > 0 ? `
                <div><dt>Total Evaluation Items</dt><dd>${progressMetrics.totalEvaluationItems}</dd></div>
                <div><dt>Completed</dt><dd>${progressMetrics.completed}</dd></div>
                <div><dt>Testing Completion</dt><dd>${progressMetrics.testingCompletionPercent}% (${progressMetrics.completed}/${progressMetrics.totalEvaluationItems})</dd></div>
                ${progressMetrics.inProgress > 0 ? `<div><dt>In Progress</dt><dd>${progressMetrics.inProgress}</dd></div>` : ''}
                ${progressMetrics.onHold > 0 ? `<div><dt>On Hold</dt><dd>${progressMetrics.onHold}</dd></div>` : ''}
                ${progressMetrics.blocked > 0 ? `<div><dt>Blocked</dt><dd>${progressMetrics.blocked}</dd></div>` : ''}
                ${progressMetrics.needsReview > 0 ? `<div><dt>Needs Review</dt><dd>${progressMetrics.needsReview}</dd></div>` : ''}
                ${progressMetrics.retestRequired > 0 ? `<div><dt>Retest Required</dt><dd>${progressMetrics.retestRequired}</dd></div>` : ''}
                ${progressMetrics.notApplicable > 0 ? `<div><dt>Not Applicable</dt><dd>${progressMetrics.notApplicable}</dd></div>` : ''}
            ` : ''}
        `;
        refreshDashboardWidgetFramework();
    };

    const rebuildRecentReports = () => {
        const reports = getRecentReports();
        const currentSelection = appState.selectedReportId;

        const reportOptions = reports.map((report) => `<option value="${report.id}">${report.name}</option>`);
        const emptyLabel = reportOptions.length > 0
            ? 'No item selected'
            : 'No recent reports';

        recentReportsSelect.innerHTML = `<option value="">${emptyLabel}</option>${reportOptions.join('')}`;

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
        if (btnOpenWorkingViewDashboard) btnOpenWorkingViewDashboard.disabled = !hasReportSelection;
        if (btnLoadWorkingViewDashboard) btnLoadWorkingViewDashboard.disabled = !hasReportSelection;
        btnCloseActiveReport.disabled = !hasReportSelection;
        refreshReportMetrics();
        refreshDashboardWidgetFramework();
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
        void executeDashboardAction('newReport');
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
            void executeDashboardAction('newTemplate');
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
        void executeDashboardAction('newTemplate', { templateId: sourceTemplateId, templateName });
    });

    btnCreateCancel.addEventListener('click', () => {
        closeDialog(createDialog, true);
        pendingCreateSourceTemplateId = null;
        btnCreate.focus();
    });

    btnOpen.addEventListener('click', () => {
        void executeDashboardAction('openTemplate', { templateId: templateSelect.value });
    });

    btnUse.addEventListener('click', () => {
        void executeDashboardAction('useTemplate', { templateId: templateSelect.value });
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

        void executeDashboardAction('editTemplate', { templateId: selectedTemplateId });
    });

    btnEditYes.addEventListener('click', () => {
        if (!pendingEditTemplateId) return;
        const sourceTemplateId = pendingEditTemplateId;
        closeEditConfirmDialog(true);
        void executeDashboardAction('editTemplate', { templateId: sourceTemplateId, createEditableCopy: true });
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

        const templateId = pendingDeleteTemplateId;
        closeDialog(deleteDialog, false);
        pendingDeleteTemplateId = null;
        void executeDashboardAction('deleteTemplate', { templateId, confirm: true });
    });

    recentReportsSelect.addEventListener('change', () => {
        const selected = String(recentReportsSelect.value || '');
        appState.selectedReportId = selected.startsWith('project:') ? '' : selected;
        saveState({ action: 'Selected dashboard report', recordHistory: false });
        const hasReportSelection = Boolean(selected) && !selected.startsWith('project:');
        btnConfigureReport.disabled = !hasReportSelection;
        btnEditReportDashboard.disabled = !hasReportSelection;
        btnViewReportDashboard.disabled = !hasReportSelection;
        btnDeleteReportDashboard.disabled = !hasReportSelection;
        if (btnOpenWorkingViewDashboard) btnOpenWorkingViewDashboard.disabled = !hasReportSelection;
        if (btnLoadWorkingViewDashboard) btnLoadWorkingViewDashboard.disabled = !hasReportSelection;
        btnCloseActiveReport.disabled = !hasReportSelection;

        if (selected.startsWith('project:')) {
            announce('Recent project entry selected. Use Open ART Project to choose the project file from storage.');
        }
        refreshReportMetrics();
    });

    btnCloseActiveReport.addEventListener('click', () => {
        void executeDashboardAction('closeReport', { reportId: recentReportsSelect.value });
    });

    btnConfigureReport.addEventListener('click', () => {
        void executeDashboardAction('configureReport', { reportId: recentReportsSelect.value });
    });

    btnEditReportDashboard.addEventListener('click', () => {
        void executeDashboardAction('editReport', { reportId: recentReportsSelect.value });
    });

    btnViewReportDashboard.addEventListener('click', () => {
        void executeDashboardAction('viewReport', { reportId: recentReportsSelect.value });
    });

    if (btnOpenWorkingViewDashboard) {
        btnOpenWorkingViewDashboard.addEventListener('click', () => {
            const reportId = String(recentReportsSelect.value || '').trim();
            if (!reportId || reportId.startsWith('project:')) return;
            void executeDashboardAction('openWorkingView', {
                reportId,
                showConfig: true
            });
        });
    }

    if (btnLoadWorkingViewDashboard) {
        btnLoadWorkingViewDashboard.addEventListener('click', () => {
            const reportId = String(recentReportsSelect.value || '').trim();
            if (!reportId || reportId.startsWith('project:')) return;
            void executeDashboardAction('loadWorkingView', {
                reportId
            });
        });
    }

    btnDeleteReportDashboard.addEventListener('click', () => {
        pendingDeleteReportId = recentReportsSelect.value;
        void executeDashboardAction('deleteReport', { reportId: pendingDeleteReportId });
    });

    btnReportDeleteCancel.addEventListener('click', () => {
        pendingDeleteReportId = null;
        closeDialog(reportDeleteDialog, true);
        btnDeleteReportDashboard.focus();
    });

    btnReportDeleteConfirm.addEventListener('click', () => {
        const reportId = btnReportDeleteConfirm.getAttribute('data-report-id') || pendingDeleteReportId;
        if (!reportId) return;
        pendingDeleteReportId = null;
        void executeDashboardAction('deleteReport', { reportId, confirm: true });
    });

    btnImportReplace.addEventListener('click', () => {
        void executeDashboardAction('importData', { strategy: 'replace' });
        pendingImportPayload = null;
        pendingImportFileName = '';
    });

    btnImportCopy.addEventListener('click', () => {
        void executeDashboardAction('importData', { strategy: 'copy' });
        pendingImportPayload = null;
        pendingImportFileName = '';
    });

    btnImportCancel.addEventListener('click', () => {
        pendingImportPayload = null;
        pendingImportFileName = '';
        importConflictDialog.removeAttribute('data-import-payload');
        importConflictDialog.removeAttribute('data-import-file-name');
        closeDialog(importConflictDialog, true);
        btnImportData.focus();
    });

    templateImportConfirm.addEventListener('click', () => {
        const strategy = templateImportConflictDialog.querySelector('input[name="template-import-conflict"]:checked')?.value || 'replace';
        void executeDashboardAction('importTemplate', { strategy });
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
    });

    templateImportCancel.addEventListener('click', () => {
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
        templateImportConflictDialog.removeAttribute('data-template-payload');
        templateImportConflictDialog.removeAttribute('data-template-file-name');
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
        importConflictDialog.removeAttribute('data-import-payload');
        importConflictDialog.removeAttribute('data-import-file-name');
        closeDialog(importConflictDialog, true);
        btnImportData.focus();
    });

    templateImportConflictDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        pendingTemplateImportPayload = null;
        pendingTemplateImportFileName = '';
        templateImportConflictDialog.removeAttribute('data-template-payload');
        templateImportConflictDialog.removeAttribute('data-template-file-name');
        closeDialog(templateImportConflictDialog, true);
        btnTemplateImport.focus();
    });

    window.addEventListener('art-reports-updated', rebuildRecentReports);
    window.addEventListener('art-state-restored', rebuildRecentReports);
    window.addEventListener('art-progress-log-updated', refreshReportMetrics);
    window.addEventListener('art-security-updated', refreshDashboardWidgetFramework);
    window.addEventListener('art-dashboard-config-updated', refreshDashboardWidgetFramework);

    const projectInfo = getProjectDocumentInfo();
    if (projectInfo.hasRecoveredChanges && hasOpenReportWithUnsavedChanges()) {
        markProjectRecovered(projectInfo.recoveryLabel || 'Recovered changes are available.');
        announce(projectInfo.recoveryLabel || 'A previous unsaved version of this project was found.');
    }
    rebuildRecentReports();
    refreshDashboardWidgetFramework();
}
