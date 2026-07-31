// navigation.js
import { announce, appState, closeCurrentReportSession, getShortcutForAction, redoState, undoState } from './state.js';
import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { renderBuilder } from './reportBuilder.js';
import { renderEditor } from './reportEditor.js';
import { renderViewer } from './reportViewer.js';
import { renderWelcome } from './welcome.js';

const landmarks = ['top-tabs', 'dashboard', 'main-content', 'lookup-tool'];
const renderMap = {
    'tab-welcome': renderWelcome,
    'tab-builder': renderBuilder,
    'tab-editor': renderEditor,
    'tab-view': renderViewer
};

let lastLandmarkAnnouncement = '';
let shortcutObserver = null;
let navigationInitialized = false;
let applyingShortcutTooltips = false;
let shortcutTooltipRefreshQueued = false;

const shortcutActionsById = new Map();

const panelNameMap = {
    'tab-welcome': 'Welcome',
    'tab-builder': 'Report Builder',
    'tab-editor': 'Report Editor',
    'tab-view': 'Report Viewer'
};

const shortcutControlMap = [
    { id: 'tab-welcome', action: 'openWelcome', label: 'Welcome tab' },
    { id: 'tab-builder', action: 'openBuilder', label: 'Builder tab' },
    { id: 'tab-editor', action: 'openEditor', label: 'Editor tab' },
    { id: 'tab-view', action: 'openViewer', label: 'Report Viewer tab' },
    { id: 'btn-editor-progress-log', action: 'openProgressLog', label: 'Open Progress Log' },
    { id: 'btn-add-entry', action: 'addEntry', label: 'Add entry' },
    { id: 'btn-editor-spell-check', action: 'spellCheck', label: 'Spell check' },
    { id: 'btn-add-field', action: 'addField', label: 'Add field' },
    { id: 'btn-done', action: 'done', label: 'Done' },
    { id: 's', action: 'focusLookup', label: 'Search For Accessibility Standard' },
    { id: 'reset-btn', action: 'resetLookup', label: 'Reset tool' },
    { id: 'btn-open-report', action: 'openProject', label: 'Open ART project file' },
    { id: 'btn-save-project', action: 'saveProject', label: 'Save ART project' },
    { id: 'btn-save-project-as', action: 'saveProjectAs', label: 'Save ART project as' },
    { id: 'btn-import-data', action: 'importData', label: 'Import data file' },
    { id: 'btn-import-data', action: 'openReport', label: 'Import report JSON file' },
    { id: 'btn-new-report', action: 'newReport', label: 'New report' },
    { id: 'btn-configure-dashboard', action: 'configureDashboard', label: 'Configure Dashboard' },
    { id: 'btn-create-custom-widget', action: 'configureDashboard', label: 'Create Custom Widget' },
    { id: 'btn-help', action: 'openHelp', label: 'Help' },
    { id: 'top-tabs', action: 'focusNavigation', label: 'Navigation tablist' },
    { id: 'btn-export-options', action: 'exportReport', label: 'Export report' },
    { id: 'btn-viewer-progress-log', action: 'openProgressLog', label: 'Open Progress Log' },
    { id: 'btn-settings-import-standard', action: 'settingsImportStandard', label: 'Import Accessibility Standard' },
    { id: 'btn-settings-import-standards-file', action: 'settingsImportStandard', label: 'Import Standards File' },
    { id: 'btn-settings-paste-standard', action: 'settingsPasteStandardTable', label: 'Paste Standards As Table' },
    { id: 'btn-settings-import-report-file', action: 'settingsImportReportFile', label: 'Import Report File from Device' },
    { id: 'btn-settings-import-template-file', action: 'settingsImportTemplateFile', label: 'Import Template File from Device' },
    { id: 'btn-settings-shortcuts-reset', action: 'settingsRestoreShortcuts', label: 'Restore Default Shortcuts' },
    { id: 'btn-settings-reset-app', action: 'settingsResetApp', label: 'Reset ART Application Data' },
    { id: 'btn-settings-close', action: 'settingsClose', label: 'Close Application Settings' },
    { id: 'btn-app-settings', action: 'openSettings', label: 'Open Application Settings' },
    { id: 'settings-privacy-mode', action: 'settingsTogglePrivacyMode', label: 'Toggle Privacy Mode' },
    { id: 'btn-settings-backup-now', action: 'settingsCreateBackup', label: 'Create Backup' },
    { id: 'btn-workspace-new', action: 'newProjectWorkspace', label: 'New Workspace' },
    { id: 'btn-workspace-open', action: 'openProjectWorkspace', label: 'Open Workspace' },
    { id: 'btn-workspace-save', action: 'saveProjectWorkspace', label: 'Save Workspace' },
    { id: 'btn-workspace-save-as', action: 'saveProjectWorkspaceAs', label: 'Save Workspace As' },
    { id: 'btn-workspace-close', action: 'closeProjectWorkspace', label: 'Close Workspace' },
    { id: 'btn-workspace-export', action: 'exportProjectWorkspace', label: 'Export Workspace' },
    { id: 'btn-continue-working', action: 'continueWorking', label: 'Continue Working' },
    { id: 'btn-workspace-add-asset', action: 'addProjectAsset', label: 'Add Project Asset' },
    { id: 'btn-workspace-properties', action: 'openProjectProperties', label: 'Project Properties' },
    { id: 'btn-workspace-refresh', action: 'refreshWorkspaceAssets', label: 'Refresh Workspace Assets' },
    { id: 'btn-template-create', action: 'newTemplate', label: 'Create Template' },
    { id: 'btn-template-create-save', action: 'newTemplate', label: 'Create Template' },
    { id: 'btn-template-use', action: 'useTemplate', label: 'Use Template' },
    { id: 'btn-template-open', action: 'openTemplate', label: 'View Template' },
    { id: 'btn-template-edit', action: 'editTemplate', label: 'Edit Template' },
    { id: 'btn-template-delete', action: 'deleteTemplate', label: 'Delete Template' },
    { id: 'btn-template-import', action: 'importTemplate', label: 'Import Template' },
    { id: 'btn-template-export', action: 'exportTemplate', label: 'Export Template' },
    { id: 'btn-close-active-report', action: 'closeReport', label: 'Close Report' },
    { id: 'btn-configure-report', action: 'configureReport', label: 'Configure Report' },
    { id: 'btn-edit-report-dashboard', action: 'editReport', label: 'Edit Report' },
    { id: 'btn-view-report-dashboard', action: 'viewReport', label: 'View Report' },
    { id: 'btn-delete-report-dashboard', action: 'deleteReport', label: 'Delete Report' },
    { id: 'menu-bar-search', action: 'searchCommands', label: 'Menu Bar Command Search' },
    { id: 'dashboard-widget-search-input', action: 'searchDashboard', label: 'Dashboard Search' },
    { id: 'search-everywhere-input', action: 'searchEverywhere', label: 'Search Everywhere' },
    { id: 'btn-search-everywhere-save', action: 'saveCurrentSearch', label: 'Save Current Search' },
    { id: 'btn-search-everywhere-saved', action: 'openSavedSearches', label: 'Open Saved Searches' },
    { id: 'btn-search-everywhere-clear-history', action: 'clearSearchHistory', label: 'Clear Search History' }
];

shortcutControlMap.forEach(({ id, action }) => {
    if (!id || !action) return;
    const list = shortcutActionsById.get(id) || [];
    if (!list.includes(action)) list.push(action);
    shortcutActionsById.set(id, list);
});

function eventToShortcut(event) {
    const key = String(event.key || '');
    if (!key || ['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    let normalizedKey = key;
    if (/^f\d+$/i.test(key)) {
        normalizedKey = key.toUpperCase();
    } else if (key.length === 1) {
        normalizedKey = key.toUpperCase();
    } else if (key === ' ') {
        normalizedKey = 'Space';
    } else {
        normalizedKey = key[0].toUpperCase() + key.slice(1).toLowerCase();
    }

    parts.push(normalizedKey);
    return parts.join('+');
}

function normalizeShortcutSignature(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const tokens = raw.split('+').map((token) => token.trim()).filter(Boolean);
    if (!tokens.length) return '';

    let hasCtrl = false;
    let hasAlt = false;
    let hasShift = false;
    let hasMeta = false;
    let key = '';

    tokens.forEach((token) => {
        const normalized = token.toLowerCase();
        if (normalized === 'ctrl' || normalized === 'control') {
            hasCtrl = true;
            return;
        }
        if (normalized === 'alt' || normalized === 'option') {
            hasAlt = true;
            return;
        }
        if (normalized === 'shift') {
            hasShift = true;
            return;
        }
        if (normalized === 'meta' || normalized === 'cmd' || normalized === 'command' || normalized === 'win') {
            hasMeta = true;
            return;
        }
        key = token;
    });

    if (!key) return '';

    const keyText = key.toLowerCase() === 'space'
        ? 'Space'
        : key.length === 1
            ? key.toUpperCase()
            : /^f\d+$/i.test(key)
                ? key.toUpperCase()
                : key[0].toUpperCase() + key.slice(1).toLowerCase();

    const parts = [];
    if (hasCtrl) parts.push('Ctrl');
    if (hasAlt) parts.push('Alt');
    if (hasShift) parts.push('Shift');
    if (hasMeta) parts.push('Meta');
    parts.push(keyText);

    return parts.join('+').toLowerCase();
}

function findShortcutAction(event) {
    const shortcut = eventToShortcut(event);
    if (!shortcut) return '';

    const normalizedShortcut = normalizeShortcutSignature(shortcut);
    if (!normalizedShortcut) return '';

    const entries = Object.entries(appState.shortcuts || {});
    const match = entries.find(([, configuredShortcut]) => normalizeShortcutSignature(configuredShortcut) === normalizedShortcut);
    return match ? match[0] : '';
}

function ensureShortcutDescription(element, shortcut) {
    const existingId = String(element.dataset.shortcutDescId || '').trim();
    const describedById = existingId || `shortcut-desc-${element.id || Math.random().toString(36).slice(2)}`;
    let description = document.getElementById(describedById);
    if (!description) {
        description = document.createElement('span');
        description.id = describedById;
        description.className = 'sr-only';
        element.insertAdjacentElement('afterend', description);
    }
    if (description.textContent !== shortcut) {
        description.textContent = shortcut;
    }
    const describedBy = element.getAttribute('aria-describedby') || '';
    const tokens = describedBy.split(/\s+/).filter(Boolean);
    if (!tokens.includes(describedById)) {
        tokens.push(describedById);
        element.setAttribute('aria-describedby', tokens.join(' '));
    }
    element.dataset.shortcutDescId = describedById;
}

function removeShortcutTooltip(element) {
    if (!element) return;

    element.classList.remove('shortcut-tooltip');
    delete element.dataset.shortcutHint;
    element.removeAttribute('title');
    element.removeAttribute('aria-keyshortcuts');

    const describedById = String(element.dataset.shortcutDescId || '').trim();
    if (describedById) {
        const describedBy = element.getAttribute('aria-describedby') || '';
        const tokens = describedBy.split(/\s+/).filter(Boolean).filter((token) => token !== describedById);
        if (tokens.length > 0) {
            element.setAttribute('aria-describedby', tokens.join(' '));
        } else {
            element.removeAttribute('aria-describedby');
        }
        document.getElementById(describedById)?.remove();
        delete element.dataset.shortcutDescId;
    }
}

function applyShortcutTooltip(element, shortcut, label) {
    if (!element) return;
    const normalizedShortcut = String(shortcut || '').trim();

    if (!normalizedShortcut) {
        removeShortcutTooltip(element);
        return;
    }

    element.classList.add('shortcut-tooltip');
    element.dataset.shortcutHint = normalizedShortcut;
    element.setAttribute('title', normalizedShortcut);
    element.setAttribute('aria-keyshortcuts', normalizedShortcut);
    ensureShortcutDescription(element, normalizedShortcut);
    if (!element.getAttribute('aria-label') && label) {
        element.setAttribute('aria-label', `${label}. Shortcut: ${normalizedShortcut}`);
    }
}

function getElementFallbackLabel(element) {
    const ariaLabel = String(element.getAttribute('aria-label') || '').trim();
    if (ariaLabel) return ariaLabel;

    const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text;

    const title = String(element.getAttribute('title') || '').trim();
    if (title) return title;

    return 'Control';
}

function resolveActionForElement(element) {
    if (!(element instanceof Element)) return '';

    const explicitAction = String(element.getAttribute('data-shortcut-action') || '').trim();
    if (explicitAction) return explicitAction;

    const copyAction = String(element.getAttribute('data-copy-action') || '').trim();
    if (copyAction) return copyAction;

    const elementId = String(element.id || '').trim();
    if (!elementId) return '';

    const mappedActions = shortcutActionsById.get(elementId) || [];
    if (!mappedActions.length) return '';

    const withShortcut = mappedActions.find((action) => String(getShortcutForAction(action) || '').trim());
    return withShortcut || mappedActions[0] || '';
}

function collectShortcutTargets() {
    const targets = new Set();

    document.querySelectorAll('button, [role="button"], [role="tab"], input[type="button"], input[type="submit"], .copy-btn').forEach((element) => {
        targets.add(element);
    });

    shortcutControlMap.forEach(({ id }) => {
        const element = document.getElementById(id);
        if (element) targets.add(element);
    });

    return [...targets];
}

function applyShortcutTooltips() {
    applyingShortcutTooltips = true;
    try {
        const targets = collectShortcutTargets();
        targets.forEach((element) => {
            const action = resolveActionForElement(element);
            const shortcut = action ? getShortcutForAction(action) : '';
            const label = getElementFallbackLabel(element);
            applyShortcutTooltip(element, shortcut, label);
        });
    } finally {
        applyingShortcutTooltips = false;
    }
}

function scheduleShortcutTooltipRefresh() {
    if (shortcutTooltipRefreshQueued) return;
    shortcutTooltipRefreshQueued = true;
    window.setTimeout(() => {
        shortcutTooltipRefreshQueued = false;
        applyShortcutTooltips();
    }, 0);
}

function notifyPanelChanged(panel) {
    window.dispatchEvent(new CustomEvent('art-panel-changed', {
        detail: { panel }
    }));
}

function watchShortcutTargets() {
    if (shortcutObserver) return;
    shortcutObserver = new MutationObserver(() => {
        if (applyingShortcutTooltips) return;
        scheduleShortcutTooltipRefresh();
    });
    shortcutObserver.observe(document.body, { childList: true, subtree: true });
}

function getFirstVisibleHeading(container) {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(headings).find((heading) => heading.offsetParent !== null) || null;
}

function focusElementWithLabel(element, fallbackLabel) {
    if (!element) return;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus();

    const heading = getFirstVisibleHeading(element);
    const label = heading?.textContent?.trim() || element.getAttribute('aria-label') || fallbackLabel;
    if (label && label !== lastLandmarkAnnouncement) {
        announce(label);
        lastLandmarkAnnouncement = label;
    }
}

function focusMainContentRegion() {
    const main = document.getElementById('main-content');
    if (!main) return;
    const heading = getFirstVisibleHeading(main);
    if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus();
        const label = heading.textContent?.trim() || 'Active report panel';
        if (label !== lastLandmarkAnnouncement) {
            announce(label);
            lastLandmarkAnnouncement = label;
        }
        return;
    }
    focusElementWithLabel(main, 'Active report panel');
}

export function focusNavigationRegion() {
    focusElementWithLabel(document.querySelector('#top-tabs [role="tab"][aria-selected="true"]') || document.getElementById('top-tabs'), 'Navigation');
    return true;
}

export function focusDashboardRegion() {
    focusElementWithLabel(document.getElementById('dashboard'), 'Dashboard');
    notifyPanelChanged('Dashboard');
    return true;
}

export function focusMainContentArea() {
    const main = document.getElementById('main-content');
    focusElementWithLabel(main, 'Main content');
    return true;
}

export function focusLookupRegion() {
    const search = document.getElementById('s');
    if (search) search.focus();
    notifyPanelChanged('Accessibility Lookup Tool');
    return Boolean(search);
}

function navigateLandmarks(direction) {
    const activeEl = document.activeElement;
    const currentLandmarkId = activeEl?.closest?.('#top-tabs') || activeEl?.closest?.('#nav')
        ? 'top-tabs'
        : activeEl?.closest?.('#lookup-tool')
            ? 'lookup-tool'
            : activeEl?.closest?.('#main-content')
                ? 'main-content'
                : activeEl?.closest?.('#dashboard')
                    ? 'dashboard'
                    : '';
    let currentIndex = landmarks.indexOf(currentLandmarkId);
    if (currentIndex === -1) currentIndex = 0;

    let nextIndex = currentIndex + direction;
    if (nextIndex >= landmarks.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = landmarks.length - 1;

    const targetId = landmarks[nextIndex];
    if (targetId === 'main-content') {
        focusMainContentRegion();
        return;
    }

    const targetElement = document.getElementById(targetId);
    const fallbackMap = {
        'top-tabs': 'Navigation tablist',
        dashboard: 'Dashboard',
        'lookup-tool': 'Accessibility Lookup Tool'
    };
    focusElementWithLabel(targetElement, fallbackMap[targetId] || 'Region');
}

export function navigateApplicationLandmarks(direction) {
    const normalizedDirection = Number(direction);
    if (normalizedDirection === 0 || Number.isNaN(normalizedDirection)) return false;
    navigateLandmarks(normalizedDirection > 0 ? 1 : -1);
    return true;
}

function activateTabAndFocusHeading(tabId, headingId, fallbackLabel) {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    tab.click();
    notifyPanelChanged(panelNameMap[tabId] || fallbackLabel || 'Welcome');
    window.setTimeout(() => {
        const heading = document.getElementById(headingId);
        if (heading) {
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus();
            const label = heading.textContent?.trim() || fallbackLabel;
            if (label && label !== lastLandmarkAnnouncement) {
                announce(label);
                lastLandmarkAnnouncement = label;
            }
        }
    }, 0);
}

export function activateTabCommand(tabId, headingId, fallbackLabel) {
    activateTabAndFocusHeading(tabId, headingId, fallbackLabel);
    return true;
}

function clickElementById(id) {
    const element = document.getElementById(id);
    if (!element) return false;
    element.click();
    return true;
}

function activateLookupCopyButton(mode) {
    const lookup = document.getElementById('lookup-tool');
    if (!lookup) return false;

    const focused = document.activeElement;
    const detailRoot = focused?.closest?.('details') || lookup.querySelector('details[open]') || lookup.querySelector('details');
    if (!detailRoot) return false;

    const buttons = Array.from(detailRoot.querySelectorAll('.copy-btn'));
    if (!buttons.length) return false;

    const button = buttons.find((candidate) => candidate.getAttribute('data-copy-action') === mode) || null;
    if (!button) return false;
    button.click();
    return true;
}

function closeActiveSessionFromShortcut() {
    const closeReportButton = document.getElementById('btn-close-active-report');
    if (closeReportButton && !closeReportButton.disabled) {
        closeReportButton.click();
        return true;
    }

    const templateSelect = document.getElementById('template-selection');
    if (templateSelect && templateSelect.value && templateSelect.value !== 'scratch') {
        closeCurrentReportSession();
        templateSelect.value = 'scratch';
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
        announce('Closed template selection.');
        const welcomeTab = document.getElementById('tab-welcome');
        welcomeTab?.click();
        return true;
    }

    if (appState.templateCreateMode || appState.templateEditingId || String(appState.templateName || '').trim()) {
        closeCurrentReportSession();
        if (templateSelect) {
            templateSelect.value = 'scratch';
            templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        announce('Closed template session.');
        const welcomeTab = document.getElementById('tab-welcome');
        welcomeTab?.click();
        return true;
    }

    return false;
}

function getCommandIdForAction(action) {
    const matches = commandRegistry.findCommands({ action });
    return matches[0]?.id || '';
}

function executeShortcutCommand(action, event) {
    const commandId = getCommandIdForAction(action);
    if (!commandId) return false;

    void commandExecutionService.executeCommand(commandId, {
        invocation: 'keyboard-shortcut',
        action,
        shortcut: eventToShortcut(event),
        triggerEvent: event,
        activeElement: document.activeElement
    });
    return true;
}

export function closeActiveSession() {
    return closeActiveSessionFromShortcut();
}

export function initNavigation() {
    if (navigationInitialized) return;
    navigationInitialized = true;

    applyShortcutTooltips();
    watchShortcutTargets();

    window.addEventListener('art-shortcuts-updated', () => {
        applyShortcutTooltips();
        window.dispatchEvent(new Event('art-shortcuts-render'));
    });

    window.addEventListener('keydown', (e) => {
        const spellDialog = document.getElementById('editor-spellcheck-dialog');
        if (spellDialog && !spellDialog.hidden && spellDialog.contains(e.target)) return;

        if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                const didRedo = redoState();
                if (didRedo) {
                    const activeTab = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
                    const renderFn = activeTab ? renderMap[activeTab.id] : null;
                    if (renderFn) renderFn();
                }
            } else {
                const didUndo = undoState();
                if (didUndo) {
                    const activeTab = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
                    const renderFn = activeTab ? renderMap[activeTab.id] : null;
                    if (renderFn) renderFn();
                }
            }
            return;
        }

        const action = findShortcutAction(e);
        if (!action) return;

        const isRegisteredShortcutAction = action === 'newReportFromTemplate'
            || action === 'exportReport'
            || Boolean(getCommandIdForAction(action));
        if (!isRegisteredShortcutAction) return;

        e.preventDefault();
        executeShortcutCommand(action, e);
    }, true);
}

export function initNavListener() {
    initNavigation();
}

export function setupTabs() {
    const tabs = document.querySelectorAll('#top-tabs button[role="tab"]');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((btn) => btn.setAttribute('aria-selected', 'false'));
            tab.setAttribute('aria-selected', 'true');

            notifyPanelChanged(panelNameMap[tab.id] || 'Welcome');

            const renderFn = renderMap[tab.id];
            if (renderFn) renderFn();
        });
    });

    const selected = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
    if (selected) {
        notifyPanelChanged(panelNameMap[selected.id] || 'Welcome');
    }
}
