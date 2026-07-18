import { getShortcutDefinitions } from './state.js';

let welcomeShortcutSyncBound = false;

function formatShortcutLabel(definition) {
    if (!definition || !definition.shortcut) return '';
    const shortcut = String(definition.shortcut || '').trim();
    const label = String(definition.label || '').trim();
    if (!shortcut || !label) return '';
    return `${shortcut}: ${label}`;
}

function getDynamicShortcutLines() {
    const lines = getShortcutDefinitions()
        .map((definition) => formatShortcutLabel(definition))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    lines.push('Ctrl+Z / Ctrl+Shift+Z: Undo and redo');
    return lines;
}

function bindWelcomeShortcutSync() {
    if (welcomeShortcutSyncBound) return;
    const refreshIfVisible = () => {
        const isWelcomeActive = document.getElementById('tab-welcome')?.getAttribute('aria-selected') === 'true';
        if (!isWelcomeActive) return;
        renderWelcome();
    };

    window.addEventListener('art-shortcuts-updated', refreshIfVisible);
    welcomeShortcutSyncBound = true;
}

// welcome.js
export function renderWelcome() {
    const container = document.getElementById('main-inner');
    const shortcuts = getDynamicShortcutLines();
    container.innerHTML = `
        <section id="welcome-view" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">Welcome to ART</h1>
            <p>The Accessibility Reporting Tool (ART) helps you create audit logs, Executive Summaries, track current audit progress, lookup WCAG success criteria, and export compliance reports.</p>
            <p>New in this release: in-editor Spell Check (with configurable shortcuts) and expanded exports including Microsoft Excel (.xlsx) with Overview and Accessibility Audit sheets.</p>
            <p>Please use the <strong>Dashboard</strong> to create a new report or open an existing file to begin.</p>
            <section aria-labelledby="welcome-export-heading">
                <h2 id="welcome-export-heading">Export Notes</h2>
                <ul>
                    <li>WCAG Success Criterion values export as criterion names and keep their official Understanding links where the format supports hyperlinks.</li>
                    <li>HTML exports open WCAG links in a new tab.</li>
                    <li>Excel exports include <strong>Overview</strong> and <strong>Accessibility Audit</strong> sheets with live report data at export time.</li>
                </ul>
            </section>
            <section aria-labelledby="welcome-shortcuts-heading">
                <h2 id="welcome-shortcuts-heading">Keyboard Shortcuts</h2>
                <p>Use Ctrl+F6 and Ctrl+Shift+F6 to cycle through the application landmarks in a continuous loop.</p>
                <ul>
                    ${shortcuts.map((shortcut) => `<li>${shortcut}</li>`).join('')}
                </ul>
            </section>
        </section>
    `;

    bindWelcomeShortcutSync();
}
