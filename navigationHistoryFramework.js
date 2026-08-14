// navigationHistoryFramework.js
import {
    announce,
    appState,
    getNavigationHistory,
    updateNavigationHistory,
    clearNavigationHistoryEntries
} from './state.js';
import { executeUniversalSearchResult } from './universalSearchFramework.js';
import { createSearchResultsController } from './searchResultsFramework.js';

const PANEL_DESCRIPTORS = {
    'tab-welcome': { headingId: 'welcome-heading', label: 'Welcome' },
    'tab-builder': { headingId: 'builder-heading', label: 'Report Builder' },
    'tab-editor': { headingId: 'editor-heading', label: 'Report Editor' },
    'tab-view': { headingId: 'viewer-heading', label: 'Report Viewer' }
};

let frameworkInitialized = false;
let historyDialogState = null;
// Set while Back, Forward, or a history entry is navigating so the resulting event is not recorded again.
let restoringNavigation = false;

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

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getActiveTabId() {
    const selected = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
    return selected?.id || 'tab-welcome';
}

function getActiveWorkspaceName() {
    const workspaces = Array.isArray(appState.workspaces) ? appState.workspaces : [];
    const active = workspaces.find((workspace) => workspace.id === appState.activeWorkspaceId);
    return normalizeText(active?.name);
}

function buildBreadcrumbTrail(entry) {
    const trail = [];
    const workspaceName = getActiveWorkspaceName();
    if (workspaceName) {
        trail.push({ label: workspaceName, payload: null });
    }

    const reportName = normalizeText(appState.reportTitle);
    const targetType = normalizeText(entry?.targetType);
    const panelLabel = normalizeText(entry?.panelLabel);

    if (reportName && targetType !== 'panel-welcome') {
        trail.push({ label: reportName, payload: null });
    }

    if (panelLabel) {
        const tabId = normalizeText(entry?.tabId);
        const descriptor = PANEL_DESCRIPTORS[tabId];
        trail.push({
            label: panelLabel,
            payload: descriptor
                ? { id: `panel:${tabId}`, type: 'panel', title: panelLabel, raw: { tabId, headingId: descriptor.headingId } }
                : null
        });
    }

    if (entry?.detailLabel) {
        trail.push({ label: entry.detailLabel, payload: entry.payload || null });
    }

    return trail;
}

function renderBreadcrumbs() {
    const nav = document.getElementById('breadcrumb-nav');
    const list = document.getElementById('breadcrumb-list');
    if (!(nav instanceof HTMLElement) || !(list instanceof HTMLElement)) return;

    const history = getNavigationHistory();
    if (history.breadcrumbsEnabled === false) {
        nav.hidden = true;
        list.innerHTML = '';
        return;
    }

    const current = history.entries[history.currentIndex] || null;
    const trail = Array.isArray(current?.breadcrumbs) && current.breadcrumbs.length > 0
        ? current.breadcrumbs
        : buildBreadcrumbTrail({ panelLabel: PANEL_DESCRIPTORS[getActiveTabId()]?.label, tabId: getActiveTabId() });

    if (trail.length === 0) {
        nav.hidden = true;
        list.innerHTML = '';
        return;
    }

    const markup = trail.map((crumb, index) => {
        const isCurrent = index === trail.length - 1;
        const label = escapeHtml(crumb.label);
        if (isCurrent || !crumb.payload) {
            return `<li class="app-breadcrumb__item"><span${isCurrent ? ' aria-current="page"' : ''}>${label}</span></li>`;
        }
        return `<li class="app-breadcrumb__item"><button type="button" class="app-breadcrumb__link" data-breadcrumb-index="${index}">${label}</button></li>`;
    }).join('');

    if (list.dataset.signature !== markup) {
        list.innerHTML = markup;
        list.dataset.signature = markup;
        list.querySelectorAll('[data-breadcrumb-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.getAttribute('data-breadcrumb-index'));
                const crumb = trail[index];
                if (!crumb?.payload) return;
                restoringNavigation = true;
                const opened = executeUniversalSearchResult(crumb.payload);
                restoringNavigation = false;
                if (opened) announce(`Moved to ${crumb.label}.`);
            });
        });
    }

    nav.hidden = false;
}

function isSameLocation(left, right) {
    if (!left || !right) return false;
    const leftId = normalizeText(left.payload?.id) || normalizeText(left.label);
    const rightId = normalizeText(right.payload?.id) || normalizeText(right.label);
    return leftId === rightId;
}

export function recordNavigationLocation(entry) {
    if (restoringNavigation) return false;

    const history = getNavigationHistory();
    if (history.enabled === false) return false;

    const label = normalizeText(entry?.label);
    if (!label) return false;

    const nextEntry = {
        id: createId('navigation'),
        label,
        context: normalizeText(entry?.context),
        targetType: normalizeText(entry?.targetType),
        payload: entry?.payload || null,
        focusId: normalizeText(entry?.focusId),
        breadcrumbs: buildBreadcrumbTrail(entry),
        visitedAt: new Date().toISOString()
    };

    const currentEntry = history.entries[history.currentIndex] || null;
    if (isSameLocation(currentEntry, nextEntry)) {
        // Refresh the trail without creating a duplicate history step.
        const refreshed = [...history.entries];
        refreshed[history.currentIndex] = { ...currentEntry, breadcrumbs: nextEntry.breadcrumbs };
        updateNavigationHistory({ entries: refreshed }, { persist: false, eventType: 'navigation-history-refreshed' });
        renderBreadcrumbs();
        return false;
    }

    // A new navigation from mid-history discards the forward branch, matching browser behavior.
    const retained = history.entries.slice(0, history.currentIndex + 1);
    const entries = [...retained, nextEntry].slice(-history.maxEntries);

    updateNavigationHistory({
        entries,
        currentIndex: entries.length - 1
    }, {
        action: `Navigated to ${label}`,
        persist: true
    });

    renderBreadcrumbs();
    updateNavigationCommandState();
    return true;
}

function restoreEntry(entry) {
    if (!entry) return false;

    restoringNavigation = true;
    let navigated = false;

    if (entry.payload) {
        navigated = executeUniversalSearchResult(entry.payload);
    }

    restoringNavigation = false;

    if (!navigated) {
        announce(`${entry.label} is no longer available.`);
        return false;
    }

    announce(`Moved to ${entry.label}.`);
    renderBreadcrumbs();
    return true;
}

export function canNavigateBack() {
    const history = getNavigationHistory();
    return history.currentIndex > 0;
}

export function canNavigateForward() {
    const history = getNavigationHistory();
    return history.currentIndex >= 0 && history.currentIndex < history.entries.length - 1;
}

export function navigateBack() {
    const history = getNavigationHistory();
    if (history.currentIndex <= 0) {
        announce('No previous location.');
        return false;
    }

    const targetIndex = history.currentIndex - 1;
    const entry = history.entries[targetIndex];
    if (!restoreEntry(entry)) return false;

    updateNavigationHistory({ currentIndex: targetIndex }, {
        action: `Navigated back to ${entry.label}`,
        persist: true
    });
    renderBreadcrumbs();
    updateNavigationCommandState();
    return true;
}

export function navigateForward() {
    const history = getNavigationHistory();
    if (history.currentIndex < 0 || history.currentIndex >= history.entries.length - 1) {
        announce('No next location.');
        return false;
    }

    const targetIndex = history.currentIndex + 1;
    const entry = history.entries[targetIndex];
    if (!restoreEntry(entry)) return false;

    updateNavigationHistory({ currentIndex: targetIndex }, {
        action: `Navigated forward to ${entry.label}`,
        persist: true
    });
    renderBreadcrumbs();
    updateNavigationCommandState();
    return true;
}

export function clearNavigationHistoryFromCommand() {
    clearNavigationHistoryEntries({ persist: true });
    renderBreadcrumbs();
    updateNavigationCommandState();
    announce('Navigation history cleared. Favorites, bookmarks, and saved searches were not changed.');
    return true;
}

function updateNavigationCommandState() {
    window.dispatchEvent(new CustomEvent('art-navigation-availability-changed', {
        detail: { canGoBack: canNavigateBack(), canGoForward: canNavigateForward() }
    }));
}

function ensureHistoryDialog() {
    if (historyDialogState?.dialog instanceof HTMLElement) return historyDialogState;

    let dialog = document.getElementById('navigation-history-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'navigation-history-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'navigation-history-heading');
        dialog.hidden = true;
        dialog.className = 'command-palette-dialog';
        dialog.innerHTML = `
            <div class="command-palette-header">
                <button id="btn-navigation-history-close" type="button">Close</button>
                <h2 id="navigation-history-heading">Navigation History</h2>
            </div>
            <p id="navigation-history-description">Return to a location you visited earlier in this session.</p>
            <label for="navigation-history-filter">Filter navigation history</label>
            <input id="navigation-history-filter" type="search" autocomplete="off" spellcheck="false" aria-controls="navigation-history-results" aria-describedby="navigation-history-status">
            <p id="navigation-history-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div id="navigation-history-results" role="listbox" aria-label="Navigation history entries"></div>
            <div class="viewer-dialog-actions" role="group" aria-label="Navigation history actions">
                <button id="btn-navigation-history-clear" type="button">Clear Navigation History</button>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    const input = document.getElementById('navigation-history-filter');
    const results = document.getElementById('navigation-history-results');
    const status = document.getElementById('navigation-history-status');
    const closeButton = document.getElementById('btn-navigation-history-close');
    const clearButton = document.getElementById('btn-navigation-history-clear');

    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return null;

    const controller = createSearchResultsController({
        container: results,
        statusElement: null,
        idPrefix: 'navigation-history',
        listboxLabel: 'Navigation history entries',
        itemClass: 'command-palette-option',
        itemActiveClass: 'command-palette-option--active',
        itemDisabledClass: 'command-palette-option--disabled',
        titleClass: 'command-palette-option-name',
        subtitleClass: 'command-palette-option-shortcut',
        descriptionClass: 'command-palette-option-description',
        emptyClass: 'command-palette-empty',
        emptyMessage: 'No navigation history entries.',
        onActivate: (item) => {
            const entry = item?.entry;
            if (!entry) return;
            closeNavigationHistory(false);
            if (restoreEntry(entry)) {
                const history = getNavigationHistory();
                const index = history.entries.findIndex((candidate) => candidate.id === entry.id);
                if (index >= 0) {
                    updateNavigationHistory({ currentIndex: index }, { action: `Navigated to ${entry.label}`, persist: true });
                    updateNavigationCommandState();
                }
                renderBreadcrumbs();
            }
        },
        onSelectionChange: () => {
            input.setAttribute('aria-activedescendant', controller.getActiveOptionId() || '');
        }
    });

    historyDialogState = { dialog, input, results, status, controller, lastTrigger: null };

    if (!dialog.dataset.navigationHistoryBound) {
        dialog.dataset.navigationHistoryBound = 'true';

        closeButton?.addEventListener('click', () => closeNavigationHistory(true));
        input.addEventListener('input', () => refreshHistoryDialog());
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeNavigationHistory(true);
                return;
            }
            controller.handleKeydown(event);
        });
        dialog.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeNavigationHistory(true);
        });
        clearButton?.addEventListener('click', () => {
            clearNavigationHistoryFromCommand();
            refreshHistoryDialog();
            historyDialogState?.input?.focus();
        });
    }

    return historyDialogState;
}

function refreshHistoryDialog() {
    const state = historyDialogState;
    if (!state) return;

    const history = getNavigationHistory();
    const filter = normalizeText(state.input.value).toLowerCase();
    const items = [...history.entries]
        .map((entry, index) => ({ entry, index }))
        .reverse()
        .filter(({ entry }) => !filter || `${entry.label} ${entry.context}`.toLowerCase().includes(filter))
        .map(({ entry, index }) => ({
            id: `navigation-history:${entry.id}`,
            title: entry.label,
            subtitle: entry.context || '',
            description: index === history.currentIndex ? 'Current location' : '',
            entry
        }));

    state.controller.setResults(items);
    state.input.setAttribute('aria-activedescendant', state.controller.getActiveOptionId() || '');
    if (state.status) {
        state.status.textContent = items.length > 0
            ? `${items.length} location${items.length === 1 ? '' : 's'}, most recent first.`
            : (history.entries.length === 0 ? 'No navigation history yet.' : 'No locations match your filter.');
    }
}

export function openNavigationHistory(trigger = null) {
    const state = ensureHistoryDialog();
    if (!state) return false;

    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    state.input.value = '';
    refreshHistoryDialog();

    const focusInput = (attempt = 0) => {
        if (state.dialog.hidden) return;
        if (document.activeElement !== state.input) state.input.focus();
        if (attempt >= 10) return;
        window.setTimeout(() => focusInput(attempt + 1), 25);
    };
    focusInput();

    announce('Navigation History opened.');
    return true;
}

export function closeNavigationHistory(restoreFocus = true) {
    const state = historyDialogState;
    if (!state) return false;

    state.dialog.hidden = true;
    state.controller.setResults([]);
    state.input.value = '';
    state.input.removeAttribute('aria-activedescendant');

    if (restoreFocus && state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
        state.lastTrigger.focus();
    }
    return true;
}

export function initNavigationHistoryFramework() {
    if (frameworkInitialized) return true;
    frameworkInitialized = true;

    window.addEventListener('art-panel-changed', (event) => {
        const panelName = normalizeText(event.detail?.panel);
        const tabId = getActiveTabId();
        const descriptor = PANEL_DESCRIPTORS[tabId];
        if (!descriptor) return;

        recordNavigationLocation({
            label: panelName || descriptor.label,
            context: getActiveWorkspaceName() || normalizeText(appState.reportTitle),
            targetType: tabId === 'tab-welcome' ? 'panel-welcome' : 'panel',
            panelLabel: descriptor.label,
            tabId,
            payload: {
                id: `panel:${tabId}`,
                type: 'panel',
                title: descriptor.label,
                raw: { tabId, headingId: descriptor.headingId }
            }
        });
    });

    window.addEventListener('art-navigation-performed', (event) => {
        const detail = event.detail || {};
        const payload = detail.payload;
        if (!payload || payload.type === 'command') return;

        const tabId = getActiveTabId();
        const descriptor = PANEL_DESCRIPTORS[tabId];

        recordNavigationLocation({
            label: normalizeText(detail.title) || normalizeText(payload.title),
            context: normalizeText(detail.context),
            targetType: normalizeText(detail.type),
            detailLabel: payload.type === 'panel' ? '' : normalizeText(payload.title),
            panelLabel: descriptor?.label || '',
            tabId,
            payload
        });
    });

    window.addEventListener('art-reports-updated', () => renderBreadcrumbs());
    window.addEventListener('art-navigation-history-updated', () => renderBreadcrumbs());

    // Seed the starting location so Back is available after the first navigation.
    const initialTabId = getActiveTabId();
    const initialDescriptor = PANEL_DESCRIPTORS[initialTabId];
    if (initialDescriptor) {
        recordNavigationLocation({
            label: initialDescriptor.label,
            context: getActiveWorkspaceName(),
            targetType: initialTabId === 'tab-welcome' ? 'panel-welcome' : 'panel',
            panelLabel: initialDescriptor.label,
            tabId: initialTabId,
            payload: {
                id: `panel:${initialTabId}`,
                type: 'panel',
                title: initialDescriptor.label,
                raw: { tabId: initialTabId, headingId: initialDescriptor.headingId }
            }
        });
    }

    renderBreadcrumbs();
    updateNavigationCommandState();
    return true;
}
