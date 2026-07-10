// welcome.js
export function renderWelcome() {
    const container = document.getElementById('main-inner');
    container.innerHTML = `
        <section id="welcome-view">
            <h1>Welcome to ART</h1>
            <p>The Accessibility Reporting Tool (ART) helps you create audit logs, Executive Summaries, track current audit progress, lookup WCAG success criteria, and export compliance reports.</p>
            <p>Please use the <strong>Dashboard</strong> to create a new report or open an existing file to begin.</p>
        </section>
    `;
}
