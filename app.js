document.addEventListener('DOMContentLoaded', () => {
    // Prevent default focus-stealing by ensuring focus stays on body or a neutral container
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();

    const tabs = document.querySelectorAll('[role="tab"]');
    const mainInner = document.getElementById('main-inner');
    const navElements = [
        document.getElementById('top-tabs'),
        document.getElementById('dashboard'),
        document.getElementById('main-content'),
        document.getElementById('lookup-tool')
    ];

    // Tab switching fix
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
            e.target.setAttribute('aria-selected', 'true');
            
            const contentMap = {
                'tab-builder': '<h1>Report Builder</h1><p>Configuration settings...</p>',
                'tab-editor': '<h1>Editor</h1><p>Fill in report data...</p>',
                'tab-view': '<h1>View Report</h1><p>Export your findings...</p>'
            };
            mainInner.innerHTML = contentMap[e.target.id] || '';
        });
    });

    // Navigation cycle fix
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const active = document.activeElement;
            let index = navElements.findIndex(el => el.contains(active));
            let nextIndex = (index + 1) % navElements.length;
            navElements[nextIndex].focus();
        }
        if (e.ctrlKey && e.key === 'm') {
            document.querySelector('.app-container').classList.toggle('focus-mode');
        }
    });
});
