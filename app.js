const tabs = document.querySelectorAll('[role="tab"]');
const mainPanel = document.getElementById('panel-main');
const contentDiv = document.getElementById('panel-content');
const lookupPanel = document.getElementById('panel-lookup');
const container = document.querySelector('.app-container');

function activateTab(tabId) {
    // 1. Update Tab selection state
    tabs.forEach(tab => {
        tab.setAttribute('aria-selected', tab.id === tabId);
    });

    // 2. Update Panel content and ARIA label
    mainPanel.setAttribute('aria-labelledby', tabId);
    if (tabId === 'tab-dashboard') {
        contentDiv.innerHTML = '<h1>Overview</h1><p>Welcome to the Dashboard.</p>';
    } else if (tabId === 'tab-reports') {
        contentDiv.innerHTML = '<h1>Report Builder</h1><p>Start building your report here.</p>';
    }
    
    mainPanel.focus();
}

// Click events
tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.id));
});

// Shortcuts & Navigation
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'F6') {
        e.preventDefault();
        const active = document.activeElement;
        if (active.closest('#sidebar')) mainPanel.focus();
        else if (active.closest('#panel-main')) lookupPanel.focus();
        else document.querySelector('#sidebar [role="tab"]').focus();
    }
    if (e.ctrlKey && e.key === 'l') { e.preventDefault(); lookupPanel.focus(); }
    if (e.ctrlKey && e.key === '1') activateTab('tab-dashboard');
    if (e.ctrlKey && e.key === '2') activateTab('tab-reports');
});

// Panel Resizing Logic
let isResizing = false;
document.querySelectorAll('.resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', () => isResizing = true);
});
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newSidebarWidth = (e.clientX / container.offsetWidth) * 100;
    container.style.setProperty('--sidebar-width', `${newSidebarWidth}%`);
});
document.addEventListener('mouseup', () => isResizing = false);
