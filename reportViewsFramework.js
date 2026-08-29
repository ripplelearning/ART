import {
    announce,
    appState,
    ensureAuditEntries,
    getAuditEntries,
    getReportById,
    saveState,
    upsertCurrentReport
} from './state.js';
import { activateTabCommand } from './navigation.js';
import { setActivePanel, syncDocumentTitle } from './appIdentity.js';
import { getPluginFrameworkSnapshot } from './pluginFramework.js';
import { runUniversalSearch } from './universalSearchFramework.js';
import { formatWcagCriterionDisplay, isWcagCriterionFieldType } from './wcagCatalog.js';

const STORAGE_KEY = 'art-report-views-v1';
const WORKING_VIEW_FIELD_LABELS = Object.freeze({
    label: 'Finding'
});
const BUILT_IN_PRESETS = [
    {
        id: 'preset-triage-severity-status',
        name: 'Triage by Severity and Status',
        description: 'Group by severity and status, sorted by severity.',
        config: {
            groupBy: ['severity', 'status'],
            sortLevels: [
                { field: 'severity', direction: 'asc' },
                { field: 'status', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '' },
            searchText: ''
        }
    },
    {
        id: 'preset-reviewer-queue',
        name: 'Reviewer Queue',
        description: 'Group by reviewer and status for assignment planning.',
        config: {
            groupBy: ['reviewer', 'status'],
            sortLevels: [
                { field: 'reviewer', direction: 'asc' },
                { field: 'status', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '' },
            searchText: ''
        }
    },
    {
        id: 'preset-wcag-by-page',
        name: 'WCAG by Page',
        description: 'Group by page then WCAG criterion for standards review.',
        config: {
            groupBy: ['page', 'wcag'],
            sortLevels: [
                { field: 'page', direction: 'asc' },
                { field: 'wcag', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '', relationship: '' },
            searchText: ''
        }
    },
    {
        id: 'preset-relationship-attachments',
        name: 'Grouped by Attachment',
        description: 'Temporarily group findings by attached evidence and supporting files.',
        config: {
            groupBy: ['attachment', 'page'],
            sortLevels: [
                { field: 'attachment', direction: 'asc' },
                { field: 'page', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '', relationship: '' },
            searchText: ''
        }
    },
    {
        id: 'preset-relationship-standards',
        name: 'Grouped by Accessibility Standard',
        description: 'Temporarily group findings by their related accessibility standard and criterion.',
        config: {
            groupBy: ['standard', 'wcag'],
            sortLevels: [
                { field: 'standard', direction: 'asc' },
                { field: 'wcag', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '', relationship: '' },
            searchText: ''
        }
    },
    {
        id: 'preset-relationship-shared-evidence',
        name: 'Shared Evidence Review',
        description: 'Temporarily group findings by shared relationship evidence and review status.',
        config: {
            groupBy: ['relationship', 'status'],
            sortLevels: [
                { field: 'relationship', direction: 'asc' },
                { field: 'status', direction: 'asc' },
                { field: 'label', direction: 'asc' }
            ],
            filters: { severity: '', status: '', reviewer: '', tag: '', relationship: '' },
            searchText: ''
        }
    }
];

let initialized = false;
let activeTableColumnField = '';
let workingViewStore = {
    presets: [],
    sessionsByReportId: {}
};

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function getActiveReportFieldDefinitions() {
    const selectedReport = appState.selectedReportId ? getReportById(appState.selectedReportId) : null;
    const selectedFields = Array.isArray(selectedReport?.data?.fields) ? selectedReport.data.fields : [];
    if (selectedFields.length > 0) return selectedFields;
    return Array.isArray(appState.fields) ? appState.fields : [];
}

function getWorkingViewFieldCatalog() {
    const catalog = [{ key: 'label', label: WORKING_VIEW_FIELD_LABELS.label, visible: false }];
    const seen = new Set(['label']);

    getActiveReportFieldDefinitions().forEach((field, index) => {
        const label = normalizeText(field?.label) || `Field ${index + 1}`;
        const key = `field-${index}`;
        const normalizedKey = normalizeText(key).toLowerCase();
        if (seen.has(normalizedKey)) return;
        seen.add(normalizedKey);
        catalog.push({ key, label, visible: true });
    });

    return catalog;
}

function getVisibleWorkingViewFieldCatalog() {
    const visibleFields = getWorkingViewFieldCatalog().filter((entry) => entry.visible !== false);
    if (visibleFields.length > 0) return visibleFields;
    return getWorkingViewFieldCatalog().filter((entry) => entry.key === 'label');
}

function getWorkingViewTableColumns() {
    return getVisibleWorkingViewFieldCatalog();
}

function getResolvedWorkingViewFieldLabels() {
    const labels = {};

    getWorkingViewFieldCatalog().forEach((entry) => {
        labels[normalizeText(entry.key).toLowerCase()] = entry.label;
    });

    return labels;
}

function getWorkingViewFieldLabel(field) {
    const normalized = normalizeText(field).toLowerCase();
    const dynamicLabels = getResolvedWorkingViewFieldLabels();
    return dynamicLabels[normalized] || WORKING_VIEW_FIELD_LABELS[normalized] || normalizeText(field);
}

function getActiveReportFieldLabel(index, fallback = '') {
    const fields = getActiveReportFieldDefinitions();
    return normalizeText(fields[index]?.label) || normalizeText(fallback);
}

function normalizeWorkingViewProviderPreset(entry, index = 0) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const value = source.value && typeof source.value === 'object' ? source.value : source;
    if (!value.config || typeof value.config !== 'object') return null;

    return {
        id: normalizeText(value.id || `plugin-working-view-${index + 1}`),
        name: normalizeText(value.name || value.displayName || `Plugin Working View ${index + 1}`),
        description: normalizeText(value.description || 'Plugin-provided Working View preset.'),
        pluginId: normalizeText(source.pluginId || value.pluginId),
        config: value.config,
        source: 'plugin'
    };
}

function getAvailableWorkingViewProviders() {
    try {
        const snapshot = getPluginFrameworkSnapshot();
        return normalizeArray(snapshot?.extensionRegistry?.workingViewProviders)
            .map((entry, index) => normalizeWorkingViewProviderPreset(entry, index))
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function getAvailablePresetOptions() {
    return [...BUILT_IN_PRESETS, ...getAvailableWorkingViewProviders()];
}

function ensureStoreShape() {
    if (!workingViewStore || typeof workingViewStore !== 'object') {
        workingViewStore = { presets: [], sessionsByReportId: {} };
        return;
    }
    if (!Array.isArray(workingViewStore.presets)) workingViewStore.presets = [];
    if (!workingViewStore.sessionsByReportId || typeof workingViewStore.sessionsByReportId !== 'object') {
        workingViewStore.sessionsByReportId = {};
    }
}

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        workingViewStore = raw ? JSON.parse(raw) : { presets: [], sessionsByReportId: {} };
    } catch (error) {
        workingViewStore = { presets: [], sessionsByReportId: {} };
    }
    ensureStoreShape();
}

function persistStore() {
    ensureStoreShape();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workingViewStore));
}

function getCurrentReportId() {
    const selected = normalizeText(appState.selectedReportId);
    if (selected) return selected;
    return normalizeText(appState.reportTitle) ? `session-${normalizeText(appState.reportTitle).toLowerCase()}` : '';
}

function getCurrentReportName() {
    return normalizeText(appState.reportTitle) || 'Untitled Report';
}

function normalizeAttachmentList(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const name = normalizeText(item.name);
            const dataBase64 = normalizeText(item.dataBase64);
            if (!name || !dataBase64) return null;
            return {
                id: normalizeText(item.id),
                name,
                type: normalizeText(item.type || 'application/octet-stream')
            };
        })
        .filter(Boolean);
}

function dedupeValues(values) {
    const seen = new Set();
    return normalizeArray(values).filter((value) => {
        const normalized = normalizeText(value);
        if (!normalized) return false;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractRelationshipMetadata(fieldValues = {}, fieldIndex = -1) {
    const attachments = [];
    const standards = [];
    const reportStandard = normalizeText(appState.standard);
    const templateName = normalizeText(appState.templateName || appState.templateOption);

    normalizeArray(appState.fields).forEach((field, index) => {
        if (fieldIndex >= 0 && index !== fieldIndex) return;
        const rawValue = fieldValues[index];
        if (!rawValue) return;

        const attachmentList = normalizeAttachmentList(rawValue);
        if (attachmentList.length > 0) {
            attachments.push(...attachmentList.map((item) => item.name));
        }

        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
            const directStandard = normalizeText(rawValue.standard || rawValue.standardName);
            if (directStandard) standards.push(directStandard);
        }

        if (isWcagCriterionFieldType(normalizeText(field?.type)) || isWcagCriterionFieldType(normalizeText(field?.label))) {
            const display = formatWcagCriterionDisplay(rawValue);
            const fallbackStandard = normalizeText(rawValue?.standard || reportStandard);
            if (fallbackStandard) standards.push(fallbackStandard);
            if (!fallbackStandard && display && reportStandard) standards.push(reportStandard);
        }
    });

    const standardValues = dedupeValues(standards.length > 0 ? standards : [reportStandard]);
    const attachmentValues = dedupeValues(attachments);
    const standardText = standardValues.join(', ');
    const attachmentText = attachmentValues.join(', ');
    const relationshipParts = [
        standardText ? `Uses ${standardText}` : '',
        templateName ? `Template ${templateName}` : '',
        attachmentText ? `Evidence ${attachmentText}` : ''
    ].filter(Boolean);

    return {
        standard: standardText,
        template: templateName,
        attachment: attachmentText,
        relationship: relationshipParts.join(' | '),
        attachmentCount: attachmentValues.length
    };
}

function getCurrentTabId() {
    const selected = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
    return selected ? String(selected.id || 'tab-welcome') : 'tab-welcome';
}

function inferFieldIndexes() {
    const indexMap = {
        severity: -1,
        status: -1,
        reviewer: -1,
        tags: -1,
        page: -1,
        wcag: -1,
        findingType: -1,
        component: -1
    };

    (appState.fields || []).forEach((field, index) => {
        const label = normalizeText(field?.label).toLowerCase();
        if (indexMap.severity === -1 && label.includes('severity')) indexMap.severity = index;
        if (indexMap.status === -1 && (label.includes('status') || label.includes('resolution'))) indexMap.status = index;
        if (indexMap.reviewer === -1 && (label.includes('reviewer') || label.includes('assignee') || label.includes('assigned'))) indexMap.reviewer = index;
        if (indexMap.tags === -1 && label.includes('tag')) indexMap.tags = index;
        if (indexMap.page === -1 && (label.includes('page') || label.includes('url') || label.includes('screen'))) indexMap.page = index;
        if (indexMap.wcag === -1 && (label.includes('wcag') || label.includes('criterion') || label.includes('success criterion'))) indexMap.wcag = index;
        if (indexMap.findingType === -1 && (label.includes('type') || label.includes('category'))) indexMap.findingType = index;
        if (indexMap.component === -1 && label.includes('component')) indexMap.component = index;
    });

    return indexMap;
}

function toTags(value) {
    const text = normalizeText(value);
    if (!text) return [];
    return text.split(/[|,;]/).map((tag) => normalizeText(tag)).filter(Boolean);
}

function getAuditFindingRecords() {
    ensureAuditEntries();
    const indexMap = inferFieldIndexes();
    const workingViewFields = getVisibleWorkingViewFieldCatalog();
    return getAuditEntries().map((entry, entryIndex) => {
        const values = entry?.fieldValues || {};
        const label = normalizeText(values[0]) || `Finding ${entryIndex + 1}`;
        const severity = indexMap.severity >= 0 ? normalizeText(values[indexMap.severity]) : '';
        const status = indexMap.status >= 0 ? normalizeText(values[indexMap.status]) : '';
        const reviewer = indexMap.reviewer >= 0 ? normalizeText(values[indexMap.reviewer]) : '';
        const page = indexMap.page >= 0 ? normalizeText(values[indexMap.page]) : '';
        const wcag = indexMap.wcag >= 0 ? normalizeText(values[indexMap.wcag]) : '';
        const findingType = indexMap.findingType >= 0 ? normalizeText(values[indexMap.findingType]) : '';
        const component = indexMap.component >= 0 ? normalizeText(values[indexMap.component]) : '';
        const tags = indexMap.tags >= 0 ? toTags(values[indexMap.tags]) : [];
        const relationshipMetadata = extractRelationshipMetadata(values);

        const record = {
            id: normalizeText(entry?.id) || `entry-${entryIndex + 1}`,
            label,
            entryIndex,
            type: findingType,
            severity,
            status,
            reviewer,
            page,
            wcag,
            component,
            tags,
            standard: relationshipMetadata.standard,
            template: relationshipMetadata.template,
            attachment: relationshipMetadata.attachment,
            relationship: relationshipMetadata.relationship,
            attachmentCount: relationshipMetadata.attachmentCount,
            rawValues: values
        };

        workingViewFields.forEach((fieldEntry, fieldIndex) => {
            record[fieldEntry.key] = values[fieldIndex];
        });

        return record;
    });
}

function getNonAuditFindingRecords() {
    const indexMap = inferFieldIndexes();
    const values = appState.editorFieldValues || {};
    const workingViewFields = getVisibleWorkingViewFieldCatalog();
    return (appState.fields || []).map((field, fieldIndex) => {
        const label = normalizeText(field?.label) || `Field ${fieldIndex + 1}`;
        const value = normalizeText(values[fieldIndex]);
        const relationshipMetadata = extractRelationshipMetadata(values, fieldIndex);
        const record = {
            id: `field-${fieldIndex + 1}`,
            label,
            fieldIndex,
            entryIndex: -1,
            type: normalizeText(field?.type) || 'text',
            severity: indexMap.severity === fieldIndex ? value : '',
            status: indexMap.status === fieldIndex ? value : '',
            reviewer: indexMap.reviewer === fieldIndex ? value : '',
            page: indexMap.page === fieldIndex ? value : '',
            wcag: indexMap.wcag === fieldIndex ? value : '',
            component: indexMap.component === fieldIndex ? value : '',
            tags: indexMap.tags === fieldIndex ? toTags(value) : [],
            standard: relationshipMetadata.standard,
            template: relationshipMetadata.template,
            attachment: relationshipMetadata.attachment,
            relationship: relationshipMetadata.relationship,
            attachmentCount: relationshipMetadata.attachmentCount,
            rawValue: value
        };

        workingViewFields.forEach((fieldEntry, activeFieldIndex) => {
            record[fieldEntry.key] = values[activeFieldIndex];
        });

        return record;
    });
}

function getReportFindingRecords() {
    if (normalizeText(appState.reportType) === 'Audit Log' || normalizeText(appState.reportType) === 'Executive Summary' || normalizeText(appState.reportType) === 'Usability Report') return getAuditFindingRecords();
    return getNonAuditFindingRecords();
}

function defaultConfig() {
    const availableFields = getVisibleWorkingViewFieldCatalog().map((entry) => entry.key);
    const primaryField = availableFields[0] || 'label';
    const secondaryField = availableFields[1] || primaryField;

    return {
        name: 'Working View',
        mode: 'working',
        temporary: true,
        sortLevels: [
            { field: primaryField, direction: 'asc' },
            { field: secondaryField, direction: 'asc' },
            { field: 'label', direction: 'asc' }
        ],
        filters: {
            severity: '',
            status: '',
            reviewer: '',
            tag: ''
        },
        groupBy: [primaryField, secondaryField],
        searchText: '',
        highlightMatches: true,
        display: {
            compact: false,
            expanded: false,
            reading: false,
            review: false,
            outline: false
        },
        expandedGroups: {},
        table: {
            sortLevels: [],
            groupLevels: [],
            filters: {}
        },
        selectedFindingId: '',
        scrollTop: 0,
        sourceTabId: getCurrentTabId(),
        sourceFocusSelector: '',
        sourceScrollY: window.scrollY || 0
    };
}

function normalizeFieldValueForSort(value) {
    const text = normalizeText(value);
    const numeric = Number(text);
    if (Number.isFinite(numeric) && text !== '') return numeric;
    return text.toLowerCase();
}

function normalizeGroupBy(groupBy) {
    if (!Array.isArray(groupBy)) return [];
    const allowedFields = new Map(getWorkingViewFieldCatalog().map((entry) => [normalizeText(entry.key).toLowerCase(), entry.key]));
    const seen = new Set();
    const normalized = [];
    groupBy.forEach((field) => {
        const text = normalizeText(field).toLowerCase();
        const canonical = allowedFields.get(text);
        if (!canonical) return;
        const key = normalizeText(canonical).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(canonical);
    });
    return normalized.slice(0, 3);
}

function normalizeSortLevels(sortLevels) {
    const fallback = [
        { field: 'label', direction: 'asc' }
    ];
    if (!Array.isArray(sortLevels)) return fallback;

    const allowedFields = new Map(getWorkingViewFieldCatalog().map((entry) => [normalizeText(entry.key).toLowerCase(), entry.key]));

    const normalized = sortLevels
        .map((level) => {
            const field = normalizeText(level?.field).toLowerCase();
            const canonical = allowedFields.get(field);
            if (!canonical) return null;
            const direction = normalizeText(level?.direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
            return { field: canonical, direction };
        })
        .filter(Boolean)
        .slice(0, 3);

    return normalized.length > 0 ? normalized : fallback;
}

function compareByLevel(left, right, level) {
    const field = normalizeText(level?.field) || 'label';
    const direction = normalizeText(level?.direction) === 'desc' ? -1 : 1;
    const a = normalizeFieldValueForSort(left[field]);
    const b = normalizeFieldValueForSort(right[field]);
    if (a < b) return -1 * direction;
    if (a > b) return 1 * direction;
    return 0;
}

function getTableColumnLabel(field) {
    const catalog = getWorkingViewTableColumns();
    const item = catalog.find((column) => column.key === field);
    return item ? item.label : getWorkingViewFieldLabel(field);
}

function normalizeTableValue(value, field = '') {
    if (field === 'tags' && Array.isArray(value)) {
        return value.map((item) => normalizeText(item)).filter(Boolean).join(', ');
    }

    if (value && typeof value === 'object') {
        if (isWcagCriterionFieldType(normalizeText(field))) {
            const formatted = formatWcagCriterionDisplay(value);
            if (formatted) return formatted;
        }

        if (Array.isArray(value)) {
            return value.map((item) => normalizeText(item)).filter(Boolean).join(', ');
        }
    }

    return normalizeText(value);
}

function getTableConformanceLevel(value) {
    if (value && typeof value === 'object') {
        const direct = normalizeText(value.level || value.conformanceLevel || value.conformance);
        if (direct) return direct;
        const formatted = formatWcagCriterionDisplay(value);
        return getTableConformanceLevel(formatted);
    }

    const text = normalizeText(value);
    if (!text) return '';

    const directMatch = text.match(/\b(?:level\s*)?(AAA|AA|A)\b/i);
    if (directMatch) return directMatch[1].toUpperCase();

    const conformanceMatch = text.match(/\bconformance\s*[:\-]?\s*(AAA|AA|A)\b/i);
    if (conformanceMatch) return conformanceMatch[1].toUpperCase();

    return text;
}

function normalizeTableSortLevels(sortLevels) {
    if (!Array.isArray(sortLevels)) return [];

    const seen = new Set();
    const allowedFields = new Map(getWorkingViewTableColumns().map((entry) => [normalizeText(entry.key).toLowerCase(), entry.key]));
    return sortLevels
        .map((level) => {
            const field = normalizeText(level?.field).toLowerCase();
            const canonical = allowedFields.get(field);
            if (!canonical) return null;
            const direction = normalizeText(level?.direction).toLowerCase() === 'desc' ? 'desc' : 'asc';
            const key = `${canonical}|${direction}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return { field: canonical, direction };
        })
        .filter(Boolean)
        .slice(0, 3);
}

function normalizeTableGroupLevels(groupLevels) {
    if (!Array.isArray(groupLevels)) return [];

    const seen = new Set();
    const allowedFields = new Map(getWorkingViewTableColumns().map((entry) => [normalizeText(entry.key).toLowerCase(), entry.key]));
    return groupLevels
        .map((level) => {
            const field = normalizeText(level?.field).toLowerCase();
            const canonical = allowedFields.get(field);
            if (!canonical) return null;
            const mode = normalizeText(level?.mode).toLowerCase() === 'conformance' ? 'conformance' : 'values';
            const key = `${canonical}|${mode}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return { field: canonical, mode };
        })
        .filter(Boolean)
        .slice(0, 3);
}

function normalizeTableFilters(filters) {
    if (!filters || typeof filters !== 'object') return {};

    const normalized = {};
    const allowedFields = new Map(getWorkingViewTableColumns().map((entry) => [normalizeText(entry.key).toLowerCase(), entry.key]));
    Object.entries(filters).forEach(([field, value]) => {
        const candidate = normalizeText(field).toLowerCase() === 'tag' ? 'tags' : normalizeText(field).toLowerCase();
        const key = allowedFields.get(candidate);
        if (!key) return;
        const text = normalizeText(value?.value ?? value);
        if (!text) return;
        normalized[key] = {
            value: text,
            mode: normalizeText(value?.mode).toLowerCase() === 'exact' ? 'exact' : 'contains'
        };
    });

    return normalized;
}

function normalizeTableConfig(config = {}) {
    const table = config.table && typeof config.table === 'object' ? config.table : {};
    const sortSource = Array.isArray(table.sortLevels) && table.sortLevels.length > 0 ? table.sortLevels : config.sortLevels;
    const groupSource = Array.isArray(table.groupLevels) ? table.groupLevels : config.groupBy;
    const filterSource = table.filters && Object.keys(table.filters).length > 0 ? table.filters : config.filters;
    return {
        sortLevels: normalizeTableSortLevels(sortSource),
        groupLevels: normalizeTableGroupLevels(groupSource),
        filters: normalizeTableFilters(filterSource || {})
    };
}

function buildTableRows(findings) {
    const columns = getWorkingViewTableColumns();
    return normalizeArray(findings).map((finding, index) => ({
        ...finding,
        rowIndex: index,
        columnValues: Object.fromEntries(columns.map((column) => [column.key, normalizeTableValue(finding[column.key], column.key)]))
    }));
}

function applyTableFilters(findings, tableConfig) {
    const filters = tableConfig?.filters || {};
    const columns = getWorkingViewTableColumns();
    return normalizeArray(findings).filter((finding) => {
        return Object.entries(filters).every(([field, filter]) => {
            const normalizedField = normalizeText(field).toLowerCase();
            if (!columns.some((column) => column.key === normalizedField)) return true;
            const filterValue = normalizeText(filter?.value);
            if (!filterValue) return true;
            const sourceValue = normalizeTableValue(finding[normalizedField], normalizedField).toLowerCase();
            if (!sourceValue) return false;
            if (normalizeText(filter?.mode).toLowerCase() === 'exact') {
                return sourceValue === filterValue.toLowerCase();
            }
            return sourceValue.includes(filterValue.toLowerCase());
        });
    });
}

function applyTableSearch(findings, searchText) {
    const text = normalizeText(searchText).toLowerCase();
    if (!text) return findings;
    const columns = getWorkingViewTableColumns();

    return normalizeArray(findings).filter((finding) => {
        const haystack = columns.map((column) => normalizeTableValue(finding[column.key], column.key)).join(' ').toLowerCase();
        return haystack.includes(text);
    });
}

function applyTableSorting(findings, tableConfig) {
    const levels = normalizeTableSortLevels(tableConfig?.sortLevels || []);

    return normalizeArray(findings)
        .map((finding, originalIndex) => ({ finding, originalIndex }))
        .sort((left, right) => {
            for (const level of levels) {
                const direction = normalizeText(level.direction) === 'desc' ? -1 : 1;
                const leftValue = normalizeFieldValueForSort(normalizeTableValue(left.finding[level.field], level.field));
                const rightValue = normalizeFieldValueForSort(normalizeTableValue(right.finding[level.field], level.field));
                if (leftValue < rightValue) return -1 * direction;
                if (leftValue > rightValue) return 1 * direction;
            }
            return left.originalIndex - right.originalIndex;
        })
        .map((item) => item.finding);
}

function getTableGroupValue(finding, groupLevel) {
    if (!groupLevel) return 'All Findings';
    const field = normalizeText(groupLevel.field).toLowerCase();
    const value = finding[field];
    if (normalizeText(groupLevel.mode).toLowerCase() === 'conformance') {
        return getTableConformanceLevel(value) || 'Unspecified';
    }
    const text = normalizeTableValue(value, field);
    return text || 'Unspecified';
}

function buildTableGroupTree(findings, tableConfig) {
    const groupLevels = normalizeTableGroupLevels(tableConfig?.groupLevels || []);
    if (!groupLevels.length) {
        return [{ key: '__all__', label: 'All Findings', level: 0, findings: normalizeArray(findings) }];
    }

    function groupAtLevel(items, level, parentKey) {
        const groupLevel = groupLevels[level];
        const buckets = new Map();
        items.forEach((item) => {
            const value = getTableGroupValue(item, groupLevel);
            const bucket = buckets.get(value) || [];
            bucket.push(item);
            buckets.set(value, bucket);
        });

        return [...buckets.entries()].map(([value, bucket]) => {
            const key = parentKey ? `${parentKey}::${groupLevel.field}:${value}` : `${groupLevel.field}:${value}`;
            const node = {
                key,
                label: `${getTableColumnLabel(groupLevel.field)}: ${value}`,
                field: groupLevel.field,
                value,
                level,
                count: bucket.length,
                findings: level === groupLevels.length - 1 ? bucket : [],
                children: []
            };
            if (level < groupLevels.length - 1) {
                node.children = groupAtLevel(bucket, level + 1, key);
            }
            return node;
        });
    }

    return groupAtLevel(normalizeArray(findings), 0, '');
}

function getTableColumnMenuValues(findings, field) {
    const values = new Set();
    normalizeArray(findings).forEach((finding) => {
        const value = normalizeTableValue(finding[field], field);
        if (value) values.add(value);
    });
    return [...values].sort((left, right) => left.localeCompare(right)).slice(0, 10);
}

function createTableCellMarkup(finding, field) {
    const value = normalizeTableValue(finding[field], field);
    return escapeHtml(value || '');
}

function getTableColumnSummaryText(tableConfig) {
    const sortText = (tableConfig?.sortLevels || [])
        .map((level) => `${getTableColumnLabel(level.field)} (${normalizeText(level.direction) === 'desc' ? 'Descending' : 'Ascending'})`)
        .join(', ') || 'None';
    const groupText = (tableConfig?.groupLevels || [])
        .map((level) => `${getTableColumnLabel(level.field)}${normalizeText(level.mode) === 'conformance' ? ' by conformance level' : ''}`)
        .join(', ') || 'None';
    const filterText = Object.entries(tableConfig?.filters || {})
        .map(([field, filter]) => {
            const text = normalizeText(filter?.value);
            if (!text) return '';
            return `${getTableColumnLabel(field)} contains "${text}"`;
        })
        .filter(Boolean)
        .join(', ') || 'None';

    return { sortText, groupText, filterText };
}

function updateTableConfig(session, updateFn) {
    if (!session || typeof updateFn !== 'function') return false;
    const current = session.config && typeof session.config.table === 'object' ? session.config.table : {};
    const next = updateFn({
        sortLevels: normalizeTableSortLevels(current.sortLevels || []),
        groupLevels: normalizeTableGroupLevels(current.groupLevels || []),
        filters: normalizeTableFilters(current.filters || {})
    });

    session.config = {
        ...session.config,
        table: {
            sortLevels: normalizeTableSortLevels(next?.sortLevels || []),
            groupLevels: normalizeTableGroupLevels(next?.groupLevels || []),
            filters: normalizeTableFilters(next?.filters || {})
        }
    };
    setSession(session.reportId, session);
    return true;
}

function setTableSortLevel(session, field, direction) {
    return updateTableConfig(session, (table) => ({
        ...table,
        sortLevels: [{ field, direction }, ...table.sortLevels.filter((level) => level.field !== field)].slice(0, 3)
    }));
}

function clearTableSortLevel(session, field) {
    return updateTableConfig(session, (table) => ({
        ...table,
        sortLevels: table.sortLevels.filter((level) => level.field !== field)
    }));
}

function setTableFilterValue(session, field, value, mode = 'contains') {
    return updateTableConfig(session, (table) => ({
        ...table,
        filters: {
            ...table.filters,
            [field]: {
                value,
                mode
            }
        }
    }));
}

function clearTableFilterValue(session, field) {
    return updateTableConfig(session, (table) => {
        const nextFilters = { ...table.filters };
        delete nextFilters[field];
        return {
            ...table,
            filters: nextFilters
        };
    });
}

function setTableGroupLevel(session, field, mode = 'values') {
    return updateTableConfig(session, (table) => ({
        ...table,
        groupLevels: [{ field, mode }, ...table.groupLevels.filter((level) => level.field !== field)].slice(0, 3)
    }));
}

function clearTableGroupLevel(session, field) {
    return updateTableConfig(session, (table) => ({
        ...table,
        groupLevels: table.groupLevels.filter((level) => level.field !== field)
    }));
}

function clearAllTableGroups(session) {
    return updateTableConfig(session, (table) => ({
        ...table,
        groupLevels: []
    }));
}

function clearAllTableSorts(session) {
    return updateTableConfig(session, (table) => ({
        ...table,
        sortLevels: []
    }));
}

function applyFilters(findings, config) {
    const severity = normalizeText(config?.filters?.severity).toLowerCase();
    const status = normalizeText(config?.filters?.status).toLowerCase();
    const reviewer = normalizeText(config?.filters?.reviewer).toLowerCase();
    const tag = normalizeText(config?.filters?.tag).toLowerCase();
    const relationship = normalizeText(config?.filters?.relationship).toLowerCase();

    return findings.filter((finding) => {
        if (severity && normalizeText(finding.severity).toLowerCase() !== severity) return false;
        if (status && normalizeText(finding.status).toLowerCase() !== status) return false;
        if (reviewer && !normalizeText(finding.reviewer).toLowerCase().includes(reviewer)) return false;
        if (tag && !(finding.tags || []).some((item) => normalizeText(item).toLowerCase().includes(tag))) return false;
        if (relationship) {
            const relationshipHaystack = [finding.relationship, finding.standard, finding.template, finding.attachment].join(' ').toLowerCase();
            if (!relationshipHaystack.includes(relationship)) return false;
        }
        return true;
    });
}

function applySearch(findings, config) {
    const text = normalizeText(config?.searchText).toLowerCase();
    if (!text) return findings;
    // Consume the existing Universal Search Framework so query parsing/telemetry stays centralized.
    runUniversalSearch(config.searchText || '', {
        source: 'report-views-framework',
        scope: 'current-report',
        limit: 50
    });

    return findings.filter((finding) => {
        const haystack = [
            finding.label,
            finding.severity,
            finding.status,
            finding.reviewer,
            finding.page,
            finding.wcag,
            finding.component,
            finding.type,
            finding.standard,
            finding.template,
            finding.attachment,
            finding.relationship,
            ...(finding.tags || [])
        ].join(' ').toLowerCase();
        return haystack.includes(text);
    });
}

function applySorting(findings, config) {
    const levels = normalizeSortLevels(config?.sortLevels);

    return findings
        .map((finding, originalIndex) => ({ finding, originalIndex }))
        .sort((left, right) => {
            for (const level of levels) {
                const comparison = compareByLevel(left.finding, right.finding, level);
                if (comparison !== 0) return comparison;
            }
            return left.originalIndex - right.originalIndex;
        })
        .map((item) => item.finding);
}

function buildGroupTree(findings, config) {
    const groupFields = normalizeGroupBy(config?.groupBy);
    if (!groupFields.length) {
        return [{ key: '__all__', label: 'All Findings', level: 0, findings }];
    }

    function groupAtLevel(items, level, parentKey) {
        const field = groupFields[level];
        const buckets = new Map();
        items.forEach((item) => {
            const value = normalizeText(item[field]) || 'Unspecified';
            const bucket = buckets.get(value) || [];
            bucket.push(item);
            buckets.set(value, bucket);
        });

        return [...buckets.entries()].map(([value, bucket]) => {
            const key = parentKey ? `${parentKey}::${field}:${value}` : `${field}:${value}`;
            const node = {
                key,
                label: `${getWorkingViewFieldLabel(field)}: ${value}`,
                field,
                value,
                level,
                count: bucket.length,
                findings: level === groupFields.length - 1 ? bucket : [],
                children: []
            };
            if (level < groupFields.length - 1) {
                node.children = groupAtLevel(bucket, level + 1, key);
            }
            return node;
        });
    }

    return groupAtLevel(findings, 0, '');
}

function createViewModel(config) {
    const source = getReportFindingRecords();
    const normalizedMode = normalizeText(config?.mode).toLowerCase();

    if (normalizedMode === 'table') {
        const columns = getWorkingViewTableColumns();
        const tableConfig = normalizeTableConfig(config);
        const filtered = applyTableFilters(source, tableConfig);
        const searched = applyTableSearch(filtered, config?.searchText);
        const sorted = applyTableSorting(searched, tableConfig);
        const groups = buildTableGroupTree(sorted, tableConfig);
        return {
            totalCount: source.length,
            visibleCount: sorted.length,
            findings: sorted,
            groups,
            table: {
                columns,
                config: tableConfig
            }
        };
    }

    const filtered = applyFilters(source, config);
    const searched = applySearch(filtered, config);
    const sorted = applySorting(searched, config);
    const groups = buildGroupTree(sorted, config);
    return {
        totalCount: source.length,
        visibleCount: sorted.length,
        findings: sorted,
        groups
    };
}

function findFocusableSelector() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return '';
    if (active.id) return `#${active.id}`;
    return '';
}

function getSession(reportId) {
    return workingViewStore.sessionsByReportId[reportId] || null;
}

function setSession(reportId, session) {
    workingViewStore.sessionsByReportId[reportId] = session;
    persistStore();
}

function clearSession(reportId) {
    delete workingViewStore.sessionsByReportId[reportId];
    persistStore();
}

function getMainContainer() {
    return document.getElementById('main-inner');
}

function renderSummary(config, model) {
    const normalizedMode = normalizeText(config.mode).toLowerCase();
    const tableSummary = normalizedMode === 'table' ? getTableColumnSummaryText(model.table?.config || normalizeTableConfig(config)) : null;
    const sortText = tableSummary ? tableSummary.sortText : ((config.sortLevels || []).map((level) => `${getWorkingViewFieldLabel(level.field)} (${normalizeText(level.direction) === 'desc' ? 'Descending' : 'Ascending'})`).join(', ') || 'None');
    const groupText = tableSummary ? tableSummary.groupText : ((config.groupBy || []).map((field) => getWorkingViewFieldLabel(field)).join(', ') || 'None');
    const filterParts = [];

    if (tableSummary) {
        filterParts.push(tableSummary.filterText);
    } else {
        Object.entries(config.filters || {}).forEach(([key, value]) => {
            if (!normalizeText(value)) return;
            filterParts.push(`${getWorkingViewFieldLabel(key)}=${value}`);
        });
    }
    const filterText = filterParts.filter(Boolean).join(', ') || 'None';

    return `
        <section class="report-views-summary" aria-labelledby="report-views-summary-heading">
            <h2 id="report-views-summary-heading">Working View Summary</h2>
            <p>Mode: ${escapeHtml(getModeLabel(config.mode))}</p>
            <p>Grouped by: ${escapeHtml(groupText)}</p>
            <p>Sorted by: ${escapeHtml(sortText)}</p>
            <p>Filtered by: ${escapeHtml(filterText)}</p>
            ${normalizedMode === 'table' ? '<p>Column menu buttons are available in the table header for per-column sorting, grouping, and filtering.</p>' : ''}
            <p>Showing ${model.visibleCount} of ${model.totalCount} findings.</p>
        </section>
    `;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderFindingItem(finding, index, reportType) {
    const tagText = (finding.tags || []).join(', ');
    const details = [
        finding.severity ? `Severity: ${finding.severity}` : '',
        finding.status ? `Status: ${finding.status}` : '',
        finding.reviewer ? `Reviewer: ${finding.reviewer}` : '',
        finding.page ? `Page: ${finding.page}` : '',
        finding.wcag ? `WCAG: ${finding.wcag}` : '',
        finding.component ? `Component: ${finding.component}` : '',
        finding.standard ? `Accessibility Standard: ${finding.standard}` : '',
        finding.template ? `Template: ${finding.template}` : '',
        finding.attachment ? `Attachment: ${finding.attachment}` : '',
        tagText ? `Tags: ${tagText}` : ''
    ].filter(Boolean).join(' | ');

    const isAudit = reportType === 'Audit Log' && Number.isInteger(finding.entryIndex) && finding.entryIndex >= 0;

    return `
        <li>
            <button type="button" class="report-views-finding" data-finding-id="${escapeHtml(finding.id)}" data-finding-index="${index}" data-entry-index="${isAudit ? finding.entryIndex : -1}" data-field-index="${Number.isInteger(finding.fieldIndex) ? finding.fieldIndex : -1}">
                <span class="report-views-finding-title">${escapeHtml(finding.label)}</span>
                <span class="report-views-finding-meta">${escapeHtml(details || 'No additional metadata')}</span>
            </button>
        </li>
    `;
}

function renderGroupNodes(nodes, config, reportType, offsetRef) {
    return nodes.map((node) => {
        const isExpanded = config.expandedGroups?.[node.key] !== false;

        if (!node.children || node.children.length === 0) {
            const items = node.findings.map((finding) => {
                const markup = renderFindingItem(finding, offsetRef.value, reportType);
                offsetRef.value += 1;
                return markup;
            }).join('');

            return `
                <details class="report-views-group" data-group-key="${escapeHtml(node.key)}" ${isExpanded ? 'open' : ''}>
                    <summary>${escapeHtml(node.label)} (${node.count || node.findings.length})</summary>
                    <ul>${items}</ul>
                </details>
            `;
        }

        return `
            <details class="report-views-group" data-group-key="${escapeHtml(node.key)}" ${isExpanded ? 'open' : ''}>
                <summary>${escapeHtml(node.label)} (${node.count})</summary>
                <div class="report-views-group-children">
                    ${renderGroupNodes(node.children, config, reportType, offsetRef)}
                </div>
            </details>
        `;
    }).join('');
}

function renderTableRowButton(finding, index, reportType) {
    const tagText = (finding.tags || []).join(', ');
    const details = [
        finding.severity ? `Severity: ${finding.severity}` : '',
        finding.status ? `Status: ${finding.status}` : '',
        finding.reviewer ? `Tester: ${finding.reviewer}` : '',
        finding.page ? `Page: ${finding.page}` : '',
        finding.wcag ? `Success Criteria: ${finding.wcag}` : '',
        finding.component ? `Component: ${finding.component}` : '',
        finding.standard ? `Accessibility Standard: ${finding.standard}` : '',
        finding.attachment ? `Attachment: ${finding.attachment}` : '',
        tagText ? `Tags: ${tagText}` : ''
    ].filter(Boolean).join(' | ');

    const isAudit = reportType === 'Audit Log' && Number.isInteger(finding.entryIndex) && finding.entryIndex >= 0;

    return `
        <button type="button" class="report-views-finding report-views-table-row-button" data-finding-id="${escapeHtml(finding.id)}" data-finding-index="${index}" data-entry-index="${isAudit ? finding.entryIndex : -1}" data-field-index="${Number.isInteger(finding.fieldIndex) ? finding.fieldIndex : -1}">
            <span class="report-views-finding-title">${escapeHtml(finding.label)}</span>
            <span class="report-views-finding-meta">${escapeHtml(details || 'No additional metadata')}</span>
        </button>
    `;
}

function renderWorkingViewTableHeader(columns, findings, tableConfig, activeField = '') {
    const sortLevels = normalizeTableSortLevels(tableConfig?.sortLevels || []);
    const filters = normalizeTableFilters(tableConfig?.filters || {});

    return `
        <thead>
            <tr>
                ${columns.map((column) => {
                    const sort = sortLevels.find((level) => level.field === column.key);
                    const filter = filters[column.key];
                    const uniqueCount = getTableColumnMenuValues(findings, column.key).length;
                    const currentState = [
                        sort ? `Sorted ${normalizeText(sort.direction) === 'desc' ? 'descending' : 'ascending'}` : '',
                        filter?.value ? `Filtered ${normalizeText(filter.mode) === 'exact' ? 'exactly' : 'by text'}` : '',
                        uniqueCount > 0 ? `${uniqueCount} dynamic option${uniqueCount === 1 ? '' : 's'}` : ''
                    ].filter(Boolean).join('. ');
                    return `
                        <th scope="col" id="working-view-table-col-${escapeHtml(column.key)}">
                            <div class="working-view-table-header">
                                <span>${escapeHtml(column.label)}</span>
                                <button type="button" class="working-view-table-menu-button" data-working-view-table-column-menu="${escapeHtml(column.key)}" aria-haspopup="dialog" aria-controls="working-view-column-menu-dialog" aria-expanded="${activeField === column.key ? 'true' : 'false'}" aria-label="Open ${escapeHtml(column.label)} column menu">Menu</button>
                            </div>
                            ${currentState ? `<span class="working-view-table-header-status">${escapeHtml(currentState)}</span>` : ''}
                        </th>
                    `;
                }).join('')}
            </tr>
        </thead>
    `;
}

function renderWorkingViewTableBody(findings, columns, reportType) {
    const dataColumns = normalizeArray(columns);
    if (!Array.isArray(findings) || findings.length === 0) {
        return `<tbody><tr><td colspan="${Math.max(1, dataColumns.length + 1)}">No findings match the current Table view criteria.</td></tr></tbody>`;
    }

    return `
        <tbody>
            ${findings.map((finding, index) => `
                <tr data-finding-id="${escapeHtml(finding.id)}">
                    <th scope="row">${renderTableRowButton(finding, index, reportType)}</th>
                    ${dataColumns.map((column) => `<td headers="working-view-table-col-${escapeHtml(column.key)}">${createTableCellMarkup(finding, column.key)}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
}

function renderWorkingViewTable(findings, config, reportType, activeField = '') {
    const columns = getWorkingViewTableColumns();
    return `
        <div class="working-view-table-shell" aria-label="Working view table results">
            <div class="working-view-table-scroll">
                <table class="working-view-table">
                    <caption class="sr-only">Working View table for ${escapeHtml(config.name || 'Working View')}</caption>
                    ${renderWorkingViewTableHeader(columns, findings, config.table || {}, activeField)}
                    ${renderWorkingViewTableBody(findings, columns, reportType)}
                </table>
            </div>
        </div>
    `;
}

function renderWorkingViewTableGroupNodes(nodes, config, reportType, activeField = '') {
    return nodes.map((node) => {
        const isExpanded = config.expandedGroups?.[node.key] !== false;

        if (!node.children || node.children.length === 0) {
            return `
                <details class="report-views-group" data-group-key="${escapeHtml(node.key)}" ${isExpanded ? 'open' : ''}>
                    <summary>${escapeHtml(node.label)} (${node.count || node.findings.length})</summary>
                    ${renderWorkingViewTable(node.findings, config, reportType, activeField)}
                </details>
            `;
        }

        return `
            <details class="report-views-group" data-group-key="${escapeHtml(node.key)}" ${isExpanded ? 'open' : ''}>
                <summary>${escapeHtml(node.label)} (${node.count})</summary>
                <div class="report-views-group-children">
                    ${renderWorkingViewTableGroupNodes(node.children, config, reportType, activeField)}
                </div>
            </details>
        `;
    }).join('');
}

function buildWorkingViewColumnMenuBody(activeField, findings, session) {
    const column = getWorkingViewTableColumns().find((item) => item.key === activeField) || null;
    if (!column) {
        return `
            <h2 id="working-view-column-menu-heading">Column Menu</h2>
            <p>No column is selected.</p>
            <form method="dialog"><button type="submit">Close</button></form>
        `;
    }

    const tableConfig = normalizeTableConfig(session.config);
    const sortLevel = tableConfig.sortLevels.find((level) => level.field === column.key) || null;
    const groupLevel = tableConfig.groupLevels.find((level) => level.field === column.key) || null;
    const filter = tableConfig.filters[column.key] || null;
    const dynamicValues = getTableColumnMenuValues(findings, column.key);

    return `
            <h2 id="working-view-column-menu-heading">${escapeHtml(column.label)} Column Menu</h2>
            <p id="working-view-column-menu-description">Choose sorting, grouping, or filtering options for this column.</p>
            <section class="working-view-column-menu-section" aria-label="Sorting options">
                <h3>Sort</h3>
                <div class="viewer-dialog-actions" role="group" aria-label="Sort options">
                    <button type="button" data-working-view-column-action="sort-asc" data-working-view-column="${escapeHtml(column.key)}">Sort Ascending</button>
                    <button type="button" data-working-view-column-action="sort-desc" data-working-view-column="${escapeHtml(column.key)}">Sort Descending</button>
                    <button type="button" data-working-view-column-action="sort-clear" data-working-view-column="${escapeHtml(column.key)}" ${sortLevel ? '' : 'disabled'}>Clear Sort</button>
                </div>
            </section>
            <section class="working-view-column-menu-section" aria-label="Grouping options">
                <h3>Group</h3>
                <div class="viewer-dialog-actions" role="group" aria-label="Grouping options">
                    <button type="button" data-working-view-column-action="group-values" data-working-view-column="${escapeHtml(column.key)}">Group by Values</button>
                    <button type="button" data-working-view-column-action="group-clear" data-working-view-column="${escapeHtml(column.key)}" ${groupLevel ? '' : 'disabled'}>Clear Grouping</button>
                </div>
            </section>
            <section class="working-view-column-menu-section" aria-label="Filtering options">
                <h3>Filter</h3>
                <div class="working-view-column-menu-quick-values" aria-label="Dynamic filter options">
                    ${dynamicValues.length > 0 ? dynamicValues.map((value) => `<button type="button" data-working-view-column-action="filter-exact" data-working-view-column="${escapeHtml(column.key)}" data-working-view-column-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('') : '<p>No dynamic values available.</p>'}
                </div>
                <label for="working-view-column-filter-input">Filter values containing</label>
                <input id="working-view-column-filter-input" type="text" value="${escapeHtml(filter?.value || '')}" list="working-view-column-filter-values">
                ${dynamicValues.length > 0 ? `<datalist id="working-view-column-filter-values">${dynamicValues.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('')}</datalist>` : ''}
                <div class="viewer-dialog-actions" role="group" aria-label="Filter actions">
                    <button type="button" data-working-view-column-action="filter-apply" data-working-view-column="${escapeHtml(column.key)}">Apply Filter</button>
                    <button type="button" data-working-view-column-action="filter-clear" data-working-view-column="${escapeHtml(column.key)}" ${filter ? '' : 'disabled'}>Clear Filter</button>
                </div>
            </section>
            <form method="dialog" class="viewer-dialog-actions">
                <button type="submit">Close</button>
            </form>
    `;
}

function applyViewModeClasses(container, config) {
    container.classList.remove('report-view-mode-standard', 'report-view-mode-working', 'report-view-mode-outline', 'report-view-mode-compact', 'report-view-mode-expanded', 'report-view-mode-reading', 'report-view-mode-review', 'report-view-mode-table');
    container.classList.add(`report-view-mode-${normalizeText(config.mode || 'working')}`);
}

function getModeLabel(mode) {
    const value = normalizeText(mode).toLowerCase();
    if (value === 'standard') return 'Standard View';
    if (value === 'outline') return 'Outline View';
    if (value === 'compact') return 'Compact View';
    if (value === 'expanded') return 'Expanded View';
    if (value === 'reading') return 'Reading View';
    if (value === 'review') return 'Review View';
    if (value === 'table') return 'Table View';
    return 'Working View';
}

function syncWindowTitleForSession(session) {
    if (!session) {
        setActivePanel('Report Viewer');
        syncDocumentTitle();
        return;
    }

    setActivePanel('Working View');
    syncDocumentTitle();
}

function getActiveSessionForCurrentReport() {
    const reportId = getCurrentReportId();
    if (!reportId) return null;
    return getSession(reportId);
}

export function isWorkingViewActiveForCurrentReport() {
    return Boolean(getActiveSessionForCurrentReport());
}

export function getActiveWorkingViewSessionSnapshot() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return null;
    return {
        reportId: session.reportId,
        reportName: session.reportName,
        config: session.config && typeof session.config === 'object' ? { ...session.config } : {},
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
    };
}

export function getWorkingViewPresetCatalog() {
    loadStore();
    return (workingViewStore.presets || []).map((preset) => ({
        ...preset,
        config: preset.config && typeof preset.config === 'object' ? { ...preset.config } : {}
    }));
}

function renderWorkingView(session) {
    const container = getMainContainer();
    if (!container || !session) return false;
    const activeElementBeforeRender = document.activeElement;
    const preserveFocusId = activeElementBeforeRender instanceof HTMLElement
        && container.contains(activeElementBeforeRender)
        && activeElementBeforeRender.id
        ? activeElementBeforeRender.id
        : '';
    const model = createViewModel(session.config);
    const normalizedMode = normalizeText(session.config.mode).toLowerCase();
    const isTableMode = normalizedMode === 'table';

    const heading = `Working View - ${session.config.name}`;
    const tableConfig = model.table?.config || normalizeTableConfig(session.config);
    const breadcrumb = isTableMode
        ? `Table Working View > Grouped by ${(tableConfig.groupLevels || []).map((item) => `${getTableColumnLabel(item.field)}${normalizeText(item.mode) === 'conformance' ? ' (conformance level)' : ''}`).join(' > ') || 'None'} > Sorted by ${(tableConfig.sortLevels || []).map((item) => getTableColumnLabel(item.field)).join(', ') || 'None'}`
        : `Working View > Grouped by ${(session.config.groupBy || []).map((item) => getWorkingViewFieldLabel(item)).join(' > ') || 'None'} > Sorted by ${(session.config.sortLevels || []).map((item) => getWorkingViewFieldLabel(item.field)).join(', ') || 'None'}`;
    const offsetRef = { value: 0 };
    const resultsMarkup = isTableMode
        ? (model.groups.length === 1 && model.groups[0].key === '__all__'
            ? renderWorkingViewTable(model.findings, session.config, normalizeText(appState.reportType), activeTableColumnField)
            : renderWorkingViewTableGroupNodes(model.groups, session.config, normalizeText(appState.reportType), activeTableColumnField))
        : renderGroupNodes(model.groups, session.config, normalizeText(appState.reportType), offsetRef);

    container.innerHTML = `
        <section id="report-working-view" aria-labelledby="report-working-view-heading">
            <h1 id="report-working-view-heading" tabindex="-1">${escapeHtml(heading)}</h1>
            <p id="report-working-view-temporary-status" role="status" aria-live="polite">You are viewing a temporary Working View. The underlying report has not been modified unless you explicitly apply this Working View.</p>
            <p class="report-views-breadcrumb">${escapeHtml(breadcrumb)}</p>
            <div class="report-views-toolbar" role="group" aria-label="Working View actions">
                <button id="btn-working-view-exit" type="button">Exit Working View</button>
                <button id="btn-working-view-apply" type="button">Apply Working View</button>
                <button id="btn-working-view-save" type="button">Save Working View</button>
                <button id="btn-working-view-load" type="button">Load Working View</button>
                <button id="btn-working-view-delete" type="button">Delete Working View</button>
                <button id="btn-working-view-refresh" type="button">Refresh Working View</button>
                <button id="btn-working-view-reset" type="button">Reset Working View</button>
                <button id="btn-working-view-batch-status" type="button">Batch Set Status</button>
                <button id="btn-working-view-batch-reviewer" type="button">Batch Assign Reviewer</button>
                <button id="btn-working-view-batch-severity" type="button">Batch Set Severity</button>
                <button id="btn-working-view-batch-tag" type="button">Batch Add Tag</button>
                <button id="btn-working-view-expand-all" type="button">Expand All Groups</button>
                <button id="btn-working-view-collapse-all" type="button">Collapse All Groups</button>
                <button id="btn-working-view-next-finding" type="button">Next Finding</button>
                <button id="btn-working-view-previous-finding" type="button">Previous Finding</button>
                <button id="btn-working-view-next-group" type="button">Next Group</button>
                <button id="btn-working-view-previous-group" type="button">Previous Group</button>
                <button id="btn-working-view-open-config" type="button">Working View Properties</button>
            </div>
            <div class="report-views-toolbar" role="group" aria-label="Working View preset actions">
                <label for="working-view-built-in-preset">Built-in Preset</label>
                <select id="working-view-built-in-preset">
                    <option value="">Choose Preset</option>
                    ${getAvailablePresetOptions().map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('')}
                </select>
                <button id="btn-working-view-apply-built-in-preset" type="button">Apply Built-in Preset</button>
            </div>
            ${renderSummary(session.config, model)}
            <div class="report-views-results" aria-label="Working view results">
                ${resultsMarkup}
            </div>
            ${isTableMode ? `
                <dialog id="working-view-column-menu-dialog" aria-labelledby="working-view-column-menu-heading" aria-describedby="working-view-column-menu-description">
                    <div id="working-view-column-menu-body"></div>
                </dialog>
            ` : ''}
            <dialog id="working-view-config-dialog" aria-labelledby="working-view-config-heading">
                <h2 id="working-view-config-heading">Working View Configuration</h2>
                <label for="working-view-name">Working View Name</label>
                <input id="working-view-name" type="text" value="${escapeHtml(session.config.name)}">

                <label for="working-view-mode">Report View Mode</label>
                <select id="working-view-mode">
                    <option value="working" ${session.config.mode === 'working' ? 'selected' : ''}>Working</option>
                    <option value="outline" ${session.config.mode === 'outline' ? 'selected' : ''}>Outline</option>
                    <option value="compact" ${session.config.mode === 'compact' ? 'selected' : ''}>Compact</option>
                    <option value="expanded" ${session.config.mode === 'expanded' ? 'selected' : ''}>Expanded</option>
                    <option value="reading" ${session.config.mode === 'reading' ? 'selected' : ''}>Reading</option>
                    <option value="review" ${session.config.mode === 'review' ? 'selected' : ''}>Review</option>
                    <option value="table" ${session.config.mode === 'table' ? 'selected' : ''}>Table</option>
                    <option value="standard" ${session.config.mode === 'standard' ? 'selected' : ''}>Standard</option>
                </select>

                <fieldset>
                    <legend>Group By (up to 3 levels)</legend>
                    ${getVisibleWorkingViewFieldCatalog().map((field) => `
                        <label><input type="checkbox" class="working-view-group-field" value="${escapeHtml(field.key)}" ${normalizeGroupBy(session.config.groupBy).includes(field.key) ? 'checked' : ''}> ${escapeHtml(field.label)}</label>
                    `).join('')}
                </fieldset>

                <fieldset>
                    <legend>Sort Levels (up to 3)</legend>
                    ${[0, 1, 2].map((index) => {
                        const level = normalizeSortLevels(session.config.sortLevels)[index] || { field: 'label', direction: 'asc' };
                        return `
                            <div class="working-view-sort-row">
                                <label for="working-view-sort-${index}">Sort ${index + 1} Field</label>
                                <select id="working-view-sort-${index}">
                                    <option value="">None</option>
                                    ${getWorkingViewFieldCatalog().map((field) => `<option value="${escapeHtml(field.key)}" ${level.field === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}
                                </select>
                                <label for="working-view-sort-direction-${index}">Direction</label>
                                <select id="working-view-sort-direction-${index}">
                                    <option value="asc" ${level.direction !== 'desc' ? 'selected' : ''}>Ascending</option>
                                    <option value="desc" ${level.direction === 'desc' ? 'selected' : ''}>Descending</option>
                                </select>
                            </div>
                        `;
                    }).join('')}
                </fieldset>

                <label for="working-view-filter-severity">Filter Severity</label>
                <input id="working-view-filter-severity" type="text" value="${escapeHtml(session.config.filters?.severity || '')}">

                <label for="working-view-filter-status">Filter Status</label>
                <input id="working-view-filter-status" type="text" value="${escapeHtml(session.config.filters?.status || '')}">

                <label for="working-view-filter-reviewer">Filter Reviewer</label>
                <input id="working-view-filter-reviewer" type="text" value="${escapeHtml(session.config.filters?.reviewer || '')}">

                <label for="working-view-filter-tag">Filter Tag</label>
                <input id="working-view-filter-tag" type="text" value="${escapeHtml(session.config.filters?.tag || '')}">

                <label for="working-view-filter-relationship">Filter Relationship</label>
                <input id="working-view-filter-relationship" type="text" value="${escapeHtml(session.config.filters?.relationship || '')}">

                <label for="working-view-search">Search Criteria</label>
                <input id="working-view-search" type="search" value="${escapeHtml(session.config.searchText || '')}">

                <label><input id="working-view-highlight" type="checkbox" ${session.config.highlightMatches !== false ? 'checked' : ''}> Highlight Matches</label>
                <label><input id="working-view-temporary" type="checkbox" ${session.config.temporary !== false ? 'checked' : ''}> Keep Working View temporary</label>

                <div class="viewer-dialog-actions" role="group" aria-label="Working view configuration actions">
                    <button id="btn-working-view-config-apply" type="button">Create Working View</button>
                    <button id="btn-working-view-config-cancel" type="button">Cancel</button>
                </div>
            </dialog>
        </section>
    `;

    applyViewModeClasses(container, session.config);
    bindWorkingViewInteractions(session, model);

    const headingElement = document.getElementById('report-working-view-heading');
    if (preserveFocusId) {
        const preserved = document.getElementById(preserveFocusId);
        if (preserved) {
            window.setTimeout(() => preserved.focus({ preventScroll: true }), 0);
        }
    } else if (headingElement && (!document.activeElement || document.activeElement === document.body)) {
        headingElement.focus({ preventScroll: true });
    }

    syncWindowTitleForSession(session);
    window.dispatchEvent(new CustomEvent('art-working-view-updated', {
        detail: {
            reportId: session.reportId,
            reportName: session.reportName,
            mode: session.config.mode,
            temporary: session.config.temporary,
            visibleCount: model.visibleCount,
            totalCount: model.totalCount,
            config: session.config
        }
    }));
    return true;
}

function updateSessionConfigFromDialog(session) {
    const name = normalizeText(document.getElementById('working-view-name')?.value) || 'Working View';
    const mode = normalizeText(document.getElementById('working-view-mode')?.value) || 'working';
    const previousMode = normalizeText(session.config.mode) || 'working';
    const groupValues = normalizeGroupBy(
        [...document.querySelectorAll('.working-view-group-field:checked')].map((item) => item.getAttribute('value') || '')
    );

    const sortLevels = normalizeSortLevels([0, 1, 2].map((index) => {
        const field = normalizeText(document.getElementById(`working-view-sort-${index}`)?.value);
        const direction = normalizeText(document.getElementById(`working-view-sort-direction-${index}`)?.value) === 'desc' ? 'desc' : 'asc';
        return { field, direction };
    }));

    session.config = {
        ...session.config,
        name,
        mode,
        groupBy: groupValues,
        sortLevels,
        searchText: String(document.getElementById('working-view-search')?.value || ''),
        highlightMatches: Boolean(document.getElementById('working-view-highlight')?.checked),
        temporary: Boolean(document.getElementById('working-view-temporary')?.checked),
        filters: {
            severity: String(document.getElementById('working-view-filter-severity')?.value || ''),
            status: String(document.getElementById('working-view-filter-status')?.value || ''),
            reviewer: String(document.getElementById('working-view-filter-reviewer')?.value || ''),
            tag: String(document.getElementById('working-view-filter-tag')?.value || ''),
            relationship: String(document.getElementById('working-view-filter-relationship')?.value || '')
        },
        table: mode === 'table'
            ? {
                ...(session.config.table || {}),
                sortLevels,
                // Switching into Table mode should show the interactive table first.
                // Table grouping is available dynamically through column menus and
                // should not inherit grouped Working View defaults on the first switch.
                groupLevels: previousMode === 'table'
                    ? groupValues.map((field) => ({
                        field,
                        mode: field === 'wcag' ? 'conformance' : 'values'
                    }))
                    : [],
                filters: {
                    ...(normalizeTableFilters(session.config.table?.filters || {})),
                    severity: String(document.getElementById('working-view-filter-severity')?.value || ''),
                    status: String(document.getElementById('working-view-filter-status')?.value || ''),
                    reviewer: String(document.getElementById('working-view-filter-reviewer')?.value || ''),
                    tags: String(document.getElementById('working-view-filter-tag')?.value || ''),
                    relationship: String(document.getElementById('working-view-filter-relationship')?.value || '')
                }
            }
            : session.config.table || {
                sortLevels: [],
                groupLevels: [],
                filters: {}
            }
    };
}

function dedupeTags(tags) {
    const seen = new Set();
    const normalized = [];
    tags.forEach((tag) => {
        const value = normalizeText(tag);
        if (!value) return;
        const key = value.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(value);
    });
    return normalized;
}

function applyBatchToVisibleFindings(session, key, value, options = {}) {
    if (!session) return false;
    const model = createViewModel(session.config);
    if (!model.findings.length) {
        announce('No visible findings matched the current Working View criteria.');
        return false;
    }

    const indexMap = inferFieldIndexes();
    const targetIndex = Number(indexMap[key]);
    const isAudit = normalizeText(appState.reportType) === 'Audit Log' || normalizeText(appState.reportType) === 'Executive Summary' || normalizeText(appState.reportType) === 'Usability Report';

    if (isAudit) {
        if (!Number.isInteger(targetIndex) || targetIndex < 0) {
            announce(`Cannot apply batch update. A ${key} field is not configured in this report.`);
            return false;
        }

        let updatedCount = 0;
        model.findings.forEach((finding) => {
            if (!Number.isInteger(finding.entryIndex) || finding.entryIndex < 0) return;
            const entry = appState.auditEntries[finding.entryIndex];
            if (!entry) return;
            const currentValue = String(entry.fieldValues?.[targetIndex] || '');

            if (options.appendTag === true) {
                const nextTags = dedupeTags([...toTags(currentValue), value]);
                entry.fieldValues[targetIndex] = nextTags.join(', ');
            } else {
                entry.fieldValues[targetIndex] = value;
            }
            updatedCount += 1;
        });

        if (updatedCount === 0) {
            announce('No matching findings were updated.');
            return false;
        }

        saveState({ action: `Batch updated ${key} for ${updatedCount} findings` });
        upsertCurrentReport({
            action: `Batch updated ${key} from Working View`,
            markAsSelected: true
        });
        renderWorkingView(session);
        announce(`Batch updated ${key} for ${updatedCount} findings.`);
        return true;
    }

    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
        announce(`Cannot apply batch update. A ${key} field is not configured in this report.`);
        return false;
    }

    if (options.appendTag === true) {
        const currentValue = String(appState.editorFieldValues?.[targetIndex] || '');
        appState.editorFieldValues[targetIndex] = dedupeTags([...toTags(currentValue), value]).join(', ');
    } else {
        appState.editorFieldValues[targetIndex] = value;
    }
    saveState({ action: `Batch updated ${key} from Working View` });
    upsertCurrentReport({
        action: `Batch updated ${key} from Working View`,
        markAsSelected: true
    });
    renderWorkingView(session);
    announce(`Batch updated ${key}.`);
    return true;
}

function runBatchActionPrompt(session, key, label, options = {}) {
    const value = normalizeText(window.prompt(`Batch ${label}: apply to currently visible findings`, ''));
    if (!value) return false;
    return applyBatchToVisibleFindings(session, key, value, options);
}

function bindWorkingViewInteractions(session, model) {
    const dialog = document.getElementById('working-view-config-dialog');
    const columnMenuDialog = document.getElementById('working-view-column-menu-dialog');
    const columnMenuBody = document.getElementById('working-view-column-menu-body');
    const isTableMode = normalizeText(session.config.mode).toLowerCase() === 'table';

    const openColumnMenu = (field) => {
        if (!isTableMode || !columnMenuDialog || !columnMenuBody) return;
        activeTableColumnField = normalizeText(field).toLowerCase();
        columnMenuBody.innerHTML = buildWorkingViewColumnMenuBody(activeTableColumnField, model.findings, session);
        if (typeof columnMenuDialog.showModal === 'function' && !columnMenuDialog.open) {
            columnMenuDialog.showModal();
        }
        window.setTimeout(() => {
            document.getElementById('working-view-column-filter-input')?.focus();
        }, 0);
    };

    const handleColumnMenuAction = (action, field, value) => {
        if (!field) return;

        if (action === 'sort-asc' || action === 'sort-desc') {
            setTableSortLevel(session, field, action === 'sort-desc' ? 'desc' : 'asc');
        } else if (action === 'sort-clear') {
            clearTableSortLevel(session, field);
        } else if (action === 'group-values') {
            setTableGroupLevel(session, field, 'values');
        } else if (action === 'group-conformance') {
            setTableGroupLevel(session, field, 'conformance');
        } else if (action === 'group-clear') {
            clearTableGroupLevel(session, field);
        } else if (action === 'filter-exact') {
            setTableFilterValue(session, field, value, 'exact');
        } else if (action === 'filter-apply') {
            const input = document.getElementById('working-view-column-filter-input');
            setTableFilterValue(session, field, String(input?.value || ''), 'contains');
        } else if (action === 'filter-clear') {
            clearTableFilterValue(session, field);
        }

        activeTableColumnField = '';
        columnMenuDialog?.close();
        renderWorkingView(session);
        announce(`Updated ${getTableColumnLabel(field)} column.`);
    };

    document.getElementById('btn-working-view-apply-built-in-preset')?.addEventListener('click', () => {
        const presetId = normalizeText(document.getElementById('working-view-built-in-preset')?.value);
        const preset = getAvailablePresetOptions().find((item) => item.id === presetId);
        if (!preset) {
            announce('Select a built-in preset first.');
            return;
        }

        session.config = {
            ...session.config,
            ...preset.config,
            name: preset.name,
            groupBy: normalizeGroupBy(preset.config.groupBy),
            sortLevels: normalizeSortLevels(preset.config.sortLevels)
        };
        setSession(session.reportId, session);
        renderWorkingView(session);
        announce(`Applied Working View preset: ${preset.name}.`);
    });

    document.querySelectorAll('[data-working-view-table-column-menu]').forEach((button) => {
        button.addEventListener('click', () => {
            const field = normalizeText(button.getAttribute('data-working-view-table-column-menu')).toLowerCase();
            openColumnMenu(field);
        });
    });

    columnMenuDialog?.addEventListener('click', (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) return;
        const action = normalizeText(target.getAttribute('data-working-view-column-action')).toLowerCase();
        const field = normalizeText(target.getAttribute('data-working-view-column')).toLowerCase();
        if (!action || !field) return;
        event.preventDefault();
        handleColumnMenuAction(action, field, normalizeText(target.getAttribute('data-working-view-column-value')));
    });

    columnMenuDialog?.addEventListener('close', () => {
        activeTableColumnField = '';
    });

    document.getElementById('btn-working-view-open-config')?.addEventListener('click', () => {
        if (!dialog) return;
        dialog.showModal();
        document.getElementById('working-view-name')?.focus();
    });

    document.getElementById('btn-working-view-config-cancel')?.addEventListener('click', () => {
        dialog?.close();
    });

    document.getElementById('btn-working-view-config-apply')?.addEventListener('click', () => {
        updateSessionConfigFromDialog(session);
        setSession(session.reportId, session);
        dialog?.close();
        renderWorkingView(session);
        announce('Working View updated.');
    });

    document.getElementById('btn-working-view-exit')?.addEventListener('click', () => {
        exitWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-apply')?.addEventListener('click', () => {
        applyWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-refresh')?.addEventListener('click', () => {
        refreshWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-reset')?.addEventListener('click', () => {
        resetWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-batch-status')?.addEventListener('click', () => {
        runBatchActionPrompt(session, 'status', 'Set Status');
    });

    document.getElementById('btn-working-view-batch-reviewer')?.addEventListener('click', () => {
        runBatchActionPrompt(session, 'reviewer', 'Assign Reviewer');
    });

    document.getElementById('btn-working-view-batch-severity')?.addEventListener('click', () => {
        runBatchActionPrompt(session, 'severity', 'Set Severity');
    });

    document.getElementById('btn-working-view-batch-tag')?.addEventListener('click', () => {
        runBatchActionPrompt(session, 'tags', 'Add Tag', { appendTag: true });
    });

    document.getElementById('btn-working-view-save')?.addEventListener('click', () => {
        saveWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-load')?.addEventListener('click', () => {
        loadWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-delete')?.addEventListener('click', () => {
        deleteWorkingViewFromCommand();
    });

    document.getElementById('btn-working-view-expand-all')?.addEventListener('click', () => {
        expandAllWorkingViewGroupsFromCommand();
    });

    document.getElementById('btn-working-view-collapse-all')?.addEventListener('click', () => {
        collapseAllWorkingViewGroupsFromCommand();
    });

    document.getElementById('btn-working-view-next-finding')?.addEventListener('click', () => {
        nextWorkingViewFindingFromCommand();
    });

    document.getElementById('btn-working-view-previous-finding')?.addEventListener('click', () => {
        previousWorkingViewFindingFromCommand();
    });

    document.getElementById('btn-working-view-next-group')?.addEventListener('click', () => {
        nextWorkingViewGroupFromCommand();
    });

    document.getElementById('btn-working-view-previous-group')?.addEventListener('click', () => {
        previousWorkingViewGroupFromCommand();
    });

    document.querySelectorAll('#report-working-view .report-views-group').forEach((detail) => {
        detail.addEventListener('toggle', () => {
            const key = normalizeText(detail.getAttribute('data-group-key'));
            if (!key) return;
            session.config.expandedGroups = {
                ...(session.config.expandedGroups || {}),
                [key]: detail.open
            };
            setSession(session.reportId, session);
        });
    });

    document.querySelectorAll('#report-working-view .report-views-finding').forEach((button) => {
        button.addEventListener('click', () => {
            const findingId = normalizeText(button.getAttribute('data-finding-id'));
            session.config.selectedFindingId = findingId;
            setSession(session.reportId, session);
            button.focus();
        });

        button.addEventListener('dblclick', () => {
            const entryIndex = Number(button.getAttribute('data-entry-index') || -1);
            const fieldIndex = Number(button.getAttribute('data-field-index') || -1);
            if ((normalizeText(appState.reportType) === 'Audit Log' || normalizeText(appState.reportType) === 'Executive Summary' || normalizeText(appState.reportType) === 'Usability Report') && entryIndex >= 0) {
                activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
                announce('Moved to Report Editor for finding edit.');
                return;
            }
            if (fieldIndex >= 0) {
                activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
                announce('Moved to Report Editor for field edit.');
            }
        });
    });

    const findingButtons = [...document.querySelectorAll('#report-working-view .report-views-finding')];
    const groupDetails = [...document.querySelectorAll('#report-working-view .report-views-group')];

    function focusFinding(nextIndex) {
        if (!findingButtons.length) return false;
        const bounded = ((nextIndex % findingButtons.length) + findingButtons.length) % findingButtons.length;
        session.findingIndex = bounded;
        setSession(session.reportId, session);
        findingButtons[bounded].focus();
        return true;
    }

    function focusGroup(nextIndex) {
        if (!groupDetails.length) return false;
        const bounded = ((nextIndex % groupDetails.length) + groupDetails.length) % groupDetails.length;
        session.groupIndex = bounded;
        setSession(session.reportId, session);
        const summary = groupDetails[bounded].querySelector('summary');
        if (summary instanceof HTMLElement) summary.focus();
        return true;
    }

    session.findingIndex = Math.max(0, Math.min(session.findingIndex || 0, Math.max(0, findingButtons.length - 1)));
    session.groupIndex = Math.max(0, Math.min(session.groupIndex || 0, Math.max(0, groupDetails.length - 1)));
    setSession(session.reportId, session);

    const root = document.getElementById('report-working-view');
    root?.addEventListener('keydown', (event) => {
        const active = document.activeElement;
        if (event.key === 'Escape') {
            if (columnMenuDialog?.open) {
                event.preventDefault();
                columnMenuDialog.close();
                return;
            }
            const dialogOpen = Boolean(dialog && dialog.open);
            if (dialogOpen) {
                event.preventDefault();
                dialog.close();
                return;
            }
            if (active === document.getElementById('working-view-search')) {
                const searchInput = document.getElementById('working-view-search');
                if (searchInput instanceof HTMLInputElement && searchInput.value) {
                    event.preventDefault();
                    searchInput.value = '';
                    session.config.searchText = '';
                    setSession(session.reportId, session);
                    renderWorkingView(session);
                    announce('Working View search cleared.');
                }
                return;
            }
            event.preventDefault();
            exitWorkingViewFromCommand();
            return;
        }

        if (event.key === 'F3' && !event.shiftKey) {
            event.preventDefault();
            nextWorkingViewFindingFromCommand();
            return;
        }

        if (event.key === 'F3' && event.shiftKey) {
            event.preventDefault();
            previousWorkingViewFindingFromCommand();
            return;
        }

        if (event.key === 'ArrowDown' && active?.classList?.contains('report-views-finding')) {
            event.preventDefault();
            focusFinding((session.findingIndex || 0) + 1);
            return;
        }

        if (event.key === 'ArrowUp' && active?.classList?.contains('report-views-finding')) {
            event.preventDefault();
            focusFinding((session.findingIndex || 0) - 1);
            return;
        }
    });

    const selectionStatus = document.getElementById('report-working-view-temporary-status');
    if (selectionStatus) {
        selectionStatus.setAttribute('aria-label', `Working View active. Showing ${model.visibleCount} of ${model.totalCount} findings.`);
    }
}

function ensureWorkingViewSession(options = {}) {
    const reportId = getCurrentReportId();
    if (!reportId) {
        announce('Open a report before using Working View.');
        return null;
    }

    const reportName = getCurrentReportName();
    const existing = getSession(reportId);
    if (existing) return existing;

    const config = {
        ...defaultConfig(),
        ...(options.config && typeof options.config === 'object' ? options.config : {})
    };

    const session = {
        reportId,
        reportName,
        config,
        findingIndex: 0,
        groupIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    setSession(reportId, session);
    return session;
}

function restoreOriginalView(session) {
    if (!session) return false;
    const tabId = normalizeText(session.config?.sourceTabId) || 'tab-view';
    if (tabId === 'tab-builder') {
        activateTabCommand('tab-builder', 'builder-heading', 'Report Builder');
    } else if (tabId === 'tab-editor') {
        activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
    } else {
        activateTabCommand('tab-view', 'viewer-heading', 'Report Viewer');
    }

    const selector = normalizeText(session.config?.sourceFocusSelector);
    if (selector) {
        window.setTimeout(() => {
            const focusTarget = document.querySelector(selector);
            if (focusTarget instanceof HTMLElement) focusTarget.focus();
        }, 0);
    }

    const scrollY = Number(session.config?.sourceScrollY || 0);
    window.setTimeout(() => {
        window.scrollTo({ top: Math.max(0, scrollY), behavior: 'auto' });
    }, 0);

    syncWindowTitleForSession(null);
    return true;
}

function openWorkingViewWithConfig(options = {}) {
    const session = ensureWorkingViewSession(options);
    if (!session) return false;

    session.config = {
        ...session.config,
        sourceTabId: getCurrentTabId(),
        sourceFocusSelector: findFocusableSelector(),
        sourceScrollY: window.scrollY || 0,
        ...(options.config && typeof options.config === 'object' ? options.config : {})
    };
    session.updatedAt = new Date().toISOString();
    setSession(session.reportId, session);

    activateTabCommand('tab-view', 'viewer-heading', 'Report Viewer');
    renderWorkingView(session);

    const showConfigImmediately = options.showConfig !== false;
    if (showConfigImmediately) {
        window.setTimeout(() => {
            const dialog = document.getElementById('working-view-config-dialog');
            if (dialog && typeof dialog.showModal === 'function') {
                dialog.showModal();
                document.getElementById('working-view-name')?.focus();
            }
        }, 0);
    }

    return true;
}

function reorderAuditEntriesFromSession(session) {
    if (!session) return false;
    if (normalizeText(appState.reportType) !== 'Audit Log' && normalizeText(appState.reportType) !== 'Executive Summary' && normalizeText(appState.reportType) !== 'Usability Report') return false;

    const model = createViewModel(session.config);
    const orderedEntryIndexes = model.findings
        .map((finding) => finding.entryIndex)
        .filter((index) => Number.isInteger(index) && index >= 0);

    if (!orderedEntryIndexes.length) return false;

    const original = getAuditEntries();
    const reordered = orderedEntryIndexes.map((entryIndex) => original[entryIndex]).filter(Boolean);
    if (!reordered.length) return false;

    appState.auditEntries = reordered;
    appState.activeAuditEntryIndex = 0;
    saveState({ action: `Applied working view ordering for ${session.reportName}` });
    upsertCurrentReport({ action: `Applied working view ${session.config.name}`, markAsSelected: true });
    window.dispatchEvent(new Event('art-reports-updated'));
    window.dispatchEvent(new Event('art-state-updated'));
    return true;
}

function savePresetFromSession(session, scope = 'report') {
    if (!session) return false;
    const name = normalizeText(window.prompt('Save Working View Preset name', session.config.name || 'Working View Preset'));
    if (!name) return false;

    const normalizedScope = ['global', 'project', 'report'].includes(scope) ? scope : 'report';
    const reportId = session.reportId;
    const workspaceId = normalizeText(appState.activeWorkspaceId);

    const duplicate = workingViewStore.presets.find((preset) => {
        if (normalizeText(preset.name).toLowerCase() !== name.toLowerCase()) return false;
        if (normalizeText(preset.scope) !== normalizedScope) return false;
        if (normalizedScope === 'report' && normalizeText(preset.reportId) !== reportId) return false;
        if (normalizedScope === 'project' && normalizeText(preset.workspaceId) !== workspaceId) return false;
        return true;
    });

    if (duplicate) {
        announce('A preset with that name already exists in the selected scope.');
        return false;
    }

    const preset = {
        id: `working-view-preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        description: normalizeText(window.prompt('Optional description', '')),
        scope: normalizedScope,
        reportId: normalizedScope === 'report' ? reportId : '',
        workspaceId: normalizedScope === 'project' ? workspaceId : '',
        category: normalizeText(window.prompt('Optional category', '')),
        config: {
            ...session.config,
            temporary: true
        },
        createdAt: new Date().toISOString(),
        formatVersion: '1.0'
    };

    workingViewStore.presets.push(preset);
    persistStore();
    announce(`Saved working view preset ${name}.`);
    return true;
}

function getVisiblePresetsForCurrentContext() {
    const reportId = getCurrentReportId();
    const workspaceId = normalizeText(appState.activeWorkspaceId);
    return (workingViewStore.presets || []).filter((preset) => {
        const scope = normalizeText(preset.scope);
        if (scope === 'global') return true;
        if (scope === 'project') return normalizeText(preset.workspaceId) === workspaceId;
        if (scope === 'report') return normalizeText(preset.reportId) === reportId;
        return false;
    });
}

function pickPreset(message, fallback = 0) {
    const presets = getVisiblePresetsForCurrentContext();
    if (!presets.length) {
        announce('No working view presets are available.');
        return null;
    }

    const promptText = `${message}\n${presets.map((preset, index) => `${index + 1}. ${preset.name} (${preset.scope})`).join('\n')}`;
    const selected = Number(window.prompt(promptText, String(fallback + 1)) || 0);
    if (!Number.isInteger(selected) || selected < 1 || selected > presets.length) return null;
    return presets[selected - 1];
}

export function openWorkingViewFromCommand(context = {}) {
    const contextReportId = normalizeText(context?.reportId);
    if (contextReportId && contextReportId !== normalizeText(appState.selectedReportId)) {
        appState.selectedReportId = contextReportId;
        saveState({ action: 'Selected report for Working View', recordHistory: false });
        window.dispatchEvent(new Event('art-reports-updated'));
    }
    const config = context.config && typeof context.config === 'object' ? context.config : {};
    return openWorkingViewWithConfig({ config, showConfig: context.showConfig !== false });
}

export function canCloseWorkingViewFromCommand() {
    return Boolean(getActiveSessionForCurrentReport());
}

export function exitWorkingViewFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    clearSession(session.reportId);
    restoreOriginalView(session);
    announce('Exited Working View and restored the original report presentation.');
    window.dispatchEvent(new Event('art-working-view-exited'));
    return true;
}

export function closeWorkingViewFromCommand(options = {}) {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;

    if (options?.promptToSave) {
        const saveBeforeClose = window.confirm('Save Working View before closing?');
        if (saveBeforeClose) {
            saveWorkingViewFromCommand();
        }
    }

    return exitWorkingViewFromCommand();
}

export function applyWorkingViewFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;

    const approved = window.confirm('Applying this Working View permanently reorganizes the current report presentation/order. Report content is not changed. Continue?');
    if (!approved) return false;

    const applied = reorderAuditEntriesFromSession(session);
    if (!applied) {
        announce('Apply Working View completed. This report type currently uses temporary presentation settings only.');
        return true;
    }

    session.config.temporary = false;
    session.updatedAt = new Date().toISOString();
    setSession(session.reportId, session);
    announce('Working View applied to the current report organization.');
    return true;
}

export function saveWorkingViewFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;

    const scopeInput = normalizeText(window.prompt('Preset scope: global, project, or report', 'report')).toLowerCase();
    const scope = scopeInput === 'global' || scopeInput === 'project' ? scopeInput : 'report';
    return savePresetFromSession(session, scope);
}

export function loadWorkingViewFromCommand() {
    const preset = pickPreset('Select a Working View preset to load');
    if (!preset) return false;

    return openWorkingViewWithConfig({
        config: {
            ...(preset.config || {}),
            name: normalizeText(preset.name) || 'Working View'
        },
        showConfig: false
    });
}

export function loadWorkingViewForReportFromCommand(reportId = '') {
    const resolvedReportId = normalizeText(reportId);
    if (resolvedReportId && resolvedReportId !== normalizeText(appState.selectedReportId)) {
        appState.selectedReportId = resolvedReportId;
        saveState({ action: 'Selected report for Working View preset load', recordHistory: false });
        window.dispatchEvent(new Event('art-reports-updated'));
    }
    return loadWorkingViewFromCommand();
}

export function deleteWorkingViewFromCommand() {
    const preset = pickPreset('Select a Working View preset to delete');
    if (!preset) return false;

    const confirmed = window.confirm(`Delete preset ${preset.name}?`);
    if (!confirmed) return false;

    workingViewStore.presets = (workingViewStore.presets || []).filter((item) => item.id !== preset.id);
    persistStore();
    announce(`Deleted working view preset ${preset.name}.`);
    return true;
}

export function refreshWorkingViewFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    session.updatedAt = new Date().toISOString();
    setSession(session.reportId, session);
    renderWorkingView(session);
    announce('Working View refreshed.');
    return true;
}

export function resetWorkingViewFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    session.config = {
        ...defaultConfig(),
        sourceTabId: session.config.sourceTabId,
        sourceFocusSelector: session.config.sourceFocusSelector,
        sourceScrollY: session.config.sourceScrollY
    };
    session.updatedAt = new Date().toISOString();
    setSession(session.reportId, session);
    renderWorkingView(session);
    announce('Working View reset to defaults.');
    return true;
}

function focusFindingByOffset(offset) {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    const buttons = [...document.querySelectorAll('#report-working-view .report-views-finding')];
    if (!buttons.length) return false;
    const index = ((Number(session.findingIndex || 0) + offset) % buttons.length + buttons.length) % buttons.length;
    session.findingIndex = index;
    setSession(session.reportId, session);
    buttons[index].focus();
    announce(`Finding ${index + 1} of ${buttons.length}.`);
    return true;
}

function focusGroupByOffset(offset) {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    const groups = [...document.querySelectorAll('#report-working-view .report-views-group')];
    if (!groups.length) return false;
    const index = ((Number(session.groupIndex || 0) + offset) % groups.length + groups.length) % groups.length;
    session.groupIndex = index;
    setSession(session.reportId, session);
    const summary = groups[index].querySelector('summary');
    if (summary instanceof HTMLElement) {
        summary.focus();
        announce(`Group ${index + 1} of ${groups.length}.`);
        return true;
    }
    return false;
}

export function nextWorkingViewFindingFromCommand() {
    return focusFindingByOffset(1);
}

export function previousWorkingViewFindingFromCommand() {
    return focusFindingByOffset(-1);
}

export function nextWorkingViewGroupFromCommand() {
    return focusGroupByOffset(1);
}

export function previousWorkingViewGroupFromCommand() {
    return focusGroupByOffset(-1);
}

export function revealWorkingViewInExplorerFromCommand() {
    const selected = document.activeElement instanceof HTMLElement ? document.activeElement.closest('.report-views-finding') : null;
    if (!selected) return false;
    const findingId = normalizeText(selected.getAttribute('data-finding-id'));
    const findingLabel = normalizeText(selected.querySelector('.report-views-finding-title')?.textContent || '');
    window.dispatchEvent(new CustomEvent('art-working-view-reveal-in-explorer', {
        detail: {
            reportId: getCurrentReportId(),
            findingId,
            findingLabel
        }
    }));
    announce('Requested reveal in Explorer.');
    return true;
}

export function revealWorkingViewInReportFromCommand() {
    activateTabCommand('tab-editor', 'editor-heading', 'Report Editor');
    announce('Returned to report view.');
    return true;
}

export function expandAllWorkingViewGroupsFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    document.querySelectorAll('#report-working-view .report-views-group').forEach((detail) => {
        detail.open = true;
        const key = normalizeText(detail.getAttribute('data-group-key'));
        if (!key) return;
        session.config.expandedGroups[key] = true;
    });
    setSession(session.reportId, session);
    announce('Expanded all groups.');
    return true;
}

export function collapseAllWorkingViewGroupsFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    document.querySelectorAll('#report-working-view .report-views-group').forEach((detail) => {
        detail.open = false;
        const key = normalizeText(detail.getAttribute('data-group-key'));
        if (!key) return;
        session.config.expandedGroups[key] = false;
    });
    setSession(session.reportId, session);
    announce('Collapsed all groups.');
    return true;
}

export function batchSetWorkingViewStatusFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    return runBatchActionPrompt(session, 'status', 'Set Status');
}

export function batchAssignWorkingViewReviewerFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    return runBatchActionPrompt(session, 'reviewer', 'Assign Reviewer');
}

export function batchSetWorkingViewSeverityFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    return runBatchActionPrompt(session, 'severity', 'Set Severity');
}

export function batchAddWorkingViewTagFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return false;
    return runBatchActionPrompt(session, 'tags', 'Add Tag', { appendTag: true });
}

export function setReportViewModeFromCommand(mode = 'working') {
    const normalizedMode = normalizeText(mode).toLowerCase() || 'working';

    if (normalizedMode === 'standard') {
        return exitWorkingViewFromCommand();
    }

    const session = ensureWorkingViewSession({ config: { mode: normalizedMode, temporary: true } });
    if (!session) return false;
    session.config.mode = normalizedMode;
    session.updatedAt = new Date().toISOString();
    setSession(session.reportId, session);
    renderWorkingView(session);
    announce(`${getModeLabel(normalizedMode)} activated.`);
    return true;
}

export function toggleReportViewModeFromCommand() {
    const session = getActiveSessionForCurrentReport();
    if (!session) {
        return openWorkingViewFromCommand({ showConfig: false });
    }
    return exitWorkingViewFromCommand();
}

function handleWorkingViewAutoRefresh() {
    const session = getActiveSessionForCurrentReport();
    if (!session) return;
    if (!document.getElementById('report-working-view')) return;
    renderWorkingView(session);
}

export function initReportViewsFramework() {
    if (initialized) return true;
    initialized = true;
    loadStore();

    window.addEventListener('art-state-updated', handleWorkingViewAutoRefresh);
    window.addEventListener('art-reports-updated', handleWorkingViewAutoRefresh);
    window.addEventListener('art-workspace-event', (event) => {
        const type = normalizeText(event?.detail?.type);
        if (!type) return;
        if (type === 'WorkspaceClosed') {
            const reportId = getCurrentReportId();
            if (reportId) clearSession(reportId);
        }
    });

    window.addEventListener('art-working-view-reveal-request', (event) => {
        const detail = event?.detail || {};
    activeTableColumnField = '';
        openWorkingViewFromCommand({
            showConfig: false,
            config: {
                ...(detail.config || {}),
                name: normalizeText(detail.name || 'Working View')
            }
        });
    });

    window.addEventListener('art-viewer-rendered', () => {
        const session = getActiveSessionForCurrentReport();
        if (!session) return;
        renderWorkingView(session);
    });

    window.addEventListener('art-plugin-framework-event', (event) => {
        const type = normalizeText(event?.detail?.type);
        if (!type) return;
        if (type === 'Plugin Loaded' || type === 'Plugin Enabled' || type === 'Plugin Disabled') {
            const session = getActiveSessionForCurrentReport();
            if (!session || !document.getElementById('report-working-view')) return;
            renderWorkingView(session);
        }
    });

    return true;
}
