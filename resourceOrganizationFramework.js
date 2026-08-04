import {
    announce,
    appState,
    getActiveProjectWorkspace,
    getProjectWorkspaces,
    getReportById,
    getTemplateById,
    getUserTemplates,
    saveState,
    upsertProjectWorkspace
} from './state.js';
import { getWorkspaceResourceCatalog } from './resourceRelationshipFramework.js';
import { getPluginFrameworkSnapshot } from './pluginFramework.js';
import { getActiveWorkingViewSessionSnapshot, openWorkingViewFromCommand } from './reportViewsFramework.js';

const FRAMEWORK_VERSION = '1.0.0';

const TAG_RESERVED_NAMES = new Set([
    'system',
    'imported',
    'archived'
]);

const SUPPORTED_SCOPES = new Set([
    'resource',
    'report',
    'workspace',
    'application',
    'organization'
]);

let frameworkInitialized = false;
let importInput = null;

function nowIso() {
    return new Date().toISOString();
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeScope(value, fallback = 'workspace') {
    const scope = normalizeText(value).toLowerCase();
    return SUPPORTED_SCOPES.has(scope) ? scope : fallback;
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function dedupeBy(items, keySelector) {
    const seen = new Set();
    const output = [];
    items.forEach((item) => {
        const key = keySelector(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        output.push(item);
    });
    return output;
}

function emitOrganizationEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('art-resource-organization-event', {
        detail: {
            type,
            at: nowIso(),
            ...detail
        }
    }));
}

function normalizeResourceRef(reference) {
    const source = reference && typeof reference === 'object' ? reference : {};
    const resourceType = normalizeText(source.resourceType || source.type).toLowerCase();
    const resourceId = normalizeText(source.resourceId || source.id);
    const workspaceId = normalizeText(source.workspaceId || source.workspace || appState.activeWorkspaceId);
    return {
        resourceType,
        resourceId,
        workspaceId,
        unresolved: Boolean(source.unresolved)
    };
}

function getResourceRefKey(reference) {
    const ref = normalizeResourceRef(reference);
    return `${ref.workspaceId || 'workspace'}:${ref.resourceType}:${ref.resourceId}`;
}

function normalizeTag(tag, index = 0) {
    const source = tag && typeof tag === 'object' ? tag : {};
    const createdAt = normalizeText(source.createdAt) || nowIso();
    const assignments = dedupeBy(
        normalizeArray(source.assignments).map((assignment) => normalizeResourceRef(assignment)).filter((item) => item.resourceType && item.resourceId),
        (item) => getResourceRefKey(item)
    );

    return {
        id: normalizeText(source.id) || `tag-${Date.now()}-${index}`,
        name: normalizeText(source.name) || `Tag ${index + 1}`,
        description: normalizeText(source.description),
        scope: normalizeScope(source.scope, 'workspace'),
        color: normalizeText(source.color),
        pluginSource: normalizeText(source.pluginSource),
        reserved: Boolean(source.reserved),
        owner: normalizeText(source.owner),
        workspaceId: normalizeText(source.workspaceId),
        resourceType: normalizeText(source.resourceType).toLowerCase(),
        resourceId: normalizeText(source.resourceId),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {},
        assignments,
        createdAt,
        updatedAt: normalizeText(source.updatedAt) || createdAt
    };
}

function normalizeCollection(collection, index = 0) {
    const source = collection && typeof collection === 'object' ? collection : {};
    const createdAt = normalizeText(source.createdAt) || nowIso();

    return {
        id: normalizeText(source.id) || `collection-${Date.now()}-${index}`,
        name: normalizeText(source.name) || `Collection ${index + 1}`,
        description: normalizeText(source.description),
        scope: normalizeScope(source.scope, 'workspace'),
        type: normalizeText(source.type || source.collectionType || 'standard') || 'standard',
        parentCollectionId: normalizeText(source.parentCollectionId),
        pluginSource: normalizeText(source.pluginSource),
        reserved: Boolean(source.reserved),
        owner: normalizeText(source.owner),
        workspaceId: normalizeText(source.workspaceId),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {},
        resourceRefs: dedupeBy(
            normalizeArray(source.resourceRefs).map((entry) => normalizeResourceRef(entry)).filter((item) => item.resourceType && item.resourceId),
            (item) => getResourceRefKey(item)
        ),
        createdAt,
        updatedAt: normalizeText(source.updatedAt) || createdAt
    };
}

function normalizeSavedView(view, index = 0) {
    const source = view && typeof view === 'object' ? view : {};
    const createdAt = normalizeText(source.createdAt) || nowIso();

    return {
        id: normalizeText(source.id) || `saved-view-${Date.now()}-${index}`,
        name: normalizeText(source.name) || `Saved View ${index + 1}`,
        description: normalizeText(source.description),
        scope: normalizeScope(source.scope, 'workspace'),
        resourceType: normalizeText(source.resourceType || 'report').toLowerCase() || 'report',
        workspaceId: normalizeText(source.workspaceId),
        reportId: normalizeText(source.reportId),
        pluginSource: normalizeText(source.pluginSource),
        reserved: Boolean(source.reserved),
        owner: normalizeText(source.owner),
        configurationSummary: normalizeText(source.configurationSummary),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {},
        config: source.config && typeof source.config === 'object' ? { ...source.config } : {},
        createdAt,
        updatedAt: normalizeText(source.updatedAt) || createdAt,
        lastOpenedAt: normalizeText(source.lastOpenedAt)
    };
}

function normalizeOrganizationState(source) {
    const input = source && typeof source === 'object' ? source : {};
    const favorites = input.favorites && typeof input.favorites === 'object' ? input.favorites : {};
    const recent = input.recent && typeof input.recent === 'object' ? input.recent : {};

    return {
        frameworkVersion: normalizeText(input.frameworkVersion) || FRAMEWORK_VERSION,
        tags: normalizeArray(input.tags).map((item, index) => normalizeTag(item, index)),
        collections: normalizeArray(input.collections).map((item, index) => normalizeCollection(item, index)),
        savedViews: normalizeArray(input.savedViews).map((item, index) => normalizeSavedView(item, index)),
        favorites: {
            tags: normalizeArray(favorites.tags).map((value) => normalizeText(value)).filter(Boolean),
            collections: normalizeArray(favorites.collections).map((value) => normalizeText(value)).filter(Boolean),
            savedViews: normalizeArray(favorites.savedViews).map((value) => normalizeText(value)).filter(Boolean)
        },
        recent: {
            collections: normalizeArray(recent.collections).map((value) => normalizeText(value)).filter(Boolean).slice(0, 50),
            savedViews: normalizeArray(recent.savedViews).map((value) => normalizeText(value)).filter(Boolean).slice(0, 50)
        },
        unresolvedReferences: dedupeBy(
            normalizeArray(input.unresolvedReferences).map((item) => normalizeResourceRef(item)).filter((item) => item.resourceType && item.resourceId),
            (item) => getResourceRefKey(item)
        )
    };
}

function ensureOrganizationState() {
    appState.resourceOrganization = normalizeOrganizationState(appState.resourceOrganization);
    return appState.resourceOrganization;
}

function saveOrganizationState(action) {
    ensureOrganizationState();
    saveState({ action, recordHistory: false });
}

function getAllWorkspaceCatalogKeys() {
    const keys = new Set();
    getProjectWorkspaces().forEach((workspace) => {
        getWorkspaceResourceCatalog(workspace).forEach((resource) => {
            keys.add(getResourceRefKey({
                workspaceId: workspace.id,
                resourceType: resource.type,
                resourceId: resource.id
            }));
        });
    });
    return keys;
}

function hasResourceReference(reference) {
    const ref = normalizeResourceRef(reference);
    if (!ref.resourceType || !ref.resourceId) return false;

    if (ref.resourceType === 'report') {
        return Boolean(getReportById(ref.resourceId));
    }

    if (ref.resourceType === 'template') {
        return Boolean(getTemplateById(ref.resourceId) || (getUserTemplates() || []).find((item) => item.id === ref.resourceId));
    }

    const workspaceId = ref.workspaceId || normalizeText(appState.activeWorkspaceId);
    if (!workspaceId) return false;

    const catalog = getWorkspaceResourceCatalog(workspaceId);
    return catalog.some((item) => normalizeText(item.type).toLowerCase() === ref.resourceType && normalizeText(item.id) === ref.resourceId);
}

function getActiveResourceTarget(context = {}) {
    const source = context && typeof context === 'object' ? context : {};
    const explicitType = normalizeText(source.resourceType || source.type).toLowerCase();
    const explicitId = normalizeText(source.resourceId || source.id);
    const explicitWorkspaceId = normalizeText(source.workspaceId || appState.activeWorkspaceId);

    if (explicitType && explicitId) {
        return {
            resourceType: explicitType,
            resourceId: explicitId,
            workspaceId: explicitWorkspaceId
        };
    }

    const anchor = source.triggerElement instanceof HTMLElement
        ? source.triggerElement
        : source.anchorElement instanceof HTMLElement
            ? source.anchorElement
            : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

    const candidate = anchor?.closest?.('[data-resource-type][data-resource-id]');
    if (!(candidate instanceof HTMLElement)) return null;

    return {
        resourceType: normalizeText(candidate.getAttribute('data-resource-type')).toLowerCase(),
        resourceId: normalizeText(candidate.getAttribute('data-resource-id')),
        workspaceId: normalizeText(candidate.getAttribute('data-workspace-id') || appState.activeWorkspaceId)
    };
}

function isReservedTagName(name, reservedNames = []) {
    const normalized = normalizeText(name).toLowerCase();
    if (!normalized) return false;
    if (TAG_RESERVED_NAMES.has(normalized)) return true;
    return normalizeArray(reservedNames).map((item) => normalizeText(item).toLowerCase()).includes(normalized);
}

function validateTagName(name, options = {}) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
        return { ok: false, reason: 'missing-name', message: 'Tag name is required.' };
    }

    if (isReservedTagName(normalizedName, options.reservedNames)) {
        return { ok: false, reason: 'reserved-name', message: `Tag name ${normalizedName} is reserved.` };
    }

    const state = ensureOrganizationState();
    const ignoreId = normalizeText(options.ignoreId);
    const duplicate = state.tags.find((tag) => normalizeText(tag.name).toLowerCase() === normalizedName.toLowerCase() && normalizeText(tag.id) !== ignoreId);
    if (duplicate) {
        return { ok: false, reason: 'duplicate-name', message: `Tag ${normalizedName} already exists.` };
    }

    return { ok: true };
}

function normalizeCollectionName(name) {
    return normalizeText(name) || 'Collection';
}

function validateCollectionName(name, options = {}) {
    const normalizedName = normalizeCollectionName(name);
    const state = ensureOrganizationState();
    const ignoreId = normalizeText(options.ignoreId);
    const duplicate = state.collections.find((collection) => normalizeText(collection.name).toLowerCase() === normalizedName.toLowerCase() && normalizeText(collection.id) !== ignoreId);
    if (duplicate) {
        return { ok: false, reason: 'duplicate-name', message: `Collection ${normalizedName} already exists.` };
    }
    return { ok: true };
}

function validateSavedViewName(name, options = {}) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
        return { ok: false, reason: 'missing-name', message: 'Saved View name is required.' };
    }

    const state = ensureOrganizationState();
    const ignoreId = normalizeText(options.ignoreId);
    const scope = normalizeScope(options.scope || 'workspace', 'workspace');
    const workspaceId = normalizeText(options.workspaceId);
    const reportId = normalizeText(options.reportId);

    const duplicate = state.savedViews.find((view) => {
        if (normalizeText(view.id) === ignoreId) return false;
        if (normalizeText(view.name).toLowerCase() !== normalizedName.toLowerCase()) return false;
        if (normalizeScope(view.scope, 'workspace') !== scope) return false;
        if (scope === 'workspace' && normalizeText(view.workspaceId) !== workspaceId) return false;
        if (scope === 'report' && normalizeText(view.reportId) !== reportId) return false;
        return true;
    });

    if (duplicate) {
        return { ok: false, reason: 'duplicate-name', message: `Saved View ${normalizedName} already exists in this scope.` };
    }

    return { ok: true };
}

function updateRecentList(kind, id) {
    const state = ensureOrganizationState();
    const key = kind === 'savedViews' ? 'savedViews' : 'collections';
    const normalizedId = normalizeText(id);
    if (!normalizedId) return;

    state.recent[key] = [
        normalizedId,
        ...normalizeArray(state.recent[key]).filter((value) => normalizeText(value) !== normalizedId)
    ].slice(0, 50);
}

function buildTagUsage(tag) {
    const counts = {
        total: 0,
        byType: {}
    };

    normalizeArray(tag.assignments).forEach((assignment) => {
        const ref = normalizeResourceRef(assignment);
        if (!ref.resourceType || !ref.resourceId) return;
        counts.total += 1;
        counts.byType[ref.resourceType] = Number(counts.byType[ref.resourceType] || 0) + 1;
    });

    return counts;
}

export function getResourceOrganizationSnapshot() {
    return {
        ...ensureOrganizationState(),
        tags: ensureOrganizationState().tags.map((tag) => ({
            ...tag,
            usage: buildTagUsage(tag)
        }))
    };
}

export function getResourceTags(filters = {}) {
    const state = ensureOrganizationState();
    const scope = normalizeText(filters.scope).toLowerCase();
    const workspaceId = normalizeText(filters.workspaceId);
    const query = normalizeText(filters.query).toLowerCase();

    return state.tags
        .filter((tag) => !scope || normalizeScope(tag.scope) === scope)
        .filter((tag) => !workspaceId || normalizeText(tag.workspaceId) === workspaceId)
        .filter((tag) => !query || normalizeText(tag.name).toLowerCase().includes(query) || normalizeText(tag.description).toLowerCase().includes(query))
        .map((tag) => ({
            ...tag,
            usage: buildTagUsage(tag)
        }));
}

export function createTag(input = {}, options = {}) {
    const state = ensureOrganizationState();
    const payload = input && typeof input === 'object' ? input : {};
    const validation = validateTagName(payload.name, {
        reservedNames: options.reservedNames
    });
    if (!validation.ok) return validation;

    const scope = normalizeScope(payload.scope || options.scope || 'workspace', 'workspace');
    const workspaceId = normalizeText(payload.workspaceId || options.workspaceId || appState.activeWorkspaceId);
    const tag = normalizeTag({
        id: payload.id || createId('tag'),
        name: payload.name,
        description: payload.description,
        scope,
        color: payload.color,
        pluginSource: payload.pluginSource,
        reserved: payload.reserved === true,
        owner: payload.owner,
        workspaceId,
        metadata: payload.metadata,
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso(),
        assignments: []
    }, state.tags.length);

    state.tags.push(tag);
    saveOrganizationState(`Created tag ${tag.name}`);
    emitOrganizationEvent('Tag Created', { tagId: tag.id, name: tag.name });
    return { ok: true, tag };
}

export function updateTag(tagId, updates = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    const index = state.tags.findIndex((tag) => normalizeText(tag.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const current = state.tags[index];
    if (current.reserved && Object.prototype.hasOwnProperty.call(updates, 'name')) {
        return { ok: false, reason: 'reserved-tag' };
    }

    const nextName = Object.prototype.hasOwnProperty.call(updates, 'name')
        ? normalizeText(updates.name)
        : current.name;
    const validation = validateTagName(nextName, { ignoreId: id });
    if (!validation.ok) return validation;

    const next = normalizeTag({
        ...current,
        ...updates,
        id: current.id,
        name: nextName,
        updatedAt: nowIso(),
        assignments: normalizeArray(current.assignments)
    }, index);

    state.tags[index] = next;
    saveOrganizationState(`Updated tag ${next.name}`);
    emitOrganizationEvent('Tag Updated', { tagId: next.id, name: next.name });
    return { ok: true, tag: next };
}

export function deleteTag(tagId) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    const index = state.tags.findIndex((tag) => normalizeText(tag.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const target = state.tags[index];
    if (target.reserved) return { ok: false, reason: 'reserved-tag' };

    state.tags.splice(index, 1);
    state.favorites.tags = normalizeArray(state.favorites.tags).filter((value) => normalizeText(value) !== id);
    saveOrganizationState(`Deleted tag ${target.name}`);
    emitOrganizationEvent('Tag Deleted', { tagId: id, name: target.name });
    return { ok: true, removed: target };
}

export function mergeTags(sourceTagId, targetTagId) {
    const state = ensureOrganizationState();
    const sourceId = normalizeText(sourceTagId);
    const targetId = normalizeText(targetTagId);
    if (!sourceId || !targetId || sourceId === targetId) {
        return { ok: false, reason: 'invalid-merge' };
    }

    const sourceIndex = state.tags.findIndex((tag) => normalizeText(tag.id) === sourceId);
    const targetIndex = state.tags.findIndex((tag) => normalizeText(tag.id) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return { ok: false, reason: 'not-found' };

    const source = state.tags[sourceIndex];
    const target = state.tags[targetIndex];

    const mergedAssignments = dedupeBy(
        [
            ...normalizeArray(target.assignments),
            ...normalizeArray(source.assignments)
        ].map((item) => normalizeResourceRef(item)),
        (item) => getResourceRefKey(item)
    );

    state.tags[targetIndex] = {
        ...target,
        assignments: mergedAssignments,
        updatedAt: nowIso()
    };

    state.tags.splice(sourceIndex, 1);
    state.favorites.tags = normalizeArray(state.favorites.tags)
        .filter((value) => normalizeText(value) !== sourceId)
        .map((value) => normalizeText(value) === targetId ? targetId : normalizeText(value))
        .filter(Boolean);

    saveOrganizationState(`Merged tag ${source.name} into ${target.name}`);
    emitOrganizationEvent('Tags Merged', {
        sourceTagId: sourceId,
        targetTagId: targetId,
        sourceTagName: source.name,
        targetTagName: target.name
    });

    return {
        ok: true,
        source,
        target: state.tags[targetIndex]
    };
}

export function assignTagToResource(tagId, reference, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    const index = state.tags.findIndex((tag) => normalizeText(tag.id) === id);
    if (index < 0) return { ok: false, reason: 'tag-not-found' };

    const ref = normalizeResourceRef(reference);
    if (!ref.resourceType || !ref.resourceId) return { ok: false, reason: 'invalid-resource-reference' };

    const existing = normalizeArray(state.tags[index].assignments);
    const key = getResourceRefKey(ref);
    if (existing.some((item) => getResourceRefKey(item) === key)) {
        return { ok: true, tag: state.tags[index], assigned: false };
    }

    const unresolved = !hasResourceReference(ref);
    const nextAssignments = [...existing, { ...ref, unresolved }];
    state.tags[index] = {
        ...state.tags[index],
        assignments: nextAssignments,
        updatedAt: nowIso()
    };

    if (unresolved) {
        state.unresolvedReferences = dedupeBy([
            ...normalizeArray(state.unresolvedReferences),
            { ...ref, unresolved: true }
        ], (item) => getResourceRefKey(item));
    }

    if (options.persist !== false) {
        saveOrganizationState(`Assigned tag ${state.tags[index].name}`);
    }
    emitOrganizationEvent('Tag Assigned', {
        tagId: id,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        workspaceId: ref.workspaceId
    });
    return { ok: true, tag: state.tags[index], assigned: true };
}

export function removeTagFromResource(tagId, reference, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    const index = state.tags.findIndex((tag) => normalizeText(tag.id) === id);
    if (index < 0) return { ok: false, reason: 'tag-not-found' };

    const ref = normalizeResourceRef(reference);
    const key = getResourceRefKey(ref);

    const before = normalizeArray(state.tags[index].assignments);
    const after = before.filter((item) => getResourceRefKey(item) !== key);
    if (after.length === before.length) return { ok: true, removed: false };

    state.tags[index] = {
        ...state.tags[index],
        assignments: after,
        updatedAt: nowIso()
    };

    if (options.persist !== false) {
        saveOrganizationState(`Removed tag ${state.tags[index].name}`);
    }
    emitOrganizationEvent('Tag Removed', {
        tagId: id,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        workspaceId: ref.workspaceId
    });
    return { ok: true, removed: true, tag: state.tags[index] };
}

export function getTagAssignmentsForResource(reference) {
    const ref = normalizeResourceRef(reference);
    if (!ref.resourceType || !ref.resourceId) return [];

    const targetKey = getResourceRefKey(ref);
    return getResourceTags({}).filter((tag) => normalizeArray(tag.assignments).some((item) => getResourceRefKey(item) === targetKey));
}

export function getTagUsageCounts(tagId) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    const tag = state.tags.find((item) => normalizeText(item.id) === id);
    if (!tag) return null;
    return buildTagUsage(tag);
}

export function getCollections(filters = {}) {
    const state = ensureOrganizationState();
    const scope = normalizeText(filters.scope).toLowerCase();
    const workspaceId = normalizeText(filters.workspaceId);
    const query = normalizeText(filters.query).toLowerCase();

    return state.collections
        .filter((collection) => !scope || normalizeScope(collection.scope) === scope)
        .filter((collection) => !workspaceId || normalizeText(collection.workspaceId) === workspaceId)
        .filter((collection) => !query || normalizeText(collection.name).toLowerCase().includes(query) || normalizeText(collection.description).toLowerCase().includes(query))
        .map((collection) => ({
            ...collection,
            resourceCount: normalizeArray(collection.resourceRefs).length
        }));
}

export function createCollection(input = {}) {
    const state = ensureOrganizationState();
    const payload = input && typeof input === 'object' ? input : {};
    const validation = validateCollectionName(payload.name);
    if (!validation.ok) return validation;

    const collection = normalizeCollection({
        id: payload.id || createId('collection'),
        name: payload.name,
        description: payload.description,
        scope: payload.scope || 'workspace',
        type: payload.type || payload.collectionType || 'standard',
        parentCollectionId: payload.parentCollectionId,
        pluginSource: payload.pluginSource,
        reserved: payload.reserved === true,
        owner: payload.owner,
        workspaceId: payload.workspaceId || appState.activeWorkspaceId,
        metadata: payload.metadata,
        resourceRefs: payload.resourceRefs || [],
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso()
    }, state.collections.length);

    state.collections.push(collection);
    saveOrganizationState(`Created collection ${collection.name}`);
    emitOrganizationEvent('Collection Created', { collectionId: collection.id, name: collection.name });
    return { ok: true, collection };
}

export function updateCollection(collectionId, updates = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    const index = state.collections.findIndex((collection) => normalizeText(collection.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const current = state.collections[index];
    if (current.reserved && Object.prototype.hasOwnProperty.call(updates, 'name')) {
        return { ok: false, reason: 'reserved-collection' };
    }

    const nextName = Object.prototype.hasOwnProperty.call(updates, 'name') ? normalizeCollectionName(updates.name) : current.name;
    const validation = validateCollectionName(nextName, { ignoreId: current.id });
    if (!validation.ok) return validation;

    const next = normalizeCollection({
        ...current,
        ...updates,
        id: current.id,
        name: nextName,
        updatedAt: nowIso()
    }, index);

    state.collections[index] = next;
    saveOrganizationState(`Updated collection ${next.name}`);
    emitOrganizationEvent('Collection Updated', { collectionId: next.id, name: next.name });
    return { ok: true, collection: next };
}

export function deleteCollection(collectionId) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    const index = state.collections.findIndex((collection) => normalizeText(collection.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const target = state.collections[index];
    if (target.reserved) return { ok: false, reason: 'reserved-collection' };

    state.collections.splice(index, 1);
    state.collections = state.collections.map((collection) => (
        normalizeText(collection.parentCollectionId) === id
            ? { ...collection, parentCollectionId: '', updatedAt: nowIso() }
            : collection
    ));

    state.favorites.collections = normalizeArray(state.favorites.collections).filter((value) => normalizeText(value) !== id);
    state.recent.collections = normalizeArray(state.recent.collections).filter((value) => normalizeText(value) !== id);
    saveOrganizationState(`Deleted collection ${target.name}`);
    emitOrganizationEvent('Collection Deleted', { collectionId: id, name: target.name });
    return { ok: true, removed: target };
}

export function duplicateCollection(collectionId, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    const original = state.collections.find((collection) => normalizeText(collection.id) === id);
    if (!original) return { ok: false, reason: 'not-found' };

    const nextName = normalizeText(options.name) || `${original.name} Copy`;
    const validation = validateCollectionName(nextName);
    if (!validation.ok) return validation;

    const duplicate = normalizeCollection({
        ...original,
        id: createId('collection'),
        name: nextName,
        parentCollectionId: '',
        reserved: false,
        createdAt: nowIso(),
        updatedAt: nowIso()
    }, state.collections.length);

    state.collections.push(duplicate);
    saveOrganizationState(`Duplicated collection ${original.name}`);
    emitOrganizationEvent('Collection Created', { collectionId: duplicate.id, name: duplicate.name, sourceCollectionId: id });
    return { ok: true, collection: duplicate };
}

export function addResourceToCollection(collectionId, reference, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    const index = state.collections.findIndex((collection) => normalizeText(collection.id) === id);
    if (index < 0) return { ok: false, reason: 'collection-not-found' };

    const ref = normalizeResourceRef(reference);
    if (!ref.resourceType || !ref.resourceId) return { ok: false, reason: 'invalid-resource-reference' };

    const existing = normalizeArray(state.collections[index].resourceRefs);
    const key = getResourceRefKey(ref);
    if (existing.some((item) => getResourceRefKey(item) === key)) {
        return { ok: true, added: false };
    }

    const unresolved = !hasResourceReference(ref);
    state.collections[index] = {
        ...state.collections[index],
        resourceRefs: [...existing, { ...ref, unresolved }],
        updatedAt: nowIso()
    };

    if (unresolved) {
        state.unresolvedReferences = dedupeBy([
            ...normalizeArray(state.unresolvedReferences),
            { ...ref, unresolved: true }
        ], (item) => getResourceRefKey(item));
    }

    updateRecentList('collections', id);
    if (options.persist !== false) saveOrganizationState(`Added resource to collection ${state.collections[index].name}`);
    emitOrganizationEvent('Collection Resource Added', {
        collectionId: id,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        workspaceId: ref.workspaceId
    });

    return { ok: true, added: true, collection: state.collections[index] };
}

export function removeResourceFromCollection(collectionId, reference, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    const index = state.collections.findIndex((collection) => normalizeText(collection.id) === id);
    if (index < 0) return { ok: false, reason: 'collection-not-found' };

    const ref = normalizeResourceRef(reference);
    const key = getResourceRefKey(ref);

    const before = normalizeArray(state.collections[index].resourceRefs);
    const after = before.filter((item) => getResourceRefKey(item) !== key);
    if (after.length === before.length) return { ok: true, removed: false };

    state.collections[index] = {
        ...state.collections[index],
        resourceRefs: after,
        updatedAt: nowIso()
    };

    if (options.persist !== false) saveOrganizationState(`Removed resource from collection ${state.collections[index].name}`);
    emitOrganizationEvent('Collection Resource Removed', {
        collectionId: id,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        workspaceId: ref.workspaceId
    });

    return { ok: true, removed: true, collection: state.collections[index] };
}

export function getCollectionMembershipForResource(reference) {
    const ref = normalizeResourceRef(reference);
    const key = getResourceRefKey(ref);
    return getCollections({}).filter((collection) => normalizeArray(collection.resourceRefs).some((item) => getResourceRefKey(item) === key));
}

export function getSavedViews(filters = {}) {
    const state = ensureOrganizationState();
    const scope = normalizeText(filters.scope).toLowerCase();
    const workspaceId = normalizeText(filters.workspaceId);
    const reportId = normalizeText(filters.reportId);
    const query = normalizeText(filters.query).toLowerCase();

    return state.savedViews
        .filter((view) => !scope || normalizeScope(view.scope) === scope)
        .filter((view) => !workspaceId || normalizeText(view.workspaceId) === workspaceId)
        .filter((view) => !reportId || normalizeText(view.reportId) === reportId)
        .filter((view) => !query || normalizeText(view.name).toLowerCase().includes(query) || normalizeText(view.description).toLowerCase().includes(query));
}

function summarizeSavedViewConfig(config = {}) {
    const source = config && typeof config === 'object' ? config : {};
    const mode = normalizeText(source.mode || 'working') || 'working';
    const grouped = normalizeArray(source.groupBy).map((item) => normalizeText(item)).filter(Boolean);
    const sorted = normalizeArray(source.sortLevels)
        .map((item) => normalizeText(item?.field))
        .filter(Boolean);
    const filters = source.filters && typeof source.filters === 'object'
        ? Object.entries(source.filters).filter(([, value]) => normalizeText(value)).map(([key]) => key)
        : [];

    return [
        `Mode ${mode}`,
        grouped.length > 0 ? `Groups ${grouped.join(', ')}` : '',
        sorted.length > 0 ? `Sort ${sorted.join(', ')}` : '',
        filters.length > 0 ? `Filters ${filters.join(', ')}` : ''
    ].filter(Boolean).join(' | ');
}

export function createSavedView(input = {}) {
    const state = ensureOrganizationState();
    const payload = input && typeof input === 'object' ? input : {};
    const scope = normalizeScope(payload.scope || 'workspace', 'workspace');
    const workspaceId = normalizeText(payload.workspaceId || appState.activeWorkspaceId);
    const reportId = normalizeText(payload.reportId || appState.selectedReportId);

    const validation = validateSavedViewName(payload.name, {
        scope,
        workspaceId,
        reportId
    });
    if (!validation.ok) return validation;

    const view = normalizeSavedView({
        id: payload.id || createId('saved-view'),
        name: payload.name,
        description: payload.description,
        scope,
        resourceType: payload.resourceType || 'report',
        workspaceId,
        reportId,
        pluginSource: payload.pluginSource,
        reserved: payload.reserved === true,
        owner: payload.owner,
        config: payload.config && typeof payload.config === 'object' ? { ...payload.config } : {},
        configurationSummary: summarizeSavedViewConfig(payload.config),
        metadata: payload.metadata,
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso()
    }, state.savedViews.length);

    state.savedViews.push(view);
    saveOrganizationState(`Created Saved View ${view.name}`);
    emitOrganizationEvent('Saved View Created', {
        savedViewId: view.id,
        name: view.name
    });

    return { ok: true, savedView: view };
}

export function updateSavedView(savedViewId, updates = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(savedViewId);
    const index = state.savedViews.findIndex((view) => normalizeText(view.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const current = state.savedViews[index];
    if (current.reserved && Object.prototype.hasOwnProperty.call(updates, 'name')) {
        return { ok: false, reason: 'reserved-saved-view' };
    }

    const nextName = Object.prototype.hasOwnProperty.call(updates, 'name') ? normalizeText(updates.name) : current.name;
    const validation = validateSavedViewName(nextName, {
        ignoreId: current.id,
        scope: updates.scope || current.scope,
        workspaceId: updates.workspaceId || current.workspaceId,
        reportId: updates.reportId || current.reportId
    });
    if (!validation.ok) return validation;

    const nextConfig = updates.config && typeof updates.config === 'object'
        ? { ...updates.config }
        : current.config;

    const next = normalizeSavedView({
        ...current,
        ...updates,
        id: current.id,
        name: nextName,
        config: nextConfig,
        configurationSummary: summarizeSavedViewConfig(nextConfig),
        updatedAt: nowIso()
    }, index);

    state.savedViews[index] = next;
    saveOrganizationState(`Updated Saved View ${next.name}`);
    emitOrganizationEvent('Saved View Updated', {
        savedViewId: next.id,
        name: next.name
    });

    return { ok: true, savedView: next };
}

export function duplicateSavedView(savedViewId, options = {}) {
    const state = ensureOrganizationState();
    const id = normalizeText(savedViewId);
    const source = state.savedViews.find((view) => normalizeText(view.id) === id);
    if (!source) return { ok: false, reason: 'not-found' };

    const name = normalizeText(options.name) || `${source.name} Copy`;
    const validation = validateSavedViewName(name, {
        scope: source.scope,
        workspaceId: source.workspaceId,
        reportId: source.reportId
    });
    if (!validation.ok) return validation;

    const duplicate = normalizeSavedView({
        ...source,
        id: createId('saved-view'),
        name,
        reserved: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastOpenedAt: ''
    }, state.savedViews.length);

    state.savedViews.push(duplicate);
    saveOrganizationState(`Duplicated Saved View ${source.name}`);
    emitOrganizationEvent('Saved View Created', {
        savedViewId: duplicate.id,
        name: duplicate.name,
        sourceSavedViewId: source.id
    });

    return { ok: true, savedView: duplicate };
}

export function deleteSavedView(savedViewId) {
    const state = ensureOrganizationState();
    const id = normalizeText(savedViewId);
    const index = state.savedViews.findIndex((view) => normalizeText(view.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const target = state.savedViews[index];
    if (target.reserved) return { ok: false, reason: 'reserved-saved-view' };

    state.savedViews.splice(index, 1);
    state.favorites.savedViews = normalizeArray(state.favorites.savedViews).filter((value) => normalizeText(value) !== id);
    state.recent.savedViews = normalizeArray(state.recent.savedViews).filter((value) => normalizeText(value) !== id);

    saveOrganizationState(`Deleted Saved View ${target.name}`);
    emitOrganizationEvent('Saved View Deleted', {
        savedViewId: id,
        name: target.name
    });

    return { ok: true, removed: target };
}

export function openSavedView(savedViewId) {
    const state = ensureOrganizationState();
    const id = normalizeText(savedViewId);
    const index = state.savedViews.findIndex((view) => normalizeText(view.id) === id);
    if (index < 0) return { ok: false, reason: 'not-found' };

    const savedView = state.savedViews[index];
    const openResult = openWorkingViewFromCommand({
        reportId: savedView.reportId,
        config: {
            ...(savedView.config || {}),
            name: savedView.name,
            temporary: true
        },
        showConfig: false
    });

    if (!openResult) return { ok: false, reason: 'open-failed' };

    state.savedViews[index] = {
        ...savedView,
        updatedAt: nowIso(),
        lastOpenedAt: nowIso()
    };
    updateRecentList('savedViews', savedView.id);
    saveOrganizationState(`Opened Saved View ${savedView.name}`);

    emitOrganizationEvent('Saved View Opened', {
        savedViewId: savedView.id,
        name: savedView.name,
        reportId: savedView.reportId
    });

    return { ok: true, savedView: state.savedViews[index] };
}

export function createSavedViewFromCurrentWorkingView(options = {}) {
    const snapshot = getActiveWorkingViewSessionSnapshot();
    if (!snapshot || !snapshot.config || !snapshot.reportId) {
        return { ok: false, reason: 'no-active-working-view' };
    }

    return createSavedView({
        name: options.name || snapshot.config.name || 'Saved Working View',
        description: options.description || '',
        scope: options.scope || 'workspace',
        workspaceId: options.workspaceId || appState.activeWorkspaceId,
        reportId: options.reportId || snapshot.reportId,
        resourceType: 'report',
        config: {
            ...snapshot.config,
            temporary: true
        }
    });
}

export function toggleFavorite(itemType, itemId) {
    const state = ensureOrganizationState();
    const normalizedType = normalizeText(itemType).toLowerCase();
    const id = normalizeText(itemId);
    if (!id) return { ok: false, reason: 'missing-id' };

    let key = '';
    if (normalizedType === 'tag' || normalizedType === 'tags') key = 'tags';
    if (normalizedType === 'collection' || normalizedType === 'collections') key = 'collections';
    if (normalizedType === 'saved-view' || normalizedType === 'savedview' || normalizedType === 'savedviews' || normalizedType === 'saved-views') key = 'savedViews';
    if (!key) return { ok: false, reason: 'invalid-type' };

    const current = new Set(normalizeArray(state.favorites[key]).map((value) => normalizeText(value)).filter(Boolean));
    if (current.has(id)) {
        current.delete(id);
    } else {
        current.add(id);
    }

    state.favorites[key] = [...current];
    saveOrganizationState(`Updated ${normalizedType} favorites`);

    emitOrganizationEvent('Favorites Updated', {
        itemType: key,
        count: state.favorites[key].length
    });

    return { ok: true, favorites: state.favorites[key] };
}

export function replaceOrganizationResourceReferences(resourceType, oldResourceId, newResourceId, workspaceId = '') {
    const state = ensureOrganizationState();
    const normalizedType = normalizeText(resourceType).toLowerCase();
    const oldId = normalizeText(oldResourceId);
    const nextId = normalizeText(newResourceId);
    const workspace = normalizeText(workspaceId || appState.activeWorkspaceId);

    if (!normalizedType || !oldId || !nextId || oldId === nextId) {
        return { ok: false, replacedCount: 0 };
    }

    let replacedCount = 0;
    const replaceRef = (reference) => {
        const ref = normalizeResourceRef(reference);
        const typeMatch = ref.resourceType === normalizedType;
        const idMatch = normalizeText(ref.resourceId) === oldId;
        const workspaceMatch = !workspace || !normalizeText(ref.workspaceId) || normalizeText(ref.workspaceId) === workspace;
        if (!(typeMatch && idMatch && workspaceMatch)) return ref;
        replacedCount += 1;
        return {
            ...ref,
            resourceId: nextId,
            unresolved: false
        };
    };

    state.tags = state.tags.map((tag) => ({
        ...tag,
        assignments: normalizeArray(tag.assignments).map((reference) => replaceRef(reference)),
        updatedAt: nowIso()
    }));

    state.collections = state.collections.map((collection) => ({
        ...collection,
        resourceRefs: normalizeArray(collection.resourceRefs).map((reference) => replaceRef(reference)),
        updatedAt: nowIso()
    }));

    if (replacedCount > 0) {
        reconcileResourceOrganizationIntegrity({ keepUnresolved: true });
        saveOrganizationState('Updated resource organization references after resource replacement');
        emitOrganizationEvent('Resource References Replaced', {
            resourceType: normalizedType,
            oldResourceId: oldId,
            newResourceId: nextId,
            replacedCount
        });
    }

    return {
        ok: true,
        replacedCount
    };
}

function shouldExposeItemByScope(item, workspaceId, reportId) {
    const scope = normalizeScope(item.scope, 'workspace');
    if (scope === 'application' || scope === 'organization') return true;
    if (scope === 'workspace') return normalizeText(item.workspaceId) === normalizeText(workspaceId);
    if (scope === 'report') return normalizeText(item.reportId) === normalizeText(reportId);
    return true;
}

export function getExplorerOrganizationSections(workspaceId, reportId = '') {
    const state = ensureOrganizationState();
    const activeWorkspaceId = normalizeText(workspaceId || appState.activeWorkspaceId);
    const activeReportId = normalizeText(reportId || appState.selectedReportId);

    const visibleTags = state.tags
        .filter((tag) => shouldExposeItemByScope(tag, activeWorkspaceId, activeReportId))
        .map((tag) => ({
            ...tag,
            resources: normalizeArray(tag.assignments)
                .filter((assignment) => !activeWorkspaceId || normalizeText(assignment.workspaceId) === activeWorkspaceId || !normalizeText(assignment.workspaceId))
        }))
        .filter((tag) => tag.resources.length > 0 || tag.scope !== 'report');

    const visibleCollections = state.collections
        .filter((collection) => shouldExposeItemByScope(collection, activeWorkspaceId, activeReportId))
        .map((collection) => ({
            ...collection,
            resources: normalizeArray(collection.resourceRefs)
                .filter((reference) => !activeWorkspaceId || normalizeText(reference.workspaceId) === activeWorkspaceId || !normalizeText(reference.workspaceId)),
            resourceCount: normalizeArray(collection.resourceRefs).length
        }));

    const visibleSavedViews = state.savedViews
        .filter((savedView) => shouldExposeItemByScope(savedView, activeWorkspaceId, activeReportId));

    return {
        tags: visibleTags,
        collections: visibleCollections,
        savedViews: visibleSavedViews,
        favorites: {
            tags: normalizeArray(state.favorites.tags),
            collections: normalizeArray(state.favorites.collections),
            savedViews: normalizeArray(state.favorites.savedViews)
        },
        recent: {
            collections: normalizeArray(state.recent.collections),
            savedViews: normalizeArray(state.recent.savedViews)
        }
    };
}

function parseStructuredClauses(query) {
    const text = normalizeText(query);
    const clauses = {
        tags: [],
        collections: [],
        views: []
    };

    const regex = /(tag|collection|view):(?:"([^"]+)"|(\S+))/gi;
    let match = regex.exec(text);
    while (match) {
        const key = normalizeText(match[1]).toLowerCase();
        const value = normalizeText(match[2] || match[3]).toLowerCase();
        if (value) {
            if (key === 'tag') clauses.tags.push(value);
            if (key === 'collection') clauses.collections.push(value);
            if (key === 'view') clauses.views.push(value);
        }
        match = regex.exec(text);
    }

    const freeText = text.replace(regex, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return {
        ...clauses,
        freeText
    };
}

function scoreLabelMatch(label, query) {
    const target = normalizeText(label).toLowerCase();
    const search = normalizeText(query).toLowerCase();
    if (!search) return 20;
    if (target === search) return 0.2;
    if (target.startsWith(search)) return 0.8;
    if (target.includes(search)) return 1.3;
    return 3;
}

function resolveResourceName(reference) {
    const ref = normalizeResourceRef(reference);
    if (ref.resourceType === 'report') {
        return getReportById(ref.resourceId)?.name || ref.resourceId;
    }
    if (ref.resourceType === 'template') {
        return getTemplateById(ref.resourceId)?.name || ref.resourceId;
    }

    const workspaceId = normalizeText(ref.workspaceId || appState.activeWorkspaceId);
    if (!workspaceId) return ref.resourceId;
    const resource = getWorkspaceResourceCatalog(workspaceId).find((item) => normalizeText(item.type).toLowerCase() === ref.resourceType && normalizeText(item.id) === ref.resourceId);
    return resource?.name || ref.resourceId;
}

export function searchOrganizationMetadata(queryModel, context = {}) {
    const query = queryModel?.raw || '';
    const parsed = parseStructuredClauses(query);
    const state = ensureOrganizationState();
    const results = [];

    const matchesFreeText = (parts) => {
        if (!parsed.freeText) return true;
        return parts.some((part) => normalizeText(part).toLowerCase().includes(parsed.freeText));
    };

    const tagMatches = state.tags.filter((tag) => {
        const name = normalizeText(tag.name).toLowerCase();
        const clauseMatch = parsed.tags.length === 0 || parsed.tags.some((item) => name.includes(item));
        return clauseMatch && matchesFreeText([tag.name, tag.description, tag.scope]);
    });

    tagMatches.forEach((tag) => {
        results.push({
            id: `resource-tag:${tag.id}`,
            type: 'resource-tag',
            title: tag.name,
            subtitle: `Tag | ${tag.scope}`,
            description: tag.description || `Used by ${buildTagUsage(tag).total} resource(s)`,
            score: scoreLabelMatch(tag.name, parsed.freeText || parsed.tags[0] || queryModel?.normalized || ''),
            matchType: 'tag',
            tagId: tag.id,
            raw: { tag }
        });

        if (parsed.tags.length > 0) {
            normalizeArray(tag.assignments).forEach((reference) => {
                const resourceName = resolveResourceName(reference);
                results.push({
                    id: `resource-tag-resource:${tag.id}:${getResourceRefKey(reference)}`,
                    type: 'resource-match',
                    title: resourceName,
                    subtitle: `Matched By Tag | ${tag.name}`,
                    description: normalizeText(reference.resourceType),
                    score: 1.1,
                    matchType: 'tag-resource',
                    raw: {
                        reference,
                        tag
                    }
                });
            });
        }
    });

    const collectionMatches = state.collections.filter((collection) => {
        const name = normalizeText(collection.name).toLowerCase();
        const clauseMatch = parsed.collections.length === 0 || parsed.collections.some((item) => name.includes(item));
        return clauseMatch && matchesFreeText([collection.name, collection.description, collection.scope]);
    });

    collectionMatches.forEach((collection) => {
        results.push({
            id: `resource-collection:${collection.id}`,
            type: 'resource-collection',
            title: collection.name,
            subtitle: `Collection | ${collection.scope}`,
            description: collection.description || `${normalizeArray(collection.resourceRefs).length} resource(s)`,
            score: scoreLabelMatch(collection.name, parsed.freeText || parsed.collections[0] || queryModel?.normalized || ''),
            matchType: 'collection',
            collectionId: collection.id,
            raw: { collection }
        });

        if (parsed.collections.length > 0) {
            normalizeArray(collection.resourceRefs).forEach((reference) => {
                const resourceName = resolveResourceName(reference);
                results.push({
                    id: `resource-collection-resource:${collection.id}:${getResourceRefKey(reference)}`,
                    type: 'resource-match',
                    title: resourceName,
                    subtitle: `Matched By Collection | ${collection.name}`,
                    description: normalizeText(reference.resourceType),
                    score: 1.2,
                    matchType: 'collection-resource',
                    raw: {
                        reference,
                        collection
                    }
                });
            });
        }
    });

    const viewMatches = state.savedViews.filter((savedView) => {
        const name = normalizeText(savedView.name).toLowerCase();
        const clauseMatch = parsed.views.length === 0 || parsed.views.some((item) => name.includes(item));
        return clauseMatch && matchesFreeText([savedView.name, savedView.description, savedView.scope, savedView.configurationSummary]);
    });

    viewMatches.forEach((savedView) => {
        results.push({
            id: `resource-saved-view:${savedView.id}`,
            type: 'resource-saved-view',
            title: savedView.name,
            subtitle: `Saved View | ${savedView.scope}`,
            description: savedView.description || savedView.configurationSummary || 'Saved Working View configuration',
            score: scoreLabelMatch(savedView.name, parsed.freeText || parsed.views[0] || queryModel?.normalized || ''),
            matchType: 'saved-view',
            savedViewId: savedView.id,
            raw: { savedView }
        });
    });

    return results;
}

export function executeOrganizationSearchResult(result) {
    const item = result?.raw ? result : result?.result;
    const type = normalizeText(item?.type);

    if (type === 'resource-saved-view' && item?.raw?.savedView?.id) {
        return openSavedView(item.raw.savedView.id).ok;
    }

    if (type === 'resource-collection' && item?.raw?.collection?.id) {
        const opened = openCollectionFromCommand({ collectionId: item.raw.collection.id });
        return Boolean(opened);
    }

    if (type === 'resource-tag' && item?.raw?.tag?.id) {
        const opened = openTagManagerFromCommand({ selectedTagId: item.raw.tag.id });
        return Boolean(opened);
    }

    if (type === 'resource-match' && item?.raw?.reference) {
        window.dispatchEvent(new CustomEvent('art-resource-organization-reveal-resource', {
            detail: {
                reference: normalizeResourceRef(item.raw.reference)
            }
        }));
        return true;
    }

    return false;
}

function getCollectionById(collectionId) {
    const state = ensureOrganizationState();
    const id = normalizeText(collectionId);
    return state.collections.find((collection) => normalizeText(collection.id) === id) || null;
}

function getTagById(tagId) {
    const state = ensureOrganizationState();
    const id = normalizeText(tagId);
    return state.tags.find((tag) => normalizeText(tag.id) === id) || null;
}

function getSavedViewById(savedViewId) {
    const state = ensureOrganizationState();
    const id = normalizeText(savedViewId);
    return state.savedViews.find((savedView) => normalizeText(savedView.id) === id) || null;
}

function promptSelectFromList(title, items, formatter) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const list = items.map((item, index) => `${index + 1}. ${formatter(item, index)}`).join('\n');
    const selected = Number(window.prompt(`${title}\n${list}`, '1'));
    if (!Number.isInteger(selected) || selected < 1 || selected > items.length) return null;
    return items[selected - 1];
}

export function openTagManagerFromCommand(options = {}) {
    ensureOrganizationState();
    const query = normalizeText(window.prompt('Tag Manager search (leave blank to show all)', options.query || ''));
    const tags = getResourceTags({ query });
    if (!tags.length) {
        announce('No tags are available for the current filter.');
        return false;
    }

    const selected = promptSelectFromList(
        'Tag Manager: select a tag to view usage',
        tags,
        (tag) => `${tag.name} | ${tag.scope} | ${buildTagUsage(tag).total} resource(s)`
    );

    if (!selected) return false;
    const usage = buildTagUsage(selected);
    const action = normalizeText(window.prompt('Tag Manager action: view, rename, delete, merge, favorite', 'view')).toLowerCase();

    if (!action || action === 'view') {
        announce(`${selected.name}. Used by ${usage.total} resource(s).`);
        return true;
    }

    if (action === 'rename') {
        const nextName = normalizeText(window.prompt('Rename tag', selected.name));
        if (!nextName || nextName === selected.name) return false;
        const result = updateTag(selected.id, { name: nextName });
        if (!result.ok) {
            announce(result.message || 'Tag rename failed.');
            return false;
        }
        announce(`Renamed tag to ${result.tag.name}.`);
        return true;
    }

    if (action === 'delete') {
        const confirmed = window.confirm(`Delete tag ${selected.name}?`);
        if (!confirmed) return false;
        const result = deleteTag(selected.id);
        if (!result.ok) {
            announce('Tag deletion failed.');
            return false;
        }
        announce(`Deleted tag ${selected.name}.`);
        return true;
    }

    if (action === 'merge') {
        const candidates = tags.filter((tag) => tag.id !== selected.id);
        if (!candidates.length) {
            announce('No target tags are available for merge.');
            return false;
        }
        const target = promptSelectFromList('Select merge target tag', candidates, (tag) => tag.name);
        if (!target) return false;
        const result = mergeTags(selected.id, target.id);
        if (!result.ok) {
            announce('Tag merge failed.');
            return false;
        }
        announce(`Merged ${selected.name} into ${target.name}.`);
        return true;
    }

    if (action === 'favorite') {
        const toggled = toggleFavorite('tag', selected.id);
        if (!toggled.ok) return false;
        announce('Tag favorite updated.');
        return true;
    }

    announce('Unsupported Tag Manager action.');
    return false;
}

export function createTagFromCommand() {
    const name = normalizeText(window.prompt('Create Tag name', ''));
    if (!name) return false;
    const description = normalizeText(window.prompt('Tag description (optional)', ''));
    const scopeInput = normalizeText(window.prompt('Tag scope: resource, report, workspace, application, organization', 'workspace')).toLowerCase();
    const color = normalizeText(window.prompt('Tag color (optional, visual only)', ''));

    const result = createTag({
        name,
        description,
        scope: scopeInput,
        color,
        workspaceId: appState.activeWorkspaceId
    });

    if (!result.ok) {
        announce(result.message || 'Tag could not be created.');
        return false;
    }

    announce(`Created tag ${result.tag.name}.`);
    return true;
}

export function assignTagToSelectedResourceFromCommand(context = {}) {
    const target = getActiveResourceTarget(context);
    if (!target) {
        announce('Select a resource before assigning tags.');
        return false;
    }

    const tags = getResourceTags({});
    if (!tags.length) {
        announce('Create a tag before assigning one.');
        return false;
    }

    const selected = promptSelectFromList('Assign tag: choose a tag', tags, (tag) => `${tag.name} (${tag.scope})`);
    if (!selected) return false;

    const result = assignTagToResource(selected.id, target);
    if (!result.ok) {
        announce('Tag assignment failed.');
        return false;
    }

    announce(`Assigned tag ${selected.name}.`);
    return true;
}

export function removeTagFromSelectedResourceFromCommand(context = {}) {
    const target = getActiveResourceTarget(context);
    if (!target) {
        announce('Select a resource before removing tags.');
        return false;
    }

    const tags = getTagAssignmentsForResource(target);
    if (!tags.length) {
        announce('No assigned tags were found for the selected resource.');
        return false;
    }

    const selected = promptSelectFromList('Remove tag: choose a tag', tags, (tag) => `${tag.name}`);
    if (!selected) return false;

    const result = removeTagFromResource(selected.id, target);
    if (!result.ok) {
        announce('Tag removal failed.');
        return false;
    }

    announce(`Removed tag ${selected.name}.`);
    return true;
}

export function mergeTagsFromCommand() {
    const tags = getResourceTags({});
    if (tags.length < 2) {
        announce('At least two tags are required for merge.');
        return false;
    }

    const source = promptSelectFromList('Merge tags: select source tag', tags, (tag) => tag.name);
    if (!source) return false;

    const targetOptions = tags.filter((tag) => tag.id !== source.id);
    const target = promptSelectFromList('Merge tags: select target tag', targetOptions, (tag) => tag.name);
    if (!target) return false;

    const result = mergeTags(source.id, target.id);
    if (!result.ok) {
        announce('Tag merge failed.');
        return false;
    }

    announce(`Merged ${source.name} into ${target.name}.`);
    return true;
}

export function openCollectionManagerFromCommand(options = {}) {
    ensureOrganizationState();
    const query = normalizeText(window.prompt('Collection Manager search (leave blank to show all)', options.query || ''));
    const collections = getCollections({ query, workspaceId: appState.activeWorkspaceId });
    if (!collections.length) {
        announce('No collections are available for the current filter.');
        return false;
    }

    const selected = promptSelectFromList('Collection Manager: choose collection', collections, (collection) => `${collection.name} | ${collection.scope} | ${collection.resourceCount} resource(s)`);
    if (!selected) return false;

    const isFavorite = normalizeOrganizationState(appState.resourceOrganization).favorites.collections.includes(selected.id);
    const action = normalizeText(window.prompt('Collection Manager action: view, rename, duplicate, delete, favorite', 'view')).toLowerCase();

    if (!action || action === 'view') {
        announce(`${selected.name}. ${selected.resourceCount} resources. ${isFavorite ? 'Favorite.' : 'Not favorite.'}`);
        return true;
    }

    if (action === 'rename') {
        const nextName = normalizeText(window.prompt('Rename collection', selected.name));
        if (!nextName || nextName === selected.name) return false;
        const result = updateCollection(selected.id, { name: nextName });
        if (!result.ok) {
            announce(result.message || 'Collection rename failed.');
            return false;
        }
        announce(`Renamed collection to ${result.collection.name}.`);
        return true;
    }

    if (action === 'duplicate') {
        const result = duplicateCollection(selected.id);
        if (!result.ok) {
            announce('Collection duplication failed.');
            return false;
        }
        announce(`Duplicated collection as ${result.collection.name}.`);
        return true;
    }

    if (action === 'delete') {
        const confirmed = window.confirm(`Delete collection ${selected.name}? Resources will remain unchanged.`);
        if (!confirmed) return false;
        const result = deleteCollection(selected.id);
        if (!result.ok) {
            announce('Collection deletion failed.');
            return false;
        }
        announce(`Deleted collection ${selected.name}.`);
        return true;
    }

    if (action === 'favorite') {
        const toggled = toggleFavorite('collection', selected.id);
        if (!toggled.ok) return false;
        announce('Collection favorite updated.');
        return true;
    }

    announce('Unsupported Collection Manager action.');
    return false;
}

export function createCollectionFromCommand() {
    const name = normalizeText(window.prompt('Create Collection name', ''));
    if (!name) return false;
    const description = normalizeText(window.prompt('Collection description (optional)', ''));
    const scopeInput = normalizeText(window.prompt('Collection scope: workspace, application, organization', 'workspace')).toLowerCase();

    const result = createCollection({
        name,
        description,
        scope: scopeInput,
        workspaceId: appState.activeWorkspaceId,
        type: 'standard'
    });

    if (!result.ok) {
        announce(result.message || 'Collection could not be created.');
        return false;
    }

    announce(`Created collection ${result.collection.name}.`);
    return true;
}

export function addSelectedResourceToCollectionFromCommand(context = {}) {
    const target = getActiveResourceTarget(context);
    if (!target) {
        announce('Select a resource before adding to a collection.');
        return false;
    }

    const collections = getCollections({ workspaceId: appState.activeWorkspaceId });
    if (!collections.length) {
        announce('Create a collection before adding resources.');
        return false;
    }

    const selected = promptSelectFromList('Add to collection: choose collection', collections, (collection) => `${collection.name} (${collection.resourceCount} resources)`);
    if (!selected) return false;

    const result = addResourceToCollection(selected.id, target);
    if (!result.ok) {
        announce('Collection membership update failed.');
        return false;
    }

    announce(result.added ? `Added resource to ${selected.name}.` : `Resource is already in ${selected.name}.`);
    return true;
}

export function removeSelectedResourceFromCollectionFromCommand(context = {}) {
    const target = getActiveResourceTarget(context);
    if (!target) {
        announce('Select a resource before removing from a collection.');
        return false;
    }

    const memberships = getCollectionMembershipForResource(target);
    if (!memberships.length) {
        announce('The selected resource is not in any collection.');
        return false;
    }

    const selected = promptSelectFromList('Remove from collection: choose collection', memberships, (collection) => collection.name);
    if (!selected) return false;

    const result = removeResourceFromCollection(selected.id, target);
    if (!result.ok) {
        announce('Collection membership removal failed.');
        return false;
    }

    announce(result.removed ? `Removed resource from ${selected.name}.` : `Resource is not a member of ${selected.name}.`);
    return true;
}

export function openCollectionFromCommand(context = {}) {
    const collectionId = normalizeText(context.collectionId || context.id);
    const collection = getCollectionById(collectionId);
    if (!collection) {
        announce('Collection was not found.');
        return false;
    }

    updateRecentList('collections', collection.id);
    saveOrganizationState(`Opened collection ${collection.name}`);
    announce(`Opened collection ${collection.name}.`);
    emitOrganizationEvent('Collection Opened', {
        collectionId: collection.id,
        name: collection.name
    });
    return true;
}

export function openSavedViewManagerFromCommand(options = {}) {
    ensureOrganizationState();
    const query = normalizeText(window.prompt('Saved View Manager search (leave blank to show all)', options.query || ''));
    const views = getSavedViews({ query, workspaceId: appState.activeWorkspaceId, reportId: appState.selectedReportId });
    if (!views.length) {
        announce('No Saved Views are available for the current filter.');
        return false;
    }

    const selected = promptSelectFromList('Saved View Manager: choose Saved View', views, (savedView) => `${savedView.name} | ${savedView.scope}`);
    if (!selected) return false;

    const action = normalizeText(window.prompt('Saved View Manager action: view, open, rename, duplicate, delete, favorite', 'view')).toLowerCase();

    if (!action || action === 'view') {
        announce(`${selected.name}. ${selected.configurationSummary || 'No summary available.'}`);
        return true;
    }

    if (action === 'open') {
        return openSavedViewFromCommand({ savedViewId: selected.id });
    }

    if (action === 'rename') {
        const nextName = normalizeText(window.prompt('Rename Saved View', selected.name));
        if (!nextName || nextName === selected.name) return false;
        const result = updateSavedView(selected.id, { name: nextName });
        if (!result.ok) {
            announce(result.message || 'Saved View rename failed.');
            return false;
        }
        announce(`Renamed Saved View to ${result.savedView.name}.`);
        return true;
    }

    if (action === 'duplicate') {
        const result = duplicateSavedView(selected.id);
        if (!result.ok) {
            announce('Saved View duplication failed.');
            return false;
        }
        announce(`Duplicated Saved View as ${result.savedView.name}.`);
        return true;
    }

    if (action === 'delete') {
        return deleteSavedViewFromCommand({ savedViewId: selected.id });
    }

    if (action === 'favorite') {
        const toggled = toggleFavorite('saved-view', selected.id);
        if (!toggled.ok) return false;
        announce('Saved View favorite updated.');
        return true;
    }

    announce('Unsupported Saved View Manager action.');
    return false;
}

export function createSavedViewFromCurrentWorkingViewFromCommand() {
    const defaultName = normalizeText(getActiveWorkingViewSessionSnapshot()?.config?.name || 'Saved Working View');
    const name = normalizeText(window.prompt('Create Saved View name', defaultName));
    if (!name) return false;

    const description = normalizeText(window.prompt('Saved View description (optional)', ''));
    const scopeInput = normalizeText(window.prompt('Saved View scope: report, workspace, application', 'workspace')).toLowerCase();

    const result = createSavedViewFromCurrentWorkingView({
        name,
        description,
        scope: scopeInput,
        workspaceId: appState.activeWorkspaceId,
        reportId: appState.selectedReportId
    });

    if (!result.ok) {
        announce(result.reason === 'no-active-working-view'
            ? 'Open a Working View before creating a Saved View.'
            : (result.message || 'Saved View could not be created.'));
        return false;
    }

    announce(`Created Saved View ${result.savedView.name}.`);
    return true;
}

export function openSavedViewFromCommand(context = {}) {
    const savedViewId = normalizeText(context.savedViewId || context.id);
    if (savedViewId) {
        const result = openSavedView(savedViewId);
        if (!result.ok) {
            announce('Saved View could not be opened.');
            return false;
        }
        announce(`Opened Saved View ${result.savedView.name}.`);
        return true;
    }

    const views = getSavedViews({ workspaceId: appState.activeWorkspaceId, reportId: appState.selectedReportId });
    if (!views.length) {
        announce('No Saved Views are available.');
        return false;
    }

    const selected = promptSelectFromList('Open Saved View: choose Saved View', views, (savedView) => `${savedView.name} (${savedView.scope})`);
    if (!selected) return false;

    const result = openSavedView(selected.id);
    if (!result.ok) {
        announce('Saved View could not be opened.');
        return false;
    }

    announce(`Opened Saved View ${selected.name}.`);
    return true;
}

export function deleteSavedViewFromCommand(context = {}) {
    const directId = normalizeText(context.savedViewId || context.id);
    let target = directId ? getSavedViewById(directId) : null;

    if (!target) {
        const views = getSavedViews({ workspaceId: appState.activeWorkspaceId, reportId: appState.selectedReportId });
        if (!views.length) {
            announce('No Saved Views are available.');
            return false;
        }
        target = promptSelectFromList('Delete Saved View: choose Saved View', views, (savedView) => savedView.name);
        if (!target) return false;
    }

    const confirmed = window.confirm(`Delete Saved View ${target.name}?`);
    if (!confirmed) return false;

    const result = deleteSavedView(target.id);
    if (!result.ok) {
        announce('Saved View deletion failed.');
        return false;
    }

    announce(`Deleted Saved View ${target.name}.`);
    return true;
}

function createExportPayload(scope = 'application') {
    const state = ensureOrganizationState();
    const activeWorkspace = getActiveProjectWorkspace();

    if (scope === 'workspace' && activeWorkspace) {
        const workspaceId = activeWorkspace.id;
        return {
            format: 'ART Resource Organization',
            version: '1.0',
            scope: 'workspace',
            workspaceId,
            exportedAt: nowIso(),
            resourceOrganization: {
                frameworkVersion: state.frameworkVersion,
                tags: state.tags.filter((tag) => shouldExposeItemByScope(tag, workspaceId, '')),
                collections: state.collections.filter((collection) => shouldExposeItemByScope(collection, workspaceId, '')),
                savedViews: state.savedViews.filter((savedView) => shouldExposeItemByScope(savedView, workspaceId, '')),
                favorites: {
                    tags: normalizeArray(state.favorites.tags),
                    collections: normalizeArray(state.favorites.collections),
                    savedViews: normalizeArray(state.favorites.savedViews)
                },
                recent: {
                    collections: normalizeArray(state.recent.collections),
                    savedViews: normalizeArray(state.recent.savedViews)
                },
                unresolvedReferences: normalizeArray(state.unresolvedReferences)
            }
        };
    }

    return {
        format: 'ART Resource Organization',
        version: '1.0',
        scope: 'application',
        exportedAt: nowIso(),
        resourceOrganization: state
    };
}

function mergeImportedOrganizationState(importedState, options = {}) {
    const existing = ensureOrganizationState();
    const imported = normalizeOrganizationState(importedState);
    const workspaceId = normalizeText(options.workspaceId);
    const scope = normalizeText(options.scope || 'application').toLowerCase();

    const shouldInclude = (item) => {
        if (scope !== 'workspace') return true;
        return shouldExposeItemByScope(item, workspaceId, '');
    };

    const merged = normalizeOrganizationState({
        ...existing,
        tags: dedupeBy(
            [
                ...existing.tags,
                ...imported.tags.filter((tag) => shouldInclude(tag))
            ],
            (item) => normalizeText(item.id)
        ),
        collections: dedupeBy(
            [
                ...existing.collections,
                ...imported.collections.filter((collection) => shouldInclude(collection))
            ],
            (item) => normalizeText(item.id)
        ),
        savedViews: dedupeBy(
            [
                ...existing.savedViews,
                ...imported.savedViews.filter((savedView) => shouldInclude(savedView))
            ],
            (item) => normalizeText(item.id)
        ),
        favorites: {
            tags: dedupeBy([...(existing.favorites.tags || []), ...(imported.favorites.tags || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)),
            collections: dedupeBy([...(existing.favorites.collections || []), ...(imported.favorites.collections || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)),
            savedViews: dedupeBy([...(existing.favorites.savedViews || []), ...(imported.favorites.savedViews || [])], (item) => normalizeText(item)).map((item) => normalizeText(item))
        },
        recent: {
            collections: dedupeBy([...(existing.recent.collections || []), ...(imported.recent.collections || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)).slice(0, 50),
            savedViews: dedupeBy([...(existing.recent.savedViews || []), ...(imported.recent.savedViews || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)).slice(0, 50)
        },
        unresolvedReferences: dedupeBy(
            [
                ...existing.unresolvedReferences,
                ...imported.unresolvedReferences
            ],
            (item) => getResourceRefKey(item)
        )
    });

    appState.resourceOrganization = merged;
    saveOrganizationState('Imported resource organization metadata');
    emitOrganizationEvent('Resource Organization Imported', {
        tagCount: merged.tags.length,
        collectionCount: merged.collections.length,
        savedViewCount: merged.savedViews.length
    });

    return { ok: true, merged };
}

export function exportResourceOrganizationMetadataFromCommand() {
    const scope = normalizeText(window.prompt('Export scope: workspace or application', 'application')).toLowerCase();
    const payload = createExportPayload(scope === 'workspace' ? 'workspace' : 'application');
    const safeName = scope === 'workspace' ? 'workspace-resource-organization' : 'resource-organization';

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);

    announce('Exported resource organization metadata.');
    return true;
}

function ensureImportInput() {
    if (importInput) return importInput;
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json,application/json';
    importInput.hidden = true;
    importInput.tabIndex = -1;
    importInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(importInput);
    return importInput;
}

export function importResourceOrganizationMetadataFromCommand() {
    const input = ensureImportInput();
    input.value = '';
    input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            if (!payload || payload.format !== 'ART Resource Organization' || !payload.resourceOrganization) {
                announce('Import failed. Unsupported resource organization format.');
                return;
            }

            const result = mergeImportedOrganizationState(payload.resourceOrganization, {
                scope: payload.scope,
                workspaceId: payload.workspaceId
            });
            if (!result.ok) {
                announce('Import failed.');
                return;
            }

            announce('Imported resource organization metadata.');
        } catch (error) {
            announce('Import failed. The selected file is not valid JSON metadata.');
        }
    };

    input.click();
    return true;
}

export function reconcileResourceOrganizationIntegrity(options = {}) {
    const state = ensureOrganizationState();
    const keepUnresolved = options.keepUnresolved !== false;
    const knownResources = getAllWorkspaceCatalogKeys();

    const markRef = (reference) => {
        const ref = normalizeResourceRef(reference);
        const key = getResourceRefKey(ref);
        const resolved = knownResources.has(key) || hasResourceReference(ref);
        return {
            ...ref,
            unresolved: !resolved
        };
    };

    state.tags = state.tags.map((tag) => ({
        ...tag,
        assignments: normalizeArray(tag.assignments)
            .map((reference) => markRef(reference))
            .filter((reference) => keepUnresolved || !reference.unresolved)
    }));

    state.collections = state.collections.map((collection) => ({
        ...collection,
        resourceRefs: normalizeArray(collection.resourceRefs)
            .map((reference) => markRef(reference))
            .filter((reference) => keepUnresolved || !reference.unresolved)
    }));

    state.unresolvedReferences = dedupeBy([
        ...state.tags.flatMap((tag) => normalizeArray(tag.assignments).filter((item) => item.unresolved)),
        ...state.collections.flatMap((collection) => normalizeArray(collection.resourceRefs).filter((item) => item.unresolved))
    ], (item) => getResourceRefKey(item));

    saveOrganizationState('Reconciled resource organization metadata');

    emitOrganizationEvent('Resource Organization Reconciled', {
        unresolvedReferenceCount: state.unresolvedReferences.length
    });

    return {
        ok: true,
        unresolvedReferenceCount: state.unresolvedReferences.length
    };
}

export function getOrganizationDiagnostics() {
    const state = ensureOrganizationState();
    return {
        frameworkVersion: FRAMEWORK_VERSION,
        tags: state.tags.length,
        collections: state.collections.length,
        savedViews: state.savedViews.length,
        unresolvedReferences: state.unresolvedReferences.length,
        favorites: {
            tags: normalizeArray(state.favorites.tags).length,
            collections: normalizeArray(state.favorites.collections).length,
            savedViews: normalizeArray(state.favorites.savedViews).length
        }
    };
}

function registerPluginProvidedOrganizationMetadata() {
    let snapshot;
    try {
        snapshot = getPluginFrameworkSnapshot();
    } catch (error) {
        return;
    }

    const registry = snapshot?.extensionRegistry || {};
    const tagProviders = normalizeArray(registry.tagProviders);
    const collectionProviders = normalizeArray(registry.collectionProviders);
    const savedViewProviders = normalizeArray(registry.savedViewProviders);

    const tagEntries = tagProviders.flatMap((entry) => normalizeArray(entry?.value || entry?.value?.tags || entry?.tags || entry?.defaultTags));
    tagEntries.forEach((item) => {
        const name = normalizeText(item?.name || item?.label);
        if (!name) return;
        const existing = ensureOrganizationState().tags.some((tag) => normalizeText(tag.name).toLowerCase() === name.toLowerCase());
        if (existing) return;
        createTag({
            ...item,
            name,
            pluginSource: normalizeText(item?.pluginSource || 'plugin'),
            reserved: Boolean(item?.reserved)
        }, {
            reservedNames: normalizeArray(item?.reservedNames)
        });
    });

    const collectionEntries = collectionProviders.flatMap((entry) => normalizeArray(entry?.value || entry?.collections || entry?.defaultCollections));
    collectionEntries.forEach((item) => {
        const name = normalizeText(item?.name || item?.label);
        if (!name) return;
        const existing = ensureOrganizationState().collections.some((collection) => normalizeText(collection.name).toLowerCase() === name.toLowerCase());
        if (existing) return;
        createCollection({
            ...item,
            name,
            pluginSource: normalizeText(item?.pluginSource || 'plugin'),
            reserved: Boolean(item?.reserved)
        });
    });

    const savedViewEntries = savedViewProviders.flatMap((entry) => normalizeArray(entry?.value || entry?.savedViews || entry?.defaultSavedViews));
    savedViewEntries.forEach((item) => {
        const name = normalizeText(item?.name || item?.label);
        if (!name) return;
        const existing = ensureOrganizationState().savedViews.some((savedView) => normalizeText(savedView.name).toLowerCase() === name.toLowerCase());
        if (existing) return;
        createSavedView({
            ...item,
            name,
            pluginSource: normalizeText(item?.pluginSource || 'plugin'),
            reserved: Boolean(item?.reserved)
        });
    });
}

function handleResourceLifecycleRefresh() {
    reconcileResourceOrganizationIntegrity({ keepUnresolved: true });
}

export function attachWorkspaceOrganizationMetadata(workspace, options = {}) {
    const state = ensureOrganizationState();
    const workspaceId = normalizeText(workspace?.id);
    if (!workspaceId) return workspace;

    const includeOnlyWorkspaceScope = options.includeOnlyWorkspaceScope !== false;
    const includePredicate = (item) => {
        if (!includeOnlyWorkspaceScope) return true;
        const scope = normalizeScope(item.scope, 'workspace');
        if (scope === 'workspace') return normalizeText(item.workspaceId) === workspaceId;
        if (scope === 'application' || scope === 'organization') return true;
        if (scope === 'report') return true;
        return true;
    };

    return {
        ...workspace,
        organization: {
            frameworkVersion: FRAMEWORK_VERSION,
            tags: state.tags.filter((tag) => includePredicate(tag)),
            collections: state.collections.filter((collection) => includePredicate(collection)),
            savedViews: state.savedViews.filter((savedView) => includePredicate(savedView)),
            unresolvedReferences: state.unresolvedReferences
                .filter((reference) => normalizeText(reference.workspaceId) === workspaceId || !normalizeText(reference.workspaceId))
        }
    };
}

export function applyWorkspaceOrganizationMetadata(workspace) {
    const organization = workspace?.organization;
    if (!organization || typeof organization !== 'object') {
        return { ok: true, merged: false };
    }

    const result = mergeImportedOrganizationState(organization, {
        scope: 'workspace',
        workspaceId: workspace.id
    });

    if (!result.ok) return result;
    return { ok: true, merged: true };
}

export function getWorkspaceOrganizationExportSnapshot(workspaceId) {
    const state = ensureOrganizationState();
    const id = normalizeText(workspaceId || appState.activeWorkspaceId);
    if (!id) return {
        tags: [],
        collections: [],
        savedViews: [],
        unresolvedReferences: []
    };

    return {
        tags: state.tags.filter((tag) => shouldExposeItemByScope(tag, id, '')),
        collections: state.collections.filter((collection) => shouldExposeItemByScope(collection, id, '')),
        savedViews: state.savedViews.filter((savedView) => shouldExposeItemByScope(savedView, id, '')),
        unresolvedReferences: state.unresolvedReferences.filter((reference) => normalizeText(reference.workspaceId) === id || !normalizeText(reference.workspaceId))
    };
}

export function importWorkspaceOrganizationSnapshot(workspace, snapshot = {}) {
    if (!workspace || !workspace.id) return { ok: false, reason: 'invalid-workspace' };

    const payload = {
        frameworkVersion: FRAMEWORK_VERSION,
        tags: normalizeArray(snapshot.tags),
        collections: normalizeArray(snapshot.collections),
        savedViews: normalizeArray(snapshot.savedViews),
        unresolvedReferences: normalizeArray(snapshot.unresolvedReferences)
    };

    return mergeImportedOrganizationState(payload, {
        scope: 'workspace',
        workspaceId: workspace.id
    });
}

export function handleOrganizationExplorerAction(context = {}) {
    const type = normalizeText(context.itemType || context.type).toLowerCase();
    const id = normalizeText(context.itemId || context.id);

    if (type === 'saved-view') {
        return openSavedViewFromCommand({ savedViewId: id });
    }

    if (type === 'collection') {
        return openCollectionFromCommand({ collectionId: id });
    }

    if (type === 'tag') {
        const tag = getTagById(id);
        if (!tag) return false;
        announce(`${tag.name} selected.`);
        return true;
    }

    if (type === 'resource') {
        const reference = normalizeResourceRef(context.reference || context);
        window.dispatchEvent(new CustomEvent('art-resource-organization-reveal-resource', {
            detail: { reference }
        }));
        return true;
    }

    return false;
}

function syncWorkspaceFavoritesIntoState() {
    const state = ensureOrganizationState();
    const activeWorkspace = getActiveProjectWorkspace();
    if (!activeWorkspace) return;

    const extensions = activeWorkspace.extensions && typeof activeWorkspace.extensions === 'object'
        ? activeWorkspace.extensions
        : {};
    const workspaceFavorites = extensions.organizationFavorites && typeof extensions.organizationFavorites === 'object'
        ? extensions.organizationFavorites
        : null;

    if (!workspaceFavorites) return;

    state.favorites = {
        tags: dedupeBy([...(state.favorites.tags || []), ...(workspaceFavorites.tags || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)),
        collections: dedupeBy([...(state.favorites.collections || []), ...(workspaceFavorites.collections || [])], (item) => normalizeText(item)).map((item) => normalizeText(item)),
        savedViews: dedupeBy([...(state.favorites.savedViews || []), ...(workspaceFavorites.savedViews || [])], (item) => normalizeText(item)).map((item) => normalizeText(item))
    };
}

export function persistWorkspaceOrganizationFavorites(workspaceId = '') {
    const state = ensureOrganizationState();
    const id = normalizeText(workspaceId || appState.activeWorkspaceId);
    if (!id) return false;

    const workspace = getProjectWorkspaces().find((item) => normalizeText(item.id) === id);
    if (!workspace) return false;

    const next = {
        ...workspace,
        extensions: {
            ...(workspace.extensions && typeof workspace.extensions === 'object' ? workspace.extensions : {}),
            organizationFavorites: {
                tags: normalizeArray(state.favorites.tags),
                collections: normalizeArray(state.favorites.collections),
                savedViews: normalizeArray(state.favorites.savedViews)
            }
        },
        lastModifiedAt: nowIso()
    };

    upsertProjectWorkspace(next, {
        action: 'Updated workspace organization favorites',
        setActive: appState.activeWorkspaceId === id,
        persist: true
    });

    return true;
}

export function initializeResourceOrganizationFramework() {
    if (frameworkInitialized) return true;
    frameworkInitialized = true;

    ensureOrganizationState();
    syncWorkspaceFavoritesIntoState();
    registerPluginProvidedOrganizationMetadata();
    reconcileResourceOrganizationIntegrity({ keepUnresolved: true });

    window.addEventListener('art-workspace-event', () => {
        syncWorkspaceFavoritesIntoState();
        reconcileResourceOrganizationIntegrity({ keepUnresolved: true });
    });

    window.addEventListener('art-reports-updated', handleResourceLifecycleRefresh);
    window.addEventListener('art-templates-updated', handleResourceLifecycleRefresh);
    window.addEventListener('art-accessibility-standards-updated', handleResourceLifecycleRefresh);
    window.addEventListener('art-project-workspace-updated', handleResourceLifecycleRefresh);

    return true;
}
