// navigation.js
import { announce, appState, redoState, saveState, undoState } from './state.js';
import { renderBuilder } from './reportBuilder.js';
import { activateAddEntryWorkflow, renderEditor } from './reportEditor.js';
import { renderViewer } from './reportViewer.js';
import { renderWelcome } from './welcome.js';

const landmarks = ['nav', 'dashboard', 'main-content', 'lookup-tool'];
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
    { id: 'tab-builder', shortcut: 'Alt+Shift+U', label: 'Builder tab' },
    { id: 'tab-editor', shortcut: 'Alt+Shift+E', label: 'Editor tab' },
    { id: 'btn-add-entry', shortcut: 'Alt+Shift+A', label: 'Add entry' },
    { id: 'btn-add-field', shortcut: 'Alt+Shift+F', label: 'Add field' },
    { id: 'btn-done', shortcut: 'Alt+Shift+O', label: 'Done' },
    { id: 's', shortcut: 'Alt+Shift+L', label: 'WCAG search' },
    { id: 'reset-btn', shortcut: 'Alt+Shift+D', label: 'Reset tool' },
    { id: 'btn-open-report', shortcut: 'Ctrl+O', label: 'Open existing report JSON file' }
];

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
    shortcutControlMap.forEach(({ id, shortcut, label }) => {
        const element = document.getElementById(id);
        if (element) applyShortcutTooltip(element, shortcut, label);
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
    let currentIndex = landmarks.findIndex((id) => activeEl?.closest?.(`#${id}`));
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
        nav: 'Navigation',
        dashboard: 'Dashboard',
        'lookup-tool': 'WCAG Lookup Tool'
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

export function initNavigation() {
    applyShortcutTooltips();
    watchShortcutTargets();

    window.addEventListener('keydown', (e) => {
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

        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            navigateLandmarks(direction);
            return;
        }

        if (!e.altKey || !e.shiftKey || e.ctrlKey) return;

        const key = e.key.toLowerCase();
        if (key === 'n') {
            e.preventDefault();
            focusElementWithLabel(document.querySelector('#top-tabs [role="tab"][aria-selected="true"]') || document.getElementById('top-tabs'), 'Navigation');
            return;
        }
        if (key === 's') {
            e.preventDefault();
            focusElementWithLabel(document.getElementById('dashboard'), 'Dashboard');
            notifyPanelChanged('Dashboard');
            return;
        }
        if (key === 'u') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-builder', 'builder-heading', 'Report Builder');
            return;
        }
        if (key === 'e') {
            e.preventDefault();
            activateTabAndFocusHeading('tab-editor', 'editor-heading', 'Report Editor');
            return;
        }
        if (key === 'l') {
            e.preventDefault();
            const search = document.getElementById('s');
            if (search) search.focus();
            notifyPanelChanged('WCAG Lookup Tool');
            return;
        }
        if (key === 'f') {
            e.preventDefault();
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
        if (key === 'a') {
            e.preventDefault();
            if (!activateAddEntryWorkflow()) return;
            appState.editorReadOnly = false;
            saveState({ action: 'Opened add entry workflow', recordHistory: false });
            const tab = document.getElementById('tab-editor');
            if (tab) tab.click();
            return;
        }
        if (key === 'o') {
            e.preventDefault();
            const tab = document.getElementById('tab-builder');
            if (tab) tab.click();
            window.setTimeout(() => {
                document.getElementById('btn-done')?.click();
            }, 0);
        }
    });
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
