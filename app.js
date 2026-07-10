let appState = { 
    id: null, reportType: 'audit-log', reportTitle: "", projectName: "", environment: "Production",
    scopeUrl: "", auditDate: new Date().toISOString().split('T')[0], auditors: "", standard: "WCAG 2.2",
    fields: [], editingIndex: -1, editorContent: "", lastModified: Date.now() 
};

function saveState() { appState.lastModified = Date.now(); localStorage.setItem('art-state', JSON.stringify(appState)); updateRecentReports(); }
function updateHeader(key, val) { appState[key] = val; saveState(); }
function announce(msg) { document.getElementById('announcer').textContent = msg; }

// --- Field Logic ---
function addOrUpdateField() {
    const label = document.getElementById('field-label-input').value;
    const type = document.getElementById('field-type-input').value;
    if (!label) return;

    if (appState.editingIndex === -1) {
        appState.fields.push({ id: Date.now().toString(), label, type });
        announce(`Added ${label} field.`);
    } else {
        appState.fields[appState.editingIndex] = { ...appState.fields[appState.editingIndex], label, type };
        announce(`Changes applied to ${label} field.`);
        appState.editingIndex = -1;
    }
    saveState(); renderBuilder();
}

function deleteField(index, label) {
    appState.fields.splice(index, 1);
    saveState(); renderBuilder();
    announce(`Deleted ${label} field.`);
    // Focus management after delete
    const nextBtn = document.querySelector(`[data-index="${index}"]`) || document.querySelector(`[data-index="${index-1}"]`) || document.getElementById('field-label-input');
    nextBtn?.focus();
}

function setEditMode(index) {
    appState.editingIndex = index;
    renderBuilder();
    const field = appState.fields[index];
    document.getElementById('field-label-input').value = field.label;
    document.getElementById('field-type-input').value = field.type;
    document.getElementById('btn-add-field').textContent = "Apply Changes";
    document.getElementById('field-label-input').focus();
    announce(`Editing ${field.label} field.`);
}

function moveField(index, direction) {
    const newIdx = index + direction;
    [appState.fields[index], appState.fields[newIdx]] = [appState.fields[newIdx], appState.fields[index]];
    saveState(); renderBuilder();
    announce(`${appState.fields[newIdx].label} moved to position ${newIdx + 1}.`);
    document.querySelector(`[data-move="${newIdx}"][data-dir="${direction === -1 ? 'up' : 'down'}"]`)?.focus();
}

// --- Renderers ---
const renderBuilder = () => {
    const mainInner = document.getElementById('main-inner');
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
                <button data-index="${i}" aria-label="Delete ${f.label} field" onclick="deleteField(${i}, '${f.label}')">Delete</button>
                <button data-move="${i}" data-dir="up" ${i===0?'disabled':''} aria-label="Move ${f.label} up" onclick="moveField(${i}, -1)">Up</button>
                <button data-move="${i}" data-dir="down" ${i===appState.fields.length-1?'disabled':''} aria-label="Move ${f.label} down" onclick="moveField(${i}, 1)">Down</button>
            </td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('btn-add-field').onclick = () => { addOrUpdateField(); document.getElementById('field-label-input').focus(); };
    document.getElementById('btn-done').onclick = () => { if(appState.fields.length === 0) announce("No fields defined."); };
};
