let appState = { 
    id: null, reportType: 'audit-log', reportTitle: "", projectName: "", environment: "Production",
    scopeUrl: "", auditDate: new Date().toISOString().split('T')[0], auditors: "", standard: "WCAG 2.2",
    fields: [], editingIndex: -1, editorContent: "", lastModified: Date.now() 
};

// --- Helpers ---
function saveState() { 
    appState.lastModified = Date.now(); 
    localStorage.setItem('art-state', JSON.stringify(appState)); 
}

function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (announcer) announcer.textContent = msg;
}

// --- Field Management Logic ---
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

// --- Renderers ---
function renderBuilder() {
    const mainInner = document.getElementById('main-inner');
    if (!mainInner) return;

    mainInner.innerHTML = `
        <h1>Manage Report Structure</h1>
        <div role="status" aria-live="polite" id="announcer" class="sr-only"></div>
        <section>
            <h2>Report Metadata</h2>
            <label>Field Label: <input type="text" id="field-label-input"></label>
            <label>Field Type: 
                <select id="field-type-input">
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                </select>
            </label>
            <button id="btn-add-field">${appState.editingIndex === -1 ? 'Add Field' : 'Apply Changes'}</button>
        </section>
        <table>
            <caption>List of fields included in the report</caption>
            <thead>
                <tr>
                    <th scope="col">Field Label</th>
                    <th scope="col">Field Type</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody id="fields-tbody"></tbody>
        </table>
        <button id="btn-done">Done</button>`;

    const tbody = document.getElementById('fields-tbody');
    appState.fields.forEach((f, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.label}</td><td>${f.type}</td>
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
    renderBuilder();
});
