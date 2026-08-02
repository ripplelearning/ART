import {
    getBuiltInTemplates,
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

function createResourceItem({
    id,
    name,
    type,
    subtitle = '',
    description = '',
    category = '',
    capabilities = {},
    metadata = {}
}) {
    const title = normalizeText(name);
    return {
        id: normalizeText(id),
        name: title,
        title,
        type: normalizeText(type) || 'resource',
        subtitle: normalizeText(subtitle),
        description: normalizeText(description),
        category: normalizeText(category),
        searchableText: [title, subtitle, description, category].filter(Boolean).join(' ').trim(),
        capabilities: {
            openable: false,
            selectable: true,
            editable: false,
            deletable: false,
            searchable: true,
            ...(capabilities && typeof capabilities === 'object' ? capabilities : {})
        },
        metadata: metadata && typeof metadata === 'object' ? { ...metadata } : {}
    };
}

function createGroup(key, label, items, description = '') {
    return {
        key,
        label,
        description,
        items: Array.isArray(items) ? items : []
    };
}

function buildWorkspaceReportItems(workspace) {
    const linkedReportIds = new Set([
        ...(Array.isArray(workspace?.associatedReportIds) ? workspace.associatedReportIds : []),
        ...(Array.isArray(workspace?.resources?.reports) ? workspace.resources.reports : [])
    ].map((value) => normalizeText(value)).filter(Boolean));

    return getRecentReports()
        .filter((report) => linkedReportIds.size > 0 && linkedReportIds.has(report.id))
        .map((report) => createResourceItem({
            id: report.id,
            name: report.name,
            type: 'report',
            subtitle: report.data?.reportType || 'Report',
            description: report.data?.projectName || '',
            category: 'Reports',
            capabilities: {
                openable: true,
                editable: true,
                deletable: true,
                searchable: true
            },
            metadata: {
                updatedAt: report.updatedAt || 0,
                projectName: report.data?.projectName || '',
                reportType: report.data?.reportType || ''
            }
        }));
}

function buildWorkspaceTemplateItems(workspace) {
    const linkedTemplateIds = new Set([
        ...(Array.isArray(workspace?.associatedTemplateIds) ? workspace.associatedTemplateIds : []),
        ...(Array.isArray(workspace?.resources?.templates) ? workspace.resources.templates : [])
    ].map((value) => normalizeText(value)).filter(Boolean));

    const templates = [...getBuiltInTemplates(), ...getUserTemplates()];
    return templates
        .filter((template) => linkedTemplateIds.size > 0 && linkedTemplateIds.has(template.id))
        .map((template) => createResourceItem({
            id: template.id,
            name: template.name,
            type: 'template',
            subtitle: template.metadata?.source || 'template',
            description: template.metadata?.schemaVersion ? `Schema ${template.metadata.schemaVersion}` : '',
            category: 'Templates',
            capabilities: {
                openable: true,
                editable: true,
                deletable: template.metadata?.source === 'user' || template.metadata?.source === 'import',
                searchable: true
            },
            metadata: {
                source: template.metadata?.source || '',
                exportedAt: template.metadata?.exportedAt || ''
            }
        }));
}

function buildWorkspaceAssetItems(workspace) {
    return (Array.isArray(workspace?.resources?.projectAssets) ? workspace.resources.projectAssets : []).map((asset) => createResourceItem({
        id: asset.id,
        name: asset.title || asset.fileName || 'Project Asset',
        type: 'asset',
        subtitle: asset.category || 'Project Asset',
        description: asset.description || asset.relativePath || '',
        category: 'Project Assets',
        capabilities: {
            openable: true,
            editable: false,
            deletable: true,
            searchable: true
        },
        metadata: {
            fileName: asset.fileName || '',
            mimeType: asset.mimeType || '',
            tags: Array.isArray(asset.tags) ? [...asset.tags] : []
        }
    }));
}

function buildWorkspaceNamedItems(values, type, category, capabilities = {}) {
    return (Array.isArray(values) ? values : [])
        .map((value, index) => createResourceItem({
            id: `${type}-${index}`,
            name: typeof value === 'object' ? (value?.name || value?.title || value?.fileName || '') : value,
            type,
            subtitle: category,
            description: typeof value === 'object' ? (value?.description || '') : '',
            category,
            capabilities,
            metadata: typeof value === 'object' ? { ...value } : { value: String(value || '') }
        }))
        .filter((item) => Boolean(item.name));
}

export function getWorkspaceResourceGroups(workspace) {
    const activeWorkspace = workspace && typeof workspace === 'object' ? workspace : null;

    return [
        createGroup(
            'reports',
            'Reports',
            buildWorkspaceReportItems(activeWorkspace),
            'Reports linked to the active Project Workspace.'
        ),
        createGroup(
            'templates',
            'Templates',
            buildWorkspaceTemplateItems(activeWorkspace),
            'Templates linked to the active Project Workspace.'
        ),
        createGroup(
            'project-assets',
            'Project Assets',
            buildWorkspaceAssetItems(activeWorkspace),
            'Project assets stored with the active Project Workspace.'
        ),
        createGroup(
            'attachments',
            'Attachments',
            buildWorkspaceNamedItems(activeWorkspace?.resources?.attachments, 'attachment', 'Attachments', {
                openable: true,
                searchable: true
            }),
            'Attachments stored with the active Project Workspace.'
        ),
        createGroup(
            'audit-logs',
            'Audit Logs',
            buildWorkspaceNamedItems(activeWorkspace?.resources?.auditLogs, 'audit-log', 'Audit Logs', {
                searchable: true
            }),
            'Audit logs stored with the active Project Workspace.'
        ),
        createGroup(
            'progress-logs',
            'Progress Logs',
            buildWorkspaceNamedItems(activeWorkspace?.resources?.progressLogs, 'progress-log', 'Progress Logs', {
                searchable: true
            }),
            'Progress logs stored with the active Project Workspace.'
        ),
        createGroup(
            'exports',
            'Exports',
            buildWorkspaceNamedItems(activeWorkspace?.resources?.exports, 'export', 'Exports', {
                openable: true,
                searchable: true
            }),
            'Exports associated with the active Project Workspace.'
        ),
        createGroup(
            'backups',
            'Backups',
            buildWorkspaceNamedItems(activeWorkspace?.resources?.backups, 'backup', 'Backups', {
                openable: true,
                searchable: true
            }),
            'Backups associated with the active Project Workspace.'
        )
    ];
}

export function getResourceRegistrySnapshot() {
    return {
        reports: getRecentReports().map((report) => createResourceItem({
            id: report.id,
            name: report.name,
            type: 'report',
            subtitle: report.data?.reportType || 'Report',
            description: report.data?.projectName || '',
            category: 'Reports',
            capabilities: {
                openable: true,
                editable: true,
                deletable: true,
                searchable: true
            }
        })),
        templates: [...getBuiltInTemplates(), ...getUserTemplates()].map((template) => createResourceItem({
            id: template.id,
            name: template.name,
            type: 'template',
            subtitle: template.metadata?.source || 'template',
            description: template.metadata?.schemaVersion ? `Schema ${template.metadata.schemaVersion}` : '',
            category: 'Templates',
            capabilities: {
                openable: true,
                editable: true,
                deletable: template.metadata?.source === 'user' || template.metadata?.source === 'import',
                searchable: true
            }
        })),
        standards: getImportedAccessibilityStandards().map((standard) => createResourceItem({
            id: standard.id,
            name: standard.displayName || standard.internalId || 'Imported Standard',
            type: 'standard',
            subtitle: 'Accessibility Standard',
            description: `${Array.isArray(standard.criteria) ? standard.criteria.length : 0} criteria`,
            category: 'Accessibility Standards',
            capabilities: {
                openable: true,
                searchable: true
            }
        })),
        shortcuts: getShortcutDefinitions().map((shortcut) => createResourceItem({
            id: shortcut.action,
            name: shortcut.label,
            type: 'shortcut',
            subtitle: shortcut.shortcut || 'Unassigned',
            description: shortcut.action,
            category: 'Keyboard Shortcuts',
            capabilities: {
                searchable: true
            }
        })),
        visualAccessibility: [
            createResourceItem({
                id: 'visual-accessibility-active',
                name: getVisualAccessibilityConfig().activeProfile,
                type: 'visual-accessibility-profile',
                subtitle: 'Active profile',
                description: `Theme ${getVisualAccessibilityConfig().theme}, density ${getVisualAccessibilityConfig().density}`,
                category: 'Visual Accessibility',
                capabilities: {
                    openable: true,
                    searchable: true
                }
            })
        ],
        savedSearches: (getUniversalSearchConfig().savedSearches || []).map((search) => createResourceItem({
            id: search.id,
            name: search.name,
            type: 'saved-search',
            subtitle: search.scope || 'workspace',
            description: search.query || '',
            category: 'Search',
            capabilities: {
                openable: true,
                searchable: true,
                deletable: true
            }
        }))
    };
}
