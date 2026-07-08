const tabs = document.querySelectorAll('[role="tab"]');
const mainInner = document.getElementById('main-inner');
const elements = [
    document.getElementById('top-tabs'),
    document.getElementById('dashboard'),
    document.getElementById('main-content'),
    document.getElementById('lookup-tool')
];

// Content switching logic
function switchTab(tabId) {
    tabs.forEach(tab => tab.setAttribute('aria-selected', tab.id === tabId));
    
    if (tabId === 'tab-builder') {
        mainInner.innerHTML = '<h1>Report Builder</h1><p>Configure your report fields and options.</p>';
    } else if (tabId === 'tab-editor') {
        mainInner.innerHTML = '<h1>Editor</h1><p>Fill in your report data here.</p>';
    } else if (tabId === 'tab-view') {
        mainInner.innerHTML = '<h1>View Report</h1><p>Preview and export your final report.</p>';
    }
}

tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.id)));

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'F6') {
        e.preventDefault();
        const active = document.activeElement;
        let index = elements.findIndex(el => el.contains(active));
        let nextIndex = (index + 1) % elements.length;
        elements[nextIndex].focus();
    }
    if (e.ctrlKey && e.key === 'm') {
        document.querySelector('.app-container').classList.toggle('focus-mode');
    }
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
