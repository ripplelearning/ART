// quickOpenFramework.js
import { announce, getRecentItems, recordRecentItem, clearRecentItems, removeRecentItem, appState } from './state.js';
import { createSearchResultsController } from './searchResultsFramework.js';
import {
    executeUniversalSearchResult,
    getUniversalSearchScopeLabel,
    getUniversalSearchScopeOptions,
    runUniversalSearch
} from './universalSearchFramework.js';

// Quick Open targets resources the user opens, not commands or reference material.
const QUICK_OPEN_PROVIDER_IDS = [
    'reports',
    'report-content',
    'templates',
    'project-workspaces',
    'project-assets',
    'resource-organization',
    'presentation-resources',
    'plugins-packages'
];

const RESOURCE_TYPE_LABELS = {
    report: 'Report',
    'report-field': 'Report Field',
    finding: 'Finding',
    template: 'Template',
    workspace: 'Project Workspace',
    asset: 'Project Asset',
    'resource-saved-view': 'Working View',
    'resource-collection': 'Collection',
    'resource-tag': 'Tag',
    plugin: 'Plugin',
    package: 'Package',
    'presentation-layout': 'Report Layout',
    'presentation-theme': 'Report Theme',
    'presentation-branding': 'Report Branding',
    'presentation-publishing-profile': 'Publishing Profile'
};

let quickOpenState = null;

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

function getResourceTypeLabel(type) {
    const normalized = normalizeText(type);
    return RESOURCE_TYPE_LABELS[normalized]
        || normalized.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
        || 'Resource';
}

function ensureQuickOpenElements() {
    if (quickOpenState?.dialog instanceof HTMLElement) return quickOpenState;

    let dialog = document.getElementById('quick-open-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'quick-open-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'quick-open-heading');
        dialog.hidden = true;
        dialog.className = 'command-palette-dialog';
        dialog.innerHTML = `
            <div class="command-palette-header">
                <button id="btn-quick-open-close" type="button">Close</button>
                <h2 id="quick-open-heading">Quick Open</h2>
            </div>
            <p id="quick-open-description">Open a report, workspace, working view, finding, template, or other ART resource.</p>
            <label for="quick-open-scope">Quick Open scope</label>
            <select id="quick-open-scope" aria-describedby="quick-open-status"></select>
            <label for="quick-open-input">Quick Open</label>
            <input id="quick-open-input" type="search" autocomplete="off" spellcheck="false" aria-controls="quick-open-results" aria-describedby="quick-open-status quick-open-suggestion-hint" />
            <p id="quick-open-suggestion-hint" class="command-palette-helper">Press Down Arrow to review results.</p>
            <p id="quick-open-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div id="quick-open-results" role="listbox" aria-label="Quick Open results"></div>
            <button id="btn-quick-open-broaden" type="button" hidden>Search all ART content instead</button>
            <div class="viewer-dialog-actions" role="group" aria-label="Quick Open actions">
                <button id="btn-quick-open-remove-recent" type="button">Remove From Recent</button>
                <button id="btn-quick-open-clear-recent" type="button">Clear Recent Items</button>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    const input = document.getElementById('quick-open-input');
    const results = document.getElementById('quick-open-results');
    const status = document.getElementById('quick-open-status');
    const scopeSelect = document.getElementById('quick-open-scope');
    const broadenButton = document.getElementById('btn-quick-open-broaden');
    const closeButton = document.getElementById('btn-quick-open-close');
    const clearRecentButton = document.getElementById('btn-quick-open-clear-recent');
    const removeRecentButton = document.getElementById('btn-quick-open-remove-recent');

    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return null;

    const controller = createSearchResultsController({
        container: results,
        statusElement: null,
        idPrefix: 'quick-open',
        listboxLabel: 'Quick Open results',
        itemClass: 'command-palette-option',
        itemActiveClass: 'command-palette-option--active',
        itemDisabledClass: 'command-palette-option--disabled',
        titleClass: 'command-palette-option-name',
        subtitleClass: 'command-palette-option-shortcut',
        descriptionClass: 'command-palette-option-description',
        emptyClass: 'command-palette-empty',
        emptyMessage: 'No matching resources found.',
        onActivate: (item) => activateQuickOpenItem(item),
        onSelectionChange: () => {
            input.setAttribute('aria-activedescendant', controller.getActiveOptionId() || '');
        }
    });

    quickOpenState = {
        dialog,
        input,
        results,
        status,
        scopeSelect,
        broadenButton,
        closeButton,
        clearRecentButton,
        removeRecentButton,
        controller,
        lastTrigger: null,
        scope: 'auto',
        announcedSuggestions: false,
        mode: 'quick-open'
    };

    if (!dialog.dataset.quickOpenBound) {
        dialog.dataset.quickOpenBound = 'true';

        closeButton?.addEventListener('click', () => closeQuickOpen(true));

        input.addEventListener('input', () => {
            refreshQuickOpenResults();
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeQuickOpen(true);
                return;
            }
            if (event.altKey && event.key === 'ArrowDown') {
                event.preventDefault();
                controller.setActiveIndex(0, { announce: true });
                return;
            }
            controller.handleKeydown(event);
        });

        dialog.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeQuickOpen(true);
        });

        scopeSelect?.addEventListener('change', () => {
            if (!quickOpenState) return;
            quickOpenState.scope = normalizeText(scopeSelect.value) || 'auto';
            announce(`Quick Open scope: ${getUniversalSearchScopeLabel(quickOpenState.scope)}.`);
            refreshQuickOpenResults();
        });

        broadenButton?.addEventListener('click', () => {
            if (!quickOpenState) return;
            quickOpenState.scope = 'workspace';
            if (quickOpenState.scopeSelect instanceof HTMLSelectElement) {
                quickOpenState.scopeSelect.value = 'workspace';
            }
            announce(`Quick Open scope: ${getUniversalSearchScopeLabel('workspace')}.`);
            refreshQuickOpenResults();
            quickOpenState.input?.focus();
        });

        clearRecentButton?.addEventListener('click', () => {
            clearRecentItems({ persist: true });
            announce('Recent items cleared.');
            refreshQuickOpenResults();
            quickOpenState?.input?.focus();
        });

        removeRecentButton?.addEventListener('click', () => {
            const active = controller.getActiveResult();
            const recentId = active?.recentItemId;
            if (!recentId) {
                announce('Select a recent item to remove.');
                return;
            }
            removeRecentItem(recentId, { persist: true });
            announce(`Removed ${active.title} from recent items.`);
            refreshQuickOpenResults();
            quickOpenState?.input?.focus();
        });
    }

    return quickOpenState;
}

function syncQuickOpenScopeOptions() {
    const state = quickOpenState;
    if (!state || !(state.scopeSelect instanceof HTMLSelectElement)) return;

    const options = getUniversalSearchScopeOptions()
        .filter((option) => ['current-report', 'current-project-workspace', 'workspace', 'reports'].includes(option.value));
    const markup = options
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join('');

    if (state.scopeSelect.dataset.optionSignature !== markup) {
        state.scopeSelect.innerHTML = markup;
        state.scopeSelect.dataset.optionSignature = markup;
    }

    const available = options.some((option) => option.value === state.scope);
    if (!available) state.scope = options[0]?.value || 'workspace';
    state.scopeSelect.value = state.scope;
}

function buildRecentItemResults() {
    return getRecentItems().map((item) => ({
        id: `recent:${item.id}`,
        title: item.title,
        subtitle: `${getResourceTypeLabel(item.resourceType)}${item.context ? ` | ${item.context}` : ''}`,
        description: 'Recently opened',
        recentItemId: item.id,
        recentItem: item
    }));
}

function refreshQuickOpenResults() {
    const state = quickOpenState;
    if (!state) return null;

    const query = normalizeText(state.input.value);
    const showRecent = !query;

    if (showRecent) {
        const recent = buildRecentItemResults();
        state.controller.setResults(recent);
        state.input.setAttribute('aria-activedescendant', state.controller.getActiveOptionId() || '');
        if (state.broadenButton) state.broadenButton.hidden = true;
        if (state.status) {
            state.status.textContent = recent.length > 0
                ? `${recent.length} recent item${recent.length === 1 ? '' : 's'}. Type to search resources.`
                : 'No recent items yet. Type to search resources.';
        }
        state.announcedSuggestions = false;
        return null;
    }

    let output = null;
    try {
        output = runUniversalSearch(query, {
            source: 'quick-open',
            scope: state.scope,
            providerIds: QUICK_OPEN_PROVIDER_IDS,
            limit: 40
        });
    } catch (error) {
        if (state.status) {
            state.status.textContent = 'Quick Open could not complete. Your text was kept so you can try again.';
        }
        return null;
    }

    const items = output.results.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: normalizeText(item.subtitle) || getResourceTypeLabel(item.type),
        description: item.description,
        disabled: item.disabled,
        result: item
    }));

    state.controller.setResults(items);
    state.input.setAttribute('aria-activedescendant', state.controller.getActiveOptionId() || '');

    const scopeLabel = getUniversalSearchScopeLabel(output.scope);
    const canBroaden = items.length === 0 && output.scope !== 'workspace';
    if (state.broadenButton) state.broadenButton.hidden = !canBroaden;

    if (state.status) {
        state.status.textContent = items.length === 0
            ? (canBroaden
                ? `No resources found in ${scopeLabel}. Use Search all ART content instead to broaden this search.`
                : `No resources found in ${scopeLabel}.`)
            : `${items.length} result${items.length === 1 ? '' : 's'} in ${scopeLabel}.`;
    }

    // Announce availability once per session so typing is not repeatedly interrupted.
    if (items.length > 0 && !state.announcedSuggestions) {
        state.announcedSuggestions = true;
        announce('Suggestions available.');
    }
    if (items.length === 0) state.announcedSuggestions = false;

    return output;
}

function activateQuickOpenItem(item) {
    if (!item) return false;

    const state = quickOpenState;
    const recentItem = item.recentItem || null;
    const searchResult = item.result || null;

    closeQuickOpen(false);

    if (recentItem) {
        // Recent entries store their original result payload so navigation targets stay stable.
        const payload = recentItem.payload || null;
        const opened = payload ? executeUniversalSearchResult(payload) : false;
        if (!opened) {
            announce(`${recentItem.title} is no longer available. Remove it from recent items or search for it again.`);
            if (state?.lastTrigger?.focus) state.lastTrigger.focus();
            return false;
        }
        recordRecentItem({
            resultId: recentItem.resultId,
            resourceType: recentItem.resourceType,
            title: recentItem.title,
            subtitle: recentItem.subtitle,
            context: recentItem.context,
            payload
        }, { persist: true });
        return true;
    }

    if (!searchResult) return false;

    const opened = executeUniversalSearchResult(searchResult);
    if (!opened) {
        announce(`${searchResult.title} could not be opened.`);
        if (state?.lastTrigger?.focus) state.lastTrigger.focus();
        return false;
    }

    recordRecentItem({
        resultId: searchResult.id,
        resourceType: searchResult.type,
        title: searchResult.title,
        subtitle: searchResult.subtitle,
        context: searchResult.providerName,
        scope: state?.scope || '',
        workspaceId: String(appState.activeWorkspaceId || ''),
        reportId: String(appState.selectedReportId || ''),
        payload: searchResult
    }, { persist: true });

    return true;
}

// The invoking surface may restore focus after opening, so confirm focus actually lands in the input.
function focusQuickOpenInput(attempt = 0) {
    const state = quickOpenState;
    if (!state || state.dialog.hidden) return;

    if (document.activeElement !== state.input) {
        state.input.focus();
        state.input.select();
    }

    if (attempt >= 10) return;
    window.setTimeout(() => focusQuickOpenInput(attempt + 1), 25);
}

export function openQuickOpen(trigger = null, options = {}) {
    const state = ensureQuickOpenElements();
    if (!state) return false;

    if (trigger) state.lastTrigger = trigger;
    state.mode = options.mode === 'recent' ? 'recent' : 'quick-open';
    state.scope = normalizeText(options.scope) || 'auto';
    state.announcedSuggestions = false;
    syncQuickOpenScopeOptions();

    const heading = document.getElementById('quick-open-heading');
    if (heading) heading.textContent = state.mode === 'recent' ? 'Recent Items' : 'Quick Open';

    state.dialog.hidden = false;
    state.input.value = normalizeText(options.query);
    refreshQuickOpenResults();

    focusQuickOpenInput();

    announce(state.mode === 'recent'
        ? 'Recent Items opened.'
        : `Quick Open opened. Scope: ${getUniversalSearchScopeLabel(state.scope)}.`);
    return true;
}

export function openRecentItemsDialog(trigger = null) {
    return openQuickOpen(trigger, { mode: 'recent' });
}

export function closeQuickOpen(restoreFocus = true) {
    const state = quickOpenState;
    if (!state) return false;

    state.dialog.hidden = true;
    state.controller.setResults([]);
    state.input.value = '';
    state.input.removeAttribute('aria-activedescendant');
    state.announcedSuggestions = false;

    if (restoreFocus && state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
        state.lastTrigger.focus();
    }
    return true;
}

export function clearRecentItemsFromCommand() {
    clearRecentItems({ persist: true });
    announce('Recent items cleared.');
    return true;
}
