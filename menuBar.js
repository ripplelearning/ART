import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { searchCommands } from './commandSearchEngine.js';
import { announce, getBuiltInTemplates, getRecentProjectWorkspaces, getRecentReports, getUserTemplates, isCollaborationEnabled } from './state.js';
import { createSearchResultsController } from './searchResultsFramework.js';
import { getRedoMenuLabel, getUndoMenuLabel } from './historyFramework.js';
import { getTopLevelMenuShortcutAction } from './menuShortcuts.js';
import { restoreFocus } from './focusManagement.js';

let menuBarInitialized = false;
let menubarFocusIndex = 0;
let openPath = [];
let menuFocusIndexByPath = new Map();
let searchResults = [];
let searchActiveIndex = -1;
let searchEscapeArmed = false;
let focusBeforeMenubar = null;
let lastFocusOutsideMenubar = null;
let inMenubarSession = false;
let menubarSessionStartIndex = 0;
let suppressNextMenuButtonClick = false;
let menuSearchResultsController = null;

const TOP_LEVEL_MENU_ORDER = ['File', 'Edit', 'View', 'Search', 'Report', 'Presentation', 'Tools', 'Templates', 'Window', 'Collaboration', 'Help'];
const MENU_CHILD_ORDER = new Map([
    ['File', new Map([
        ['New', 0],
        ['Open', 1],
        ['Save', 2],
        ['Import', 3],
        ['Export', 4],
        ['Project Workspace', 5],
        ['Recent Reports/Projects', 6],
        ['Close', 99]
    ])],
    ['File>New', new Map([
        ['Report', 0],
        ['Template', 1],
        ['Project Workspace', 2],
        ['Working View', 3]
    ])],
    ['File>Open', new Map([
        ['Report', 0],
        ['Project Workspace', 1],
        ['Working View', 2],
        ['Template', 3]
    ])],
    ['File>Save', new Map([
        ['Report', 0],
        ['Project Workspace', 1],
        ['Working View', 2]
    ])],
    ['File>Close', new Map([
        ['Project Workspace', 0],
        ['Working View', 1],
        ['Report', 2]
    ])],
    ['File>New>Report', new Map([
        ['Blank Report', 0],
        ['New Report From Template', 1]
    ])]
]);
const MENU_COMMAND_ORDER = new Map([
    ['Edit', new Map([
        ['editSelectAll', 0],
        ['editCut', 1],
        ['editCopy', 2],
        ['editPaste', 3],
        ['undo', 10],
        ['redo', 11]
    ])],
    ['File>New>Report', new Map([
        ['newReport', 0],
        ['newReportFromTemplate', 1]
    ])]
]);

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeText(value) {
    return String(value || '').trim();
}

function getMenuItemLabel(command, parentPath = '') {
    switch (command.action) {
        case 'newReport': return 'Blank Report';
        case 'newReportFromTemplate': return 'New Report From Template';
        case 'newProjectWorkspace': return 'New Project Workspace';
        case 'newTemplate': return 'New Template';
        case 'newWorkingView': return 'New Working View';
        case 'openProject': return 'Open ART Project...';
        case 'openReport': return 'Open Report...';
        case 'openProjectWorkspace': return 'Open Project Workspace...';
        case 'openWorkingView': return 'Open Working View...';
        case 'saveProject': return 'Save Report';
        case 'saveProjectAs': return 'Save Report As...';
        case 'saveProjectWorkspace': return 'Save Project Workspace';
        case 'saveProjectWorkspaceAs': return 'Save Project Workspace As...';
        case 'saveWorkingView': return 'Save Working View';
        case 'editCut': return 'Cut';
        case 'editCopy': return 'Copy';
        case 'editPaste': return 'Paste';
        case 'editSelectAll': return 'Select All';
        default:
            if (parentPath === 'File>New>Report' && command.action === 'newReportFromTemplate') return 'New Report From Template';
            return command.displayName;
    }
}

function getTemplateGroups() {
    return [
        { label: 'Built-in templates', templates: getBuiltInTemplates() },
        { label: 'User, imported, and shared templates', templates: getUserTemplates() }
    ].filter((group) => Array.isArray(group.templates) && group.templates.length > 0);
}

function getRecentMenuGroups() {
    const recentReports = getRecentReports();
    const recentProjectWorkspaces = getRecentProjectWorkspaces();

    return [
        {
            label: 'Recent Reports',
            kind: 'report',
            items: recentReports.map((report) => ({
                id: report.id,
                label: report.name,
                reportId: report.id,
                commandId: 'Report.View'
            }))
        },
        {
            label: 'Recent Project Workspaces',
            kind: 'project',
            items: recentProjectWorkspaces.map((workspace) => ({
                id: workspace.id || workspace.workspaceId,
                label: workspace.name,
                workspaceId: workspace.workspaceId || workspace.id,
                commandId: 'Workspace.OpenRecent'
            }))
        }
    ].filter((group) => Array.isArray(group.items) && group.items.length > 0);
}

function renderRecentMenuItem(group, depth, itemIndex, parentPath, entry) {
    return `
        <button
            type="button"
            role="menuitem"
            class="app-menu-bar__menu-item"
            data-menu-item="true"
            data-menu-depth="${depth}"
            data-item-index="${itemIndex}"
            data-parent-path="${escapeHtml(parentPath)}"
            data-command-id="${escapeHtml(entry.commandId)}"
            data-recent-kind="${escapeHtml(group.kind)}"
            ${entry.reportId ? `data-report-id="${escapeHtml(entry.reportId)}"` : ''}
            ${entry.workspaceId ? `data-workspace-id="${escapeHtml(entry.workspaceId)}"` : ''}
            aria-disabled="false"
            tabindex="-1"
        >
            <span>${escapeHtml(entry.label)}</span>
            <span class="app-menu-bar__shortcut" aria-hidden="true">›</span>
        </button>
    `;
}

function getMenuChildSortOrder(parentPath, label) {
    const orderMap = MENU_CHILD_ORDER.get(parentPath);
    if (orderMap && orderMap.has(label)) return orderMap.get(label);
    return 1000;
}

function getMenuCommandSortOrder(parentPath, action) {
    const orderMap = MENU_COMMAND_ORDER.get(parentPath);
    if (orderMap && orderMap.has(action)) return orderMap.get(action);
    return 1000;
}

function getMenuLocation(command) {
    const location = normalizeText(command.menuLocation);
    if (location) return location;

    switch (command.action) {
        case 'openWelcome': return 'View>Welcome Screen';
        case 'openCommandPalette': return 'View>Command Palette';
        case 'focusMenuBar': return 'View>Menu Bar';
        case 'focusMenuSearch': return 'View>Command Search';
        case 'searchEverywhere':
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
        case 'settingsTogglePrivacyMode':
        case 'settingsCreateBackup':
        case 'settingsResetApp':
        case 'settingsCloseReport': return 'Edit>Application Settings';
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
        case 'openProjectWorkspace':
        case 'openRecentProjectWorkspace': return 'File>Open>Project Workspace';
        case 'openWorkingView': return 'File>Open>Working View';
        case 'saveProject':
        case 'saveProjectAs': return 'File>Save>Report';
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
        case 'addField':
        case 'done':
        case 'addEntry':
        case 'validateReport':
        case 'reportStatistics': return 'Report';
        case 'newTemplate':
        case 'useTemplate':
        case 'openTemplate':
        case 'renameTemplate':
        case 'replaceTemplate':
        case 'editTemplate':
        case 'deleteTemplate':
        case 'importTemplate':
        case 'exportTemplate': return 'Templates';
        default: return command.category || 'Application';
    }
}

function splitMenuPath(location) {
    return String(location || '')
        .split('>')
        .map((part) => normalizeText(part))
        .filter(Boolean);
}

function createNode(label, path) {
    return {
        label,
        path,
        commands: [],
        children: []
    };
}

function getChildNode(parent, label) {
    let child = parent.children.find((item) => item.label === label) || null;
    if (!child) {
        const path = parent.path ? `${parent.path}>${label}` : label;
        child = createNode(label, path);
        parent.children.push(child);
    }
    return child;
}

function buildMenuTree(commands) {
    const roots = [];

    function getRoot(label) {
        let root = roots.find((item) => item.label === label) || null;
        if (!root) {
            root = createNode(label, label);
            roots.push(root);
        }
        return root;
    }

    for (const command of commands) {
        const path = splitMenuPath(getMenuLocation(command));
        const topLevel = path[0] || command.category || 'Application';
        const root = getRoot(topLevel);

        if (path.length <= 1) {
            root.commands.push(command);
            continue;
        }

        let current = root;
        for (let index = 1; index < path.length; index += 1) {
            const segment = path[index];
            current = getChildNode(current, segment);
            if (index === path.length - 1) {
                current.commands.push(command);
            }
        }
    }

    return roots;
}

function sortTopLevelMenus(roots) {
    return [...roots].sort((left, right) => {
        const leftIndex = TOP_LEVEL_MENU_ORDER.indexOf(left.label);
        const rightIndex = TOP_LEVEL_MENU_ORDER.indexOf(right.label);
        if (leftIndex !== -1 || rightIndex !== -1) {
            const a = leftIndex === -1 ? TOP_LEVEL_MENU_ORDER.length : leftIndex;
            const b = rightIndex === -1 ? TOP_LEVEL_MENU_ORDER.length : rightIndex;
            return a - b;
        }
        return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
}

function getVisibleCommands() {
    return commandRegistry.getCommands()
        .map((command) => ({
            ...command,
            ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
        }))
        .filter((command) => command.visible !== false);
}

function getTopLevelMenus() {
    const roots = sortTopLevelMenus(buildMenuTree(getVisibleCommands()));
    if (!isCollaborationEnabled()) {
        return roots.filter((item) => item.label !== 'Collaboration');
    }
    return roots;
}

function getContainer() {
    const container = document.getElementById('menu-bar');
    const menubar = document.getElementById('menu-bar-menubar');
    const panel = document.getElementById('menu-bar-panel');
    const searchInput = document.getElementById('menu-bar-search');
    const searchResultsList = document.getElementById('menu-bar-search-results');
    const status = document.getElementById('menu-bar-status');
    return { container, menubar, panel, searchInput, searchResultsList, status };
}

function setStatus(message) {
    const { status } = getContainer();
    if (status) status.textContent = message;
}

function getNodeByPath(path, roots) {
    if (!path) return null;
    const segments = path.split('>');
    let current = roots.find((node) => node.label === segments[0]) || null;
    if (!current) return null;
    for (let i = 1; i < segments.length; i += 1) {
        current = current.children.find((node) => node.label === segments[i]) || null;
        if (!current) return null;
    }
    return current;
}

function getIsNodeOpen(path) {
    return openPath.includes(path);
}

function getLastOpenPath() {
    return openPath.length ? openPath[openPath.length - 1] : '';
}

function getCurrentOpenNode(roots) {
    const rootPath = openPath[0] || '';
    return getNodeByPath(rootPath, roots);
}

function rememberFocusBeforeMenubar(force = false) {
    if (!inMenubarSession || force) {
        const active = document.activeElement;
        const activeOutsideMenubar = active instanceof HTMLElement && !active.closest('#menu-bar')
            ? active
            : null;
        focusBeforeMenubar = activeOutsideMenubar || lastFocusOutsideMenubar || null;
        const menuButton = active instanceof HTMLElement ? active.closest('[data-menu-button="true"]') : null;
        const buttons = getTopLevelButtons();
        const activeMenuIndex = menuButton ? buttons.indexOf(menuButton) : -1;
        menubarSessionStartIndex = activeMenuIndex >= 0 ? activeMenuIndex : menubarFocusIndex;
        inMenubarSession = true;
    }
}

function clearMenubarSession() {
    inMenubarSession = false;
    focusBeforeMenubar = null;
    menubarSessionStartIndex = menubarFocusIndex;
}

function renderTopLevelButtons(roots) {
    return roots.map((menu, index) => {
        const isExpanded = getIsNodeOpen(menu.path);
        const shortcutAction = getTopLevelMenuShortcutAction(menu.label);
        return `
            <button
                type="button"
                role="menuitem"
                class="app-menu-bar__button ${isExpanded ? 'is-active' : ''}"
                data-menu-button="true"
                data-menu-label="${escapeHtml(menu.label)}"
                data-menu-path="${escapeHtml(menu.path)}"
                data-shortcut-action="${escapeHtml(shortcutAction)}"
                aria-haspopup="true"
                aria-expanded="${String(isExpanded)}"
                tabindex="${index === menubarFocusIndex ? 0 : -1}"
            >
                ${escapeHtml(menu.label)}
            </button>
        `;
    }).join('');
}

function renderCommandItem(command, depth, itemIndex, parentPath, labelOverride = '') {
    const shortcut = command.keyboardShortcut || 'Unassigned';
    const displayName = labelOverride || (command.action === 'undo'
        ? getUndoMenuLabel()
        : command.action === 'redo'
            ? getRedoMenuLabel()
            : getMenuItemLabel(command, parentPath));
        return `
        <button
            type="button"
            role="menuitem"
            class="app-menu-bar__menu-item ${command.canExecute ? '' : 'is-disabled'}"
            data-menu-item="true"
            data-menu-depth="${depth}"
            data-item-index="${itemIndex}"
            data-parent-path="${escapeHtml(parentPath)}"
            data-command-id="${escapeHtml(command.id)}"
            aria-disabled="${String(!command.canExecute)}"
            tabindex="-1"
        >
            <span>${escapeHtml(displayName)}</span>
            <span class="app-menu-bar__shortcut">${escapeHtml(shortcut)}</span>
        </button>
    `;
}

function renderTemplateMenuItem(command, depth, itemIndex, parentPath, template, groupLabel) {
    const shortcut = command.keyboardShortcut || 'Unassigned';
    const label = groupLabel ? `${template.name}` : template.name;
    return `
        <button
            type="button"
            role="menuitem"
            class="app-menu-bar__menu-item"
            data-menu-item="true"
            data-menu-depth="${depth}"
            data-item-index="${itemIndex}"
            data-parent-path="${escapeHtml(parentPath)}"
            data-command-id="${escapeHtml(command.id)}"
            data-template-id="${escapeHtml(template.id)}"
            aria-disabled="false"
            tabindex="-1"
        >
            <span>${escapeHtml(label)}</span>
            <span class="app-menu-bar__shortcut">${escapeHtml(shortcut)}</span>
        </button>
    `;
}

function renderSubmenuTrigger(childNode, depth, itemIndex, parentPath) {
    const isExpanded = getIsNodeOpen(childNode.path);
    return `
        <button
            type="button"
            role="menuitem"
            class="app-menu-bar__menu-item app-menu-bar__menu-item--submenu"
            data-menu-item="true"
            data-menu-depth="${depth}"
            data-item-index="${itemIndex}"
            data-parent-path="${escapeHtml(parentPath)}"
            data-submenu-path="${escapeHtml(childNode.path)}"
            aria-haspopup="true"
            aria-expanded="${String(isExpanded)}"
            tabindex="-1"
        >
            <span>${escapeHtml(childNode.label)}</span>
            <span class="app-menu-bar__shortcut" aria-hidden="true">›</span>
        </button>
    `;
}

function getMenuItemContext(element) {
    if (!(element instanceof HTMLElement)) return {};
    const templateId = normalizeText(element.getAttribute('data-template-id'));
    const reportId = normalizeText(element.getAttribute('data-report-id'));
    const workspaceId = normalizeText(element.getAttribute('data-workspace-id'));
    const recentKind = normalizeText(element.getAttribute('data-recent-kind'));
    return {
        ...(templateId ? { templateId } : {}),
        ...(reportId ? { reportId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
        ...(recentKind ? { recentKind } : {})
    };
}

function renderMenuNode(node, depth = 0) {
    const items = [];
    let itemIndex = 0;
    let recentSubmenuInserted = false;

    const appendRecentSubmenu = () => {
        const recentPath = 'File>Recent Reports/Projects';
        const isExpanded = getIsNodeOpen(recentPath);
        items.push(`
            <button
                type="button"
                role="menuitem"
                class="app-menu-bar__menu-item app-menu-bar__menu-item--submenu"
                data-menu-item="true"
                data-menu-depth="${depth}"
                data-item-index="${itemIndex}"
                data-parent-path="${escapeHtml(node.path)}"
                data-submenu-path="${escapeHtml(recentPath)}"
                aria-haspopup="true"
                aria-expanded="${String(isExpanded)}"
                tabindex="-1"
            >
                <span>Recent Reports/Projects</span>
                <span class="app-menu-bar__shortcut" aria-hidden="true">›</span>
            </button>
        `);
        itemIndex += 1;
        recentSubmenuInserted = true;

        if (isExpanded) {
            const groups = getRecentMenuGroups();
            const recentMarkup = groups.length
                ? groups.map((group) => `
                    <div class="app-menu-bar__submenu-group" role="group" aria-label="${escapeHtml(group.label)}">
                        ${group.items.map((entry, recentIndex) => renderRecentMenuItem(group, depth + 1, recentIndex, recentPath, entry)).join('')}
                    </div>
                `).join('')
                : `
                    <button
                        type="button"
                        role="menuitem"
                        class="app-menu-bar__menu-item is-disabled"
                        data-menu-item="true"
                        data-menu-depth="${depth + 1}"
                        data-item-index="0"
                        data-parent-path="${escapeHtml(recentPath)}"
                        aria-disabled="true"
                        tabindex="-1"
                    >
                        <span>No recent reports or projects available.</span>
                    </button>
                `;

            items.push(`
                <div class="app-menu-bar__submenu-panel" data-submenu-panel="${escapeHtml(recentPath)}" role="menu" aria-label="Recent Reports/Projects">
                    ${recentMarkup}
                </div>
            `);
        }
    };

    if (node.path === 'File>New>Report>New Report From Template') {
        const command = node.commands[0] || null;
        const templateEntries = getTemplateGroups().flatMap((group) => (
            group.templates.map((template) => ({ template, groupLabel: group.label }))
        ));

        if (command) {
            const templateItems = templateEntries.length
                ? templateEntries.map((entry, templateIndex) => renderTemplateMenuItem(command, depth, templateIndex, node.path, entry.template, entry.groupLabel)).join('')
                : `
                    <button type="button" role="menuitem" class="app-menu-bar__menu-item is-disabled" aria-disabled="true" tabindex="-1">
                        <span>No templates available</span>
                    </button>
                `;

            return `
                <div class="app-menu-bar__menu-level" role="menu" aria-label="${escapeHtml(node.label)}" data-menu-level="${depth}" data-menu-path="${escapeHtml(node.path)}">
                    ${templateItems}
                </div>
            `;
        }
    }

    const commands = [...node.commands].sort((left, right) => {
        const leftOrder = getMenuCommandSortOrder(node.path, left.action);
        const rightOrder = getMenuCommandSortOrder(node.path, right.action);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return getMenuItemLabel(left, node.path).localeCompare(getMenuItemLabel(right, node.path), undefined, { sensitivity: 'base' });
    });

    commands.forEach((command) => {
        items.push(renderCommandItem(command, depth, itemIndex, node.path));
        itemIndex += 1;
    });

    node.children
        .sort((a, b) => {
            const leftOrder = getMenuChildSortOrder(node.path, a.label);
            const rightOrder = getMenuChildSortOrder(node.path, b.label);
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
        })
        .forEach((child) => {
            if (node.path === 'File' && child.label === 'Close' && !recentSubmenuInserted) {
                appendRecentSubmenu();
            }

            if (child.path === 'File>New>Report>New Report From Template') {
                const isExpanded = getIsNodeOpen(child.path);
                const command = child.commands[0] || null;
                items.push(`
                    <button
                        type="button"
                        role="menuitem"
                        class="app-menu-bar__menu-item app-menu-bar__menu-item--submenu"
                        data-menu-item="true"
                        data-menu-depth="${depth}"
                        data-item-index="${itemIndex}"
                        data-parent-path="${escapeHtml(node.path)}"
                        data-submenu-path="${escapeHtml(child.path)}"
                        aria-haspopup="true"
                        aria-expanded="${String(isExpanded)}"
                        tabindex="-1"
                    >
                        <span>${escapeHtml(child.label)}</span>
                        <span class="app-menu-bar__shortcut" aria-hidden="true">›</span>
                    </button>
                `);
                itemIndex += 1;

                if (isExpanded && command) {
                    const templateEntries = getTemplateGroups().flatMap((group) => (
                        group.templates.map((template) => ({ template, groupLabel: group.label }))
                    ));
                    const templateItems = templateEntries.length
                        ? templateEntries.map((entry, templateIndex) => renderTemplateMenuItem(command, depth + 1, itemIndex + templateIndex, child.path, entry.template, entry.groupLabel)).join('')
                        : `
                            <button type="button" role="menuitem" class="app-menu-bar__menu-item is-disabled" aria-disabled="true" tabindex="-1">
                                <span>No templates available</span>
                            </button>
                        `;

                    items.push(`
                        <div class="app-menu-bar__submenu-panel" data-submenu-panel="${escapeHtml(child.path)}" role="menu" aria-label="${escapeHtml(child.label)}">
                            ${templateItems}
                        </div>
                    `);
                    itemIndex += Math.max(1, templateEntries.length);
                }
                return;
            }

            items.push(renderSubmenuTrigger(child, depth, itemIndex, node.path));
            itemIndex += 1;
            if (getIsNodeOpen(child.path)) {
                items.push(`
                    <div class="app-menu-bar__submenu-panel" data-submenu-panel="${escapeHtml(child.path)}" role="menu" aria-label="${escapeHtml(child.label)}">
                        ${renderMenuNode(child, depth + 1)}
                    </div>
                `);
            }
        });

    if (node.path === 'File' && !recentSubmenuInserted) {
        appendRecentSubmenu();
    }

    return `
        <div class="app-menu-bar__menu-level" role="menu" aria-label="${escapeHtml(node.label)}" data-menu-level="${depth}" data-menu-path="${escapeHtml(node.path)}">
            ${items.join('')}
        </div>
    `;
}

function renderOpenMenuPanel(roots) {
    const current = getCurrentOpenNode(roots);
    if (!current) return '';

    return `
        <div class="app-menu-bar__menu-shell" data-menu-shell="${escapeHtml(current.path)}">
            ${renderMenuNode(current, 0)}
        </div>
    `;
}

function ensureMenuSearchController() {
    if (menuSearchResultsController) return menuSearchResultsController;
    const { searchResultsList, searchInput, status } = getContainer();
    if (!searchResultsList || !searchInput) return null;

    menuSearchResultsController = createSearchResultsController({
        container: searchResultsList,
        statusElement: status,
        idPrefix: 'menu-bar-search',
        listboxLabel: 'Command search results',
        itemClass: 'app-menu-bar__search-result',
        itemActiveClass: 'is-selected',
        itemDisabledClass: 'is-disabled',
        titleClass: 'app-menu-bar__search-result-name',
        subtitleClass: 'app-menu-bar__search-result-meta',
        descriptionClass: 'app-menu-bar__search-result-description',
        emptyClass: 'app-menu-bar__empty',
        emptyMessage: 'No matching commands found.',
        onActivate: (item, index) => {
            handleSearchResultExecute(index);
        },
        onSelectionChange: (_, index) => {
            searchActiveIndex = index;
            const optionId = menuSearchResultsController?.getActiveOptionId() || '';
            if (optionId) {
                searchInput.setAttribute('aria-activedescendant', optionId);
            } else {
                searchInput.removeAttribute('aria-activedescendant');
            }
        }
    });

    return menuSearchResultsController;
}

function renderMenuBar() {
    const { menubar, panel, searchInput, searchResultsList } = getContainer();
    if (!menubar || !panel || !searchInput || !searchResultsList) return;

    const roots = getTopLevelMenus();
    menubar.innerHTML = renderTopLevelButtons(roots);

    const query = normalizeText(searchInput.value);
    searchResults = query ? searchCommands(query, { context: { source: 'menu-bar-search' } }) : [];
    if (!searchResults.length) {
        searchActiveIndex = -1;
    } else if (searchActiveIndex < 0 || searchActiveIndex >= searchResults.length) {
        searchActiveIndex = 0;
    }

    const controller = ensureMenuSearchController();
    if (controller) {
        controller.setResults(searchResults.map((command) => ({
            id: command.id,
            title: command.displayName,
            subtitle: `${command.keyboardShortcut || 'Unassigned'} | ${command.category}`,
            description: command.description || '',
            disabled: !command.canExecute,
            command
        })));
    }
    searchResultsList.hidden = !query;

    const openPanelHtml = renderOpenMenuPanel(roots);
    panel.innerHTML = openPanelHtml;
    panel.hidden = !openPanelHtml;
}

function executeCommand(command, context = {}) {
    if (!command) return;
    if (!command.canExecute) {
        announce('Command unavailable.');
        setStatus('Command unavailable.');
        return;
    }

    void commandExecutionService.executeCommand(command.id, {
        source: 'menu-bar',
        invocation: 'menu-bar',
        triggerElement: document.activeElement,
        activeElement: document.activeElement,
        ...context
    }).then((result) => {
        if (result?.ok) {
            announce(`Executed ${command.displayName}.`);
            const hasOpenDialog = Boolean(document.querySelector('[role="dialog"]:not([hidden])'));
            closeAllMenus(!hasOpenDialog);
            return;
        }

        announce(result?.message || 'Error executing command.');
        setStatus(result?.message || 'Error executing command.');
    });
}

function getTopLevelButtons() {
    const { menubar } = getContainer();
    return [...(menubar?.querySelectorAll('[data-menu-button="true"]') || [])];
}

function focusTopLevelButton(index = menubarFocusIndex) {
    const buttons = getTopLevelButtons();
    if (!buttons.length) return false;
    const next = ((index % buttons.length) + buttons.length) % buttons.length;
    menubarFocusIndex = next;
    if (inMenubarSession && openPath.length === 0) {
        menubarSessionStartIndex = next;
    }
    buttons[next]?.focus();
    return true;
}

function getFocusableMenuItemsForPath(path) {
    return [...document.querySelectorAll(`[data-parent-path="${CSS.escape(path)}"]`)];
}

function focusMenuItemByPath(path, desiredIndex = 0) {
    const items = getFocusableMenuItemsForPath(path);
    if (!items.length) return false;
    const index = Math.max(0, Math.min(desiredIndex, items.length - 1));
    menuFocusIndexByPath.set(path, index);
    items[index]?.focus();
    return true;
}

function focusFirstMenuItem(path) {
    return focusMenuItemByPath(path, 0);
}

function focusLastMenuItem(path) {
    const items = getFocusableMenuItemsForPath(path);
    if (!items.length) return false;
    return focusMenuItemByPath(path, items.length - 1);
}

function moveMenuItemFocus(path, delta) {
    const items = getFocusableMenuItemsForPath(path);
    if (!items.length) return false;

    const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = items.indexOf(current);
    const base = currentIndex >= 0 ? currentIndex : (menuFocusIndexByPath.get(path) || 0);
    const next = ((base + delta) % items.length + items.length) % items.length;
    menuFocusIndexByPath.set(path, next);
    items[next]?.focus();
    return true;
}

function openTopLevelMenuByIndex(index, focusMode = 'first') {
    const roots = getTopLevelMenus();
    if (!roots.length) return false;

    const nextIndex = ((index % roots.length) + roots.length) % roots.length;
    menubarFocusIndex = nextIndex;
    const node = roots[nextIndex];

    openPath = [node.path];
    renderMenuBar();

    if (focusMode === 'first') {
        window.setTimeout(() => focusFirstMenuItem(node.path), 0);
    } else if (focusMode === 'last') {
        window.setTimeout(() => focusLastMenuItem(node.path), 0);
    }

    return true;
}

function openTopLevelMenuByLabel(menuLabel, focusMode = 'first') {
    const label = normalizeText(menuLabel).toLowerCase();
    if (!label) return false;

    const buttons = getTopLevelButtons();
    const targetIndex = buttons.findIndex((button) => normalizeText(button.getAttribute('data-menu-label') || '').toLowerCase() === label);
    if (targetIndex < 0) return false;

    rememberFocusBeforeMenubar();
    return openTopLevelMenuByIndex(targetIndex, focusMode);
}

function openCurrentTopLevelMenu(focusMode = 'first') {
    return openTopLevelMenuByIndex(menubarFocusIndex, focusMode);
}

function closeSubmenuAndFocusParent(submenuPath) {
    const parentPath = submenuPath.split('>').slice(0, -1).join('>');
    if (!parentPath) return false;

    openPath = openPath.filter((path) => !(path === submenuPath || path.startsWith(`${submenuPath}>`)));
    renderMenuBar();

    const fallbackIndex = menuFocusIndexByPath.get(parentPath) || 0;
    const focusParentTrigger = () => {
        const trigger = document.querySelector(`[data-submenu-path="${CSS.escape(submenuPath)}"]`);
        if (trigger instanceof HTMLElement) {
            trigger.focus();
            return true;
        }
        if (focusMenuItemByPath(parentPath, fallbackIndex)) {
            return true;
        }
        return false;
    };

    if (!focusParentTrigger()) {
        window.setTimeout(() => {
            focusParentTrigger();
        }, 0);
    }

    return true;
}

function closeAllMenus(restoreToMenubar = true) {
    openPath = [];
    searchEscapeArmed = false;
    renderMenuBar();

    if (restoreToMenubar) {
        window.setTimeout(() => {
            focusTopLevelButton(menubarFocusIndex);
        }, 0);
    }
}

function exitMenubarSession() {
    const target = focusBeforeMenubar;
    closeAllMenus(false);
    clearMenubarSession();

    if (target && typeof target.focus === 'function') {
        target.focus();
        if (document.activeElement !== target) {
            window.setTimeout(() => target.focus(), 0);
        }
    }
}

function exitMenubarInteractionToMenuButton() {
    const startIndex = menubarSessionStartIndex;
    closeAllMenus(false);
    clearMenubarSession();

    window.setTimeout(() => {
        const buttons = getTopLevelButtons();
        if (!buttons.length) return;

        const nextIndex = Math.max(0, Math.min(startIndex, buttons.length - 1));
        menubarFocusIndex = nextIndex;
        restoreFocus(buttons[nextIndex], { retries: 1 });
    }, 0);
}

function endMenubarSessionOnCurrentButton() {
    const currentIndex = menubarFocusIndex;
    closeAllMenus(false);
    clearMenubarSession();

    window.setTimeout(() => {
        const buttons = getTopLevelButtons();
        if (!buttons.length) return;

        const nextIndex = Math.max(0, Math.min(currentIndex, buttons.length - 1));
        menubarFocusIndex = nextIndex;
        restoreFocus(buttons[nextIndex], { retries: 1 });
    }, 0);
}

function openSubmenuFromTrigger(trigger, focusFirst = true) {
    const submenuPath = trigger.getAttribute('data-submenu-path') || '';
    if (!submenuPath) return false;

    const depth = Number(trigger.getAttribute('data-menu-depth') || 0);
    const expectedLength = depth + 2;

    openPath = openPath.slice(0, expectedLength - 1);
    if (!openPath.includes(submenuPath)) openPath.push(submenuPath);
    renderMenuBar();

    const focusTargetItem = () => {
        if (focusFirst) {
            return focusFirstMenuItem(submenuPath);
        }
        return focusLastMenuItem(submenuPath);
    };

    if (!focusTargetItem()) {
        window.setTimeout(() => {
            focusTargetItem();
        }, 0);
    }

    return true;
}

function getCurrentMenuPathFromFocus() {
    const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element) return '';

    const path = element.getAttribute('data-parent-path') || '';
    return path;
}

function handleSearchResultExecute(index) {
    const command = searchResults[index] || null;
    if (!command) return;
    executeCommand(command);
}

function focusSearchResult(index) {
    const controller = ensureMenuSearchController();
    const list = searchResults;
    if (!controller || !list.length) return false;
    const bounded = ((index % list.length) + list.length) % list.length;
    searchActiveIndex = bounded;
    searchEscapeArmed = false;
    controller.setActiveIndex(bounded, { announce: true });
    controller.focusActive();
    return true;
}

function handleMenuButtonKeydown(event, activeElement) {
    if (!(activeElement instanceof HTMLElement) || !activeElement.matches('[data-menu-button="true"]')) return false;

    const buttons = getTopLevelButtons();
    if (!buttons.length) return false;

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusTopLevelButton(menubarFocusIndex + 1);
        return true;
    }

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusTopLevelButton(menubarFocusIndex - 1);
        return true;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        focusTopLevelButton(0);
        return true;
    }

    if (event.key === 'End') {
        event.preventDefault();
        focusTopLevelButton(buttons.length - 1);
        return true;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        suppressNextMenuButtonClick = true;
        openCurrentTopLevelMenu('first');
        return true;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        suppressNextMenuButtonClick = true;
        openCurrentTopLevelMenu('last');
        return true;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        endMenubarSessionOnCurrentButton();
        return true;
    }

    if (event.key === 'Tab') {
        event.preventDefault();
        const currentLabel = normalizeText(activeElement.getAttribute('data-menu-label') || activeElement.textContent || '');
        if (currentLabel.toLowerCase() === 'help') {
            exitMenubarSession();
        } else {
            focusMenuSearch(true);
        }
        return true;
    }

    return false;
}

function handleMenuItemKeydown(event, activeElement) {
    if (!(activeElement instanceof HTMLElement) || !activeElement.matches('[data-menu-item="true"]')) return false;

    const currentPath = getCurrentMenuPathFromFocus();
    if (!currentPath) return false;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveMenuItemFocus(currentPath, 1);
        return true;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveMenuItemFocus(currentPath, -1);
        return true;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        focusFirstMenuItem(currentPath);
        return true;
    }

    if (event.key === 'End') {
        event.preventDefault();
        focusLastMenuItem(currentPath);
        return true;
    }

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const submenuPath = activeElement.getAttribute('data-submenu-path') || '';
        if (submenuPath) {
            openSubmenuFromTrigger(activeElement, true);
            return true;
        }

        const commandId = activeElement.getAttribute('data-command-id') || '';
        const command = commandRegistry.getCommand(commandId);
        if (command) {
            executeCommand({
                ...command,
                ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
            }, getMenuItemContext(activeElement));
        }
        return true;
    }

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        const submenuPath = activeElement.getAttribute('data-submenu-path') || '';
        if (submenuPath) {
            openSubmenuFromTrigger(activeElement, true);
            return true;
        }

        closeAllMenus(false);
        openTopLevelMenuByIndex(menubarFocusIndex + 1, 'first');
        return true;
    }

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentPath.includes('>')) {
            closeSubmenuAndFocusParent(currentPath);
            return true;
        }

        const currentRootButton = document.querySelector(`[data-menu-button="true"][data-menu-path="${CSS.escape(currentPath)}"]`);
        if (currentRootButton instanceof HTMLElement) {
            currentRootButton.focus();
            return true;
        }

        focusTopLevelButton(menubarFocusIndex);
        return true;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        if (currentPath.includes('>')) {
            closeSubmenuAndFocusParent(currentPath);
        } else {
            closeAllMenus(true);
        }
        return true;
    }

    if (event.key === 'Tab') {
        event.preventDefault();
        const currentLabel = normalizeText(currentPath.split('>').shift() || '');
        if (currentLabel.toLowerCase() === 'help') {
            exitMenubarSession();
        } else {
            focusMenuSearch(true);
        }
        return true;
    }

    return false;
}

function handleSearchKeydown(event, activeElement) {
    const { searchInput } = getContainer();
    if (!searchInput) return false;

    if (activeElement === searchInput) {
        if (event.key === 'Escape') {
            event.preventDefault();

            if (searchEscapeArmed) {
                searchInput.value = '';
                searchEscapeArmed = false;
                renderMenuBar();
                exitMenubarInteractionToMenuButton();
                return true;
            }

            if (searchInput.value) {
                searchInput.select();
                searchEscapeArmed = true;
                setStatus('Press Escape again to exit command search.');
                return true;
            }

            exitMenubarInteractionToMenuButton();
            return true;
        }

        if (event.key === 'ArrowDown') {
            if (!searchResults.length) return false;
            event.preventDefault();
            focusSearchResult(0);
            return true;
        }

        if (event.key === 'ArrowUp') {
            if (!searchResults.length) return false;
            event.preventDefault();
            focusSearchResult(searchResults.length - 1);
            return true;
        }

        if (event.key === 'Enter') {
            if (!searchResults.length) return false;
            event.preventDefault();
            handleSearchResultExecute(Math.max(searchActiveIndex, 0));
            return true;
        }
    }

    if (activeElement instanceof HTMLElement && activeElement.closest('#menu-bar-search-results')) {
        const controller = ensureMenuSearchController();
        const currentIndex = controller?.getActiveIndex() ?? 0;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusSearchResult(currentIndex + 1);
            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusSearchResult(currentIndex - 1);
            return true;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSearchResultExecute(currentIndex);
            return true;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            searchEscapeArmed = true;
            searchInput.focus();
            searchInput.select();
            setStatus('Press Escape again to exit command search.');
            return true;
        }
    }

    return false;
}

function focusMenuBar() {
    rememberFocusBeforeMenubar();
    closeAllMenus(false);
    renderMenuBar();
    focusTopLevelButton(menubarFocusIndex);
}

function focusMenuSearch(selectText = true) {
    rememberFocusBeforeMenubar(true);
    const { searchInput } = getContainer();
    if (!searchInput) return;
    closeAllMenus(false);
    searchInput.focus();
    if (selectText) searchInput.select();
    announce('Command search focused.');
}

function handleGlobalKeydown(event) {
    if (event.key === 'F10' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        focusMenuBar();
        return;
    }

    if (event.altKey && event.key === '/') {
        event.preventDefault();
        focusMenuBar();
        return;
    }

    if (event.altKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        focusMenuSearch(true);
        return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void commandExecutionService.executeCommand('Application.OpenCommandPalette', {
            source: 'menu-bar',
            invocation: 'keyboard-shortcut',
            triggerEvent: event,
            activeElement: document.activeElement
        });
        return;
    }

    const activeElement = document.activeElement;

    if (handleSearchKeydown(event, activeElement)) return;
    if (handleMenuButtonKeydown(event, activeElement)) return;
    if (handleMenuItemKeydown(event, activeElement)) return;
}

function handleMenubarClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-menu-button="true"]') : null;
    if (!target) return;

    if (suppressNextMenuButtonClick) {
        suppressNextMenuButtonClick = false;
        return;
    }

    rememberFocusBeforeMenubar();

    const buttons = getTopLevelButtons();
    menubarFocusIndex = Math.max(0, buttons.indexOf(target));
    if (inMenubarSession) {
        menubarSessionStartIndex = menubarFocusIndex;
    }

    if (openPath.length && openPath[0] === target.getAttribute('data-menu-path')) {
        closeAllMenus(true);
        return;
    }

    openTopLevelMenuByIndex(menubarFocusIndex, 'first');
}

function handlePanelClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-menu-item="true"]') : null;
    if (!target) return;

    const submenuPath = target.getAttribute('data-submenu-path') || '';
    if (submenuPath) {
        openSubmenuFromTrigger(target, true);
        return;
    }

    const commandId = target.getAttribute('data-command-id') || '';
    const command = commandRegistry.getCommand(commandId);
    if (!command) return;

    executeCommand({
        ...command,
        ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
    }, getMenuItemContext(target));
}

function handleSearchInput() {
    searchEscapeArmed = false;
    renderMenuBar();
}

function bindEvents() {
    const { container } = getContainer();
    if (!container) return false;

    container.innerHTML = `
        <div class="app-menu-bar__row">
            <nav aria-label="Menu bar">
                <div id="menu-bar-menubar" class="app-menu-bar__menubar" role="menubar" aria-label="Menu bar"></div>
            </nav>
            <div class="app-menu-bar__search">
                <label class="sr-only" for="menu-bar-search">Menu Bar Command Search</label>
                <input
                    id="menu-bar-search"
                    type="search"
                    autocomplete="off"
                    spellcheck="false"
                    aria-controls="menu-bar-search-results"
                    aria-describedby="menu-bar-status"
                    placeholder="Search commands"
                >
                <div id="menu-bar-search-results" class="app-menu-bar__search-results" role="listbox" aria-label="Command search results" hidden></div>
            </div>
        </div>
        <div id="menu-bar-panel" class="app-menu-bar__panel" hidden></div>
        <p id="menu-bar-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    const { menubar, panel, searchInput } = getContainer();
    if (!menubar || !panel || !searchInput) return false;

    ensureMenuSearchController();

    document.addEventListener('keydown', handleGlobalKeydown, true);
    document.addEventListener('focusin', (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) return;
        if (target.closest('#menu-bar')) return;
        lastFocusOutsideMenubar = target;
    }, true);
    menubar.addEventListener('click', handleMenubarClick);
    panel.addEventListener('click', handlePanelClick);
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
        rememberFocusBeforeMenubar();
        renderMenuBar();
    });

    window.addEventListener('art-shortcuts-updated', () => renderMenuBar());
    window.addEventListener('art-visual-accessibility-updated', () => renderMenuBar());
    window.addEventListener('art-collaboration-updated', () => renderMenuBar());

    renderMenuBar();
    return true;
}

export function initMenuBar() {
    if (menuBarInitialized) return true;
    menuBarInitialized = bindEvents();
    return menuBarInitialized;
}

export function focusMenuBarFromCommand() {
    focusMenuBar();
    return true;
}

export function focusMenuSearchFromCommand() {
    focusMenuSearch(true);
    return true;
}

export function openTopLevelMenuFromCommand(menuLabel) {
    return openTopLevelMenuByLabel(menuLabel, 'first');
}
