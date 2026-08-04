import {
    announce,
    appState,
    addProjectWorkspaceAsset,
    addProjectWorkspaceRelationship,
    addRecentProjectWorkspace,
    calculateProjectWorkspaceHealth,
    calculateProjectWorkspaceStatistics,
    closeActiveProjectWorkspace,
    createArtProjectPayload,
    deleteProjectWorkspace,
    duplicateProjectWorkspace,
    getActiveProjectWorkspace,
    getProjectWorkspaces,
    getRecentProjectWorkspaces,
    importArtProjectPayload,
    renameProjectWorkspace,
    removeProjectWorkspaceAsset,
    saveState,
    setActiveProjectWorkspace,
    updateProjectWorkspaceState,
    upsertProjectWorkspace
} from './state.js';
import { getWorkspaceResourceDetails, getWorkspaceResourceGroups } from './resourceFramework.js';
import {
    getDeletionPreview,
    getRelationshipSummaryForResource,
    reconcileWorkspaceRelationshipIntegrity,
    repairWorkspaceRelationships as repairWorkspaceRelationshipStore,
    validateWorkspaceRelationships
} from './resourceRelationshipFramework.js';
import {
    applyWorkspaceOrganizationMetadata,
    attachWorkspaceOrganizationMetadata,
    createSavedViewFromCurrentWorkingViewFromCommand,
    getExplorerOrganizationSections,
    handleOrganizationExplorerAction,
    openCollectionManagerFromCommand,
    openSavedViewFromCommand,
    openSavedViewManagerFromCommand,
    openTagManagerFromCommand
} from './resourceOrganizationFramework.js';

const PROJECT_WORKSPACE_FORMAT = 'ART Project Workspace';
const PROJECT_WORKSPACE_FORMAT_VERSION = '2.0';
const PROJECT_WORKSPACE_SCHEMA_VERSION = '2.0';
const PROJECT_FILE_NAME = 'Project.artproj';
const ASSET_CATEGORY_FOLDERS = new Set([
    'Planning',
    'Requirements',
    'Timeline',
    'Documentation',
    'Credentials',
    'Designs',
    'Meeting Notes',
    'Images',
    'Other'
]);

const WORKSPACE_STRUCTURE = [
    'Reports',
    'Audit Logs',
    'Progress Logs',
    'Templates',
    'Project Assets',
    'Project Assets/Planning',
    'Project Assets/Requirements',
    'Project Assets/Timeline',
    'Project Assets/Documentation',
    'Project Assets/Credentials',
    'Project Assets/Designs',
    'Project Assets/Meeting Notes',
    'Project Assets/Images',
    'Project Assets/Other',
    'Attachments',
    'Exports',
    'Backups',
    '.art'
];

const runtimeHandles = {
    workspaceDirectories: new Map(),
    focusBeforeWorkspaceActivation: null
};

let frameworkInitialized = false;
let workspaceAssetFileInput = null;
let workspaceImportFileInput = null;
let pendingDeletionRequest = null;
let workspaceOptions = {
    onWorkspaceChanged: null
};

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function sanitizeFolderName(value, fallback = 'Project Workspace') {
    const safe = String(value || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim();
    return safe || fallback;
}

function normalizeText(value) {
    return String(value || '').trim();
}

function getActiveWorkspaceSafe() {
    return getActiveProjectWorkspace();
}

function captureFocusBeforeWorkspaceActivation(preferredTarget = null) {
    const candidate = preferredTarget && typeof preferredTarget.focus === 'function'
        ? preferredTarget
        : document.activeElement;
    if (candidate && typeof candidate.focus === 'function') {
        runtimeHandles.focusBeforeWorkspaceActivation = candidate;
    }
}

function restoreFocusAfterWorkspaceClosed() {
    const previousFocus = runtimeHandles.focusBeforeWorkspaceActivation;
    runtimeHandles.focusBeforeWorkspaceActivation = null;

    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
        window.setTimeout(() => previousFocus.focus(), 0);
        return;
    }

    const fallbackTarget = document.getElementById('btn-workspace-open')
        || document.getElementById('btn-new-report')
        || document.getElementById('tab-welcome');
    if (fallbackTarget && typeof fallbackTarget.focus === 'function') {
        window.setTimeout(() => fallbackTarget.focus(), 0);
    }
}

function dispatchWorkspaceUpdatedEvent(type, detail = {}) {
    const payload = {
        type,
        at: new Date().toISOString(),
        ...detail
    };
    window.dispatchEvent(new CustomEvent('art-project-workspace-updated', { detail: payload }));
    if (typeof workspaceOptions.onWorkspaceChanged === 'function') {
        workspaceOptions.onWorkspaceChanged(payload);
    }
}

function ensureWorkspaceExplorerShell() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return null;

    let shell = document.getElementById('workspace-explorer');
    if (shell) return shell;

    shell = document.createElement('section');
    shell.id = 'workspace-explorer';
    shell.className = 'workspace-explorer';
    shell.setAttribute('role', 'region');
    shell.setAttribute('aria-labelledby', 'workspace-explorer-heading');
    shell.innerHTML = `
        <h3 id="workspace-explorer-heading">Resource Navigator</h3>
        <p id="workspace-explorer-description">Navigate Project Workspace resources using grouped lists and filters.</p>
        <div class="workspace-explorer__toolbar" role="group" aria-label="Resource navigator actions">
            <button id="btn-workspace-new" type="button">New Workspace</button>
            <button id="btn-workspace-open" type="button">Open Workspace</button>
            <button id="btn-workspace-close" type="button" hidden>Close Workspace</button>
            <button id="btn-workspace-save" type="button">Save Workspace</button>
            <button id="btn-workspace-save-as" type="button">Save Workspace As</button>
            <button id="btn-workspace-export" type="button">Export Workspace</button>
            <label for="workspace-resource-filter">Filter resources</label>
            <input id="workspace-resource-filter" type="search" autocomplete="off" spellcheck="false" aria-describedby="workspace-explorer-status workspace-explorer-description">
            <button id="btn-workspace-refresh" type="button">Refresh Resources</button>
            <button id="btn-workspace-add-asset" type="button">Add Project Asset</button>
            <button id="btn-workspace-tag-manager" type="button">Tag Manager</button>
            <button id="btn-workspace-collection-manager" type="button">Collection Manager</button>
            <button id="btn-workspace-saved-view-manager" type="button">Saved View Manager</button>
            <button id="btn-workspace-open-saved-view" type="button">Open Saved View</button>
            <button id="btn-workspace-save-current-view" type="button">Save Current Working View</button>
            <button id="btn-workspace-properties" type="button">Project Properties</button>
        </div>
        <div id="workspace-resource-groups" class="workspace-explorer__groups"></div>
        <p id="workspace-explorer-status" class="open-report-status" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    const metricsSection = document.getElementById('report-metrics')?.parentElement;
    if (metricsSection && metricsSection.parentElement) {
        metricsSection.parentElement.insertBefore(shell, metricsSection.nextSibling);
    } else {
        dashboard.appendChild(shell);
    }

    return shell;
}

function ensureWorkspaceDialogs() {
    if (document.getElementById('project-workspace-properties-dialog')) return;

    const dialog = document.createElement('div');
    dialog.id = 'project-workspace-properties-dialog';
    dialog.className = 'workspace-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'project-workspace-properties-heading');
    dialog.hidden = true;
    dialog.innerHTML = `
        <div class="workspace-dialog__header">
            <h3 id="project-workspace-properties-heading">Project Properties</h3>
            <button id="btn-workspace-properties-close" type="button">Close</button>
        </div>
        <div id="project-workspace-properties-content" class="workspace-dialog__content"></div>
        <div class="workspace-dialog__actions" role="group" aria-label="Project Properties actions">
            <button id="btn-workspace-properties-save" type="button">Save Properties</button>
            <button id="btn-workspace-properties-cancel" type="button">Cancel</button>
        </div>
    `;
    document.body.appendChild(dialog);

    const exportDialog = document.createElement('div');
    exportDialog.id = 'project-workspace-export-dialog';
    exportDialog.className = 'workspace-dialog';
    exportDialog.setAttribute('role', 'dialog');
    exportDialog.setAttribute('aria-modal', 'true');
    exportDialog.setAttribute('aria-labelledby', 'project-workspace-export-heading');
    exportDialog.hidden = true;
    exportDialog.innerHTML = `
        <div class="workspace-dialog__header">
            <h3 id="project-workspace-export-heading">Export Project Workspace</h3>
            <button id="btn-workspace-export-close" type="button">Close</button>
        </div>
        <p>Choose export options for this Project Workspace.</p>
        <label for="workspace-export-format">Export format</label>
        <select id="workspace-export-format">
            <option value="folder">Project Workspace Folder</option>
            <option value="zip">ZIP Archive</option>
        </select>
        <fieldset>
            <legend>Resources to include</legend>
            <label><input type="checkbox" id="workspace-export-reports" checked> Reports</label>
            <label><input type="checkbox" id="workspace-export-templates" checked> Templates</label>
            <label><input type="checkbox" id="workspace-export-assets" checked> Project Assets</label>
            <label><input type="checkbox" id="workspace-export-workspace-state" checked> Workspace State and Dashboard Configuration</label>
        </fieldset>
        <p id="workspace-export-status" class="open-report-status" role="status" aria-live="polite"></p>
        <div class="workspace-dialog__actions" role="group" aria-label="Export actions">
            <button id="btn-workspace-export-start" type="button">Export</button>
            <button id="btn-workspace-export-cancel" type="button">Cancel</button>
        </div>
    `;
    document.body.appendChild(exportDialog);

    const resourceDialog = document.createElement('div');
    resourceDialog.id = 'workspace-resource-properties-dialog';
    resourceDialog.className = 'workspace-dialog';
    resourceDialog.setAttribute('role', 'dialog');
    resourceDialog.setAttribute('aria-modal', 'true');
    resourceDialog.setAttribute('aria-labelledby', 'workspace-resource-properties-heading');
    resourceDialog.hidden = true;
    resourceDialog.innerHTML = `
        <div class="workspace-dialog__header">
            <h3 id="workspace-resource-properties-heading">Resource Properties</h3>
            <button id="btn-workspace-resource-properties-close" type="button">Close</button>
        </div>
        <div id="workspace-resource-properties-content" class="workspace-dialog__content"></div>
        <div class="workspace-dialog__actions" role="group" aria-label="Resource Properties actions">
            <button id="btn-workspace-resource-reveal" type="button">Reveal in Explorer</button>
            <button id="btn-workspace-resource-show-relationships" type="button">Show Relationships</button>
            <button id="btn-workspace-resource-show-dependents" type="button">Show Dependents</button>
            <button id="btn-workspace-resource-show-references" type="button">Show References</button>
            <button id="btn-workspace-resource-preview-deletion" type="button">Preview Deletion Impact</button>
            <button id="btn-workspace-resource-copy-name" type="button">Copy Resource Name</button>
            <button id="btn-workspace-resource-copy-path" type="button">Copy Resource Path</button>
            <button id="btn-workspace-resource-copy-relationships" type="button">Copy Relationship Information</button>
        </div>
    `;
    document.body.appendChild(resourceDialog);

    const deletionDialog = document.createElement('div');
    deletionDialog.id = 'workspace-resource-deletion-dialog';
    deletionDialog.className = 'workspace-dialog';
    deletionDialog.setAttribute('role', 'dialog');
    deletionDialog.setAttribute('aria-modal', 'true');
    deletionDialog.setAttribute('aria-labelledby', 'workspace-resource-deletion-heading');
    deletionDialog.hidden = true;
    deletionDialog.innerHTML = `
        <div class="workspace-dialog__header">
            <h3 id="workspace-resource-deletion-heading">Deletion Analysis</h3>
            <button id="btn-workspace-resource-deletion-close" type="button">Close</button>
        </div>
        <div id="workspace-resource-deletion-content" class="workspace-dialog__content"></div>
        <div class="workspace-dialog__actions" role="group" aria-label="Deletion Analysis actions">
            <button id="btn-workspace-resource-deletion-repair" type="button">Repair Relationships</button>
            <button id="btn-workspace-resource-deletion-confirm" type="button">Delete</button>
            <button id="btn-workspace-resource-deletion-cancel" type="button">Cancel</button>
        </div>
    `;
    document.body.appendChild(deletionDialog);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getWorkspaceDialogFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((item) => item.offsetParent !== null);
}

function openWorkspaceDialog(dialog, focusTarget) {
    if (!dialog) return;
    dialog.hidden = false;
    window.setTimeout(() => {
        if (focusTarget) {
            focusTarget.focus();
            return;
        }
        const focusables = getWorkspaceDialogFocusableElements(dialog);
        if (focusables[0]) focusables[0].focus();
    }, 0);
}

function closeWorkspaceDialog(dialog, restoreTarget = null) {
    if (!dialog) return;
    dialog.hidden = true;
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
        window.setTimeout(() => restoreTarget.focus(), 0);
    }
}

function updateExplorerStatus(message) {
    const status = document.getElementById('workspace-explorer-status');
    if (status) status.textContent = message;
    announce(message);
}

function resolveAssetCategoryPath(category) {
    const normalized = normalizeText(category) || 'Other';
    if (ASSET_CATEGORY_FOLDERS.has(normalized)) return normalized;
    return 'Other';
}

function buildWorkspaceStatistics(workspace) {
    const statistics = calculateProjectWorkspaceStatistics(workspace.id) || {};
    const health = calculateProjectWorkspaceHealth(workspace.id) || {};
    return { statistics, health };
}

function buildProjectWorkspacePayload(workspace, options = {}) {
    const reconciledWorkspace = reconcileWorkspaceRelationshipIntegrity(workspace, { persist: false }).workspace || workspace;
    const workspaceWithOrganization = attachWorkspaceOrganizationMetadata(reconciledWorkspace, {
        includeOnlyWorkspaceScope: true
    });
    const includeReports = options.includeReports !== false;
    const includeTemplates = options.includeTemplates !== false;
    const includeAssets = options.includeAssets !== false;
    const includeWorkspaceState = options.includeWorkspaceState !== false;

    const { statistics, health } = buildWorkspaceStatistics(workspaceWithOrganization);

    const payload = {
        format: PROJECT_WORKSPACE_FORMAT,
        formatVersion: PROJECT_WORKSPACE_FORMAT_VERSION,
        schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
        metadata: {
            projectName: reconciledWorkspace.name,
            projectId: workspaceWithOrganization.id,
            projectDescription: workspaceWithOrganization.description,
            projectOwner: workspaceWithOrganization.owner,
            organization: workspaceWithOrganization.organization,
            dateCreated: workspaceWithOrganization.createdAt,
            lastModified: new Date().toISOString(),
            projectVersion: workspaceWithOrganization.projectVersion || '2.0',
            currentStatus: workspaceWithOrganization.status
        },
        workspace: {
            ...workspaceWithOrganization,
            lastModifiedAt: new Date().toISOString(),
            statistics,
            health,
            workspaceState: includeWorkspaceState ? workspaceWithOrganization.workspaceState : {},
            resources: {
                ...workspaceWithOrganization.resources,
                reports: includeReports ? workspaceWithOrganization.resources.reports : [],
                templates: includeTemplates ? workspaceWithOrganization.resources.templates : [],
                projectAssets: includeAssets ? workspaceWithOrganization.resources.projectAssets : []
            }
        },
        artProjectPayload: createArtProjectPayload()
    };

    return payload;
}

function validateWorkspacePayload(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'invalid-payload' };
    if (String(payload.format || '').trim() !== PROJECT_WORKSPACE_FORMAT) return { ok: false, reason: 'invalid-format' };
    if (!String(payload.formatVersion || '').trim()) return { ok: false, reason: 'missing-format-version' };
    if (!String(payload.schemaVersion || '').trim()) return { ok: false, reason: 'missing-schema-version' };
    if (!payload.workspace || typeof payload.workspace !== 'object') return { ok: false, reason: 'missing-workspace' };
    return { ok: true };
}

function applyWorkspaceFromPayload(payload, context = {}) {
    const validation = validateWorkspacePayload(payload);
    if (!validation.ok) return validation;

    if (payload.artProjectPayload) {
        const imported = importArtProjectPayload(payload.artProjectPayload);
        if (!imported?.isValid) {
            return { ok: false, reason: 'invalid-art-project-payload' };
        }
    }

    const workspace = {
        ...payload.workspace,
        folderPath: normalizeText(context.folderPath || payload.workspace.folderPath),
        folderName: normalizeText(context.folderName || payload.workspace.folderName || payload.workspace.name),
        projectFileName: PROJECT_FILE_NAME,
        lastModifiedAt: new Date().toISOString()
    };

    const reconciledWorkspace = reconcileWorkspaceRelationshipIntegrity(workspace, { persist: false }).workspace || workspace;
    applyWorkspaceOrganizationMetadata(reconciledWorkspace);

    const saved = upsertProjectWorkspace(reconciledWorkspace, {
        action: `Opened project workspace ${reconciledWorkspace.name}`,
        setActive: true,
        persist: true
    });

    const state = saved.workspaceState || {};
    if (Array.isArray(state.openReportIds) && state.openReportIds.length > 0) {
        appState.selectedReportId = String(state.activeReportId || state.openReportIds[0] || '').trim();
    }

    if (state.dashboardConfig && typeof state.dashboardConfig === 'object') {
        appState.dashboard = {
            ...appState.dashboard,
            ...state.dashboardConfig
        };
    }

    saveState({ action: `Restored workspace ${saved.name}`, recordHistory: false });
    dispatchWorkspaceUpdatedEvent('WorkspaceOpened', {
        workspaceId: saved.id,
        workspaceName: saved.name
    });
    return { ok: true, workspace: saved };
}

async function ensureWorkspaceFolderStructure(rootDirectoryHandle) {
    for (const entry of WORKSPACE_STRUCTURE) {
        const segments = entry.split('/').filter(Boolean);
        let current = rootDirectoryHandle;
        for (const segment of segments) {
            current = await current.getDirectoryHandle(segment, { create: true });
        }
    }
}

async function writeTextFile(directoryHandle, fileName, text) {
    const handle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(String(text || ''));
    await writable.close();
}

async function writeReportArtifacts(workspaceRoot, workspace) {
    const reportsDirectory = await workspaceRoot.getDirectoryHandle('Reports', { create: true });
    const reportIds = new Set(workspace.resources.reports || workspace.associatedReportIds || []);
    const reports = (appState.reports || []).filter((report) => reportIds.size === 0 || reportIds.has(report.id));
    for (const report of reports) {
        const safeName = sanitizeFolderName(report.name || 'Report', 'Report');
        const payload = {
            id: report.id,
            name: report.name,
            updatedAt: report.updatedAt,
            data: report.data
        };
        await writeTextFile(reportsDirectory, `${safeName}.artr`, JSON.stringify(payload, null, 2));
    }
}

async function writeTemplateArtifacts(workspaceRoot, workspace) {
    const templatesDirectory = await workspaceRoot.getDirectoryHandle('Templates', { create: true });
    const templateIds = new Set(workspace.resources.templates || workspace.associatedTemplateIds || []);
    const templates = (appState.userTemplates || []).filter((template) => templateIds.size === 0 || templateIds.has(template.id));
    for (const template of templates) {
        const safeName = sanitizeFolderName(template.name || 'Template', 'Template');
        const payload = {
            id: template.id,
            name: template.name,
            metadata: template.metadata,
            data: template.data
        };
        await writeTextFile(templatesDirectory, `${safeName}.artt`, JSON.stringify(payload, null, 2));
    }
}

async function writeProjectAssetsMetadata(workspaceRoot, workspace) {
    const assetsDirectory = await workspaceRoot.getDirectoryHandle('Project Assets', { create: true });
    await writeTextFile(assetsDirectory, 'project-assets-metadata.json', JSON.stringify({
        format: 'ART Project Assets Metadata',
        version: '1.0',
        assets: workspace.resources.projectAssets || []
    }, null, 2));
}

function captureActiveWorkspaceState(workspace) {
    if (!workspace) return workspace;
    const captured = {
        ...workspace,
        associatedReportIds: Array.from(new Set((appState.reports || []).map((report) => report.id))),
        associatedTemplateIds: Array.from(new Set((appState.userTemplates || []).map((template) => template.id))),
        resources: {
            ...workspace.resources,
            reports: Array.from(new Set((appState.reports || []).map((report) => report.id))),
            templates: Array.from(new Set((appState.userTemplates || []).map((template) => template.id)))
        },
        workspaceState: {
            ...workspace.workspaceState,
            openReportIds: Array.from(new Set((appState.reports || []).map((report) => report.id))),
            activeReportId: String(appState.selectedReportId || '').trim(),
            dashboardConfig: appState.dashboard,
            dashboardLayout: String(appState.dashboard?.layout || 'cards')
        },
        lastModifiedAt: new Date().toISOString()
    };
    return reconcileWorkspaceRelationshipIntegrity(captured, { persist: false }).workspace || captured;
}

async function persistWorkspaceToDirectory(workspace, destinationDirectoryHandle) {
    const workspaceFolderName = sanitizeFolderName(workspace.folderName || workspace.name, workspace.name);
    const workspaceRoot = await destinationDirectoryHandle.getDirectoryHandle(workspaceFolderName, { create: true });
    await ensureWorkspaceFolderStructure(workspaceRoot);

    const synced = captureActiveWorkspaceState(workspace);
    const payload = buildProjectWorkspacePayload(synced, {
        includeReports: true,
        includeTemplates: true,
        includeAssets: true,
        includeWorkspaceState: true
    });

    await writeReportArtifacts(workspaceRoot, synced);
    await writeTemplateArtifacts(workspaceRoot, synced);
    await writeProjectAssetsMetadata(workspaceRoot, synced);
    await writeTextFile(workspaceRoot, PROJECT_FILE_NAME, JSON.stringify(payload, null, 2));

    const nextWorkspace = upsertProjectWorkspace({
        ...synced,
        folderName: workspaceFolderName,
        folderPath: workspaceFolderName,
        projectFileName: PROJECT_FILE_NAME,
        statistics: calculateProjectWorkspaceStatistics(synced.id) || {},
        health: calculateProjectWorkspaceHealth(synced.id) || {}
    }, {
        action: `Saved project workspace ${synced.name}`,
        setActive: true,
        persist: true
    });

    runtimeHandles.workspaceDirectories.set(nextWorkspace.id, workspaceRoot);
    addRecentProjectWorkspace({
        id: nextWorkspace.id,
        workspaceId: nextWorkspace.id,
        name: nextWorkspace.name,
        folderPath: nextWorkspace.folderPath,
        lastOpenedAt: new Date().toISOString(),
        pinned: false
    });

    dispatchWorkspaceUpdatedEvent('WorkspaceSaved', {
        workspaceId: nextWorkspace.id,
        workspaceName: nextWorkspace.name
    });

    return nextWorkspace;
}

function createWorkspaceFromPrompt() {
    const name = normalizeText(window.prompt('Project Workspace Name', appState.projectName || 'Accessibility Project Workspace'));
    if (!name) return null;
    const description = normalizeText(window.prompt('Project Description (optional)', ''));
    const owner = normalizeText(window.prompt('Project Owner (optional)', appState.auditors || ''));
    const organization = normalizeText(window.prompt('Organization (optional)', appState.orgClient || ''));
    const now = new Date().toISOString();

    return {
        id: createId('workspace'),
        name,
        description,
        owner,
        organization,
        status: 'Draft',
        version: '2.0',
        createdAt: now,
        lastModifiedAt: now,
        folderName: sanitizeFolderName(name, name),
        folderPath: '',
        projectFileName: PROJECT_FILE_NAME,
        projectVersion: '2.0',
        associatedReportIds: Array.from(new Set((appState.reports || []).map((report) => report.id))),
        associatedTemplateIds: Array.from(new Set((appState.userTemplates || []).map((template) => template.id))),
        resources: {
            reports: Array.from(new Set((appState.reports || []).map((report) => report.id))),
            templates: Array.from(new Set((appState.userTemplates || []).map((template) => template.id))),
            auditLogs: [],
            progressLogs: [],
            projectAssets: [],
            attachments: [],
            exports: [],
            backups: [],
            extensions: {}
        },
        relationships: [],
        tags: [],
        integrationMetadata: {},
        pluginMetadata: {},
        workspaceState: {
            openReportIds: Array.from(new Set((appState.reports || []).map((report) => report.id))),
            activeReportId: String(appState.selectedReportId || '').trim(),
            selectedEvaluationItem: '',
            cursorPosition: null,
            expandedSections: {},
            searchFilters: {},
            sortOrder: '',
            dashboardConfig: appState.dashboard,
            dashboardLayout: String(appState.dashboard?.layout || 'cards'),
            widgetState: {},
            resourceNavigator: {
                expandedGroups: {
                    reports: true,
                    templates: true,
                    assets: true
                },
                filterText: ''
            },
            keyboardFocusTarget: ''
        },
        statistics: {},
        health: {},
        extensions: {}
    };
}

function formatDate(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
}

function renderWorkspaceExplorer() {
    const shell = ensureWorkspaceExplorerShell();
    if (!shell) return;

    const filterInput = document.getElementById('workspace-resource-filter');
    const groups = document.getElementById('workspace-resource-groups');
    const closeWorkspaceButton = document.getElementById('btn-workspace-close');
    const active = getActiveWorkspaceSafe();

    if (closeWorkspaceButton) {
        const hasActiveWorkspace = Boolean(active);
        closeWorkspaceButton.hidden = !hasActiveWorkspace;
        closeWorkspaceButton.disabled = !hasActiveWorkspace;
    }

    if (!groups || !filterInput) return;

    if (!active) {
        groups.innerHTML = '<p>No Project Workspace is currently active.</p>';
        return;
    }

    const filterValue = normalizeText(filterInput.value).toLowerCase();
    const grouped = getWorkspaceResourceGroups(active);
    const expandedResourceIds = Array.isArray(active.workspaceState?.resourceNavigator?.expandedResourceIds)
        ? active.workspaceState.resourceNavigator.expandedResourceIds.map((value) => normalizeText(value)).filter(Boolean)
        : [];

    const renderRelationshipTree = (item) => {
        const relationshipSummary = Array.isArray(item.relationshipSummary) ? item.relationshipSummary : [];
        if (!relationshipSummary.length) {
            return '<p class="workspace-explorer__relationship-empty">No related resources are registered.</p>';
        }

        return relationshipSummary.map((category) => {
            const relatedItems = (category.resources || []).map((resource) => `
                <li>
                    <button
                        type="button"
                        class="workspace-explorer__relationship-link"
                        data-workspace-resource="true"
                        data-related-resource="true"
                        data-resource-type="${escapeHtml(resource.type)}"
                        data-resource-id="${escapeHtml(resource.id)}"
                    >
                        ${escapeHtml(resource.name)}
                    </button>
                </li>
            `).join('');

            return `
                <section class="workspace-explorer__relationship-group" role="group" aria-label="${escapeHtml(category.label)}">
                    <h5>${escapeHtml(category.label)} (${Number(category.count || 0)})</h5>
                    <ul>${relatedItems || '<li><span class="workspace-explorer__empty">No related resources.</span></li>'}</ul>
                </section>
            `;
        }).join('');
    };

    const renderResourceNode = (item) => {
        const nodeId = `${item.type}:${item.id}`;
        const expanded = expandedResourceIds.includes(nodeId);
        const hasRelationships = Number(item.relationshipCount || 0) > 0;
        const summaryText = hasRelationships
            ? `${item.relationshipCount} relationship${item.relationshipCount === 1 ? '' : 's'}`
            : 'No relationships';

        return `
            <li>
                <details class="workspace-explorer__resource-node" data-workspace-resource-node="true" data-resource-node-id="${escapeHtml(nodeId)}" ${expanded ? 'open' : ''}>
                    <summary>
                        <span class="workspace-explorer__resource-summary">
                            <button type="button" data-workspace-resource="true" data-resource-type="${escapeHtml(item.type)}" data-resource-id="${escapeHtml(item.id)}">
                                ${escapeHtml(item.name)}
                            </button>
                            <span class="workspace-explorer__resource-meta">${escapeHtml(item.subtitle || summaryText)}</span>
                            <span class="workspace-explorer__resource-badge">${escapeHtml(summaryText)}</span>
                        </span>
                    </summary>
                    <div class="workspace-explorer__resource-actions" role="group" aria-label="${escapeHtml(item.name)} actions">
                        <button type="button" data-open-resource-properties="true" data-resource-type="${escapeHtml(item.type)}" data-resource-id="${escapeHtml(item.id)}">Show Properties</button>
                        <button type="button" data-go-to-resource="true" data-resource-type="${escapeHtml(item.type)}" data-resource-id="${escapeHtml(item.id)}">Go To Resource</button>
                    </div>
                    <div class="workspace-explorer__relationships" aria-label="${escapeHtml(item.name)} relationships">
                        ${expanded ? renderRelationshipTree(item) : '<p class="workspace-explorer__relationship-empty">Expand to load relationships.</p>'}
                    </div>
                </details>
            </li>
        `;
    };

    const organizationSections = getExplorerOrganizationSections(active.id, appState.selectedReportId);

    const renderOrganizationResourceLink = (reference, index) => {
        const resourceLabel = `${String(reference.resourceType || 'resource')} ${String(reference.resourceId || index + 1)}`;
        return `
            <li>
                <button
                    type="button"
                    data-organization-item="true"
                    data-organization-item-type="resource"
                    data-resource-type="${escapeHtml(String(reference.resourceType || '').toLowerCase())}"
                    data-resource-id="${escapeHtml(reference.resourceId || '')}"
                    data-workspace-id="${escapeHtml(reference.workspaceId || active.id)}"
                >
                    ${escapeHtml(resourceLabel)}${reference.unresolved ? ' (unresolved)' : ''}
                </button>
            </li>
        `;
    };

    const renderCollectionSection = () => {
        const collections = Array.isArray(organizationSections.collections) ? organizationSections.collections : [];
        const favorites = new Set(Array.isArray(organizationSections.favorites?.collections) ? organizationSections.favorites.collections : []);
        const items = collections.length > 0
            ? collections.map((collection) => `
                <li>
                    <details class="workspace-explorer__resource-node" data-organization-node="true" data-organization-item-type="collection" data-organization-item-id="${escapeHtml(collection.id)}">
                        <summary>
                            <span class="workspace-explorer__resource-summary">
                                <button type="button" data-organization-item="true" data-organization-item-type="collection" data-organization-item-id="${escapeHtml(collection.id)}">
                                    ${escapeHtml(collection.name)}${favorites.has(collection.id) ? ' *' : ''}
                                </button>
                                <span class="workspace-explorer__resource-badge">${Number(collection.resourceCount || 0)} Resources</span>
                            </span>
                        </summary>
                        <ul>
                            ${(collection.resources || []).map((reference, index) => renderOrganizationResourceLink(reference, index)).join('') || '<li><span class="workspace-explorer__empty">No resources in this collection.</span></li>'}
                        </ul>
                    </details>
                </li>
            `).join('')
            : '<li><span class="workspace-explorer__empty">No collections are available.</span></li>';

        return `
            <section class="workspace-explorer__group" role="region" aria-labelledby="workspace-group-collections-heading">
                <h4 id="workspace-group-collections-heading">Collections</h4>
                <ul>${items}</ul>
            </section>
        `;
    };

    const renderTagsSection = () => {
        const tags = Array.isArray(organizationSections.tags) ? organizationSections.tags : [];
        const favorites = new Set(Array.isArray(organizationSections.favorites?.tags) ? organizationSections.favorites.tags : []);
        const items = tags.length > 0
            ? tags.map((tag) => `
                <li>
                    <details class="workspace-explorer__resource-node" data-organization-node="true" data-organization-item-type="tag" data-organization-item-id="${escapeHtml(tag.id)}">
                        <summary>
                            <span class="workspace-explorer__resource-summary">
                                <button type="button" data-organization-item="true" data-organization-item-type="tag" data-organization-item-id="${escapeHtml(tag.id)}">
                                    ${escapeHtml(tag.name)}${favorites.has(tag.id) ? ' *' : ''}
                                </button>
                                <span class="workspace-explorer__resource-badge">${Number((tag.resources || []).length)} Resources</span>
                            </span>
                        </summary>
                        <ul>
                            ${(tag.resources || []).map((reference, index) => renderOrganizationResourceLink(reference, index)).join('') || '<li><span class="workspace-explorer__empty">No resources tagged.</span></li>'}
                        </ul>
                    </details>
                </li>
            `).join('')
            : '<li><span class="workspace-explorer__empty">No tags are available.</span></li>';

        return `
            <section class="workspace-explorer__group" role="region" aria-labelledby="workspace-group-tags-heading">
                <h4 id="workspace-group-tags-heading">Tags</h4>
                <ul>${items}</ul>
            </section>
        `;
    };

    const renderSavedViewsSection = () => {
        const savedViews = Array.isArray(organizationSections.savedViews) ? organizationSections.savedViews : [];
        const favorites = new Set(Array.isArray(organizationSections.favorites?.savedViews) ? organizationSections.favorites.savedViews : []);
        const recent = new Set(Array.isArray(organizationSections.recent?.savedViews) ? organizationSections.recent.savedViews : []);

        const items = savedViews.length > 0
            ? savedViews.map((savedView) => `
                <li>
                    <button type="button" data-organization-item="true" data-organization-item-type="saved-view" data-organization-item-id="${escapeHtml(savedView.id)}">
                        ${escapeHtml(savedView.name)}${favorites.has(savedView.id) ? ' *' : ''}${recent.has(savedView.id) ? ' (Recent)' : ''}
                    </button>
                </li>
            `).join('')
            : '<li><span class="workspace-explorer__empty">No saved views are available.</span></li>';

        return `
            <section class="workspace-explorer__group" role="region" aria-labelledby="workspace-group-saved-views-heading">
                <h4 id="workspace-group-saved-views-heading">Saved Views</h4>
                <ul>${items}</ul>
            </section>
        `;
    };

    groups.innerHTML = grouped.map((group) => {
        const visibleItems = group.items.filter((item) => !filterValue || String(item.name || '').toLowerCase().includes(filterValue));
        const listItems = visibleItems.length > 0
            ? visibleItems.map((item) => renderResourceNode(item)).join('')
            : '<li><span class="workspace-explorer__empty">No matching resources.</span></li>';

        return `
            <section class="workspace-explorer__group" role="region" aria-labelledby="workspace-group-${group.key}-heading">
                <h4 id="workspace-group-${group.key}-heading">${group.label}</h4>
                <ul>${listItems}</ul>
            </section>
        `;
    }).join('') + renderCollectionSection() + renderTagsSection() + renderSavedViewsSection();

    const { statistics, health } = buildWorkspaceStatistics(active);
    const summary = `Workspace ${active.name}. Reports ${statistics.totalReports || 0}. Assets ${statistics.projectAssets || 0}. Completion ${health.projectCompletion || 0} percent.`;
    const status = document.getElementById('workspace-explorer-status');
    if (status) status.textContent = summary;
}

function showProjectPropertiesDialog(triggerElement = null) {
    ensureWorkspaceDialogs();
    const dialog = document.getElementById('project-workspace-properties-dialog');
    const content = document.getElementById('project-workspace-properties-content');
    const closeButton = document.getElementById('btn-workspace-properties-close');
    const saveButton = document.getElementById('btn-workspace-properties-save');
    const cancelButton = document.getElementById('btn-workspace-properties-cancel');
    if (!dialog || !content || !closeButton || !saveButton || !cancelButton) return false;

    const workspace = getActiveWorkspaceSafe();
    if (!workspace) {
        updateExplorerStatus('Open or create a Project Workspace first.');
        return false;
    }

    const { statistics, health } = buildWorkspaceStatistics(workspace);
    const workspaceRelationships = getRelationshipSummaryForResource({
        resourceType: 'workspace',
        resourceId: workspace.id,
        workspaceId: workspace.id
    });
    const validationIssues = validateWorkspaceRelationships(workspace);

    content.innerHTML = `
        <div class="workspace-dialog__tabs" role="tablist" aria-label="Project Properties tabs">
            <button id="workspace-properties-tab-general" type="button" role="tab" aria-selected="true" aria-controls="workspace-properties-panel-general">General</button>
            <button id="workspace-properties-tab-relationships" type="button" role="tab" aria-selected="false" aria-controls="workspace-properties-panel-relationships">Relationships</button>
        </div>
        <section id="workspace-properties-panel-general" role="tabpanel" aria-labelledby="workspace-properties-tab-general">
        <label for="workspace-properties-name">Project Name</label>
        <input id="workspace-properties-name" type="text" value="${workspace.name}">
        <label for="workspace-properties-description">Project Description</label>
        <textarea id="workspace-properties-description" rows="4">${workspace.description || ''}</textarea>
        <label for="workspace-properties-owner">Project Owner</label>
        <input id="workspace-properties-owner" type="text" value="${workspace.owner || ''}">
        <label for="workspace-properties-organization">Organization</label>
        <input id="workspace-properties-organization" type="text" value="${workspace.organization || ''}">
        <label for="workspace-properties-status">Current Status</label>
        <input id="workspace-properties-status" type="text" value="${workspace.status || 'Draft'}">
        <p><strong>Project ID:</strong> ${workspace.id}</p>
        <p><strong>Date Created:</strong> ${formatDate(workspace.createdAt)}</p>
        <p><strong>Last Modified:</strong> ${formatDate(workspace.lastModifiedAt)}</p>
        <h4>Project Statistics</h4>
        <ul>
            <li>Total Reports: ${statistics.totalReports || 0}</li>
            <li>Completed Reports: ${statistics.completedReports || 0}</li>
            <li>Draft Reports: ${statistics.draftReports || 0}</li>
            <li>Templates: ${statistics.templates || 0}</li>
            <li>Project Assets: ${statistics.projectAssets || 0}</li>
            <li>Relationships: ${statistics.relationships || 0}</li>
            <li>Accessibility Findings: ${statistics.accessibilityFindings || 0}</li>
        </ul>
        <h4>Project Health</h4>
        <ul>
            <li>Project Completion: ${health.projectCompletion || 0}%</li>
            <li>Reports Remaining: ${health.reportsRemaining || 0}</li>
            <li>Outstanding Findings: ${health.outstandingFindings || 0}</li>
            <li>Validation Status: ${health.validationStatus || 'stable'}</li>
        </ul>
        </section>
        <section id="workspace-properties-panel-relationships" role="tabpanel" aria-labelledby="workspace-properties-tab-relationships" hidden>
            <h4>Relationship Summary</h4>
            <ul>
                ${workspaceRelationships.length > 0
                    ? workspaceRelationships.map((category) => `<li>${escapeHtml(category.label)} (${Number(category.count || 0)})</li>`).join('')
                    : '<li>No relationships are currently registered.</li>'}
            </ul>
            <h4>Impact Analysis</h4>
            <p>This workspace currently contains ${statistics.relationships || 0} registered relationships across ${statistics.totalReports || 0} reports, ${statistics.templates || 0} templates, and ${statistics.projectAssets || 0} project assets.</p>
            <h4>Relationship Validation</h4>
            <ul>
                ${validationIssues.length > 0
                    ? validationIssues.map((issue) => `<li>${escapeHtml(issue.message || issue.code || 'Relationship issue detected.')}</li>`).join('')
                    : '<li>No relationship validation issues were detected.</li>'}
            </ul>
            <button id="btn-workspace-relationships-repair" type="button">Repair Relationships</button>
        </section>
    `;

    const tabGeneral = document.getElementById('workspace-properties-tab-general');
    const tabRelationships = document.getElementById('workspace-properties-tab-relationships');
    const panelGeneral = document.getElementById('workspace-properties-panel-general');
    const panelRelationships = document.getElementById('workspace-properties-panel-relationships');
    const repairRelationshipsButton = document.getElementById('btn-workspace-relationships-repair');
    const switchTab = (target) => {
        if (!tabGeneral || !tabRelationships || !panelGeneral || !panelRelationships) return;
        const showRelationships = target === 'relationships';
        tabGeneral.setAttribute('aria-selected', String(!showRelationships));
        tabRelationships.setAttribute('aria-selected', String(showRelationships));
        panelGeneral.hidden = showRelationships;
        panelRelationships.hidden = !showRelationships;
    };
    tabGeneral?.addEventListener('click', () => switchTab('general'));
    tabRelationships?.addEventListener('click', () => switchTab('relationships'));
    repairRelationshipsButton?.addEventListener('click', () => {
        repairWorkspaceRelationshipsFromCommand(repairRelationshipsButton);
        closeWorkspaceDialog(dialog, triggerElement);
    });

    const closeDialogHandler = () => closeWorkspaceDialog(dialog, triggerElement);
    closeButton.onclick = closeDialogHandler;
    cancelButton.onclick = closeDialogHandler;

    saveButton.onclick = () => {
        const nextName = normalizeText(document.getElementById('workspace-properties-name')?.value || workspace.name);
        const nextDescription = normalizeText(document.getElementById('workspace-properties-description')?.value || '');
        const nextOwner = normalizeText(document.getElementById('workspace-properties-owner')?.value || '');
        const nextOrganization = normalizeText(document.getElementById('workspace-properties-organization')?.value || '');
        const nextStatus = normalizeText(document.getElementById('workspace-properties-status')?.value || 'Draft') || 'Draft';

        const renamed = renameProjectWorkspace(workspace.id, nextName, {
            folderName: workspace.folderName,
            action: `Updated project properties for ${nextName}`,
            persist: true
        });
        if (!renamed) return;

        upsertProjectWorkspace({
            ...renamed,
            description: nextDescription,
            owner: nextOwner,
            organization: nextOrganization,
            status: nextStatus,
            lastModifiedAt: new Date().toISOString(),
            statistics: calculateProjectWorkspaceStatistics(renamed.id) || {},
            health: calculateProjectWorkspaceHealth(renamed.id) || {}
        }, {
            action: `Saved project properties for ${nextName}`,
            setActive: true,
            persist: true
        });

        renderWorkspaceExplorer();
        closeWorkspaceDialog(dialog, triggerElement);
        updateExplorerStatus(`Saved Project Properties for ${nextName}.`);
        dispatchWorkspaceUpdatedEvent('WorkspaceUpdated', {
            workspaceId: workspace.id,
            workspaceName: nextName
        });
    };

    dialog.onkeydown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialogHandler();
    };

    openWorkspaceDialog(dialog, document.getElementById('workspace-properties-name'));
    return true;
}

async function copyTextToClipboard(text, successMessage) {
    const value = normalizeText(text);
    if (!value || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    announce(successMessage);
    return true;
}

function resolveWorkspaceResourceTargetFromContext(context = {}) {
    const source = context && typeof context === 'object' ? context : {};
    const resourceType = normalizeText(source.resourceType || source.type);
    const resourceId = normalizeText(source.resourceId || source.id);
    if (resourceType && resourceId) {
        return {
            resourceType,
            resourceId,
            triggerElement: source.triggerElement || source.anchorElement || null
        };
    }

    const anchor = source.triggerElement instanceof HTMLElement
        ? source.triggerElement
        : source.anchorElement instanceof HTMLElement
            ? source.anchorElement
            : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
    const element = anchor?.closest?.('[data-resource-type][data-resource-id]');
    if (!(element instanceof HTMLElement)) return null;

    return {
        resourceType: normalizeText(element.getAttribute('data-resource-type')),
        resourceId: normalizeText(element.getAttribute('data-resource-id')),
        triggerElement: element
    };
}

function filterRelationshipCategories(categories, mode = 'all') {
    const normalizedMode = normalizeText(mode).toLowerCase();
    const filters = {
        dependents: new Set(['used-by', 'referenced-by', 'required-by', 'contained-in', 'generated-outputs', 'shared-with']),
        references: new Set(['references', 'uses', 'depends-on', 'contains', 'generated-from', 'shared-with'])
    };
    if (normalizedMode === 'all') return Array.isArray(categories) ? categories : [];
    const allowed = filters[normalizedMode];
    if (!allowed) return Array.isArray(categories) ? categories : [];
    return (Array.isArray(categories) ? categories : []).filter((category) => allowed.has(normalizeText(category.relationshipType).toLowerCase()));
}

function showResourcePropertiesDialog(resourceType, resourceId, triggerElement = null, options = {}) {
    ensureWorkspaceDialogs();
    const dialog = document.getElementById('workspace-resource-properties-dialog');
    const content = document.getElementById('workspace-resource-properties-content');
    const closeButton = document.getElementById('btn-workspace-resource-properties-close');
    const revealButton = document.getElementById('btn-workspace-resource-reveal');
    const showRelationshipsButton = document.getElementById('btn-workspace-resource-show-relationships');
    const showDependentsButton = document.getElementById('btn-workspace-resource-show-dependents');
    const showReferencesButton = document.getElementById('btn-workspace-resource-show-references');
    const previewDeletionButton = document.getElementById('btn-workspace-resource-preview-deletion');
    const copyNameButton = document.getElementById('btn-workspace-resource-copy-name');
    const copyPathButton = document.getElementById('btn-workspace-resource-copy-path');
    const copyRelationshipsButton = document.getElementById('btn-workspace-resource-copy-relationships');
    const active = getActiveWorkspaceSafe();

    if (!dialog || !content || !closeButton || !revealButton || !showRelationshipsButton || !showDependentsButton || !showReferencesButton || !previewDeletionButton || !copyNameButton || !copyPathButton || !copyRelationshipsButton || !active) {
        return false;
    }

    const details = getWorkspaceResourceDetails({ resourceType, resourceId }, active);
    if (!details) return false;

    [revealButton, showRelationshipsButton, showDependentsButton, showReferencesButton, previewDeletionButton, copyNameButton, copyPathButton, copyRelationshipsButton]
        .forEach((button) => {
            button.setAttribute('data-resource-type', details.type);
            button.setAttribute('data-resource-id', details.id);
        });

    const requestedMode = normalizeText(options.relationshipMode || 'all').toLowerCase() || 'all';
    const requestedSearch = normalizeText(options.relationshipSearch || document.getElementById('workspace-resource-relationship-search')?.value || '');
    const visibleRelationshipCategories = filterRelationshipCategories(details.relationships || [], requestedMode);

    const relationshipRows = visibleRelationshipCategories.filter((category) => {
        const filterValue = requestedSearch.toLowerCase();
        if (!filterValue) return true;
        return String(category.label || '').toLowerCase().includes(filterValue)
            || (category.resources || []).some((item) => String(item.name || '').toLowerCase().includes(filterValue));
    });

    content.innerHTML = `
        <div class="workspace-dialog__tabs" role="tablist" aria-label="Resource Properties tabs">
            <button id="workspace-resource-tab-overview" type="button" role="tab" aria-selected="true" aria-controls="workspace-resource-panel-overview">Overview</button>
            <button id="workspace-resource-tab-relationships" type="button" role="tab" aria-selected="false" aria-controls="workspace-resource-panel-relationships">Relationships</button>
        </div>
        <section id="workspace-resource-panel-overview" role="tabpanel" aria-labelledby="workspace-resource-tab-overview">
            <p><strong>Name:</strong> ${escapeHtml(details.name)}</p>
            <p><strong>Type:</strong> ${escapeHtml(details.type)}</p>
            <p><strong>Category:</strong> ${escapeHtml(details.category || details.subtitle || 'Resource')}</p>
            <p><strong>Path:</strong> ${escapeHtml(details.path || 'Not available')}</p>
            <h4>Impact Analysis</h4>
            <ul>
                ${details.impact?.categories?.length > 0
                    ? details.impact.categories.map((item) => `<li>${escapeHtml(item.label)}</li>`).join('')
                    : '<li>No related resources are currently affected.</li>'}
            </ul>
        </section>
        <section id="workspace-resource-panel-relationships" role="tabpanel" aria-labelledby="workspace-resource-tab-relationships" hidden>
            <label for="workspace-resource-relationship-search">Search relationships</label>
            <input id="workspace-resource-relationship-search" type="search" autocomplete="off" spellcheck="false" value="${escapeHtml(requestedSearch)}">
            <p class="workspace-explorer__resource-meta">Press Escape to clear the relationship search.</p>
            <div id="workspace-resource-relationship-results">
                ${(relationshipRows.length > 0 ? relationshipRows : visibleRelationshipCategories).map((category) => `
                    <section class="workspace-explorer__relationship-group" role="group" aria-label="${escapeHtml(category.label)}">
                        <h5>${escapeHtml(category.label)} (${Number(category.count || 0)})</h5>
                        <ul>
                            ${(category.resources || []).map((resource) => `
                                <li>
                                    <button type="button" data-workspace-resource="true" data-related-resource="true" data-resource-type="${escapeHtml(resource.type)}" data-resource-id="${escapeHtml(resource.id)}">
                                        ${escapeHtml(resource.name)}
                                    </button>
                                </li>
                            `).join('') || '<li><span class="workspace-explorer__empty">No related resources.</span></li>'}
                        </ul>
                    </section>
                `).join('') || '<p>No related resources are currently registered.</p>'}
            </div>
        </section>
    `;

    const tabOverview = document.getElementById('workspace-resource-tab-overview');
    const tabRelationships = document.getElementById('workspace-resource-tab-relationships');
    const panelOverview = document.getElementById('workspace-resource-panel-overview');
    const panelRelationships = document.getElementById('workspace-resource-panel-relationships');
    const searchInput = document.getElementById('workspace-resource-relationship-search');
    const switchTab = (target) => {
        if (!tabOverview || !tabRelationships || !panelOverview || !panelRelationships) return;
        const showRelationships = target === 'relationships';
        tabOverview.setAttribute('aria-selected', String(!showRelationships));
        tabRelationships.setAttribute('aria-selected', String(showRelationships));
        panelOverview.hidden = showRelationships;
        panelRelationships.hidden = !showRelationships;
        if (showRelationships && searchInput instanceof HTMLInputElement) {
            window.setTimeout(() => searchInput.focus(), 0);
        }
    };

    tabOverview?.addEventListener('click', () => switchTab('overview'));
    tabRelationships?.addEventListener('click', () => switchTab('relationships'));

    if (normalizeText(options.initialTab).toLowerCase() === 'relationships') {
        switchTab('relationships');
    }

    searchInput?.addEventListener('input', () => {
        showResourcePropertiesDialog(resourceType, resourceId, triggerElement, {
            initialTab: 'relationships',
            relationshipMode: requestedMode,
            relationshipSearch: searchInput.value
        });
        switchTab('relationships');
    });
    searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchInput instanceof HTMLInputElement) {
            if (searchInput.value) {
                event.preventDefault();
                searchInput.value = '';
                showResourcePropertiesDialog(resourceType, resourceId, triggerElement, {
                    initialTab: 'relationships',
                    relationshipMode: requestedMode,
                    relationshipSearch: ''
                });
                switchTab('relationships');
                return;
            }
        }
    });

    const closeDialogHandler = () => closeWorkspaceDialog(dialog, triggerElement);
    closeButton.onclick = closeDialogHandler;
    revealButton.onclick = () => {
        revealWorkspaceResourceFromCommand(resourceType, resourceId, { select: true, focus: true });
        closeDialogHandler();
    };
    showRelationshipsButton.onclick = () => {
        showResourcePropertiesDialog(resourceType, resourceId, triggerElement, {
            initialTab: 'relationships',
            relationshipMode: 'all'
        });
    };
    showDependentsButton.onclick = () => {
        showResourcePropertiesDialog(resourceType, resourceId, triggerElement, {
            initialTab: 'relationships',
            relationshipMode: 'dependents'
        });
    };
    showReferencesButton.onclick = () => {
        showResourcePropertiesDialog(resourceType, resourceId, triggerElement, {
            initialTab: 'relationships',
            relationshipMode: 'references'
        });
    };
    previewDeletionButton.onclick = () => {
        openResourceDeletionAnalysisFromCommand(resourceType, resourceId, () => false, triggerElement);
    };
    copyNameButton.onclick = () => {
        void copyTextToClipboard(details.name, `Copied ${details.name}.`);
    };
    copyPathButton.onclick = () => {
        void copyTextToClipboard(details.path || details.name, `Copied path for ${details.name}.`);
    };
    copyRelationshipsButton.onclick = () => {
        const text = (details.relationships || []).map((category) => `${category.label}: ${(category.resources || []).map((resource) => resource.name).join(', ')}`).join('\n');
        void copyTextToClipboard(text, `Copied relationship information for ${details.name}.`);
    };

    dialog.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialogHandler();
        }
    };

    openWorkspaceDialog(dialog, tabOverview || closeButton);
    return true;
}

function showDeletionAnalysisDialog(resourceType, resourceId, onConfirm, triggerElement = null) {
    ensureWorkspaceDialogs();
    const dialog = document.getElementById('workspace-resource-deletion-dialog');
    const content = document.getElementById('workspace-resource-deletion-content');
    const closeButton = document.getElementById('btn-workspace-resource-deletion-close');
    const repairButton = document.getElementById('btn-workspace-resource-deletion-repair');
    const confirmButton = document.getElementById('btn-workspace-resource-deletion-confirm');
    const cancelButton = document.getElementById('btn-workspace-resource-deletion-cancel');
    const active = getActiveWorkspaceSafe();
    if (!dialog || !content || !closeButton || !repairButton || !confirmButton || !cancelButton || !active) return false;

    const resource = getWorkspaceResourceDetails({ resourceType, resourceId }, active);
    const preview = getDeletionPreview({ resourceType, resourceId, workspaceId: active.id });
    if (!resource) return false;

    confirmButton.textContent = resource.type === 'report' || resource.type === 'template'
        ? 'Delete and Remove References'
        : 'Delete';
    repairButton.hidden = preview.brokenRelationshipCount <= 0;
    repairButton.disabled = preview.brokenRelationshipCount <= 0;

    content.innerHTML = `
        <p>The selected ${escapeHtml(resource.type)} is <strong>${escapeHtml(resource.name)}</strong>.</p>
        <p>${preview.consequences.join(' ') || 'No relationship impact was detected.'}</p>
        <h4>Affected Resources</h4>
        <ul>
            ${preview.affectedResources.length > 0
                ? preview.affectedResources.map((item) => `<li>${escapeHtml(item.name)} (${escapeHtml(item.type)})</li>`).join('')
                : '<li>No affected resources were detected.</li>'}
        </ul>
    `;

    pendingDeletionRequest = {
        onConfirm: typeof onConfirm === 'function' ? onConfirm : null,
        triggerElement
    };

    const closeDialogHandler = () => {
        pendingDeletionRequest = null;
        closeWorkspaceDialog(dialog, triggerElement);
    };

    closeButton.onclick = closeDialogHandler;
    repairButton.onclick = () => {
        repairWorkspaceRelationshipsFromCommand(repairButton);
        closeDialogHandler();
    };
    cancelButton.onclick = closeDialogHandler;
    confirmButton.onclick = () => {
        const confirmed = pendingDeletionRequest?.onConfirm ? pendingDeletionRequest.onConfirm() : false;
        if (confirmed !== false) closeDialogHandler();
    };

    dialog.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialogHandler();
        }
    };

    openWorkspaceDialog(dialog, confirmButton);
    return true;
}

function buildExportBundle(format, options = {}) {
    const workspace = getActiveWorkspaceSafe();
    if (!workspace) return null;
    const payload = buildProjectWorkspacePayload(captureActiveWorkspaceState(workspace), options);
    return {
        format,
        exportedAt: new Date().toISOString(),
        payload
    };
}

async function exportWorkspaceAsDownload(fileName, dataText, mimeType = 'application/json') {
    const blob = new Blob([dataText], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
}

async function exportWorkspaceUsingDialog(triggerElement = null) {
    ensureWorkspaceDialogs();
    const dialog = document.getElementById('project-workspace-export-dialog');
    const closeButton = document.getElementById('btn-workspace-export-close');
    const startButton = document.getElementById('btn-workspace-export-start');
    const cancelButton = document.getElementById('btn-workspace-export-cancel');
    const formatSelect = document.getElementById('workspace-export-format');
    const includeReports = document.getElementById('workspace-export-reports');
    const includeTemplates = document.getElementById('workspace-export-templates');
    const includeAssets = document.getElementById('workspace-export-assets');
    const includeWorkspaceState = document.getElementById('workspace-export-workspace-state');
    const status = document.getElementById('workspace-export-status');

    if (!dialog || !closeButton || !startButton || !cancelButton || !formatSelect || !includeReports || !includeTemplates || !includeAssets || !includeWorkspaceState || !status) {
        return false;
    }

    const workspace = getActiveWorkspaceSafe();
    if (!workspace) {
        updateExplorerStatus('Open or create a Project Workspace before exporting.');
        return false;
    }

    const closeDialogHandler = () => closeWorkspaceDialog(dialog, triggerElement);
    closeButton.onclick = closeDialogHandler;
    cancelButton.onclick = closeDialogHandler;

    startButton.onclick = async () => {
        const format = String(formatSelect.value || 'folder');
        const options = {
            includeReports: includeReports.checked,
            includeTemplates: includeTemplates.checked,
            includeAssets: includeAssets.checked,
            includeWorkspaceState: includeWorkspaceState.checked
        };

        const bundle = buildExportBundle(format, options);
        if (!bundle) {
            status.textContent = 'No active workspace to export.';
            return;
        }

        try {
            if (format === 'folder' && typeof window.showDirectoryPicker === 'function') {
                const destination = await window.showDirectoryPicker({ mode: 'readwrite' });
                await persistWorkspaceToDirectory(workspace, destination);
                status.textContent = `Exported ${workspace.name} as Project Workspace Folder.`;
                updateExplorerStatus(status.textContent);
                closeWorkspaceDialog(dialog, triggerElement);
                return;
            }

            const safeName = sanitizeFolderName(workspace.name, 'Project Workspace');
            if (format === 'zip') {
                const exported = JSON.stringify(bundle, null, 2);
                await exportWorkspaceAsDownload(`${safeName}.zip.json`, exported, 'application/json');
                status.textContent = 'ZIP export created as portable JSON package for browser compatibility.';
                updateExplorerStatus(status.textContent);
                closeWorkspaceDialog(dialog, triggerElement);
                return;
            }

            const fallback = JSON.stringify(bundle.payload, null, 2);
            await exportWorkspaceAsDownload(`${safeName}.artproj`, fallback, 'application/json');
            status.textContent = `Exported ${workspace.name} as Project.artproj.`;
            updateExplorerStatus(status.textContent);
            closeWorkspaceDialog(dialog, triggerElement);
        } catch (error) {
            status.textContent = 'Export failed. Verify file permissions and try again.';
        }
    };

    dialog.onkeydown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialogHandler();
    };

    openWorkspaceDialog(dialog, formatSelect);
    return true;
}

async function openWorkspaceFromDirectory() {
    if (typeof window.showDirectoryPicker !== 'function') {
        workspaceImportFileInput?.click();
        return true;
    }

    try {
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
        const projectFileHandle = await directory.getFileHandle(PROJECT_FILE_NAME, { create: false });
        const projectFile = await projectFileHandle.getFile();
        const text = await projectFile.text();
        const payload = JSON.parse(text);
        const result = applyWorkspaceFromPayload(payload, {
            folderPath: directory.name,
            folderName: directory.name
        });
        if (!result.ok) {
            updateExplorerStatus('Unable to open Project Workspace. The Project.artproj file is invalid.');
            return false;
        }

        runtimeHandles.workspaceDirectories.set(result.workspace.id, directory);
        updateExplorerStatus(`Opened Project Workspace ${result.workspace.name}.`);
        renderWorkspaceExplorer();
        return true;
    } catch (error) {
        updateExplorerStatus('Open Project Workspace cancelled or failed.');
        return false;
    }
}

async function saveActiveWorkspace(saveAs = false) {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('Create or open a Project Workspace first.');
        return false;
    }

    if (saveAs || !runtimeHandles.workspaceDirectories.has(active.id) || typeof window.showDirectoryPicker !== 'function') {
        if (typeof window.showDirectoryPicker !== 'function') {
            const payload = JSON.stringify(buildProjectWorkspacePayload(captureActiveWorkspaceState(active)), null, 2);
            await exportWorkspaceAsDownload(`${sanitizeFolderName(active.name, active.name)}.artproj`, payload, 'application/json');
            updateExplorerStatus(`Saved ${active.name} as a downloadable Project.artproj file.`);
            return true;
        }

        try {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
            await persistWorkspaceToDirectory(active, directory);
            updateExplorerStatus(`Saved Project Workspace ${active.name}.`);
            renderWorkspaceExplorer();
            return true;
        } catch (error) {
            updateExplorerStatus('Save cancelled or failed.');
            return false;
        }
    }

    try {
        const directory = runtimeHandles.workspaceDirectories.get(active.id);
        await persistWorkspaceToDirectory(active, directory);
        updateExplorerStatus(`Saved Project Workspace ${active.name}.`);
        renderWorkspaceExplorer();
        return true;
    } catch (error) {
        updateExplorerStatus('Unable to save workspace. Try Save Workspace As.');
        return false;
    }
}

function restoreWorkspaceRuntimeState(workspace) {
    if (!workspace) return false;
    const state = workspace.workspaceState || {};
    if (state.activeReportId) {
        appState.selectedReportId = String(state.activeReportId || '').trim();
    }
    if (state.dashboardConfig && typeof state.dashboardConfig === 'object') {
        appState.dashboard = {
            ...appState.dashboard,
            ...state.dashboardConfig
        };
    }
    saveState({ action: `Restored workspace ${workspace.name}`, recordHistory: false });
    reconcileWorkspaceRelationshipIntegrity(workspace.id || workspace, {
        persist: true,
        action: `Reconciled restored workspace ${workspace.name}`,
        setActive: true
    });
    window.dispatchEvent(new Event('art-dashboard-config-updated'));
    window.dispatchEvent(new Event('art-reports-updated'));
    dispatchWorkspaceUpdatedEvent('WorkspaceRestored', {
        workspaceId: workspace.id,
        workspaceName: workspace.name
    });
    return true;
}

function openMostRecentWorkspace() {
    const recent = getRecentProjectWorkspaces();
    if (!recent.length) {
        updateExplorerStatus('No recent Project Workspaces are available.');
        return false;
    }

    const workspaces = getProjectWorkspaces();
    const candidate = recent.find((entry) => workspaces.some((workspace) => workspace.id === entry.workspaceId || workspace.id === entry.id));
    if (!candidate) {
        updateExplorerStatus('No recent Project Workspaces are available in local state.');
        return false;
    }

    const workspace = workspaces.find((item) => item.id === candidate.workspaceId || item.id === candidate.id) || null;
    if (!workspace) return false;

    const activated = setActiveProjectWorkspace(workspace.id, {
        action: `Opened recent project workspace ${workspace.name}`,
        persist: true
    });
    if (!activated) return false;

    restoreWorkspaceRuntimeState(workspace);
    renderWorkspaceExplorer();
    updateExplorerStatus(`Continue Working restored ${workspace.name}.`);
    return true;
}

function refreshWorkspaceAssociations(workspace) {
    if (!workspace) return null;
    const next = captureActiveWorkspaceState(workspace);
    const statistics = calculateProjectWorkspaceStatistics(next.id) || {};
    const health = calculateProjectWorkspaceHealth(next.id) || {};
    return upsertProjectWorkspace({
        ...next,
        statistics,
        health,
        lastModifiedAt: new Date().toISOString()
    }, {
        action: `Updated workspace context for ${next.name}`,
        setActive: true,
        persist: true
    });
}

function bindWorkspaceExplorerEvents() {
    const shell = ensureWorkspaceExplorerShell();
    if (!shell) return;

    const filterInput = document.getElementById('workspace-resource-filter');
    const newWorkspaceButton = document.getElementById('btn-workspace-new');
    const openWorkspaceButton = document.getElementById('btn-workspace-open');
    const closeWorkspaceButton = document.getElementById('btn-workspace-close');
    const saveWorkspaceButton = document.getElementById('btn-workspace-save');
    const saveWorkspaceAsButton = document.getElementById('btn-workspace-save-as');
    const exportWorkspaceButton = document.getElementById('btn-workspace-export');
    const refreshButton = document.getElementById('btn-workspace-refresh');
    const addAssetButton = document.getElementById('btn-workspace-add-asset');
    const tagManagerButton = document.getElementById('btn-workspace-tag-manager');
    const collectionManagerButton = document.getElementById('btn-workspace-collection-manager');
    const savedViewManagerButton = document.getElementById('btn-workspace-saved-view-manager');
    const openSavedViewButton = document.getElementById('btn-workspace-open-saved-view');
    const saveCurrentViewButton = document.getElementById('btn-workspace-save-current-view');
    const propertiesButton = document.getElementById('btn-workspace-properties');

    newWorkspaceButton?.addEventListener('click', () => {
        createProjectWorkspaceFromCommand(newWorkspaceButton);
    });

    openWorkspaceButton?.addEventListener('click', () => {
        void openProjectWorkspaceFromCommand(openWorkspaceButton);
    });

    closeWorkspaceButton?.addEventListener('click', () => {
        closeProjectWorkspaceFromCommand();
    });

    saveWorkspaceButton?.addEventListener('click', () => {
        void saveProjectWorkspaceFromCommand();
    });

    saveWorkspaceAsButton?.addEventListener('click', () => {
        void saveProjectWorkspaceAsFromCommand();
    });

    exportWorkspaceButton?.addEventListener('click', () => {
        void exportProjectWorkspaceFromCommand(exportWorkspaceButton);
    });

    filterInput?.addEventListener('input', () => {
        renderWorkspaceExplorer();
        const active = getActiveWorkspaceSafe();
        if (!active) return;
        const state = active.workspaceState || {};
        updateProjectWorkspaceState(active.id, {
            resourceNavigator: {
                ...(state.resourceNavigator || {}),
                filterText: filterInput.value || ''
            }
        }, {
            action: 'Updated resource navigator filter',
            persist: true
        });
    });

    refreshButton?.addEventListener('click', () => {
        const active = getActiveWorkspaceSafe();
        if (!active) {
            updateExplorerStatus('No active workspace to refresh.');
            return;
        }
        refreshWorkspaceAssociations(active);
        renderWorkspaceExplorer();
        updateExplorerStatus('Workspace resources refreshed.');
    });

    addAssetButton?.addEventListener('click', () => {
        void startAddProjectAssetWorkflow();
    });

    tagManagerButton?.addEventListener('click', () => {
        openTagManagerFromCommand();
        renderWorkspaceExplorer();
    });

    collectionManagerButton?.addEventListener('click', () => {
        openCollectionManagerFromCommand();
        renderWorkspaceExplorer();
    });

    savedViewManagerButton?.addEventListener('click', () => {
        openSavedViewManagerFromCommand();
        renderWorkspaceExplorer();
    });

    openSavedViewButton?.addEventListener('click', () => {
        openSavedViewFromCommand();
    });

    saveCurrentViewButton?.addEventListener('click', () => {
        createSavedViewFromCurrentWorkingViewFromCommand();
        renderWorkspaceExplorer();
    });

    propertiesButton?.addEventListener('click', () => {
        showProjectPropertiesDialog(propertiesButton);
    });

    shell.addEventListener('click', (event) => {
        const propertyTrigger = event.target instanceof Element ? event.target.closest('[data-open-resource-properties="true"]') : null;
        if (propertyTrigger instanceof HTMLElement) {
            showResourcePropertiesDialog(propertyTrigger.getAttribute('data-resource-type') || '', propertyTrigger.getAttribute('data-resource-id') || '', propertyTrigger);
            return;
        }

        const gotoTrigger = event.target instanceof Element ? event.target.closest('[data-go-to-resource="true"]') : null;
        if (gotoTrigger instanceof HTMLElement) {
            revealWorkspaceResourceFromCommand(gotoTrigger.getAttribute('data-resource-type') || '', gotoTrigger.getAttribute('data-resource-id') || '', {
                select: true,
                focus: true
            });
            return;
        }

        const organizationTrigger = event.target instanceof Element ? event.target.closest('[data-organization-item="true"]') : null;
        if (organizationTrigger instanceof HTMLElement) {
            const organizationWorkspace = getActiveWorkspaceSafe();
            const itemType = normalizeText(organizationTrigger.getAttribute('data-organization-item-type'));
            if (itemType === 'resource') {
                const handled = handleOrganizationExplorerAction({
                    itemType,
                    resourceType: organizationTrigger.getAttribute('data-resource-type') || '',
                    resourceId: organizationTrigger.getAttribute('data-resource-id') || '',
                    workspaceId: organizationTrigger.getAttribute('data-workspace-id') || organizationWorkspace?.id || ''
                });
                if (handled) updateExplorerStatus('Opened resource from organizational navigation.');
                return;
            }

            const handled = handleOrganizationExplorerAction({
                itemType,
                itemId: organizationTrigger.getAttribute('data-organization-item-id') || ''
            });
            if (handled) {
                updateExplorerStatus('Opened organizational item.');
                renderWorkspaceExplorer();
            }
            return;
        }

        const trigger = event.target instanceof Element ? event.target.closest('[data-workspace-resource="true"]') : null;
        if (!trigger) return;

        const resourceType = trigger.getAttribute('data-resource-type') || '';
        const resourceId = trigger.getAttribute('data-resource-id') || '';

        if (resourceType === 'report') {
            appState.selectedReportId = resourceId;
            saveState({ action: 'Selected workspace report', recordHistory: false });
            const reportSelect = document.getElementById('recent-reports-select');
            if (reportSelect) {
                reportSelect.value = resourceId;
                reportSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateExplorerStatus('Workspace report selected.');
            return;
        }

        if (resourceType === 'template') {
            const templateSelect = document.getElementById('template-selection');
            if (templateSelect) {
                templateSelect.value = resourceId;
                templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateExplorerStatus('Workspace template selected.');
            return;
        }

        if (resourceType === 'asset') {
            const active = getActiveWorkspaceSafe();
            const asset = active?.resources?.projectAssets?.find((item) => item.id === resourceId);
            if (!asset) return;
            updateExplorerStatus(`Project asset selected: ${asset.title || asset.fileName}.`);
            return;
        }

        updateExplorerStatus('Resource selected in Explorer.');
    });

    shell.addEventListener('toggle', (event) => {
        const details = event.target instanceof HTMLElement ? event.target.closest('[data-workspace-resource-node="true"]') : null;
        if (!(details instanceof HTMLElement)) return;
        const active = getActiveWorkspaceSafe();
        if (!active) return;

        const nodeId = normalizeText(details.getAttribute('data-resource-node-id'));
        if (!nodeId) return;
        const expanded = new Set(Array.isArray(active.workspaceState?.resourceNavigator?.expandedResourceIds)
            ? active.workspaceState.resourceNavigator.expandedResourceIds.map((value) => normalizeText(value)).filter(Boolean)
            : []);

        if (details.hasAttribute('open')) {
            expanded.add(nodeId);
        } else {
            expanded.delete(nodeId);
        }

        updateProjectWorkspaceState(active.id, {
            resourceNavigator: {
                ...(active.workspaceState?.resourceNavigator || {}),
                expandedResourceIds: [...expanded]
            }
        }, {
            action: 'Updated resource relationship expansion state',
            persist: true
        });
    });
}

async function importWorkspaceFromFile(file) {
    if (!file) return false;
    try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (payload?.format === 'workspace-export-bundle' && payload?.payload) {
            const result = applyWorkspaceFromPayload(payload.payload, {
                folderPath: '',
                folderName: payload.payload?.workspace?.folderName || payload.payload?.workspace?.name || ''
            });
            if (!result.ok) {
                updateExplorerStatus('Import failed. Export bundle is invalid.');
                return false;
            }
            updateExplorerStatus(`Imported Project Workspace ${result.workspace.name}.`);
            renderWorkspaceExplorer();
            return true;
        }

        const result = applyWorkspaceFromPayload(payload, {
            folderPath: '',
            folderName: payload?.workspace?.folderName || payload?.workspace?.name || ''
        });

        if (!result.ok) {
            updateExplorerStatus('Import failed. Project workspace file is invalid.');
            return false;
        }

        updateExplorerStatus(`Imported Project Workspace ${result.workspace.name}.`);
        renderWorkspaceExplorer();
        return true;
    } catch (error) {
        updateExplorerStatus('Import failed. Could not read workspace file.');
        return false;
    }
}

async function startAddProjectAssetWorkflow() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('Create or open a Project Workspace before adding assets.');
        return false;
    }

    if (!workspaceAssetFileInput) return false;
    workspaceAssetFileInput.value = '';
    workspaceAssetFileInput.click();
    return true;
}

function collectProjectWorkspaceValidation(workspace) {
    if (!workspace) return [];
    const issues = [];
    if (!workspace.name) issues.push('Project name is required.');
    if (!workspace.id) issues.push('Project identifier is required.');
    if (!workspace.resources || typeof workspace.resources !== 'object') {
        issues.push('Workspace resources are missing.');
    }

    const seen = new Set();
    (workspace.relationships || []).forEach((relationship) => {
        const key = `${relationship.fromType}:${relationship.fromId}->${relationship.toType}:${relationship.toId}`;
        if (seen.has(key)) issues.push(`Duplicate relationship detected: ${relationship.label || key}`);
        seen.add(key);
    });

    const relationshipIssues = validateWorkspaceRelationships(workspace);
    relationshipIssues.forEach((issue) => {
        if (issue?.message) issues.push(issue.message);
    });

    return [...new Set(issues)];
}

function publishValidationResults(workspace) {
    const issues = collectProjectWorkspaceValidation(workspace);
    dispatchWorkspaceUpdatedEvent('ValidationCompleted', {
        workspaceId: workspace?.id || '',
        workspaceName: workspace?.name || '',
        issueCount: issues.length,
        issues
    });
    return issues;
}

function bindWorkspaceFileInputs() {
    if (!workspaceAssetFileInput) {
        workspaceAssetFileInput = document.createElement('input');
        workspaceAssetFileInput.type = 'file';
        workspaceAssetFileInput.multiple = true;
        workspaceAssetFileInput.hidden = true;
        workspaceAssetFileInput.tabIndex = -1;
        workspaceAssetFileInput.setAttribute('aria-hidden', 'true');
        document.body.appendChild(workspaceAssetFileInput);
    }

    if (!workspaceImportFileInput) {
        workspaceImportFileInput = document.createElement('input');
        workspaceImportFileInput.type = 'file';
        workspaceImportFileInput.accept = '.artproj,.json';
        workspaceImportFileInput.hidden = true;
        workspaceImportFileInput.tabIndex = -1;
        workspaceImportFileInput.setAttribute('aria-hidden', 'true');
        document.body.appendChild(workspaceImportFileInput);
    }

    workspaceAssetFileInput.addEventListener('change', async () => {
        const active = getActiveWorkspaceSafe();
        if (!active) return;

        const files = Array.from(workspaceAssetFileInput.files || []);
        if (!files.length) return;

        const nextWorkspace = getActiveWorkspaceSafe();
        if (!nextWorkspace) return;

        const directoryHandle = runtimeHandles.workspaceDirectories.get(nextWorkspace.id) || null;

        for (const file of files) {
            const extension = String(file.name || '').includes('.')
                ? String(file.name).split('.').pop().toLowerCase()
                : '';
            const category = extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'gif' || extension === 'webp'
                ? 'Images'
                : 'Other';
            const categoryFolder = resolveAssetCategoryPath(category);

            const relativePath = `Project Assets/${categoryFolder}/${file.name}`;

            const asset = addProjectWorkspaceAsset(nextWorkspace.id, {
                title: file.name,
                fileName: file.name,
                extension,
                mimeType: file.type || '',
                category: categoryFolder,
                dateAdded: new Date().toISOString(),
                lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
                addedBy: appState.auditors || '',
                tags: [],
                linkedReportIds: appState.selectedReportId ? [appState.selectedReportId] : [],
                linkedFindingIds: [],
                relativePath,
                sourceFileName: file.name,
                sourceSize: Number(file.size || 0),
                metadata: {
                    readOnlyInArt: true
                }
            }, {
                action: `Added project asset ${file.name}`,
                persist: true
            });

            if (asset && appState.selectedReportId) {
                addProjectWorkspaceRelationship(nextWorkspace.id, {
                    type: 'asset-report-link',
                    fromType: 'asset',
                    fromId: asset.id,
                    toType: 'report',
                    toId: appState.selectedReportId,
                    label: `${file.name} linked to report`
                }, {
                    persist: true,
                    action: 'Linked project asset to report'
                });
            }

            if (directoryHandle) {
                try {
                    const assetsRoot = await directoryHandle.getDirectoryHandle('Project Assets', { create: true });
                    const folder = await assetsRoot.getDirectoryHandle(categoryFolder, { create: true });
                    const fileHandle = await folder.getFileHandle(file.name, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();
                } catch (error) {
                    // Metadata persists even when a file copy is blocked by permissions.
                }
            }
        }

        refreshWorkspaceAssociations(getActiveWorkspaceSafe());
        renderWorkspaceExplorer();
        updateExplorerStatus(`${files.length} project asset${files.length === 1 ? '' : 's'} added.`);
    });

    workspaceImportFileInput.addEventListener('change', async () => {
        const file = workspaceImportFileInput.files && workspaceImportFileInput.files[0];
        if (!file) return;
        await importWorkspaceFromFile(file);
    });
}

function bindWorkspaceSyncEvents() {
    const sync = () => {
        const active = getActiveWorkspaceSafe();
        if (!active) {
            renderWorkspaceExplorer();
            return;
        }

        refreshWorkspaceAssociations(active);
        renderWorkspaceExplorer();
    };

    window.addEventListener('art-reports-updated', sync);
    window.addEventListener('art-templates-updated', sync);
    window.addEventListener('art-dashboard-config-updated', sync);

    window.addEventListener('art-resource-organization-reveal-resource', (event) => {
        const reference = event?.detail?.reference;
        if (!reference) return;
        revealWorkspaceResourceFromCommand(reference.resourceType, reference.resourceId, {
            workspaceId: reference.workspaceId,
            select: true,
            focus: true
        });
    });
}

export function initProjectWorkspaceFramework(options = {}) {
    if (frameworkInitialized) return true;
    frameworkInitialized = true;
    workspaceOptions = {
        ...workspaceOptions,
        ...(options && typeof options === 'object' ? options : {})
    };

    ensureWorkspaceDialogs();
    ensureWorkspaceExplorerShell();
    bindWorkspaceFileInputs();
    bindWorkspaceExplorerEvents();
    bindWorkspaceSyncEvents();
    renderWorkspaceExplorer();
    return true;
}

export function createProjectWorkspaceFromCommand(triggerElement = null) {
    captureFocusBeforeWorkspaceActivation(triggerElement);
    const workspace = createWorkspaceFromPrompt();
    if (!workspace) return false;

    const created = upsertProjectWorkspace(workspace, {
        action: `Created project workspace ${workspace.name}`,
        setActive: true,
        persist: true
    });

    appState.projectName = created.name;
    saveState({ action: `Activated project workspace ${created.name}`, recordHistory: false });
    dispatchWorkspaceUpdatedEvent('WorkspaceCreated', {
        workspaceId: created.id,
        workspaceName: created.name
    });
    renderWorkspaceExplorer();
    updateExplorerStatus(`Created Project Workspace ${created.name}. Save Workspace to choose a folder.`);
    return true;
}

export async function openProjectWorkspaceFromCommand(triggerElement = null) {
    captureFocusBeforeWorkspaceActivation(triggerElement);
    const opened = await openWorkspaceFromDirectory();
    if (opened) {
        window.dispatchEvent(new Event('art-reports-updated'));
        window.dispatchEvent(new Event('art-dashboard-config-updated'));
    }
    return opened;
}

export function openRecentProjectWorkspaceFromCommand() {
    captureFocusBeforeWorkspaceActivation();
    return openMostRecentWorkspace();
}

export function continueWorkingFromCommand() {
    captureFocusBeforeWorkspaceActivation();
    return openMostRecentWorkspace();
}

export function closeProjectWorkspaceFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace to close.');
        return false;
    }

    const saveBeforeClose = window.confirm(`Save Project Workspace ${active.name} before closing?`);
    if (saveBeforeClose) {
        void saveActiveWorkspace(false);
    }

    closeActiveProjectWorkspace({ action: `Closed project workspace ${active.name}`, persist: true });
    dispatchWorkspaceUpdatedEvent('WorkspaceClosed', {
        workspaceId: active.id,
        workspaceName: active.name
    });
    renderWorkspaceExplorer();
    restoreFocusAfterWorkspaceClosed();
    const closedWorkspaceName = normalizeText(active.name || 'Project');
    updateExplorerStatus(`${closedWorkspaceName} Workspace closed.`);
    return true;
}

export async function saveProjectWorkspaceFromCommand() {
    return saveActiveWorkspace(false);
}

export async function saveProjectWorkspaceAsFromCommand() {
    return saveActiveWorkspace(true);
}

export function renameProjectWorkspaceFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace to rename.');
        return false;
    }

    const nextName = normalizeText(window.prompt('Rename Project Workspace', active.name));
    if (!nextName || nextName === active.name) return false;

    const renamed = renameProjectWorkspace(active.id, nextName, {
        folderName: sanitizeFolderName(nextName, nextName),
        action: `Renamed project workspace ${nextName}`,
        persist: true
    });

    if (!renamed) return false;
    reconcileWorkspaceRelationshipIntegrity(renamed.id, {
        persist: true,
        action: `Reconciled renamed workspace ${renamed.name}`,
        setActive: true
    });
    appState.projectName = renamed.name;
    saveState({ action: `Renamed project workspace ${renamed.name}`, recordHistory: false });
    renderWorkspaceExplorer();
    updateExplorerStatus(`Renamed Project Workspace to ${renamed.name}.`);
    return true;
}

export function duplicateProjectWorkspaceFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace to duplicate.');
        return false;
    }

    const duplicateName = normalizeText(window.prompt('Duplicate Project Workspace name', `${active.name} Copy`));
    if (!duplicateName) return false;

    const duplicate = duplicateProjectWorkspace(active.id, {
        name: duplicateName,
        folderName: sanitizeFolderName(duplicateName, duplicateName),
        action: `Duplicated project workspace ${active.name}`
    });

    if (!duplicate) return false;
    reconcileWorkspaceRelationshipIntegrity(duplicate.id, {
        persist: true,
        action: `Reconciled duplicated workspace ${duplicate.name}`,
        setActive: true
    });
    renderWorkspaceExplorer();
    updateExplorerStatus(`Duplicated Project Workspace as ${duplicate.name}.`);
    return true;
}

export async function importProjectWorkspaceFromCommand() {
    captureFocusBeforeWorkspaceActivation();
    if (typeof window.showDirectoryPicker === 'function') {
        const useFolder = window.confirm('Select OK to import from a Project Workspace folder, or Cancel to import from a Project.artproj file.');
        if (useFolder) {
            return openWorkspaceFromDirectory();
        }
    }

    workspaceImportFileInput.value = '';
    workspaceImportFileInput.click();
    return true;
}

export async function exportProjectWorkspaceFromCommand(triggerElement = null) {
    return exportWorkspaceUsingDialog(triggerElement);
}

export function deleteProjectWorkspaceFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace to delete.');
        return false;
    }

    return showDeletionAnalysisDialog('workspace', active.id, () => {
        const deleted = deleteProjectWorkspace(active.id, {
            action: `Deleted project workspace ${active.name}`,
            persist: true
        });
        if (!deleted) return false;

        runtimeHandles.workspaceDirectories.delete(active.id);
        renderWorkspaceExplorer();
        updateExplorerStatus(`Deleted Project Workspace ${deleted.name} from ART state.`);
        return true;
    });
}

export function openProjectPropertiesFromCommand(triggerElement = null) {
    return showProjectPropertiesDialog(triggerElement);
}

export function openProjectStatisticsFromCommand() {
    return showProjectPropertiesDialog(null);
}

export function openWorkspaceSettingsFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const currentStatus = normalizeText(active.status || 'Draft');
    const nextStatus = normalizeText(window.prompt('Workspace Status', currentStatus)) || currentStatus;
    const updated = upsertProjectWorkspace({
        ...active,
        status: nextStatus,
        lastModifiedAt: new Date().toISOString()
    }, {
        action: `Updated workspace settings for ${active.name}`,
        setActive: true,
        persist: true
    });

    if (!updated) return false;
    renderWorkspaceExplorer();
    updateExplorerStatus(`Workspace settings updated for ${updated.name}.`);
    return true;
}

export function addProjectAssetFromCommand() {
    void startAddProjectAssetWorkflow();
    return true;
}

export function createAssetFolderFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const folderName = normalizeText(window.prompt('Create Asset Folder', 'Other'));
    if (!folderName) return false;

    if (!active.resources.extensions || typeof active.resources.extensions !== 'object') {
        active.resources.extensions = {};
    }
    const customFolders = Array.isArray(active.resources.extensions.customAssetFolders)
        ? active.resources.extensions.customAssetFolders
        : [];
    if (!customFolders.includes(folderName)) {
        active.resources.extensions.customAssetFolders = [...customFolders, folderName];
    }

    upsertProjectWorkspace(active, {
        action: `Created asset folder ${folderName}`,
        setActive: true,
        persist: true
    });

    updateExplorerStatus(`Created asset folder ${folderName}.`);
    return true;
}

export function removeProjectAssetFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const assets = active.resources.projectAssets || [];
    if (!assets.length) {
        updateExplorerStatus('No project assets are available to remove.');
        return false;
    }

    const labels = assets.map((asset, index) => `${index + 1}. ${asset.title || asset.fileName}`).join('\n');
    const rawIndex = normalizeText(window.prompt(`Select an asset number to remove:\n${labels}`, '1'));
    const parsedIndex = Number(rawIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 1 || parsedIndex > assets.length) return false;

    const selectedAsset = assets[parsedIndex - 1];
    return showDeletionAnalysisDialog('asset', selectedAsset.id, () => {
        const removed = removeProjectWorkspaceAsset(active.id, selectedAsset.id, {
            action: `Removed project asset ${selectedAsset.title || selectedAsset.fileName}`,
            persist: true
        });

        if (!removed) return false;

        renderWorkspaceExplorer();
        updateExplorerStatus(`Removed project asset ${removed.title || removed.fileName}.`);
        return true;
    });
}

export function refreshWorkspaceAssetsFromCommand() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    refreshWorkspaceAssociations(active);
    renderWorkspaceExplorer();
    const issues = publishValidationResults(getActiveWorkspaceSafe());
    updateExplorerStatus(`Workspace refreshed. Validation found ${issues.length} issue${issues.length === 1 ? '' : 's'}.`);
    return true;
}

export function repairWorkspaceRelationshipsFromCommand(triggerElement = null) {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const result = repairWorkspaceRelationshipStore(active.id, {
        action: `Repaired workspace relationships for ${active.name}`,
        persist: true,
        setActive: true
    });
    renderWorkspaceExplorer();
    const repairedCount = Number(result.removedIssueCount || 0);
    updateExplorerStatus(repairedCount > 0
        ? `Relationship repair completed. Resolved ${repairedCount} issue${repairedCount === 1 ? '' : 's'}.`
        : 'Relationship repair completed. No invalid relationships remained.');
    if (triggerElement && typeof triggerElement.focus === 'function') {
        window.setTimeout(() => triggerElement.focus(), 0);
    }
    return true;
}

export function revealWorkspaceReportFromCommand(reportId, options = {}) {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const targetReportId = normalizeText(reportId);
    if (!targetReportId) return false;

    refreshWorkspaceAssociations(active);
    renderWorkspaceExplorer();

    const filterText = normalizeText(options.filterText);
    const filterInput = document.getElementById('workspace-resource-filter');
    if (filterInput && filterText) {
        filterInput.value = filterText;
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const selector = `[data-workspace-resource="true"][data-resource-type="report"][data-resource-id="${targetReportId}"]`;
    const trigger = document.querySelector(selector);
    if (!(trigger instanceof HTMLElement)) {
        updateExplorerStatus('The requested report was not found in Resource Navigator.');
        return false;
    }

    const autoSelect = options.select !== false;
    if (autoSelect) trigger.click();
    trigger.focus({ preventScroll: true });
    trigger.scrollIntoView({ block: 'nearest' });
    updateExplorerStatus('Revealed report in Resource Navigator.');
    return true;
}

export function revealWorkspaceResourceFromCommand(resourceType, resourceId, options = {}) {
    const active = options.workspaceId ? getProjectWorkspaces().find((workspace) => workspace.id === options.workspaceId) || getActiveWorkspaceSafe() : getActiveWorkspaceSafe();
    if (!active) {
        updateExplorerStatus('No active Project Workspace.');
        return false;
    }

    const targetType = normalizeText(resourceType);
    const targetId = normalizeText(resourceId);
    if (!targetType || !targetId) return false;

    const filterInput = document.getElementById('workspace-resource-filter');
    if (filterInput instanceof HTMLInputElement && options.clearFilter !== false) {
        filterInput.value = '';
    }

    const expanded = new Set(Array.isArray(active.workspaceState?.resourceNavigator?.expandedResourceIds)
        ? active.workspaceState.resourceNavigator.expandedResourceIds.map((value) => normalizeText(value)).filter(Boolean)
        : []);
    expanded.add(`${targetType}:${targetId}`);

    updateProjectWorkspaceState(active.id, {
        resourceNavigator: {
            ...(active.workspaceState?.resourceNavigator || {}),
            expandedResourceIds: [...expanded]
        }
    }, {
        action: 'Revealed related workspace resource',
        persist: true
    });

    renderWorkspaceExplorer();

    const selector = `[data-workspace-resource="true"][data-resource-type="${targetType}"][data-resource-id="${targetId}"]`;
    const trigger = document.querySelector(selector);
    if (!(trigger instanceof HTMLElement)) {
        updateExplorerStatus('The requested resource could not be revealed in Resource Navigator.');
        return false;
    }

    if (options.select !== false) trigger.click();
    if (options.focus !== false) trigger.focus({ preventScroll: true });
    trigger.scrollIntoView({ block: 'nearest' });
    updateExplorerStatus('Revealed related resource in Resource Navigator.');
    return true;
}

export function openResourceDeletionAnalysisFromCommand(resourceType, resourceId, onConfirm = null, triggerElement = null) {
    return showDeletionAnalysisDialog(resourceType, resourceId, onConfirm, triggerElement);
}

export function openResourceRelationshipsFromCommand(context = {}) {
    const target = resolveWorkspaceResourceTargetFromContext(context);
    if (!target) return false;
    return showResourcePropertiesDialog(target.resourceType, target.resourceId, target.triggerElement, {
        initialTab: 'relationships',
        relationshipMode: 'all'
    });
}

export function openResourceDependentsFromCommand(context = {}) {
    const target = resolveWorkspaceResourceTargetFromContext(context);
    if (!target) return false;
    return showResourcePropertiesDialog(target.resourceType, target.resourceId, target.triggerElement, {
        initialTab: 'relationships',
        relationshipMode: 'dependents'
    });
}

export function openResourceReferencesFromCommand(context = {}) {
    const target = resolveWorkspaceResourceTargetFromContext(context);
    if (!target) return false;
    return showResourcePropertiesDialog(target.resourceType, target.resourceId, target.triggerElement, {
        initialTab: 'relationships',
        relationshipMode: 'references'
    });
}

export function previewResourceDeletionImpactFromCommand(context = {}) {
    const target = resolveWorkspaceResourceTargetFromContext(context);
    if (!target) return false;
    return openResourceDeletionAnalysisFromCommand(target.resourceType, target.resourceId, () => false, target.triggerElement);
}

export function revealWorkspaceCurrentReportFromCommand(options = {}) {
    const reportId = normalizeText(appState.selectedReportId);
    if (!reportId) {
        updateExplorerStatus('No report is currently selected.');
        return false;
    }
    return revealWorkspaceReportFromCommand(reportId, options);
}

export function getWorkspaceExplorerSummary() {
    const active = getActiveWorkspaceSafe();
    if (!active) {
        return {
            hasWorkspace: false,
            message: 'No active workspace.'
        };
    }

    const { statistics, health } = buildWorkspaceStatistics(active);
    return {
        hasWorkspace: true,
        workspaceId: active.id,
        workspaceName: active.name,
        statistics,
        health,
        validationIssues: collectProjectWorkspaceValidation(active)
    };
}
