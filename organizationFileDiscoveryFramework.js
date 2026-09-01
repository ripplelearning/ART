// Organization Folder File Discovery Framework
// Discovers ART files in organization folders and extracts metrics

import { getOrganizationFoldersConfig } from './state.js';

/**
 * File discovery state and caching
 */
const discoveryCache = {
    lastDiscoveryAt: null,
    discoveredFiles: [],
    folderMetrics: null,
    discoveryInProgress: false,
    cacheExpiration: 60000 // 1 minute cache
};

/**
 * Gets discovered files from organization folder.
 * Uses cache if available and fresh.
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery result with files
 */
export async function discoverOrganizationFiles(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const cacheValid = discoveryCache.lastDiscoveryAt &&
        Date.now() - discoveryCache.lastDiscoveryAt < discoveryCache.cacheExpiration &&
        !forceRefresh;

    if (cacheValid && discoveryCache.discoveredFiles.length > 0) {
        return {
            success: true,
            files: discoveryCache.discoveredFiles,
            metrics: discoveryCache.folderMetrics,
            cached: true,
            cacheAge: Date.now() - discoveryCache.lastDiscoveryAt
        };
    }

    if (discoveryCache.discoveryInProgress) {
        return {
            success: false,
            message: 'Discovery already in progress',
            cached: false
        };
    }

    try {
        discoveryCache.discoveryInProgress = true;
        const config = getOrganizationFoldersConfig();

        if (!config.configured) {
            return {
                success: false,
                message: 'Organization folder not configured',
                files: [],
                cached: false
            };
        }

        // Simulate file discovery (in real environment, would use File System Access API)
        const result = await performFileDiscovery(config);
        
        discoveryCache.discoveredFiles = result.files || [];
        discoveryCache.folderMetrics = result.metrics;
        discoveryCache.lastDiscoveryAt = Date.now();

        return {
            ...result,
            cached: false
        };
    } finally {
        discoveryCache.discoveryInProgress = false;
    }
}

/**
 * Performs actual file discovery.
 * @param {Object} config - Organization folder config
 * @returns {Promise<Object>} Discovery result
 */
async function performFileDiscovery(config = {}) {
    return {
        success: true,
        files: [],
        metrics: {
            organizationId: config.organizationId,
            organizationName: config.organizationName,
            folderPath: config.folderPath,
            discoveredAt: new Date().toISOString(),
            fileCount: 0,
            artFileCount: 0,
            subfolderCount: 0,
            errors: [],
            warnings: ['File discovery requires File System Access API integration']
        }
    };
}

/**
 * Classifies a file based on its name and metadata.
 * @param {string} fileName - File name
 * @param {Object} metadata - File metadata
 * @returns {Object} File classification
 */
export function classifyArtFile(fileName = '', metadata = {}) {
    const normalizedName = String(fileName || '').toLowerCase().trim();

    let fileType = 'unknown';
    let category = 'other';

    if (normalizedName.includes('report') || normalizedName.includes('audit')) {
        fileType = 'report';
        category = 'reports';
    } else if (normalizedName.includes('task') || normalizedName.includes('todo')) {
        fileType = 'tasks';
        category = 'tasks';
    } else if (normalizedName.includes('progress') || normalizedName.includes('log')) {
        fileType = 'progress-log';
        category = 'logs';
    } else if (normalizedName.includes('project')) {
        fileType = 'project';
        category = 'projects';
    } else if (normalizedName.includes('template')) {
        fileType = 'template';
        category = 'templates';
    } else if (normalizedName.includes('manifest')) {
        fileType = 'manifest';
        category = 'configuration';
    }

    return {
        fileName,
        fileType,
        category,
        isArtFile: fileType !== 'unknown',
        estimatedSize: Number(metadata.size) || 0,
        createdAt: String(metadata.createdAt || '').trim(),
        modifiedAt: String(metadata.modifiedAt || '').trim()
    };
}

/**
 * Extracts summary statistics from discovered files.
 * @param {Object[]} files - Array of discovered files
 * @returns {Object} Summary statistics
 */
export function calculateDiscoverySummary(files = []) {
    if (!Array.isArray(files)) return createEmptySummary();

    const summary = createEmptySummary();

    files.forEach((file) => {
        const classification = classifyArtFile(file.fileName, file);

        if (classification.isArtFile) {
            summary.totalArtFiles++;
            summary.byCategory[classification.category] = (summary.byCategory[classification.category] || 0) + 1;
            summary.byType[classification.fileType] = (summary.byType[classification.fileType] || 0) + 1;
        }

        summary.totalSize += classification.estimatedSize;
    });

    summary.totalFiles = files.length;
    return summary;
}

/**
 * Creates empty summary structure.
 * @returns {Object} Empty summary
 */
function createEmptySummary() {
    return {
        totalFiles: 0,
        totalArtFiles: 0,
        totalSize: 0,
        byCategory: {},
        byType: {
            report: 0,
            project: 0,
            template: 0,
            tasks: 0,
            'progress-log': 0,
            manifest: 0,
            unknown: 0
        }
    };
}

/**
 * Filters discovered files by category.
 * @param {Object[]} files - All discovered files
 * @param {string} category - Category to filter by
 * @returns {Object[]} Filtered files
 */
export function filterFilesByCategory(files = [], category = '') {
    if (!Array.isArray(files)) return [];
    const target = String(category || '').toLowerCase().trim();

    return files.filter((file) => {
        const classification = classifyArtFile(file.fileName, file);
        return classification.category === target;
    });
}

/**
 * Filters discovered files by type.
 * @param {Object[]} files - All discovered files
 * @param {string} fileType - File type to filter by
 * @returns {Object[]} Filtered files
 */
export function filterFilesByType(files = [], fileType = '') {
    if (!Array.isArray(files)) return [];
    const target = String(fileType || '').toLowerCase().trim();

    return files.filter((file) => {
        const classification = classifyArtFile(file.fileName, file);
        return classification.fileType === target;
    });
}

/**
 * Sorts discovered files by date or name.
 * @param {Object[]} files - Files to sort
 * @param {string} sortBy - Sort key: 'name'|'modified'|'created'|'size'
 * @param {boolean} descending - Sort descending
 * @returns {Object[]} Sorted files
 */
export function sortDiscoveredFiles(files = [], sortBy = 'modified', descending = true) {
    if (!Array.isArray(files)) return [];

    const sorted = [...files].sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
            case 'name':
                aValue = String(a.fileName || '').toLowerCase();
                bValue = String(b.fileName || '').toLowerCase();
                break;
            case 'created':
                aValue = new Date(a.createdAt || 0).getTime();
                bValue = new Date(b.createdAt || 0).getTime();
                break;
            case 'size':
                aValue = Number(a.size || 0);
                bValue = Number(b.size || 0);
                break;
            case 'modified':
            default:
                aValue = new Date(a.modifiedAt || 0).getTime();
                bValue = new Date(b.modifiedAt || 0).getTime();
        }

        if (aValue < bValue) return descending ? 1 : -1;
        if (aValue > bValue) return descending ? -1 : 1;
        return 0;
    });

    return sorted;
}

/**
 * Groups discovered files by category.
 * @param {Object[]} files - Files to group
 * @returns {Object} Files grouped by category
 */
export function groupFilesByCategory(files = []) {
    const grouped = {};

    if (!Array.isArray(files)) return grouped;

    files.forEach((file) => {
        const classification = classifyArtFile(file.fileName, file);
        if (!grouped[classification.category]) {
            grouped[classification.category] = [];
        }
        grouped[classification.category].push(file);
    });

    return grouped;
}

/**
 * Extracts collaborators from discovered files.
 * @param {Object[]} files - Discovered files with content
 * @returns {Object[]} Extracted collaborators
 */
export function extractCollaboratorsFromFiles(files = []) {
    const collaborators = new Map();

    if (!Array.isArray(files)) return [];

    files.forEach((file) => {
        const content = file.content || {};

        // Extract from creator
        if (content.createdBy?.userId) {
            collaborators.set(content.createdBy.userId, {
                userId: content.createdBy.userId,
                displayName: content.createdBy.displayName || 'Unknown',
                email: content.createdBy.email || '',
                jobTitle: content.createdBy.jobTitle || '',
                artRole: content.createdBy.artRole || '',
                contributions: (collaborators.get(content.createdBy.userId)?.contributions || 0) + 1,
                lastSeen: content.createdAt
            });
        }

        // Extract from revision history
        if (Array.isArray(content.revisionHistory)) {
            content.revisionHistory.forEach((revision) => {
                if (revision.author?.userId) {
                    const existing = collaborators.get(revision.author.userId) || {};
                    collaborators.set(revision.author.userId, {
                        userId: revision.author.userId,
                        displayName: revision.author.displayName || 'Unknown',
                        email: revision.author.email || '',
                        jobTitle: revision.author.jobTitle || '',
                        artRole: revision.author.artRole || '',
                        contributions: (existing.contributions || 0) + 1,
                        lastSeen: revision.timestamp
                    });
                }
            });
        }
    });

    return Array.from(collaborators.values()).sort((a, b) => b.contributions - a.contributions);
}

/**
 * Clears discovery cache.
 */
export function clearDiscoveryCache() {
    discoveryCache.lastDiscoveryAt = null;
    discoveryCache.discoveredFiles = [];
    discoveryCache.folderMetrics = null;
}

/**
 * Gets discovery cache status.
 * @returns {Object} Cache status
 */
export function getDiscoveryCacheStatus() {
    return {
        cached: discoveryCache.discoveredFiles.length > 0,
        fileCount: discoveryCache.discoveredFiles.length,
        cachedAt: discoveryCache.lastDiscoveryAt,
        isFresh: discoveryCache.lastDiscoveryAt &&
            Date.now() - discoveryCache.lastDiscoveryAt < discoveryCache.cacheExpiration,
        discoveryInProgress: discoveryCache.discoveryInProgress
    };
}
