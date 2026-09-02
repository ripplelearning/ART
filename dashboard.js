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
import { getOrganizationMetricsConfig } from './state.js';
import { createSearchResultsController } from './searchResultsFramework.js';
import {
    getWorkspaceExplorerSummary,
    initProjectWorkspaceFramework
} from './projectWorkspaceFramework.js';
import { getPluginFrameworkSnapshot, registerPackageFromWorkflow } from './pluginFramework.js';
import { getResourceOrganizationSnapshot, openSavedViewFromCommand } from './resourceOrganizationFramework.js';
import { isWorkingViewActiveForCurrentReport } from './reportViewsFramework.js';

import {
    addAuditEntry,
    announce,
    appState,
    canShowCollaborationToolbar,
    createArtProjectPayload,
    createUserTemplateFromSelection,
    closeCurrentReportSession,
    clearProjectRecoveryMark,
    computeReportMetrics,
    getAnalyticsConfig,
    getAnalyticsTrendSnapshot,
    getCollaborationConfig,
    getReportAnalyticsSnapshot,
    getProgressLogMetrics,
    getWorkspaceAnalyticsSnapshot,
    deleteUserTemplate,
    deleteReportById,
    getAuditEntries,
    getBuiltInTemplates,
    getProjectDocumentInfo,
    getRecentReports,
    getReportById,
    getSecurityConfig,
    getTasks,
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
    setTaskCompleted,
    serializeArtProjectPayload,
    serializeArtxTemplatePayload,
    templateNameExists,
    updateCollaborationConfig,
    upsertCurrentReport,
    updateProjectDocumentInfo,
    validateArtProjectPayload,
    validateArtJsonPayload,
    validateArtxTemplatePayload,
    validateTemplateJsonPayload
} from './state.js';
import { openSettingsCollaborationSectionFromCommand } from './settings.js';
import { calculateOrganizationMetrics, getOrganizationSummaries } from './organizationMetricsFramework.js';
import { openOrganizationStatistics } from './organizationDashboard.js';
import { openTasksDialog } from './taskFramework.js';
import {
    connectGoogleDrive,
    createArtFile,
    downloadArtFileContent,
    getGoogleDriveConnectionStatus,
    listArtFiles,
    updateArtFile
} from './googleDriveStorageProvider.js';
import {
    connectOneDrive,
    createArtFile as createOneDriveArtFile,
    downloadArtFileContent as downloadOneDriveArtFileContent,
    getOneDriveConnectionStatus,
    listArtFiles as listOneDriveArtFiles,
    updateArtFile as updateOneDriveArtFile
} from './oneDriveStorageProvider.js';
import {
    connectDropbox,
    createArtFile as createDropboxArtFile,
    downloadArtFileContent as downloadDropboxArtFileContent,
    getDropboxConnectionStatus,
    listArtFiles as listDropboxArtFiles,
    updateArtFile as updateDropboxArtFile
} from './dropboxStorageProvider.js';
import { isStorageProviderConnected } from './storageProviderFramework.js';
import {
    getActiveStorageSummary,
    refreshActiveStorage,
    synchronizeActiveStorage
} from './storageSynchronizationFramework.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function moveFocusToEditorHeading() {
    const editorHeading = document.getElementById('editor-heading');
    if (editorHeading) editorHeading.focus();
}

let activeProjectFileHandle = null;
let runDashboardOpenProjectWorkflow = null;
let runDashboardSaveProjectWorkflow = null;
let runDashboardSaveProjectAsWorkflow = null;
let runDashboardOpenGoogleDriveWorkflow = null;
let runDashboardSaveGoogleDriveWorkflow = null;
let runDashboardOpenOneDriveWorkflow = null;
let runDashboardSaveOneDriveWorkflow = null;
let runDashboardOpenDropboxWorkflow = null;
let runDashboardSaveDropboxWorkflow = null;
let runDashboardImportReportPickerWorkflow = null;
let runDashboardImportTemplatePickerWorkflow = null;
let runDashboardConfigureWorkflow = null;
let dashboardWidgetsRegistered = false;
let storageSyncPanelEventBound = false;

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

export async function openDashboardProjectFromGoogleDriveFromCommand() {
    if (typeof runDashboardOpenGoogleDriveWorkflow !== 'function') return false;
    return runDashboardOpenGoogleDriveWorkflow();
}

export async function saveDashboardProjectToGoogleDriveFromCommand() {
    if (typeof runDashboardSaveGoogleDriveWorkflow !== 'function') return false;
    return runDashboardSaveGoogleDriveWorkflow();
}

export async function openDashboardProjectFromOneDriveFromCommand() {
    if (typeof runDashboardOpenOneDriveWorkflow !== 'function') return false;
    return runDashboardOpenOneDriveWorkflow();
}

export async function saveDashboardProjectToOneDriveFromCommand() {
    if (typeof runDashboardSaveOneDriveWorkflow !== 'function') return false;
    return runDashboardSaveOneDriveWorkflow();
}

export async function openDashboardProjectFromDropboxFromCommand() {
    if (typeof runDashboardOpenDropboxWorkflow !== 'function') return false;
    return runDashboardOpenDropboxWorkflow();
}

export async function saveDashboardProjectToDropboxFromCommand() {
    if (typeof runDashboardSaveDropboxWorkflow !== 'function') return false;
    return runDashboardSaveDropboxWorkflow();
}

function renderStorageSynchronizationPanel() {
    const statusElement = document.getElementById('storage-sync-status');
    const refreshButton = document.getElementById('btn-storage-refresh');
    const synchronizeButton = document.getElementById('btn-storage-synchronize');
    if (!statusElement || !refreshButton || !synchronizeButton) return;

    const summary = getActiveStorageSummary();
    statusElement.textContent = `${summary.providerName}: ${summary.syncStatusLabel}. ${summary.syncMessage}`;
    refreshButton.disabled = false;
    synchronizeButton.disabled = !summary.connected || !summary.fileId || summary.providerId === 'local' || summary.providerId === 'network-folder';

    if (refreshButton.dataset.bound !== 'true') {
        refreshButton.dataset.bound = 'true';
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true;
            const result = await refreshActiveStorage();
            statusElement.textContent = result.message || getActiveStorageSummary().syncMessage;
            renderStorageSynchronizationPanel();
            announce(result.message || 'Storage refresh completed.');
        });
    }
    if (synchronizeButton.dataset.bound !== 'true') {
        synchronizeButton.dataset.bound = 'true';
        synchronizeButton.addEventListener('click', async () => {
            synchronizeButton.disabled = true;
            const result = await synchronizeActiveStorage();
            statusElement.textContent = result.message || getActiveStorageSummary().syncMessage;
            renderStorageSynchronizationPanel();
            announce(result.message || 'Storage synchronization completed.');
        });
    }
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
    buttons.rename.hidden = !isUserTemplate;
    buttons.replace.hidden = !isUserTemplate;
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
            'dashboard-analytics',
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
            'dashboard-analytics',
            'recent-activity',
            'notifications',
            'dashboard-search'
        ],
        collapsedWidgets: {},
        tabs: [
            { id: 'workspace', name: 'Workspace', widgetIds: ['quick-actions', 'continue-working', 'recent-activity', 'notifications', 'dashboard-search'] },
            { id: 'projects', name: 'Projects', widgetIds: ['current-project'] },
            { id: 'reports', name: 'Reports', widgetIds: ['current-report', 'report-metrics'] },
            { id: 'analytics', name: 'Analytics', widgetIds: ['dashboard-analytics', 'recent-activity'] }
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

function renderOrganizationOverviewWidget(container) {
    const snapshot = getResourceOrganizationSnapshot();
    const unresolved = Number(snapshot.unresolvedReferences?.length || 0);
    container.innerHTML = `
        <dl class="dashboard-widget__definition-list">
            <div><dt>Tags</dt><dd>${snapshot.tags.length}</dd></div>
            <div><dt>Collections</dt><dd>${snapshot.collections.length}</dd></div>
            <div><dt>Saved Views</dt><dd>${snapshot.savedViews.length}</dd></div>
            <div><dt>Unresolved References</dt><dd>${unresolved}</dd></div>
        </dl>
    `;
}

function renderOrganizationStatisticsWidget(container) {
    const config = getOrganizationMetricsConfig();
    if (!config.enabled || config.dashboardSectionVisible === false) {
        container.innerHTML = '<p>Organization Statistics section is hidden.</p>';
        return;
    }

    const summaries = getOrganizationSummaries();
    if (summaries.length === 0) {
        container.innerHTML = '<p>No reports contain an Organization/Client value yet. Add an Organization/Client value in Report Metadata to build organization statistics.</p>';
        return;
    }

    const selected = summaries.find((entry) => entry.key === config.selectedOrganization) || summaries[0];
    const result = calculateOrganizationMetrics({ organization: selected.displayName }, {
        metricIds: ['totalReports', 'totalFindings', 'uniqueProducts', 'uniqueTesters']
    });

    const renderValue = (metricId) => {
        const metric = result.metrics[metricId];
        if (!metric || metric.availability !== 'available') return 'Not available';
        return String(metric.value);
    };

    container.innerHTML = `
        <p>Organization: <strong>${escapeHtml(selected.displayName)}</strong></p>
        <dl class="dashboard-widget__definition-list">
            <div><dt>Reports</dt><dd>${escapeHtml(renderValue('totalReports'))}</dd></div>
            <div><dt>Findings</dt><dd>${escapeHtml(renderValue('totalFindings'))}</dd></div>
            <div><dt>Products</dt><dd>${escapeHtml(renderValue('uniqueProducts'))}</dd></div>
            <div><dt>Unique Testers</dt><dd>${escapeHtml(renderValue('uniqueTesters'))}</dd></div>
        </dl>
        <button id="btn-dashboard-organization-statistics" type="button">Open Organization Statistics</button>
    `;

    container.querySelector('#btn-dashboard-organization-statistics')?.addEventListener('click', (event) => {
        openOrganizationStatistics(event.currentTarget);
    });
}

function renderRecentSavedViewsWidget(container) {
    const snapshot = getResourceOrganizationSnapshot();
    const recentIds = Array.isArray(snapshot.recent?.savedViews) ? snapshot.recent.savedViews : [];
    const idSet = new Set(recentIds);
    const ordered = snapshot.savedViews
        .filter((savedView) => idSet.has(savedView.id))
        .sort((left, right) => recentIds.indexOf(left.id) - recentIds.indexOf(right.id))
        .slice(0, 6);

    if (!ordered.length) {
        container.innerHTML = '<p>No recently used Saved Views.</p>';
        return;
    }

    container.innerHTML = `
        <ul class="dashboard-widget__list">
            ${ordered.map((savedView) => `
                <li>
                    <button type="button" data-dashboard-saved-view-id="${savedView.id}">${savedView.name}</button>
                </li>
            `).join('')}
        </ul>
    `;

    container.querySelectorAll('[data-dashboard-saved-view-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const savedViewId = button.getAttribute('data-dashboard-saved-view-id') || '';
            if (!savedViewId) return;
            openSavedViewFromCommand({ savedViewId });
        });
    });
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

function formatNumeric(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return String(Math.round(number));
}

function formatCountList(list = [], limit = 5, emptyLabel = 'None') {
    const items = (Array.isArray(list) ? list : [])
        .filter((item) => String(item?.label || '').trim() && Number(item?.count || 0) > 0)
        .slice(0, Math.max(1, Number(limit || 1)));
    if (items.length === 0) return emptyLabel;
    return items.map((item) => `${item.label}: ${item.count}`).join(', ');
}

function formatTrendDirection(direction = 'no-baseline') {
    if (direction === 'up') return 'Increasing';
    if (direction === 'down') return 'Decreasing';
    if (direction === 'flat') return 'Stable';
    return 'Insufficient baseline';
}

function formatTrendDelta(value = 0) {
    const delta = Number(value || 0);
    if (!Number.isFinite(delta)) return '0';
    if (delta > 0) return `+${delta}`;
    return String(delta);
}

function findTrendGroupByPrefix(groups = [], prefix = '', value = '') {
    const key = `${String(prefix || '').trim()}:${String(value || '').trim().toLowerCase()}`;
    return (Array.isArray(groups) ? groups : []).find((group) => String(group.id || '').toLowerCase() === key) || null;
}

function buildDefinitionList(items = []) {
    const list = document.createElement('dl');
    list.className = 'dashboard-widget__definition-list';
    items.forEach((item) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = String(item.label || 'Metric');
        detail.textContent = String(item.value || '0');
        row.append(term, detail);
        list.appendChild(row);
    });
    return list;
}

function buildAnalyticsSection({
    id,
    title,
    description,
    expanded,
    emphasizeDescription,
    contentNode
}) {
    const section = document.createElement('section');
    section.className = 'dashboard-analytics-section';

    const heading = document.createElement('h4');
    heading.className = 'dashboard-analytics-section__heading';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dashboard-widget__toggle';
    toggle.id = `dashboard-analytics-toggle-${id}`;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.setAttribute('aria-controls', `dashboard-analytics-panel-${id}`);
    toggle.textContent = title;
    heading.appendChild(toggle);

    const panel = document.createElement('div');
    panel.className = 'dashboard-analytics-section__panel';
    panel.id = `dashboard-analytics-panel-${id}`;
    panel.hidden = !expanded;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', toggle.id);

    if (description && emphasizeDescription) {
        const descriptionNode = document.createElement('p');
        descriptionNode.className = 'dashboard-widget__status';
        descriptionNode.textContent = description;
        panel.appendChild(descriptionNode);
    }
    if (contentNode) panel.appendChild(contentNode);

    toggle.addEventListener('click', () => {
        const nextExpanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
        panel.hidden = !nextExpanded;
    });

    section.append(heading, panel);
    return section;
}

function getPluginAnalyticsSections() {
    try {
        const snapshot = getPluginFrameworkSnapshot();
        const dashboardCards = Array.isArray(snapshot?.extensionRegistry?.dashboardCards)
            ? snapshot.extensionRegistry.dashboardCards
            : [];

        return dashboardCards
            .map((entry, index) => {
                const value = entry && typeof entry === 'object' ? (entry.value || {}) : {};
                const analyticsValue = value.analyticsSection && typeof value.analyticsSection === 'object'
                    ? value.analyticsSection
                    : value;
                const category = String(value.category || analyticsValue.category || '').trim().toLowerCase();
                const include = Boolean(value.analyticsSection) || category === 'analytics';
                if (!include) return null;

                const title = String(analyticsValue.title || analyticsValue.heading || analyticsValue.name || `Plugin Analytics ${index + 1}`).trim();
                const description = String(analyticsValue.description || '').trim();
                const items = Array.isArray(analyticsValue.items)
                    ? analyticsValue.items
                        .map((item) => ({
                            label: String(item?.label || '').trim(),
                            value: String(item?.value ?? '').trim()
                        }))
                        .filter((item) => item.label)
                    : [];

                return {
                    id: `plugin-${String(entry?.pluginId || 'analytics').trim()}-${index + 1}`,
                    title,
                    description,
                    items
                };
            })
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function renderDashboardAnalyticsWidget(container) {
    const analyticsConfig = getAnalyticsConfig();
    const reportAnalytics = getReportAnalyticsSnapshot();
    const workspaceAnalytics = getWorkspaceAnalyticsSnapshot();
    const trendSnapshot = getAnalyticsTrendSnapshot({
        includeUnrelatedReports: analyticsConfig.displayOptions?.showUnrelatedReportTrends === true
    });

    container.innerHTML = '';

    if (!reportAnalytics && !workspaceAnalytics) {
        const message = document.createElement('p');
        message.className = 'dashboard-widget__status';
        message.textContent = 'Open a report, Working View, or Project Workspace to view dashboard analytics.';
        container.appendChild(message);

        const actions = document.createElement('div');
        actions.className = 'viewer-dialog-actions';
        const customizeButton = document.createElement('button');
        customizeButton.type = 'button';
        customizeButton.textContent = 'Customize Analytics...';
        customizeButton.addEventListener('click', () => {
            const command = commandRegistry.findCommands({ action: 'settingsCustomizeAnalytics' })[0] || null;
            if (!command?.id) return;
            commandExecutionService.executeCommand(command.id, { source: 'dashboard', action: 'settingsCustomizeAnalytics' });
        });
        actions.appendChild(customizeButton);
        container.appendChild(actions);
        return;
    }

    const pluginSections = getPluginAnalyticsSections();
    const expanded = new Set(Array.isArray(analyticsConfig.expandedSections) ? analyticsConfig.expandedSections : []);
    const showPercentages = analyticsConfig.displayOptions?.showPercentages !== false;
    const showTrendPlaceholders = analyticsConfig.displayOptions?.showTrendPlaceholders !== false;
    const showPluginSections = analyticsConfig.displayOptions?.showPluginSections !== false;
    const emphasizeDescriptions = analyticsConfig.accessibilityOptions?.emphasizeSectionDescriptions !== false;
    const shouldAnnounceScope = analyticsConfig.accessibilityOptions?.announceScopeChanges !== false;

    const controlsWrap = document.createElement('div');
    controlsWrap.className = 'viewer-dialog-actions';
    controlsWrap.setAttribute('role', 'group');
    controlsWrap.setAttribute('aria-label', 'Analytics actions');

    const customizeButton = document.createElement('button');
    customizeButton.type = 'button';
    customizeButton.textContent = 'Customize Analytics...';
    customizeButton.addEventListener('click', () => {
        const command = commandRegistry.findCommands({ action: 'settingsCustomizeAnalytics' })[0] || null;
        if (!command?.id) return;
        commandExecutionService.executeCommand(command.id, { source: 'dashboard', action: 'settingsCustomizeAnalytics' });
    });
    controlsWrap.appendChild(customizeButton);
    container.appendChild(controlsWrap);

    const workingViewActive = isWorkingViewActiveForCurrentReport();
    const supportsScopeSwitch = Boolean(reportAnalytics && workspaceAnalytics);

    let activeScope = 'workspace';
    if (reportAnalytics) {
        const preferred = String(analyticsConfig.defaultScope || 'auto').trim().toLowerCase();
        if (preferred === 'workspace' && workspaceAnalytics) {
            activeScope = 'workspace';
        } else {
            activeScope = 'report';
        }
    } else if (workspaceAnalytics) {
        activeScope = 'workspace';
    }

    const scopeStatus = document.createElement('p');
    scopeStatus.className = 'dashboard-widget__status';
    scopeStatus.setAttribute('role', 'status');
    scopeStatus.setAttribute('aria-live', 'polite');

    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'dashboard-analytics-sections';

    const renderScopeSections = () => {
        sectionsHost.innerHTML = '';
        const isReportScope = activeScope === 'report' && Boolean(reportAnalytics);

        if (isReportScope && reportAnalytics) {
            const reportOverview = buildDefinitionList([
                { label: 'Report Name', value: reportAnalytics.reportName },
                { label: 'Report Type', value: reportAnalytics.reportType || 'Not specified' },
                { label: 'Total Issues', value: formatNumeric(reportAnalytics.metrics.totalIssues) },
                { label: 'Pages Tested', value: formatNumeric(reportAnalytics.metrics.pagesTested) }
            ]);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'report-overview',
                title: 'Report Overview',
                description: 'Summary for the currently active Working View report.',
                expanded: expanded.has('report-overview'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: reportOverview
            }));

            const reportFindings = buildDefinitionList([
                { label: 'Issues by Severity', value: String(reportAnalytics.metrics.issuesBySeverity || 'None') },
                { label: 'WCAG Criteria Referenced', value: formatNumeric(reportAnalytics.metrics.wcagCriteria) },
                { label: 'Audit Entries', value: formatNumeric(reportAnalytics.metrics.totalAuditEntries) },
                { label: 'Most Frequent Issue Type', value: reportAnalytics.insights?.topIssueType ? `${reportAnalytics.insights.topIssueType.label} (${reportAnalytics.insights.topIssueType.count})` : 'Not enough data' },
                { label: 'Most Frequent Severity', value: reportAnalytics.insights?.topSeverity ? `${reportAnalytics.insights.topSeverity.label} (${reportAnalytics.insights.topSeverity.count})` : 'Not enough data' },
                { label: 'Issue Types (Top)', value: formatCountList(reportAnalytics.insights?.issueTypeCounts, 5, 'No issue type field detected') },
                { label: 'Severity Breakdown', value: formatCountList(reportAnalytics.insights?.severityCounts, 5, 'No severity field detected') },
                { label: 'Status Breakdown', value: formatCountList(reportAnalytics.insights?.statusCounts, 4, 'No status field detected') },
                { label: 'Most Affected Page', value: reportAnalytics.insights?.topPage ? `${reportAnalytics.insights.topPage.label} (${reportAnalytics.insights.topPage.count})` : 'No page field detected' }
            ]);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'report-findings',
                title: 'Findings and Coverage',
                description: 'Issue distribution, dominant issue patterns, and standards coverage for this report.',
                expanded: expanded.has('report-findings'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: reportFindings
            }));

            const reportProgressItems = [
                { label: 'Evaluation Items', value: formatNumeric(reportAnalytics.progress.totalEvaluationItems) },
                { label: 'Completed', value: formatNumeric(reportAnalytics.progress.completed) }
            ];
            if (showPercentages) {
                reportProgressItems.push({ label: 'Testing Completion', value: `${formatNumeric(reportAnalytics.progress.testingCompletionPercent)}%` });
            }
            const reportProgress = buildDefinitionList(reportProgressItems);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'report-progress',
                title: 'Progress',
                description: 'Evaluation workflow progress for this report.',
                expanded: expanded.has('report-progress'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: reportProgress
            }));
        } else {
            const workspaceOverview = buildDefinitionList([
                { label: 'Workspace Name', value: workspaceAnalytics.workspaceName || 'Untitled Workspace' },
                { label: 'Total Reports', value: formatNumeric(workspaceAnalytics.statistics.totalReports) },
                { label: 'Project Assets', value: formatNumeric(workspaceAnalytics.statistics.projectAssets) },
                { label: 'Validation Status', value: String(workspaceAnalytics.health.validationStatus || 'unknown') }
            ]);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'workspace-overview',
                title: 'Workspace Overview',
                description: 'Top-level health and inventory snapshot for the active workspace.',
                expanded: expanded.has('workspace-overview'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: workspaceOverview
            }));

            const findingsItems = [
                { label: 'Accessibility Findings', value: formatNumeric(workspaceAnalytics.statistics.accessibilityFindings) },
                { label: 'Open Findings', value: formatNumeric(workspaceAnalytics.statistics.openFindings) },
                { label: 'Resolved Findings', value: formatNumeric(workspaceAnalytics.statistics.resolvedFindings) },
                { label: 'Deferred Findings', value: formatNumeric(workspaceAnalytics.statistics.deferredFindings) },
                { label: 'Most Frequent Issue Type', value: workspaceAnalytics.insights?.topIssueType ? `${workspaceAnalytics.insights.topIssueType.label} (${workspaceAnalytics.insights.topIssueType.count})` : 'Not enough data' },
                { label: 'Most Frequent Severity', value: workspaceAnalytics.insights?.topSeverity ? `${workspaceAnalytics.insights.topSeverity.label} (${workspaceAnalytics.insights.topSeverity.count})` : 'Not enough data' },
                { label: 'Issue Types (Top)', value: formatCountList(workspaceAnalytics.insights?.issueTypeCounts, 5, 'No issue type field detected') },
                { label: 'Severity Breakdown', value: formatCountList(workspaceAnalytics.insights?.severityCounts, 5, 'No severity field detected') },
                { label: 'Status Breakdown', value: formatCountList(workspaceAnalytics.insights?.statusCounts, 4, 'No status field detected') },
                { label: 'Most Affected Page', value: workspaceAnalytics.insights?.topPage ? `${workspaceAnalytics.insights.topPage.label} (${workspaceAnalytics.insights.topPage.count})` : 'No page field detected' }
            ];
            if (showPercentages) {
                const total = Number(workspaceAnalytics.statistics.accessibilityFindings || 0);
                const resolved = Number(workspaceAnalytics.statistics.resolvedFindings || 0);
                const percent = total > 0 ? Math.round((resolved / total) * 100) : 0;
                findingsItems.push({ label: 'Resolution Rate', value: `${formatNumeric(percent)}%` });
            }
            const findings = buildDefinitionList(findingsItems);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'workspace-findings',
                title: 'Findings and Severity',
                description: 'Open, resolved, and deferred finding counts across workspace reports.',
                expanded: expanded.has('workspace-findings'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: findings
            }));

            const progressItems = [
                { label: 'Evaluation Items', value: formatNumeric(workspaceAnalytics.progressAggregate.totalEvaluationItems) },
                { label: 'Completed', value: formatNumeric(workspaceAnalytics.progressAggregate.completed) }
            ];
            if (showPercentages) {
                progressItems.push({ label: 'Testing Completion', value: `${formatNumeric(workspaceAnalytics.progressAggregate.completionPercent)}%` });
            }
            const progress = buildDefinitionList(progressItems);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'workspace-progress',
                title: 'Progress',
                description: 'Progress Log completion status across associated reports.',
                expanded: expanded.has('workspace-progress'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: progress
            }));

            const quality = buildDefinitionList([
                { label: 'Project Completion', value: `${formatNumeric(workspaceAnalytics.health.projectCompletion)}%` },
                { label: 'Reports Remaining', value: formatNumeric(workspaceAnalytics.health.reportsRemaining) },
                { label: 'Relationships', value: formatNumeric(workspaceAnalytics.statistics.relationships) },
                { label: 'Recent Changes', value: formatNumeric(workspaceAnalytics.health.recentChanges) }
            ]);
            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'workspace-quality',
                title: 'Quality and Health',
                description: 'Quality indicators derived from workspace completion and relationships.',
                expanded: expanded.has('workspace-quality'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: quality
            }));

            if (showTrendPlaceholders) {
                const workspaceTrend = findTrendGroupByPrefix(trendSnapshot.workspaceTrends, 'workspace', workspaceAnalytics.workspaceId);
                const trendItems = workspaceTrend
                    ? [
                        { label: 'Active Workspace Trend Direction', value: formatTrendDirection(workspaceTrend.direction) },
                        { label: 'Issue Delta vs Previous Report', value: formatTrendDelta(workspaceTrend.deltaTotalIssues) },
                        { label: 'Workspace Reports in Trend', value: formatNumeric(workspaceTrend.reportCount) },
                        { label: 'Latest Workspace Report', value: workspaceTrend.latest?.reportName || 'Not enough data' },
                        { label: 'Latest Report Issues', value: formatNumeric(workspaceTrend.latest?.totalIssues || 0) },
                        { label: 'Previous Report Issues', value: workspaceTrend.previous ? formatNumeric(workspaceTrend.previous.totalIssues) : 'Not enough data' },
                        { label: 'Top Issue Type (Latest)', value: workspaceTrend.latest?.topIssueType ? `${workspaceTrend.latest.topIssueType.label} (${workspaceTrend.latest.topIssueType.count})` : 'Not enough data' },
                        { label: 'Top Severity (Latest)', value: workspaceTrend.latest?.topSeverity ? `${workspaceTrend.latest.topSeverity.label} (${workspaceTrend.latest.topSeverity.count})` : 'Not enough data' }
                    ]
                    : [
                        { label: 'Workspace Trend', value: 'No report history is available for this workspace yet.' }
                    ];

                const otherWorkspaceTrends = (trendSnapshot.workspaceTrends || [])
                    .filter((group) => group.id !== `workspace:${workspaceAnalytics.workspaceId}`)
                    .slice(0, 4)
                    .map((group) => `${group.label}: ${formatTrendDirection(group.direction)} (${formatTrendDelta(group.deltaTotalIssues)})`);

                if (otherWorkspaceTrends.length > 0) {
                    trendItems.push({
                        label: 'Other Workspace Trends',
                        value: otherWorkspaceTrends.join(' | ')
                    });
                }

                const trendText = buildDefinitionList(trendItems);
                sectionsHost.appendChild(buildAnalyticsSection({
                    id: 'workspace-activity',
                    title: 'Activity and Trends',
                    description: 'Trend signals within the active workspace and comparisons with other workspaces.',
                    expanded: expanded.has('workspace-activity'),
                    emphasizeDescription: emphasizeDescriptions,
                    contentNode: trendText
                }));
            }
        }

        if (showPluginSections && pluginSections.length > 0) {
            pluginSections.forEach((pluginSection) => {
                const content = pluginSection.items.length > 0
                    ? buildDefinitionList(pluginSection.items)
                    : (() => {
                        const empty = document.createElement('p');
                        empty.className = 'dashboard-widget__status';
                        empty.textContent = 'Plugin section is available but has no metrics to display yet.';
                        return empty;
                    })();
                sectionsHost.appendChild(buildAnalyticsSection({
                    id: pluginSection.id,
                    title: pluginSection.title,
                    description: pluginSection.description,
                    expanded: expanded.has(pluginSection.id) || expanded.has('plugin-default'),
                    emphasizeDescription: emphasizeDescriptions,
                    contentNode: content
                }));
            });
        }

        scopeStatus.textContent = isReportScope
            ? `Showing analytics for the current ${workingViewActive ? 'Working View report' : 'report'}.`
            : 'Showing analytics for the active Project Workspace.';

        if (isReportScope && showTrendPlaceholders && reportAnalytics) {
            const inWorkspace = Boolean(reportAnalytics.reportId && trendSnapshot.reportToWorkspaceId?.[reportAnalytics.reportId]);
            const reportTrendItems = [];

            if (inWorkspace) {
                const workspaceId = trendSnapshot.reportToWorkspaceId[reportAnalytics.reportId];
                const workspaceTrend = findTrendGroupByPrefix(trendSnapshot.workspaceTrends, 'workspace', workspaceId);
                reportTrendItems.push({
                    label: 'Trend Scope',
                    value: 'Current report belongs to a workspace. Trends are based on that workspace history.'
                });
                if (workspaceTrend) {
                    reportTrendItems.push(
                        { label: 'Workspace Trend Direction', value: formatTrendDirection(workspaceTrend.direction) },
                        { label: 'Issue Delta vs Previous Report', value: formatTrendDelta(workspaceTrend.deltaTotalIssues) },
                        { label: 'Workspace Reports in Trend', value: formatNumeric(workspaceTrend.reportCount) }
                    );
                }
            } else {
                const organizationTrend = findTrendGroupByPrefix(trendSnapshot.organizationTrends, 'organization', reportAnalytics.organization);
                reportTrendItems.push({
                    label: 'Trend Scope',
                    value: `Standalone report trend group: ${reportAnalytics.organization || 'Unspecified Organization'}`
                });
                if (organizationTrend) {
                    reportTrendItems.push(
                        { label: 'Organization Trend Direction', value: formatTrendDirection(organizationTrend.direction) },
                        { label: 'Issue Delta vs Previous Report', value: formatTrendDelta(organizationTrend.deltaTotalIssues) },
                        { label: 'Organization Reports in Trend', value: formatNumeric(organizationTrend.reportCount) }
                    );
                } else {
                    reportTrendItems.push({
                        label: 'Organization Trend',
                        value: 'No additional standalone reports were found for this organization.'
                    });
                }

                if (trendSnapshot.unrelatedStandaloneTrend) {
                    reportTrendItems.push({
                        label: 'Unrelated Standalone Trend (All)',
                        value: `${formatTrendDirection(trendSnapshot.unrelatedStandaloneTrend.direction)} (${formatTrendDelta(trendSnapshot.unrelatedStandaloneTrend.deltaTotalIssues)}) across ${formatNumeric(trendSnapshot.unrelatedStandaloneTrend.reportCount)} reports`
                    });
                }
            }

            sectionsHost.appendChild(buildAnalyticsSection({
                id: 'report-activity',
                title: 'Activity and Trends',
                description: 'Trend indicators based on workspace history or matching standalone organization history.',
                expanded: expanded.has('report-activity') || expanded.has('workspace-activity'),
                emphasizeDescription: emphasizeDescriptions,
                contentNode: buildDefinitionList(reportTrendItems)
            }));
        }
    };

    if (supportsScopeSwitch) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'dashboard-analytics-scope';
        const legend = document.createElement('legend');
        legend.textContent = 'Analytics Scope';
        fieldset.appendChild(legend);

        const reportId = 'dashboard-analytics-scope-report';
        const workspaceId = 'dashboard-analytics-scope-workspace';

        const reportLabel = document.createElement('label');
        const reportInput = document.createElement('input');
        reportInput.type = 'radio';
        reportInput.name = 'dashboard-analytics-scope';
        reportInput.id = reportId;
        reportInput.value = 'report';
        reportInput.checked = activeScope === 'report';
        reportLabel.htmlFor = reportId;
        reportLabel.append(reportInput, ' Current Working View Report');

        const workspaceLabel = document.createElement('label');
        const workspaceInput = document.createElement('input');
        workspaceInput.type = 'radio';
        workspaceInput.name = 'dashboard-analytics-scope';
        workspaceInput.id = workspaceId;
        workspaceInput.value = 'workspace';
        workspaceInput.checked = activeScope === 'workspace';
        workspaceLabel.htmlFor = workspaceId;
        workspaceLabel.append(workspaceInput, ' Active Workspace');

        fieldset.append(reportLabel, workspaceLabel);
        container.appendChild(fieldset);

        fieldset.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (!['report', 'workspace'].includes(target.value)) return;
            activeScope = target.value;
            renderScopeSections();
            if (shouldAnnounceScope) {
                announce(activeScope === 'report'
                    ? 'Analytics scope changed to current report.'
                    : 'Analytics scope changed to workspace.');
            }
        });
    }

    container.appendChild(scopeStatus);
    container.appendChild(sectionsHost);
    renderScopeSections();
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

function renderTasksWidget(container) {
    const priorityOrder = { Critical: 0, High: 1, Normal: 2, Low: 3 };
    const tasks = getTasks()
        .filter((task) => task.personal && task.status !== 'Complete')
        .sort((left, right) => (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9))
        .slice(0, 5);
    const formatDueDate = (value) => (value ? new Date(value).toLocaleString() : 'Not set');

    container.innerHTML = tasks.length
        ? `<ul class="dashboard-widget__list">${tasks.map((task) => `<li data-task-id="${escapeHtml(task.id)}"><label><input type="checkbox" data-dashboard-task-complete> ${escapeHtml(task.name)}</label> — Priority: ${escapeHtml(task.priority)}, Due: ${escapeHtml(formatDueDate(task.dueAt))}</li>`).join('')}</ul><button id="btn-dashboard-open-tasks" type="button">Open Tasks and To-Do</button>`
        : '<p>No active personal tasks.</p><button id="btn-dashboard-open-tasks" type="button">Open Tasks and To-Do</button>';
    container.querySelectorAll('[data-task-id]').forEach((item) => {
        const taskId = item.getAttribute('data-task-id');
        item.querySelector('[data-dashboard-task-complete]')?.addEventListener('change', (event) => {
            setTaskCompleted(taskId, event.target.checked);
            renderTasksWidget(container);
            announce(event.target.checked ? 'Task completed and moved to Completed Tasks.' : 'Task reopened.');
        });
    });
    container.querySelector('#btn-dashboard-open-tasks')?.addEventListener('click', (event) => openTasksDialog(event.currentTarget));
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
        id: 'dashboard-analytics',
        name: 'Dashboard Analytics',
        heading: 'Dashboard Analytics',
        description: 'Context-aware workspace and report analytics.',
        category: 'Analytics',
        render: renderDashboardAnalyticsWidget
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
        id: 'tasks',
        name: 'To-Do List',
        heading: 'To-Do List',
        description: 'Your highest-priority active personal tasks.',
        category: 'Workspace',
        render: renderTasksWidget
    });

    registerDashboardWidget({
        id: 'dashboard-search',
        name: 'Dashboard Search',
        heading: 'Dashboard Search',
        description: 'Search commands and recent reports.',
        category: 'Workspace',
        render: renderDashboardSearchWidget
    });

    registerDashboardWidget({
        id: 'organization-overview',
        name: 'Organization Overview',
        heading: 'Organization Overview',
        description: 'Summary of tags, collections, and saved views.',
        category: 'Workspace',
        render: renderOrganizationOverviewWidget
    });

    registerDashboardWidget({
        id: 'organization-statistics',
        name: 'Organization Statistics',
        heading: 'Organization Statistics',
        description: 'Accessibility statistics aggregated by Organization/Client.',
        category: 'Workspace',
        hideWhenUnavailable: true,
        visibility: () => {
            const config = getOrganizationMetricsConfig();
            if (!config.enabled) return { visible: false, message: 'Organization Statistics are disabled.' };
            if (config.dashboardSectionVisible === false) return { visible: false, message: 'Organization Statistics section is hidden.' };
            return { visible: true, message: '' };
        },
        render: renderOrganizationStatisticsWidget
    });

    registerDashboardWidget({
        id: 'recent-saved-views',
        name: 'Recent Saved Views',
        heading: 'Recent Saved Views',
        description: 'Quick access to recently opened Saved Views.',
        category: 'Workspace',
        render: renderRecentSavedViewsWidget
    });

    dashboardWidgetsRegistered = true;
}

/**
 * Initializes the dashboard buttons.
 * This is called by loader.js once the DOM is ready.
 */
export function renderDashboard() {
    renderStorageSynchronizationPanel();
    const btnNew = document.getElementById('btn-new-report');
    const btnOpenReport = document.getElementById('btn-open-report');
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnSaveProjectAs = document.getElementById('btn-save-project-as');
    const btnOpenProjectGoogleDrive = document.getElementById('btn-open-project-google-drive');
    const btnSaveProjectGoogleDrive = document.getElementById('btn-save-project-google-drive');
    const btnOpenProjectOneDrive = document.getElementById('btn-open-project-onedrive');
    const btnSaveProjectOneDrive = document.getElementById('btn-save-project-onedrive');
    const btnOpenProjectDropbox = document.getElementById('btn-open-project-dropbox');
    const btnSaveProjectDropbox = document.getElementById('btn-save-project-dropbox');
    const btnImportData = document.getElementById('btn-import-data');
    const btnConfigureDashboard = document.getElementById('btn-configure-dashboard');
    const collaborationToolbar = document.getElementById('collaboration-toolbar');
    const collaborationToolbarStatus = document.getElementById('collaboration-toolbar-status');
    const collaborationToolbarDetails = document.getElementById('collaboration-toolbar-details');
    const btnCollaborationSettings = document.getElementById('btn-collaboration-settings');
    const btnCollaborationToggle = document.getElementById('btn-collaboration-toggle');
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
    const templateActionContainer = btnTemplateExport?.parentElement || btnDelete?.parentElement || null;
    if (templateActionContainer && !document.getElementById('btn-template-rename')) {
        const renameTemplateButton = document.createElement('button');
        renameTemplateButton.type = 'button';
        renameTemplateButton.id = 'btn-template-rename';
        renameTemplateButton.textContent = 'Rename Template';
        templateActionContainer.insertBefore(renameTemplateButton, btnEdit.nextSibling);

        const replaceTemplateButton = document.createElement('button');
        replaceTemplateButton.type = 'button';
        replaceTemplateButton.id = 'btn-template-replace';
        replaceTemplateButton.textContent = 'Replace Template';
        templateActionContainer.insertBefore(replaceTemplateButton, btnDelete.nextSibling);
    }
    const btnTemplateRename = document.getElementById('btn-template-rename');
    const btnTemplateReplace = document.getElementById('btn-template-replace');
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
    if (reportActionContainer && !document.getElementById('btn-rename-report-dashboard')) {
        const renameReportButton = document.createElement('button');
        renameReportButton.type = 'button';
        renameReportButton.id = 'btn-rename-report-dashboard';
        renameReportButton.textContent = 'Rename Report';
        reportActionContainer.appendChild(renameReportButton);

        const replaceReportButton = document.createElement('button');
        replaceReportButton.type = 'button';
        replaceReportButton.id = 'btn-replace-report-dashboard';
        replaceReportButton.textContent = 'Replace Report';
        reportActionContainer.appendChild(replaceReportButton);
    }
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
    const btnRenameReportDashboard = document.getElementById('btn-rename-report-dashboard');
    const btnReplaceReportDashboard = document.getElementById('btn-replace-report-dashboard');
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
        !btnNew || !btnOpenReport || !btnSaveProject || !btnSaveProjectAs || !btnImportData || !builderTab || !editorTab || !templateSelect || !btnCreate || !btnUse || !btnOpen || !btnEdit || !btnDelete || !btnTemplateRename || !btnTemplateReplace || !btnTemplateImport || !btnTemplateExport || !templateStatus
        || !deleteDialog || !deleteMessage || !btnDeleteYes || !btnDeleteNo
        || !createDialog || !createNameInput || !btnCreateSave || !btnCreateCancel
        || !editConfirmDialog || !editConfirmMessage || !btnEditYes || !btnEditNo
        || !recentReportsSelect || !btnCloseActiveReport || !btnConfigureReport || !btnEditReportDashboard || !btnViewReportDashboard || !btnDeleteReportDashboard || !btnRenameReportDashboard || !btnReplaceReportDashboard
        || !btnOpenWorkingViewDashboard || !btnLoadWorkingViewDashboard
        || !reportMetricsList || !reportDeleteDialog || !reportDeleteMessage || !btnReportDeleteConfirm || !btnReportDeleteCancel
        || !importConflictDialog || !importConflictMessage || !btnImportReplace || !btnImportCopy || !btnImportCancel
        || !templateImportConflictDialog || !templateImportConflictDescription || !templateImportOptionReplace || !templateImportConfirm || !templateImportCancel
        || !collaborationToolbar || !collaborationToolbarStatus || !collaborationToolbarDetails || !btnCollaborationSettings || !btnCollaborationToggle
    ) return;

    const renderCollaborationToolbar = () => {
        const collaboration = getCollaborationConfig();
        const visible = Boolean(canShowCollaborationToolbar());

        collaborationToolbar.hidden = !visible;
        if (!visible) return;

        collaborationToolbarStatus.textContent = collaboration.enabled
            ? `Collaboration enabled via ${collaboration.providerName || 'Local collaboration'}. Status ${collaboration.providerStatus || 'available'}.`
            : 'Collaboration is disabled.';
        collaborationToolbarDetails.textContent = collaboration.enabled
            ? `Mode ${collaboration.mode || 'independent'}. Toolbar position ${collaboration.toolbarPosition || 'top-right'}.`
            : 'Enable collaboration in Application Settings to expose shared-state controls here.';
        btnCollaborationToggle.textContent = collaboration.enabled ? 'Disable Collaboration' : 'Enable Collaboration';
    };

    btnCollaborationSettings.addEventListener('click', () => {
        void openSettingsCollaborationSectionFromCommand();
    });

    btnCollaborationToggle.addEventListener('click', () => {
        const collaboration = getCollaborationConfig();
        updateCollaborationConfig({
            enabled: !collaboration.enabled,
            showToolbar: !collaboration.enabled ? true : collaboration.showToolbar
        }, {
            action: collaboration.enabled ? 'Disabled collaboration' : 'Enabled collaboration'
        });
    });

    renderCollaborationToolbar();
    window.addEventListener('art-collaboration-updated', renderCollaborationToolbar);

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

    if (globalThis.artDesktop?.isDesktop) {
        const desktopOpenedPaths = new Set();
        const openDesktopArtifact = async (filePath) => {
            if (!filePath || desktopOpenedPaths.has(filePath)) return;
            desktopOpenedPaths.add(filePath);
            try {
                const fileText = await globalThis.artDesktop.readArtFile(filePath);
                activeProjectFileHandle = null;
                openProjectFromText(fileText, filePath.split(/[\\/]/).pop() || 'project.art');
            } catch (error) {
                reportPrecheckStatus(`Open failed for ${filePath || 'project'}. Could not read file.`);
            }
        };
        globalThis.artDesktop.onOpenArtFile(openDesktopArtifact);
        globalThis.artDesktop.getOpenFilePath().then(openDesktopArtifact);
    }

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

    const ensureGoogleDriveConnected = async () => {
        if (getGoogleDriveConnectionStatus().connected) return { ok: true };
        return connectGoogleDrive();
    };

    const googleDriveOpenDialog = document.getElementById('google-drive-open-dialog');
    const googleDriveOpenSelect = document.getElementById('google-drive-open-select');
    const googleDriveOpenStatus = document.getElementById('google-drive-open-status');
    const btnGoogleDriveOpenConfirm = document.getElementById('btn-google-drive-open-confirm');
    const btnGoogleDriveOpenCancel = document.getElementById('btn-google-drive-open-cancel');

    const closeGoogleDriveOpenDialog = () => {
        if (googleDriveOpenDialog) googleDriveOpenDialog.hidden = true;
    };

    const runOpenProjectFromGoogleDrive = async () => {
        const proceed = await confirmProceedWithUnsavedChanges();
        if (!proceed) return false;

        const connection = await ensureGoogleDriveConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        if (!googleDriveOpenDialog || !googleDriveOpenSelect) return false;
        googleDriveOpenStatus.textContent = 'Loading .art files from Google Drive…';
        googleDriveOpenDialog.hidden = false;
        announce('Open from Google Drive dialog opened.');

        try {
            const files = await listArtFiles('root');
            googleDriveOpenSelect.innerHTML = files.length
                ? files.map((file) => `<option value="${file.id}">${file.name}</option>`).join('')
                : '';
            googleDriveOpenStatus.textContent = files.length
                ? `${files.length} .art file${files.length === 1 ? '' : 's'} found in the root of Google Drive.`
                : 'No .art files were found in the root of Google Drive.';
            googleDriveOpenSelect.focus();
        } catch (error) {
            googleDriveOpenStatus.textContent = error.message || 'Could not list Google Drive files.';
        }
        return true;
    };

    btnGoogleDriveOpenConfirm?.addEventListener('click', async () => {
        const option = googleDriveOpenSelect?.selectedOptions?.[0];
        if (!option) {
            googleDriveOpenStatus.textContent = 'Select a file to open.';
            return;
        }
        try {
            const text = await downloadArtFileContent(option.value);
            const opened = openProjectFromText(text, option.textContent);
            if (opened) {
                updateProjectDocumentInfo({ storageProviderId: 'google-drive', storageFileId: option.value }, { action: 'Opened ART project from Google Drive' });
                closeGoogleDriveOpenDialog();
            }
        } catch (error) {
            googleDriveOpenStatus.textContent = error.message || 'Could not open the selected Google Drive file.';
        }
    });
    btnGoogleDriveOpenCancel?.addEventListener('click', () => {
        closeGoogleDriveOpenDialog();
        announce('Open from Google Drive cancelled.');
    });
    googleDriveOpenDialog?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeGoogleDriveOpenDialog();
        }
    });

    const runSaveProjectToGoogleDrive = async () => {
        const connection = await ensureGoogleDriveConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        const payloadText = serializeArtProjectPayload();
        const now = new Date().toISOString();
        const currentProject = getProjectDocumentInfo();

        if (currentProject.storageProviderId === 'google-drive' && currentProject.storageFileId) {
            try {
                await updateArtFile(currentProject.storageFileId, payloadText);
                updateProjectDocumentInfo({ lastModifiedAt: now }, { action: 'Saved ART project to Google Drive' });
                saveState({ action: 'Saved ART project to Google Drive', markProjectSaved: true, recordHistory: false });
                announce('Project saved to Google Drive.');
                return true;
            } catch (error) {
                reportPrecheckStatus(error.message || 'Could not save to Google Drive.');
                return false;
            }
        }

        const suggestedName = buildProjectFileName();
        const fileName = window.prompt('Save to Google Drive as:', suggestedName);
        if (!fileName) return false;
        try {
            const created = await createArtFile(fileName, 'root', payloadText);
            updateProjectDocumentInfo({
                fileName: created.name || fileName,
                filePath: '',
                createdAt: currentProject.createdAt || now,
                lastModifiedAt: now,
                storageProviderId: 'google-drive',
                storageFileId: created.id
            }, { action: 'Saved ART project to Google Drive' });
            saveState({ action: 'Saved ART project to Google Drive', markProjectSaved: true, recordHistory: false });
            announce(`Project saved to Google Drive as ${created.name || fileName}.`);
            return true;
        } catch (error) {
            reportPrecheckStatus(error.message || 'Could not save to Google Drive.');
            return false;
        }
    };

    const ensureOneDriveConnected = async () => {
        if (getOneDriveConnectionStatus().connected) return { ok: true };
        return connectOneDrive();
    };

    const oneDriveOpenDialog = document.getElementById('onedrive-open-dialog');
    const oneDriveOpenSelect = document.getElementById('onedrive-open-select');
    const oneDriveOpenStatus = document.getElementById('onedrive-open-status');
    const btnOneDriveOpenConfirm = document.getElementById('btn-onedrive-open-confirm');
    const btnOneDriveOpenCancel = document.getElementById('btn-onedrive-open-cancel');

    const closeOneDriveOpenDialog = () => {
        if (oneDriveOpenDialog) oneDriveOpenDialog.hidden = true;
    };

    const runOpenProjectFromOneDrive = async () => {
        const proceed = await confirmProceedWithUnsavedChanges();
        if (!proceed) return false;

        const connection = await ensureOneDriveConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        if (!oneDriveOpenDialog || !oneDriveOpenSelect) return false;
        oneDriveOpenStatus.textContent = 'Loading .art files from OneDrive…';
        oneDriveOpenDialog.hidden = false;
        announce('Open from OneDrive dialog opened.');

        try {
            const files = await listOneDriveArtFiles();
            oneDriveOpenSelect.innerHTML = files.length
                ? files.map((file) => `<option value="${file.id}">${file.name}</option>`).join('')
                : '';
            oneDriveOpenStatus.textContent = files.length
                ? `${files.length} .art file${files.length === 1 ? '' : 's'} found in your OneDrive App Folder.`
                : 'No .art files were found in your OneDrive App Folder.';
            oneDriveOpenSelect.focus();
        } catch (error) {
            oneDriveOpenStatus.textContent = error.message || 'Could not list OneDrive files.';
        }
        return true;
    };

    btnOneDriveOpenConfirm?.addEventListener('click', async () => {
        const option = oneDriveOpenSelect?.selectedOptions?.[0];
        if (!option) {
            oneDriveOpenStatus.textContent = 'Select a file to open.';
            return;
        }
        try {
            const text = await downloadOneDriveArtFileContent(option.value);
            const opened = openProjectFromText(text, option.textContent);
            if (opened) {
                updateProjectDocumentInfo({ storageProviderId: 'onedrive', storageFileId: option.value }, { action: 'Opened ART project from OneDrive' });
                closeOneDriveOpenDialog();
            }
        } catch (error) {
            oneDriveOpenStatus.textContent = error.message || 'Could not open the selected OneDrive file.';
        }
    });
    btnOneDriveOpenCancel?.addEventListener('click', () => {
        closeOneDriveOpenDialog();
        announce('Open from OneDrive cancelled.');
    });
    oneDriveOpenDialog?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeOneDriveOpenDialog();
        }
    });

    const runSaveProjectToOneDrive = async () => {
        const connection = await ensureOneDriveConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        const payloadText = serializeArtProjectPayload();
        const now = new Date().toISOString();
        const currentProject = getProjectDocumentInfo();

        if (currentProject.storageProviderId === 'onedrive' && currentProject.storageFileId) {
            try {
                await updateOneDriveArtFile(currentProject.storageFileId, payloadText);
                updateProjectDocumentInfo({ lastModifiedAt: now }, { action: 'Saved ART project to OneDrive' });
                saveState({ action: 'Saved ART project to OneDrive', markProjectSaved: true, recordHistory: false });
                announce('Project saved to OneDrive.');
                return true;
            } catch (error) {
                reportPrecheckStatus(error.message || 'Could not save to OneDrive.');
                return false;
            }
        }

        const suggestedName = buildProjectFileName();
        const fileName = window.prompt('Save to OneDrive as:', suggestedName);
        if (!fileName) return false;
        try {
            const created = await createOneDriveArtFile(fileName, payloadText);
            updateProjectDocumentInfo({
                fileName: created.name || fileName,
                filePath: '',
                createdAt: currentProject.createdAt || now,
                lastModifiedAt: now,
                storageProviderId: 'onedrive',
                storageFileId: created.id
            }, { action: 'Saved ART project to OneDrive' });
            saveState({ action: 'Saved ART project to OneDrive', markProjectSaved: true, recordHistory: false });
            announce(`Project saved to OneDrive as ${created.name || fileName}.`);
            return true;
        } catch (error) {
            reportPrecheckStatus(error.message || 'Could not save to OneDrive.');
            return false;
        }
    };

    const ensureDropboxConnected = async () => {
        if (getDropboxConnectionStatus().connected) return { ok: true };
        return connectDropbox();
    };

    const dropboxOpenDialog = document.getElementById('dropbox-open-dialog');
    const dropboxOpenSelect = document.getElementById('dropbox-open-select');
    const dropboxOpenStatus = document.getElementById('dropbox-open-status');
    const btnDropboxOpenConfirm = document.getElementById('btn-dropbox-open-confirm');
    const btnDropboxOpenCancel = document.getElementById('btn-dropbox-open-cancel');

    const closeDropboxOpenDialog = () => {
        if (dropboxOpenDialog) dropboxOpenDialog.hidden = true;
    };

    const runOpenProjectFromDropbox = async () => {
        const proceed = await confirmProceedWithUnsavedChanges();
        if (!proceed) return false;

        const connection = await ensureDropboxConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        if (!dropboxOpenDialog || !dropboxOpenSelect) return false;
        dropboxOpenStatus.textContent = 'Loading .art files from Dropbox…';
        dropboxOpenDialog.hidden = false;
        announce('Open from Dropbox dialog opened.');

        try {
            const files = await listDropboxArtFiles();
            dropboxOpenSelect.innerHTML = files.length
                ? files.map((file) => `<option value="${file.id}">${file.name}</option>`).join('')
                : '';
            dropboxOpenStatus.textContent = files.length
                ? `${files.length} .art file${files.length === 1 ? '' : 's'} found in your Dropbox App Folder.`
                : 'No .art files were found in your Dropbox App Folder.';
            dropboxOpenSelect.focus();
        } catch (error) {
            dropboxOpenStatus.textContent = error.message || 'Could not list Dropbox files.';
        }
        return true;
    };

    btnDropboxOpenConfirm?.addEventListener('click', async () => {
        const option = dropboxOpenSelect?.selectedOptions?.[0];
        if (!option) {
            dropboxOpenStatus.textContent = 'Select a file to open.';
            return;
        }
        try {
            const text = await downloadDropboxArtFileContent(option.value);
            const opened = openProjectFromText(text, option.textContent);
            if (opened) {
                updateProjectDocumentInfo({ storageProviderId: 'dropbox', storageFileId: option.value }, { action: 'Opened ART project from Dropbox' });
                closeDropboxOpenDialog();
            }
        } catch (error) {
            dropboxOpenStatus.textContent = error.message || 'Could not open the selected Dropbox file.';
        }
    });
    btnDropboxOpenCancel?.addEventListener('click', () => {
        closeDropboxOpenDialog();
        announce('Open from Dropbox cancelled.');
    });
    dropboxOpenDialog?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDropboxOpenDialog();
        }
    });

    const runSaveProjectToDropbox = async () => {
        const connection = await ensureDropboxConnected();
        if (!connection.ok) {
            reportPrecheckStatus(connection.message);
            return false;
        }

        const payloadText = serializeArtProjectPayload();
        const now = new Date().toISOString();
        const currentProject = getProjectDocumentInfo();

        if (currentProject.storageProviderId === 'dropbox' && currentProject.storageFileId) {
            try {
                await updateDropboxArtFile(currentProject.storageFileId, payloadText);
                updateProjectDocumentInfo({ lastModifiedAt: now }, { action: 'Saved ART project to Dropbox' });
                saveState({ action: 'Saved ART project to Dropbox', markProjectSaved: true, recordHistory: false });
                announce('Project saved to Dropbox.');
                return true;
            } catch (error) {
                reportPrecheckStatus(error.message || 'Could not save to Dropbox.');
                return false;
            }
        }

        const suggestedName = buildProjectFileName();
        const fileName = window.prompt('Save to Dropbox as:', suggestedName);
        if (!fileName) return false;
        try {
            const created = await createDropboxArtFile(fileName, payloadText);
            updateProjectDocumentInfo({
                fileName: created.name || fileName,
                filePath: '',
                createdAt: currentProject.createdAt || now,
                lastModifiedAt: now,
                storageProviderId: 'dropbox',
                storageFileId: created.id
            }, { action: 'Saved ART project to Dropbox' });
            saveState({ action: 'Saved ART project to Dropbox', markProjectSaved: true, recordHistory: false });
            announce(`Project saved to Dropbox as ${created.name || fileName}.`);
            return true;
        } catch (error) {
            reportPrecheckStatus(error.message || 'Could not save to Dropbox.');
            return false;
        }
    };

    runDashboardSaveProjectWorkflow = runSaveProject;
    runDashboardSaveProjectAsWorkflow = runSaveProjectAs;
    runDashboardOpenProjectWorkflow = runOpenProjectPicker;
    runDashboardOpenGoogleDriveWorkflow = runOpenProjectFromGoogleDrive;
    runDashboardSaveGoogleDriveWorkflow = runSaveProjectToGoogleDrive;
    runDashboardOpenOneDriveWorkflow = runOpenProjectFromOneDrive;
    runDashboardSaveOneDriveWorkflow = runSaveProjectToOneDrive;
    runDashboardOpenDropboxWorkflow = runOpenProjectFromDropbox;
    runDashboardSaveDropboxWorkflow = runSaveProjectToDropbox;
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

    btnOpenProjectGoogleDrive?.addEventListener('click', async () => {
        await executeDashboardAction('openProjectFromGoogleDrive');
    });

    btnSaveProjectGoogleDrive?.addEventListener('click', async () => {
        await executeDashboardAction('saveProjectToGoogleDrive');
    });

    btnOpenProjectOneDrive?.addEventListener('click', async () => {
        await executeDashboardAction('openProjectFromOneDrive');
    });

    btnSaveProjectOneDrive?.addEventListener('click', async () => {
        await executeDashboardAction('saveProjectToOneDrive');
    });

    btnOpenProjectDropbox?.addEventListener('click', async () => {
        await executeDashboardAction('openProjectFromDropbox');
    });

    btnSaveProjectDropbox?.addEventListener('click', async () => {
        await executeDashboardAction('saveProjectToDropbox');
    });

    const refreshStorageProviderButtonVisibility = () => {
        const googleDriveConnected = isStorageProviderConnected('google-drive');
        const oneDriveConnected = isStorageProviderConnected('onedrive');
        const dropboxConnected = isStorageProviderConnected('dropbox');
        if (btnOpenProjectGoogleDrive) btnOpenProjectGoogleDrive.hidden = !googleDriveConnected;
        if (btnSaveProjectGoogleDrive) btnSaveProjectGoogleDrive.hidden = !googleDriveConnected;
        if (btnOpenProjectOneDrive) btnOpenProjectOneDrive.hidden = !oneDriveConnected;
        if (btnSaveProjectOneDrive) btnSaveProjectOneDrive.hidden = !oneDriveConnected;
        if (btnOpenProjectDropbox) btnOpenProjectDropbox.hidden = !dropboxConnected;
        if (btnSaveProjectDropbox) btnSaveProjectDropbox.hidden = !dropboxConnected;
    };
    refreshStorageProviderButtonVisibility();
    window.addEventListener('art-storage-providers-updated', refreshStorageProviderButtonVisibility);
    if (!storageSyncPanelEventBound) {
        window.addEventListener('art-storage-sync-updated', renderStorageSynchronizationPanel);
        storageSyncPanelEventBound = true;
    }

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
        openConfigureDashboardDialogFromCommand();
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
                registerPackageFromWorkflow({
                    packageId: `sample-report:${String(imported.id || imported.name || '').trim()}`,
                    packageType: 'sample-data',
                    displayName: imported.name || 'Imported Report',
                    description: 'Imported report package metadata.',
                    version: '1.0.0',
                    sourceWorkflow: 'dashboardImportReport',
                    metadata: {
                        sourceId: imported.id,
                        reportType: imported.data?.reportType || ''
                    },
                    resources: [{ type: 'report', id: imported.id }]
                }, {
                    sourceWorkflow: 'dashboardImportReport'
                });
                window.dispatchEvent(new Event('art-templates-updated'));
                window.dispatchEvent(new Event('art-reports-updated'));
                reportPrecheckStatus(`Imported ${pendingImportFileName || selectedFile.name} successfully.`);
                rebuildRecentReports();
                if (viewerTab) {
                    viewerTab.click();
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
        registerPackageFromWorkflow({
            packageId: `template:${String(imported.id || imported.name || '').trim()}`,
            packageType: 'report-templates',
            displayName: imported.name || 'Imported Template',
            description: 'Imported template package metadata.',
            version: imported.metadata?.version || '1.0.0',
            sourceWorkflow: 'dashboardImportTemplate',
            metadata: {
                sourceId: imported.id,
                source: imported.metadata?.source || 'import'
            },
            resources: [{ type: 'template', id: imported.id }]
        }, {
            sourceWorkflow: 'dashboardImportTemplate'
        });
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
        rename: btnTemplateRename,
        replace: btnTemplateReplace,
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
        btnRenameReportDashboard.disabled = !hasReportSelection;
        btnReplaceReportDashboard.disabled = !hasReportSelection;
        btnOpenWorkingViewDashboard.disabled = !hasReportSelection;
        btnLoadWorkingViewDashboard.disabled = !hasReportSelection;
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

    btnTemplateRename.addEventListener('click', () => {
        void executeDashboardAction('renameTemplate', { templateId: templateSelect.value });
    });

    btnTemplateReplace.addEventListener('click', () => {
        void executeDashboardAction('replaceTemplate', { templateId: templateSelect.value });
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
        btnRenameReportDashboard.disabled = !hasReportSelection;
        btnReplaceReportDashboard.disabled = !hasReportSelection;
        btnOpenWorkingViewDashboard.disabled = !hasReportSelection;
        btnLoadWorkingViewDashboard.disabled = !hasReportSelection;
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

    btnRenameReportDashboard.addEventListener('click', () => {
        void executeDashboardAction('renameReport', { reportId: recentReportsSelect.value });
    });

    btnReplaceReportDashboard.addEventListener('click', () => {
        void executeDashboardAction('replaceReport', { reportId: recentReportsSelect.value });
    });

    btnOpenWorkingViewDashboard.addEventListener('click', () => {
        const reportId = String(recentReportsSelect.value || '').trim();
        if (!reportId || reportId.startsWith('project:')) return;
        void executeDashboardAction('openWorkingView', {
            reportId,
            showConfig: true
        });
    });

    btnLoadWorkingViewDashboard.addEventListener('click', () => {
        const reportId = String(recentReportsSelect.value || '').trim();
        if (!reportId || reportId.startsWith('project:')) return;
        void executeDashboardAction('loadWorkingView', {
            reportId
        });
    });

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
    window.addEventListener('art-analytics-settings-updated', refreshDashboardWidgetFramework);
    window.addEventListener('art-dashboard-config-updated', refreshDashboardWidgetFramework);
    window.addEventListener('art-tasks-updated', refreshDashboardWidgetFramework);

    const projectInfo = getProjectDocumentInfo();
    if (projectInfo.hasRecoveredChanges && hasOpenReportWithUnsavedChanges()) {
        markProjectRecovered(projectInfo.recoveryLabel || 'Recovered changes are available.');
        announce(projectInfo.recoveryLabel || 'A previous unsaved version of this project was found.');
    }
    rebuildRecentReports();
    refreshDashboardWidgetFramework();

    window.addEventListener('art-organization-metrics-updated', () => {
        refreshDashboardWidgetFramework();
    });
}
