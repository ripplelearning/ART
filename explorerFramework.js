import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import {
    announce,
    appState,
    getActiveProjectWorkspace,
    getRecentProjectWorkspaces,
    getRecentReports,
    getUniversalSearchConfig,
    getUserTemplates,
    getWorkspaceViewConfig,
    loadReportById,
    loadTemplate,
    setActiveWorkspaceView,
    updateWorkspaceViewConfig
} from './state.js';
import { runUniversalSearch, executeUniversalSearchResult } from './universalSearchFramework.js';

let initialized = false;
let selectedResourceId = '';
let focusedResourceId = '';
let searchText = '';
let searchResults = [];
let treeIndex = new Map();
let rowById = new Map();
let parentById = new Map();
let sectionById = new Map();
let firstLetterBuffer = '';
let firstLetterTimer = 0;

function normalizeText(value) {
    return String(value || '').trim();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDashboardSection() {
    return document.getElementById('dashboard');
}

function ensureExplorerShell() {
    const dashboard = getDashboardSection();
    if (!dashboard) return null;

    let dashboardView = document.getElementById('dashboard-workspace-view-dashboard');
    if (!dashboardView) {
        dashboardView = document.createElement('div');
        dashboardView.id = 'dashboard-workspace-view-dashboard';

        const heading = dashboard.querySelector('#dash-heading');
        const nodesToMove = [...dashboard.children].filter((child) => child !== heading);
        nodesToMove.forEach((node) => dashboardView.appendChild(node));
        dashboard.appendChild(dashboardView);
    }

    let explorer = document.getElementById('art-explorer-view');
    if (!explorer) {
        explorer = document.createElement('section');
        explorer.id = 'art-explorer-view';
        explorer.className = 'art-explorer';
        explorer.setAttribute('role', 'navigation');
        explorer.setAttribute('aria-label', 'Explorer Navigation');
        explorer.hidden = true;
        explorer.innerHTML = `
            <h2 id="art-explorer-heading" tabindex="-1">Explorer</h2>
            <div class="art-explorer__toolbar" role="group" aria-label="Explorer Search">
                <label for="art-explorer-search">Search Explorer</label>
                <div class="art-explorer__search-row">
                    <input id="art-explorer-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search resources" aria-describedby="art-explorer-status">
                    <button id="btn-art-explorer-clear-search" type="button">Clear</button>
                </div>
                <p id="art-explorer-status" role="status" aria-live="polite" aria-atomic="true"></p>
            </div>
            <div id="art-explorer-sections" class="art-explorer__sections"></div>
        `;
        dashboard.appendChild(explorer);
    }

    return { dashboardView, explorer };
}

function resolveWorkspaceView() {
    return getWorkspaceViewConfig();
}

function getExplorerConfig() {
    const config = resolveWorkspaceView();
    return config.explorer || {};
}

function getCurrentContextKind() {
    if (searchText) return 'search-results';

    const activeWorkspace = getActiveProjectWorkspace();
    if (activeWorkspace) return 'project-workspace';

    if (normalizeText(appState.templateEditingId)) return 'template';

    const reportActive = normalizeText(appState.selectedReportId)
        || normalizeText(appState.reportTitle)
        || (Array.isArray(appState.fields) && appState.fields.length > 0);
    if (reportActive) return 'report';

    return 'application';
}

function resolveSearchScope() {
    const context = getCurrentContextKind();
    if (context === 'project-workspace') return 'current-project-workspace';
    if (context === 'report') return 'current-report';
    return 'workspace';
}

function buildResource(id, label, type, options = {}) {
    return {
        id,
        label,
        type,
        description: normalizeText(options.description),
        action: normalizeText(options.action),
        commandId: normalizeText(options.commandId),
        badge: Number.isFinite(Number(options.badge)) ? Number(options.badge) : null,
        status: normalizeText(options.status),
        readOnly: options.readOnly === true,
        payload: options.payload || null,
        children: Array.isArray(options.children) ? options.children : []
    };
}

function buildApplicationSections() {
    const explorerConfig = getExplorerConfig();
    const recentReports = getRecentReports().slice(0, 12).map((report) => buildResource(
        `report:${report.id}`,
        report.name || 'Untitled Report',
        'report',
        {
            action: 'openEditor',
            description: 'Open report in Report Editor.',
            payload: { reportId: report.id }
        }
    ));

    const recentWorkspaces = getRecentProjectWorkspaces().slice(0, 8).map((workspace) => buildResource(
        `workspace:${workspace.id}`,
        workspace.name || 'Untitled Workspace',
        'project-workspace',
        {
            action: 'openProjectWorkspace',
            description: 'Open Project Workspace.',
            payload: { workspaceId: workspace.id }
        }
    ));

    const templates = getUserTemplates().slice(0, 12).map((template) => buildResource(
        `template:${template.id}`,
        template.name || 'Untitled Template',
        'template',
        {
            action: 'openTemplate',
            description: 'Open template in the dashboard template area.',
            payload: { templateId: template.id }
        }
    ));

    const savedSearches = (getUniversalSearchConfig().savedSearches || []).slice(0, 12).map((saved) => buildResource(
        `saved-search:${saved.id}`,
        saved.name || saved.query || 'Saved Search',
        'saved-search',
        {
            action: 'searchEverywhere',
            description: saved.query || 'Run saved search.',
            payload: { query: saved.query || '' }
        }
    ));

    const favorites = (explorerConfig.favorites || []).map((resourceId) => {
        const fallbackLabel = resourceId.split(':').slice(1).join(':') || resourceId;
        return buildResource(resourceId, fallbackLabel, 'favorite', {
            action: '',
            description: 'Favorited resource.'
        });
    });

    const sections = [
        { id: 'recent-reports', title: `Recent Reports (${recentReports.length})`, items: recentReports, emptyMessage: 'No recent reports are available.' },
        { id: 'recent-workspaces', title: `Recent Project Workspaces (${recentWorkspaces.length})`, items: recentWorkspaces, emptyMessage: 'No recent Project Workspaces are available.' },
        { id: 'templates', title: `Templates (${templates.length})`, items: templates, emptyMessage: 'No templates are available yet.' },
        { id: 'saved-searches', title: `Saved Searches (${savedSearches.length})`, items: savedSearches, emptyMessage: 'No saved searches are available.' }
    ];

    if (explorerConfig.showFavorites !== false) {
        sections.push({
            id: 'favorites',
            title: `Favorites (${favorites.length})`,
            items: favorites,
            emptyMessage: 'No Favorites have been added. Use the Explorer context menu to add Favorites.'
        });
    }

    return sections;
}

function buildReportSections() {
    const reportName = normalizeText(appState.reportTitle) || 'Current Report';
    const hasAttachments = Object.values(appState.editorFieldValues || {}).some((value) => Array.isArray(value) && value.length > 0);

    const root = buildResource(`report-root:${normalizeText(appState.selectedReportId) || 'active'}`, reportName, 'report-root', {
        children: [
            buildResource('report-metadata', 'Report Metadata', 'metadata', { action: 'editReport' }),
            buildResource('report-findings', 'Findings', 'findings', { action: 'openEditor' }),
            buildResource('report-attachments', 'Attachments', 'attachments', { action: 'attachFile', badge: hasAttachments ? 1 : 0 }),
            buildResource('report-linked-standards', 'Linked Accessibility Standards', 'standards', { action: 'focusLookup' }),
            buildResource('report-configuration', 'Report Configuration', 'configuration', { action: 'configureReport' }),
            buildResource('report-export-options', 'Export Options', 'export-options', { action: 'exportReport' }),
            buildResource('report-properties', 'Report Properties', 'properties', { action: 'reportStatistics' })
        ]
    });

    return [
        {
            id: 'report-context',
            title: reportName,
            items: [root],
            emptyMessage: 'No report resources are available.'
        }
    ];
}

function buildWorkspaceSections() {
    const workspace = getActiveProjectWorkspace();
    if (!workspace) return [];

    const reportsById = new Map((appState.reports || []).map((report) => [report.id, report]));
    const templatesById = new Map((getUserTemplates() || []).map((template) => [template.id, template]));

    const reportItems = (workspace.resources?.reports || []).map((id) => {
        const report = reportsById.get(id);
        return buildResource(`report:${id}`, report?.name || 'Report', 'report', { action: 'openEditor', payload: { reportId: id } });
    });

    const progressItems = (workspace.resources?.progressLogs || []).map((name, index) => buildResource(
        `progress-log:${index}`,
        name || `Progress Log ${index + 1}`,
        'progress-log',
        { action: 'openProgressLog' }
    ));

    const assetItems = (workspace.resources?.projectAssets || []).map((asset) => buildResource(
        `project-asset:${asset.id}`,
        asset.title || asset.fileName || 'Project Asset',
        'project-asset',
        {
            action: '',
            readOnly: true,
            status: 'Read-only',
            description: 'Project assets are read-only inside ART.'
        }
    ));

    const templateItems = (workspace.resources?.templates || []).map((id) => {
        const template = templatesById.get(id);
        return buildResource(`template:${id}`, template?.name || 'Template', 'template', { action: 'openTemplate', payload: { templateId: id } });
    });

    const savedSearchItems = (getUniversalSearchConfig().savedSearches || []).slice(0, 12).map((saved) => buildResource(
        `saved-search:${saved.id}`,
        saved.name || saved.query || 'Saved Search',
        'saved-search',
        { action: 'searchEverywhere', payload: { query: saved.query || '' } }
    ));

    const favorites = (getExplorerConfig().favorites || []).map((id) => buildResource(id, id.replace(/^.+?:/, ''), 'favorite', { action: '' }));

    const sections = [
        { id: 'workspace-reports', title: `Reports (${reportItems.length})`, items: reportItems, emptyMessage: 'No reports are associated with this Project Workspace.' },
        { id: 'workspace-progress-logs', title: `Progress Logs (${progressItems.length})`, items: progressItems, emptyMessage: 'No Progress Logs are associated with this Project Workspace.' },
        { id: 'workspace-assets', title: `Project Assets (${assetItems.length})`, items: assetItems, emptyMessage: 'No Project Assets have been added. Use Add Project Asset to attach supporting documentation.' },
        { id: 'workspace-templates', title: `Templates (${templateItems.length})`, items: templateItems, emptyMessage: 'No templates are associated with this Project Workspace.' },
        { id: 'workspace-saved-searches', title: `Saved Searches (${savedSearchItems.length})`, items: savedSearchItems, emptyMessage: 'No saved searches exist for this workspace context.' }
    ];

    if (getExplorerConfig().showFavorites !== false) {
        sections.push({
            id: 'workspace-favorites',
            title: `Favorites (${favorites.length})`,
            items: favorites,
            emptyMessage: 'No Favorites have been added yet.'
        });
    }

    return sections;
}

function buildTemplateSections() {
    const template = (getUserTemplates() || []).find((item) => item.id === appState.templateEditingId) || null;
    if (!template) return [];

    const root = buildResource(`template:${template.id}`, template.name || 'Template', 'template', {
        children: [
            buildResource(`template-metadata:${template.id}`, 'Template Metadata', 'template-metadata', { action: 'editTemplate' }),
            buildResource(`template-associated-reports:${template.id}`, 'Associated Reports', 'template-associated-reports', { action: 'newReportFromTemplate' }),
            buildResource(`template-properties:${template.id}`, 'Template Properties', 'template-properties', { action: 'openTemplate' }),
            buildResource(`template-export:${template.id}`, 'Export Options', 'template-export-options', { action: 'exportTemplate' })
        ]
    });

    return [{
        id: 'template-context',
        title: template.name || 'Template',
        items: [root],
        emptyMessage: 'No template resources are available.'
    }];
}

function buildSearchSections() {
    const results = searchResults.map((result, index) => buildResource(
        `search:${result.id}:${index}`,
        result.title || result.raw?.name || 'Search Result',
        String(result.type || 'resource'),
        {
            action: '',
            description: `${result.providerName || 'Provider'}${result.subtitle ? ` - ${result.subtitle}` : ''}`,
            payload: { searchResult: result }
        }
    ));

    return [{
        id: 'search-results',
        title: `Search Results (${results.length})`,
        items: results,
        emptyMessage: 'No matching resources were found in this context.'
    }];
}

function buildSections() {
    const contextKind = getCurrentContextKind();
    if (contextKind === 'search-results') return buildSearchSections();
    if (contextKind === 'project-workspace') return buildWorkspaceSections();
    if (contextKind === 'report') return buildReportSections();
    if (contextKind === 'template') return buildTemplateSections();
    return buildApplicationSections();
}

function getExpandedSet() {
    return new Set(getExplorerConfig().expandedResourceIds || []);
}

function setExpandedSet(nextSet, action = 'Updated Explorer expansion state') {
    updateWorkspaceViewConfig({
        explorer: {
            expandedResourceIds: [...nextSet]
        }
    }, {
        action,
        persist: true
    });
}

function rememberSelection(resourceId, focusTargetId = '') {
    selectedResourceId = resourceId || '';
    focusedResourceId = focusTargetId || selectedResourceId;

    updateWorkspaceViewConfig({
        explorer: {
            selectedResourceId: selectedResourceId,
            focusedResourceId: focusedResourceId,
            lastContextKind: getCurrentContextKind()
        }
    }, {
        action: 'Updated Explorer selection',
        persist: true
    });
}

function isExpanded(resourceId, expandedSet) {
    return expandedSet.has(resourceId);
}

function flattenRows(items, level, parentId, expandedSet, output) {
    items.forEach((item, index) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const expanded = hasChildren && isExpanded(item.id, expandedSet);
        output.push({
            id: item.id,
            label: item.label,
            item,
            level,
            parentId,
            hasChildren,
            expanded,
            position: index + 1,
            setSize: items.length
        });

        if (hasChildren && expanded) {
            flattenRows(item.children, level + 1, item.id, expandedSet, output);
        }
    });
}

function renderTreeRows(sectionId, items) {
    const expandedSet = getExpandedSet();
    const rows = [];
    flattenRows(items, 1, '', expandedSet, rows);

    rows.forEach((row) => {
        treeIndex.set(row.id, row.item);
        parentById.set(row.id, row.parentId || '');
        sectionById.set(row.id, sectionId);
    });

    return rows.map((row) => {
        const item = row.item;
        const selected = selectedResourceId === row.id;
        const statusText = item.status ? ` ${item.status}.` : '';
        const badgeText = Number.isFinite(item.badge) ? ` ${item.badge} items.` : '';
        const label = `${item.label}${statusText}${badgeText}`;
        const expandButton = row.hasChildren
            ? `
                <button
                    type="button"
                    class="art-explorer__expander"
                    aria-label="${row.expanded ? 'Collapse' : 'Expand'} ${escapeHtml(item.label)}"
                    data-explorer-toggle="${escapeHtml(row.id)}"
                >${row.expanded ? '▾' : '▸'}</button>
            `
            : '<span class="art-explorer__expander art-explorer__expander--spacer" aria-hidden="true"></span>';

        const badge = Number.isFinite(item.badge)
            ? `<span class="art-explorer__badge" aria-hidden="true">${item.badge}</span>`
            : '';

        return `
            <div class="art-explorer__row" role="none" data-explorer-row-id="${escapeHtml(row.id)}">
                ${expandButton}
                <button
                    type="button"
                    class="art-explorer__resource ${selected ? 'is-selected' : ''}"
                    role="treeitem"
                    aria-level="${row.level}"
                    aria-selected="${String(selected)}"
                    ${row.hasChildren ? `aria-expanded="${String(row.expanded)}"` : ''}
                    aria-posinset="${row.position}"
                    aria-setsize="${row.setSize}"
                    aria-label="${escapeHtml(label)}"
                    data-explorer-resource="true"
                    data-resource-id="${escapeHtml(row.id)}"
                    data-resource-type="${escapeHtml(item.type)}"
                    data-resource-action="${escapeHtml(item.action || '')}"
                >
                    <span class="art-explorer__resource-label">${escapeHtml(item.label)}</span>
                    ${badge}
                </button>
            </div>
        `;
    }).join('');
}

function renderSections() {
    const sectionsHost = document.getElementById('art-explorer-sections');
    if (!sectionsHost) return;

    treeIndex = new Map();
    rowById = new Map();
    parentById = new Map();
    sectionById = new Map();

    const sections = buildSections();
    const visibleSections = sections.filter((section) => Array.isArray(section.items) && section.items.length > 0);

    if (visibleSections.length === 0) {
        sectionsHost.innerHTML = `
            <section class="art-explorer__section" role="region" aria-labelledby="art-explorer-empty-heading">
                <h3 id="art-explorer-empty-heading">Explorer</h3>
                <p class="art-explorer__empty">No resources are available in the current context.</p>
            </section>
        `;
        return;
    }

    sectionsHost.innerHTML = visibleSections.map((section) => {
        const treeMarkup = renderTreeRows(section.id, section.items);
        return `
            <section class="art-explorer__section" role="region" aria-labelledby="art-explorer-section-${escapeHtml(section.id)}-heading">
                <h3 id="art-explorer-section-${escapeHtml(section.id)}-heading">${escapeHtml(section.title)}</h3>
                <div class="art-explorer__tree" role="tree" aria-label="${escapeHtml(section.title)}">
                    ${treeMarkup || `<p class="art-explorer__empty">${escapeHtml(section.emptyMessage || 'No resources available.')}</p>`}
                </div>
            </section>
        `;
    }).join('');

    sectionsHost.querySelectorAll('[data-resource-id]').forEach((button) => {
        const resourceId = button.getAttribute('data-resource-id') || '';
        if (resourceId) rowById.set(resourceId, button);
    });

    restoreExplorerSelection();
}

function restoreExplorerSelection() {
    const explorerConfig = getExplorerConfig();
    const preferred = normalizeText(focusedResourceId || explorerConfig.focusedResourceId || explorerConfig.selectedResourceId);

    if (preferred && rowById.has(preferred)) {
        selectResource(preferred, { focus: false, announceSelection: false });
        return;
    }

    const first = [...rowById.keys()][0] || '';
    if (first) {
        selectResource(first, { focus: false, announceSelection: false });
    }
}

function applyViewVisibility() {
    const shell = ensureExplorerShell();
    if (!shell) return;

    const config = resolveWorkspaceView();
    const active = config.active;

    shell.dashboardView.hidden = active === 'explorer';
    shell.explorer.hidden = active !== 'explorer';

    shell.explorer.style.setProperty('--explorer-width', `${Math.max(240, Math.min(560, Number(config.explorer?.width || 320)))}px`);
}

function updateStatus(text) {
    const status = document.getElementById('art-explorer-status');
    if (!status) return;
    status.textContent = text;
}

function selectResource(resourceId, options = {}) {
    const row = rowById.get(resourceId) || null;
    if (!row) return false;

    const previous = selectedResourceId;
    selectedResourceId = resourceId;
    focusedResourceId = resourceId;

    if (previous && rowById.has(previous)) {
        rowById.get(previous).setAttribute('aria-selected', 'false');
        rowById.get(previous).classList.remove('is-selected');
    }

    row.setAttribute('aria-selected', 'true');
    row.classList.add('is-selected');

    rememberSelection(resourceId, resourceId);

    if (options.focus !== false) {
        row.focus();
    }

    if (options.announceSelection !== false) {
        announce(`Selected ${row.textContent?.trim() || 'resource'}.`);
    }

    return true;
}

function recordRecentResource(item) {
    if (!item || !item.id || !item.label) return;
    const explorerConfig = getExplorerConfig();
    const next = [{
        id: item.id,
        label: item.label,
        type: item.type || 'resource',
        action: item.action || '',
        at: new Date().toISOString()
    }, ...(explorerConfig.recentResources || []).filter((entry) => entry.id !== item.id)].slice(0, 50);

    updateWorkspaceViewConfig({
        explorer: {
            recentResources: next
        }
    }, {
        action: 'Updated Explorer recent resources',
        persist: true
    });
}

async function executeResourceAction(item) {
    if (!item) return false;

    if (item.payload?.searchResult) {
        const result = executeUniversalSearchResult(item.payload.searchResult);
        if (result) {
            recordRecentResource(item);
            return true;
        }
    }

    if (item.type === 'report' && item.payload?.reportId) {
        loadReportById(item.payload.reportId);
    }

    if (item.type === 'template' && item.payload?.templateId) {
        loadTemplate(item.payload.templateId);
    }

    if (item.action === 'searchEverywhere' && item.payload?.query) {
        searchText = item.payload.query;
        const input = document.getElementById('art-explorer-search');
        if (input) input.value = searchText;
        runExplorerSearch();
        return true;
    }

    const action = normalizeText(item.action);
    if (!action) {
        recordRecentResource(item);
        return true;
    }

    const command = commandRegistry.findCommands({ action })[0] || null;
    if (!command?.id) {
        announce(`${item.label} is selected.`);
        return false;
    }

    const result = await commandExecutionService.executeCommand(command.id, {
        source: 'explorer',
        action,
        resourceId: item.id,
        resourceType: item.type,
        activeElement: document.activeElement
    });

    if (result?.ok) {
        recordRecentResource(item);
        return true;
    }

    announce(result?.message || `Unable to open ${item.label}.`);
    return false;
}

function openSelectedResource() {
    const item = treeIndex.get(selectedResourceId) || null;
    if (!item) return false;
    void executeResourceAction(item);
    return true;
}

function toggleExpand(resourceId) {
    const item = treeIndex.get(resourceId) || null;
    if (!item || !Array.isArray(item.children) || item.children.length === 0) return false;

    const expandedSet = getExpandedSet();
    if (expandedSet.has(resourceId)) {
        expandedSet.delete(resourceId);
    } else {
        expandedSet.add(resourceId);
    }

    setExpandedSet(expandedSet);
    renderExplorer();
    const row = rowById.get(resourceId);
    row?.focus();
    return true;
}

function expandAncestors(resourceId) {
    const expandedSet = getExpandedSet();
    let cursor = parentById.get(resourceId) || '';
    while (cursor) {
        expandedSet.add(cursor);
        cursor = parentById.get(cursor) || '';
    }
    setExpandedSet(expandedSet, 'Expanded Explorer ancestors');
}

function getVisibleRowIds() {
    const rows = [...document.querySelectorAll('#art-explorer-view [data-resource-id]')];
    return rows
        .filter((row) => row instanceof HTMLElement && row.offsetParent !== null)
        .map((row) => row.getAttribute('data-resource-id') || '')
        .filter(Boolean);
}

function moveSelection(delta) {
    const ids = getVisibleRowIds();
    if (!ids.length) return false;

    const currentIndex = Math.max(0, ids.indexOf(selectedResourceId));
    const nextIndex = ((currentIndex + delta) % ids.length + ids.length) % ids.length;
    return selectResource(ids[nextIndex]);
}

function selectBoundary(last = false) {
    const ids = getVisibleRowIds();
    if (!ids.length) return false;
    return selectResource(last ? ids[ids.length - 1] : ids[0]);
}

function runFirstLetterNavigation(character) {
    const key = String(character || '').toLowerCase();
    if (!/^[a-z0-9]$/.test(key)) return false;

    if (firstLetterTimer) {
        window.clearTimeout(firstLetterTimer);
        firstLetterTimer = 0;
    }

    firstLetterBuffer += key;
    firstLetterTimer = window.setTimeout(() => {
        firstLetterBuffer = '';
        firstLetterTimer = 0;
    }, 500);

    const ids = getVisibleRowIds();
    if (!ids.length) return false;

    const startIndex = Math.max(0, ids.indexOf(selectedResourceId));
    const candidates = [...ids.slice(startIndex + 1), ...ids.slice(0, startIndex + 1)];

    const match = candidates.find((id) => {
        const row = rowById.get(id);
        const label = normalizeText(row?.textContent).toLowerCase();
        return label.startsWith(firstLetterBuffer);
    }) || '';

    if (!match) return false;
    return selectResource(match);
}

function handleExplorerKeydown(event) {
    const explorer = document.getElementById('art-explorer-view');
    if (!explorer || explorer.hidden) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || !explorer.contains(target)) return;

    if (target.id === 'art-explorer-search') {
        if (event.key === 'Escape' && target.value) {
            event.preventDefault();
            target.value = '';
            searchText = '';
            searchResults = [];
            renderExplorer();
            updateStatus('Explorer search cleared.');
        }
        return;
    }

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            moveSelection(1);
            return;
        case 'ArrowUp':
            event.preventDefault();
            moveSelection(-1);
            return;
        case 'Home':
        case 'PageUp':
            event.preventDefault();
            selectBoundary(false);
            return;
        case 'End':
        case 'PageDown':
            event.preventDefault();
            selectBoundary(true);
            return;
        case 'ArrowRight': {
            event.preventDefault();
            const current = treeIndex.get(selectedResourceId);
            if (current?.children?.length) {
                const expanded = getExpandedSet().has(selectedResourceId);
                if (!expanded) {
                    toggleExpand(selectedResourceId);
                    return;
                }
            }
            moveSelection(1);
            return;
        }
        case 'ArrowLeft': {
            event.preventDefault();
            const current = treeIndex.get(selectedResourceId);
            if (current?.children?.length && getExpandedSet().has(selectedResourceId)) {
                toggleExpand(selectedResourceId);
                return;
            }
            const parentId = parentById.get(selectedResourceId) || '';
            if (parentId) {
                selectResource(parentId);
            }
            return;
        }
        case 'Enter':
        case ' ': {
            event.preventDefault();
            openSelectedResource();
            return;
        }
        case 'F10': {
            if (!event.shiftKey) break;
            event.preventDefault();
            const row = rowById.get(selectedResourceId);
            row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
            return;
        }
        case 'ContextMenu': {
            event.preventDefault();
            const row = rowById.get(selectedResourceId);
            row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
            return;
        }
        default:
            break;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        runFirstLetterNavigation(event.key);
    }
}

function bindExplorerEvents() {
    document.addEventListener('keydown', handleExplorerKeydown, true);

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const toggle = target.closest('[data-explorer-toggle]');
        if (toggle) {
            const resourceId = toggle.getAttribute('data-explorer-toggle') || '';
            if (resourceId) {
                toggleExpand(resourceId);
            }
            return;
        }

        const resource = target.closest('[data-resource-id]');
        if (!resource) return;
        const resourceId = resource.getAttribute('data-resource-id') || '';
        if (!resourceId) return;

        selectResource(resourceId, { focus: false, announceSelection: true });

        if ((event.detail || 0) >= 2) {
            openSelectedResource();
        }
    }, true);

    document.addEventListener('focusin', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const resource = target?.closest?.('[data-resource-id]');
        if (!resource) return;
        const resourceId = resource.getAttribute('data-resource-id') || '';
        if (!resourceId) return;
        selectResource(resourceId, { focus: false, announceSelection: false });
    }, true);

    const searchInput = document.getElementById('art-explorer-search');
    const clearButton = document.getElementById('btn-art-explorer-clear-search');

    searchInput?.addEventListener('input', () => {
        searchText = searchInput.value;
        runExplorerSearch();
    });

    clearButton?.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = '';
        searchText = '';
        searchResults = [];
        renderExplorer();
        updateStatus('Explorer search cleared.');
        searchInput.focus();
    });
}

function runExplorerSearch() {
    const query = normalizeText(searchText);
    if (!query) {
        searchResults = [];
        renderExplorer();
        updateStatus('Explorer search cleared.');
        return;
    }

    const output = runUniversalSearch(query, {
        source: 'explorer-search',
        scope: resolveSearchScope(),
        limit: 80
    });

    searchResults = Array.isArray(output.results) ? output.results : [];
    renderExplorer();
    updateStatus(`${searchResults.length} result${searchResults.length === 1 ? '' : 's'} in Explorer.`);
}

export function renderExplorer() {
    const shell = ensureExplorerShell();
    if (!shell) return false;

    applyViewVisibility();
    if (shell.explorer.hidden) return true;

    renderSections();
    return true;
}

export function showDashboardView() {
    setActiveWorkspaceView('dashboard', {
        action: 'Switched workspace view to dashboard',
        persist: true
    });
    applyViewVisibility();
    announce('Dashboard workspace view selected.');
    window.dispatchEvent(new CustomEvent('art-panel-changed', {
        detail: { panel: 'Dashboard' }
    }));
    const dashboardHeading = document.getElementById('dash-heading');
    if (dashboardHeading) dashboardHeading.focus();
    return true;
}

export function showExplorerView() {
    setActiveWorkspaceView('explorer', {
        action: 'Switched workspace view to explorer',
        persist: true
    });
    renderExplorer();
    const explorerHeading = document.getElementById('art-explorer-heading');
    if (explorerHeading) explorerHeading.focus();

    const config = getExplorerConfig();
    const selected = normalizeText(config.selectedResourceId);
    if (selected && rowById.has(selected)) {
        selectResource(selected, { focus: true, announceSelection: false });
    } else {
        selectBoundary(false);
    }

    announce('Explorer workspace view selected.');
    window.dispatchEvent(new CustomEvent('art-panel-changed', {
        detail: { panel: 'Explorer' }
    }));
    return true;
}

export function toggleWorkspaceView() {
    const active = resolveWorkspaceView().active;
    if (active === 'explorer') return showDashboardView();
    return showExplorerView();
}

export function showDashboardViewFromCommand() {
    return showDashboardView();
}

export function showExplorerViewFromCommand() {
    return showExplorerView();
}

export function toggleWorkspaceViewFromCommand() {
    return toggleWorkspaceView();
}

export function focusExplorerNavigationFromCommand() {
    showExplorerView();
    const selected = rowById.get(selectedResourceId);
    if (selected) {
        selected.focus();
        return true;
    }
    const heading = document.getElementById('art-explorer-heading');
    heading?.focus();
    return true;
}

export function focusExplorerSearchFromCommand() {
    showExplorerView();
    const input = document.getElementById('art-explorer-search');
    if (!input) return false;
    input.focus();
    return true;
}

export function revealExplorerResource(resourceId) {
    const id = normalizeText(resourceId);
    if (!id) return false;

    showExplorerView();
    expandAncestors(id);
    renderExplorer();

    if (!rowById.has(id)) return false;

    selectResource(id, { focus: true, announceSelection: false });
    rowById.get(id)?.scrollIntoView({ block: 'nearest' });
    return true;
}

export function revealExplorerResourceFromCommand(context = {}) {
    const resourceId = normalizeText(context.resourceId || context.id || context.targetResourceId);
    if (!resourceId) return false;
    return revealExplorerResource(resourceId);
}

export function selectExplorerResource(resourceId) {
    const id = normalizeText(resourceId);
    if (!id || !rowById.has(id)) return false;
    return selectResource(id, { focus: true, announceSelection: true });
}

export function openExplorerResource(resourceId) {
    const id = normalizeText(resourceId || selectedResourceId);
    if (!id) return false;
    if (!rowById.has(id)) {
        if (!revealExplorerResource(id)) return false;
    }
    selectResource(id, { focus: false, announceSelection: false });
    return openSelectedResource();
}

export function expandExplorerResource(resourceId) {
    const id = normalizeText(resourceId);
    if (!id) return false;
    const expandedSet = getExpandedSet();
    expandedSet.add(id);
    setExpandedSet(expandedSet, 'Expanded Explorer resource');
    renderExplorer();
    return true;
}

export function collapseExplorerResource(resourceId) {
    const id = normalizeText(resourceId);
    if (!id) return false;
    const expandedSet = getExpandedSet();
    expandedSet.delete(id);
    setExpandedSet(expandedSet, 'Collapsed Explorer resource');
    renderExplorer();
    return true;
}

export function expandExplorerAncestors(resourceId) {
    const id = normalizeText(resourceId);
    if (!id) return false;
    expandAncestors(id);
    renderExplorer();
    return true;
}

export function refreshExplorerResource(resourceId) {
    const id = normalizeText(resourceId);
    if (id) {
        const selected = selectedResourceId;
        renderExplorer();
        if (selected && rowById.has(selected)) {
            selectResource(selected, { focus: false, announceSelection: false });
        }
        return true;
    }

    return refreshExplorer();
}

export function refreshExplorer() {
    renderExplorer();
    return true;
}

export function getSelectedExplorerResource() {
    const item = treeIndex.get(selectedResourceId) || null;
    return item ? { ...item } : null;
}

export function getExplorerCurrentContext() {
    return {
        kind: getCurrentContextKind(),
        searchText: searchText,
        scope: resolveSearchScope()
    };
}

export function getExplorerState() {
    return {
        view: resolveWorkspaceView().active,
        selectedResourceId,
        focusedResourceId,
        context: getExplorerCurrentContext(),
        config: getExplorerConfig()
    };
}

function restoreInitialWorkspaceView() {
    const config = resolveWorkspaceView();
    const active = config.rememberLastView
        ? config.active
        : config.defaultView;

    setActiveWorkspaceView(active, {
        action: 'Restored workspace view',
        persist: false
    });

    applyViewVisibility();
}

export function initExplorerFramework() {
    ensureExplorerShell();
    if (initialized) {
        renderExplorer();
        return true;
    }

    initialized = true;

    bindExplorerEvents();
    restoreInitialWorkspaceView();
    renderExplorer();

    window.addEventListener('art-workspace-view-changed', () => {
        applyViewVisibility();
    });

    window.addEventListener('art-workspace-view-settings-updated', () => {
        applyViewVisibility();
        renderExplorer();
    });

    window.addEventListener('art-reports-updated', () => renderExplorer());
    window.addEventListener('art-workspace-event', () => renderExplorer());
    window.addEventListener('art-search-state-updated', () => {
        if (searchText) runExplorerSearch();
    });
    window.addEventListener('art-state-restored', () => {
        restoreInitialWorkspaceView();
        renderExplorer();
    });

    return true;
}
