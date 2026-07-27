const COMMAND_CATEGORIES = Object.freeze([
    'Application',
    'File',
    'Project',
    'Report',
    'Template',
    'Lookup',
    'Settings',
    'Tools',
    'Help'
]);

class CommandRegistryError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'CommandRegistryError';
        this.code = code;
        this.details = details;
    }
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeCommandId(value) {
    const text = normalizeText(value);
    return text ? text.replace(/\s+/g, '') : '';
}

function normalizeShortcutValue(value) {
    const text = normalizeText(value);
    return text ? text.replace(/\s*\+\s*/g, '+') : '';
}

function normalizeBooleanPredicate(value, fallback = true) {
    if (typeof value === 'function') return value;
    if (value === undefined) return () => Boolean(fallback);
    return () => Boolean(value);
}

function inferCategory(commandId) {
    const prefix = normalizeCommandId(commandId).split('.')[0] || '';
    return COMMAND_CATEGORIES.includes(prefix) ? prefix : 'Application';
}

function cloneCommand(command) {
    return command ? { ...command } : null;
}

function normalizeCommandMetadata(definition = {}) {
    const source = definition && typeof definition === 'object' ? definition : {};
    const id = normalizeCommandId(source.id || source.commandId);
    const action = normalizeText(source.action);
    const displayName = normalizeText(source.displayName || source.label);
    const description = normalizeText(source.description);
    const category = normalizeText(source.category) || inferCategory(id);
    const keyboardShortcut = normalizeShortcutValue(source.keyboardShortcut || source.shortcut);
    const helpTopic = normalizeText(source.helpTopic);
    const menuLocation = normalizeText(source.menuLocation || source.futureMenuLocation);
    const handler = typeof source.handler === 'function'
        ? source.handler
        : typeof source.execute === 'function'
            ? source.execute
            : null;

    if (!id) {
        throw new CommandRegistryError('Command ID is required.', 'missing-command-id');
    }

    if (!displayName) {
        throw new CommandRegistryError(`Command ${id} requires a display name.`, 'missing-display-name', { id });
    }

    return Object.freeze({
        id,
        action,
        displayName,
        description,
        category,
        handler,
        enabled: normalizeBooleanPredicate(source.enabled, true),
        visible: normalizeBooleanPredicate(source.visible, true),
        keyboardShortcut,
        helpTopic,
        menuLocation,
        commandPaletteVisible: source.commandPaletteVisible !== false,
        contextMenuVisible: Boolean(source.contextMenuVisible),
        notes: normalizeText(source.notes || source.futureNotes)
    });
}

function normalizeQuery(query = {}) {
    const source = query && typeof query === 'object' ? query : {};
    return {
        action: normalizeText(source.action).toLowerCase(),
        commandId: normalizeCommandId(source.commandId),
        displayName: normalizeText(source.displayName).toLowerCase(),
        category: normalizeText(source.category).toLowerCase(),
        keyboardShortcut: normalizeShortcutValue(source.keyboardShortcut).toLowerCase(),
        helpTopic: normalizeText(source.helpTopic).toLowerCase(),
        menuLocation: normalizeText(source.menuLocation || source.futureMenuLocation).toLowerCase(),
        searchText: normalizeText(source.searchText).toLowerCase()
    };
}

export function createCommandRegistry() {
    const commandsById = new Map();
    const commandsByShortcut = new Map();

    function registerCommand(definition) {
        const command = normalizeCommandMetadata(definition);

        if (commandsById.has(command.id)) {
            throw new CommandRegistryError(`Command ${command.id} is already registered.`, 'duplicate-command-registration', {
                id: command.id
            });
        }

        if (command.keyboardShortcut) {
            const shortcutKey = command.keyboardShortcut.toLowerCase();
            const existing = commandsByShortcut.get(shortcutKey);
            if (existing) {
                throw new CommandRegistryError(
                    `Keyboard shortcut ${command.keyboardShortcut} is already registered to ${existing.id}.`,
                    'duplicate-keyboard-shortcut-registration',
                    {
                        shortcut: command.keyboardShortcut,
                        existingCommandId: existing.id,
                        commandId: command.id
                    }
                );
            }
            commandsByShortcut.set(shortcutKey, command);
        }

        commandsById.set(command.id, command);
        return command;
    }

    function registerCommands(definitions = []) {
        if (!Array.isArray(definitions)) return [];
        return definitions.map((definition) => registerCommand(definition));
    }

    function unregisterCommand(commandId) {
        const id = normalizeCommandId(commandId);
        const command = commandsById.get(id) || null;
        if (!command) return null;

        commandsById.delete(id);
        if (command.keyboardShortcut) {
            commandsByShortcut.delete(command.keyboardShortcut.toLowerCase());
        }
        return command;
    }

    function getCommand(commandId) {
        return commandsById.get(normalizeCommandId(commandId)) || null;
    }

    function getCommandByShortcut(shortcut) {
        return commandsByShortcut.get(normalizeShortcutValue(shortcut).toLowerCase()) || null;
    }

    function hasCommand(commandId) {
        return commandsById.has(normalizeCommandId(commandId));
    }

    function getCommands() {
        return [...commandsById.values()].map(cloneCommand);
    }

    function getCommandIds() {
        return [...commandsById.keys()];
    }

    function getCommandsByCategory(category) {
        const normalizedCategory = normalizeText(category).toLowerCase();
        if (!normalizedCategory) return getCommands();
        return getCommands().filter((command) => command.category.toLowerCase() === normalizedCategory);
    }

    function findCommands(query = {}) {
        const criteria = normalizeQuery(query);

        return getCommands().filter((command) => {
            if (criteria.action && String(command.action || '').toLowerCase() !== criteria.action) return false;
            if (criteria.commandId && command.id !== criteria.commandId) return false;
            if (criteria.displayName && command.displayName.toLowerCase() !== criteria.displayName) return false;
            if (criteria.category && command.category.toLowerCase() !== criteria.category) return false;
            if (criteria.keyboardShortcut && command.keyboardShortcut.toLowerCase() !== criteria.keyboardShortcut) return false;
            if (criteria.helpTopic && command.helpTopic.toLowerCase() !== criteria.helpTopic) return false;
            if (criteria.menuLocation && command.menuLocation.toLowerCase() !== criteria.menuLocation) return false;
            if (criteria.searchText) {
                const haystack = [
                    command.id,
                    command.displayName,
                    command.description,
                    command.category,
                    command.keyboardShortcut,
                    command.helpTopic,
                    command.menuLocation,
                    command.notes
                ].join(' ').toLowerCase();
                if (!haystack.includes(criteria.searchText)) return false;
            }
            return true;
        });
    }

    function clear() {
        commandsById.clear();
        commandsByShortcut.clear();
    }

    function snapshot() {
        return getCommands();
    }

    return Object.freeze({
        registerCommand,
        registerCommands,
        unregisterCommand,
        getCommand,
        getCommandByShortcut,
        hasCommand,
        getCommands,
        getCommandIds,
        getCommandsByCategory,
        findCommands,
        snapshot,
        clear,
        get size() {
            return commandsById.size;
        }
    });
}

export const commandRegistry = createCommandRegistry();
export {
    COMMAND_CATEGORIES,
    CommandRegistryError,
    normalizeCommandId,
    normalizeShortcutValue,
    normalizeCommandMetadata
};
