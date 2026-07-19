import { getShortcutDefinitions, getShortcutForAction } from './state.js';

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

    const openBuilder = getShortcutForAction('openBuilder');
    const newReport = getShortcutForAction('newReport');
    const nextLandmark = getShortcutForAction('nextLandmark');
    if (openBuilder) lines.push(`${openBuilder}: Open Builder`);
    if (newReport) lines.push(`${newReport}: New Report`);
    if (nextLandmark) lines.push(`${nextLandmark}: Next Landmark`);

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
            <p>The <strong>Accessibility Reporting Tool (ART)</strong> is an open-source application for creating, managing, and exporting professional accessibility audit reports. Designed for accessibility professionals, quality assurance testers, developers, designers, educators, and organizations, ART streamlines the process of documenting accessibility findings while supporting efficient, consistent, and accessible reporting workflows.</p>
            <p>ART is built on an accessibility-first philosophy. Keyboard accessibility, screen reader compatibility, semantic HTML, and support for a wide range of users are fundamental to every aspect of the application.</p>
            <div>
                <h2 id="welcome-getting-started-heading">Getting Started</h2>
                <p>The best place to begin is the <strong>Dashboard</strong>, where you can create a new report, open an existing project, or configure ART through <strong>Application Settings</strong>.</p>
                <p>Press <strong>F1</strong> at any time to open the built-in Help system, which includes comprehensive documentation, tutorials, keyboard shortcuts, and detailed information about every feature in ART.</p>
                <p>The keyboard shortcuts below are updated automatically to reflect your current shortcut assignments.</p>
            </div>
            <section aria-labelledby="welcome-shortcuts-heading">
                <h2 id="welcome-shortcuts-heading">Keyboard Shortcuts</h2>
                <ul>
                    ${shortcuts.map((shortcut) => `<li>${shortcut}</li>`).join('')}
                </ul>
            </section>
        </section>
    `;

    bindWelcomeShortcutSync();
}
