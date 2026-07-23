// navigation.js
import { announce, appState, getShortcutForAction, redoState, saveState, undoState } from './state.js';
import { renderBuilder } from './reportBuilder.js';
import { activateAddEntryWorkflow, renderEditor } from './reportEditor.js';
import { requestViewerExportDialog, renderViewer } from './reportViewer.js';
import { renderWelcome } from './welcome.js';
import { openHelpDialog } from './help.js';

const landmarks = ['top-tabs', 'dashboard', 'main-content', 'lookup-tool'];
const renderMap = {
    'tab-welcome': renderWelcome,
    'tab-builder': renderBuilder,
    'tab-editor': renderEditor,
    'tab-view': renderViewer
};

let lastLandmarkAnnouncement = '';
let shortcutObserver = null;

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
    { id: 'btn-editor-progress-log', action: 'openProgressLog', label: 'Open Progress Log' },
    { id: 'btn-add-entry', action: 'addEntry', label: 'Add entry' },
    { id: 'btn-editor-spell-check', action: 'spellCheck', label: 'Spell check' },
    { id: 'btn-add-field', action: 'addField', label: 'Add field' },
    { id: 'btn-done', action: 'done', label: 'Done' },
    { id: 's', action: 'focusLookup', label: 'WCAG search' },
    { id: 'reset-btn', action: 'resetLookup', label: 'Reset tool' },
    { id: 'btn-open-report', action: 'openProject', label: 'Open ART project file' },
    { id: 'btn-save-project', action: 'saveProject', label: 'Save ART project' },
    { id: 'btn-save-project-as', action: 'saveProjectAs', label: 'Save ART project as' },
    { id: 'btn-import-data', action: 'importData', label: 'Import data file' },
    { id: 'btn-import-data', action: 'openReport', label: 'Import report JSON file' },
    { id: 'btn-new-report', action: 'newReport', label: 'New report' },
    { id: 'btn-help', action: 'openHelp', label: 'Help' },
    { id: 'top-tabs', action: 'focusNavigation', label: 'Navigation tablist' },
    { id: 'btn-export-options', action: 'exportReport', label: 'Export report' },
    { id: 'btn-viewer-progress-log', action: 'openProgressLog', label: 'Open Progress Log' },
    { id: 'btn-settings-import-standard', action: 'settingsImportStandard', label: 'Import Accessibility Standard' },
    { id: 'btn-settings-paste-standard', action: 'settingsPasteStandardTable', label: 'Paste Standards As Table' },
    { id: 'btn-settings-import-report-file', action: 'settingsImportReportFile', label: 'Import Report File from Device' },
    { id: 'btn-settings-import-template-file', action: 'settingsImportTemplateFile', label: 'Import Template File from Device' },
    { id: 'btn-app-settings', action: 'settingsOpenIntegrations', label: 'Open Integrations Section' },
    { id: 'settings-privacy-mode', action: 'settingsTogglePrivacyMode', label: 'Toggle Privacy Mode' },
    { id: 'btn-settings-backup-now', action: 'settingsCreateBackup', label: 'Create Backup' }
];

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

function findShortcutAction(event) {
    const shortcut = eventToShortcut(event);
    if (!shortcut) return '';

    const entries = Object.entries(appState.shortcuts || {});
    const match = entries.find(([, configuredShortcut]) => String(configuredShortcut || '').trim().toLowerCase() === shortcut.toLowerCase());
    return match ? match[0] : '';
}

function ensureShortcutDescription(element, shortcut) {
    const describedById = `shortcut-desc-${element.id || Math.random().toString(36).slice(2)}`;
    let description = document.getElementById(describedById);
    if (!description) {
        description = document.createElement('span');
        description.id = describedById;
        description.className = 'sr-only';
        description.textContent = shortcut;
        element.insertAdjacentElement('afterend', description);
    }
    const describedBy = element.getAttribute('aria-describedby') || '';
    const tokens = describedBy.split(/\s+/).filter(Boolean);
    if (!tokens.includes(describedById)) {
        tokens.push(describedById);
        element.setAttribute('aria-describedby', tokens.join(' '));
    }
}

function applyShortcutTooltip(element, shortcut, label) {
    if (!element || element.dataset.shortcutTooltipBound === 'true') return;
    element.classList.add('shortcut-tooltip');
    element.dataset.shortcutHint = shortcut;
    element.setAttribute('title', shortcut);
    element.setAttribute('aria-keyshortcuts', shortcut);
    ensureShortcutDescription(element, shortcut);
    if (!element.getAttribute('aria-label') && label) {
        element.setAttribute('aria-label', `${label}. Shortcut: ${shortcut}`);
    }
    element.dataset.shortcutTooltipBound = 'true';
}

function applyShortcutTooltips() {
    shortcutControlMap.forEach(({ id, action, label }) => {
        const element = document.getElementById(id);
        const shortcut = getShortcutForAction(action);
        if (element && shortcut) applyShortcutTooltip(element, shortcut, label);
    });
}

function notifyPanelChanged(panel) {
    window.dispatchEvent(new CustomEvent('art-panel-changed', {
        detail: { panel }
    }));
}

function watchShortcutTargets() {
    if (shortcutObserver) return;
    shortcutObserver = new MutationObserver(() => applyShortcutTooltips());
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
        templateSelect.value = 'scratch';
        templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
        announce('Closed template selection.');
        return true;
    }

    return false;
}

export function initNavigation() {
    applyShortcutTooltips();
    watchShortcutTargets();

    window.addEventListener('art-shortcuts-updated', () => {
        applyShortcutTooltips();
        window.dispatchEvent(new Event('art-shortcuts-render'));
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            openHelpDialog(document.activeElement);
            return;
        }

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

        if (action === 'nextLandmark') {
            e.preventDefault();
            navigateLandmarks(1);
            return;
        }
        if (action === 'previousLandmark') {
            e.preventDefault();
            navigateLandmarks(-1);
            return;
        }
        if (action === 'focusNavigation') {
            e.preventDefault();
            focusElementWithLabel(document.querySelector('#top-tabs [role="tab"][aria-selected="true"]') || document.getElementById('top-tabs'), 'Navigation');
            return;
        }
        if (action === 'focusDashboard') {
            e.preventDefault();
            focusElementWithLabel(document.getElementById('dashboard'), 'Dashboard');
            notifyPanelChanged('Dashboard');
            return;
        }
        if (action === 'focusMainContent') {
            e.preventDefault();
            const main = document.getElementById('main-content');
            focusElementWithLabel(main, 'Main content');
            return;
        }
        if (action === 'openBuilder') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-builder', 'builder-heading', 'Report Builder');
            return;
        }
        if (action === 'openWelcome') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-welcome', 'welcome-heading', 'Welcome');
            return;
        }
        if (action === 'openHelp') {
            e.preventDefault();
            openHelpDialog(document.activeElement);
            return;
        }
        if (action === 'openEditor') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-editor', 'editor-heading', 'Report Editor');
            return;
        }
        if (action === 'openViewer') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-view', 'viewer-heading', 'Report Viewer');
            return;
        }
        if (action === 'openProgressLog') {
            e.preventDefault();
            if (clickElementById('btn-editor-progress-log')) return;
            clickElementById('btn-viewer-progress-log');
            return;
        }
        if (action === 'focusLookup') {
            e.preventDefault();
            const search = document.getElementById('s');
            if (search) search.focus();
            notifyPanelChanged('Accessibility Lookup Tool');
            return;
        }
        if (action === 'addField') {
            e.preventDefault();
            const inlineAddButton = document.getElementById('btn-add-field');
            if (inlineAddButton) {
                inlineAddButton.click();
                return;
            }

            const tab = document.getElementById('tab-builder');
            if (tab) tab.click();
            window.setTimeout(() => {
                if (!document.getElementById('btn-add-field')) {
                    document.getElementById('btn-toggle-config')?.click();
                    window.setTimeout(() => {
                        document.getElementById('btn-add-field')?.click();
                    }, 0);
                    return;
                }
                document.getElementById('btn-add-field')?.click();
            }, 0);
            return;
        }
        if (action === 'addEntry') {
            e.preventDefault();
            if (!activateAddEntryWorkflow()) return;
            appState.editorReadOnly = false;
            saveState({ action: 'Opened add entry workflow', recordHistory: false });
            const tab = document.getElementById('tab-editor');
            if (tab) tab.click();
            return;
        }
        if (action === 'done') {
            e.preventDefault();
            const tab = document.getElementById('tab-builder');
            if (tab) tab.click();
            window.setTimeout(() => {
                document.getElementById('btn-done')?.click();
            }, 0);
            return;
        }
        if (action === 'openReport') {
            e.preventDefault();
            document.getElementById('btn-import-data')?.click();
            return;
        }
        if (action === 'openProject') {
            e.preventDefault();
            document.getElementById('btn-open-report')?.click();
            return;
        }
        if (action === 'saveProject') {
            e.preventDefault();
            document.getElementById('btn-save-project')?.click();
            return;
        }
        if (action === 'saveProjectAs') {
            e.preventDefault();
            document.getElementById('btn-save-project-as')?.click();
            return;
        }
        if (action === 'importData') {
            e.preventDefault();
            document.getElementById('btn-import-data')?.click();
            return;
        }
        if (action === 'newReport') {
            e.preventDefault();
            document.getElementById('btn-new-report')?.click();
            return;
        }
        if (action === 'newReportFromTemplate') {
            e.preventDefault();
            const templateSelect = document.getElementById('template-selection');
            if (templateSelect) {
                const firstTemplate = [...templateSelect.options].find((option) => option.value && option.value !== 'scratch');
                if (firstTemplate) {
                    templateSelect.value = firstTemplate.value;
                    templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            document.getElementById('btn-template-use')?.click();
            return;
        }
        if (action === 'exportReport') {
            e.preventDefault();
            const viewerTab = document.getElementById('tab-view');
            if (viewerTab) viewerTab.click();
            requestViewerExportDialog();
            renderViewer();
            return;
        }
        if (action === 'resetLookup') {
            e.preventDefault();
            document.getElementById('reset-btn')?.click();
            return;
        }
        if (action === 'spellCheck') {
            e.preventDefault();
            const tab = document.getElementById('tab-editor');
            if (tab) tab.click();
            window.setTimeout(() => {
                clickElementById('btn-editor-spell-check');
            }, 0);
            return;
        }
        if (['copyEntry', 'copyName', 'copyDescription', 'copyFailures', 'copyFixes', 'copyLink'].includes(action)) {
            e.preventDefault();
            activateLookupCopyButton(action);
            return;
        }
        if (action === 'closeReport') {
            e.preventDefault();
            closeActiveSessionFromShortcut();
            return;
        }
        if (action === 'configureReport') {
            e.preventDefault();
            clickElementById('btn-configure-report');
            return;
        }
        if (action === 'editReport') {
            e.preventDefault();
            clickElementById('btn-edit-report-dashboard');
            return;
        }
        if (action === 'viewReport') {
            e.preventDefault();
            clickElementById('btn-view-report-dashboard');
            return;
        }
        if (action === 'deleteReport') {
            e.preventDefault();
            clickElementById('btn-delete-report-dashboard');
            return;
        }
        if (action === 'openSettings') {
            e.preventDefault();
            clickElementById('btn-app-settings');
            return;
        }
        if (action === 'settingsClose') {
            e.preventDefault();
            clickElementById('btn-settings-close');
            return;
        }
        if (action === 'settingsRestoreShortcuts') {
            e.preventDefault();
            clickElementById('btn-settings-shortcuts-reset');
            return;
        }
        if (action === 'settingsImportStandard') {
            e.preventDefault();
            clickElementById('btn-settings-import-standard');
            return;
        }
        if (action === 'settingsPasteStandardTable') {
            e.preventDefault();
            clickElementById('btn-settings-paste-standard');
            return;
        }
        if (action === 'settingsOpenIntegrations') {
            e.preventDefault();
            const integrationsHeading = document.getElementById('settings-integrations-heading');
            if (integrationsHeading) {
                integrationsHeading.scrollIntoView({ block: 'start' });
                if (!integrationsHeading.hasAttribute('tabindex')) integrationsHeading.setAttribute('tabindex', '-1');
                integrationsHeading.focus();
            }
            return;
        }
        if (action === 'settingsImportReportFile') {
            e.preventDefault();
            clickElementById('btn-settings-import-report-file');
            return;
        }
        if (action === 'settingsImportTemplateFile') {
            e.preventDefault();
            clickElementById('btn-settings-import-template-file');
            return;
        }
        if (action === 'settingsTogglePrivacyMode') {
            e.preventDefault();
            clickElementById('settings-privacy-mode');
            return;
        }
        if (action === 'settingsCreateBackup') {
            e.preventDefault();
            clickElementById('btn-settings-backup-now');
            return;
        }
        if (action === 'settingsResetApp') {
            e.preventDefault();
            clickElementById('btn-settings-reset-app');
            return;
        }
        if (action === 'settingsCloseReport') {
            e.preventDefault();
            closeActiveSessionFromShortcut();
            return;
        }
        if (action === 'newTemplate') {
            e.preventDefault();
            clickElementById('btn-template-create');
            return;
        }
        if (action === 'useTemplate') {
            e.preventDefault();
            clickElementById('btn-template-use');
            return;
        }
        if (action === 'openTemplate') {
            e.preventDefault();
            clickElementById('btn-template-open');
            return;
        }
        if (action === 'editTemplate') {
            e.preventDefault();
            clickElementById('btn-template-edit');
            return;
        }
        if (action === 'deleteTemplate') {
            e.preventDefault();
            clickElementById('btn-template-delete');
            return;
        }
        if (action === 'importTemplate') {
            e.preventDefault();
            clickElementById('btn-template-import');
            return;
        }
        if (action === 'exportTemplate') {
            e.preventDefault();
            clickElementById('btn-template-export');
        }
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
