import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { getShortcutForAction } from './state.js';
import { runUniversalSearch } from './universalSearchFramework.js';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeSearchText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeShortcutText(value) {
    return normalizeText(value).toLowerCase().replace(/[\s+]/g, '');
}

function getSearchableText(command, shortcut) {
    return [
        command.id,
        command.action,
        command.displayName,
        command.description,
        command.category,
        shortcut,
        command.helpTopic,
        command.menuLocation,
        command.notes,
        ...(Array.isArray(command.aliases) ? command.aliases : [])
    ].join(' ').toLowerCase();
}

function scoreCommand(command, query) {
    if (!query) return 0;

    const shortcut = normalizeShortcutText(command.keyboardShortcut);
    const compactQuery = query.replace(/[\s+]/g, '');
    const displayName = command.displayName.toLowerCase();
    const category = command.category.toLowerCase();
    const searchableText = command.searchableText;
    const aliases = Array.isArray(command.aliases) ? command.aliases.map((alias) => alias.toLowerCase()) : [];

    if (displayName === query) return 0;
    if (aliases.includes(query)) return 0.5;
    if (displayName.startsWith(query)) return 1;
    if (aliases.some((alias) => alias.startsWith(query))) return 1.5;
    if (searchableText.includes(query)) return 2;
    if (searchableText.includes(compactQuery)) return 3;
    if (category === query || category.startsWith(query)) return 4;
    if (shortcut && (shortcut === compactQuery || shortcut.includes(compactQuery))) return 5;
    return 6;
}

export function getSearchableCommands(options = {}) {
    const context = options.context || {};

    return commandRegistry.getCommands()
        .map((command) => {
            const state = commandExecutionService.getCommandExecutionState(command.id, context);
            const shortcut = getShortcutForAction(command.action) || command.keyboardShortcut || '';
            return {
                ...command,
                ...state,
                keyboardShortcut: shortcut,
                searchableText: getSearchableText(command, shortcut)
            };
        })
        .filter((command) => command.visible !== false);
}

export function searchCommands(query = '', options = {}) {
    const normalizedQuery = normalizeSearchText(query);
    const output = runUniversalSearch(query, {
        source: options?.context?.source || 'command-search-engine',
        providerIds: ['commands'],
        scope: 'commands'
    });

    const mapped = (output.results || [])
        .map((result) => result.raw?.command)
        .filter(Boolean);

    if (mapped.length > 0 || normalizedQuery) {
        return mapped;
    }

    return getSearchableCommands(options)
        .map((command) => ({ command, score: scoreCommand(command, normalizedQuery) }))
        .filter((item) => item.score < 6 || !normalizedQuery)
        .sort((left, right) => {
            if (left.score !== right.score) return left.score - right.score;
            const categoryComparison = left.command.category.localeCompare(right.command.category, undefined, { sensitivity: 'base' });
            if (categoryComparison !== 0) return categoryComparison;
            return left.command.displayName.localeCompare(right.command.displayName, undefined, { sensitivity: 'base' });
        })
        .map((item) => item.command);
}
