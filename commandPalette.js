import { commandExecutionService } from './commandExecutionService.js';
import { announce } from './state.js';
import { searchCommands } from './commandSearchEngine.js';
import { createSearchResultsController } from './searchResultsFramework.js';

const COMMAND_PALETTE_COMMAND_ID = 'Application.OpenCommandPalette';

let commandPaletteInitialized = false;
let lastTrigger = null;
let previousFocus = null;
let isOpen = false;
let activeIndex = 0;
let commandResults = [];
let resultsController = null;

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
    if (resultsController) {
        const selected = resultsController.getActiveResult();
        return selected?.command || null;
    }
    return commandResults[activeIndex] || null;
}

function updateStatus(message) {
    const { status } = getDialogElements();
    if (status) status.textContent = message;
}

function ensureResultsController() {
    if (resultsController) return resultsController;
    const { results, searchInput } = getDialogElements();
    if (!results || !searchInput) return null;

    resultsController = createSearchResultsController({
        container: results,
        statusElement: getDialogElements().status,
        idPrefix: 'command-palette',
        listboxLabel: 'Command results',
        itemClass: 'command-palette-option',
        itemActiveClass: 'command-palette-option--active',
        itemDisabledClass: 'command-palette-option--disabled',
        titleClass: 'command-palette-option-name',
        subtitleClass: 'command-palette-option-shortcut',
        descriptionClass: 'command-palette-option-description',
        emptyClass: 'command-palette-empty',
        emptyMessage: 'No matching commands found.',
        onActivate: () => {
            void executeSelectedCommand();
        },
        onSelectionChange: () => {
            const optionId = resultsController?.getActiveOptionId() || '';
            if (optionId) {
                searchInput.setAttribute('aria-activedescendant', optionId);
            } else {
                searchInput.removeAttribute('aria-activedescendant');
            }
        }
    });

    return resultsController;
}

function renderResults() {
    const { searchInput } = getDialogElements();
    const controller = ensureResultsController();
    if (!searchInput || !controller) return;

    commandResults = getFilteredCommands();
    const items = commandResults.map((command) => ({
        id: command.id,
        title: command.displayName,
        subtitle: `${command.category}${command.keyboardShortcut ? ` | ${command.keyboardShortcut}` : ''}`,
        description: command.description || '',
        disabled: !command.canExecute,
        command
    }));

    controller.setResults(items);

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
    resultsController?.setResults([]);
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
        const controller = ensureResultsController();
        if (controller?.handleKeydown(event)) return;
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

    ensureResultsController();

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