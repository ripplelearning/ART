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
    auditEntries: [],
    activeAuditEntryIndex: 0,
    reports: [],
    selectedReportId: '',
    userTemplates: [],
    templateEditingId: null,
    templateCreateMode: false,
    lastCreatedTemplateId: "",
    branding: {
        enabled: false,
        headerText: "",
        primaryColor: "#005a9c",
        logoDataUrl: "",
        logoAltText: "",
        logoDecorative: false,
        logoFileName: ""
    }
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
    fields: defaultState.fields,
    branding: defaultState.branding
};

function normalizeBranding(branding) {
    const toBool = (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return Boolean(value);
    };

    const rawColor = String(branding?.primaryColor || defaultState.branding.primaryColor);
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : defaultState.branding.primaryColor;

    return {
        ...defaultState.branding,
        ...(branding && typeof branding === 'object' ? branding : {}),
        enabled: toBool(branding?.enabled),
        headerText: String(branding?.headerText || ''),
        primaryColor: safeColor,
        logoDataUrl: String(branding?.logoDataUrl || ''),
        logoAltText: String(branding?.logoAltText || ''),
        logoDecorative: toBool(branding?.logoDecorative),
        logoFileName: String(branding?.logoFileName || '')
    };
}

function normalizeStandardValue(value) {
    return value === 'WCAG 2.1' ? 'WCAG 2.1' : 'WCAG 2.2';
}

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

function normalizeEditorFieldValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    if (!('identifier' in value) && !('number' in value) && !('title' in value)) return value;

    return {
        standard: String(value.standard || ''),
        identifier: String(value.identifier || ''),
        number: String(value.number || ''),
        title: String(value.title || ''),
        level: String(value.level || ''),
        understandingUrl: String(value.understandingUrl || ''),
        recommendationUrl: String(value.recommendationUrl || '')
    };
}

function normalizeEditorFieldValues(values) {
    if (!values || typeof values !== 'object') return {};
    const normalized = {};
    Object.entries(values).forEach(([key, value]) => {
        normalized[key] = normalizeEditorFieldValue(value);
    });
    return normalized;
}

function createBlankFieldValues(fields) {
    const values = {};
    (fields || []).forEach((field, index) => {
        values[index] = '';
    });
    return values;
}

function normalizeAuditEntry(entry, fields, fallbackId) {
    const fieldValues = normalizeEditorFieldValues(entry?.fieldValues);
    const normalizedFieldValues = { ...createBlankFieldValues(fields), ...fieldValues };
    return {
        id: String(entry?.id || fallbackId || `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
        fieldValues: normalizedFieldValues
    };
}

function normalizeAuditEntries(entries, fields, legacyEditorValues) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) {
        return [normalizeAuditEntry({ fieldValues: normalizeEditorFieldValues(legacyEditorValues) }, fields, 'entry-1')];
    }
    return list.map((entry, index) => normalizeAuditEntry(entry, fields, `entry-${index + 1}`));
}

function normalizeSavedReport(report, index) {
    const rawData = report?.data && typeof report.data === 'object' ? report.data : {};
    const fields = Array.isArray(rawData.fields) ? rawData.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(rawData.editorFieldValues);
    const auditEntries = normalizeAuditEntries(rawData.auditEntries, fields, editorFieldValues);

    return {
        id: String(report?.id || `report-${Date.now()}-${index}`),
        name: String(report?.name || rawData.reportTitle || `Untitled Report ${index + 1}`),
        updatedAt: Number(report?.updatedAt || Date.now()),
        data: {
            ...reportDefaults,
            ...rawData,
            branding: normalizeBranding(rawData.branding),
            fields,
            editorFieldValues,
            auditEntries,
            activeAuditEntryIndex: Number(rawData.activeAuditEntryIndex || 0)
        }
    };
}

function normalizeReports(reports) {
    if (!Array.isArray(reports)) return [];
    return reports.map(normalizeSavedReport);
}

function normalizeTemplate(template) {
    const metadata = template?.metadata && typeof template.metadata === 'object'
        ? template.metadata
        : {};

    return {
        id: template?.id || `user-${Date.now()}`,
        name: String(template?.name || 'Untitled Template').trim(),
        metadata: {
            schemaVersion: String(metadata.schemaVersion || '1.0'),
            exportedAt: String(metadata.exportedAt || ''),
            source: String(metadata.source || '')
        },
        data: {
            ...reportDefaults,
            ...(template?.data || {}),
            branding: normalizeBranding(template?.data?.branding),
            fields: Array.isArray(template?.data?.fields)
                ? template.data.fields.map(normalizeField)
                : []
        }
    };
}

// Initializing the application state from local storage or defaults
const storedState = JSON.parse(localStorage.getItem('art-state')) || {};
const normalizedInitialFields = Array.isArray(storedState.fields) ? storedState.fields.map(normalizeField) : [];
const normalizedInitialEditorValues = normalizeEditorFieldValues(storedState.editorFieldValues);
export let appState = {
    ...defaultState,
    ...storedState,
    standard: normalizeStandardValue(storedState.standard),
    branding: normalizeBranding(storedState.branding),
    fields: normalizedInitialFields,
    editorFieldValues: normalizedInitialEditorValues,
    auditEntries: normalizeAuditEntries(storedState.auditEntries, normalizedInitialFields, normalizedInitialEditorValues),
    reports: normalizeReports(storedState.reports),
    selectedReportId: String(storedState.selectedReportId || ''),
    userTemplates: Array.isArray(storedState.userTemplates)
        ? storedState.userTemplates.map(normalizeTemplate)
        : []
};

function normalizeStateSnapshot(rawState) {
    const base = {
        ...defaultState,
        ...(rawState || {})
    };
    const fields = Array.isArray(base.fields) ? base.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(base.editorFieldValues);
    return {
        ...base,
        branding: normalizeBranding(base.branding),
        standard: normalizeStandardValue(base.standard),
        fields,
        editorFieldValues,
        auditEntries: normalizeAuditEntries(base.auditEntries, fields, editorFieldValues),
        reports: normalizeReports(base.reports),
        selectedReportId: String(base.selectedReportId || ''),
        userTemplates: Array.isArray(base.userTemplates)
            ? base.userTemplates.map(normalizeTemplate)
            : []
    };
}

let isHistoryRestoreInProgress = false;
let pendingHistoryAction = 'Updated report state';
let lastSavedSnapshot = JSON.stringify(appState);
const undoStack = [];
const redoStack = [];
const MAX_HISTORY_ENTRIES = 100;

function pushUndoSnapshot(previousSnapshot) {
    undoStack.push({
        snapshot: previousSnapshot,
        action: pendingHistoryAction
    });
    if (undoStack.length > MAX_HISTORY_ENTRIES) undoStack.shift();
}

function persistCurrentState() {
    localStorage.setItem('art-state', JSON.stringify(appState));
}

function setAppStateFromSnapshot(snapshot) {
    const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    appState = normalizeStateSnapshot(parsed);
    lastSavedSnapshot = JSON.stringify(appState);
    persistCurrentState();
    window.dispatchEvent(new CustomEvent('art-state-restored'));
}

function getCurrentReportSnapshotData() {
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
        templateOption: appState.templateOption,
        templateName: appState.templateName,
        templateDescription: appState.templateDescription,
        branding: normalizeBranding(appState.branding),
        fields: appState.fields.map((field) => normalizeField(field)),
        editorFieldValues: normalizeEditorFieldValues(appState.editorFieldValues),
        auditEntries: normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues),
        activeAuditEntryIndex: Number(appState.activeAuditEntryIndex || 0)
    };
}

function getUniqueReportName(baseName) {
    const safeBase = String(baseName || 'Untitled Report').trim() || 'Untitled Report';
    const existing = new Set((appState.reports || []).map((report) => String(report.name || '').toLowerCase()));
    if (!existing.has(safeBase.toLowerCase())) return safeBase;
    let suffix = 2;
    let candidate = `${safeBase} (${suffix})`;
    while (existing.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${safeBase} (${suffix})`;
    }
    return candidate;
}

function getUniqueTemplateName(baseName) {
    const safeBase = String(baseName || 'Untitled Template').trim() || 'Untitled Template';
    const existing = new Set([
        ...getBuiltInTemplates().map((template) => String(template.name || '').toLowerCase()),
        ...(appState.userTemplates || []).map((template) => String(template.name || '').toLowerCase())
    ]);

    if (!existing.has(safeBase.toLowerCase())) return safeBase;

    let suffix = 2;
    let candidate = `${safeBase} (${suffix})`;
    while (existing.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${safeBase} (${suffix})`;
    }
    return candidate;
}

function getReportDisplayName() {
    return String(appState.reportTitle || appState.templateName || 'Untitled Report').trim() || 'Untitled Report';
}

function getDefaultMetadataObject() {
    return {
        reportTitle: defaultState.reportTitle,
        orgClient: defaultState.orgClient,
        projectName: defaultState.projectName,
        scopeUrl: defaultState.scopeUrl,
        auditDateStart: defaultState.auditDateStart,
        auditDateEnd: defaultState.auditDateEnd,
        auditors: defaultState.auditors,
        standard: defaultState.standard,
        testingInstructions: defaultState.testingInstructions,
        branding: normalizeBranding(defaultState.branding)
    };
}

function keyToLabel(key) {
    const map = {
        reportTitle: 'Report Title',
        orgClient: 'Organization/Client',
        projectName: 'Project Name',
        scopeUrl: 'URL / Scope',
        auditDateStart: 'Audit Start',
        auditDateEnd: 'Audit End',
        auditors: 'Auditor(s)',
        standard: 'Accessibility Standard',
        testingInstructions: 'Testing Instructions',
        branding: 'Branding',
        enabled: 'Enable Branding',
        headerText: 'Brand Header Text',
        primaryColor: 'Primary Brand Color',
        logoDataUrl: 'Brand Logo (Data URL)',
        logoAltText: 'Logo Alternative Text',
        logoDecorative: 'Logo Is Decorative',
        logoFileName: 'Logo File Name'
    };
    if (map[key]) return map[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function flattenMetadataObject(value, path = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [{ path, value }];
    }
    return Object.entries(value).flatMap(([key, next]) => flattenMetadataObject(next, [...path, key]));
}

function setObjectPath(target, path, value) {
    if (path.length === 0) return;
    let ref = target;
    for (let i = 0; i < path.length - 1; i += 1) {
        const segment = path[i];
        if (!ref[segment] || typeof ref[segment] !== 'object') ref[segment] = {};
        ref = ref[segment];
    }
    ref[path[path.length - 1]] = value;
}

function castMetadataValue(path, value) {
    const key = path.join('.');
    if (key === 'standard') return normalizeStandardValue(String(value || defaultState.standard));
    if (key === 'branding.enabled' || key === 'branding.logoDecorative') {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return Boolean(value);
    }
    if (key === 'auditDateStart' || key === 'auditDateEnd') return String(value || '');
    return String(value || '');
}

function syncSelectedReportSnapshot() {
    if (!appState.selectedReportId) return;
    const index = (appState.reports || []).findIndex((report) => report.id === appState.selectedReportId);
    if (index < 0) return;
    appState.reports[index] = {
        ...appState.reports[index],
        name: getReportDisplayName(),
        updatedAt: Date.now(),
        data: getCurrentReportSnapshotData()
    };
}

function syncEditorValuesFromActiveEntry() {
    const activeEntry = appState.auditEntries[appState.activeAuditEntryIndex] || appState.auditEntries[0];
    appState.editorFieldValues = normalizeEditorFieldValues(activeEntry?.fieldValues || createBlankFieldValues(appState.fields));
}

function syncAuditEntriesFromEditorValues() {
    if (!Array.isArray(appState.auditEntries) || appState.auditEntries.length === 0) {
        appState.auditEntries = normalizeAuditEntries([], appState.fields, appState.editorFieldValues);
    }
    if (appState.activeAuditEntryIndex < 0 || appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = 0;
    }
    const activeEntry = appState.auditEntries[appState.activeAuditEntryIndex];
    if (activeEntry) {
        activeEntry.fieldValues = {
            ...createBlankFieldValues(appState.fields),
            ...normalizeEditorFieldValues(activeEntry.fieldValues),
            ...normalizeEditorFieldValues(appState.editorFieldValues)
        };
    }
}

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
        branding: normalizeBranding(appState.branding),
        fields: appState.fields.map((field) => normalizeField(field))
    };
}

function applyReportData(data) {
    const normalized = {
        ...reportDefaults,
        ...(data || {}),
        branding: normalizeBranding(data?.branding),
        fields: Array.isArray(data?.fields) ? data.fields.map(normalizeField) : []
    };

    Object.assign(appState, normalized, {
        editingIndex: -1,
        editorReadOnly: false,
        editorFieldValues: {},
        auditEntries: normalizeAuditEntries([], normalized.fields, {}),
        activeAuditEntryIndex: 0
    });
    saveState({ action: 'Applied report configuration' });
}

export function resetReportToBlank() {
    applyReportData(reportDefaults);
    appState.templateEditingId = null;
    saveState({ action: 'Reset report to blank' });
}

export function loadTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    applyReportData(template.data);
    appState.templateEditingId = null;
    saveState({ action: `Loaded template ${template.name}` });
    return template;
}

export function createUserTemplate(name, templateData) {
    const templateName = String(name || '').trim();
    if (!templateName) return null;

    const template = normalizeTemplate({
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: templateName,
        metadata: {
            schemaVersion: '1.0',
            source: 'user'
        },
        data: templateData || captureCurrentReportData()
    });
    appState.userTemplates.push(template);
    saveState({ action: `Created template ${template.name}` });
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
    saveState({ action: `Deleted template ${removed.name}` });
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
    saveState({ action: `Saved template ${updatedTemplate.name}` });
    return updatedTemplate;
}

const ART_JSON_VERSION = '1.0';
const ART_JSON_WARNING = 'Warning: Do not edit. This file is used for importing your report back into ART and will not work if modified.';
const ART_TEMPLATE_JSON_VERSION = '1.0';
const ART_TEMPLATE_WARNING = 'Warning: Do not edit. This file is used for importing templates back into ART and may fail validation if modified.';

function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
}

function computeFNV1a32(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = (hash >>> 0) * 0x01000193;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function cloneCurrentAppState() {
    return cloneDeep(appState);
}

export function computeArtStateChecksum(reportState) {
    return computeFNV1a32(JSON.stringify(reportState));
}

export function createArtJsonPayload(reportState = cloneCurrentAppState()) {
    const safeState = cloneDeep(reportState);
    return {
        artVersion: ART_JSON_VERSION,
        _warning: ART_JSON_WARNING,
        integrity: {
            algorithm: 'fnv1a-32',
            reportStateChecksum: computeArtStateChecksum(safeState)
        },
        reportState: safeState
    };
}

export function serializeArtJsonPayload(reportState) {
    return JSON.stringify(createArtJsonPayload(reportState), null, 2);
}

function normalizeTemplatePayloadData(templateData) {
    const normalized = normalizeTemplate({
        name: String(templateData?.name || 'Untitled Template'),
        metadata: templateData?.metadata,
        data: templateData?.data || {}
    });

    return {
        name: normalized.name,
        metadata: {
            schemaVersion: String(normalized.metadata?.schemaVersion || '1.0'),
            exportedAt: String(normalized.metadata?.exportedAt || ''),
            source: String(normalized.metadata?.source || '')
        },
        data: normalized.data
    };
}

export function createTemplateJsonPayload(template) {
    const normalized = normalizeTemplatePayloadData(template);
    return {
        artTemplateVersion: ART_TEMPLATE_JSON_VERSION,
        _warning: ART_TEMPLATE_WARNING,
        template: {
            name: normalized.name,
            metadata: {
                ...normalized.metadata,
                exportedAt: new Date().toISOString()
            },
            data: normalized.data
        }
    };
}

export function serializeTemplateJsonPayload(template) {
    return JSON.stringify(createTemplateJsonPayload(template), null, 2);
}

export function validateTemplateJsonPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') {
        return { isValid: false, reason: 'invalid-payload' };
    }

    if (payload.artTemplateVersion !== ART_TEMPLATE_JSON_VERSION || typeof payload._warning !== 'string') {
        return { isValid: false, reason: 'missing-template-header' };
    }

    if (!payload.template || typeof payload.template !== 'object') {
        return { isValid: false, reason: 'missing-template' };
    }

    if (!String(payload.template.name || '').trim()) {
        return { isValid: false, reason: 'missing-template-name' };
    }

    if (!payload.template.data || typeof payload.template.data !== 'object') {
        return { isValid: false, reason: 'missing-template-data' };
    }

    const normalizedTemplate = normalizeTemplatePayloadData(payload.template);
    return {
        isValid: true,
        reason: 'ok',
        payload: {
            ...payload,
            template: normalizedTemplate
        }
    };
}

export function validateArtJsonPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') {
        return { isValid: false, reason: 'invalid-payload' };
    }

    if (payload.artVersion !== ART_JSON_VERSION || typeof payload._warning !== 'string') {
        return { isValid: false, reason: 'missing-required-header' };
    }

    const integrity = payload.integrity;
    if (
        !integrity
        || integrity.algorithm !== 'fnv1a-32'
        || typeof integrity.reportStateChecksum !== 'string'
    ) {
        return { isValid: false, reason: 'missing-integrity' };
    }

    if (!payload.reportState || typeof payload.reportState !== 'object') {
        return { isValid: false, reason: 'missing-report-state' };
    }

    const actualChecksum = computeArtStateChecksum(payload.reportState);
    if (actualChecksum !== integrity.reportStateChecksum) {
        return { isValid: false, reason: 'checksum-mismatch' };
    }

    return { isValid: true, reason: 'ok', payload };
}

export function importArtJsonPayload(input) {
    const validation = validateArtJsonPayload(input);
    if (!validation.isValid) return validation;

    const rawState = validation.payload.reportState || {};

    appState = normalizeStateSnapshot(rawState);
    saveState({ action: `Imported report ${appState.reportTitle || 'Untitled Report'}` });
    return validation;
}

export function templateNameExists(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;

    const allTemplates = [...getBuiltInTemplates(), ...getUserTemplates()];
    return allTemplates.some((template) => String(template.name || '').trim().toLowerCase() === normalized);
}

export function importTemplateWithConflictStrategy(templatePayload, strategy = 'copy') {
    const normalized = normalizeTemplatePayloadData(templatePayload);
    const importName = normalized.name;
    const existingIndex = appState.userTemplates.findIndex(
        (template) => String(template.name || '').trim().toLowerCase() === importName.toLowerCase()
    );

    let targetName = importName;
    if (strategy === 'copy' || (strategy === 'replace' && existingIndex < 0 && templateNameExists(importName))) {
        targetName = getUniqueTemplateName(importName);
    }

    const importedTemplate = normalizeTemplate({
        id: existingIndex >= 0 && strategy === 'replace'
            ? appState.userTemplates[existingIndex].id
            : `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: targetName,
        metadata: {
            schemaVersion: String(normalized.metadata?.schemaVersion || '1.0'),
            source: 'import',
            exportedAt: String(normalized.metadata?.exportedAt || '')
        },
        data: normalized.data
    });

    if (existingIndex >= 0 && strategy === 'replace') {
        appState.userTemplates[existingIndex] = importedTemplate;
    } else {
        appState.userTemplates.push(importedTemplate);
    }

    appState.lastCreatedTemplateId = importedTemplate.id;
    saveState({ action: `Imported template ${importedTemplate.name}` });
    return importedTemplate;
}

/**
 * Persists current state to local browser storage.
 */
export function saveState(options = {}) {
    const action = String(options.action || pendingHistoryAction || 'Updated report state');
    const shouldRecordHistory = options.recordHistory !== false;
    syncSelectedReportSnapshot();
    const nextSnapshot = JSON.stringify(appState);

    if (shouldRecordHistory && !isHistoryRestoreInProgress && nextSnapshot !== lastSavedSnapshot) {
        pendingHistoryAction = action;
        pushUndoSnapshot(lastSavedSnapshot);
        redoStack.length = 0;
    }

    lastSavedSnapshot = nextSnapshot;
    persistCurrentState();
    window.dispatchEvent(new Event('art-state-updated'));
}

export function setHistoryAction(action) {
    pendingHistoryAction = String(action || 'Updated report state');
}

export function undoState() {
    if (undoStack.length === 0) {
        announce('Nothing to undo.');
        return false;
    }

    const currentSnapshot = JSON.stringify(appState);
    const item = undoStack.pop();
    redoStack.push({ snapshot: currentSnapshot, action: item.action });

    isHistoryRestoreInProgress = true;
    try {
        setAppStateFromSnapshot(item.snapshot);
    } finally {
        isHistoryRestoreInProgress = false;
    }

    announce(`Undo: ${item.action}.`);
    return true;
}

export function redoState() {
    if (redoStack.length === 0) {
        announce('Nothing to redo.');
        return false;
    }

    const currentSnapshot = JSON.stringify(appState);
    const item = redoStack.pop();
    undoStack.push({ snapshot: currentSnapshot, action: item.action });

    isHistoryRestoreInProgress = true;
    try {
        setAppStateFromSnapshot(item.snapshot);
    } finally {
        isHistoryRestoreInProgress = false;
    }

    announce(`Redo: ${item.action}.`);
    return true;
}

export function getRecentReports() {
    return [...(appState.reports || [])].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export function getMetadataDescriptors() {
    const metadata = getDefaultMetadataObject();
    return flattenMetadataObject(metadata)
        .filter((item) => item.path[0] !== 'branding' || item.path.length <= 2)
        .map((item) => {
            const keyPath = item.path.join('.');
            const currentValue = item.path.reduce((acc, part) => acc?.[part], appState);
            const inputType = keyPath === 'auditDateStart' || keyPath === 'auditDateEnd'
                ? 'date'
                : keyPath === 'testingInstructions'
                    ? 'textarea'
                    : keyPath === 'standard'
                        ? 'select'
                        : keyPath === 'branding.enabled' || keyPath === 'branding.logoDecorative'
                            ? 'checkbox'
                            : keyPath === 'branding.primaryColor'
                                ? 'color'
                                : 'text';

            return {
                keyPath,
                path: item.path,
                label: keyToLabel(item.path[item.path.length - 1]),
                groupLabel: item.path.length > 1 ? keyToLabel(item.path[0]) : 'Report Metadata',
                inputType,
                value: currentValue ?? item.value,
                options: keyPath === 'standard'
                    ? ['WCAG 2.2', 'WCAG 2.1']
                    : []
            };
        });
}

export function validateMetadataDraft(draft) {
    const brandingDraft = normalizeBranding(draft?.branding || appState.branding);
    if (brandingDraft.enabled && brandingDraft.logoDataUrl && !brandingDraft.logoDecorative && !String(brandingDraft.logoAltText || '').trim()) {
        return {
            isValid: false,
            message: 'Logo alternative text is required when logo is not decorative.'
        };
    }
    return { isValid: true, message: '' };
}

export function applyMetadataDraft(draft) {
    const normalizedDraft = {
        ...getDefaultMetadataObject(),
        ...(draft || {}),
        branding: normalizeBranding(draft?.branding || appState.branding)
    };

    appState.reportTitle = String(normalizedDraft.reportTitle || '');
    appState.orgClient = String(normalizedDraft.orgClient || '');
    appState.projectName = String(normalizedDraft.projectName || '');
    appState.scopeUrl = String(normalizedDraft.scopeUrl || '');
    appState.auditDateStart = String(normalizedDraft.auditDateStart || '');
    appState.auditDateEnd = String(normalizedDraft.auditDateEnd || '');
    appState.auditors = String(normalizedDraft.auditors || '');
    appState.standard = normalizeStandardValue(normalizedDraft.standard || defaultState.standard);
    appState.testingInstructions = String(normalizedDraft.testingInstructions || '');
    appState.branding = normalizeBranding(normalizedDraft.branding);

    saveState({ action: 'Updated report metadata' });
    window.dispatchEvent(new CustomEvent('art-standard-changed', {
        detail: { standard: appState.standard }
    }));
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function buildMetadataDraftFromValues(values) {
    const draft = getDefaultMetadataObject();
    Object.entries(values || {}).forEach(([keyPath, rawValue]) => {
        const path = keyPath.split('.').filter(Boolean);
        if (path.length === 0) return;
        setObjectPath(draft, path, castMetadataValue(path, rawValue));
    });
    draft.branding = normalizeBranding(draft.branding);
    return draft;
}

export function clearReportContentOnly() {
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    saveState({ action: 'Cleared report content' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function clearReportEverythingInSession() {
    const metadataDefaults = getDefaultMetadataObject();
    appState.reportTitle = metadataDefaults.reportTitle;
    appState.orgClient = metadataDefaults.orgClient;
    appState.projectName = metadataDefaults.projectName;
    appState.scopeUrl = metadataDefaults.scopeUrl;
    appState.auditDateStart = metadataDefaults.auditDateStart;
    appState.auditDateEnd = metadataDefaults.auditDateEnd;
    appState.auditors = metadataDefaults.auditors;
    appState.standard = metadataDefaults.standard;
    appState.testingInstructions = metadataDefaults.testingInstructions;
    appState.reportType = defaultState.reportType;
    appState.reportLayout = defaultState.reportLayout;
    appState.templateOption = defaultState.templateOption;
    appState.templateName = defaultState.templateName;
    appState.templateDescription = defaultState.templateDescription;
    appState.fields = [];
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    appState.fieldsExpanded = false;
    appState.branding = normalizeBranding(defaultState.branding);
    appState.editingIndex = -1;

    saveState({ action: 'Cleared report configuration and content' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function closeCurrentReportSession() {
    appState.selectedReportId = '';
    appState.reportTitle = defaultState.reportTitle;
    appState.orgClient = defaultState.orgClient;
    appState.projectName = defaultState.projectName;
    appState.scopeUrl = defaultState.scopeUrl;
    appState.auditDateStart = defaultState.auditDateStart;
    appState.auditDateEnd = defaultState.auditDateEnd;
    appState.auditors = defaultState.auditors;
    appState.standard = defaultState.standard;
    appState.testingInstructions = defaultState.testingInstructions;
    appState.reportType = defaultState.reportType;
    appState.reportLayout = defaultState.reportLayout;
    appState.templateOption = defaultState.templateOption;
    appState.templateName = defaultState.templateName;
    appState.templateDescription = defaultState.templateDescription;
    appState.fieldsExpanded = defaultState.fieldsExpanded;
    appState.fields = [];
    appState.editingIndex = -1;
    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    appState.templateEditingId = null;
    appState.templateCreateMode = false;
    appState.branding = normalizeBranding(defaultState.branding);

    saveState({ action: 'Closed active report' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function getReportById(reportId) {
    return (appState.reports || []).find((report) => report.id === reportId) || null;
}

export function currentReportSupportsAuditEntries() {
    return appState.reportType === 'Audit Log';
}

function getReportDataFromSnapshot(report) {
    return report?.data && typeof report.data === 'object' ? report.data : null;
}

function getMetricsFromReportData(reportData) {
    if (!reportData) {
        return {
            totalIssues: 0,
            pagesTested: 0,
            issuesBySeverity: 'None',
            wcagCriteria: 0,
            totalAuditEntries: 0
        };
    }

    const fields = Array.isArray(reportData.fields) ? reportData.fields : [];
    const entries = Array.isArray(reportData.auditEntries) && reportData.auditEntries.length > 0
        ? reportData.auditEntries
        : [{ fieldValues: reportData.editorFieldValues || {} }];

    const pageFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => /page|url|scope/i.test(String(item.field?.label || '')))
        .map((item) => item.index);

    const severityFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => /severity|risk/i.test(String(item.field?.label || '')))
        .map((item) => item.index);

    const wcagFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => String(item.field?.type || '') === 'wcag-success-criterion')
        .map((item) => item.index);

    const pages = new Set();
    const wcagSet = new Set();
    const severityCounts = new Map();

    entries.forEach((entry) => {
        const values = entry?.fieldValues || {};
        pageFieldIndexes.forEach((fieldIndex) => {
            const value = String(values[fieldIndex] || '').trim();
            if (value) pages.add(value);
        });
        severityFieldIndexes.forEach((fieldIndex) => {
            const value = String(values[fieldIndex] || '').trim();
            if (!value) return;
            severityCounts.set(value, Number(severityCounts.get(value) || 0) + 1);
        });
        wcagFieldIndexes.forEach((fieldIndex) => {
            const value = values[fieldIndex];
            if (value && typeof value === 'object' && value.identifier) {
                wcagSet.add(String(value.identifier));
                return;
            }
            const rawText = String(value || '');
            const match = rawText.match(/\b\d+\.\d+\.\d+\b/);
            if (match) wcagSet.add(match[0]);
        });
    });

    const issuesBySeverity = [...severityCounts.entries()]
        .map(([label, count]) => `${label}: ${count}`)
        .join(', ') || 'None';

    return {
        totalIssues: entries.length,
        pagesTested: pages.size,
        issuesBySeverity,
        wcagCriteria: wcagSet.size,
        totalAuditEntries: entries.length
    };
}

export function computeReportMetrics(report) {
    return getMetricsFromReportData(getReportDataFromSnapshot(report));
}

export function getCurrentReportMetrics() {
    return getMetricsFromReportData(getCurrentReportSnapshotData());
}

export function validateCurrentReport() {
    const issues = [];
    const metadataChecks = [
        ['reportTitle', appState.reportTitle, 'Report title is required.', 'metadata', 'reportTitle'],
        ['orgClient', appState.orgClient, 'Organization/Client is required.', 'metadata', 'orgClient'],
        ['projectName', appState.projectName, 'Project name is required.', 'metadata', 'projectName'],
        ['scopeUrl', appState.scopeUrl, 'URL / Scope is required.', 'metadata', 'scopeUrl'],
        ['auditors', appState.auditors, 'Auditor(s) is required.', 'metadata', 'auditors'],
        ['reportType', appState.reportType, 'Report type is required.', 'builder', 'report-type-select'],
        ['reportLayout', appState.reportLayout, 'Report layout is required.', 'builder', 'report-layout-select']
    ];

    metadataChecks.forEach(([keyPath, value, message, targetType, target]) => {
        if (!String(value || '').trim()) {
            issues.push({
                code: `metadata-${keyPath}`,
                message,
                targetType,
                target
            });
        }
    });

    if (!Array.isArray(appState.fields) || appState.fields.length === 0) {
        issues.push({
            code: 'fields-missing',
            message: 'At least one report field must be configured.',
            targetType: 'builder',
            target: 'btn-toggle-config'
        });
    }

    const entries = currentReportSupportsAuditEntries()
        ? getAuditEntries()
        : [{ fieldValues: appState.editorFieldValues || {} }];

    if (currentReportSupportsAuditEntries() && (!Array.isArray(entries) || entries.length === 0)) {
        issues.push({
            code: 'entries-missing',
            message: 'At least one audit entry is required.',
            targetType: 'editor',
            target: 'btn-add-entry'
        });
    }

    const seenIdentifiers = new Map();

    entries.forEach((entry, entryIndex) => {
        (appState.fields || []).forEach((field, fieldIndex) => {
            const type = field?.type === 'select' ? 'dropdown' : field?.type || 'text';
            const label = String(field?.label || `Field ${fieldIndex + 1}`);
            const rawValue = entry?.fieldValues?.[fieldIndex];
            const isStructuredWcag = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue);
            const textValue = isStructuredWcag
                ? `${rawValue.number || ''} ${rawValue.title || ''}`.trim()
                : String(rawValue || '').trim();

            if (!textValue) {
                issues.push({
                    code: `empty-${entryIndex}-${fieldIndex}`,
                    message: `${label} is required for entry ${entryIndex + 1}.`,
                    targetType: 'entry-field',
                    target: `editor-field-${entryIndex}-${fieldIndex}`
                });
                return;
            }

            if (fieldIndex === 0) {
                const normalized = textValue.toLowerCase();
                if (seenIdentifiers.has(normalized)) {
                    issues.push({
                        code: `duplicate-${entryIndex}-${fieldIndex}`,
                        message: `Duplicate identifier ${textValue} found in the first column.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                } else {
                    seenIdentifiers.set(normalized, entryIndex);
                }
            }

            if (type === 'dropdown') {
                const allowed = Array.isArray(field.dropdownOptions) ? field.dropdownOptions.map((option) => String(option)) : [];
                if (!allowed.includes(String(rawValue))) {
                    issues.push({
                        code: `invalid-dropdown-${entryIndex}-${fieldIndex}`,
                        message: `${label} contains an invalid value for entry ${entryIndex + 1}.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                }
            }

            if (type === 'wcag-success-criterion') {
                const hasIdentifier = isStructuredWcag
                    ? String(rawValue.identifier || '').trim()
                    : textValue.match(/\b\d+\.\d+\.\d+\b/);
                if (!hasIdentifier) {
                    issues.push({
                        code: `missing-wcag-${entryIndex}-${fieldIndex}`,
                        message: `${label} must reference a valid WCAG success criterion for entry ${entryIndex + 1}.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                }
            }
        });
    });

    return issues;
}

export function upsertCurrentReport(options = {}) {
    const preferredName = String(options.name || getReportDisplayName()).trim();
    const reportName = preferredName || 'Untitled Report';
    const reportData = getCurrentReportSnapshotData();
    const selected = appState.selectedReportId ? getReportById(appState.selectedReportId) : null;
    const reportId = selected?.id || `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existingIndex = (appState.reports || []).findIndex((report) => report.id === reportId);

    const snapshot = {
        id: reportId,
        name: reportName,
        updatedAt: Date.now(),
        data: reportData
    };

    if (existingIndex >= 0) {
        appState.reports[existingIndex] = snapshot;
    } else {
        appState.reports.push(snapshot);
    }

    appState.selectedReportId = reportId;
    saveState({ action: `Saved report ${reportName}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return snapshot;
}

export function loadReportById(reportId) {
    const report = getReportById(reportId);
    if (!report) return null;

    const mergedState = normalizeStateSnapshot({
        ...appState,
        ...report.data,
        selectedReportId: report.id
    });
    appState = mergedState;
    syncEditorValuesFromActiveEntry();
    saveState({ action: `Loaded report ${report.name}`, recordHistory: false });
    return report;
}

export function deleteReportById(reportId) {
    const index = (appState.reports || []).findIndex((report) => report.id === reportId);
    if (index < 0) return null;
    const [removed] = appState.reports.splice(index, 1);
    if (appState.selectedReportId === removed.id) {
        appState.selectedReportId = appState.reports[0]?.id || '';
    }
    saveState({ action: `Deleted report ${removed.name}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return removed;
}

export function reportNameExists(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    return (appState.reports || []).some((report) => String(report.name || '').trim().toLowerCase() === normalized);
}

export function importReportWithConflictStrategy(reportState, strategy) {
    const normalizedImport = normalizeStateSnapshot(reportState);
    const importName = String(normalizedImport.reportTitle || 'Untitled Report').trim() || 'Untitled Report';
    const reports = appState.reports || [];
    const sameNameIndex = reports.findIndex((report) => String(report.name || '').trim().toLowerCase() === importName.toLowerCase());

    let targetName = importName;
    let targetId = '';

    if (sameNameIndex >= 0) {
        if (strategy === 'replace') {
            targetId = reports[sameNameIndex].id;
        } else if (strategy === 'copy') {
            targetName = getUniqueReportName(importName);
        } else {
            return null;
        }
    }

    const snapshot = {
        id: targetId || `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: targetName,
        updatedAt: Date.now(),
        data: getCurrentReportSnapshotData()
    };

    const mergedState = normalizeStateSnapshot({
        ...appState,
        ...normalizedImport,
        reportTitle: targetName,
        selectedReportId: snapshot.id
    });
    appState = mergedState;
    syncEditorValuesFromActiveEntry();

    const existingIndex = reports.findIndex((report) => report.id === snapshot.id);
    const savedSnapshot = {
        ...snapshot,
        data: getCurrentReportSnapshotData()
    };

    if (existingIndex >= 0) {
        appState.reports[existingIndex] = savedSnapshot;
    } else {
        appState.reports.push(savedSnapshot);
    }

    saveState({ action: `Imported report ${targetName}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return savedSnapshot;
}

export function ensureAuditEntries() {
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    if (appState.activeAuditEntryIndex < 0 || appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = 0;
    }
    syncEditorValuesFromActiveEntry();
}

export function addAuditEntry() {
    ensureAuditEntries();
    const newEntry = normalizeAuditEntry({ fieldValues: createBlankFieldValues(appState.fields) }, appState.fields);
    appState.auditEntries.push(newEntry);
    appState.activeAuditEntryIndex = appState.auditEntries.length - 1;
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Added audit entry' });
    return appState.activeAuditEntryIndex;
}

export function setActiveAuditEntryIndex(index) {
    if (!Array.isArray(appState.auditEntries) || appState.auditEntries.length === 0) {
        ensureAuditEntries();
    }
    const safeIndex = Math.max(0, Math.min(Number(index || 0), appState.auditEntries.length - 1));
    appState.activeAuditEntryIndex = safeIndex;
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Changed active audit entry', recordHistory: false });
}

export function updateAuditEntryFieldValue(entryIndex, fieldIndex, value) {
    ensureAuditEntries();
    const entry = appState.auditEntries[entryIndex];
    if (!entry) return;
    entry.fieldValues[fieldIndex] = normalizeEditorFieldValue(value);
    if (entryIndex === appState.activeAuditEntryIndex) {
        appState.editorFieldValues[fieldIndex] = normalizeEditorFieldValue(value);
    }
    saveState({ action: 'Updated audit entry content' });
}

export function moveAuditEntry(entryIndex, direction) {
    ensureAuditEntries();
    const from = Number(entryIndex);
    const to = from + Number(direction);
    if (from < 0 || from >= appState.auditEntries.length || to < 0 || to >= appState.auditEntries.length) return null;

    const moved = appState.auditEntries.splice(from, 1)[0];
    appState.auditEntries.splice(to, 0, moved);
    if (appState.activeAuditEntryIndex === from) {
        appState.activeAuditEntryIndex = to;
    } else if (from < appState.activeAuditEntryIndex && to >= appState.activeAuditEntryIndex) {
        appState.activeAuditEntryIndex -= 1;
    } else if (from > appState.activeAuditEntryIndex && to <= appState.activeAuditEntryIndex) {
        appState.activeAuditEntryIndex += 1;
    }
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Moved audit entry' });
    return to;
}

export function deleteAuditEntry(entryIndex) {
    ensureAuditEntries();
    const index = Number(entryIndex);
    if (index < 0 || index >= appState.auditEntries.length) return null;
    const [removed] = appState.auditEntries.splice(index, 1);
    if (appState.auditEntries.length === 0) {
        appState.auditEntries = normalizeAuditEntries([], appState.fields, {});
    }
    if (appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = appState.auditEntries.length - 1;
    }
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Deleted audit entry' });
    return removed;
}

export function getAuditEntries() {
    ensureAuditEntries();
    return appState.auditEntries;
}

export function getAuditEntryDisplayName(entryIndex) {
    ensureAuditEntries();
    const entry = appState.auditEntries[entryIndex];
    if (!entry) return `Entry ${entryIndex + 1}`;
    const firstField = appState.fields?.[0];
    const firstValue = String(entry.fieldValues?.[0] || '').trim();
    if (firstValue) return firstValue;
    if (firstField?.label) return `${firstField.label} ${entryIndex + 1}`;
    return `Entry ${entryIndex + 1}`;
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
    saveState({ action: `Updated ${key}` });
}

/**
 * Updates a specific editor field value and persists the change.
 */
export function updateEditorFieldValue(index, value) {
    appState.editorFieldValues[index] = value;
    if (appState.reportType === 'Audit Log') {
        syncAuditEntriesFromEditorValues();
    }
    saveState({ action: 'Updated report content' });
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
        appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
        announce(`Added field ${labelInput.value}`);
    } else {
        // Update existing field
        appState.fields[appState.editingIndex] = fieldData;
        appState.editingIndex = -1; // Reset mode
        appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
        announce("Field updated");
    }
    
    saveState({ action: `Updated report field ${labelInput.value}` });
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
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    saveState({ action: `Deleted report field ${removed[0].label}` });
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
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    saveState({ action: `Moved report field ${field.label}` });
    announce(`Moved ${direction < 0 ? 'before' : 'after'} ${referenceLabel}`);
    return newIdx;
}
