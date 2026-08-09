function normalizeText(value) {
    return String(value || '').trim();
}

function getWords(value) {
    return normalizeText(value)
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean);
}

function toPascalCase(words) {
    return words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

const REQUIRED_TOP_LEVEL_MENU_LABELS = Object.freeze([
    'File',
    'Edit',
    'View',
    'Search',
    'Report',
    'Tools',
    'Templates',
    'Collaboration',
    'Help'
]);

export function getRequiredTopLevelMenuLabels() {
    return [...REQUIRED_TOP_LEVEL_MENU_LABELS];
}

export function isTopLevelMenuShortcutAction(action) {
    return /^open[A-Za-z0-9]+Menu$/.test(normalizeText(action));
}

export function getTopLevelMenuShortcutAction(menuLabel) {
    const words = getWords(menuLabel);
    if (!words.length) return '';
    return `open${toPascalCase(words)}Menu`;
}

export function getTopLevelMenuLabelFromAction(action) {
    const text = normalizeText(action);
    const match = text.match(/^open(.+)Menu$/);
    if (!match) return '';

    const spaced = match[1]
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();

    const words = getWords(spaced);
    if (!words.length) return '';
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export function getTopLevelMenuShortcutCommandId(menuLabel) {
    const words = getWords(menuLabel);
    if (!words.length) return '';
    return `Application.Open${toPascalCase(words)}Menu`;
}

export function getTopLevelMenuShortcutDescriptor(menuLabel) {
    const label = normalizeText(menuLabel);
    const action = getTopLevelMenuShortcutAction(label);
    const commandId = getTopLevelMenuShortcutCommandId(label);
    if (!label || !action || !commandId) return null;

    return {
        menuLabel: label,
        action,
        commandId,
        label: `Open ${label} menu`
    };
}

export function mergeTopLevelMenuLabels(labels = []) {
    const unique = new Set();
    getRequiredTopLevelMenuLabels().forEach((label) => unique.add(label));

    if (Array.isArray(labels)) {
        labels
            .map((label) => normalizeText(label))
            .filter(Boolean)
            .forEach((label) => unique.add(label));
    }

    return [...unique];
}
