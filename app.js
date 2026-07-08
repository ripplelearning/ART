const container = document.querySelector('.app-container');
const mainPanel = document.getElementById('panel-main');
const lookupPanel = document.getElementById('panel-lookup');

// 1. Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+F6: Cycle (Sidebar -> Main -> Lookup -> Sidebar)
    if (e.ctrlKey && e.key === 'F6') {
        e.preventDefault();
        const active = document.activeElement;
        if (active.closest('#sidebar')) mainPanel.focus();
        else if (active.closest('#panel-main')) lookupPanel.focus();
        else document.querySelector('#sidebar button').focus();
    }
    // Ctrl+L: Jump to Lookup
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        lookupPanel.focus();
    }
});

// 2. Panel Resizing
let isResizing = false;
document.querySelectorAll('.resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', () => isResizing = true);
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerWidth = container.offsetWidth;
    const newSidebarWidth = (e.clientX / containerWidth) * 100;
    container.style.setProperty('--sidebar-width', `${newSidebarWidth}%`);
});

document.addEventListener('mouseup', () => isResizing = false);
