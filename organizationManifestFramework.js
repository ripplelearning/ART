// Organization Manifest Framework
// Handles organization folder identification, metadata, and configuration

import { getLocalUserProfile, getDeviceIdentity } from './identityFramework.js';
import { computeContentHash } from './documentRevisionFramework.js';

const MANIFEST_FILENAME = '.art-organization.json';
const MANIFEST_VERSION = '1.0.0';

/**
 * Creates a new organization manifest.
 * @param {Object} options - Organization configuration
 * @returns {Object} Organization manifest
 */
export function createOrganizationManifest(options = {}) {
    const organizationId = String(options.organizationId || '').trim() ||
        `org-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const profile = getLocalUserProfile();

    return {
        version: MANIFEST_VERSION,
        organizationId,
        organizationName: String(options.organizationName || '').trim(),
        createdAt: new Date().toISOString(),
        createdBy: normalizeUserReference(options.createdBy),
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: normalizeUserReference(options.lastModifiedBy),
        description: String(options.description || '').trim(),
        settings: normalizeOrganizationSettings(options.settings),
        collaboration: normalizeCollaborationSettings(options.collaboration),
        metadata: {
            folderDiscovered: options.folderDiscovered === true,
            artifactCount: Number(options.artifactCount) || 0,
            collaboratorCount: Number(options.collaboratorCount) || 0,
            lastRefreshed: String(options.lastRefreshed || '').trim() || new Date().toISOString()
        }
    };
}

/**
 * Normalizes organization settings.
 * @param {Object} settings - Settings object
 * @returns {Object} Normalized settings
 */
function normalizeOrganizationSettings(settings = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
        includeSubfolders: source.includeSubfolders !== false,
        maxSubfolderDepth: Number(source.maxSubfolderDepth) || 5,
        autoDiscovery: source.autoDiscovery !== false,
        archiveOldVersions: source.archiveOldVersions !== false,
        minimumRetentionDays: Number(source.minimumRetentionDays) || 30
    };
}

/**
 * Normalizes collaboration settings.
 * @param {Object} collaboration - Collaboration object
 * @returns {Object} Normalized collaboration settings
 */
function normalizeCollaborationSettings(collaboration = {}) {
    const source = collaboration && typeof collaboration === 'object' ? collaboration : {};
    return {
        allowExternalMerges: source.allowExternalMerges !== false,
        autoMergeNonConflicting: source.autoMergeNonConflicting !== false,
        trackRevisionHistory: source.trackRevisionHistory !== false,
        enableMentions: source.enableMentions !== false,
        requireConflictResolution: source.requireConflictResolution !== false,
        notificationDelay: Number(source.notificationDelay) || 5000 // milliseconds
    };
}

/**
 * Normalizes a user reference.
 * @param {Object} userInfo - User information
 * @returns {Object} Normalized user reference
 */
function normalizeUserReference(userInfo) {
    const source = userInfo && typeof userInfo === 'object' ? userInfo : {};
    const profile = getLocalUserProfile();

    return {
        userId: String(source.userId || '').trim() || profile.localUserId,
        displayName: String(source.displayName || '').trim() || profile.displayName || profile.name || 'Unknown',
        email: String(source.email || '').trim() || profile.email || '',
        deviceId: String(source.deviceId || '').trim() || getDeviceIdentity().id
    };
}

/**
 * Adds collaborator information to the organization manifest.
 * @param {Object} manifest - Existing manifest
 * @param {Object} collaborator - Collaborator to add
 * @returns {Object} Updated manifest
 */
export function addCollaboratorToManifest(manifest = {}, collaborator = {}) {
    const source = manifest && typeof manifest === 'object' ? manifest : {};
    const collaborators = Array.isArray(source.collaborators) ? [...source.collaborators] : [];

    // Don't add duplicates
    const exists = collaborators.some((c) => c.userId === collaborator.userId);
    if (exists) return source;

    const newCollaborator = {
        userId: String(collaborator.userId || '').trim(),
        displayName: String(collaborator.displayName || '').trim(),
        email: String(collaborator.email || '').trim(),
        jobTitle: String(collaborator.jobTitle || '').trim(),
        artRole: String(collaborator.artRole || '').trim(),
        lastSeen: new Date().toISOString(),
        contributionCount: Number(collaborator.contributionCount) || 1
    };

    return {
        ...source,
        collaborators: [...collaborators, newCollaborator],
        metadata: {
            ...source.metadata,
            collaboratorCount: collaborators.length + 1
        }
    };
}

/**
 * Registers an ART artifact (file/document) in the manifest.
 * @param {Object} manifest - Existing manifest
 * @param {Object} artifact - Artifact to register
 * @returns {Object} Updated manifest
 */
export function registerArtifactInManifest(manifest = {}, artifact = {}) {
    const source = manifest && typeof manifest === 'object' ? manifest : {};
    const artifacts = Array.isArray(source.artifacts) ? [...source.artifacts] : [];

    // Don't register duplicates
    const exists = artifacts.some((a) => a.documentId === artifact.documentId);
    if (exists) return source;

    const newArtifact = {
        documentId: String(artifact.documentId || '').trim(),
        filePath: String(artifact.filePath || '').trim(),
        fileName: String(artifact.fileName || '').trim(),
        fileType: String(artifact.fileType || 'unknown').trim(), // 'report', 'project', 'template', 'tasks', 'progress-log'
        createdAt: String(artifact.createdAt || '').trim() || new Date().toISOString(),
        lastModifiedAt: String(artifact.lastModifiedAt || '').trim() || new Date().toISOString(),
        author: normalizeUserReference(artifact.author),
        isShared: artifact.isShared === true,
        accessLevel: String(artifact.accessLevel || 'read-write').trim(), // 'read-only', 'read-write', 'admin'
        tags: Array.isArray(artifact.tags) ? artifact.tags.map((t) => String(t).trim()).filter(Boolean) : []
    };

    return {
        ...source,
        artifacts: [...artifacts, newArtifact],
        metadata: {
            ...source.metadata,
            artifactCount: artifacts.length + 1,
            lastRefreshed: new Date().toISOString()
        }
    };
}

/**
 * Updates manifest metadata.
 * @param {Object} manifest - Existing manifest
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated manifest
 */
export function updateManifestMetadata(manifest = {}, updates = {}) {
    const source = manifest && typeof manifest === 'object' ? manifest : {};
    const updateSource = updates && typeof updates === 'object' ? updates : {};

    return {
        ...source,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: normalizeUserReference(updateSource.lastModifiedBy),
        metadata: {
            ...source.metadata,
            ...(updateSource.metadata || {}),
            lastRefreshed: new Date().toISOString()
        }
    };
}

/**
 * Validates an organization manifest structure.
 * @param {Object} manifest - Manifest to validate
 * @returns {Object} Validation result
 */
export function validateOrganizationManifest(manifest = {}) {
    const errors = [];
    const warnings = [];
    const source = manifest && typeof manifest === 'object' ? manifest : {};

    // Required fields
    if (!source.version) errors.push('Missing required field: version');
    if (!source.organizationId) errors.push('Missing required field: organizationId');

    // Version check
    if (source.version && source.version !== MANIFEST_VERSION) {
        warnings.push(`Manifest version ${source.version} may not be fully compatible with ${MANIFEST_VERSION}`);
    }

    // Field types
    if (source.organizationId && typeof source.organizationId !== 'string') {
        errors.push('Field organizationId must be a string');
    }
    if (source.createdAt && !(new Date(source.createdAt) instanceof Date)) {
        errors.push('Field createdAt must be a valid ISO timestamp');
    }
    if (source.lastModifiedAt && !(new Date(source.lastModifiedAt) instanceof Date)) {
        errors.push('Field lastModifiedAt must be a valid ISO timestamp');
    }

    // Collaborators array
    if (source.collaborators && !Array.isArray(source.collaborators)) {
        errors.push('Field collaborators must be an array');
    }

    // Artifacts array
    if (source.artifacts && !Array.isArray(source.artifacts)) {
        errors.push('Field artifacts must be an array');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        isCompatible: warnings.length === 0
    };
}

/**
 * Creates a manifest summary for display/logging.
 * @param {Object} manifest - Manifest to summarize
 * @returns {Object} Summary object
 */
export function getManifestSummary(manifest = {}) {
    const source = manifest && typeof manifest === 'object' ? manifest : {};
    const collaborators = Array.isArray(source.collaborators) ? source.collaborators : [];
    const artifacts = Array.isArray(source.artifacts) ? source.artifacts : [];

    return {
        organizationId: source.organizationId || 'unknown',
        organizationName: source.organizationName || 'Unnamed Organization',
        version: source.version || 'unknown',
        created: source.createdAt || 'unknown',
        lastModified: source.lastModifiedAt || 'never',
        createdBy: source.createdBy?.displayName || 'unknown',
        collaboratorCount: collaborators.length,
        artifactCount: artifacts.length,
        description: source.description || 'No description',
        subfolderDiscovery: source.settings?.includeSubfolders !== false ? 'enabled' : 'disabled',
        autoMerge: source.collaboration?.autoMergeNonConflicting !== false ? 'enabled' : 'disabled'
    };
}

/**
 * Exports manifest as JSON string.
 * @param {Object} manifest - Manifest to export
 * @returns {string} JSON string
 */
export function exportManifestAsJson(manifest = {}) {
    const source = manifest && typeof manifest === 'object' ? manifest : {};
    return JSON.stringify(source, null, 2);
}

/**
 * Imports manifest from JSON string.
 * @param {string} jsonString - JSON string to import
 * @returns {Object} Parsed and validated manifest
 */
export function importManifestFromJson(jsonString = '') {
    try {
        const parsed = JSON.parse(String(jsonString || ''));
        const validation = validateOrganizationManifest(parsed);
        return {
            success: validation.valid,
            manifest: parsed,
            validation,
            error: validation.valid ? null : validation.errors.join('; ')
        };
    } catch (error) {
        return {
            success: false,
            manifest: null,
            validation: { valid: false, errors: [], warnings: [] },
            error: String(error.message || 'Failed to parse JSON')
        };
    }
}

/**
 * Gets the manifest file information.
 * @returns {Object} Manifest file information
 */
export function getManifestFileInfo() {
    return {
        filename: MANIFEST_FILENAME,
        location: 'Organization folder root',
        format: 'JSON',
        version: MANIFEST_VERSION,
        mimeType: 'application/json',
        description: 'ART Organization Folder Manifest containing metadata, collaborators, and discovered artifacts'
    };
}
