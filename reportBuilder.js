// reportBuilder.js
import { appState, updateHeader, addOrUpdateField, setEditMode, deleteField, saveState } from './state.js';

export function renderBuilder() {
    const container = document.getElementById('main-inner');
    const reportLayouts = {
        'Audit Log': ['Paragraphs', 'Tabular', 'Template'],
        'Executive Summary': ['Paragraphs', 'Bullets', 'Template']
    };
    const selectedLayouts = appState.reportType ? reportLayouts[appState.reportType] || [] : [];
    const templateOptions = appState.reportType === 'Audit Log'
        ? [{ value: 'Create Template', label: 'Create Template' }, { value: 'Choose Template', label: 'Choose Template' }]
        : appState.reportType === 'Executive Summary'
            ? [{ value: 'Create New', label: 'Create New' }, { value: 'Upload from File', label: 'Upload from File' }]
            : [];
    const showTemplateSection = appState.reportLayout === 'Template' && !!appState.reportType;

    container.innerHTML = `
        <section id="builder-view">
            <h2>Report Builder</h2>
            <h3>Report Metadata</h3>
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
                <label>Report Type:
                    <select id="report-type-select">
                        <option value="" ${!appState.reportType ? 'selected' : ''}>Select Report Type</option>
                        <option value="Audit Log" ${appState.reportType === 'Audit Log' ? 'selected' : ''}>Audit Log</option>
                        <option value="Executive Summary" ${appState.reportType === 'Executive Summary' ? 'selected' : ''}>Executive Summary</option>
                    </select>
                </label>
                <label>Report Layout:
                    <select id="report-layout-select" ${appState.reportType ? '' : 'disabled'}>
                        <option value="" ${!appState.reportLayout ? 'selected' : ''}>Select Report Layout</option>
                        ${selectedLayouts.map((layout) => `<option value="${layout}" ${appState.reportLayout === layout ? 'selected' : ''}>${layout}</option>`).join('')}
                    </select>
                </label>
            </div>

            ${showTemplateSection ? `
                <div id="template-config-section" class="template-config">
                    <label>Template Option:
                        <select id="template-option-select">
                            <option value="" ${!appState.templateOption ? 'selected' : ''}>Select Option</option>
                            ${templateOptions.map((option) => `<option value="${option.value}" ${appState.templateOption === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                        </select>
                    </label>
                    ${appState.templateOption === 'Create Template' || appState.templateOption === 'Create New' ? `
                        <label>Template Name: <input type="text" id="template-name-input" value="${appState.templateName || ''}"></label>
                        <label>Template Description: <textarea id="template-description-input">${appState.templateDescription || ''}</textarea></label>
                    ` : ''}
                    ${appState.templateOption === 'Choose Template' ? `
                        <label>Choose Template: <select id="choose-template-select"><option value="">Choose Template</option></select></label>
                    ` : ''}
                    ${appState.templateOption === 'Upload from File' ? `
                        <label>Upload from File: <input type="file" id="template-file-input"></label>
                    ` : ''}
                </div>
            ` : ''}

            <button id="btn-toggle-config" type="button" aria-expanded="${appState.fieldsExpanded}" aria-controls="fields-section">
                ${appState.fieldsExpanded ? 'Hide Field Configuration' : 'Configure Report Fields'}
            </button>
            
            <section id="fields-section" ${appState.fieldsExpanded ? '' : 'hidden'}>
                <h3>Report Fields</h3>
                <label>Field Label: <input type="text" id="field-label-input"></label>
                <label>Field Type: <select id="field-type-input">
                    <option value="text">Text</option><option value="textarea">Textarea</option><option value="select">Select</option>
                </select></label>
                <button id="btn-add-field" type="button">${appState.editingIndex === -1 ? 'Add Field' : 'Apply Changes'}</button>
                <table>
                    <thead><tr><th scope="col">Field Label</th><th scope="col">Field Type</th><th scope="col">Actions</th></tr></thead>
                    <tbody id="fields-tbody"></tbody>
                </table>
            </section>
            <button id="btn-done" type="button">Done</button>
        </section>
    `;

    // --- Listeners ---
    const toggleConfigButton = document.getElementById('btn-toggle-config');
    if (toggleConfigButton) {
        toggleConfigButton.onclick = () => {
            appState.fieldsExpanded = !appState.fieldsExpanded;
            saveState();
            renderBuilder();
        };
    }

    const metadataFields = [
        ['report-title', 'reportTitle'],
        ['org-client', 'orgClient'],
        ['project-name', 'projectName'],
        ['scope-url', 'scopeUrl'],
        ['date-start', 'auditDateStart'],
        ['date-end', 'auditDateEnd'],
        ['auditors', 'auditors'],
        ['testing-instructions', 'testingInstructions']
    ];

    metadataFields.forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => updateHeader(key, e.target.value));
        }
    });

    const standardSelect = document.getElementById('standard-select');
    if (standardSelect) {
        standardSelect.addEventListener('change', (e) => updateHeader('standard', e.target.value));
    }

    const reportTypeSelect = document.getElementById('report-type-select');
    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', (e) => {
            appState.reportType = e.target.value;
            appState.reportLayout = '';
            appState.templateOption = '';
            appState.templateName = '';
            appState.templateDescription = '';
            saveState();
            renderBuilder();
        });
    }

    const reportLayoutSelect = document.getElementById('report-layout-select');
    if (reportLayoutSelect) {
        reportLayoutSelect.addEventListener('change', (e) => {
            appState.reportLayout = e.target.value;
            if (e.target.value !== 'Template') {
                appState.templateOption = '';
                appState.templateName = '';
                appState.templateDescription = '';
            }
            saveState();
            renderBuilder();
        });
    }

    const templateOptionSelect = document.getElementById('template-option-select');
    if (templateOptionSelect) {
        templateOptionSelect.addEventListener('change', (e) => {
            appState.templateOption = e.target.value;
            if (e.target.value !== 'Create Template' && e.target.value !== 'Create New') {
                appState.templateName = '';
                appState.templateDescription = '';
            }
            saveState();
            renderBuilder();
        });
    }

    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput) {
        templateNameInput.addEventListener('input', (e) => {
            appState.templateName = e.target.value;
            saveState();
        });
    }

    const templateDescriptionInput = document.getElementById('template-description-input');
    if (templateDescriptionInput) {
        templateDescriptionInput.addEventListener('input', (e) => {
            appState.templateDescription = e.target.value;
            saveState();
        });
    }

    document.getElementById('btn-add-field').addEventListener('click', () => {
        addOrUpdateField();
        renderBuilder();
    });

    const doneButton = document.getElementById('btn-done');
    if (doneButton) {
        doneButton.addEventListener('click', () => {
            document.getElementById('tab-welcome').click();
        });
    }

    // Populate Table Logic
    const tbody = document.getElementById('fields-tbody');
    if (tbody) {
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
}
