let appState = { 
    id: null, reportType: 'audit-log', reportTitle: "", projectName: "", environment: "Production",
    scopeUrl: "", auditDateStart: new Date().toISOString().split('T')[0], 
    auditDateEnd: new Date().toISOString().split('T')[0], auditors: "", 
    standard: "WCAG 2.2", testingInstructions: "",
    fields: [], editingIndex: -1, lastModified: Date.now() 
};

// --- Core Helpers ---
function saveState() { 
    appState.lastModified = Date.now(); 
    localStorage.setItem('art-state', JSON.stringify(appState)); 
}

function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = msg;
}

function updateHeader(key, val) {
    appState[key] = val;
    saveState();
}

function navigateTo(view) {
    if (view === 'dashboard') renderDashboard();
    else renderBuilder();
}

// --- Dashboard Logic ---
function renderDashboard() {
    const mainInner = document.getElementById('main-inner');
    mainInner.innerHTML = `
        <h1>Dashboard</h1>
        <section id="dashboard">
            <button onclick="createNewReport()">New Report</button>
            <button onclick="document.getElementById('file-picker').click()">Open Existing Report JSON File</button>
            <input type="file" id="file-picker" style="display:none" accept=".json" onchange="handleFileUpload(event)">
        </section>`;
}

function createNewReport() {
    appState = { ...appState, fields: [], reportTitle: "", projectName: "", testingInstructions: "" };
    renderBuilder();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        appState = JSON.parse(e.target.result);
        renderBuilder();
    };
    reader.readAsText(file);
}

// --- Builder Logic (Metadata + Table) ---
function addOrUpdateField() {
    const labelInput = document.getElementById('field-label-input');
    const typeInput = document.getElementById('field-type-input');
    if (!labelInput.value) return;

    if (appState.editingIndex === -1) {
        appState.fields.push({ id: Date.now().toString(), label: labelInput.value, type: typeInput.value });
        announce(`Added ${labelInput.value} field.`);
    } else {
        appState.fields[appState.editingIndex] = { ...appState.fields[appState.editingIndex], label: labelInput.value, type: typeInput.value };
        announce(`Changes applied to ${labelInput.value} field.`);
        appState.editingIndex = -1;
    }
    labelInput.value = "";
    saveState(); 
    renderBuilder();
    document.getElementById('field-label-input').focus();
}

function deleteField(index, label) {
    appState.fields.splice(index, 1);
    saveState(); 
    renderBuilder();
    announce(`Deleted ${label} field.`);
}

function setEditMode(index) {
    appState.editingIndex = index;
    renderBuilder();
    const field = appState.fields[index];
    const labelInput = document.getElementById('field-label-input');
    labelInput.value = field.label;
    document.getElementById('field-type-input').value = field.type;
    labelInput.focus();
    announce(`Editing ${field.label} field.`);
}

function moveField(index, direction) {
    const newIdx = index + direction;
    [appState.fields[index], appState.fields[newIdx]] = [appState.fields[newIdx], appState.fields[index]];
    saveState(); 
    renderBuilder();
    announce(`${appState.fields[newIdx].label} moved.`);
}

function renderBuilder() {
    const mainInner = document.getElementById('main-inner');
    mainInner.innerHTML = `
        <h1>Manage Report Structure</h1>
        <div role="status" aria-live="polite" id="announcer" class="sr-only"></div>
        <section id="metadata-section">
            <h2>Report Metadata</h2>
            <label>Report Title: <input type="text" value="${appState.reportTitle || ''}" oninput="updateHeader('reportTitle', this.value)"></label>
            <label>Project Name: <input type="text" value="${appState.projectName || ''}" oninput="updateHeader('projectName', this.value)"></label>
            <label>URL / Scope: <input type="text" value="${appState.scopeUrl || ''}" oninput="updateHeader('scopeUrl', this.value)"></label>
            <label>Audit Start: <input type="date" value="${appState.auditDateStart || ''}" oninput="updateHeader('auditDateStart', this.value)"></label>
            <label>Audit End: <input type="date" value="${appState.auditDateEnd || ''}" oninput="updateHeader('auditDateEnd', this.value)"></label>
            <label>Auditor(s): <input type="text" value="${appState.auditors || ''}" oninput="updateHeader('auditors', this.value)"></label>
            <label>Accessibility Standard:
                <select onchange="updateHeader('standard', this.value)">
                    <option value="WCAG 2.2" ${appState.standard === 'WCAG 2.2' ? 'selected' : ''}>WCAG 2.2</option>
                    <option value="WCAG 2.1" ${appState.standard === 'WCAG 2.1' ? 'selected' : ''}>WCAG 2.1</option>
                    <option value="WCAG 2.0" ${appState.standard === 'WCAG 2.0' ? 'selected' : ''}>WCAG 2.0</option>
                </select>
            </label>
            <label>Testing Instructions: <textarea oninput="updateHeader('testingInstructions', this.value)">${appState.testingInstructions || ''}</textarea></label>
        </section>
        <section id="fields-section">
            <h2>Report Fields</h2>
            <label>Field Label: <input type="text" id="field-label-input"></label>
            <label>Field Type: <select id="field-type-input"><option value="text">Text</option><option value="textarea">Textarea</option><option value="select">Select</option></select></label>
            <button id="btn-add-field">${appState.editingIndex === -1 ? 'Add Field' : 'Apply Changes'}</button>
            <table>
                <caption>List of fields included in the report</caption>
                <thead><tr><th scope="col">Field Label</th><th scope="col">Field Type</th><th scope="col">Actions</th></tr></thead>
                <tbody id="fields-tbody"></tbody>
            </table>
        </section>
        <button id="btn-done" onclick="navigateTo('dashboard')">Done</button>`;

    const tbody = document.getElementById('fields-tbody');
    appState.fields.forEach((f, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.label}</td><td>${f.type}</td>
            <td>
                <button aria-label="Edit ${f.label} field" onclick="setEditMode(${i})">Edit</button>
                <button aria-label="Delete ${f.label} field" onclick="deleteField(${i}, '${f.label}')">Delete</button>
                <button ${i===0?'disabled':''} aria-label="Move ${f.label} up" onclick="moveField(${i}, -1)">Up</button>
                <button ${i===appState.fields.length-1?'disabled':''} aria-label="Move ${f.label} down" onclick="moveField(${i}, 1)">Down</button>
            </td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('btn-add-field').onclick = addOrUpdateField;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('art-state');
    if (saved) appState = JSON.parse(saved);
    renderDashboard();

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const regions = [document.querySelector('nav'), document.getElementById('dashboard'), document.querySelector('main')].filter(r => r !== null);
            let activeIndex = regions.findIndex(r => r.contains(document.activeElement));
            let nextIndex = (activeIndex === -1 || activeIndex >= regions.length - 1) ? 0 : activeIndex + 1;
            const target = regions[nextIndex].querySelector('button, input, select, textarea, [tabindex]') || regions[nextIndex];
            target.focus();
        }
    });
});
