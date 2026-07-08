document.addEventListener('DOMContentLoaded', () => {
    // Force focus to main-content on load to prevent lookup tool from stealing it
    const mainContent = document.getElementById('main-content');
    mainContent.focus();

    const tabs = document.querySelectorAll('[role="tab"]');
    const mainInner = document.getElementById('main-inner');
    const navElements = [
        document.getElementById('top-tabs'),
        document.getElementById('dashboard'),
        document.getElementById('main-content'),
        document.getElementById('lookup-tool')
    ];

    // Tab switching logic
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

    // Navigation cycle (Ctrl+F6) and Focus Mode (Ctrl+M)
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

// Resizing logic
let isResizing = false;
let activeResizer = null;
document.querySelectorAll('.resizer').forEach(r => r.addEventListener('mousedown', (e) => { isResizing = true; activeResizer = e.target.id; }));
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const container = document.querySelector('.app-container');
    const width = (e.clientX / container.offsetWidth) * 100;
    if (activeResizer === 'resizer-left') container.style.setProperty('--dashboard-width', `${width}%`);
    else container.style.setProperty('--lookup-width', `${100 - width}%`);
});
document.addEventListener('mouseup', () => isResizing = false);
