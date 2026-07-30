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
    saveState,
    setActiveProjectWorkspace,
    updateProjectWorkspaceState,
    upsertProjectWorkspace
} from './state.js';

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
    workspaceDirectories: new Map()
};

let frameworkInitialized = false;
let workspaceAssetFileInput = null;
let workspaceImportFileInput = null;
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
            <button id="btn-workspace-save" type="button">Save Workspace</button>
            <button id="btn-workspace-save-as" type="button">Save Workspace As</button>
            <button id="btn-workspace-export" type="button">Export Workspace</button>
            <label for="workspace-resource-filter">Filter resources</label>
            <input id="workspace-resource-filter" type="search" autocomplete="off" spellcheck="false" aria-describedby="workspace-explorer-status workspace-explorer-description">
            <button id="btn-workspace-refresh" type="button">Refresh Resources</button>
            <button id="btn-workspace-add-asset" type="button">Add Project Asset</button>
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
    const includeReports = options.includeReports !== false;
    const includeTemplates = options.includeTemplates !== false;
    const includeAssets = options.includeAssets !== false;
    const includeWorkspaceState = options.includeWorkspaceState !== false;

    const { statistics, health } = buildWorkspaceStatistics(workspace);

    const payload = {
        format: PROJECT_WORKSPACE_FORMAT,
        formatVersion: PROJECT_WORKSPACE_FORMAT_VERSION,
        schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
        metadata: {
            projectName: workspace.name,
            projectId: workspace.id,
            projectDescription: workspace.description,
            projectOwner: workspace.owner,
            organization: workspace.organization,
            dateCreated: workspace.createdAt,
            lastModified: new Date().toISOString(),
            projectVersion: workspace.projectVersion || '2.0',
            currentStatus: workspace.status
        },
        workspace: {
            ...workspace,
            lastModifiedAt: new Date().toISOString(),
            statistics,
            health,
            workspaceState: includeWorkspaceState ? workspace.workspaceState : {},
            resources: {
                ...workspace.resources,
                reports: includeReports ? workspace.resources.reports : [],
                templates: includeTemplates ? workspace.resources.templates : [],
                projectAssets: includeAssets ? workspace.resources.projectAssets : []
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

    const saved = upsertProjectWorkspace(workspace, {
        action: `Opened project workspace ${workspace.name}`,
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
    return {
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
    const active = getActiveWorkspaceSafe();

    if (!groups || !filterInput) return;

    if (!active) {
        groups.innerHTML = '<p>No Project Workspace is currently active.</p>';
        return;
    }

    const filterValue = normalizeText(filterInput.value).toLowerCase();
    const reportNames = (appState.reports || [])
        .filter((report) => (active.resources.reports || active.associatedReportIds || []).includes(report.id))
        .map((report) => ({ id: report.id, name: report.name, type: 'report' }));

    const templateNames = (appState.userTemplates || [])
        .filter((template) => (active.resources.templates || active.associatedTemplateIds || []).includes(template.id))
        .map((template) => ({ id: template.id, name: template.name, type: 'template' }));

    const assets = (active.resources.projectAssets || []).map((asset) => ({
        id: asset.id,
        name: asset.title || asset.fileName,
        type: 'asset',
        category: asset.category
    }));

    const grouped = [
        { key: 'reports', label: 'Reports', items: reportNames },
        { key: 'templates', label: 'Templates', items: templateNames },
        { key: 'assets', label: 'Project Assets', items: assets },
        { key: 'auditLogs', label: 'Audit Logs', items: (active.resources.auditLogs || []).map((name, index) => ({ id: `audit-${index}`, name, type: 'auditLog' })) },
        { key: 'progressLogs', label: 'Progress Logs', items: (active.resources.progressLogs || []).map((name, index) => ({ id: `progress-${index}`, name, type: 'progressLog' })) },
        { key: 'attachments', label: 'Attachments', items: (active.resources.attachments || []).map((item) => ({ id: item.id, name: item.title || item.fileName, type: 'attachment' })) },
        { key: 'exports', label: 'Exports', items: (active.resources.exports || []).map((name, index) => ({ id: `export-${index}`, name, type: 'export' })) },
        { key: 'backups', label: 'Backups', items: (active.resources.backups || []).map((name, index) => ({ id: `backup-${index}`, name, type: 'backup' })) }
    ];

    groups.innerHTML = grouped.map((group) => {
        const visibleItems = group.items.filter((item) => !filterValue || String(item.name || '').toLowerCase().includes(filterValue));
        const listItems = visibleItems.length > 0
            ? visibleItems.map((item) => `
                <li>
                    <button type="button" data-workspace-resource="true" data-resource-type="${item.type}" data-resource-id="${item.id}">
                        ${item.name}
                    </button>
                </li>
            `).join('')
            : '<li><span class="workspace-explorer__empty">No matching resources.</span></li>';

        return `
            <section class="workspace-explorer__group" role="region" aria-labelledby="workspace-group-${group.key}-heading">
                <h4 id="workspace-group-${group.key}-heading">${group.label}</h4>
                <ul>${listItems}</ul>
            </section>
        `;
    }).join('');

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

    content.innerHTML = `
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
    `;

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
    const saveWorkspaceButton = document.getElementById('btn-workspace-save');
    const saveWorkspaceAsButton = document.getElementById('btn-workspace-save-as');
    const exportWorkspaceButton = document.getElementById('btn-workspace-export');
    const refreshButton = document.getElementById('btn-workspace-refresh');
    const addAssetButton = document.getElementById('btn-workspace-add-asset');
    const propertiesButton = document.getElementById('btn-workspace-properties');

    newWorkspaceButton?.addEventListener('click', () => {
        createProjectWorkspaceFromCommand();
    });

    openWorkspaceButton?.addEventListener('click', () => {
        void openProjectWorkspaceFromCommand();
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

    propertiesButton?.addEventListener('click', () => {
        showProjectPropertiesDialog(propertiesButton);
    });

    shell.addEventListener('click', (event) => {
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
        }
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

    return issues;
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

export function createProjectWorkspaceFromCommand() {
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

export async function openProjectWorkspaceFromCommand() {
    const opened = await openWorkspaceFromDirectory();
    if (opened) {
        window.dispatchEvent(new Event('art-reports-updated'));
        window.dispatchEvent(new Event('art-dashboard-config-updated'));
    }
    return opened;
}

export function openRecentProjectWorkspaceFromCommand() {
    return openMostRecentWorkspace();
}

export function continueWorkingFromCommand() {
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
    updateExplorerStatus(`Closed Project Workspace ${active.name}.`);
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
    renderWorkspaceExplorer();
    updateExplorerStatus(`Duplicated Project Workspace as ${duplicate.name}.`);
    return true;
}

export async function importProjectWorkspaceFromCommand() {
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

    const confirmed = window.confirm(`Delete Project Workspace ${active.name} from ART workspace state? This does not delete files from disk.`);
    if (!confirmed) return false;

    const deleted = deleteProjectWorkspace(active.id, {
        action: `Deleted project workspace ${active.name}`,
        persist: true
    });
    if (!deleted) return false;

    runtimeHandles.workspaceDirectories.delete(active.id);
    renderWorkspaceExplorer();
    updateExplorerStatus(`Deleted Project Workspace ${deleted.name} from ART state.`);
    return true;
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
    const confirmed = window.confirm(`Remove project asset ${selectedAsset.title || selectedAsset.fileName} from workspace?`);
    if (!confirmed) return false;

    const removed = removeProjectWorkspaceAsset(active.id, selectedAsset.id, {
        action: `Removed project asset ${selectedAsset.title || selectedAsset.fileName}`,
        persist: true
    });

    if (!removed) return false;

    renderWorkspaceExplorer();
    updateExplorerStatus(`Removed project asset ${removed.title || removed.fileName}.`);
    return true;
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
