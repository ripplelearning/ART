// state.js
export let appState = JSON.parse(localStorage.getItem('art-state')) || {
    reportTitle: "", projectName: "", scopeUrl: "", auditDateStart: "", 
    auditDateEnd: "", auditors: "", standard: "WCAG 2.2", 
    testingInstructions: "", fields: [], editingIndex: -1
};

export function saveState() {
    localStorage.setItem('art-state', JSON.stringify(appState));
}

export function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = msg;
}

export function updateHeader(key, val) {
    appState[key] = val;
    saveState();
}
