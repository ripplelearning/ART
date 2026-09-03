import { getShortcutDefinitions, getShortcutForAction, getVisualAccessibilityConfig } from './state.js';
import { openOnboardingWizard } from './onboardingWizard.js';

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
    const openCommandPalette = getShortcutForAction('openCommandPalette');
    if (openCommandPalette) lines.push(`${openCommandPalette}: Open Command Palette`);
    const focusMenuBar = getShortcutForAction('focusMenuBar');
    if (focusMenuBar) lines.push(`${focusMenuBar}: Focus Menu Bar`);
    const focusMenuSearch = getShortcutForAction('focusMenuSearch');
    if (focusMenuSearch) lines.push(`${focusMenuSearch}: Focus Menu Bar Command Search`);
    const attachFile = getShortcutForAction('attachFile');
    if (attachFile) lines.push(`${attachFile}: Attach File in Report Editor`);

    return lines;
}

function getVisualAccessibilitySummary() {
    const settings = getVisualAccessibilityConfig();
    const themeLabels = {
        light: 'Light Theme',
        dark: 'Dark Theme',
        'high-contrast-light': 'High Contrast Light',
        'high-contrast-dark': 'High Contrast Dark',
        system: 'Follow System Theme'
    };

    return [
        `Current Profile: ${settings.activeProfile || 'Default'}`,
        `Current Theme: ${themeLabels[settings.theme] || 'Light Theme'}`,
        `Current Zoom: ${settings.zoom}%`,
        `Current Font Size: ${settings.fontSize}%`,
        `Enhanced Focus Indicators: ${settings.enhancedFocusIndicators ? 'On' : 'Off'}`,
        `Reduced Motion: ${settings.reducedMotion ? 'On' : 'Off'}`,
        `Interface Density: ${settings.density}`,
        `Border Visibility: ${settings.borderVisibility ? 'Enhanced' : 'Standard'}`
    ];
}

function bindWelcomeShortcutSync() {
    if (welcomeShortcutSyncBound) return;
    const refreshIfVisible = () => {
        const isWelcomeActive = document.getElementById('tab-welcome')?.getAttribute('aria-selected') === 'true';
        if (!isWelcomeActive) return;
        renderWelcome();
    };

    window.addEventListener('art-shortcuts-updated', refreshIfVisible);
    window.addEventListener('art-visual-accessibility-updated', refreshIfVisible);
    welcomeShortcutSyncBound = true;
}

function bindWelcomeOnboardingActions() {
    document.getElementById('welcome-open-setup-wizard')?.addEventListener('click', (event) => {
        openOnboardingWizard(event.currentTarget);
    });
}

// welcome.js
export function renderWelcome() {
    const container = document.getElementById('main-inner');
    const shortcuts = getDynamicShortcutLines();
    const visualSummary = getVisualAccessibilitySummary();
    const closeWorkspaceShortcut = getShortcutForAction('closeProjectWorkspace') || 'Alt+Ctrl+Shift+C';
    container.innerHTML = `
        <section id="welcome-view" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">Welcome to ART</h1>
            <p><strong>ART (the Accessibility Reporting Tool)</strong> Version 2.0 is an open-source application for creating, managing, and exporting professional accessibility audit reports. Designed for accessibility professionals, quality assurance testers, developers, designers, educators, and organizations, ART streamlines the process of documenting accessibility findings while supporting efficient, consistent, and accessible reporting workflows.</p>
            <p>ART is built on an accessibility-first philosophy. Keyboard accessibility, screen reader compatibility, semantic HTML, and support for a wide range of users are fundamental to every aspect of the application.</p>
            <div>
                <h2 id="welcome-getting-started-heading">Getting Started</h2>
                <p>The best place to begin is the <strong>Dashboard</strong>, where you can create or open a <strong>Project Workspace</strong>, manage reports and assets, and configure ART through <strong>Application Settings</strong>.</p>
                <p>To start a new report, select <strong>New Report</strong> on the Dashboard. To open an existing project, select <strong>Open ART Project...</strong>. To explore Report Builder, select the <strong>Builder</strong> panel tab. To open documentation, select <strong>Help</strong> on the Dashboard or press <strong>F1</strong>.</p>
                <p><button id="welcome-open-setup-wizard" type="button">Open Optional ART Setup Wizard</button></p>
                <p>Select <strong>Configure Dashboard</strong> to choose a layout, show or hide widgets, reorder cards, manage dashboard tabs, and build custom widgets.</p>
                <p>Use <strong>Continue Working</strong> to restore the most recent Project Workspace context when available.</p>
                <p>When a workspace is open, use <strong>Close Workspace</strong> in Resource Navigator or press <strong>${closeWorkspaceShortcut}</strong> to close it.</p>
                    <p>Use <strong>Ctrl+Shift+P</strong> to open the Command Palette and search or execute commands from anywhere in ART.</p>
                <p>Use <strong>Ctrl+K</strong> to open <strong>Search Everywhere</strong> for cross-resource search across commands, reports, templates, workspaces, standards, and help topics.</p>
                <p>Press <strong>F10</strong> or <strong>Alt+/</strong> to focus the Menu Bar, and press <strong>Alt+Q</strong> to jump directly to Menu Bar Command Search.</p>
                <p>Press <strong>F1</strong> at any time to open the built-in Help system, which includes comprehensive documentation, tutorials, keyboard shortcuts, and detailed information about every feature in ART.</p>
                <p>When a report includes an Attachment field, use the <strong>Attach File in Report Editor</strong> shortcut to open the file picker without leaving the keyboard.</p>
                <p>The keyboard shortcuts below are updated automatically to reflect your current shortcut assignments.</p>
            </div>
            <section aria-labelledby="welcome-shortcuts-heading">
                <h2 id="welcome-shortcuts-heading">Keyboard Shortcuts</h2>
                <ul>
                    ${shortcuts.map((shortcut) => `<li>${shortcut}</li>`).join('')}
                </ul>
            </section>
            <section aria-labelledby="welcome-visual-heading">
                <h2 id="welcome-visual-heading">Visual Accessibility</h2>
                <ul>
                    ${visualSummary.map((item) => `<li>${item}</li>`).join('')}
                </ul>
                <p>Open Application Settings to adjust appearance preferences at any time.</p>
            </section>
        </section>
    `;

    bindWelcomeShortcutSync();
    bindWelcomeOnboardingActions();
}
