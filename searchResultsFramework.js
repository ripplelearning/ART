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

function toResultItem(result, index) {
    const item = result && typeof result === 'object' ? result : {};
    return {
        id: normalizeText(item.id) || `search-result-${index + 1}`,
        title: normalizeText(item.title || item.label || item.name) || 'Untitled Result',
        subtitle: normalizeText(item.subtitle || item.meta || ''),
        description: normalizeText(item.description || ''),
        disabled: Boolean(item.disabled),
        raw: item
    };
}

export function createSearchResultsController(options = {}) {
    const container = options.container;
    const statusElement = options.statusElement || null;
    const idPrefix = normalizeText(options.idPrefix || 'search-results');
    const emptyMessage = normalizeText(options.emptyMessage || 'No matching results found.');
    const listboxLabel = normalizeText(options.listboxLabel || 'Search results');

    if (!(container instanceof HTMLElement)) {
        throw new Error('createSearchResultsController requires a valid container element.');
    }

    container.setAttribute('role', 'listbox');
    container.setAttribute('aria-label', listboxLabel);

    const classNames = {
        item: normalizeText(options.itemClass || 'search-results__item'),
        active: normalizeText(options.itemActiveClass || 'is-selected'),
        disabled: normalizeText(options.itemDisabledClass || 'is-disabled'),
        title: normalizeText(options.titleClass || 'search-results__title'),
        subtitle: normalizeText(options.subtitleClass || 'search-results__subtitle'),
        description: normalizeText(options.descriptionClass || 'search-results__description'),
        empty: normalizeText(options.emptyClass || 'search-results__empty')
    };

    const onActivate = typeof options.onActivate === 'function' ? options.onActivate : () => {};
    const onSelectionChange = typeof options.onSelectionChange === 'function' ? options.onSelectionChange : () => {};

    const state = {
        results: [],
        activeIndex: -1
    };

    function setStatus(message) {
        if (statusElement) {
            statusElement.textContent = String(message || '');
        }
    }

    function getOptionId(index) {
        return `${idPrefix}-option-${index}`;
    }

    function getOptionElement(index) {
        return container.querySelector(`[data-search-option-index="${index}"]`);
    }

    function render() {
        if (!state.results.length) {
            state.activeIndex = -1;
            container.innerHTML = `<p class="${classNames.empty}">${escapeHtml(emptyMessage)}</p>`;
            setStatus(emptyMessage);
            return;
        }

        container.innerHTML = state.results.map((result, index) => {
            const isSelected = index === state.activeIndex;
            const classes = [classNames.item];
            if (isSelected) classes.push(classNames.active);
            if (result.disabled) classes.push(classNames.disabled);

            return `
                <button
                    type="button"
                    id="${escapeHtml(getOptionId(index))}"
                    role="option"
                    data-search-option="true"
                    data-search-option-index="${index}"
                    aria-selected="${String(isSelected)}"
                    aria-disabled="${String(result.disabled)}"
                    class="${escapeHtml(classes.join(' '))}"
                    tabindex="-1"
                    ${result.disabled ? 'disabled' : ''}
                >
                    <span class="${classNames.title}">${escapeHtml(result.title)}</span>
                    ${result.subtitle ? `<span class="${classNames.subtitle}">${escapeHtml(result.subtitle)}</span>` : ''}
                    ${result.description ? `<span class="${classNames.description}">${escapeHtml(result.description)}</span>` : ''}
                </button>
            `;
        }).join('');

        const safeIndex = state.activeIndex >= 0 ? state.activeIndex : 0;
        setActiveIndex(safeIndex, { announce: true, scrollIntoView: false });
    }

    function getResults() {
        return state.results.map((item) => item.raw);
    }

    function getActiveResult() {
        if (state.activeIndex < 0 || state.activeIndex >= state.results.length) return null;
        return state.results[state.activeIndex].raw;
    }

    function setActiveIndex(index, options = {}) {
        if (!state.results.length) {
            state.activeIndex = -1;
            return;
        }

        const bounded = Math.max(0, Math.min(Number(index || 0), state.results.length - 1));
        state.activeIndex = bounded;

        container.querySelectorAll('[data-search-option="true"]').forEach((element) => {
            const optionIndex = Number(element.getAttribute('data-search-option-index') || -1);
            const selected = optionIndex === bounded;
            element.setAttribute('aria-selected', String(selected));
            element.classList.toggle(classNames.active, selected);
        });

        const selected = state.results[bounded];
        if (options.scrollIntoView !== false) {
            const selectedElement = getOptionElement(bounded);
            selectedElement?.scrollIntoView({ block: 'nearest' });
        }

        if (options.announce !== false && selected) {
            const stateLabel = selected.disabled ? 'Unavailable.' : 'Press Enter to activate.';
            const parts = [selected.title, selected.subtitle, stateLabel].filter(Boolean);
            setStatus(parts.join(' '));
        }

        onSelectionChange(selected?.raw || null, bounded);
    }

    function setResults(results, options = {}) {
        const normalized = Array.isArray(results)
            ? results.map((item, index) => toResultItem(item, index))
            : [];

        state.results = normalized;

        if (!state.results.length) {
            state.activeIndex = -1;
            render();
            return;
        }

        if (options.keepSelection && state.activeIndex >= 0 && state.activeIndex < state.results.length) {
            // Preserve existing selection when allowed.
        } else {
            const preferredIndex = state.results.findIndex((item) => !item.disabled);
            state.activeIndex = preferredIndex >= 0 ? preferredIndex : 0;
        }

        render();
    }

    function moveSelection(offset) {
        if (!state.results.length) return false;
        const step = Number(offset || 0);
        const next = ((state.activeIndex + step) % state.results.length + state.results.length) % state.results.length;
        setActiveIndex(next);
        return true;
    }

    function activate(index = state.activeIndex) {
        if (!state.results.length) return false;
        const bounded = Math.max(0, Math.min(Number(index || 0), state.results.length - 1));
        const item = state.results[bounded];
        if (!item || item.disabled) return false;
        onActivate(item.raw, bounded);
        return true;
    }

    function handleKeydown(event) {
        if (!event || typeof event.key !== 'string') return false;
        if (!state.results.length) return false;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveSelection(1);
            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveSelection(-1);
            return true;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            setActiveIndex(0);
            return true;
        }

        if (event.key === 'End') {
            event.preventDefault();
            setActiveIndex(state.results.length - 1);
            return true;
        }

        if (event.key === 'PageDown') {
            event.preventDefault();
            moveSelection(5);
            return true;
        }

        if (event.key === 'PageUp') {
            event.preventDefault();
            moveSelection(-5);
            return true;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            return activate();
        }

        return false;
    }

    function bindPointerEvents() {
        container.addEventListener('mousemove', (event) => {
            const target = event.target instanceof Element ? event.target.closest('[data-search-option="true"]') : null;
            if (!target) return;
            const index = Number(target.getAttribute('data-search-option-index') || -1);
            if (index >= 0 && index !== state.activeIndex) setActiveIndex(index, { announce: false });
        });

        container.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('[data-search-option="true"]') : null;
            if (!target) return;
            const index = Number(target.getAttribute('data-search-option-index') || -1);
            if (index < 0) return;
            setActiveIndex(index, { announce: false, scrollIntoView: false });
            activate(index);
        });
    }

    bindPointerEvents();

    return {
        getResults,
        getActiveResult,
        getActiveIndex: () => state.activeIndex,
        getActiveOptionId: () => (state.activeIndex >= 0 ? getOptionId(state.activeIndex) : ''),
        setResults,
        setActiveIndex,
        moveSelection,
        activate,
        handleKeydown,
        setStatus,
        focusActive() {
            if (state.activeIndex < 0) return false;
            const option = getOptionElement(state.activeIndex);
            if (!(option instanceof HTMLElement)) return false;
            option.focus();
            return true;
        }
    };
}
