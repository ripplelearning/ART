import { appState, saveState, updateEditorFieldValue } from './state.js';

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getEditorHeadingText() {
    if (!appState.editorUsesReportTitle) return 'Report Editor';
    return appState.reportTitle?.trim() || 'Report Editor';
}

function renderMetadataPlainText() {
    const metadata = [
        ['Report Title', appState.reportTitle],
        ['Organization/Client', appState.orgClient],
        ['Project Name', appState.projectName],
        ['URL / Scope', appState.scopeUrl],
        ['Audit Start', appState.auditDateStart],
        ['Audit End', appState.auditDateEnd],
        ['Auditor(s)', appState.auditors],
        ['Accessibility Standard', appState.standard],
        ['Testing Instructions', appState.testingInstructions],
        ['Report Type', appState.reportType],
        ['Report Layout', appState.reportLayout],
        ['Template Option', appState.templateOption],
        ['Template Name', appState.templateName],
        ['Template Description', appState.templateDescription]
    ];

    const visibleRows = metadata.filter(([, value]) => String(value || '').trim() !== '');
    if (visibleRows.length === 0) return '';

    return `
        <dl class="editor-metadata-list" aria-label="Report metadata values">
            ${visibleRows.map(([label, value]) => `
                <div class="editor-metadata-item">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${escapeHtml(value)}</dd>
                </div>
            `).join('')}
        </dl>
    `;
}

function renderFieldControl(field, index) {
    const type = normalizeFieldType(field.type);
    const storedValue = appState.editorFieldValues[index] ?? '';
    const readOnlyAttrs = appState.editorReadOnly ? ' readonly aria-readonly="true"' : '';

    if (type === 'textarea') {
        return `<textarea id="editor-field-${index}" data-editor-field-index="${index}"${readOnlyAttrs}>${escapeHtml(storedValue)}</textarea>`;
    }

    if (type === 'dropdown') {
        const options = Array.isArray(field.dropdownOptions) ? field.dropdownOptions : [];
        return `
            <select id="editor-field-${index}" data-editor-field-index="${index}" aria-label="${escapeHtml(field.label)}" aria-describedby="editor-select-help" ${appState.editorReadOnly ? 'disabled aria-disabled="true"' : ''}>
                <option value="">Select an option</option>
                ${options.map((option) => {
                    const selected = String(storedValue) === String(option) ? 'selected' : '';
                    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
                }).join('')}
            </select>
        `;
    }

    return `<input type="text" id="editor-field-${index}" data-editor-field-index="${index}" value="${escapeHtml(storedValue)}"${readOnlyAttrs}>`;
}

export function renderEditor() {
    const container = document.getElementById('main-inner');
    const editorHeading = getEditorHeadingText();

    container.innerHTML = `
        <section id="editor-view">
            <h2 id="editor-heading" tabindex="-1">${escapeHtml(editorHeading)}</h2>
            <p id="editor-select-help" class="sr-only">Use Up and Down arrow keys to review options, then Enter to confirm.</p>
            ${renderMetadataPlainText()}
            <div class="editor-fields-grid">
                ${appState.fields.map((field, index) => `
                    <label for="editor-field-${index}">${escapeHtml(field.label)}</label>
                    ${renderFieldControl(field, index)}
                `).join('')}
            </div>
        </section>
    `;

    container.querySelectorAll('[data-editor-field-index]').forEach((control) => {
        const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
        control.addEventListener(eventName, (event) => {
            const index = Number(event.target.getAttribute('data-editor-field-index'));
            updateEditorFieldValue(index, event.target.value);
        });
    });

    const heading = document.getElementById('editor-heading');
    if (heading) {
        window.setTimeout(() => {
            heading.focus();
        }, 0);
    }

    saveState();
}
