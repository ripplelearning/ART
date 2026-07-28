import { commandExecutionService } from './commandExecutionService.js';
import { announce } from './state.js';
import { searchCommands } from './commandSearchEngine.js';

const COMMAND_PALETTE_COMMAND_ID = 'Application.OpenCommandPalette';

let commandPaletteInitialized = false;
let lastTrigger = null;
let previousFocus = null;
let isOpen = false;
let activeIndex = 0;
let commandResults = [];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDialogElements() {
    const dialog = document.getElementById('command-palette-dialog');
    const closeButton = document.getElementById('btn-command-palette-close');
    const searchInput = document.getElementById('command-palette-search');
    const results = document.getElementById('command-palette-results');
    const status = document.getElementById('command-palette-status');
    return { dialog, closeButton, searchInput, results, status };
}

function getFilteredCommands() {
    const { searchInput } = getDialogElements();
    return searchCommands(searchInput?.value || '', { context: { source: 'command-palette' } });
}

function getSelectedCommand() {
    return commandResults[activeIndex] || null;
}

function getCommandOptionId(command) {
    return `command-palette-option-${command.id}`;
}

function updateStatus(message) {
    const { status } = getDialogElements();
    if (status) status.textContent = message;
}

function setActiveIndex(nextIndex, options = {}) {
    if (!commandResults.length) {
        activeIndex = -1;
        const { searchInput } = getDialogElements();
        if (searchInput) searchInput.removeAttribute('aria-activedescendant');
        return;
    }

    const boundedIndex = Math.max(0, Math.min(nextIndex, commandResults.length - 1));
    activeIndex = boundedIndex;
    const command = getSelectedCommand();
    const { searchInput, results } = getDialogElements();
    if (searchInput && command) {
        searchInput.setAttribute('aria-activedescendant', getCommandOptionId(command));
    }

    if (results) {
        results.querySelectorAll('[data-command-option]').forEach((option) => {
            const isSelected = option.getAttribute('data-command-id') === command?.id;
            option.setAttribute('aria-selected', String(isSelected));
            option.classList.toggle('command-palette-option--active', isSelected);
        });
    }

    if (options.scrollIntoView !== false && command) {
        const activeOption = document.getElementById(getCommandOptionId(command));
        activeOption?.scrollIntoView({ block: 'nearest' });
    }

    if (options.announce !== false && command) {
        const shortcut = command.keyboardShortcut ? ` Shortcut ${command.keyboardShortcut}.` : '';
        const state = command.canExecute ? 'Press Enter to execute.' : 'Command unavailable.';
        updateStatus(`${command.displayName}. ${command.category}.${shortcut} ${state}`);
    }
}

function renderResults() {
    const { results, searchInput } = getDialogElements();
    if (!results || !searchInput) return;

    commandResults = getFilteredCommands();

    if (commandResults.length === 0) {
        activeIndex = -1;
        searchInput.removeAttribute('aria-activedescendant');
        results.innerHTML = '<p class="command-palette-empty">No matching commands found.</p>';
        updateStatus('No matching commands found.');
        return;
    }

    const grouped = commandResults.reduce((accumulator, command) => {
        if (!accumulator[command.category]) accumulator[command.category] = [];
        accumulator[command.category].push(command);
        return accumulator;
    }, {});

    results.innerHTML = Object.entries(grouped)
        .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
        .map(([category, commands]) => `
            <section class="command-palette-group" aria-labelledby="command-palette-group-${escapeHtml(category)}">
                <h3 id="command-palette-group-${escapeHtml(category)}">${escapeHtml(category)}</h3>
                <div class="command-palette-options">
                    ${commands.map((command) => {
                        const commandId = getCommandOptionId(command);
                        const shortcut = command.keyboardShortcut ? escapeHtml(command.keyboardShortcut) : 'Unassigned';
                        const stateLabel = command.canExecute ? 'Ready' : 'Unavailable';
                        return `
                            <div
                                id="${commandId}"
                                role="option"
                                tabindex="-1"
                                data-command-option="true"
                                data-command-id="${escapeHtml(command.id)}"
                                aria-selected="false"
                                aria-disabled="${String(!command.canExecute)}"
                                class="command-palette-option ${command.canExecute ? '' : 'command-palette-option--disabled'}"
                            >
                                <div class="command-palette-option-name">${escapeHtml(command.displayName)}</div>
                                <div class="command-palette-option-meta">
                                    <span class="command-palette-option-shortcut">${shortcut}</span>
                                    <span>${escapeHtml(command.category)}</span>
                                    <span>${escapeHtml(stateLabel)}</span>
                                </div>
                                ${command.description ? `<div>${escapeHtml(command.description)}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        `)
        .join('');

    const preferredIndex = commandResults.findIndex((command) => command.canExecute);
    setActiveIndex(preferredIndex >= 0 ? preferredIndex : 0, { announce: false });
    const selected = getSelectedCommand();
    if (selected) {
        const shortcut = selected.keyboardShortcut ? ` Shortcut ${selected.keyboardShortcut}.` : '';
        const state = selected.canExecute ? 'Press Enter to execute.' : 'Command unavailable.';
        updateStatus(`${selected.displayName}. ${selected.category}.${shortcut} ${state}`);
    }
}

async function executeSelectedCommand() {
    const command = getSelectedCommand();
    if (!command) return false;

    if (!command.canExecute) {
        updateStatus('Command unavailable.');
        announce('Command unavailable.');
        return false;
    }

    const result = await commandExecutionService.executeCommand(command.id, {
        source: 'command-palette',
        invocation: 'command-palette',
        triggerElement: lastTrigger,
        activeElement: document.activeElement
    });

    if (!result?.ok) {
        updateStatus(result?.message || 'Error executing command.');
        announce(result?.message || 'Error executing command.');
        return false;
    }

    if (command.id === COMMAND_PALETTE_COMMAND_ID) {
        window.setTimeout(() => {
            const { searchInput } = getDialogElements();
            searchInput?.focus();
        }, 0);
        renderResults();
        announce('Command Palette already open.');
        return true;
    }

    closeCommandPalette(true);
    announce(`Executed ${command.displayName}.`);
    return true;
}

function moveSelection(offset) {
    if (!commandResults.length) return;
    setActiveIndex(activeIndex + offset);
}

function openCommandPalette(trigger = null) {
    const { dialog, searchInput } = getDialogElements();
    if (!dialog || !searchInput) return false;

    if (trigger) lastTrigger = trigger;
    if (!lastTrigger && document.activeElement instanceof HTMLElement) {
        lastTrigger = document.activeElement;
    }

    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : previousFocus;
    dialog.hidden = false;
    isOpen = true;
    renderResults();

    window.setTimeout(() => {
        searchInput.focus();
        searchInput.select();
        announce('Command Palette opened.');
    }, 0);

    return true;
}

function closeCommandPalette(restoreFocus = true) {
    const { dialog, searchInput } = getDialogElements();
    if (!dialog) return false;

    dialog.hidden = true;
    isOpen = false;
    activeIndex = 0;
    commandResults = [];
    if (searchInput) {
        searchInput.value = '';
        searchInput.removeAttribute('aria-activedescendant');
    }

    if (restoreFocus) {
        const target = lastTrigger || previousFocus;
        if (target && typeof target.focus === 'function') {
            window.setTimeout(() => target.focus(), 0);
        }
    }

    return true;
}

function trapCommandPaletteFocus(event) {
    const { dialog } = getDialogElements();
    if (!isOpen || !dialog || dialog.hidden) return;

    if (event.type === 'focusin') {
        if (!dialog.contains(event.target)) {
            const { searchInput } = getDialogElements();
            searchInput?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette(true);
        return;
    }

    if (event.key === 'Tab') {
        const focusables = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter((element) => element.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && event.target === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && event.target === last) {
            event.preventDefault();
            first.focus();
        }
        return;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageUp', 'PageDown', 'Enter'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowDown') moveSelection(1);
        if (event.key === 'ArrowUp') moveSelection(-1);
        if (event.key === 'Home') setActiveIndex(0);
        if (event.key === 'End') setActiveIndex(commandResults.length - 1);
        if (event.key === 'PageDown') moveSelection(5);
        if (event.key === 'PageUp') moveSelection(-5);
        if (event.key === 'Enter') void executeSelectedCommand();
    }
}

function bindCommandPaletteEvents() {
    const { dialog, closeButton, searchInput, results } = getDialogElements();
    if (!dialog || !closeButton || !searchInput || !results) return false;

    closeButton.addEventListener('click', () => {
        closeCommandPalette(true);
    });

    searchInput.addEventListener('input', () => {
        renderResults();
    });

    results.addEventListener('click', (event) => {
        const option = event.target instanceof Element ? event.target.closest('[data-command-option]') : null;
        if (!option) return;
        const command = commandResults.find((item) => item.id === option.getAttribute('data-command-id')) || null;
        if (!command) return;
        setActiveIndex(commandResults.findIndex((item) => item.id === command.id), { announce: false });
        void executeSelectedCommand();
    });

    results.addEventListener('mousemove', (event) => {
        const option = event.target instanceof Element ? event.target.closest('[data-command-option]') : null;
        if (!option) return;
        const index = commandResults.findIndex((item) => item.id === option.getAttribute('data-command-id'));
        if (index >= 0 && index !== activeIndex) {
            setActiveIndex(index);
        }
    });

    document.addEventListener('keydown', trapCommandPaletteFocus, true);
    document.addEventListener('focusin', trapCommandPaletteFocus);

    window.addEventListener('art-shortcuts-updated', () => {
        if (isOpen) renderResults();
    });

    return true;
}

export function initCommandPalette() {
    if (commandPaletteInitialized) return true;
    commandPaletteInitialized = bindCommandPaletteEvents();
    return commandPaletteInitialized;
}

export function closeCommandPaletteFromCommand() {
    return closeCommandPalette(true);
}

export { openCommandPalette };