import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { searchCommands } from './commandSearchEngine.js';
import { announce } from './state.js';

let menuBarInitialized = false;
let lastFocusedMenuIndex = 0;
let activeMenuLabel = '';
let searchResults = [];
let activeSearchIndex = 0;

const TOP_LEVEL_MENU_ORDER = ['File', 'Edit', 'View', 'Report', 'Tools', 'Templates', 'Window', 'Help'];

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

function getMenuLocation(command) {
    const location = normalizeText(command.menuLocation);
    if (location) return location;

    switch (command.action) {
        case 'openWelcome': return 'View>Welcome Screen';
        case 'openCommandPalette': return 'View>Command Palette';
        case 'focusMenuBar': return 'View>Menu Bar';
        case 'focusMenuSearch': return 'View>Command Search';
        case 'openBuilder': return 'View>Report Builder';
        case 'openEditor': return 'View>Report Editor';
        case 'openViewer': return 'View>Report Viewer';
        case 'focusNavigation': return 'View>Navigation';
        case 'focusDashboard': return 'View>Dashboard';
        case 'focusMainContent': return 'View>Main Content';
        case 'nextLandmark':
        case 'previousLandmark': return 'View>Application Landmarks';
        case 'openHelp': return 'Help>User Guide';
        case 'openProgressLog': return 'Tools>Progress Log';
        case 'focusLookup':
        case 'resetLookup': return 'Tools>Accessibility Lookup Tool';
        case 'spellCheck':
        case 'spellReplace':
        case 'spellReplaceAll':
        case 'spellIgnore':
        case 'spellIgnoreAll':
        case 'spellAddToDictionary':
        case 'spellUndoLastCorrection':
        case 'spellCancel': return 'Tools>Spell Check';
        case 'openSettings':
        case 'settingsClose':
        case 'settingsRestoreShortcuts':
        case 'settingsImportStandard':
        case 'settingsPasteStandardTable':
        case 'settingsImportReportFile':
        case 'settingsImportTemplateFile':
        case 'settingsOpenIntegrations':
        case 'settingsTogglePrivacyMode':
        case 'settingsCreateBackup':
        case 'settingsResetApp':
        case 'settingsCloseReport': return 'Edit>Application Settings';
        case 'copyEntry':
        case 'copyName':
        case 'copyDescription':
        case 'copyFailures':
        case 'copyFixes':
        case 'copyLink': return 'Edit>Copy';
        case 'newReport':
        case 'newReportFromTemplate':
        case 'openProject':
        case 'saveProject':
        case 'saveProjectAs':
        case 'importData':
        case 'openReport': return 'File';
        case 'exportReport':
        case 'printPreview': return 'File>Export';
        case 'closeReport': return 'File>Close';
        case 'configureReport':
        case 'editReport':
        case 'viewReport':
        case 'deleteReport':
        case 'addField':
        case 'done':
        case 'addEntry':
        case 'validateReport':
        case 'reportStatistics': return 'Report';
        case 'newTemplate':
        case 'useTemplate':
        case 'openTemplate':
        case 'editTemplate':
        case 'deleteTemplate':
        case 'importTemplate':
        case 'exportTemplate': return 'Templates';
        default: return command.category || 'Application';
    }
}

function splitMenuPath(location) {
    return String(location || '')
        .split('>')
        .map((part) => normalizeText(part))
        .filter(Boolean);
}

function createNode(label) {
    return {
        label,
        commands: [],
        children: new Map()
    };
}

function buildTree(commands) {
    const root = new Map();

    for (const command of commands) {
        const path = splitMenuPath(getMenuLocation(command));
        const topLevel = path[0] || command.category || 'Application';
        const topNode = root.get(topLevel) || createNode(topLevel);
        root.set(topLevel, topNode);

        if (path.length <= 1) {
            topNode.commands.push(command);
            continue;
        }

        let current = topNode;
        for (let index = 1; index < path.length; index += 1) {
            const segment = path[index];
            const child = current.children.get(segment) || createNode(segment);
            current.children.set(segment, child);
            current = child;
            if (index === path.length - 1) {
                current.commands.push(command);
            }
        }
    }

    return root;
}

function getVisibleCommands() {
    return commandRegistry.getCommands()
        .map((command) => ({
            ...command,
            ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
        }))
        .filter((command) => command.visible !== false);
}

function getTopLevelMenus() {
    const tree = buildTree(getVisibleCommands());
    return [...tree.values()]
        .filter((menu) => menu.commands.length || menu.children.size)
        .sort((left, right) => {
            const leftIndex = TOP_LEVEL_MENU_ORDER.indexOf(left.label);
            const rightIndex = TOP_LEVEL_MENU_ORDER.indexOf(right.label);
            if (leftIndex !== -1 || rightIndex !== -1) {
                return (leftIndex === -1 ? TOP_LEVEL_MENU_ORDER.length : leftIndex) - (rightIndex === -1 ? TOP_LEVEL_MENU_ORDER.length : rightIndex);
            }
            return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
        });
}

function getContainer() {
    const container = document.getElementById('menu-bar');
    const menuBar = document.getElementById('menu-bar-menubar');
    const searchInput = document.getElementById('menu-bar-search');
    const panel = document.getElementById('menu-bar-panel');
    const status = document.getElementById('menu-bar-status');
    return { container, menuBar, searchInput, panel, status };
}

function setStatus(message) {
    const { status } = getContainer();
    if (status) status.textContent = message;
}

function renderCommandButton(command, className = 'app-menu-bar__menu-item') {
    const shortcut = command.keyboardShortcut || 'Unassigned';
    return `
        <button
            type="button"
            class="${className} ${command.canExecute ? '' : 'is-disabled'}"
            data-command-id="${escapeHtml(command.id)}"
            aria-disabled="${String(!command.canExecute)}"
        >
            <span>${escapeHtml(command.displayName)}</span>
            <span class="app-menu-bar__shortcut">${escapeHtml(shortcut)}</span>
        </button>
    `;
}

function renderMenuNode(node, depth = 0) {
    const groups = [...node.children.values()]
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));

    return `
        <section class="app-menu-bar__menu-group app-menu-bar__menu-group--depth-${depth}">
            <h3 class="app-menu-bar__menu-group-title">${escapeHtml(node.label)}</h3>
            <div class="app-menu-bar__menu-items">
                ${node.commands.map((command) => renderCommandButton(command)).join('')}
            </div>
            ${groups.map((group) => renderMenuNode(group, depth + 1)).join('')}
        </section>
    `;
}

function renderSearchResults() {
    if (!searchResults.length) {
        return '<p class="app-menu-bar__empty">No matching commands found.</p>';
    }

    return searchResults.map((command, index) => {
        const shortcut = command.keyboardShortcut || 'Unassigned';
        const isSelected = index === activeSearchIndex;
        return `
            <button
                type="button"
                role="option"
                class="app-menu-bar__search-result ${isSelected ? 'is-selected' : ''} ${command.canExecute ? '' : 'is-disabled'}"
                data-search-result="true"
                data-command-id="${escapeHtml(command.id)}"
                aria-selected="${String(isSelected)}"
                aria-disabled="${String(!command.canExecute)}"
            >
                <span class="app-menu-bar__search-result-name">${escapeHtml(command.displayName)}</span>
                <span class="app-menu-bar__search-result-meta">${escapeHtml(shortcut)} · ${escapeHtml(command.category)}</span>
                ${command.description ? `<span class="app-menu-bar__search-result-description">${escapeHtml(command.description)}</span>` : ''}
            </button>
        `;
    }).join('');
}

function renderMenuBar() {
    const { menuBar, searchInput, panel } = getContainer();
    if (!menuBar || !searchInput || !panel) return;

    const menus = getTopLevelMenus();
    const searchValue = normalizeText(searchInput.value);

    menuBar.innerHTML = menus.map((menu, index) => `
        <button
            type="button"
            class="app-menu-bar__button ${activeMenuLabel === menu.label ? 'is-active' : ''}"
            data-menu-button="true"
            data-menu-label="${escapeHtml(menu.label)}"
            aria-haspopup="true"
            aria-expanded="${String(activeMenuLabel === menu.label)}"
            tabindex="${index === lastFocusedMenuIndex ? 0 : -1}"
        >
            ${escapeHtml(menu.label)}
        </button>
    `).join('');

    if (searchValue || document.activeElement === searchInput) {
        searchResults = searchCommands(searchValue, { context: { source: 'menu-bar' } });
        activeSearchIndex = Math.max(0, searchResults.findIndex((command) => command.canExecute));
        panel.hidden = false;
        panel.innerHTML = `
            <div class="app-menu-bar__search-panel" aria-live="polite">
                <p class="app-menu-bar__search-summary">${searchResults.length ? `${searchResults.length} command${searchResults.length === 1 ? '' : 's'} found.` : 'Type to search registered commands.'}</p>
                <div id="menu-bar-search-results" role="listbox" aria-label="Command search results">
                    ${renderSearchResults()}
                </div>
            </div>
        `;
        return;
    }

    const activeMenu = menus.find((menu) => menu.label === activeMenuLabel) || null;
    if (!activeMenu) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
    }

    panel.hidden = false;
    panel.innerHTML = `<div role="menu" aria-label="${escapeHtml(activeMenu.label)}">${renderMenuNode(activeMenu)}</div>`;
}

function executeCommand(command) {
    if (!command) return;
    if (!command.canExecute) {
        announce('Command unavailable.');
        setStatus('Command unavailable.');
        return;
    }

    void commandExecutionService.executeCommand(command.id, {
        source: 'menu-bar',
        invocation: 'menu-bar',
        triggerElement: document.activeElement,
        activeElement: document.activeElement
    }).then((result) => {
        if (result?.ok) {
            announce(`Executed ${command.displayName}.`);
            closeMenus();
            return;
        }

        announce(result?.message || 'Error executing command.');
        setStatus(result?.message || 'Error executing command.');
    });
}

function focusMenuButton(index = lastFocusedMenuIndex) {
    const { menuBar } = getContainer();
    const buttons = [...(menuBar?.querySelectorAll('[data-menu-button]') || [])];
    if (!buttons.length) return;
    const nextIndex = Math.max(0, Math.min(index, buttons.length - 1));
    lastFocusedMenuIndex = nextIndex;
    buttons[nextIndex]?.focus();
}

function focusMenuBar() {
    renderMenuBar();
    focusMenuButton();
    announce('Menu bar focused.');
}

function focusMenuSearch(selectText = true) {
    const { searchInput } = getContainer();
    if (!searchInput) return;
    activeMenuLabel = '';
    renderMenuBar();
    searchInput.focus();
    if (selectText) searchInput.select();
    announce('Command search focused.');
}

function openFocusedMenu() {
    const { menuBar } = getContainer();
    const activeButton = document.activeElement instanceof HTMLElement && document.activeElement.matches('[data-menu-button]')
        ? document.activeElement
        : menuBar?.querySelector('[data-menu-button]') || null;
    const menuLabel = activeButton?.getAttribute('data-menu-label') || '';
    if (!menuLabel) return;
    activeMenuLabel = menuLabel;
    renderMenuBar();
}

function closeMenus(restoreFocus = true) {
    activeMenuLabel = '';
    searchResults = [];
    activeSearchIndex = 0;
    renderMenuBar();

    if (restoreFocus) {
        window.setTimeout(() => focusMenuButton(), 0);
    }
}

function handleKeydown(event) {
    if (event.key === 'F10') {
        event.preventDefault();
        focusMenuBar();
        return;
    }

    if (event.altKey && event.key === '/') {
        event.preventDefault();
        focusMenuBar();
        return;
    }

    if (event.altKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        focusMenuSearch(true);
        return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void commandExecutionService.executeCommand('Application.OpenCommandPalette', {
            source: 'menu-bar',
            invocation: 'keyboard-shortcut',
            triggerEvent: event,
            activeElement: document.activeElement
        });
        return;
    }

    const { searchInput, menuBar } = getContainer();
    const activeElement = document.activeElement;

    if (activeElement === searchInput) {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (searchInput.value) {
                searchInput.value = '';
                renderMenuBar();
                setStatus('Search cleared.');
            } else {
                focusMenuBar();
            }
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
            if (!searchResults.length) return;
            event.preventDefault();
            if (event.key === 'ArrowDown') {
                activeSearchIndex = Math.min(activeSearchIndex + 1, searchResults.length - 1);
                renderMenuBar();
            } else if (event.key === 'ArrowUp') {
                activeSearchIndex = Math.max(activeSearchIndex - 1, 0);
                renderMenuBar();
            } else {
                executeCommand(searchResults[activeSearchIndex]);
            }
        }
        return;
    }

    if (activeElement instanceof HTMLElement && activeElement.matches('[data-menu-button]')) {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            const buttons = [...(menuBar?.querySelectorAll('[data-menu-button]') || [])];
            if (!buttons.length) return;
            const nextIndex = (lastFocusedMenuIndex + 1) % buttons.length;
            focusMenuButton(nextIndex);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const buttons = [...(menuBar?.querySelectorAll('[data-menu-button]') || [])];
            if (!buttons.length) return;
            const nextIndex = (lastFocusedMenuIndex - 1 + buttons.length) % buttons.length;
            focusMenuButton(nextIndex);
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusMenuButton(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            const buttons = [...(menuBar?.querySelectorAll('[data-menu-button]') || [])];
            focusMenuButton(buttons.length - 1);
        } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            openFocusedMenu();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeMenus(true);
        }
        return;
    }

    const menuItem = activeElement instanceof HTMLElement ? activeElement.closest('[data-command-id]') : null;
    if (!menuItem || !menuBar?.contains(menuItem)) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeMenus(true);
        return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const commandId = menuItem.getAttribute('data-command-id') || '';
        const command = commandRegistry.getCommand(commandId);
        if (command) {
            executeCommand({
                ...command,
                ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
            });
        }
    }
}

function bindEvents() {
    const { container } = getContainer();
    if (!container) return false;

    container.innerHTML = `
        <div class="app-menu-bar__row">
            <nav id="menu-bar-menubar" class="app-menu-bar__menubar" role="menubar" aria-label="Application menus"></nav>
            <div class="app-menu-bar__search">
                <label class="sr-only" for="menu-bar-search">Menu Bar Command Search</label>
                <input id="menu-bar-search" type="search" autocomplete="off" spellcheck="false" aria-controls="menu-bar-panel" aria-describedby="menu-bar-status" placeholder="Search commands">
            </div>
        </div>
        <div id="menu-bar-panel" class="app-menu-bar__panel" hidden></div>
        <p id="menu-bar-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    const { menuBar, searchInput, panel } = getContainer();
    if (!menuBar || !searchInput || !panel) return false;

    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('art-shortcuts-updated', () => renderMenuBar());
    window.addEventListener('art-visual-accessibility-updated', () => renderMenuBar());

    const resolvedSearchInput = document.getElementById('menu-bar-search');
    const resolvedMenuBar = document.getElementById('menu-bar-menubar');
    const resolvedPanel = document.getElementById('menu-bar-panel');

    resolvedSearchInput?.addEventListener('input', () => renderMenuBar());
    resolvedSearchInput?.addEventListener('focus', () => renderMenuBar());

    resolvedMenuBar?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-menu-button]') : null;
        if (!target) return;
        const buttons = [...resolvedMenuBar.querySelectorAll('[data-menu-button]')];
        lastFocusedMenuIndex = buttons.indexOf(target);
        activeMenuLabel = target.getAttribute('data-menu-label') || '';
        renderMenuBar();
    });

    resolvedPanel?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-command-id]') : null;
        if (!target) return;
        const commandId = target.getAttribute('data-command-id') || '';
        const command = commandRegistry.getCommand(commandId);
        if (command) {
            executeCommand({
                ...command,
                ...commandExecutionService.getCommandExecutionState(command.id, { source: 'menu-bar' })
            });
        }
    });

    renderMenuBar();
    return true;
}

export function initMenuBar() {
    if (menuBarInitialized) return true;
    menuBarInitialized = bindEvents();
    return menuBarInitialized;
}

export function focusMenuBarFromCommand() {
    focusMenuBar();
    return true;
}

export function focusMenuSearchFromCommand() {
    focusMenuSearch(true);
    return true;
}
