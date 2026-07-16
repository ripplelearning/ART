// welcome.js
export function renderWelcome() {
    const container = document.getElementById('main-inner');
    container.innerHTML = `
        <section id="welcome-view" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading">Welcome to ART</h1>
            <p>The Accessibility Reporting Tool (ART) helps you create audit logs, Executive Summaries, track current audit progress, lookup WCAG success criteria, and export compliance reports.</p>
            <p>Please use the <strong>Dashboard</strong> to create a new report or open an existing file to begin.</p>
            <section aria-labelledby="welcome-shortcuts-heading">
                <h2 id="welcome-shortcuts-heading">Keyboard Shortcuts</h2>
                <ul>
                    <li>Alt+Shift+U: Open Report Builder</li>
                    <li>Alt+Shift+E: Open Report Editor</li>
                    <li>Alt+Shift+A: Add audit entry</li>
                    <li>Alt+Shift+F: Add report field</li>
                    <li>Alt+Shift+L: Focus WCAG search</li>
                    <li>Alt+Shift+D: Reset WCAG Lookup Tool</li>
                    <li>Alt+Shift+O: Complete Builder and move report to Editor</li>
                    <li>Ctrl+O: Open existing ART JSON file</li>
                    <li>Ctrl+F6 / Ctrl+Shift+F6: Move between landmarks</li>
                    <li>Ctrl+Z / Ctrl+Shift+Z: Undo and redo</li>
                </ul>
            </section>
        </section>
    `;
}
