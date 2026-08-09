import {
    appState,
    getActiveProjectWorkspace,
    getImportedAccessibilityStandards,
    getProjectWorkspaces,
    getTemplateById,
    getUserTemplates,
    upsertProjectWorkspace
} from './state.js';
import { getCollaborationResourceMetadata } from './collaborationFramework.js';

const RELATIONSHIP_TYPE_DEFINITIONS = Object.freeze({
    contains: {
        id: 'contains',
        label: 'Contains',
        inverseId: 'contained-in',
        inverseLabel: 'Contained In',
        searchablePhrases: ['contains', 'contained in']
    },
    uses: {
        id: 'uses',
        label: 'Uses',
        inverseId: 'used-by',
        inverseLabel: 'Used By',
        searchablePhrases: ['uses', 'used by']
    },
    references: {
        id: 'references',
        label: 'References',
        inverseId: 'referenced-by',
        inverseLabel: 'Referenced By',
        searchablePhrases: ['references', 'referenced by']
    },
    'depends-on': {
        id: 'depends-on',
        label: 'Depends On',
        inverseId: 'required-by',
        inverseLabel: 'Required By',
        searchablePhrases: ['depends on', 'required by']
    },
    'shared-with': {
        id: 'shared-with',
        label: 'Shared With',
        inverseId: 'shared-with',
        inverseLabel: 'Shared With',
        searchablePhrases: ['shared with', 'shared']
    },
    'generated-from': {
        id: 'generated-from',
        label: 'Generated From',
        inverseId: 'generated-outputs',
        inverseLabel: 'Generated Outputs',
        searchablePhrases: ['generated from', 'generated outputs']
    }
});

const legacyRelationshipTypeMap = Object.freeze({
    'asset-report-link': 'references',
    'resource-link': 'references',
    'workspace-report': 'contains',
    'workspace-template': 'contains',
    'workspace-asset': 'contains'
});

const relationshipProviders = new Map();
const relationshipValidators = new Map();
let frameworkInitialized = false;

function normalizeText(value) {
    return String(value || '').trim();
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function toKey(resourceType, resourceId) {
    return `${normalizeText(resourceType).toLowerCase()}:${normalizeText(resourceId)}`;
}

function getRelationshipTypeDefinition(type) {
    const normalized = normalizeText(type).toLowerCase();
    const canonicalType = legacyRelationshipTypeMap[normalized] || normalized || 'references';
    return RELATIONSHIP_TYPE_DEFINITIONS[canonicalType] || RELATIONSHIP_TYPE_DEFINITIONS.references;
}

function normalizeResourceReference(reference) {
    const source = reference && typeof reference === 'object' ? reference : {};
    return {
        resourceType: normalizeText(source.resourceType || source.type),
        resourceId: normalizeText(source.resourceId || source.id),
        workspaceId: normalizeText(source.workspaceId)
    };
}

function getWorkspaceById(workspaceId) {
    const normalized = normalizeText(workspaceId);
    if (!normalized) return null;
    return getProjectWorkspaces().find((workspace) => workspace.id === normalized) || null;
}

function resolveWorkspace(workspaceOrId = null) {
    if (!workspaceOrId) return getActiveProjectWorkspace();
    if (typeof workspaceOrId === 'string') return getWorkspaceById(workspaceOrId);
    if (typeof workspaceOrId === 'object') return workspaceOrId;
    return getActiveProjectWorkspace();
}

function getWorkspaceReportIds(workspace) {
    return [...new Set([
        ...(workspace?.resources?.reports || []),
        ...(workspace?.associatedReportIds || [])
    ].map((value) => normalizeText(value)).filter(Boolean))];
}

function getWorkspaceTemplateIds(workspace) {
    return [...new Set([
        ...(workspace?.resources?.templates || []),
        ...(workspace?.associatedTemplateIds || [])
    ].map((value) => normalizeText(value)).filter(Boolean))];
}

function findReportById(reportId) {
    const normalized = normalizeText(reportId);
    return (appState.reports || []).find((report) => report.id === normalized) || null;
}

function findTemplateByName(templateName) {
    const normalized = normalizeText(templateName).toLowerCase();
    if (!normalized) return null;
    return [...getUserTemplates(), ...[getTemplateById(normalized)].filter(Boolean)]
        .find((template) => normalizeText(template?.name).toLowerCase() === normalized) || null;
}

function resolveReportTemplate(report) {
    const templateId = normalizeText(report?.data?.templateOption);
    if (templateId) {
        const byId = getTemplateById(templateId);
        if (byId) return byId;
    }
    const templateName = normalizeText(report?.data?.templateName);
    if (!templateName) return null;
    return findTemplateByName(templateName);
}

function resolveStandardByName(standardName) {
    const normalized = normalizeText(standardName).toLowerCase();
    if (!normalized) return null;

    return getImportedAccessibilityStandards().find((standard) => {
        const names = [standard.displayName, standard.internalId, standard.id]
            .map((value) => normalizeText(value).toLowerCase())
            .filter(Boolean);
        return names.includes(normalized);
    }) || null;
}

function buildSyntheticStandard(standardName) {
    const label = normalizeText(standardName);
    if (!label) return null;
    return {
        id: `synthetic-standard:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        displayName: label,
        internalId: label,
        synthetic: true
    };
}

function resolveReportStandard(report) {
    const standardName = normalizeText(report?.data?.standard);
    if (!standardName) return null;
    return resolveStandardByName(standardName) || buildSyntheticStandard(standardName);
}

function buildResourceRecord({ id, type, name, workspaceId = '', subtitle = '', category = '', data = null, path = '' }) {
    return {
        id: normalizeText(id),
        type: normalizeText(type),
        name: normalizeText(name) || 'Unnamed Resource',
        workspaceId: normalizeText(workspaceId),
        subtitle: normalizeText(subtitle),
        category: normalizeText(category),
        path: normalizeText(path),
        data,
        collaboration: getCollaborationResourceMetadata(type, id, workspaceId)
    };
}

function toStoredRelationshipRecord(relationship) {
    return {
        id: relationship.id,
        type: relationship.relationshipType,
        fromType: relationship.sourceResourceType,
        fromId: relationship.sourceResourceId,
        toType: relationship.targetResourceType,
        toId: relationship.targetResourceId,
        label: relationship.label,
        metadata: relationship.metadata
    };
}

function getExistingReportIds() {
    return new Set((appState.reports || []).map((report) => normalizeText(report.id)).filter(Boolean));
}

function getExistingTemplateIds() {
    return new Set((getUserTemplates() || []).map((template) => normalizeText(template.id)).filter(Boolean));
}

function cloneWorkspaceResources(workspace) {
    return workspace?.resources && typeof workspace.resources === 'object'
        ? {
            ...workspace.resources,
            projectAssets: Array.isArray(workspace.resources.projectAssets) ? workspace.resources.projectAssets.map((item) => ({ ...item })) : [],
            attachments: Array.isArray(workspace.resources.attachments) ? workspace.resources.attachments.map((item) => ({ ...item })) : []
        }
        : {};
}

export function getRelationshipTypeDefinitions() {
    return Object.values(RELATIONSHIP_TYPE_DEFINITIONS).map((definition) => ({ ...definition }));
}

export function getWorkspaceResourceCatalog(workspaceOrId = null) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return [];

    const catalog = [];
    const push = (record) => {
        if (!record?.id || !record?.type) return;
        catalog.push(record);
    };

    push(buildResourceRecord({
        id: workspace.id,
        type: 'workspace',
        name: workspace.name,
        workspaceId: workspace.id,
        subtitle: workspace.status || 'Project Workspace',
        category: 'Project Workspaces',
        data: workspace,
        path: workspace.folderPath || workspace.folderName
    }));

    getWorkspaceReportIds(workspace).forEach((reportId) => {
        const report = findReportById(reportId);
        if (!report) return;
        push(buildResourceRecord({
            id: report.id,
            type: 'report',
            name: report.name,
            workspaceId: workspace.id,
            subtitle: normalizeText(report.data?.reportType || 'Report'),
            category: 'Reports',
            data: report
        }));
    });

    getWorkspaceTemplateIds(workspace).forEach((templateId) => {
        const template = getTemplateById(templateId) || (getUserTemplates() || []).find((item) => item.id === templateId);
        if (!template) return;
        push(buildResourceRecord({
            id: template.id,
            type: 'template',
            name: template.name,
            workspaceId: workspace.id,
            subtitle: normalizeText(template.metadata?.source || 'Template'),
            category: 'Templates',
            data: template
        }));
    });

    (workspace.resources?.projectAssets || []).forEach((asset) => {
        push(buildResourceRecord({
            id: asset.id,
            type: 'asset',
            name: asset.title || asset.fileName,
            workspaceId: workspace.id,
            subtitle: asset.category || 'Project Asset',
            category: 'Project Assets',
            data: asset,
            path: asset.relativePath || asset.fileName
        }));
    });

    (workspace.resources?.attachments || []).forEach((attachment) => {
        push(buildResourceRecord({
            id: attachment.id,
            type: 'attachment',
            name: attachment.title || attachment.fileName,
            workspaceId: workspace.id,
            subtitle: attachment.category || 'Attachment',
            category: 'Attachments',
            data: attachment,
            path: attachment.relativePath || attachment.fileName
        }));
    });

    getWorkspaceReportIds(workspace).forEach((reportId) => {
        const report = findReportById(reportId);
        if (!report) return;
        const standard = resolveReportStandard(report);
        if (!standard) return;

        const standardId = normalizeText(standard.id || standard.internalId || standard.displayName);
        if (catalog.some((item) => item.type === 'standard' && item.id === standardId)) return;

        push(buildResourceRecord({
            id: standardId,
            type: 'standard',
            name: standard.displayName || standard.internalId,
            workspaceId: workspace.id,
            subtitle: 'Accessibility Standard',
            category: 'Accessibility Standards',
            data: standard
        }));
    });

    return catalog;
}

function createRelationshipRecord(input) {
    const source = input && typeof input === 'object' ? input : {};
    const definition = getRelationshipTypeDefinition(source.relationshipType || source.type);
    return {
        id: normalizeText(source.id) || createId('relationship'),
        relationshipType: definition.id,
        label: normalizeText(source.label) || definition.label,
        inverseRelationshipType: definition.inverseId,
        inverseLabel: definition.inverseLabel,
        sourceResourceType: normalizeText(source.sourceResourceType || source.fromType),
        sourceResourceId: normalizeText(source.sourceResourceId || source.fromId),
        targetResourceType: normalizeText(source.targetResourceType || source.toType),
        targetResourceId: normalizeText(source.targetResourceId || source.toId),
        workspaceId: normalizeText(source.workspaceId),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {},
        derived: source.derived === true,
        providerId: normalizeText(source.providerId || source.metadata?.providerId || 'art-core')
    };
}

function getStoredWorkspaceRelationships(workspace) {
    return (workspace?.relationships || []).map((relationship) => createRelationshipRecord({
        ...relationship,
        workspaceId: workspace.id,
        metadata: {
            ...(relationship?.metadata && typeof relationship.metadata === 'object' ? relationship.metadata : {}),
            source: 'workspace-state'
        }
    }));
}

function createContainsRelationship(workspaceId, sourceType, sourceId, targetType, targetId, metadata = {}) {
    return createRelationshipRecord({
        relationshipType: 'contains',
        sourceResourceType: sourceType,
        sourceResourceId: sourceId,
        targetResourceType: targetType,
        targetResourceId: targetId,
        workspaceId,
        metadata,
        derived: true
    });
}

function createUsesRelationship(workspaceId, sourceType, sourceId, targetType, targetId, metadata = {}) {
    return createRelationshipRecord({
        relationshipType: 'uses',
        sourceResourceType: sourceType,
        sourceResourceId: sourceId,
        targetResourceType: targetType,
        targetResourceId: targetId,
        workspaceId,
        metadata,
        derived: true
    });
}

function createReferencesRelationship(workspaceId, sourceType, sourceId, targetType, targetId, metadata = {}) {
    return createRelationshipRecord({
        relationshipType: 'references',
        sourceResourceType: sourceType,
        sourceResourceId: sourceId,
        targetResourceType: targetType,
        targetResourceId: targetId,
        workspaceId,
        metadata,
        derived: true
    });
}

function getProviderRelationships(workspace) {
    return [...relationshipProviders.values()].flatMap((provider) => {
        if (typeof provider.getRelationships !== 'function') return [];
        try {
            const values = provider.getRelationships({ workspace, appState }) || [];
            return Array.isArray(values)
                ? values.map((item) => createRelationshipRecord({ ...item, workspaceId: workspace.id, providerId: provider.id }))
                : [];
        } catch (error) {
            return [];
        }
    });
}

function getDerivedWorkspaceRelationships(workspace) {
    if (!workspace) return [];
    const derived = [];
    const workspaceId = workspace.id;

    getWorkspaceReportIds(workspace).forEach((reportId) => {
        derived.push(createContainsRelationship(workspaceId, 'workspace', workspace.id, 'report', reportId));
    });

    getWorkspaceTemplateIds(workspace).forEach((templateId) => {
        derived.push(createContainsRelationship(workspaceId, 'workspace', workspace.id, 'template', templateId));
    });

    (workspace.resources?.projectAssets || []).forEach((asset) => {
        derived.push(createContainsRelationship(workspaceId, 'workspace', workspace.id, 'asset', asset.id));
        (asset.linkedReportIds || []).forEach((reportId) => {
            derived.push(createReferencesRelationship(workspaceId, 'report', reportId, 'asset', asset.id, {
                relationshipScope: 'current-workspace',
                relationshipStatus: 'shared'
            }));
        });
    });

    (workspace.resources?.attachments || []).forEach((attachment) => {
        derived.push(createContainsRelationship(workspaceId, 'workspace', workspace.id, 'attachment', attachment.id));
        (attachment.linkedReportIds || []).forEach((reportId) => {
            derived.push(createReferencesRelationship(workspaceId, 'report', reportId, 'attachment', attachment.id, {
                relationshipScope: 'current-workspace'
            }));
        });
    });

    getWorkspaceReportIds(workspace).forEach((reportId) => {
        const report = findReportById(reportId);
        if (!report) return;

        const template = resolveReportTemplate(report);
        if (template) {
            derived.push(createUsesRelationship(workspaceId, 'report', report.id, 'template', template.id, {
                required: true
            }));
        }

        const standard = resolveReportStandard(report);
        if (standard) {
            derived.push(createUsesRelationship(workspaceId, 'report', report.id, 'standard', normalizeText(standard.id || standard.internalId || standard.displayName), {
                required: true
            }));
        }
    });

    return derived.concat(getProviderRelationships(workspace));
}

function dedupeRelationships(relationships) {
    const seen = new Set();
    return relationships.filter((relationship) => {
        const key = [
            relationship.relationshipType,
            relationship.sourceResourceType,
            relationship.sourceResourceId,
            relationship.targetResourceType,
            relationship.targetResourceId,
            relationship.workspaceId
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function resolveResourceRecord(reference, workspace) {
    const normalized = normalizeResourceReference(reference);
    if (!normalized.resourceType || !normalized.resourceId) return null;
    return getWorkspaceResourceCatalog(workspace || normalized.workspaceId)
        .find((item) => item.type === normalized.resourceType && item.id === normalized.resourceId) || null;
}

function summarizeRelationshipCategory(direction, relationship, otherResource) {
    const label = direction === 'outbound' ? relationship.label : relationship.inverseLabel;
    const type = direction === 'outbound' ? relationship.relationshipType : relationship.inverseRelationshipType;
    return {
        relationshipType: type,
        label,
        count: 1,
        resources: otherResource ? [otherResource] : [],
        relationships: [relationship]
    };
}

function mergeCategorySummary(existing, addition) {
    existing.count += addition.count;
    existing.resources = existing.resources.concat(addition.resources);
    existing.relationships = existing.relationships.concat(addition.relationships);
    return existing;
}

export function getWorkspaceRelationships(workspaceOrId = null) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return [];
    return dedupeRelationships([
        ...getStoredWorkspaceRelationships(workspace),
        ...getDerivedWorkspaceRelationships(workspace)
    ]);
}

export function getRelationshipsForResource(resourceReference, options = {}) {
    const normalized = normalizeResourceReference(resourceReference);
    const workspace = resolveWorkspace(normalized.workspaceId || options.workspaceId || null);
    if (!workspace) return { inbound: [], outbound: [], all: [] };

    const all = getWorkspaceRelationships(workspace);
    const outbound = all.filter((relationship) => relationship.sourceResourceType === normalized.resourceType && relationship.sourceResourceId === normalized.resourceId);
    const inbound = all.filter((relationship) => relationship.targetResourceType === normalized.resourceType && relationship.targetResourceId === normalized.resourceId);

    return { inbound, outbound, all };
}

export function getRelationshipSummaryForResource(resourceReference, options = {}) {
    const normalized = normalizeResourceReference(resourceReference);
    const workspace = resolveWorkspace(normalized.workspaceId || options.workspaceId || null);
    if (!workspace) return [];

    const { inbound, outbound } = getRelationshipsForResource(normalized, { workspaceId: workspace.id });
    const categories = new Map();

    outbound.forEach((relationship) => {
        const target = resolveResourceRecord({
            resourceType: relationship.targetResourceType,
            resourceId: relationship.targetResourceId,
            workspaceId: workspace.id
        }, workspace);
        const summary = summarizeRelationshipCategory('outbound', relationship, target);
        const existing = categories.get(summary.relationshipType);
        categories.set(summary.relationshipType, existing ? mergeCategorySummary(existing, summary) : summary);
    });

    inbound.forEach((relationship) => {
        const source = resolveResourceRecord({
            resourceType: relationship.sourceResourceType,
            resourceId: relationship.sourceResourceId,
            workspaceId: workspace.id
        }, workspace);
        const summary = summarizeRelationshipCategory('inbound', relationship, source);
        const existing = categories.get(summary.relationshipType);
        categories.set(summary.relationshipType, existing ? mergeCategorySummary(existing, summary) : summary);
    });

    return [...categories.values()]
        .map((category) => ({
            ...category,
            resources: category.resources.filter(Boolean)
        }))
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
}

export function getImpactAnalysisForResource(resourceReference, options = {}) {
    const normalized = normalizeResourceReference(resourceReference);
    const workspace = resolveWorkspace(normalized.workspaceId || options.workspaceId || null);
    if (!workspace) return { totalImpacts: 0, categories: [] };

    const { inbound } = getRelationshipsForResource(normalized, { workspaceId: workspace.id });
    const byType = new Map();
    inbound.forEach((relationship) => {
        const label = relationship.sourceResourceType || 'resource';
        byType.set(label, Number(byType.get(label) || 0) + 1);
    });

    const categories = [...byType.entries()].map(([resourceType, count]) => ({
        resourceType,
        count,
        label: `${count} ${resourceType}${count === 1 ? '' : 's'}`
    }));

    return {
        totalImpacts: inbound.length,
        categories
    };
}

export function getDeletionPreview(resourceReference, options = {}) {
    const normalized = normalizeResourceReference(resourceReference);
    const workspace = resolveWorkspace(normalized.workspaceId || options.workspaceId || null);
    if (!workspace) {
        return {
            canDelete: true,
            affectedResources: [],
            consequences: []
        };
    }

    const { inbound, outbound } = getRelationshipsForResource(normalized, { workspaceId: workspace.id });
    const affectedResources = inbound
        .map((relationship) => resolveResourceRecord({
            resourceType: relationship.sourceResourceType,
            resourceId: relationship.sourceResourceId,
            workspaceId: workspace.id
        }, workspace))
        .filter(Boolean);

    const brokenRelationships = inbound.concat(outbound).filter((relationship) => {
        const source = resolveResourceRecord({
            resourceType: relationship.sourceResourceType,
            resourceId: relationship.sourceResourceId,
            workspaceId: workspace.id
        }, workspace);
        const target = resolveResourceRecord({
            resourceType: relationship.targetResourceType,
            resourceId: relationship.targetResourceId,
            workspaceId: workspace.id
        }, workspace);
        return !source || !target;
    });

    return {
        canDelete: inbound.length === 0,
        affectedResources,
        brokenRelationshipCount: brokenRelationships.length,
        consequences: [
            inbound.length > 0 ? `${inbound.length} referencing or dependent resource${inbound.length === 1 ? '' : 's'} will be affected.` : '',
            outbound.length > 0 ? `${outbound.length} outgoing relationship${outbound.length === 1 ? '' : 's'} will be removed.` : '',
            brokenRelationships.length > 0 ? `${brokenRelationships.length} broken relationship${brokenRelationships.length === 1 ? '' : 's'} require repair.` : ''
        ].filter(Boolean)
    };
}

function buildWorkspaceRelationshipIntegritySnapshot(workspace, options = {}) {
    const active = resolveWorkspace(workspace);
    if (!active) return null;

    const existingReports = getExistingReportIds();
    const existingTemplates = getExistingTemplateIds();
    const resourceIdRemap = options.resourceIdRemap && typeof options.resourceIdRemap === 'object' ? options.resourceIdRemap : {};
    const resources = cloneWorkspaceResources(active);

    const remapResourceId = (resourceType, resourceId) => {
        const normalizedType = normalizeText(resourceType).toLowerCase();
        const normalizedId = normalizeText(resourceId);
        const direct = resourceIdRemap[`${normalizedType}:${normalizedId}`];
        if (direct) return normalizeText(direct);
        const byType = resourceIdRemap[normalizedType];
        if (byType && typeof byType === 'object' && byType[normalizedId]) return normalizeText(byType[normalizedId]);
        return normalizedId;
    };

    resources.projectAssets = resources.projectAssets.map((asset) => ({
        ...asset,
        linkedReportIds: [...new Set((asset.linkedReportIds || []).map((value) => remapResourceId('report', value)).filter((value) => existingReports.has(value)))]
    }));
    resources.attachments = resources.attachments.map((attachment) => ({
        ...attachment,
        linkedReportIds: [...new Set((attachment.linkedReportIds || []).map((value) => remapResourceId('report', value)).filter((value) => existingReports.has(value)))]
    }));

    const nextWorkspace = {
        ...active,
        associatedReportIds: [...new Set((active.associatedReportIds || active.resources?.reports || []).map((value) => remapResourceId('report', value)).filter((value) => existingReports.has(value)))],
        associatedTemplateIds: [...new Set((active.associatedTemplateIds || active.resources?.templates || []).map((value) => remapResourceId('template', value)).filter((value) => existingTemplates.has(value)))],
        resources: {
            ...resources,
            reports: [...new Set((active.resources?.reports || active.associatedReportIds || []).map((value) => remapResourceId('report', value)).filter((value) => existingReports.has(value)))],
            templates: [...new Set((active.resources?.templates || active.associatedTemplateIds || []).map((value) => remapResourceId('template', value)).filter((value) => existingTemplates.has(value)))]
        },
        lastModifiedAt: new Date().toISOString()
    };

    const catalogKeys = new Set(getWorkspaceResourceCatalog(nextWorkspace).map((resource) => toKey(resource.type, resource.id)));
    const storedRelationships = getStoredWorkspaceRelationships(nextWorkspace)
        .map((relationship) => createRelationshipRecord({
            ...relationship,
            sourceResourceId: remapResourceId(relationship.sourceResourceType, relationship.sourceResourceId),
            targetResourceId: remapResourceId(relationship.targetResourceType, relationship.targetResourceId)
        }))
        .filter((relationship) => RELATIONSHIP_TYPE_DEFINITIONS[relationship.relationshipType])
        .filter((relationship) => relationship.sourceResourceId && relationship.targetResourceId)
        .filter((relationship) => catalogKeys.has(toKey(relationship.sourceResourceType, relationship.sourceResourceId)))
        .filter((relationship) => catalogKeys.has(toKey(relationship.targetResourceType, relationship.targetResourceId)))
        .filter((relationship) => !(relationship.relationshipType === 'contains'
            && relationship.sourceResourceType === relationship.targetResourceType
            && relationship.sourceResourceId === relationship.targetResourceId));

    nextWorkspace.relationships = dedupeRelationships(storedRelationships).map((relationship) => toStoredRelationshipRecord(relationship));
    return nextWorkspace;
}

export function reconcileWorkspaceRelationshipIntegrity(workspaceOrId = null, options = {}) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return { workspace: null, changed: false, removedIssueCount: 0, issuesBefore: [], issuesAfter: [] };

    const issuesBefore = validateWorkspaceRelationships(workspace);
    const reconciled = buildWorkspaceRelationshipIntegritySnapshot(workspace, options);
    if (!reconciled) return { workspace: null, changed: false, removedIssueCount: 0, issuesBefore, issuesAfter: issuesBefore };

    const changed = JSON.stringify({
        associatedReportIds: workspace.associatedReportIds,
        associatedTemplateIds: workspace.associatedTemplateIds,
        resources: workspace.resources,
        relationships: workspace.relationships
    }) !== JSON.stringify({
        associatedReportIds: reconciled.associatedReportIds,
        associatedTemplateIds: reconciled.associatedTemplateIds,
        resources: reconciled.resources,
        relationships: reconciled.relationships
    });

    if (options.persist === true && changed) {
        upsertProjectWorkspace(reconciled, {
            action: String(options.action || `Reconciled workspace relationships for ${reconciled.name}`),
            setActive: options.setActive !== false,
            persist: true
        });
        publishRelationshipEvent('Relationship Repaired', {
            workspaceId: reconciled.id,
            issueCount: issuesBefore.length
        });
    }

    const issuesAfter = validateWorkspaceRelationships(reconciled);
    return {
        workspace: reconciled,
        changed,
        removedIssueCount: Math.max(0, issuesBefore.length - issuesAfter.length),
        issuesBefore,
        issuesAfter
    };
}

export function repairWorkspaceRelationships(workspaceOrId = null, options = {}) {
    return reconcileWorkspaceRelationshipIntegrity(workspaceOrId, {
        ...options,
        persist: options.persist !== false,
        action: String(options.action || 'Repaired workspace relationships')
    });
}

export function removeResourceReferencesFromAllWorkspaces(resourceType, resourceId, options = {}) {
    const targetType = normalizeText(resourceType).toLowerCase();
    const targetId = normalizeText(resourceId);
    if (!targetType || !targetId) {
        return { updatedWorkspaceIds: [], removedReferenceCount: 0 };
    }

    const updatedWorkspaceIds = [];
    let removedReferenceCount = 0;

    getProjectWorkspaces().forEach((workspace) => {
        const resources = cloneWorkspaceResources(workspace);
        let changed = false;
        const nextWorkspace = {
            ...workspace,
            associatedReportIds: [...(workspace.associatedReportIds || [])],
            associatedTemplateIds: [...(workspace.associatedTemplateIds || [])],
            resources,
            relationships: [...(workspace.relationships || [])]
        };

        if (targetType === 'report') {
            const nextAssociated = nextWorkspace.associatedReportIds.filter((value) => normalizeText(value) !== targetId);
            const nextReports = (resources.reports || []).filter((value) => normalizeText(value) !== targetId);
            if (nextAssociated.length !== nextWorkspace.associatedReportIds.length || nextReports.length !== (resources.reports || []).length) changed = true;
            nextWorkspace.associatedReportIds = nextAssociated;
            nextWorkspace.resources.reports = nextReports;

            resources.projectAssets = resources.projectAssets.map((asset) => {
                const nextLinked = (asset.linkedReportIds || []).filter((value) => normalizeText(value) !== targetId);
                if (nextLinked.length !== (asset.linkedReportIds || []).length) {
                    removedReferenceCount += (asset.linkedReportIds || []).length - nextLinked.length;
                    changed = true;
                }
                return { ...asset, linkedReportIds: nextLinked };
            });

            resources.attachments = resources.attachments.map((attachment) => {
                const nextLinked = (attachment.linkedReportIds || []).filter((value) => normalizeText(value) !== targetId);
                if (nextLinked.length !== (attachment.linkedReportIds || []).length) {
                    removedReferenceCount += (attachment.linkedReportIds || []).length - nextLinked.length;
                    changed = true;
                }
                return { ...attachment, linkedReportIds: nextLinked };
            });
        }

        if (targetType === 'template') {
            const nextAssociated = nextWorkspace.associatedTemplateIds.filter((value) => normalizeText(value) !== targetId);
            const nextTemplates = (resources.templates || []).filter((value) => normalizeText(value) !== targetId);
            if (nextAssociated.length !== nextWorkspace.associatedTemplateIds.length || nextTemplates.length !== (resources.templates || []).length) changed = true;
            nextWorkspace.associatedTemplateIds = nextAssociated;
            nextWorkspace.resources.templates = nextTemplates;
        }

        const beforeRelationshipCount = nextWorkspace.relationships.length;
        nextWorkspace.relationships = nextWorkspace.relationships.filter((relationship) => {
            const sourceType = normalizeText(relationship.fromType || relationship.sourceResourceType).toLowerCase();
            const sourceId = normalizeText(relationship.fromId || relationship.sourceResourceId);
            const targetStoredType = normalizeText(relationship.toType || relationship.targetResourceType).toLowerCase();
            const targetStoredId = normalizeText(relationship.toId || relationship.targetResourceId);
            return !(
                (sourceType === targetType && sourceId === targetId)
                || (targetStoredType === targetType && targetStoredId === targetId)
            );
        });
        if (beforeRelationshipCount !== nextWorkspace.relationships.length) {
            removedReferenceCount += beforeRelationshipCount - nextWorkspace.relationships.length;
            changed = true;
        }

        const reconciled = reconcileWorkspaceRelationshipIntegrity(nextWorkspace, { persist: false }).workspace;
        if (!reconciled) return;
        if (!changed) return;

        upsertProjectWorkspace(reconciled, {
            action: String(options.action || `Updated relationships after ${targetType} lifecycle change`),
            setActive: options.setActive !== false,
            persist: options.persist !== false
        });
        updatedWorkspaceIds.push(reconciled.id);
    });

    return {
        updatedWorkspaceIds,
        removedReferenceCount
    };
}

export function replaceResourceReferencesAcrossWorkspaces(resourceType, oldResourceId, newResourceId, options = {}) {
    const targetType = normalizeText(resourceType).toLowerCase();
    const oldId = normalizeText(oldResourceId);
    const nextId = normalizeText(newResourceId);
    if (!targetType || !oldId || !nextId || oldId === nextId) {
        return { updatedWorkspaceIds: [], replacedReferenceCount: 0 };
    }

    const updatedWorkspaceIds = [];
    let replacedReferenceCount = 0;

    getProjectWorkspaces().forEach((workspace) => {
        const resources = cloneWorkspaceResources(workspace);
        let changed = false;
        const nextWorkspace = {
            ...workspace,
            associatedReportIds: [...(workspace.associatedReportIds || [])],
            associatedTemplateIds: [...(workspace.associatedTemplateIds || [])],
            resources,
            relationships: [...(workspace.relationships || [])]
        };

        const replaceValue = (list = []) => list.map((value) => {
            const normalized = normalizeText(value);
            if (normalized !== oldId) return normalized;
            changed = true;
            replacedReferenceCount += 1;
            return nextId;
        });

        if (targetType === 'report') {
            nextWorkspace.associatedReportIds = [...new Set(replaceValue(nextWorkspace.associatedReportIds).filter(Boolean))];
            nextWorkspace.resources.reports = [...new Set(replaceValue(resources.reports || []).filter(Boolean))];

            resources.projectAssets = resources.projectAssets.map((asset) => ({
                ...asset,
                linkedReportIds: [...new Set(replaceValue(asset.linkedReportIds || []).filter(Boolean))]
            }));
            resources.attachments = resources.attachments.map((attachment) => ({
                ...attachment,
                linkedReportIds: [...new Set(replaceValue(attachment.linkedReportIds || []).filter(Boolean))]
            }));
        }

        if (targetType === 'template') {
            nextWorkspace.associatedTemplateIds = [...new Set(replaceValue(nextWorkspace.associatedTemplateIds).filter(Boolean))];
            nextWorkspace.resources.templates = [...new Set(replaceValue(resources.templates || []).filter(Boolean))];
        }

        nextWorkspace.relationships = nextWorkspace.relationships.map((relationship) => {
            const sourceType = normalizeText(relationship.fromType || relationship.sourceResourceType).toLowerCase();
            const sourceId = normalizeText(relationship.fromId || relationship.sourceResourceId);
            const targetStoredType = normalizeText(relationship.toType || relationship.targetResourceType).toLowerCase();
            const targetStoredId = normalizeText(relationship.toId || relationship.targetResourceId);
            let nextRelationship = relationship;

            if (sourceType === targetType && sourceId === oldId) {
                nextRelationship = {
                    ...nextRelationship,
                    fromId: nextId,
                    sourceResourceId: nextId
                };
                changed = true;
                replacedReferenceCount += 1;
            }

            if (targetStoredType === targetType && targetStoredId === oldId) {
                nextRelationship = {
                    ...nextRelationship,
                    toId: nextId,
                    targetResourceId: nextId
                };
                changed = true;
                replacedReferenceCount += 1;
            }

            return nextRelationship;
        });

        const reconciled = reconcileWorkspaceRelationshipIntegrity(nextWorkspace, {
            persist: false,
            resourceIdRemap: {
                [`${targetType}:${oldId}`]: nextId
            }
        }).workspace;
        if (!reconciled || !changed) return;

        upsertProjectWorkspace(reconciled, {
            action: String(options.action || `Updated relationships after ${targetType} replacement`),
            setActive: options.setActive !== false,
            persist: options.persist !== false
        });
        updatedWorkspaceIds.push(reconciled.id);
    });

    return {
        updatedWorkspaceIds,
        replacedReferenceCount
    };
}

export function removeBrokenRelationships(workspaceOrId = null, options = {}) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return { workspace: null, removedRelationshipCount: 0, issuesAfter: [] };

    const reconciled = buildWorkspaceRelationshipIntegritySnapshot(workspace, options);
    if (!reconciled) return { workspace: null, removedRelationshipCount: 0, issuesAfter: [] };

    const removedRelationshipCount = Math.max(0, (workspace.relationships || []).length - (reconciled.relationships || []).length);
    if (options.persist !== false && removedRelationshipCount > 0) {
        upsertProjectWorkspace(reconciled, {
            action: String(options.action || `Removed broken relationships for ${reconciled.name}`),
            setActive: options.setActive !== false,
            persist: true
        });
        publishRelationshipEvent('Relationship Repaired', {
            workspaceId: reconciled.id,
            removedRelationshipCount
        });
    }

    return {
        workspace: reconciled,
        removedRelationshipCount,
        issuesAfter: validateWorkspaceRelationships(reconciled)
    };
}

export function validateWorkspaceRelationships(workspaceOrId = null) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return [];

    const catalog = getWorkspaceResourceCatalog(workspace);
    const resourceKeys = new Set(catalog.map((item) => toKey(item.type, item.id)));
    const issues = [];
    const seen = new Set();

    getWorkspaceRelationships(workspace).forEach((relationship) => {
        const key = [
            relationship.relationshipType,
            relationship.sourceResourceType,
            relationship.sourceResourceId,
            relationship.targetResourceType,
            relationship.targetResourceId
        ].join('|');

        if (seen.has(key)) {
            issues.push({
                level: 'warning',
                code: 'duplicate-relationship',
                message: `Duplicate relationship detected for ${relationship.label || relationship.relationshipType}.`,
                relationship
            });
        }
        seen.add(key);

        if (!RELATIONSHIP_TYPE_DEFINITIONS[relationship.relationshipType]) {
            issues.push({
                level: 'warning',
                code: 'invalid-relationship-type',
                message: `Relationship type ${relationship.relationshipType} is not registered.`,
                relationship
            });
        }

        if (!resourceKeys.has(toKey(relationship.sourceResourceType, relationship.sourceResourceId))) {
            issues.push({
                level: 'warning',
                code: 'missing-source-resource',
                message: `Missing source resource for relationship ${relationship.label || relationship.relationshipType}.`,
                relationship
            });
        }

        if (!resourceKeys.has(toKey(relationship.targetResourceType, relationship.targetResourceId))) {
            issues.push({
                level: 'warning',
                code: 'missing-target-resource',
                message: `Missing target resource for relationship ${relationship.label || relationship.relationshipType}.`,
                relationship
            });
        }

        if (
            relationship.relationshipType === 'contains'
            && relationship.sourceResourceType === relationship.targetResourceType
            && relationship.sourceResourceId === relationship.targetResourceId
        ) {
            issues.push({
                level: 'error',
                code: 'circular-containment',
                message: 'A resource cannot contain itself.',
                relationship
            });
        }
    });

    [...relationshipValidators.values()].forEach((validator) => {
        if (typeof validator.validate !== 'function') return;
        try {
            const validatorIssues = validator.validate({ workspace, appState, relationships: getWorkspaceRelationships(workspace) }) || [];
            if (Array.isArray(validatorIssues)) issues.push(...validatorIssues);
        } catch (error) {
            issues.push({
                level: 'warning',
                code: 'validator-failed',
                message: `Relationship validator ${validator.id} failed.`,
                detail: String(error?.message || error)
            });
        }
    });

    return issues;
}

export function registerRelationship(workspaceId, relationship, options = {}) {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return null;

    const nextRelationship = createRelationshipRecord({ ...relationship, workspaceId: workspace.id });
    const nextWorkspace = {
        ...workspace,
        relationships: dedupeRelationships([
            ...getStoredWorkspaceRelationships(workspace),
            nextRelationship
        ]).map((item) => ({
            id: item.id,
            type: item.relationshipType,
            fromType: item.sourceResourceType,
            fromId: item.sourceResourceId,
            toType: item.targetResourceType,
            toId: item.targetResourceId,
            label: item.label,
            metadata: item.metadata
        })),
        lastModifiedAt: new Date().toISOString()
    };

    upsertProjectWorkspace(nextWorkspace, {
        action: String(options.action || 'Registered resource relationship'),
        setActive: options.setActive !== false,
        persist: options.persist !== false
    });

    publishRelationshipEvent('Relationship Created', {
        workspaceId: workspace.id,
        relationshipId: nextRelationship.id,
        relationshipType: nextRelationship.relationshipType
    });
    return nextRelationship;
}

export function relationshipExists(workspaceId, relationship) {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return false;
    const candidate = createRelationshipRecord({ ...relationship, workspaceId: workspace.id });
    return getWorkspaceRelationships(workspace).some((item) => (
        item.relationshipType === candidate.relationshipType
        && item.sourceResourceType === candidate.sourceResourceType
        && item.sourceResourceId === candidate.sourceResourceId
        && item.targetResourceType === candidate.targetResourceType
        && item.targetResourceId === candidate.targetResourceId
    ));
}

export function registerRelationshipProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Relationship provider requires an id.');
    relationshipProviders.set(id, {
        id,
        name: normalizeText(source.name || id),
        getRelationships: typeof source.getRelationships === 'function' ? source.getRelationships : () => []
    });
    return relationshipProviders.get(id);
}

export function registerRelationshipValidator(validator) {
    const source = validator && typeof validator === 'object' ? validator : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Relationship validator requires an id.');
    relationshipValidators.set(id, {
        id,
        name: normalizeText(source.name || id),
        validate: typeof source.validate === 'function' ? source.validate : () => []
    });
    return relationshipValidators.get(id);
}

export function getRelationshipFrameworkDiagnostics(workspaceOrId = null) {
    const workspace = resolveWorkspace(workspaceOrId);
    return {
        registeredRelationshipTypes: getRelationshipTypeDefinitions(),
        registeredProviders: [...relationshipProviders.values()].map((provider) => ({ id: provider.id, name: provider.name })),
        registeredValidators: [...relationshipValidators.values()].map((validator) => ({ id: validator.id, name: validator.name })),
        issueCount: workspace ? validateWorkspaceRelationships(workspace).length : 0,
        issues: workspace ? validateWorkspaceRelationships(workspace) : []
    };
}

export function buildRelationshipSearchIndex(workspaceOrId = null) {
    const workspace = resolveWorkspace(workspaceOrId);
    if (!workspace) return [];

    return getWorkspaceResourceCatalog(workspace).flatMap((resource) => {
        const summary = getRelationshipSummaryForResource({
            resourceType: resource.type,
            resourceId: resource.id,
            workspaceId: workspace.id
        });

        return summary.map((category) => ({
            id: `relationship-search:${workspace.id}:${resource.type}:${resource.id}:${category.relationshipType}`,
            resource,
            category,
            searchableText: [
                resource.name,
                resource.type,
                category.label,
                ...category.resources.map((item) => item.name),
                ...category.resources.map((item) => item.subtitle)
            ].join(' ').toLowerCase()
        }));
    });
}

function publishRelationshipEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('art-resource-relationship-event', {
        detail: {
            type,
            at: new Date().toISOString(),
            ...detail
        }
    }));
}

export function initializeResourceRelationshipFramework() {
    if (frameworkInitialized) return true;
    frameworkInitialized = true;

    const reconcileAllWorkspaces = (reason) => {
        getProjectWorkspaces().forEach((workspace) => {
            reconcileWorkspaceRelationshipIntegrity(workspace.id, {
                persist: true,
                setActive: appState.activeWorkspaceId === workspace.id,
                action: `Reconciled workspace relationships after ${reason}`
            });
        });
    };

    window.addEventListener('art-workspace-event', (event) => {
        const workspaceId = normalizeText(event?.detail?.workspaceId);
        if (!workspaceId) return;
        publishRelationshipEvent('Relationship Query Completed', {
            workspaceId,
            relationshipCount: getWorkspaceRelationships(workspaceId).length
        });
    });

    window.addEventListener('art-reports-updated', () => {
        reconcileAllWorkspaces('report updates');
    });

    window.addEventListener('art-templates-updated', () => {
        reconcileAllWorkspaces('template updates');
    });

    window.addEventListener('art-accessibility-standards-updated', () => {
        reconcileAllWorkspaces('accessibility standard updates');
    });

    return true;
}