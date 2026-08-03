import {
    appState,
    getImportedAccessibilityStandards,
    getRecentReports,
    getShortcutDefinitions,
    getUniversalSearchConfig,
    getUserTemplates,
    getVisualAccessibilityConfig
} from './state.js';

function normalizeText(value) {
    return String(value || '').trim();
}

function mapWorkspaceReports(workspace) {
    const reportIds = [
        ...(workspace?.resources?.reports || []),
        ...(workspace?.associatedReportIds || [])
    ];

    return (appState.reports || [])
        .filter((report) => reportIds.includes(report.id))
        .map((report) => ({ id: report.id, name: report.name, type: 'report' }));
}

function mapWorkspaceTemplates(workspace) {
    const templateIds = [
        ...(workspace?.resources?.templates || []),
        ...(workspace?.associatedTemplateIds || [])
    ];

    return (appState.userTemplates || [])
        .filter((template) => templateIds.includes(template.id))
        .map((template) => ({ id: template.id, name: template.name, type: 'template' }));
}

function mapWorkspaceAssets(workspace) {
    return (workspace?.resources?.projectAssets || []).map((asset) => ({
        id: asset.id,
        name: asset.title || asset.fileName,
        type: 'asset',
        category: asset.category
    }));
}

export function getWorkspaceResourceGroups(workspace) {
    const active = workspace && typeof workspace === 'object' ? workspace : null;
    if (!active) return [];

    return [
        { key: 'reports', label: 'Reports', items: mapWorkspaceReports(active) },
        { key: 'templates', label: 'Templates', items: mapWorkspaceTemplates(active) },
        { key: 'assets', label: 'Project Assets', items: mapWorkspaceAssets(active) },
        {
            key: 'auditLogs',
            label: 'Audit Logs',
            items: (active.resources.auditLogs || []).map((name, index) => ({ id: `audit-${index}`, name, type: 'auditLog' }))
        },
        {
            key: 'progressLogs',
            label: 'Progress Logs',
            items: (active.resources.progressLogs || []).map((name, index) => ({ id: `progress-${index}`, name, type: 'progressLog' }))
        },
        {
            key: 'attachments',
            label: 'Attachments',
            items: (active.resources.attachments || []).map((item) => ({ id: item.id, name: item.title || item.fileName, type: 'attachment' }))
        },
        {
            key: 'exports',
            label: 'Exports',
            items: (active.resources.exports || []).map((name, index) => ({ id: `export-${index}`, name, type: 'export' }))
        },
        {
            key: 'backups',
            label: 'Backups',
            items: (active.resources.backups || []).map((name, index) => ({ id: `backup-${index}`, name, type: 'backup' }))
        }
    ];
}

export function getResourceRegistrySnapshot() {
    const recentReports = getRecentReports().map((report) => ({
        id: report.id,
        name: report.name,
        type: 'report',
        subtitle: normalizeText(report.data?.reportType || 'Report'),
        category: 'Reports'
    }));

    const templates = getUserTemplates().map((template) => ({
        id: template.id,
        name: template.name,
        type: 'template',
        subtitle: normalizeText(template.metadata?.source || 'user'),
        category: 'Templates'
    }));

    const standards = getImportedAccessibilityStandards().map((standard) => ({
        id: standard.id,
        name: standard.displayName || standard.internalId || 'Imported Standard',
        type: 'standard',
        subtitle: 'Accessibility Standard',
        category: 'Accessibility Standards'
    }));

    const shortcuts = getShortcutDefinitions().map((shortcut) => ({
        id: shortcut.action,
        name: shortcut.label,
        type: 'shortcut',
        subtitle: shortcut.shortcut || 'Unassigned',
        category: 'Keyboard Shortcuts'
    }));

    const visual = getVisualAccessibilityConfig();
    const visualAccessibility = [{
        id: 'visual-accessibility-active-profile',
        name: visual.activeProfile,
        type: 'visual-accessibility-profile',
        subtitle: normalizeText(visual.theme),
        category: 'Visual Accessibility'
    }];

    const savedSearches = (getUniversalSearchConfig().savedSearches || []).map((item) => ({
        id: item.id,
        name: item.name,
        type: 'saved-search',
        subtitle: item.scope || 'workspace',
        category: 'Search'
    }));

    return {
        reports: recentReports,
        templates,
        standards,
        shortcuts,
        visualAccessibility,
        savedSearches
    };
}
