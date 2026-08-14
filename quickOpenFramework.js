// quickOpenFramework.js
import {
    announce,
    getRecentItems,
    recordRecentItem,
    clearRecentItems,
    removeRecentItem,
    getFavoriteItems,
    isFavoriteResource,
    addFavoriteItem,
    removeFavoriteItem,
    getBookmarks,
    addBookmark,
    updateBookmark,
    removeBookmark,
    clearBookmarks,
    appState
} from './state.js';
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
                <button id="btn-quick-open-favorite" type="button">Add To Favorites</button>
                <button id="btn-quick-open-rename" type="button" hidden>Rename Bookmark</button>
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
    const favoriteButton = document.getElementById('btn-quick-open-favorite');
    const renameButton = document.getElementById('btn-quick-open-rename');

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
            syncFavoriteButton();
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
        favoriteButton,
        renameButton,
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
            if (quickOpenState?.mode === 'bookmarks') {
                const bookmarkId = active?.bookmark?.id;
                if (!bookmarkId) {
                    announce('Select a bookmark to remove.');
                    return;
                }
                removeBookmark(bookmarkId, { persist: true });
                announce(`Removed bookmark ${active.title}.`);
                refreshQuickOpenResults();
                quickOpenState?.input?.focus();
                return;
            }

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

        favoriteButton?.addEventListener('click', () => {
            toggleFavoriteForActiveResult();
        });

        renameButton?.addEventListener('click', () => {
            const active = controller.getActiveResult();
            const bookmark = active?.bookmark;
            if (!bookmark) {
                announce('Select a bookmark to rename.');
                return;
            }
            const nextName = normalizeText(window.prompt('Bookmark name:', bookmark.name));
            if (!nextName) return;
            updateBookmark(bookmark.id, { name: nextName }, { persist: true });
            announce(`Renamed bookmark to ${nextName}.`);
            refreshQuickOpenResults();
            quickOpenState?.input?.focus();
        });
    }

    return quickOpenState;
}

function getActiveResultIdentity() {
    const state = quickOpenState;
    const active = state?.controller.getActiveResult();
    if (!active) return null;

    const payload = active.result || active.recentItem?.payload || active.favorite?.payload || active.bookmark?.payload || null;
    const resultId = active.result?.id || active.recentItem?.resultId || active.favorite?.resultId || '';
    const resourceType = active.result?.type || active.recentItem?.resourceType || active.favorite?.resourceType || '';

    return {
        active,
        payload,
        resultId: String(resultId || ''),
        resourceType: String(resourceType || ''),
        title: String(active.title || ''),
        subtitle: String(active.subtitle || '')
    };
}

function syncFavoriteButton() {
    const state = quickOpenState;
    if (!state?.favoriteButton) return;

    const identity = getActiveResultIdentity();
    const isBookmarkMode = state.mode === 'bookmarks';
    state.favoriteButton.hidden = isBookmarkMode;
    if (isBookmarkMode) return;

    const favorited = Boolean(identity?.resultId) && isFavoriteResource(identity.resultId);
    const label = favorited ? 'Remove From Favorites' : 'Add To Favorites';
    if (state.favoriteButton.textContent !== label) state.favoriteButton.textContent = label;
    state.favoriteButton.disabled = !identity?.resultId;
}

function toggleFavoriteForActiveResult() {
    const identity = getActiveResultIdentity();
    if (!identity?.resultId) {
        announce('Select a resource to add to favorites.');
        return false;
    }

    if (isFavoriteResource(identity.resultId)) {
        removeFavoriteItem(identity.resultId, { persist: true });
        announce(`Removed ${identity.title} from favorites.`);
    } else {
        addFavoriteItem({
            resultId: identity.resultId,
            resourceType: identity.resourceType,
            title: identity.title,
            subtitle: identity.subtitle,
            context: identity.active?.result?.providerName || identity.active?.recentItem?.context || '',
            payload: identity.payload
        }, { persist: true });
        announce(`Added ${identity.title} to favorites.`);
    }

    refreshQuickOpenResults();
    quickOpenState?.input?.focus();
    return true;
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

function buildFavoriteResults() {
    return getFavoriteItems().map((item) => ({
        id: `favorite:${item.id}`,
        title: item.title,
        subtitle: `${getResourceTypeLabel(item.resourceType)}${item.context ? ` | ${item.context}` : ''}`,
        description: 'Favorite',
        favorite: item,
        resultId: item.resultId
    }));
}

function buildBookmarkResults() {
    return getBookmarks().map((item) => ({
        id: `bookmark:${item.id}`,
        title: item.name,
        subtitle: item.context || getResourceTypeLabel(item.targetType),
        description: item.description || 'Bookmarked location',
        bookmark: item
    }));
}

function filterListItems(items, query) {
    const normalized = query.toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.title} ${item.subtitle} ${item.description}`.toLowerCase().includes(normalized));
}

function refreshQuickOpenResults() {
    const state = quickOpenState;
    if (!state) return null;

    const query = normalizeText(state.input.value);

    if (state.mode === 'favorites' || state.mode === 'bookmarks') {
        const all = state.mode === 'favorites' ? buildFavoriteResults() : buildBookmarkResults();
        const items = filterListItems(all, query);
        state.controller.setResults(items);
        state.input.setAttribute('aria-activedescendant', state.controller.getActiveOptionId() || '');
        if (state.broadenButton) state.broadenButton.hidden = true;
        const noun = state.mode === 'favorites' ? 'favorite' : 'bookmark';
        if (state.status) {
            state.status.textContent = items.length > 0
                ? `${items.length} ${noun}${items.length === 1 ? '' : 's'}.`
                : (all.length === 0 ? `No ${noun}s yet.` : `No ${noun}s match your filter.`);
        }
        syncFavoriteButton();
        return null;
    }

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
        syncFavoriteButton();
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

    const favoriteIds = new Set(getFavoriteItems().map((item) => item.resultId).filter(Boolean));
    // Favorites get a modest boost but never displace a stronger match.
    const ranked = [...output.results].sort((left, right) => {
        const leftScore = Number(left.score || 0) - (favoriteIds.has(left.id) ? 0.25 : 0);
        const rightScore = Number(right.score || 0) - (favoriteIds.has(right.id) ? 0.25 : 0);
        return leftScore - rightScore;
    });

    const items = ranked.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: `${normalizeText(item.subtitle) || getResourceTypeLabel(item.type)}${favoriteIds.has(item.id) ? ' | Favorite' : ''}`,
        description: item.description,
        disabled: item.disabled,
        result: item
    }));

    state.controller.setResults(items);
    state.input.setAttribute('aria-activedescendant', state.controller.getActiveOptionId() || '');
    syncFavoriteButton();

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
    const favorite = item.favorite || null;
    const bookmark = item.bookmark || null;
    const searchResult = item.result || null;

    closeQuickOpen(false);

    const openStoredTarget = (stored, label, unavailableMessage) => {
        const payload = stored?.payload || null;
        const opened = payload ? executeUniversalSearchResult(payload) : false;
        if (!opened) {
            announce(unavailableMessage);
            if (state?.lastTrigger?.focus) state.lastTrigger.focus();
            return false;
        }
        recordRecentItem({
            resultId: stored.resultId || payload.id || '',
            resourceType: stored.resourceType || payload.type || '',
            title: label,
            subtitle: stored.subtitle || '',
            context: stored.context || '',
            payload
        }, { persist: true });
        return true;
    };

    if (recentItem) {
        return openStoredTarget(
            recentItem,
            recentItem.title,
            `${recentItem.title} is no longer available. Remove it from recent items or search for it again.`
        );
    }

    if (favorite) {
        return openStoredTarget(
            favorite,
            favorite.title,
            `${favorite.title} is no longer available. Remove it from favorites or search for it again.`
        );
    }

    if (bookmark) {
        const payload = bookmark.payload || null;
        const opened = payload ? executeUniversalSearchResult(payload) : false;
        if (!opened) {
            announce(`The bookmarked location ${bookmark.name} is no longer available. Remove the bookmark or create a new one.`);
            if (state?.lastTrigger?.focus) state.lastTrigger.focus();
            return false;
        }
        announce(`Opened bookmark ${bookmark.name}.`);
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
    const requestedMode = normalizeText(options.mode);
    state.mode = ['recent', 'favorites', 'bookmarks'].includes(requestedMode) ? requestedMode : 'quick-open';
    state.scope = normalizeText(options.scope) || 'auto';
    state.announcedSuggestions = false;
    syncQuickOpenScopeOptions();

    const heading = document.getElementById('quick-open-heading');
    if (heading) {
        heading.textContent = state.mode === 'recent'
            ? 'Recent Items'
            : state.mode === 'favorites'
                ? 'Favorites'
                : state.mode === 'bookmarks'
                    ? 'Bookmarks'
                    : 'Quick Open';
    }

    const listMode = state.mode === 'favorites' || state.mode === 'bookmarks';
    if (state.scopeSelect) state.scopeSelect.hidden = listMode;
    const scopeLabelElement = document.querySelector('label[for="quick-open-scope"]');
    if (scopeLabelElement) scopeLabelElement.hidden = listMode;
    if (state.removeRecentButton) {
        state.removeRecentButton.hidden = state.mode === 'favorites';
        state.removeRecentButton.textContent = state.mode === 'bookmarks' ? 'Remove Bookmark' : 'Remove From Recent';
    }
    if (state.renameButton) state.renameButton.hidden = state.mode !== 'bookmarks';
    if (state.clearRecentButton) state.clearRecentButton.hidden = state.mode !== 'recent' && state.mode !== 'quick-open';

    state.dialog.hidden = false;
    state.input.value = normalizeText(options.query);
    refreshQuickOpenResults();

    focusQuickOpenInput();

    announce(state.mode === 'recent'
        ? 'Recent Items opened.'
        : state.mode === 'favorites'
            ? 'Favorites opened.'
            : state.mode === 'bookmarks'
                ? 'Bookmarks opened.'
                : `Quick Open opened. Scope: ${getUniversalSearchScopeLabel(state.scope)}.`);
    return true;
}

export function openRecentItemsDialog(trigger = null) {
    return openQuickOpen(trigger, { mode: 'recent' });
}

export function openFavoritesDialog(trigger = null) {
    return openQuickOpen(trigger, { mode: 'favorites' });
}

export function openBookmarksDialog(trigger = null) {
    return openQuickOpen(trigger, { mode: 'bookmarks' });
}

function getActivePanelDescriptor() {
    const tabs = [
        ['tab-builder', 'builder-heading', 'Report Builder'],
        ['tab-editor', 'editor-heading', 'Report Editor'],
        ['tab-view', 'viewer-heading', 'Report Viewer'],
        ['tab-welcome', 'welcome-heading', 'Welcome']
    ];
    const selected = tabs.find(([tabId]) => document.getElementById(tabId)?.getAttribute('aria-selected') === 'true');
    const [tabId, headingId, label] = selected || tabs[0];
    return { tabId, headingId, label };
}

// Bookmarks reuse search navigation payloads so a location resolves the same way a search result does.
export function captureCurrentLocation(sourceElement = null) {
    const panel = getActivePanelDescriptor();
    const reportName = normalizeText(appState.reportTitle) || 'Current Report';

    // Prefer the element focused before a command surface opened, since dialogs take focus.
    const candidate = sourceElement instanceof HTMLElement ? sourceElement : document.activeElement;
    const active = candidate instanceof HTMLElement
        && !candidate.closest('#command-palette-dialog, #quick-open-dialog, #search-everywhere-dialog, #menu-bar')
        ? candidate
        : null;

    const entryIndex = Number(active?.dataset?.entryIndex);
    const fieldIndex = Number(active?.dataset?.fieldIndex);
    if (Number.isInteger(entryIndex) && Number.isInteger(fieldIndex)) {
        const fields = Array.isArray(appState.fields) ? appState.fields : [];
        const fieldLabel = normalizeText(fields[fieldIndex]?.label) || `Field ${fieldIndex + 1}`;
        return {
            name: `${fieldLabel} — Finding ${entryIndex + 1} — ${reportName}`,
            targetType: 'finding',
            context: `${panel.label} | ${reportName}`,
            payload: {
                id: `finding:${entryIndex}:${fieldIndex}`,
                type: 'finding',
                title: fieldLabel,
                raw: { entryIndex, fieldIndex, fieldLabel }
            }
        };
    }

    const builderFieldIndex = Number(active?.dataset?.fieldIndex);
    if (panel.tabId === 'tab-builder' && Number.isInteger(builderFieldIndex)) {
        const fields = Array.isArray(appState.fields) ? appState.fields : [];
        const fieldLabel = normalizeText(fields[builderFieldIndex]?.label) || `Field ${builderFieldIndex + 1}`;
        return {
            name: `${fieldLabel} — Field Configuration — ${reportName}`,
            targetType: 'report-field',
            context: `${panel.label} | ${reportName}`,
            payload: {
                id: `report-field:${builderFieldIndex}`,
                type: 'report-field',
                title: fieldLabel,
                raw: { fieldIndex: builderFieldIndex }
            }
        };
    }

    return {
        name: `${panel.label}${reportName && panel.tabId !== 'tab-welcome' ? ` — ${reportName}` : ''}`,
        targetType: 'panel',
        context: panel.label,
        payload: {
            id: `panel:${panel.tabId}`,
            type: 'panel',
            title: panel.label,
            raw: { tabId: panel.tabId, headingId: panel.headingId }
        }
    };
}

export function addBookmarkForCurrentLocation(options = {}) {
    const location = captureCurrentLocation(options.sourceElement);
    if (!location?.payload) {
        announce('This location cannot be bookmarked.');
        return false;
    }

    // The generated name is meaningful on its own; renaming stays available in the Bookmarks list.
    const name = normalizeText(options.name) || location.name;
    if (!name) return false;

    const added = addBookmark({
        name,
        description: normalizeText(options.description),
        targetType: location.targetType,
        context: location.context,
        workspaceId: String(appState.activeWorkspaceId || ''),
        reportId: String(appState.selectedReportId || ''),
        payload: location.payload
    }, { persist: true });

    if (!added) return false;
    announce(`Bookmarked ${name}.`);
    return true;
}

export function addActiveResourceToFavorites(options = {}) {
    const location = captureCurrentLocation(options.sourceElement);
    if (!location?.payload) return false;

    if (isFavoriteResource(location.payload.id)) {
        announce(`${location.payload.title} is already in favorites.`);
        return false;
    }

    addFavoriteItem({
        resultId: location.payload.id,
        resourceType: location.payload.type,
        title: location.payload.title || location.name,
        subtitle: location.context,
        context: location.context,
        payload: location.payload
    }, { persist: true });
    announce(`Added ${location.payload.title || location.name} to favorites.`);
    return true;
}

export function removeActiveResourceFromFavorites(options = {}) {
    const location = captureCurrentLocation(options.sourceElement);
    if (!location?.payload) return false;

    const removed = removeFavoriteItem(location.payload.id, { persist: true });
    if (!removed) {
        announce('This resource is not in favorites.');
        return false;
    }
    announce(`Removed ${location.payload.title || location.name} from favorites.`);
    return true;
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

export function clearBookmarksFromCommand() {
    clearBookmarks({ persist: true });
    announce('Bookmarks cleared.');
    return true;
}
