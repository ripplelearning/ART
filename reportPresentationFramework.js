import { announce, appState, getActiveProjectWorkspace, getCurrentReportMetrics, getProgressItems, getTemplateById, saveState, setActiveWorkspaceDefaultBranding } from './state.js';

const PRESENTATION_EVENT = 'art-presentation-updated';
const PRESENTATION_RESOURCE_TYPES = Object.freeze({
    layout: 'layout',
    theme: 'theme',
    branding: 'branding',
    publishingProfile: 'publishingProfile'
});
const PRESENTATION_SCOPES = new Set(['personal', 'workspace', 'shared', 'application']);
const PREVIEW_MODES = new Set(['screen', 'print', 'pdf', 'word', 'html']);
const PRESENTATION_PERMISSIONS = Object.freeze(['read', 'use', 'comment', 'edit', 'rename', 'share', 'delete']);
const PRESENTATION_SECTION_ORDER = Object.freeze([
    'cover-page',
    'table-of-contents',
    'executive-summary',
    'workspace-report-summary',
    'analytics',
    'findings',
    'recommendations',
    'appendices',
    'references',
    'evidence'
]);
const PRESENTATION_SECTION_LABELS = Object.freeze({
    'cover-page': 'Cover Page',
    'table-of-contents': 'Table of Contents',
    'executive-summary': 'Executive Summary',
    'workspace-report-summary': 'Workspace/Report Summary',
    analytics: 'Analytics',
    findings: 'Findings',
    recommendations: 'Recommendations',
    appendices: 'Appendices',
    references: 'References',
    evidence: 'Evidence'
});

const BUILT_IN_LAYOUTS = Object.freeze([
    {
        id: 'layout-detailed-accessibility-audit',
        name: 'Detailed Accessibility Audit',
        description: 'Full audit structure with cover page, summary, analytics, findings, recommendations, references, and evidence.',
        scope: 'application',
        readOnly: true,
        supportedReportTypes: ['Audit Log', 'Executive Summary'],
        sections: [
            { id: 'cover-page', enabled: true, required: false },
            { id: 'table-of-contents', enabled: true, required: false },
            { id: 'workspace-report-summary', enabled: true, required: true },
            { id: 'analytics', enabled: true, required: false },
            { id: 'findings', enabled: true, required: true },
            { id: 'recommendations', enabled: true, required: false },
            { id: 'references', enabled: true, required: false },
            { id: 'evidence', enabled: true, required: false },
            { id: 'appendices', enabled: true, required: false }
        ],
        findingPresentation: 'grouped-cards',
        pageStructure: {
            pageSize: 'letter',
            pageBreakStrategy: 'keep-headings-with-content',
            repeatHeaderFooter: true,
            repeatTableHeaders: true
        },
        coverPage: {
            enabled: true,
            includeTitle: true,
            includeOrganizationName: true,
            includeLogo: true,
            includeDate: true,
            includeAuthor: true,
            includeDescription: true
        },
        headers: { enabled: true },
        footers: { enabled: true },
        tableOfContents: { enabled: true },
        pageNumbering: { enabled: true, position: 'footer-right' }
    },
    {
        id: 'layout-executive-accessibility-report',
        name: 'Executive Accessibility Report',
        description: 'Condensed layout focused on summary, analytics, key findings, and recommendations.',
        scope: 'application',
        readOnly: true,
        supportedReportTypes: ['Executive Summary', 'Audit Log'],
        sections: [
            { id: 'cover-page', enabled: true, required: false },
            { id: 'table-of-contents', enabled: true, required: false },
            { id: 'executive-summary', enabled: true, required: true },
            { id: 'workspace-report-summary', enabled: true, required: true },
            { id: 'analytics', enabled: true, required: false },
            { id: 'findings', enabled: true, required: true },
            { id: 'recommendations', enabled: true, required: false }
        ],
        findingPresentation: 'summary-list',
        pageStructure: {
            pageSize: 'letter',
            pageBreakStrategy: 'avoid-splitting-tables',
            repeatHeaderFooter: true,
            repeatTableHeaders: true
        },
        coverPage: {
            enabled: true,
            includeTitle: true,
            includeOrganizationName: true,
            includeLogo: true,
            includeDate: true,
            includeAuthor: false,
            includeDescription: true
        },
        headers: { enabled: true },
        footers: { enabled: true },
        tableOfContents: { enabled: false },
        pageNumbering: { enabled: true, position: 'footer-right' }
    },
    {
        id: 'layout-compliance-report',
        name: 'Compliance Report',
        description: 'Compliance-oriented section order with findings, references, and appendices emphasized.',
        scope: 'application',
        readOnly: true,
        supportedReportTypes: ['Audit Log'],
        sections: [
            { id: 'cover-page', enabled: true, required: false },
            { id: 'table-of-contents', enabled: true, required: false },
            { id: 'workspace-report-summary', enabled: true, required: true },
            { id: 'findings', enabled: true, required: true },
            { id: 'references', enabled: true, required: true },
            { id: 'appendices', enabled: true, required: false },
            { id: 'evidence', enabled: true, required: false }
        ],
        findingPresentation: 'tabular',
        pageStructure: {
            pageSize: 'letter',
            pageBreakStrategy: 'keep-headings-with-content',
            repeatHeaderFooter: true,
            repeatTableHeaders: true
        },
        coverPage: {
            enabled: true,
            includeTitle: true,
            includeOrganizationName: true,
            includeLogo: true,
            includeDate: true,
            includeAuthor: true,
            includeDescription: true
        },
        headers: { enabled: true },
        footers: { enabled: true },
        tableOfContents: { enabled: true },
        pageNumbering: { enabled: true, position: 'footer-right' }
    },
    {
        id: 'layout-usability-report',
        name: 'Usability Report',
        description: 'Presentation template for usability-oriented summaries and narrative sections.',
        scope: 'application',
        readOnly: true,
        supportedReportTypes: ['Usability Report', 'Executive Summary', 'Audit Log'],
        sections: [
            { id: 'cover-page', enabled: true, required: false },
            { id: 'table-of-contents', enabled: true, required: false },
            { id: 'executive-summary', enabled: true, required: false },
            { id: 'workspace-report-summary', enabled: true, required: true },
            { id: 'findings', enabled: true, required: true },
            { id: 'recommendations', enabled: true, required: true },
            { id: 'evidence', enabled: true, required: false }
        ],
        findingPresentation: 'narrative',
        pageStructure: {
            pageSize: 'letter',
            pageBreakStrategy: 'avoid-splitting-tables',
            repeatHeaderFooter: true,
            repeatTableHeaders: true
        },
        coverPage: {
            enabled: true,
            includeTitle: true,
            includeOrganizationName: true,
            includeLogo: true,
            includeDate: true,
            includeAuthor: false,
            includeDescription: true
        },
        headers: { enabled: true },
        footers: { enabled: true },
        tableOfContents: { enabled: false },
        pageNumbering: { enabled: true, position: 'footer-right' }
    },
    {
        id: 'layout-remediation-report',
        name: 'Remediation Report',
        description: 'Remediation-focused order highlighting findings, recommendations, and evidence.',
        scope: 'application',
        readOnly: true,
        supportedReportTypes: ['Audit Log', 'Executive Summary'],
        sections: [
            { id: 'cover-page', enabled: true, required: false },
            { id: 'workspace-report-summary', enabled: true, required: true },
            { id: 'findings', enabled: true, required: true },
            { id: 'recommendations', enabled: true, required: true },
            { id: 'evidence', enabled: true, required: false },
            { id: 'appendices', enabled: true, required: false }
        ],
        findingPresentation: 'remediation-queue',
        pageStructure: {
            pageSize: 'letter',
            pageBreakStrategy: 'keep-headings-with-content',
            repeatHeaderFooter: true,
            repeatTableHeaders: true
        },
        coverPage: {
            enabled: true,
            includeTitle: true,
            includeOrganizationName: true,
            includeLogo: true,
            includeDate: true,
            includeAuthor: true,
            includeDescription: true
        },
        headers: { enabled: true },
        footers: { enabled: true },
        tableOfContents: { enabled: false },
        pageNumbering: { enabled: true, position: 'footer-right' }
    }
]);

const BUILT_IN_THEMES = Object.freeze([
    {
        id: 'theme-art-accessible-default',
        name: 'ART Accessible Default',
        description: 'Balanced, high-contrast default theme for screen and export outputs.',
        scope: 'application',
        readOnly: true,
        colors: {
            primary: '#0b5cab',
            secondary: '#1f2933',
            accent: '#9f2a00',
            background: '#ffffff',
            surface: '#f5f7fa',
            text: '#111111',
            mutedText: '#334155',
            link: '#0b5cab',
            heading: '#0f172a',
            border: '#475569',
            tableHeaderBackground: '#dbeafe',
            tableHeaderText: '#111111',
            severityCritical: '#7f1d1d',
            severitySerious: '#b45309',
            severityModerate: '#1d4ed8',
            severityMinor: '#166534',
            statusPassed: '#166534',
            statusFailed: '#991b1b',
            statusManualReview: '#92400e',
            statusNotTested: '#1d4ed8',
            focusIndicator: '#111111'
        },
        typography: {
            fontFamily: 'Georgia, "Times New Roman", serif',
            headingFontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 16,
            headingScale: 1.2,
            lineHeight: 1.6,
            letterSpacing: 0,
            fontWeight: 400,
            headingWeight: 700
        },
        spacing: {
            sectionGap: 24,
            paragraphGap: 12,
            cardPadding: 16,
            tableCellPadding: 10
        },
        links: {
            underline: true,
            bold: false
        },
        tables: {
            bordered: true,
            striped: true,
            rowContrast: 'high'
        }
    },
    {
        id: 'theme-high-contrast-professional',
        name: 'High Contrast Professional',
        description: 'Strong contrast theme for formal accessibility deliverables.',
        scope: 'application',
        readOnly: true,
        colors: {
            primary: '#000000',
            secondary: '#1d1d1d',
            accent: '#005fcc',
            background: '#ffffff',
            surface: '#f8fafc',
            text: '#000000',
            mutedText: '#1d1d1d',
            link: '#005fcc',
            heading: '#000000',
            border: '#000000',
            tableHeaderBackground: '#e2e8f0',
            tableHeaderText: '#000000',
            severityCritical: '#7f1d1d',
            severitySerious: '#8a2b06',
            severityModerate: '#1d4ed8',
            severityMinor: '#166534',
            statusPassed: '#166534',
            statusFailed: '#7f1d1d',
            statusManualReview: '#92400e',
            statusNotTested: '#1d4ed8',
            focusIndicator: '#000000'
        },
        typography: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            headingFontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 16,
            headingScale: 1.15,
            lineHeight: 1.55,
            letterSpacing: 0,
            fontWeight: 400,
            headingWeight: 700
        },
        spacing: {
            sectionGap: 22,
            paragraphGap: 10,
            cardPadding: 16,
            tableCellPadding: 10
        },
        links: {
            underline: true,
            bold: true
        },
        tables: {
            bordered: true,
            striped: false,
            rowContrast: 'high'
        }
    },
    {
        id: 'theme-warm-document',
        name: 'Warm Document',
        description: 'Readable document theme with restrained warm accenting.',
        scope: 'application',
        readOnly: true,
        colors: {
            primary: '#6b2f14',
            secondary: '#2d2a26',
            accent: '#8c4a1d',
            background: '#fffdf8',
            surface: '#f8f1e7',
            text: '#1f1f1f',
            mutedText: '#3f3f46',
            link: '#7c2d12',
            heading: '#3b1f12',
            border: '#6b7280',
            tableHeaderBackground: '#f4e6d1',
            tableHeaderText: '#1f1f1f',
            severityCritical: '#7f1d1d',
            severitySerious: '#b45309',
            severityModerate: '#1d4ed8',
            severityMinor: '#166534',
            statusPassed: '#166534',
            statusFailed: '#991b1b',
            statusManualReview: '#92400e',
            statusNotTested: '#1d4ed8',
            focusIndicator: '#111111'
        },
        typography: {
            fontFamily: 'Cambria, Georgia, serif',
            headingFontFamily: 'Trebuchet MS, Arial, sans-serif',
            fontSize: 16,
            headingScale: 1.18,
            lineHeight: 1.7,
            letterSpacing: 0,
            fontWeight: 400,
            headingWeight: 700
        },
        spacing: {
            sectionGap: 24,
            paragraphGap: 12,
            cardPadding: 18,
            tableCellPadding: 10
        },
        links: {
            underline: true,
            bold: false
        },
        tables: {
            bordered: true,
            striped: true,
            rowContrast: 'medium'
        }
    }
]);

const BUILT_IN_BRANDINGS = Object.freeze([
    {
        id: 'branding-art-default',
        name: 'ART Default Branding',
        description: 'Neutral built-in branding for accessible report delivery.',
        scope: 'application',
        readOnly: true,
        organizationName: 'Accessibility Reporting Tool',
        enabled: true,
        headerText: 'Accessibility Reporting Tool',
        headerHtml: '<p><strong>Accessibility Reporting Tool</strong></p>',
        footerHtml: '<p>Generated using ART Version 2.0.</p>',
        headerImages: [],
        footerImages: [],
        primaryColor: '#0b5cab',
        pageMargins: { top: 48, right: 48, bottom: 48, left: 48 },
        showPageNumbers: true,
        headerLinks: [],
        footerLinks: [],
        decorativeImagesEnabled: true,
        dependencies: {
            themeId: '',
            layoutId: ''
        }
    }
]);

const BUILT_IN_PUBLISHING_PROFILES = Object.freeze([
    {
        id: 'profile-accessible-default',
        name: 'Accessible Default Profile',
        description: 'Default publishing profile using the detailed audit layout and ART accessible theme.',
        scope: 'application',
        readOnly: true,
        layoutId: 'layout-detailed-accessibility-audit',
        themeId: 'theme-art-accessible-default',
        brandingId: 'branding-art-default',
        previewMode: 'screen',
        outputFormats: ['html', 'docx', 'pdf']
    },
    {
        id: 'profile-executive-brief',
        name: 'Executive Brief Profile',
        description: 'Executive-oriented profile optimized for summary publications.',
        scope: 'application',
        readOnly: true,
        layoutId: 'layout-executive-accessibility-report',
        themeId: 'theme-high-contrast-professional',
        brandingId: 'branding-art-default',
        previewMode: 'print',
        outputFormats: ['html', 'docx', 'pdf']
    }
]);

let initialized = false;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeText(value) {
    return String(value || '').trim();
}

function slugify(value, fallback) {
    const base = normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base || fallback;
}

function makeId(prefix, value) {
    return `${prefix}-${slugify(value, `${Date.now()}-${Math.floor(Math.random() * 1000)}`)}`;
}

function asBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return value == null ? fallback : Boolean(value);
}

function normalizeHexColor(value, fallback = '#111111') {
    const text = normalizeText(value);
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function normalizeNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed * 100) / 100));
}

function normalizeImageEntry(image, index = 0, section = 'header') {
    const source = image && typeof image === 'object' ? image : {};
    return {
        id: normalizeText(source.id) || `${section}-image-${index + 1}`,
        dataUrl: normalizeText(source.dataUrl || source.src),
        fileName: normalizeText(source.fileName),
        altText: normalizeText(source.altText || source.alt),
        decorative: asBoolean(source.decorative, false),
        alignment: ['inline', 'left', 'center', 'right'].includes(normalizeText(source.alignment).toLowerCase()) ? normalizeText(source.alignment).toLowerCase() : 'inline',
        spacing: normalizeNumber(source.spacing, 8, 0, 64),
        maxDisplayWidth: normalizeNumber(source.maxDisplayWidth ?? source.maxWidth, 160, 24, 2000),
        maxDisplayHeight: normalizeNumber(source.maxDisplayHeight ?? source.maxHeight, 80, 24, 2000)
    };
}

function normalizeImageList(list, section = 'header') {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => normalizeImageEntry(item, index, section)).filter((item) => item.dataUrl);
}

function normalizeMargins(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        top: normalizeNumber(source.top, 48, 0, 200),
        right: normalizeNumber(source.right, 48, 0, 200),
        bottom: normalizeNumber(source.bottom, 48, 0, 200),
        left: normalizeNumber(source.left, 48, 0, 200)
    };
}

function normalizeLinks(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => ({
        id: normalizeText(item?.id) || `link-${index + 1}`,
        text: normalizeText(item?.text || item?.label),
        href: normalizeText(item?.href || item?.url),
        title: normalizeText(item?.title)
    })).filter((item) => item.text && item.href);
}

function normalizePermissions(list) {
    if (!Array.isArray(list)) return ['read', 'use', 'edit', 'rename', 'share', 'delete'];
    const resolved = list.map((item) => normalizeText(item).toLowerCase()).filter((item) => PRESENTATION_PERMISSIONS.includes(item));
    return resolved.length > 0 ? Array.from(new Set(resolved)) : ['read', 'use', 'edit', 'rename', 'share', 'delete'];
}

function normalizeLayoutSections(list) {
    const source = Array.isArray(list) && list.length > 0
        ? list
        : PRESENTATION_SECTION_ORDER.map((id) => ({ id, enabled: ['workspace-report-summary', 'findings'].includes(id), required: ['workspace-report-summary', 'findings'].includes(id) }));
    const seen = new Set();
    const normalized = [];
    source.forEach((item) => {
        const id = normalizeText(item?.id).toLowerCase();
        if (!PRESENTATION_SECTION_ORDER.includes(id) || seen.has(id)) return;
        seen.add(id);
        normalized.push({
            id,
            enabled: asBoolean(item?.enabled, false),
            required: asBoolean(item?.required, false)
        });
    });
    PRESENTATION_SECTION_ORDER.forEach((id) => {
        if (seen.has(id)) return;
        normalized.push({ id, enabled: false, required: false });
    });
    return normalized;
}

function normalizeLayout(resource) {
    const source = resource && typeof resource === 'object' ? resource : {};
    const name = normalizeText(source.name) || 'Custom Layout';
    return {
        id: normalizeText(source.id) || makeId('layout', name),
        type: PRESENTATION_RESOURCE_TYPES.layout,
        name,
        description: normalizeText(source.description),
        scope: PRESENTATION_SCOPES.has(normalizeText(source.scope).toLowerCase()) ? normalizeText(source.scope).toLowerCase() : 'personal',
        readOnly: asBoolean(source.readOnly, false),
        supportedReportTypes: Array.isArray(source.supportedReportTypes) ? source.supportedReportTypes.map((item) => normalizeText(item)).filter(Boolean) : ['Audit Log', 'Executive Summary'],
        sections: normalizeLayoutSections(source.sections),
        findingPresentation: normalizeText(source.findingPresentation || 'grouped-cards') || 'grouped-cards',
        pageStructure: {
            pageSize: normalizeText(source.pageStructure?.pageSize || 'letter') || 'letter',
            pageBreakStrategy: normalizeText(source.pageStructure?.pageBreakStrategy || 'keep-headings-with-content') || 'keep-headings-with-content',
            repeatHeaderFooter: asBoolean(source.pageStructure?.repeatHeaderFooter, true),
            repeatTableHeaders: asBoolean(source.pageStructure?.repeatTableHeaders, true)
        },
        coverPage: {
            enabled: asBoolean(source.coverPage?.enabled, false),
            includeTitle: asBoolean(source.coverPage?.includeTitle, true),
            includeOrganizationName: asBoolean(source.coverPage?.includeOrganizationName, true),
            includeLogo: asBoolean(source.coverPage?.includeLogo, true),
            includeDate: asBoolean(source.coverPage?.includeDate, true),
            includeAuthor: asBoolean(source.coverPage?.includeAuthor, true),
            includeDescription: asBoolean(source.coverPage?.includeDescription, true)
        },
        headers: {
            enabled: asBoolean(source.headers?.enabled, true)
        },
        footers: {
            enabled: asBoolean(source.footers?.enabled, true)
        },
        tableOfContents: {
            enabled: asBoolean(source.tableOfContents?.enabled, false)
        },
        pageNumbering: {
            enabled: asBoolean(source.pageNumbering?.enabled, true),
            position: normalizeText(source.pageNumbering?.position || 'footer-right') || 'footer-right'
        },
        collaboration: {
            shared: asBoolean(source.collaboration?.shared, false)
        },
        permissions: normalizePermissions(source.permissions)
    };
}

function normalizeTheme(resource) {
    const source = resource && typeof resource === 'object' ? resource : {};
    const name = normalizeText(source.name) || 'Custom Theme';
    const defaultTheme = BUILT_IN_THEMES[0];
    const sourceColors = source.colors && typeof source.colors === 'object' ? source.colors : {};
    const sourceTypography = source.typography && typeof source.typography === 'object' ? source.typography : {};
    const sourceSpacing = source.spacing && typeof source.spacing === 'object' ? source.spacing : {};
    const sourceLinks = source.links && typeof source.links === 'object' ? source.links : {};
    const sourceTables = source.tables && typeof source.tables === 'object' ? source.tables : {};
    return {
        id: normalizeText(source.id) || makeId('theme', name),
        type: PRESENTATION_RESOURCE_TYPES.theme,
        name,
        description: normalizeText(source.description),
        scope: PRESENTATION_SCOPES.has(normalizeText(source.scope).toLowerCase()) ? normalizeText(source.scope).toLowerCase() : 'personal',
        readOnly: asBoolean(source.readOnly, false),
        colors: Object.fromEntries(Object.entries(defaultTheme.colors).map(([key, fallback]) => [key, normalizeHexColor(sourceColors[key], fallback)])),
        typography: {
            fontFamily: normalizeText(sourceTypography.fontFamily || defaultTheme.typography.fontFamily) || defaultTheme.typography.fontFamily,
            headingFontFamily: normalizeText(sourceTypography.headingFontFamily || defaultTheme.typography.headingFontFamily) || defaultTheme.typography.headingFontFamily,
            fontSize: normalizeNumber(sourceTypography.fontSize, defaultTheme.typography.fontSize, 12, 24),
            headingScale: normalizeNumber(sourceTypography.headingScale, defaultTheme.typography.headingScale, 1, 2),
            lineHeight: normalizeNumber(sourceTypography.lineHeight, defaultTheme.typography.lineHeight, 1.2, 2.4),
            letterSpacing: normalizeNumber(sourceTypography.letterSpacing, defaultTheme.typography.letterSpacing, 0, 3),
            fontWeight: normalizeNumber(sourceTypography.fontWeight, defaultTheme.typography.fontWeight, 300, 700),
            headingWeight: normalizeNumber(sourceTypography.headingWeight, defaultTheme.typography.headingWeight, 400, 900)
        },
        spacing: {
            sectionGap: normalizeNumber(sourceSpacing.sectionGap, defaultTheme.spacing.sectionGap, 8, 64),
            paragraphGap: normalizeNumber(sourceSpacing.paragraphGap, defaultTheme.spacing.paragraphGap, 4, 40),
            cardPadding: normalizeNumber(sourceSpacing.cardPadding, defaultTheme.spacing.cardPadding, 8, 40),
            tableCellPadding: normalizeNumber(sourceSpacing.tableCellPadding, defaultTheme.spacing.tableCellPadding, 4, 24)
        },
        links: {
            underline: asBoolean(sourceLinks.underline, defaultTheme.links.underline),
            bold: asBoolean(sourceLinks.bold, defaultTheme.links.bold)
        },
        tables: {
            bordered: asBoolean(sourceTables.bordered, defaultTheme.tables.bordered),
            striped: asBoolean(sourceTables.striped, defaultTheme.tables.striped),
            rowContrast: normalizeText(sourceTables.rowContrast || defaultTheme.tables.rowContrast) || defaultTheme.tables.rowContrast
        },
        collaboration: {
            shared: asBoolean(source.collaboration?.shared, false)
        },
        permissions: normalizePermissions(source.permissions)
    };
}

function normalizeBranding(resource) {
    const source = resource && typeof resource === 'object' ? resource : {};
    const name = normalizeText(source.name || source.organizationName) || 'Custom Branding';
    return {
        id: normalizeText(source.id) || makeId('branding', name),
        type: PRESENTATION_RESOURCE_TYPES.branding,
        name,
        description: normalizeText(source.description),
        scope: PRESENTATION_SCOPES.has(normalizeText(source.scope).toLowerCase()) ? normalizeText(source.scope).toLowerCase() : 'personal',
        readOnly: asBoolean(source.readOnly, false),
        organizationName: normalizeText(source.organizationName),
        enabled: asBoolean(source.enabled, false),
        headerText: normalizeText(source.headerText),
        headerHtml: String(source.headerHtml || ''),
        footerHtml: String(source.footerHtml || ''),
        headerImages: normalizeImageList(source.headerImages, 'header'),
        footerImages: normalizeImageList(source.footerImages, 'footer'),
        headerLinks: normalizeLinks(source.headerLinks),
        footerLinks: normalizeLinks(source.footerLinks),
        primaryColor: normalizeHexColor(source.primaryColor, '#0b5cab'),
        pageMargins: normalizeMargins(source.pageMargins),
        showPageNumbers: asBoolean(source.showPageNumbers, true),
        decorativeImagesEnabled: asBoolean(source.decorativeImagesEnabled, true),
        dependencies: {
            themeId: normalizeText(source.dependencies?.themeId),
            layoutId: normalizeText(source.dependencies?.layoutId)
        },
        collaboration: {
            shared: asBoolean(source.collaboration?.shared, false)
        },
        permissions: normalizePermissions(source.permissions)
    };
}

function normalizePublishingProfile(resource) {
    const source = resource && typeof resource === 'object' ? resource : {};
    const name = normalizeText(source.name) || 'Publishing Profile';
    return {
        id: normalizeText(source.id) || makeId('publishing-profile', name),
        type: PRESENTATION_RESOURCE_TYPES.publishingProfile,
        name,
        description: normalizeText(source.description),
        scope: PRESENTATION_SCOPES.has(normalizeText(source.scope).toLowerCase()) ? normalizeText(source.scope).toLowerCase() : 'personal',
        readOnly: asBoolean(source.readOnly, false),
        layoutId: normalizeText(source.layoutId),
        themeId: normalizeText(source.themeId),
        brandingId: normalizeText(source.brandingId),
        previewMode: PREVIEW_MODES.has(normalizeText(source.previewMode)) ? normalizeText(source.previewMode) : 'screen',
        outputFormats: Array.isArray(source.outputFormats) ? source.outputFormats.map((item) => normalizeText(item).toLowerCase()).filter(Boolean) : ['html', 'docx', 'pdf'],
        collaboration: {
            shared: asBoolean(source.collaboration?.shared, false)
        },
        permissions: normalizePermissions(source.permissions)
    };
}

function getBuiltInResources() {
    return {
        layouts: BUILT_IN_LAYOUTS.map((item) => normalizeLayout(item)),
        themes: BUILT_IN_THEMES.map((item) => normalizeTheme(item)),
        brandings: BUILT_IN_BRANDINGS.map((item) => normalizeBranding(item)),
        publishingProfiles: BUILT_IN_PUBLISHING_PROFILES.map((item) => normalizePublishingProfile(item))
    };
}

function getDefaultPresentationState() {
    return {
        resourceLibrary: {
            layouts: [],
            themes: [],
            brandings: [],
            publishingProfiles: []
        },
        selection: {
            layoutId: 'layout-detailed-accessibility-audit',
            themeId: 'theme-art-accessible-default',
            brandingId: '',
            publishingProfileId: ''
        },
        reportPresentation: {
            allowOverrides: true,
            layoutOverride: null,
            themeOverride: null,
            brandingOverride: null
        },
        preview: {
            mode: 'screen',
            lastValidatedAt: '',
            validationMessages: []
        },
        ui: {
            expandedSections: {
                layout: false,
                theme: false,
                branding: false,
                header: false,
                footer: false,
                coverPage: false,
                tableOfContents: false,
                pageNumbering: false,
                accessibility: false,
                advanced: false
            }
        }
    };
}

function normalizePresentationState(value) {
    const defaults = getDefaultPresentationState();
    const builtIns = getBuiltInResources();
    const source = value && typeof value === 'object' ? value : {};
    const library = source.resourceLibrary && typeof source.resourceLibrary === 'object' ? source.resourceLibrary : {};
    return {
        resourceLibrary: {
            layouts: Array.isArray(library.layouts) ? library.layouts.map((item) => normalizeLayout(item)).filter((item) => !item.readOnly) : [],
            themes: Array.isArray(library.themes) ? library.themes.map((item) => normalizeTheme(item)).filter((item) => !item.readOnly) : [],
            brandings: Array.isArray(library.brandings) ? library.brandings.map((item) => normalizeBranding(item)).filter((item) => !item.readOnly) : [],
            publishingProfiles: Array.isArray(library.publishingProfiles) ? library.publishingProfiles.map((item) => normalizePublishingProfile(item)).filter((item) => !item.readOnly) : []
        },
        selection: {
            layoutId: normalizeText(source.selection?.layoutId) || builtIns.layouts[0].id,
            themeId: normalizeText(source.selection?.themeId) || builtIns.themes[0].id,
            brandingId: normalizeText(source.selection?.brandingId),
            publishingProfileId: normalizeText(source.selection?.publishingProfileId)
        },
        reportPresentation: {
            allowOverrides: asBoolean(source.reportPresentation?.allowOverrides, true),
            layoutOverride: source.reportPresentation?.layoutOverride ? normalizeLayout({ ...source.reportPresentation.layoutOverride, readOnly: false, scope: 'personal' }) : null,
            themeOverride: source.reportPresentation?.themeOverride ? normalizeTheme({ ...source.reportPresentation.themeOverride, readOnly: false, scope: 'personal' }) : null,
            brandingOverride: source.reportPresentation?.brandingOverride ? normalizeBranding({ ...source.reportPresentation.brandingOverride, readOnly: false, scope: 'personal' }) : null
        },
        preview: {
            mode: PREVIEW_MODES.has(normalizeText(source.preview?.mode)) ? normalizeText(source.preview.mode) : defaults.preview.mode,
            lastValidatedAt: normalizeText(source.preview?.lastValidatedAt),
            validationMessages: Array.isArray(source.preview?.validationMessages) ? source.preview.validationMessages.map((item) => ({ ...item })) : []
        },
        ui: {
            expandedSections: {
                ...defaults.ui.expandedSections,
                ...(source.ui?.expandedSections && typeof source.ui.expandedSections === 'object' ? source.ui.expandedSections : {})
            }
        }
    };
}

function mergeResources(builtIns, customResources) {
    const merged = [...builtIns, ...customResources];
    const seen = new Set();
    return merged.filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

function ensurePresentationState() {
    const normalized = normalizePresentationState(appState.presentation);
    appState.presentation = normalized;
    return normalized;
}

function getLibrary() {
    const builtIns = getBuiltInResources();
    const state = ensurePresentationState();
    return {
        layouts: mergeResources(builtIns.layouts, state.resourceLibrary.layouts),
        themes: mergeResources(builtIns.themes, state.resourceLibrary.themes),
        brandings: mergeResources(builtIns.brandings, state.resourceLibrary.brandings),
        publishingProfiles: mergeResources(builtIns.publishingProfiles, state.resourceLibrary.publishingProfiles)
    };
}

function findResource(type, id) {
    const library = getLibrary();
    const key = type === PRESENTATION_RESOURCE_TYPES.publishingProfile ? 'publishingProfiles' : `${type}s`;
    return (library[key] || []).find((item) => item.id === id) || null;
}

function emitPresentationUpdate(detail = {}) {
    window.dispatchEvent(new CustomEvent(PRESENTATION_EVENT, { detail }));
}

function buildBrandingFromLegacyState() {
    return normalizeBranding({
        id: 'branding-active-report',
        name: 'Current Report Branding Override',
        scope: 'personal',
        enabled: Boolean(appState.branding?.enabled),
        headerText: String(appState.branding?.headerText || ''),
        headerHtml: String(appState.branding?.headerHtml || ''),
        footerHtml: String(appState.branding?.footerHtml || ''),
        headerImages: Array.isArray(appState.branding?.headerImages) ? appState.branding.headerImages : [],
        footerImages: Array.isArray(appState.branding?.footerImages) ? appState.branding.footerImages : [],
        primaryColor: String(appState.branding?.primaryColor || '#0b5cab'),
        pageMargins: appState.branding?.pageMargins,
        showPageNumbers: appState.branding?.showPageNumbers !== false,
        organizationName: String(appState.orgClient || ''),
        decorativeImagesEnabled: true
    });
}

function syncLegacyBrandingState() {
    const presentation = ensurePresentationState();
    const resolved = presentation.reportPresentation.brandingOverride
        || findResource(PRESENTATION_RESOURCE_TYPES.branding, presentation.selection.brandingId)
        || buildBrandingFromLegacyState();

    appState.branding = {
        ...appState.branding,
        enabled: Boolean(resolved.enabled),
        headerText: String(resolved.headerText || ''),
        headerHtml: String(resolved.headerHtml || ''),
        footerHtml: String(resolved.footerHtml || ''),
        headerImages: clone(resolved.headerImages || []),
        footerImages: clone(resolved.footerImages || []),
        pageMargins: clone(resolved.pageMargins || { top: 48, right: 48, bottom: 48, left: 48 }),
        showPageNumbers: resolved.showPageNumbers !== false,
        primaryColor: String(resolved.primaryColor || '#0b5cab'),
        logoDataUrl: String(resolved.headerImages?.[0]?.dataUrl || ''),
        logoAltText: String(resolved.headerImages?.[0]?.altText || ''),
        logoDecorative: Boolean(resolved.headerImages?.[0]?.decorative),
        logoFileName: String(resolved.headerImages?.[0]?.fileName || '')
    };
}

function getRelativeLuminance(hexColor) {
    const normalized = normalizeHexColor(hexColor, '#000000').slice(1);
    const values = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255).map((value) => {
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * values[0]) + (0.7152 * values[1]) + (0.0722 * values[2]);
}

function getContrastRatio(foreground, background) {
    const lighter = Math.max(getRelativeLuminance(foreground), getRelativeLuminance(background));
    const darker = Math.min(getRelativeLuminance(foreground), getRelativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

function buildValidationMessage(type, severity, target, message, ratio = null) {
    return {
        id: `${type}-${severity}-${slugify(target || message, 'message')}`,
        type,
        severity,
        target,
        message,
        ratio
    };
}

function getFieldTextContent() {
    const raw = appState.editorFieldValues && typeof appState.editorFieldValues === 'object'
        ? Object.values(appState.editorFieldValues)
        : [];
    return raw.map((value) => {
        if (value == null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }).join(' ').trim();
}

function getAttachmentCount() {
    const values = appState.editorFieldValues && typeof appState.editorFieldValues === 'object'
        ? Object.values(appState.editorFieldValues)
        : [];
    return values.reduce((count, value) => {
        if (!Array.isArray(value)) return count;
        return count + value.filter((item) => item && typeof item === 'object' && item.dataBase64).length;
    }, 0);
}

function getReferenceCount() {
    const values = appState.editorFieldValues && typeof appState.editorFieldValues === 'object'
        ? Object.values(appState.editorFieldValues)
        : [];
    return values.reduce((count, value) => {
        if (!value) return count;
        if (typeof value === 'string' && /^https?:/i.test(value.trim())) return count + 1;
        if (typeof value === 'object' && value.understandingUrl) return count + 1;
        return count;
    }, 0) + (/^https?:/i.test(String(appState.scopeUrl || '').trim()) ? 1 : 0);
}

function getRecommendationCount() {
    const labels = Array.isArray(appState.fields) ? appState.fields.map((field) => normalizeText(field?.label).toLowerCase()) : [];
    const hasRecommendationField = labels.some((label) => /recommend|remediation|fix/.test(label));
    if (!hasRecommendationField) return 0;
    return getFieldTextContent() ? 1 : 0;
}

function getSectionAvailability() {
    const metrics = getCurrentReportMetrics();
    const contentText = getFieldTextContent();
    const hasContent = Boolean(contentText);
    const analyticsCount = Number(metrics?.totalIssues || 0) + Number(metrics?.totalAuditEntries || 0) + Number(metrics?.pagesTested || 0);
    const attachments = getAttachmentCount();
    const references = getReferenceCount();
    const progressItems = Array.isArray(getProgressItems()) ? getProgressItems() : [];
    const isUsability = appState.reportType === 'Usability Report';
    return {
        'cover-page': true,
        'table-of-contents': true,
        'executive-summary': appState.reportType === 'Executive Summary' || isUsability || hasContent,
        'workspace-report-summary': Boolean(appState.reportTitle || appState.projectName || appState.orgClient || appState.scopeUrl),
        analytics: !isUsability && analyticsCount > 0,
        findings: hasContent || Number(metrics?.totalAuditEntries || 0) > 0,
        recommendations: getRecommendationCount() > 0,
        appendices: progressItems.length > 0,
        references,
        evidence: attachments > 0
    };
}

function buildLayoutCompatibilityMessages(layout) {
    const messages = [];
    const availability = getSectionAvailability();
    const seen = new Set();
    layout.sections.forEach((section, index) => {
        if (seen.has(section.id)) {
            messages.push(buildValidationMessage('layout', 'error', section.id, `Section ${PRESENTATION_SECTION_LABELS[section.id]} appears more than once.`));
        }
        seen.add(section.id);
        if (section.enabled && !availability[section.id]) {
            messages.push(buildValidationMessage('layout', section.required ? 'error' : 'warning', section.id, `${PRESENTATION_SECTION_LABELS[section.id]} is enabled but the current report does not provide compatible data.`));
        }
        if (index === 0 && section.id === 'table-of-contents') {
            messages.push(buildValidationMessage('layout', 'warning', section.id, 'Table of Contents appears before Cover Page. Confirm this is intentional.'));
        }
    });
    if (!layout.sections.some((section) => section.id === 'findings' && section.enabled)) {
        messages.push(buildValidationMessage('layout', 'warning', 'findings', 'This layout hides Findings. Hidden sections do not remove underlying report data.'));
    }
    return messages;
}

function buildThemeAccessibilityMessages(theme) {
    const messages = [];
    const textContrast = getContrastRatio(theme.colors.text, theme.colors.background);
    const linkContrast = getContrastRatio(theme.colors.link, theme.colors.background);
    const headingContrast = getContrastRatio(theme.colors.heading, theme.colors.background);
    const focusContrast = getContrastRatio(theme.colors.focusIndicator, theme.colors.background);
    const tableContrast = getContrastRatio(theme.colors.tableHeaderText, theme.colors.tableHeaderBackground);
    if (textContrast < 4.5) {
        messages.push(buildValidationMessage('theme', 'error', 'Body text', 'Body text contrast is below 4.5:1.', Number(textContrast.toFixed(2))));
    }
    if (linkContrast < 4.5) {
        messages.push(buildValidationMessage('theme', 'error', 'Links', 'Link contrast is below 4.5:1.', Number(linkContrast.toFixed(2))));
    }
    if (headingContrast < 3) {
        messages.push(buildValidationMessage('theme', 'error', 'Headings', 'Heading contrast is below 3:1.', Number(headingContrast.toFixed(2))));
    }
    if (focusContrast < 3) {
        messages.push(buildValidationMessage('theme', 'error', 'Focus indicator', 'Focus indicator contrast is below 3:1.', Number(focusContrast.toFixed(2))));
    }
    if (tableContrast < 4.5) {
        messages.push(buildValidationMessage('theme', 'error', 'Table headers', 'Table header contrast is below 4.5:1.', Number(tableContrast.toFixed(2))));
    }
    if (!theme.links.underline) {
        messages.push(buildValidationMessage('theme', 'warning', 'Links', 'Links are not underlined. Do not rely solely on color to identify links.'));
    }
    if (theme.typography.fontSize < 14) {
        messages.push(buildValidationMessage('theme', 'error', 'Typography', 'Base font size is below 14px and may compromise readability.'));
    }
    if (theme.typography.lineHeight < 1.4) {
        messages.push(buildValidationMessage('theme', 'warning', 'Typography', 'Line height below 1.4 may reduce readability.'));
    }
    return messages;
}

function buildBrandingValidationMessages(branding, resolvedTheme, resolvedLayout) {
    const messages = [];
    [...branding.headerImages, ...branding.footerImages].forEach((image, index) => {
        if (image.dataUrl && !image.decorative && !image.altText) {
            messages.push(buildValidationMessage('branding', 'error', `image-${index + 1}`, 'Alternative text is required for every non-decorative branding image.'));
        }
    });
    [...branding.headerLinks, ...branding.footerLinks].forEach((link, index) => {
        if (!/^https?:|^mailto:|^tel:/i.test(link.href)) {
            messages.push(buildValidationMessage('branding', 'warning', `link-${index + 1}`, `Branding link ${link.text || index + 1} may not be a supported export destination.`));
        }
    });
    if (branding.dependencies.themeId && !findResource(PRESENTATION_RESOURCE_TYPES.theme, branding.dependencies.themeId)) {
        messages.push(buildValidationMessage('branding', 'error', 'theme-dependency', 'Branding references a theme that is no longer available.'));
    }
    if (branding.dependencies.layoutId && !findResource(PRESENTATION_RESOURCE_TYPES.layout, branding.dependencies.layoutId)) {
        messages.push(buildValidationMessage('branding', 'error', 'layout-dependency', 'Branding references a layout that is no longer available.'));
    }
    const headerContrast = getContrastRatio(branding.primaryColor, resolvedTheme.colors.background);
    if (headerContrast < 3) {
        messages.push(buildValidationMessage('branding', 'warning', 'Header brand color', 'Branding primary color may not provide sufficient contrast for header emphasis.', Number(headerContrast.toFixed(2))));
    }
    if (resolvedLayout.headers.enabled && !branding.enabled) {
        messages.push(buildValidationMessage('branding', 'warning', 'Header/Footer', 'The selected layout enables headers and footers, but branding is disabled.'));
    }
    return messages;
}

function getResolvedProfileSelection(state, library) {
    const selectedProfile = state.selection.publishingProfileId
        ? (library.publishingProfiles.find((item) => item.id === state.selection.publishingProfileId) || null)
        : null;
    if (!selectedProfile) return null;
    return selectedProfile;
}

export function getPresentationResourceLibrary() {
    return getLibrary();
}

export function getPresentationSelections() {
    return clone(ensurePresentationState().selection);
}

export function getPresentationUiState() {
    return clone(ensurePresentationState().ui);
}

export function updatePresentationUiSection(sectionId, expanded, options = {}) {
    const state = ensurePresentationState();
    if (!(sectionId in state.ui.expandedSections)) return false;
    state.ui.expandedSections[sectionId] = Boolean(expanded);
    saveState({ action: String(options.action || `Updated presentation section ${sectionId}`), recordHistory: false });
    emitPresentationUpdate({ type: 'ui', sectionId, expanded: Boolean(expanded) });
    return true;
}

export function updatePresentationPreviewMode(mode, options = {}) {
    const state = ensurePresentationState();
    state.preview.mode = PREVIEW_MODES.has(normalizeText(mode)) ? normalizeText(mode) : 'screen';
    saveState({ action: String(options.action || `Updated presentation preview mode to ${state.preview.mode}`), recordHistory: false });
    emitPresentationUpdate({ type: 'preview-mode', mode: state.preview.mode });
    return state.preview.mode;
}

export function updatePresentationSelection(partial, options = {}) {
    const state = ensurePresentationState();
    state.selection = {
        ...state.selection,
        ...(partial && typeof partial === 'object' ? partial : {})
    };
    syncLegacyBrandingState();
    saveState({ action: String(options.action || 'Updated presentation selection') });
    emitPresentationUpdate({ type: 'selection', selection: clone(state.selection) });
    return clone(state.selection);
}

export function updatePresentationOverride(kind, value, options = {}) {
    const state = ensurePresentationState();
    if (kind === 'layout') {
        state.reportPresentation.layoutOverride = value ? normalizeLayout({ ...value, readOnly: false }) : null;
    } else if (kind === 'theme') {
        state.reportPresentation.themeOverride = value ? normalizeTheme({ ...value, readOnly: false }) : null;
    } else if (kind === 'branding') {
        state.reportPresentation.brandingOverride = value ? normalizeBranding({ ...value, readOnly: false }) : null;
    } else {
        return false;
    }
    syncLegacyBrandingState();
    saveState({ action: String(options.action || `Updated ${kind} presentation override`) });
    emitPresentationUpdate({ type: 'override', kind });
    return true;
}

function updateLibraryCollection(type, nextCollection, action) {
    const state = ensurePresentationState();
    if (type === PRESENTATION_RESOURCE_TYPES.layout) state.resourceLibrary.layouts = nextCollection.map((item) => normalizeLayout(item)).filter((item) => !item.readOnly);
    if (type === PRESENTATION_RESOURCE_TYPES.theme) state.resourceLibrary.themes = nextCollection.map((item) => normalizeTheme(item)).filter((item) => !item.readOnly);
    if (type === PRESENTATION_RESOURCE_TYPES.branding) state.resourceLibrary.brandings = nextCollection.map((item) => normalizeBranding(item)).filter((item) => !item.readOnly);
    if (type === PRESENTATION_RESOURCE_TYPES.publishingProfile) state.resourceLibrary.publishingProfiles = nextCollection.map((item) => normalizePublishingProfile(item)).filter((item) => !item.readOnly);
    saveState({ action });
    emitPresentationUpdate({ type: 'library', resourceType: type });
}

export function savePresentationResource(type, draft, options = {}) {
    const name = normalizeText(draft?.name);
    if (!name) {
        announce('A name is required before saving this reusable presentation resource.');
        return null;
    }

    const normalizer = type === PRESENTATION_RESOURCE_TYPES.layout
        ? normalizeLayout
        : type === PRESENTATION_RESOURCE_TYPES.theme
            ? normalizeTheme
            : type === PRESENTATION_RESOURCE_TYPES.branding
                ? normalizeBranding
                : normalizePublishingProfile;
    const normalized = normalizer({ ...draft, scope: draft?.scope || options.scope || 'personal', readOnly: false });
    const key = type === PRESENTATION_RESOURCE_TYPES.publishingProfile ? 'publishingProfiles' : `${type}s`;
    const state = ensurePresentationState();
    const existing = [...state.resourceLibrary[key]];
    const index = existing.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
        existing[index] = normalized;
    } else {
        existing.push(normalized);
    }
    updateLibraryCollection(type, existing, String(options.action || `Saved reusable ${type} ${normalized.name}`));
    return normalized;
}

export function duplicatePresentationResource(type, resourceId, options = {}) {
    const existing = findResource(type, resourceId);
    if (!existing) return null;
    const duplicateName = `${existing.name} Copy`;
    return savePresentationResource(type, {
        ...clone(existing),
        id: makeId(type === PRESENTATION_RESOURCE_TYPES.publishingProfile ? 'publishing-profile' : type, duplicateName),
        name: duplicateName,
        readOnly: false,
        scope: options.scope || (existing.scope === 'application' ? 'personal' : existing.scope)
    }, {
        action: String(options.action || `Duplicated ${type} ${existing.name}`)
    });
}

export function renamePresentationResource(type, resourceId, nextName, options = {}) {
    const name = normalizeText(nextName);
    if (!name) return null;
    const state = ensurePresentationState();
    const key = type === PRESENTATION_RESOURCE_TYPES.publishingProfile ? 'publishingProfiles' : `${type}s`;
    const existing = [...state.resourceLibrary[key]];
    const index = existing.findIndex((item) => item.id === resourceId);
    if (index < 0) return null;
    existing[index] = { ...existing[index], name };
    updateLibraryCollection(type, existing, String(options.action || `Renamed ${type} ${name}`));
    return existing[index];
}

export function getPresentationResourceUsage(type, resourceId) {
    const references = [];
    (appState.reports || []).forEach((report) => {
        const selection = report?.data?.presentation?.selection;
        if (!selection) return;
        if (type === PRESENTATION_RESOURCE_TYPES.layout && selection.layoutId === resourceId) references.push({ kind: 'report', id: report.id, name: report.name });
        if (type === PRESENTATION_RESOURCE_TYPES.theme && selection.themeId === resourceId) references.push({ kind: 'report', id: report.id, name: report.name });
        if (type === PRESENTATION_RESOURCE_TYPES.branding && selection.brandingId === resourceId) references.push({ kind: 'report', id: report.id, name: report.name });
        if (type === PRESENTATION_RESOURCE_TYPES.publishingProfile && selection.publishingProfileId === resourceId) references.push({ kind: 'report', id: report.id, name: report.name });
    });
    (appState.userTemplates || []).forEach((template) => {
        const selection = template?.data?.presentation?.selection;
        if (!selection) return;
        if (type === PRESENTATION_RESOURCE_TYPES.layout && selection.layoutId === resourceId) references.push({ kind: 'template', id: template.id, name: template.name });
        if (type === PRESENTATION_RESOURCE_TYPES.theme && selection.themeId === resourceId) references.push({ kind: 'template', id: template.id, name: template.name });
        if (type === PRESENTATION_RESOURCE_TYPES.branding && selection.brandingId === resourceId) references.push({ kind: 'template', id: template.id, name: template.name });
        if (type === PRESENTATION_RESOURCE_TYPES.publishingProfile && selection.publishingProfileId === resourceId) references.push({ kind: 'template', id: template.id, name: template.name });
    });
    (appState.workspaces || []).forEach((workspace) => {
        if (type === PRESENTATION_RESOURCE_TYPES.branding && normalizeText(workspace?.presentationDefaults?.brandingId) === resourceId) {
            references.push({ kind: 'workspace', id: workspace.id, name: workspace.name });
        }
    });
    return references;
}

export function deletePresentationResource(type, resourceId, options = {}) {
    const usage = getPresentationResourceUsage(type, resourceId);
    if (usage.length > 0) {
        return {
            ok: false,
            reason: 'in-use',
            usage
        };
    }
    const state = ensurePresentationState();
    const key = type === PRESENTATION_RESOURCE_TYPES.publishingProfile ? 'publishingProfiles' : `${type}s`;
    const existing = [...state.resourceLibrary[key]].filter((item) => item.id !== resourceId);
    updateLibraryCollection(type, existing, String(options.action || `Deleted ${type} resource`));
    return { ok: true };
}

export function getResolvedReportPresentation() {
    const state = ensurePresentationState();
    const library = getLibrary();
    const profile = getResolvedProfileSelection(state, library);
    const layoutId = normalizeText(profile?.layoutId || state.selection.layoutId) || BUILT_IN_LAYOUTS[0].id;
    const themeId = normalizeText(profile?.themeId || state.selection.themeId) || BUILT_IN_THEMES[0].id;
    const brandingId = normalizeText(profile?.brandingId || state.selection.brandingId);

    const layout = state.reportPresentation.layoutOverride || library.layouts.find((item) => item.id === layoutId) || library.layouts[0];
    const theme = state.reportPresentation.themeOverride || library.themes.find((item) => item.id === themeId) || library.themes[0];
    const branding = state.reportPresentation.brandingOverride || library.brandings.find((item) => item.id === brandingId) || buildBrandingFromLegacyState();

    const validationMessages = [
        ...buildLayoutCompatibilityMessages(layout),
        ...buildThemeAccessibilityMessages(theme),
        ...buildBrandingValidationMessages(branding, theme, layout)
    ];
    const sectionAvailability = getSectionAvailability();
    const isUsability = appState.reportType === 'Usability Report';
    const tocEnabled = Boolean(layout.tableOfContents?.enabled);

    let sections = layout.sections.map((s) => {
        if (s.id === 'table-of-contents') {
            return { ...s, enabled: tocEnabled };
        }
        return s;
    });

    if (tocEnabled && !sections.some((s) => s.id === 'table-of-contents')) {
        const coverIdx = sections.findIndex((s) => s.id === 'cover-page');
        const insertIdx = coverIdx >= 0 ? coverIdx + 1 : 0;
        sections.splice(insertIdx, 0, { id: 'table-of-contents', enabled: true, required: false });
    }

    const tocIndex = sections.findIndex((s) => s.id === 'table-of-contents' && s.enabled);
    if (tocIndex >= 0) {
        const coverIndex = sections.findIndex((s) => s.id === 'cover-page' && s.enabled);
        const targetIndex = coverIndex >= 0 ? coverIndex + 1 : 0;
        if (tocIndex !== targetIndex) {
            const [tocSec] = sections.splice(tocIndex, 1);
            sections.splice(targetIndex, 0, tocSec);
        }
    }

    const visibleSections = sections
        .filter((section) => section.enabled)
        .filter((section) => !isUsability || section.id !== 'analytics')
        .map((section) => ({
            ...section,
            label: PRESENTATION_SECTION_LABELS[section.id] || section.id,
            available: Boolean(sectionAvailability[section.id])
        }));

    return {
        layout,
        theme,
        branding,
        publishingProfile: profile,
        previewMode: PREVIEW_MODES.has(normalizeText(profile?.previewMode || state.preview.mode)) ? normalizeText(profile?.previewMode || state.preview.mode) : 'screen',
        validationMessages,
        sectionAvailability,
        visibleSections
    };
}

export function getPresentationValidation() {
    const resolved = getResolvedReportPresentation();
    return clone(resolved.validationMessages);
}

export function initializeReportPresentationFramework() {
    if (initialized) return true;
    const state = ensurePresentationState();
    if (!state.reportPresentation.brandingOverride && appState.branding && typeof appState.branding === 'object') {
        state.reportPresentation.brandingOverride = buildBrandingFromLegacyState();
    }
    syncLegacyBrandingState();
    initialized = true;
    saveState({ action: 'Initialized report presentation framework', recordHistory: false });
    emitPresentationUpdate({ type: 'initialized' });
    return true;
}

export function saveBrandingAsWorkspaceDefault() {
    const resolved = getResolvedReportPresentation();
    setActiveWorkspaceDefaultBranding({
        enabled: resolved.branding.enabled,
        headerText: resolved.branding.headerText,
        headerHtml: resolved.branding.headerHtml,
        footerHtml: resolved.branding.footerHtml,
        headerImages: resolved.branding.headerImages,
        footerImages: resolved.branding.footerImages,
        pageMargins: resolved.branding.pageMargins,
        showPageNumbers: resolved.branding.showPageNumbers,
        primaryColor: resolved.branding.primaryColor,
        logoDataUrl: resolved.branding.headerImages?.[0]?.dataUrl || '',
        logoAltText: resolved.branding.headerImages?.[0]?.altText || '',
        logoDecorative: Boolean(resolved.branding.headerImages?.[0]?.decorative),
        logoFileName: resolved.branding.headerImages?.[0]?.fileName || ''
    }, {
        action: 'Updated workspace default branding from presentation framework'
    });
}

export function buildPresentationCssVariables(theme, branding) {
    return {
        '--report-theme-primary': theme.colors.primary,
        '--report-theme-secondary': theme.colors.secondary,
        '--report-theme-accent': theme.colors.accent,
        '--report-theme-background': theme.colors.background,
        '--report-theme-surface': theme.colors.surface,
        '--report-theme-text': theme.colors.text,
        '--report-theme-muted': theme.colors.mutedText,
        '--report-theme-link': theme.colors.link,
        '--report-theme-heading': theme.colors.heading,
        '--report-theme-border': theme.colors.border,
        '--report-theme-table-header-bg': theme.colors.tableHeaderBackground,
        '--report-theme-table-header-text': theme.colors.tableHeaderText,
        '--report-theme-focus': theme.colors.focusIndicator,
        '--report-brand-primary': branding.primaryColor,
        '--report-font-family': theme.typography.fontFamily,
        '--report-heading-font-family': theme.typography.headingFontFamily,
        '--report-font-size': `${theme.typography.fontSize}px`,
        '--report-line-height': String(theme.typography.lineHeight),
        '--report-letter-spacing': `${theme.typography.letterSpacing}px`,
        '--report-section-gap': `${theme.spacing.sectionGap}px`,
        '--report-paragraph-gap': `${theme.spacing.paragraphGap}px`,
        '--report-card-padding': `${theme.spacing.cardPadding}px`,
        '--report-table-cell-padding': `${theme.spacing.tableCellPadding}px`,
        '--report-margin-top': `${branding.pageMargins.top}px`,
        '--report-margin-right': `${branding.pageMargins.right}px`,
        '--report-margin-bottom': `${branding.pageMargins.bottom}px`,
        '--report-margin-left': `${branding.pageMargins.left}px`
    };
}

export function buildPresentationPreviewModel() {
    const resolved = getResolvedReportPresentation();
    const metrics = getCurrentReportMetrics();
    return {
        title: String(appState.reportTitle || 'Untitled Report'),
        organization: String(appState.orgClient || ''),
        projectName: String(appState.projectName || ''),
        scopeUrl: String(appState.scopeUrl || ''),
        authors: String(appState.auditors || ''),
        reportType: String(appState.reportType || ''),
        previewMode: resolved.previewMode,
        layout: clone(resolved.layout),
        theme: clone(resolved.theme),
        branding: clone(resolved.branding),
        visibleSections: clone(resolved.visibleSections),
        validationMessages: clone(resolved.validationMessages),
        metrics,
        progressItems: clone(getProgressItems()),
        cssVariables: buildPresentationCssVariables(resolved.theme, resolved.branding)
    };
}

export function getPresentationScopeOptions() {
    return ['personal', 'workspace', 'shared', 'application'];
}

export function applyPresentationPublishingProfile(profileId, options = {}) {
    const profile = findResource(PRESENTATION_RESOURCE_TYPES.publishingProfile, profileId);
    if (!profile) return false;
    updatePresentationSelection({
        publishingProfileId: profile.id,
        layoutId: profile.layoutId,
        themeId: profile.themeId,
        brandingId: profile.brandingId
    }, {
        action: String(options.action || `Applied publishing profile ${profile.name}`)
    });
    updatePresentationPreviewMode(profile.previewMode, { action: `Updated preview mode from ${profile.name}` });
    return true;
}

export function clearPresentationPublishingProfile(options = {}) {
    const state = ensurePresentationState();
    state.selection.publishingProfileId = '';
    saveState({ action: String(options.action || 'Cleared publishing profile selection') });
    emitPresentationUpdate({ type: 'selection', selection: clone(state.selection) });
    return true;
}

export function setPresentationBrandingFromLegacyState(options = {}) {
    updatePresentationOverride('branding', buildBrandingFromLegacyState(), {
        action: String(options.action || 'Synchronized legacy branding into presentation override')
    });
}

export function getPresentationResourceTypes() {
    return { ...PRESENTATION_RESOURCE_TYPES };
}

export function getPresentationPermissions() {
    return [...PRESENTATION_PERMISSIONS];
}

export function getPresentationEventName() {
    return PRESENTATION_EVENT;
}
