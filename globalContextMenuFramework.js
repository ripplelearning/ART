import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { announce, appState, getActiveProjectWorkspace, getShortcutForAction } from './state.js';
import { searchCommands } from './commandSearchEngine.js';

const providerRegistry = new Map();
const groupOrder = [
    'Primary Actions',
    'Create',
    'Edit',
    'Navigation',
    'View',
    'Search',
    'Validation',
    'Import',
    'Export',
    'Project',
    'Workspace',
    'Templates',
    'Dashboard',
    'Tools',
    'Settings',
    'Properties',
    'Help',
    'Close'
];

const rootOrder = [
    'Primary Actions',
    'Create',
    'Edit',
    'Navigation',
    'View',
    'Search',
    'Validation',
    'Import',
    'Export',
    'Project',
    'Workspace',
    'Templates',
    'Dashboard',
    'Tools',
    'Settings',
    'Properties',
    'Help',
    'Close',
    'Application',
    'File',
    'Report',
    'Lookup'
];

const contextRoots = new Map([
    ['dashboard', ['Workspace', 'Templates', 'Report', 'Import', 'Dashboard', 'Edit', 'Search', 'Settings', 'Help']],
    ['dashboard-widget', ['Dashboard', 'Workspace', 'Templates', 'Report', 'Import', 'Edit', 'Search', 'Settings', 'Help']],
    ['project-workspace', ['Workspace', 'Templates', 'Report', 'Import', 'Dashboard', 'Edit', 'Search', 'Settings', 'Help']],
    ['project-asset', ['Workspace', 'Templates', 'Report', 'Import', 'Dashboard', 'Edit', 'Search', 'Settings', 'Help']],
    ['report-builder', ['Workspace', 'Templates', 'Report', 'Import', 'Dashboard', 'Edit', 'Search', 'Settings', 'Help']],
    ['field-configuration', ['Workspace', 'Templates', 'Report', 'Import', 'Edit', 'Search', 'Settings', 'Help']],
    ['editor', ['Workspace', 'Templates', 'Report', 'Import', 'Edit', 'Search', 'Settings', 'Help']],
    ['report-viewer', ['Workspace', 'Templates', 'Report', 'Import', 'Edit', 'Search', 'Settings', 'Help']],
    ['progress-log', ['Workspace', 'Templates', 'Report', 'Import', 'Edit', 'Search', 'Settings', 'Help']],
    ['lookup-tool', ['Workspace', 'Templates', 'Report', 'Import', 'Lookup', 'Edit', 'Search', 'Settings', 'Help']],
    ['search-results', ['Report', 'Edit', 'Search', 'Settings', 'Help']],
    ['help', ['Help', 'Search']],
    ['user-guide', ['Help', 'Search']],
    ['welcome', ['Workspace', 'Templates', 'Report', 'Import', 'Dashboard', 'Edit', 'Search', 'Settings', 'Help']],
    ['settings', ['Settings', 'Search', 'Help']],
    ['menu-bar', ['Application', 'File', 'Edit', 'View', 'Search', 'Report', 'Templates', 'Workspace', 'Project', 'Tools', 'Settings', 'Help']],
    ['command-palette', ['Application', 'File', 'Edit', 'View', 'Search', 'Report', 'Templates', 'Workspace', 'Project', 'Tools', 'Settings', 'Help']]
]);

const contextActionAllowlists = new Map([
    ['dashboard', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'configureDashboard',
        'newReport',
        'importData',
        'newProjectWorkspace',
        'openProjectWorkspace',
        'continueWorking',
        'searchCommands',
        'openSettings',
        'openHelp'
    ])],
    ['dashboard-widget', new Set([
        'configureDashboard',
        'newReport',
        'searchDashboard',
        'searchCommands',
        'openSettings',
        'openHelp'
    ])],
    ['welcome', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'newProjectWorkspace',
        'openProjectWorkspace',
        'continueWorking',
        'newReport',
        'importData',
        'searchCommands',
        'openHelp',
        'openSettings'
    ])],
    ['project-workspace', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'saveProjectWorkspace',
        'saveProjectWorkspaceAs',
        'exportProjectWorkspace',
        'openProjectWorkspace',
        'newProjectWorkspace',
        'addProjectAsset',
        'openProjectProperties',
        'newTemplate',
        'newReport',
        'importData',
        'searchCommands',
        'openSettings'
    ])],
    ['project-asset', new Set([
        'saveProjectWorkspace',
        'exportProjectWorkspace',
        'addProjectAsset',
        'openProjectProperties',
        'searchProjectAssets',
        'searchCommands',
        'openSettings',
        'openHelp'
    ])],
    ['report-builder', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'addField',
        'done',
        'configureReport',
        'validateReport',
        'openEditor',
        'searchCommands',
        'saveProjectWorkspace',
        'newReport',
        'openSettings',
        'openHelp'
    ])],
    ['field-configuration', new Set([
        'addField',
        'done',
        'configureReport',
        'validateReport',
        'searchCommands',
        'saveProjectWorkspace',
        'openSettings',
        'openHelp'
    ])],
    ['editor', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'addEntry',
        'spellCheck',
        'openProgressLog',
        'validateReport',
        'openViewer',
        'searchCommands',
        'saveProjectWorkspace',
        'editCopy',
        'openSettings',
        'openHelp'
    ])],
    ['report-viewer', new Set([
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'exportReport',
        'printPreview',
        'openProgressLog',
        'openEditor',
        'searchCommands',
        'saveProjectWorkspace',
        'closeReport',
        'openSettings',
        'openHelp'
    ])],
    ['progress-log', new Set([
        'openProgressLog',
        'validateReport',
        'reportStatistics',
        'openEditor',
        'searchCommands',
        'saveProjectWorkspace',
        'openSettings',
        'openHelp'
    ])],
    ['lookup-tool', new Set([
        'focusLookup',
        'resetLookup',
        'searchAccessibilityStandards',
        'editCopy',
        'searchCommands',
        'saveProjectWorkspace',
        'openSettings',
        'openHelp'
    ])],
    ['search-results', new Set([
        'findInCurrentResource', 'findNextMatch', 'findPreviousMatch', 'nextSearchResult', 'previousSearchResult',
        'clearSearchHighlights', 'clearSearchHistory', 'saveCurrentSearch', 'openSavedSearches', 'searchEverywhere',
        'searchCommands', 'openHelp', 'openSettings', 'editSelectAll', 'editCopy'
    ])],
    ['help', new Set(['openHelp', 'searchHelpDocumentation', 'searchCommands', 'searchEverywhere'])],
    ['user-guide', new Set(['openHelp', 'searchHelpDocumentation', 'searchCommands', 'searchEverywhere'])],
    ['settings', new Set([
        'openSettings', 'settingsClose', 'settingsRestoreShortcuts', 'settingsImportStandard', 'settingsPasteStandardTable',
        'settingsImportReportFile', 'settingsImportTemplateFile', 'settingsOpenIntegrations', 'settingsTogglePrivacyMode',
        'settingsCreateBackup', 'settingsResetApp', 'settingsCloseReport', 'searchCommands', 'searchKeyboardShortcuts', 'openHelp'
    ])]
]);

const workspaceOpenCoreActions = new Set();

const workspaceContextEssentialActions = new Map();

let frameworkInitialized = false;
let menuElement = null;
let overlayElement = null;
let searchInputElement = null;
let statusElement = null;
let lastTriggerElement = null;
let lastPointerEvent = null;
let openState = null;
let touchTimer = null;
let typeAheadBuffer = '';
let typeAheadTimer = null;

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

function normalizeShortcut(value) {
    return normalizeText(value).replace(/\s*\+\s*/g, '+').toLowerCase();
}

function escapeSelectorValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getSelectionAnchorElement() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const anchorNode = selection.anchorNode || selection.getRangeAt(0).commonAncestorContainer;
    if (!anchorNode) return null;
    if (anchorNode instanceof Element) return anchorNode;
    return anchorNode.parentElement || null;
}

function isMeaningfulContextElement(element) {
    if (!(element instanceof Element)) return false;
    const tag = String(element.tagName || '').toLowerCase();
    if (tag === 'html' || tag === 'body') return false;
    return true;
}

function resolveContextAnchorElement(candidate) {
    if (isMeaningfulContextElement(candidate)) return candidate;

    const selectionAnchor = getSelectionAnchorElement();
    if (isMeaningfulContextElement(selectionAnchor)) return selectionAnchor;

    if (isMeaningfulContextElement(document.activeElement)) return document.activeElement;
    return candidate instanceof Element ? candidate : document.body;
}

function resolveInvocationAnchorElement(options = {}) {
    const preferSelection = options.preferSelection === true;
    const candidate = options.candidate instanceof Element ? options.candidate : document.activeElement;
    const selectionAnchor = getSelectionAnchorElement();

    if (preferSelection && isMeaningfulContextElement(selectionAnchor)) {
        return selectionAnchor;
    }

    return resolveContextAnchorElement(candidate);
}

function getApplicationContextFromFocus(anchorElement = document.activeElement) {
    const focused = resolveContextAnchorElement(anchorElement);
    const selection = document.getSelection();
    const selectedText = normalizeText(selection?.toString?.() || '');
    const activeWorkspace = getActiveProjectWorkspace();
    const selectedTabId = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]')?.id || 'tab-welcome';

    const base = {
        anchorElement: focused,
        selectedText,
        selectionType: selectedText ? 'text' : 'none',
        workspace: activeWorkspace,
        selectedTabId,
        appState,
        isTextSelection: Boolean(selectedText)
    };

    if (focused?.closest?.('#workspace-explorer')) {
        const resourceButton = focused.closest?.('[data-workspace-resource="true"]');
        if (resourceButton) {
            const resourceType = resourceButton.getAttribute('data-resource-type') || 'project-asset';
            return { ...base, kind: resourceType === 'asset' ? 'project-asset' : 'project-workspace', contextLabel: resourceType === 'asset' ? 'Project Asset' : 'Project Workspace' };
        }
        return { ...base, kind: 'project-workspace', contextLabel: 'Project Workspace' };
    }

    if (focused?.closest?.('#dashboard')) return { ...base, kind: 'dashboard', contextLabel: 'Dashboard' };
    if (focused?.closest?.('#lookup-tool')) return { ...base, kind: 'lookup-tool', contextLabel: 'Accessibility Lookup Tool' };
    if (focused?.closest?.('#help-dialog')) return { ...base, kind: 'help', contextLabel: 'Help' };
    if (focused?.closest?.('#app-settings-dialog')) return { ...base, kind: 'settings', contextLabel: 'Application Settings' };
    if (focused?.closest?.('#search-everywhere-dialog')) return { ...base, kind: 'search-results', contextLabel: 'Search Results' };
    if (focused?.closest?.('#command-palette-dialog')) return { ...base, kind: 'command-palette', contextLabel: 'Command Palette' };
    if (focused?.closest?.('#menu-bar')) return { ...base, kind: 'menu-bar', contextLabel: 'Menu Bar' };

    switch (selectedTabId) {
        case 'tab-builder': return { ...base, kind: 'report-builder', contextLabel: 'Report Builder' };
        case 'tab-editor': return { ...base, kind: 'editor', contextLabel: 'Editor' };
        case 'tab-view': return { ...base, kind: 'report-viewer', contextLabel: 'Report Viewer' };
        default: return { ...base, kind: 'welcome', contextLabel: 'Welcome Screen' };
    }
}

function registerContextProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Context provider requires an id.');
    if (providerRegistry.has(id)) throw new Error(`Context provider ${id} is already registered.`);

    const normalized = {
        id,
        name: normalizeText(source.name || id),
        description: normalizeText(source.description),
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 100,
        supportedContexts: Array.isArray(source.supportedContexts) ? source.supportedContexts.map((item) => normalizeText(item)).filter(Boolean) : [],
        supportedSelectionTypes: Array.isArray(source.supportedSelectionTypes) ? source.supportedSelectionTypes.map((item) => normalizeText(item)).filter(Boolean) : [],
        supportedCommandGroups: Array.isArray(source.supportedCommandGroups) ? source.supportedCommandGroups.map((item) => normalizeText(item)).filter(Boolean) : [],
        supportedSubmenus: Array.isArray(source.supportedSubmenus) ? source.supportedSubmenus.map((item) => normalizeText(item)).filter(Boolean) : [],
        supportedCommands: Array.isArray(source.supportedCommands) ? source.supportedCommands.map((item) => normalizeText(item)).filter(Boolean) : [],
        commandFilter: typeof source.commandFilter === 'function' ? source.commandFilter : null,
        getContext: typeof source.getContext === 'function' ? source.getContext : null,
        getMetadata: typeof source.getMetadata === 'function' ? source.getMetadata : null
    };

    providerRegistry.set(id, normalized);
    return normalized;
}

function unregisterContextProvider(providerId) {
    return providerRegistry.delete(normalizeText(providerId));
}

function getContextProviders() {
    return [...providerRegistry.values()].sort((left, right) => left.priority - right.priority);
}

function matchesProvider(provider, context) {
    if (!provider) return false;
    if (provider.supportedContexts.length > 0 && !provider.supportedContexts.includes(context.kind)) return false;
    if (provider.supportedSelectionTypes.length > 0 && !provider.supportedSelectionTypes.includes(context.selectionType)) return false;
    return true;
}

function resolveContextProvider(context) {
    const candidates = getContextProviders().filter((provider) => matchesProvider(provider, context));
    return candidates[0] || getContextProviders()[0] || null;
}

function getProviderRoots(provider, context) {
    const roots = new Set(contextRoots.get(context.kind) || contextRoots.get(provider?.supportedContexts?.[0]) || []);
    if (provider?.supportedCommandGroups?.length) {
        provider.supportedCommandGroups.forEach((group) => roots.add(group));
    }
    if (!roots.size) {
        groupOrder.forEach((group) => roots.add(group));
    }
    return [...roots].sort((left, right) => {
        const leftIndex = rootOrder.indexOf(left);
        const rightIndex = rootOrder.indexOf(right);
        if (leftIndex !== -1 || rightIndex !== -1) {
            return (leftIndex === -1 ? rootOrder.length : leftIndex) - (rightIndex === -1 ? rootOrder.length : rightIndex);
        }
        return left.localeCompare(right, undefined, { sensitivity: 'base' });
    });
}

function getCommandExecutionContext(context) {
    return {
        source: 'global-context-menu',
        invocation: 'context-menu',
        context,
        activeElement: context.anchorElement,
        selectedText: context.selectedText,
        workspace: context.workspace
    };
}

function getCommandTreeLocation(command) {
    const location = normalizeText(command.menuLocation);
    if (location) return location;
    return normalizeText(command.category) || 'Application';
}

function splitLocation(location) {
    return String(location || '')
        .split('>')
        .map((part) => normalizeText(part))
        .filter(Boolean);
}

function isSearchAction(action) {
    const searchActions = new Set([
        'searchEverywhere', 'searchCurrentReport', 'searchCurrentProjectWorkspace', 'searchAllProjects',
        'searchAccessibilityStandards', 'searchHelpDocumentation', 'searchCommands', 'searchKeyboardShortcuts',
        'searchProjectAssets', 'searchTemplates', 'searchDashboard', 'findInCurrentResource', 'findNextMatch',
        'findPreviousMatch', 'nextSearchResult', 'previousSearchResult', 'clearSearchHighlights',
        'clearSearchHistory', 'saveCurrentSearch', 'openSavedSearches'
    ]);
    return searchActions.has(action);
}

function isTemplateAction(action) {
    return action === 'newTemplate'
        || action === 'useTemplate'
        || action === 'openTemplate'
        || action === 'editTemplate'
        || action === 'deleteTemplate'
        || action === 'importTemplate'
        || action === 'exportTemplate'
        || action === 'newReportFromTemplate';
}

function isImportAction(action) {
    return action === 'importData'
        || action === 'openReport'
        || action === 'openProject'
        || action === 'importProjectWorkspace'
        || action === 'importTemplate';
}

function isReportAuthoringAction(action) {
    return action === 'newReport'
        || action === 'configureReport'
        || action === 'addField'
        || action === 'done'
        || action === 'addEntry';
}

function isReportReviewAction(action) {
    return action === 'openProgressLog'
        || action === 'spellCheck'
        || action === 'validateReport'
        || action === 'reportStatistics'
        || action === 'exportReport'
        || action === 'printPreview'
        || action === 'viewReport'
        || action === 'closeReport';
}

function isReportNavigationAction(action) {
    return action === 'openBuilder'
        || action === 'openEditor'
        || action === 'openViewer';
}

function isLookupAction(action) {
    return action === 'focusLookup' || action === 'resetLookup';
}

function isDashboardAction(action) {
    return action === 'configureDashboard' || action === 'searchDashboard';
}

function isWorkspaceAction(action) {
    return action.startsWith('openProjectWorkspace')
        || action.startsWith('newProjectWorkspace')
        || action.startsWith('openRecentProjectWorkspace')
        || action.startsWith('continueWorking')
        || action.startsWith('closeProjectWorkspace')
        || action.startsWith('saveProjectWorkspace')
        || action.startsWith('renameProjectWorkspace')
        || action.startsWith('duplicateProjectWorkspace')
        || action.startsWith('importProjectWorkspace')
        || action.startsWith('exportProjectWorkspace')
        || action.startsWith('deleteProjectWorkspace')
        || action.startsWith('addProjectAsset')
        || action.startsWith('createAssetFolder')
        || action.startsWith('removeProjectAsset')
        || action.startsWith('refreshWorkspaceAssets')
        || action.startsWith('openProjectProperties')
        || action.startsWith('openProjectStatistics')
        || action.startsWith('openWorkspaceSettings');
}

function isSettingsAction(action) {
    return action === 'openSettings' || action.startsWith('settings');
}

function resolveContextMenuLocation(command) {
    const action = normalizeText(command.action);
    const baseLocation = getCommandTreeLocation(command);
    const baseSegments = splitLocation(baseLocation);
    const root = baseSegments[0] || normalizeText(command.category) || 'Application';

    if (isSearchAction(action)) {
        return 'Search>Search Commands';
    }

    if (action.startsWith('edit')) {
        return 'Edit>Clipboard';
    }

    if (isCommonEditAction(action)) {
        return 'Edit>Context Actions';
    }

    if (isLookupAction(action)) {
        return 'Lookup>Lookup Commands';
    }

    if (isWorkspaceAction(action)) {
        return 'Workspace>Project Workspace';
    }

    if (isTemplateAction(action)) {
        return 'Templates>Template Commands';
    }

    if (isImportAction(action)) {
        return 'Import>Import and Open';
    }

    if (isDashboardAction(action)) {
        return 'Dashboard>Dashboard Commands';
    }

    if (isReportAuthoringAction(action)) {
        return 'Report>Authoring';
    }

    if (isReportReviewAction(action)) {
        return 'Report>Review and Output';
    }

    if (isReportNavigationAction(action)) {
        return 'Report>Move Between Report Views';
    }

    if (isSettingsAction(action)) {
        return 'Settings>Application Settings';
    }

    if (root === 'Templates' || root === 'Template') {
        return 'Templates>Template Commands';
    }

    if (root === 'Report') {
        return 'Report>Report Commands';
    }

    if (root === 'Tools') {
        return 'Edit>Context Actions';
    }

    if (root === 'Help') {
        return 'Help>Help and Documentation';
    }

    return baseLocation;
}

function isCommonEditAction(action) {
    return action === 'copyEntry'
        || action === 'copyName'
        || action === 'copyDescription'
        || action === 'copyFailures'
        || action === 'copyFixes'
        || action === 'copyLink'
        || action === 'editSelectAll'
        || action === 'editCopy'
        || action === 'editCut'
        || action === 'editPaste';
}

function isActionEnabledByWorkspacePolicy(context, action) {
    if (!context.workspace) return false;
    if (workspaceOpenCoreActions.has(action)) return true;
    if (isCommonEditAction(action)) return true;
    const essentials = workspaceContextEssentialActions.get(context.kind);
    return Boolean(essentials && essentials.has(action));
}

function isActionAllowedForContext(context, command) {
    const action = normalizeText(command.action);
    if (!action) return false;

    if (isActionEnabledByWorkspacePolicy(context, action)) return true;

    const allowlist = contextActionAllowlists.get(context.kind);
    if (!allowlist) return true;
    return allowlist.has(action);
}

function createNode(label, path) {
    return { label, path, commands: [], children: [] };
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

function buildCommandTree(commands) {
    const roots = [];
    const rootMap = new Map();

    commands.forEach((command) => {
        const segments = splitLocation(resolveContextMenuLocation(command));
        const rootLabel = segments[0] || command.category || 'Application';
        let root = rootMap.get(rootLabel);
        if (!root) {
            root = createNode(rootLabel, rootLabel);
            rootMap.set(rootLabel, root);
            roots.push(root);
        }

        if (segments.length <= 1) {
            root.commands.push(command);
            return;
        }

        let current = root;
        for (let index = 1; index < segments.length; index += 1) {
            const segment = segments[index];
            current = getChildNode(current, segment);
            if (index === segments.length - 1) {
                current.commands.push(command);
            }
        }
    });

    const sortNodes = (nodes) => nodes.sort((left, right) => {
        const leftIndex = rootOrder.indexOf(left.label);
        const rightIndex = rootOrder.indexOf(right.label);
        if (leftIndex !== -1 || rightIndex !== -1) {
            return (leftIndex === -1 ? rootOrder.length : leftIndex) - (rightIndex === -1 ? rootOrder.length : rightIndex);
        }
        return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });

    const recurse = (nodes) => {
        sortNodes(nodes);
        nodes.forEach((node) => {
            node.commands.sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }));
            recurse(node.children);
        });
        return nodes;
    };

    return recurse(roots);
}

function injectStyles() {
    if (document.getElementById('global-context-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'global-context-menu-styles';
    style.textContent = `
        .global-context-menu-overlay {
            position: fixed;
            inset: 0;
            z-index: 3000;
            background: transparent;
        }

        .global-context-menu {
            position: fixed;
            min-width: 280px;
            max-width: min(480px, calc(100vw - 24px));
            max-height: min(75vh, 720px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--art-surface-background);
            color: var(--art-text-color);
            border: var(--art-border-width) solid var(--art-border-color);
            border-radius: 14px;
            box-shadow: 0 18px 42px rgba(9, 18, 28, 0.24);
            padding: 10px;
            font-size: 0.95rem;
        }

        .global-context-menu__header {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: var(--art-border-width) solid var(--art-border-color);
        }

        .global-context-menu__title {
            margin: 0;
            font-size: 1rem;
            font-weight: 700;
        }

        .global-context-menu__subtitle,
        .global-context-menu__status,
        .global-context-menu__hint,
        .global-context-menu__description {
            margin: 0;
            color: var(--art-muted-text-color);
            font-size: 0.82rem;
        }

        .global-context-menu__groups {
            display: grid;
            gap: 8px;
            overflow: auto;
            min-height: 0;
            padding-right: 2px;
        }

        .global-context-menu__group {
            border: var(--art-border-width) solid var(--art-border-color);
            border-radius: 12px;
            padding: 8px;
        }

        .global-context-menu__group-title {
            margin: 0 0 6px;
            font-size: 0.82rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--art-muted-text-color);
        }

        .global-context-menu__items {
            display: grid;
            gap: 4px;
        }

        .global-context-menu__item,
        .global-context-menu__submenu-toggle {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            text-align: left;
            padding: 8px 10px;
            border: var(--art-border-width) solid transparent;
            border-radius: 10px;
            background: var(--art-button-background);
            color: var(--art-button-text);
        }

        .global-context-menu__item:focus-visible,
        .global-context-menu__submenu-toggle:focus-visible,
        .global-context-menu__item.is-active,
        .global-context-menu__submenu-toggle.is-active {
            outline: var(--art-focus-outline-width) solid var(--art-focus-color);
            outline-offset: 2px;
        }

        .global-context-menu__item[aria-disabled="true"] {
            opacity: 0.56;
        }

        .global-context-menu__item-label,
        .global-context-menu__submenu-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .global-context-menu__shortcut {
            color: var(--art-muted-text-color);
            font-size: 0.8rem;
            white-space: nowrap;
        }

        .global-context-menu__submenu {
            margin: 6px 0 0 10px;
            padding-left: 10px;
            border-left: 1px solid var(--art-border-color);
            display: grid;
            gap: 4px;
        }

        .global-context-menu__search {
            margin-top: 10px;
            padding-top: 8px;
            border-top: var(--art-border-width) solid var(--art-border-color);
            display: grid;
            gap: 4px;
            flex: 0 0 auto;
            background: var(--art-surface-background);
        }

        .global-context-menu__search input {
            width: 100%;
            box-sizing: border-box;
        }

        .global-context-menu__empty {
            padding: 10px;
            color: var(--art-muted-text-color);
        }
    `;
    document.head.appendChild(style);
}

function getCommandRoots(provider, context) {
    const roots = getProviderRoots(provider, context);
    const allowed = new Set(roots.map((item) => item.toLowerCase()));
    return (command) => {
        if (command.contextMenuVisible === false) return false;
        if (command.visible === false) return false;
        if (!command.canExecute) return false;
        if (!isActionAllowedForContext(context, command)) return false;

        const action = normalizeText(command.action);
        if (action === 'settingsClose' || (action.startsWith('settings') && action !== 'openSettings')) {
            if (context.kind !== 'settings') return false;
        }

        if (provider?.supportedCommands?.length && !provider.supportedCommands.includes(command.action) && !provider.supportedCommands.includes(command.id)) return false;
        if (provider?.commandFilter && !provider.commandFilter(command, context)) return false;

        const root = splitLocation(resolveContextMenuLocation(command))[0] || command.category || 'Application';
        if (!allowed.has(root.toLowerCase())) return false;
        return true;
    };
}

function getCommandsForContext(context, provider) {
    const allowCommand = getCommandRoots(provider, context);
    return commandRegistry.getCommands()
        .map((command) => ({
            ...command,
            ...commandExecutionService.getCommandExecutionState(command.id, getCommandExecutionContext(context)),
            keyboardShortcut: getShortcutForAction(command.action) || command.keyboardShortcut || ''
        }))
        .filter((command) => allowCommand(command));
}

function formatShortcut(command) {
    return normalizeShortcut(command.keyboardShortcut);
}

function getVisibleCommands(context, provider, query = '') {
    const commands = getCommandsForContext(context, provider);
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) return commands;

    const searchHits = new Set(searchCommands(normalizedQuery, { context: { source: 'global-context-menu', context } }).map((command) => command.id));
    return commands.filter((command) => {
        if (searchHits.has(command.id)) return true;
        const text = [
            command.displayName,
            command.description,
            command.category,
            command.keyboardShortcut,
            command.menuLocation,
            command.notes,
            command.action,
            command.id
        ].join(' ').toLowerCase();
        return text.includes(normalizedQuery);
    });
}

function getRootLabel(context, provider) {
    return provider?.name || context.contextLabel || 'Context Menu';
}

function getPathKey(path) {
    return path.join('>');
}

function createMenuTree(commands) {
    return buildCommandTree(commands);
}

function getCurrentFocusableItems() {
    if (!menuElement) return [];
    return Array.from(menuElement.querySelectorAll('[data-menu-focusable="true"]'))
        .filter((element) => element.offsetParent !== null);
}

function getActiveNavigationPath() {
    return normalizeText(openState?.openPath || '');
}

function isItemInNavigationScope(item, scopePath) {
    if (!(item instanceof HTMLElement)) return false;
    const path = normalizeText(scopePath);
    if (!path) return true;

    const commandPath = normalizeText(item.getAttribute('data-command-path'));
    const submenuPath = normalizeText(item.getAttribute('data-submenu-path'));

    if (commandPath) {
        return commandPath === path || commandPath.startsWith(`${path}>`);
    }

    if (submenuPath) {
        if (submenuPath === path) return false;
        return submenuPath.startsWith(`${path}>`);
    }

    return false;
}

function getNavigationItems(scopePath = getActiveNavigationPath()) {
    const items = getCurrentFocusableItems();
    return items.filter((item) => isItemInNavigationScope(item, scopePath));
}

function setActiveItemElement(target) {
    if (!(target instanceof HTMLElement)) return;
    const items = getCurrentFocusableItems();
    items.forEach((item) => item.classList.remove('is-active'));
    target.classList.add('is-active');
    target.focus();

    const scopedItems = getNavigationItems();
    const scopedIndex = Math.max(0, scopedItems.indexOf(target));
    openState.activeIndex = scopedIndex;
}

function setActiveItemByIndex(index) {
    const items = getNavigationItems();
    if (!items.length) return;
    const normalizedIndex = ((index % items.length) + items.length) % items.length;
    const target = items[normalizedIndex];
    setActiveItemElement(target);
    openState.activeIndex = normalizedIndex;
}

function focusFirstItem() {
    setActiveItemByIndex(0);
}

function focusLastItem() {
    const items = getNavigationItems();
    if (!items.length) return;
    setActiveItemByIndex(items.length - 1);
}

function focusItemByText(text) {
    const query = normalizeText(text).toLowerCase();
    if (!query) return;
    const items = getNavigationItems();
    const start = (openState.activeIndex + 1) % Math.max(items.length, 1);
    for (let offset = 0; offset < items.length; offset += 1) {
        const index = (start + offset) % items.length;
        const item = items[index];
        const label = normalizeText(item.textContent).toLowerCase();
        if (label.startsWith(query)) {
            setActiveItemByIndex(index);
            return;
        }
    }
}

function announceStatus(message) {
    if (statusElement) statusElement.textContent = message;
    announce(message);
}

function updateMenuPosition(anchorX, anchorY) {
    if (!menuElement) return;
    const margin = 12;
    const width = menuElement.offsetWidth || 320;
    const height = menuElement.offsetHeight || 320;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    const left = Math.min(Math.max(margin, anchorX), maxX);
    const top = Math.min(Math.max(margin, anchorY), maxY);
    menuElement.style.left = `${Math.round(left)}px`;
    menuElement.style.top = `${Math.round(top)}px`;
}

function clearMenuDom() {
    overlayElement?.remove();
    overlayElement = null;
    menuElement = null;
    searchInputElement = null;
    statusElement = null;
}

function dismissContextMenu(options = {}) {
    const restoreFocus = options.restoreFocus !== false;
    const clearSearch = options.clearSearch === true;
    if (!openState) return false;

    clearMenuDom();
    openState = null;
    typeAheadBuffer = '';
    if (typeAheadTimer) {
        window.clearTimeout(typeAheadTimer);
        typeAheadTimer = null;
    }

    if (restoreFocus && lastTriggerElement && typeof lastTriggerElement.focus === 'function') {
        window.setTimeout(() => lastTriggerElement.focus(), 0);
    }
    if (clearSearch) announceStatus('Context menu dismissed.');
    return true;
}

function buildMenuItem(command, depth, path) {
    const shortcut = normalizeText(command.keyboardShortcut || getShortcutForAction(command.action) || '');
    const stateLabel = command.canExecute ? '' : (command.reason === 'hidden' ? 'Unavailable' : 'Disabled');
    const label = escapeHtml(command.displayName);
    const title = command.description ? ` title="${escapeHtml(command.description)}"` : '';
    const ariaLabel = `${command.displayName}${shortcut ? `, shortcut ${shortcut}` : ''}${stateLabel ? `, ${stateLabel}` : ''}`;
    return `
        <button
            type="button"
            class="global-context-menu__item"
            role="menuitem${command.canExecute ? '' : ''}"
            aria-label="${escapeHtml(ariaLabel)}"
            aria-disabled="${String(!command.canExecute)}"
            data-menu-focusable="true"
            data-command-id="${escapeHtml(command.id)}"
            data-command-path="${escapeHtml(path.join('>'))}"
            ${title}
        >
            <span class="global-context-menu__item-label">
                <span>${label}</span>
            </span>
            <span class="global-context-menu__shortcut">${escapeHtml(shortcut || '')}</span>
        </button>
    `;
}

function renderTreeNodes(nodes, depth = 0, parentPath = []) {
    if (!nodes.length) return '';

    return nodes.map((node) => {
        const path = [...parentPath, node.label];
        const key = getPathKey(path);
        const hasChildren = node.children.length > 0;
        const hasCommands = node.commands.length > 0;
        const submenuOpen = openState?.openPath?.startsWith(key);

        const commandMarkup = hasCommands
            ? `<div class="global-context-menu__items" role="none">${node.commands.map((command) => buildMenuItem(command, depth, path)).join('')}</div>`
            : '';

        const childMarkup = hasChildren
            ? `<div class="global-context-menu__submenu" role="group" aria-label="${escapeHtml(node.label)}" ${submenuOpen ? '' : 'hidden'}>${renderTreeNodes(node.children, depth + 1, path)}</div>`
            : '';

        if (!hasChildren && hasCommands) {
            return `
                <section class="global-context-menu__group" role="group" aria-labelledby="global-context-menu-group-${escapeHtml(key)}-heading">
                    <h3 id="global-context-menu-group-${escapeHtml(key)}-heading" class="global-context-menu__group-title">${escapeHtml(node.label)}</h3>
                    ${commandMarkup}
                </section>
            `;
        }

        return `
            <section class="global-context-menu__group" role="group" aria-labelledby="global-context-menu-group-${escapeHtml(key)}-heading">
                <h3 id="global-context-menu-group-${escapeHtml(key)}-heading" class="global-context-menu__group-title">${escapeHtml(node.label)}</h3>
                <div class="global-context-menu__items" role="none">
                    ${hasCommands ? node.commands.map((command) => buildMenuItem(command, depth, path)).join('') : ''}
                    ${hasChildren ? `
                        <button
                            type="button"
                            class="global-context-menu__submenu-toggle"
                            role="menuitem"
                            aria-haspopup="true"
                            aria-expanded="${String(submenuOpen)}"
                            data-menu-focusable="true"
                            data-submenu-path="${escapeHtml(key)}"
                            aria-label="${escapeHtml(node.label)} submenu"
                        >
                            <span class="global-context-menu__submenu-label"><span>${escapeHtml(node.label)}</span></span>
                            <span class="global-context-menu__shortcut">›</span>
                        </button>
                        ${childMarkup}
                    ` : ''}
                </div>
            </section>
        `;
    }).join('');
}

function renderMenu() {
    if (!openState || !menuElement) return;
    const { context, provider, commands, searchText } = openState;
    const visibleCommands = getVisibleCommands(context, provider, searchText);
    const tree = createMenuTree(visibleCommands);
    const providerMeta = provider?.getMetadata ? provider.getMetadata(context) : null;
    const subtitle = providerMeta?.subtitle || `${visibleCommands.length} command${visibleCommands.length === 1 ? '' : 's'} available`;

    menuElement.innerHTML = `
        <div class="global-context-menu__header">
            <h2 class="global-context-menu__title">Context Menu</h2>
            <p class="global-context-menu__subtitle">${escapeHtml(getRootLabel(context, provider))}</p>
            <p class="global-context-menu__description">${escapeHtml(subtitle)}</p>
        </div>
        <div class="global-context-menu__groups" role="none">
            ${tree.length ? renderTreeNodes(tree) : '<div class="global-context-menu__empty">No matching commands.</div>'}
        </div>
        <div class="global-context-menu__search" role="group" aria-label="Search Commands">
            <label class="global-context-menu__hint" for="global-context-menu-search">Search Commands</label>
            <input id="global-context-menu-search" type="search" autocomplete="off" spellcheck="false" aria-describedby="global-context-menu-status global-context-menu-search-help">
            <p id="global-context-menu-search-help" class="global-context-menu__description">Filter commands available in this menu.</p>
        </div>
        <p id="global-context-menu-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    searchInputElement = menuElement.querySelector('#global-context-menu-search');
    statusElement = menuElement.querySelector('#global-context-menu-status');
    if (searchInputElement) {
        searchInputElement.value = searchText;
        searchInputElement.addEventListener('input', () => {
            openState.searchText = searchInputElement.value;
            renderMenu();
            announceStatus(openState.searchText ? `${getVisibleCommands(context, provider, openState.searchText).length} commands available.` : 'Search cleared.');
        });
        searchInputElement.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (searchInputElement.value) {
                event.preventDefault();
                searchInputElement.value = '';
                openState.searchText = '';
                renderMenu();
                focusFirstItem();
                announceStatus('Search cleared.');
                return;
            }
            event.preventDefault();
            dismissContextMenu({ restoreFocus: true });
        });
    }

    const matchingCount = visibleCommands.length;
    if (!matchingCount) {
        announceStatus('No matching commands.');
    } else {
        announceStatus(`${matchingCount} command${matchingCount === 1 ? '' : 's'} available.`);
    }

    window.setTimeout(() => {
        updateMenuPosition(openState.anchorX, openState.anchorY);
        focusFirstItem();
    }, 0);
}

function activateCommand(commandId) {
    const command = commandRegistry.getCommand(commandId);
    if (!command) return false;

    const executionContext = getCommandExecutionContext(openState.context);
    const result = commandExecutionService.executeCommand(command.id, executionContext);
    if (result?.then) {
        void result.then((resolved) => {
            if (resolved?.ok !== false) {
                announce(`${command.displayName} executed.`);
            }
        });
    } else if (result?.ok !== false) {
        announce(`${command.displayName} executed.`);
    }

    dismissContextMenu({ restoreFocus: false });
    return true;
}

function openSubmenu(submenuPath) {
    if (!openState) return;
    openState.openPath = submenuPath;
    renderMenu();
    const submenuItems = getNavigationItems(submenuPath);
    if (submenuItems.length) {
        setActiveItemElement(submenuItems[0]);
        openState.activeIndex = 0;
        return;
    }
    const submenuItem = menuElement.querySelector(`[data-submenu-path="${escapeSelectorValue(submenuPath)}"]`);
    if (submenuItem instanceof HTMLElement) {
        setActiveItemElement(submenuItem);
    }
}

function closeSubmenu() {
    if (!openState?.openPath) return false;
    const previousPath = openState.openPath;
    const segments = previousPath.split('>');
    segments.pop();
    openState.openPath = segments.join('>');
    renderMenu();

    const parentPath = openState.openPath;
    if (parentPath) {
        const toggle = menuElement.querySelector(`[data-submenu-path="${escapeSelectorValue(parentPath)}"]`);
        if (toggle instanceof HTMLElement) {
            setActiveItemElement(toggle);
            return true;
        }
    }

    const previousToggle = menuElement.querySelector(`[data-submenu-path="${escapeSelectorValue(previousPath)}"]`);
    if (previousToggle instanceof HTMLElement) {
        setActiveItemElement(previousToggle);
        return true;
    }

    focusFirstItem();
    return true;
}

function handleMenuKeydown(event) {
    if (!openState) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const isSearchField = target === searchInputElement;

    if (isSearchField) return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveItemByIndex(openState.activeIndex + 1);
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveItemByIndex(openState.activeIndex - 1);
        return;
    }

    if (event.key === 'Home') {
        event.preventDefault();
        focusFirstItem();
        return;
    }

    if (event.key === 'End') {
        event.preventDefault();
        focusLastItem();
        return;
    }

    if (event.key === 'ArrowRight') {
        const current = getNavigationItems()[openState.activeIndex];
        const submenuPath = current?.getAttribute('data-submenu-path') || '';
        if (submenuPath) {
            event.preventDefault();
            openSubmenu(submenuPath);
        }
        return;
    }

    if (event.key === 'ArrowLeft') {
        if (closeSubmenu()) event.preventDefault();
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        if (openState.searchText) {
            openState.searchText = '';
            renderMenu();
            focusFirstItem();
            announceStatus('Search cleared.');
            return;
        }
        if (closeSubmenu()) return;
        dismissContextMenu({ restoreFocus: true });
        return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
        const current = getNavigationItems()[openState.activeIndex];
        if (!current) return;
        event.preventDefault();
        const submenuPath = current.getAttribute('data-submenu-path') || '';
        const commandId = current.getAttribute('data-command-id') || '';
        if (submenuPath) {
            openSubmenu(submenuPath);
            return;
        }
        if (commandId) activateCommand(commandId);
        return;
    }

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        typeAheadBuffer += event.key;
        if (typeAheadTimer) window.clearTimeout(typeAheadTimer);
        typeAheadTimer = window.setTimeout(() => {
            typeAheadBuffer = '';
        }, 600);
        focusItemByText(typeAheadBuffer);
    }
}

function handleMenuClick(event) {
    const target = event.target instanceof HTMLElement ? event.target.closest('[data-command-id], [data-submenu-path]') : null;
    if (!target) return;

    const commandId = target.getAttribute('data-command-id') || '';
    const submenuPath = target.getAttribute('data-submenu-path') || '';
    if (submenuPath) {
        openSubmenu(submenuPath);
        return;
    }
    if (commandId) activateCommand(commandId);
}

function getAnchorPoint(event = {}) {
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number' && (event.clientX || event.clientY)) {
        return { x: event.clientX, y: event.clientY };
    }

    const selection = document.getSelection();
    if (selection && selection.rangeCount > 0) {
        const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
        if (rangeRect && (rangeRect.width || rangeRect.height)) {
            return {
                x: rangeRect.left + Math.min(20, Math.max(4, rangeRect.width / 2)),
                y: rangeRect.top + Math.min(20, Math.max(4, rangeRect.height / 2))
            };
        }
    }

    const active = event.target instanceof Element ? event.target : document.activeElement;
    if (active instanceof Element) {
        const rect = active.getBoundingClientRect();
        return {
            x: rect.left + Math.min(24, Math.max(8, rect.width / 2)),
            y: rect.top + Math.min(24, Math.max(8, rect.height / 2))
        };
    }

    return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

function createMenuShell() {
    clearMenuDom();
    overlayElement = document.createElement('div');
    overlayElement.className = 'global-context-menu-overlay';
    overlayElement.addEventListener('pointerdown', (event) => {
        if (event.target === overlayElement) {
            dismissContextMenu({ restoreFocus: true });
        }
    });

    menuElement = document.createElement('div');
    menuElement.className = 'global-context-menu';
    menuElement.setAttribute('role', 'menu');
    menuElement.setAttribute('aria-label', 'Context menu');
    menuElement.tabIndex = -1;
    menuElement.addEventListener('keydown', handleMenuKeydown, true);
    menuElement.addEventListener('click', handleMenuClick);
    menuElement.addEventListener('focusin', () => {
        if (lastTriggerElement) return;
    });

    overlayElement.appendChild(menuElement);
    document.body.appendChild(overlayElement);
}

function showContextMenu(invocation = {}) {
    const anchorElement = invocation.anchorElement instanceof Element ? invocation.anchorElement : document.activeElement;
    const context = invocation.context || getApplicationContextFromFocus(anchorElement);
    const provider = resolveContextProvider(context);
    const providerMetadata = provider?.getMetadata ? provider.getMetadata(context) : null;
    const allowedCommands = getVisibleCommands(context, provider, '');

    if (!allowedCommands.length) {
        announceStatus('No context menu commands available.');
        return false;
    }

    lastTriggerElement = anchorElement instanceof HTMLElement ? anchorElement : null;
    openState = {
        context,
        provider,
        providerMetadata,
        commands: allowedCommands,
        searchText: '',
        openPath: '',
        activeIndex: 0,
        anchorX: Number.isFinite(Number(invocation.anchorX)) ? Number(invocation.anchorX) : 0,
        anchorY: Number.isFinite(Number(invocation.anchorY)) ? Number(invocation.anchorY) : 0
    };

    createMenuShell();
    renderMenu();
    const anchorPoint = (Number.isFinite(Number(invocation.anchorX)) && Number.isFinite(Number(invocation.anchorY)))
        ? { x: Number(invocation.anchorX), y: Number(invocation.anchorY) }
        : getAnchorPoint(invocation.event || invocation);
    openState.anchorX = anchorPoint.x;
    openState.anchorY = anchorPoint.y;
    updateMenuPosition(anchorPoint.x, anchorPoint.y);
    announceStatus(`${getRootLabel(context, provider)} context menu opened.`);
    return true;
}

function handleContextMenuEvent(event) {
    if (!frameworkInitialized) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
    }

    const anchorElement = resolveContextAnchorElement(event.target instanceof Element ? event.target : document.activeElement);
    dismissContextMenu({ restoreFocus: true });
    showContextMenu({ event, anchorElement, context: getApplicationContextFromFocus(anchorElement) });
}

function handleGlobalKeydown(event) {
    if (!frameworkInitialized) return;
    const key = String(event.key || '');
    if (key === 'ContextMenu' || (event.shiftKey && key === 'F10')) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        const activeFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const anchorElement = resolveInvocationAnchorElement({
            candidate: event.target instanceof Element ? event.target : document.activeElement,
            preferSelection: true
        });
        const anchorPoint = getAnchorPoint({ target: anchorElement });
        dismissContextMenu({ restoreFocus: false });
        showContextMenu({
            event,
            anchorElement,
            context: getApplicationContextFromFocus(anchorElement),
            anchorX: anchorPoint.x,
            anchorY: anchorPoint.y
        });
        lastTriggerElement = activeFocus;
    }
}

function handlePointerDown(event) {
    if (!frameworkInitialized || event.pointerType !== 'touch') return;
    lastPointerEvent = event;
    if (touchTimer) window.clearTimeout(touchTimer);
    touchTimer = window.setTimeout(() => {
        showContextMenu({ event: lastPointerEvent, anchorElement: event.target instanceof Element ? event.target : document.activeElement, context: getApplicationContextFromFocus(event.target instanceof Element ? event.target : document.activeElement) });
    }, 550);
}

function handlePointerUp() {
    if (touchTimer) {
        window.clearTimeout(touchTimer);
        touchTimer = null;
    }
}

function handlePointerMove() {
    if (touchTimer) {
        window.clearTimeout(touchTimer);
        touchTimer = null;
    }
}

function registerDefaultProviders() {
    if (providerRegistry.size > 0) return;

    const createProvider = (id, name, contexts, roots, description, priority = 100) => registerContextProvider({
        id,
        name,
        description,
        supportedContexts: contexts,
        supportedCommandGroups: roots,
        priority,
        commandFilter: (command) => {
            const locationRoot = splitLocation(getCommandTreeLocation(command))[0] || command.category || 'Application';
            return roots.length === 0 || roots.includes(locationRoot) || roots.includes(command.category);
        },
        getMetadata: () => ({ subtitle: description })
    });

    createProvider('dashboard-context-provider', 'Dashboard Context Provider', ['dashboard'], contextRoots.get('dashboard') || [], 'Dashboard commands and layout actions.');
    createProvider('dashboard-widget-context-provider', 'Dashboard Widget Context Provider', ['dashboard-widget'], contextRoots.get('dashboard-widget') || [], 'Widget commands and dashboard actions.');
    createProvider('project-workspace-context-provider', 'Project Workspace Context Provider', ['project-workspace', 'project-asset'], contextRoots.get('project-workspace') || [], 'Workspace lifecycle, project asset, and project settings commands.');
    createProvider('report-builder-context-provider', 'Report Builder Context Provider', ['report-builder', 'field-configuration'], contextRoots.get('report-builder') || [], 'Builder, validation, and report configuration commands.');
    createProvider('editor-context-provider', 'Editor Context Provider', ['editor'], contextRoots.get('editor') || [], 'Editor, validation, spell check, and report commands.');
    createProvider('report-viewer-context-provider', 'Report Viewer Context Provider', ['report-viewer'], contextRoots.get('report-viewer') || [], 'Viewer, export, and report commands.');
    createProvider('progress-log-context-provider', 'Progress Log Context Provider', ['progress-log'], contextRoots.get('progress-log') || [], 'Progress Log commands.');
    createProvider('lookup-context-provider', 'Accessibility Lookup Context Provider', ['lookup-tool'], contextRoots.get('lookup-tool') || [], 'Lookup, copy, and accessibility reference commands.');
    createProvider('help-context-provider', 'Help Context Provider', ['help', 'user-guide'], contextRoots.get('help') || [], 'Help and documentation commands.');
    createProvider('search-results-context-provider', 'Search Results Context Provider', ['search-results'], contextRoots.get('search-results') || [], 'Search result navigation and search session commands.');
    createProvider('settings-context-provider', 'Settings Context Provider', ['settings'], contextRoots.get('settings') || [], 'Settings and maintenance commands.');
    createProvider('welcome-context-provider', 'Welcome Screen Context Provider', ['welcome'], contextRoots.get('welcome') || [], 'Workspace launch and application commands.');
    createProvider('menu-bar-context-provider', 'Menu Bar Context Provider', ['menu-bar'], contextRoots.get('menu-bar') || [], 'Menu bar and application command navigation.');
    createProvider('command-palette-context-provider', 'Command Palette Context Provider', ['command-palette'], contextRoots.get('command-palette') || [], 'Command palette and command execution commands.');
}

export function initGlobalContextMenuFramework() {
    if (frameworkInitialized) return true;
    frameworkInitialized = true;
    registerDefaultProviders();
    injectStyles();

    document.addEventListener('contextmenu', handleContextMenuEvent, true);
    document.addEventListener('keydown', handleGlobalKeydown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerUp, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('resize', () => {
        if (!openState || !menuElement) return;
        updateMenuPosition(openState.anchorX, openState.anchorY);
    });

    return true;
}

export { registerContextProvider, unregisterContextProvider, getApplicationContextFromFocus, showContextMenu, dismissContextMenu, renderMenu as refreshContextMenu, getContextProviders };