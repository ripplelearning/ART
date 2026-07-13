// state.js

const defaultState = {
    reportTitle: "",
    orgClient: "",
    projectName: "",
    scopeUrl: "",
    auditDateStart: "",
    auditDateEnd: "",
    auditors: "",
    standard: "WCAG 2.2",
    testingInstructions: "",
    reportType: "",
    reportLayout: "",
    fieldsExpanded: false,
    templateOption: "",
    templateName: "",
    templateDescription: "",
    fields: [],
    editingIndex: -1,
    editorUsesReportTitle: false,
    editorReadOnly: false,
    editorFieldValues: {},
    userTemplates: [],
    templateEditingId: null,
    templateCreateMode: false,
    lastCreatedTemplateId: ""
};

const reportDefaults = {
    reportTitle: defaultState.reportTitle,
    orgClient: defaultState.orgClient,
    projectName: defaultState.projectName,
    scopeUrl: defaultState.scopeUrl,
    auditDateStart: defaultState.auditDateStart,
    auditDateEnd: defaultState.auditDateEnd,
    auditors: defaultState.auditors,
    standard: defaultState.standard,
    testingInstructions: defaultState.testingInstructions,
    reportType: defaultState.reportType,
    reportLayout: defaultState.reportLayout,
    fieldsExpanded: defaultState.fieldsExpanded,
    templateOption: defaultState.templateOption,
    templateName: defaultState.templateName,
    templateDescription: defaultState.templateDescription,
    fields: defaultState.fields
};

const builtInTemplates = [
    {
        id: 'builtin-audit-log-basic',
        name: 'Audit Log Basic',
        data: {
            ...reportDefaults,
            reportTitle: 'Audit Log Template',
            reportType: 'Audit Log',
            reportLayout: 'Tabular',
            fields: [
                { label: 'Page', type: 'text', dropdownOptions: [] },
                { label: 'Issue', type: 'textarea', dropdownOptions: [] },
                { label: 'Severity', type: 'dropdown', dropdownOptions: ['Low', 'Medium', 'High', 'Critical'] }
            ]
        }
    },
    {
        id: 'builtin-exec-summary-basic',
        name: 'Executive Summary Basic',
        data: {
            ...reportDefaults,
            reportTitle: 'Executive Summary Template',
            reportType: 'Executive Summary',
            reportLayout: 'Bullets',
            fields: [
                { label: 'Overview', type: 'textarea', dropdownOptions: [] },
                { label: 'Top Findings', type: 'textarea', dropdownOptions: [] },
                { label: 'Risk Level', type: 'dropdown', dropdownOptions: ['Low', 'Moderate', 'High'] }
            ]
        }
    }
];

function normalizeField(field) {
    const normalizedType = field?.type === 'select' ? 'dropdown' : field?.type || 'text';
    const dropdownOptions = Array.isArray(field?.dropdownOptions)
        ? field.dropdownOptions
        : typeof field?.dropdownOptions === 'string'
            ? field.dropdownOptions.split('\n')
            : [];

    return {
        ...field,
        type: normalizedType,
        dropdownOptions: dropdownOptions.map((option) => option.trim()).filter(Boolean)
    };
}

function normalizeTemplate(template) {
    return {
        id: template?.id || `user-${Date.now()}`,
        name: String(template?.name || 'Untitled Template').trim(),
        data: {
            ...reportDefaults,
            ...(template?.data || {}),
            fields: Array.isArray(template?.data?.fields)
                ? template.data.fields.map(normalizeField)
                : []
        }
    };
}

// Initializing the application state from local storage or defaults
const storedState = JSON.parse(localStorage.getItem('art-state')) || {};
export let appState = {
    ...defaultState,
    ...storedState,
    fields: Array.isArray(storedState.fields) ? storedState.fields.map(normalizeField) : [],
    userTemplates: Array.isArray(storedState.userTemplates)
        ? storedState.userTemplates.map(normalizeTemplate)
        : []
};

export function getBuiltInTemplates() {
    return builtInTemplates.map(normalizeTemplate);
}

export function getUserTemplates() {
    return appState.userTemplates.map(normalizeTemplate);
}

export function getTemplateById(templateId) {
    if (!templateId) return null;
    const allTemplates = [...getBuiltInTemplates(), ...getUserTemplates()];
    return allTemplates.find((template) => template.id === templateId) || null;
}

function captureCurrentReportData() {
    return {
        reportTitle: appState.reportTitle,
        orgClient: appState.orgClient,
        projectName: appState.projectName,
        scopeUrl: appState.scopeUrl,
        auditDateStart: appState.auditDateStart,
        auditDateEnd: appState.auditDateEnd,
        auditors: appState.auditors,
        standard: appState.standard,
        testingInstructions: appState.testingInstructions,
        reportType: appState.reportType,
        reportLayout: appState.reportLayout,
        fieldsExpanded: appState.fieldsExpanded,
        templateOption: appState.templateOption,
        templateName: appState.templateName,
        templateDescription: appState.templateDescription,
        fields: appState.fields.map((field) => normalizeField(field))
    };
}

function applyReportData(data) {
    const normalized = {
        ...reportDefaults,
        ...(data || {}),
        fields: Array.isArray(data?.fields) ? data.fields.map(normalizeField) : []
    };

    Object.assign(appState, normalized, {
        editingIndex: -1,
        editorReadOnly: false,
        editorFieldValues: {}
    });
    saveState();
}

export function resetReportToBlank() {
    applyReportData(reportDefaults);
    appState.templateEditingId = null;
    saveState();
}

export function loadTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    applyReportData(template.data);
    appState.templateEditingId = null;
    saveState();
    return template;
}

export function createUserTemplate(name, templateData) {
    const templateName = String(name || '').trim();
    if (!templateName) return null;

    const template = normalizeTemplate({
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: templateName,
        data: templateData || captureCurrentReportData()
    });
    appState.userTemplates.push(template);
    saveState();
    return template;
}

export function createUserTemplateFromSelection(templateId, name) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    return createUserTemplate(name, template.data);
}

export function deleteUserTemplate(templateId) {
    const idx = appState.userTemplates.findIndex((template) => template.id === templateId);
    if (idx < 0) return null;
    const removed = appState.userTemplates.splice(idx, 1)[0];
    saveState();
    return removed;
}

export function saveCurrentReportToUserTemplate(templateId) {
    const idx = appState.userTemplates.findIndex((template) => template.id === templateId);
    if (idx < 0) return null;

    const resolvedTemplateName = String(
        appState.templateName || appState.reportTitle || appState.userTemplates[idx].name || 'Untitled Template'
    ).trim();

    const updatedTemplate = normalizeTemplate({
        ...appState.userTemplates[idx],
        name: resolvedTemplateName,
        data: captureCurrentReportData()
    });
    appState.userTemplates[idx] = updatedTemplate;
    saveState();
    return updatedTemplate;
}

/**
 * Persists current state to local browser storage.
 */
export function saveState() {
    localStorage.setItem('art-state', JSON.stringify(appState));
}

/**
 * Updates an announcer element (for screen readers).
 */
export function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (!announcer) return;

    // Clear first so repeated/rapid messages still get announced by AT.
    announcer.textContent = '';
    window.setTimeout(() => {
        announcer.textContent = msg;
    }, 20);
}

/**
 * Updates a specific metadata field and persists the change.
 */
export function updateHeader(key, val) {
    appState[key] = val;
    saveState();
}

/**
 * Updates a specific editor field value and persists the change.
 */
export function updateEditorFieldValue(index, value) {
    appState.editorFieldValues[index] = value;
    saveState();
}

// --- Field Management Logic ---

/**
 * Adds a new field or updates an existing one based on editingIndex.
 */
export function addOrUpdateField() {
    const labelInput = document.getElementById('field-label-input');
    const typeInput = document.getElementById('field-type-input');
    const optionsInput = document.getElementById('field-dropdown-options-input');
    
    if (!labelInput || !labelInput.value) return;

    const typeValue = typeInput?.value === 'select' ? 'dropdown' : typeInput?.value || 'text';
    const dropdownOptions = typeValue === 'dropdown' && optionsInput
        ? optionsInput.value.split('\n').map((option) => option.trim()).filter(Boolean)
        : [];
    const fieldData = {
        label: labelInput.value,
        type: typeValue,
        dropdownOptions
    };

    if (appState.editingIndex === -1) {
        // Add new field
        appState.fields.push(fieldData);
        announce(`Added field ${labelInput.value}`);
    } else {
        // Update existing field
        appState.fields[appState.editingIndex] = fieldData;
        appState.editingIndex = -1; // Reset mode
        announce("Field updated");
    }
    
    saveState();
}

/**
 * Sets the builder into edit mode for a specific field.
 */
export function setEditMode(index) {
    appState.editingIndex = index;
    const field = appState.fields[index];

    announce(`Editing ${field.label}`);
}

/**
 * Removes a field from the state.
 */
export function deleteField(index) {
    const removed = appState.fields.splice(index, 1);
    saveState();
    announce(`Deleted ${removed[0].label}`);
}

/**
 * Moves a field up or down in the array.
 */
export function moveField(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= appState.fields.length) return;

    const adjacentField = appState.fields[newIdx];
    const referenceLabel = adjacentField?.label || appState.fields[index]?.label || 'field';
    
    const field = appState.fields.splice(index, 1)[0];
    appState.fields.splice(newIdx, 0, field);
    saveState();
    announce(`Moved ${direction < 0 ? 'before' : 'after'} ${referenceLabel}`);
    return newIdx;
}
