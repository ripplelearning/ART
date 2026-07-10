// reportBuilder.js
import { appState, updateHeader, addOrUpdateField, setEditMode, deleteField } from './state.js';

let showFields = false; // Local state for toggle

export function renderBuilder() {
    const container = document.getElementById('main-inner');

    container.innerHTML = `
        <section id="builder-view">
            <h2>Report Metadata</h2>
            <div class="metadata-grid">
                <label>Report Title: <input type="text" id="report-title" value="${appState.reportTitle || ''}"></label>
                <label>Organization/Client: <input type="text" id="org-client" value="${appState.orgClient || ''}"></label>
                <label>Project Name: <input type="text" id="project-name" value="${appState.projectName || ''}"></label>
                <label>URL / Scope: <input type="text" id="scope-url" value="${appState.scopeUrl || ''}"></label>
                <label>Audit Start: <input type="date" id="date-start" value="${appState.auditDateStart || ''}"></label>
                <label>Audit End: <input type="date" id="date-end" value="${appState.auditDateEnd || ''}"></label>
                <label>Auditor(s): <input type="text" id="auditors" value="${appState.auditors || ''}"></label>
                <label>Accessibility Standard:
                    <select id="standard-select">
                        <option value="WCAG 2.2" ${appState.standard === 'WCAG 2.2' ? 'selected' : ''}>WCAG 2.2</option>
                        <option value="WCAG 2.1" ${appState.standard === 'WCAG 2.1' ? 'selected' : ''}>WCAG 2.1</option>
                        <option value="WCAG 2.0" ${appState.standard === 'WCAG 2.0' ? 'selected' : ''}>WCAG 2.0</option>
                    </select>
                </label>
                <label>Testing Instructions: <textarea id="testing-instructions">${appState.testingInstructions || ''}</textarea></label>
            </div>

            <button id="btn-toggle-config" aria-expanded="${showFields}">
                ${showFields ? 'Hide Field Configuration' : 'Configure Report Fields'}
            </button>
            
            <section id="fields-section" style="display: ${showFields ? 'block' : 'none'};">
                <h2>Report Fields</h2>
                <label>Field Label: <input type="text" id="field-label-input"></label>
                <label>Field Type: <select id="field-type-input">
                    <option value="text">Text</option><option value="textarea">Textarea</option><option value="select">Select</option>
                </select></label>
                <button id="btn-add-field">${appState.editingIndex === -1 ? 'Add Field' : 'Apply Changes'}</button>
                <table>
                    <thead><tr><th scope="col">Field Label</th><th scope="col">Field Type</th><th scope="col">Actions</th></tr></thead>
                    <tbody id="fields-tbody"></tbody>
                </table>
            </section>
            <button id="btn-done">Done</button>
        </section>
    `;

    // --- Listeners ---
    document.getElementById('btn-toggle-config').onclick = () => {
        showFields = !showFields;
        renderBuilder();
    };

    document.getElementById('report-title').addEventListener('input', (e) => updateHeader('reportTitle', e.target.value));
    document.getElementById('org-client').addEventListener('input', (e) => updateHeader('orgClient', e.target.value));
    document.getElementById('project-name').addEventListener('input', (e) => updateHeader('projectName', e.target.value));
    // (Repeat for other fields...)

    document.getElementById('btn-add-field').addEventListener('click', () => {
        addOrUpdateField();
        renderBuilder();
    });

    document.getElementById('btn-done').addEventListener('click', () => {
        document.getElementById('tab-welcome').click();
    });

    // Populate Table Logic
    const tbody = document.getElementById('fields-tbody');
    appState.fields.forEach((f, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.label}</td><td>${f.type}</td>
            <td id="actions-${i}"></td>`;
        tbody.appendChild(tr);

        const btnEdit = document.createElement('button');
        btnEdit.innerText = 'Edit';
        btnEdit.onclick = () => { setEditMode(i); renderBuilder(); };
        
        const btnDelete = document.createElement('button');
        btnDelete.innerText = 'Delete';
        btnDelete.onclick = () => { deleteField(i); renderBuilder(); };

        document.getElementById(`actions-${i}`).append(btnEdit, btnDelete);
    });
}
