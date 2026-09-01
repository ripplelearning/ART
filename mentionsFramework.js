// @Mentions System for File-Based Collaboration
// Enables users to mention collaborators in comments, notes, and collaboration text areas

import { getLocalUserProfile, getDeviceIdentity } from './identityFramework.js';
import { getOrganizationFoldersConfig } from './state.js';

/**
 * Creates a mention reference to a collaborator.
 * @param {Object} options - Mention configuration
 * @returns {Object} Mention object
 */
export function createMention(options = {}) {
    return {
        mentionId: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        userId: String(options.userId || '').trim(),
        displayName: String(options.displayName || '').trim(),
        email: String(options.email || '').trim(),
        mentionedAt: new Date().toISOString(),
        mentionedBy: normalizeUserReference(options.mentionedBy),
        context: String(options.context || '').trim(),
        targetType: String(options.targetType || '').trim(), // 'comment', 'note', 'instruction', etc.
        targetId: String(options.targetId || '').trim(),
        isResolved: options.isResolved === true
    };
}

/**
 * Creates a mention suggestion for autocomplete/search.
 * @param {Object} user - User information
 * @returns {Object} Mention suggestion
 */
export function createMentionSuggestion(user = {}) {
    const source = user && typeof user === 'object' ? user : {};
    return {
        userId: String(source.userId || source.localUserId || '').trim(),
        displayName: String(source.displayName || source.name || '').trim(),
        email: String(source.email || '').trim(),
        jobTitle: String(source.jobTitle || '').trim(),
        artRole: String(source.artRole || '').trim(),
        avatar: String(source.avatar || '').trim(), // URL or data URI for avatar image
        isCurrentUser: false,
        priority: 0 // For sorting suggestions
    };
}

/**
 * Finds collaborators for mention suggestions.
 * Searches through shared document metadata and organization folder.
 * @param {string} searchText - Text to search for
 * @param {Object} options - Search options
 * @returns {Object[]} Array of collaborator suggestions
 */
export function findCollaborators(searchText = '', options = {}) {
    const query = String(searchText || '').trim().toLowerCase();
    const maxResults = Number(options.maxResults) || 10;
    const context = options.context || 'document'; // 'document', 'organization', 'all'

    const collaborators = [];
    const seen = new Set();

    // Add current user first if search is empty or matches
    const currentProfile = getLocalUserProfile();
    if (!query || matchesSearch(query, currentProfile)) {
        const suggestion = createMentionSuggestion(currentProfile);
        suggestion.isCurrentUser = true;
        suggestion.priority = 1000; // Highest priority
        collaborators.push(suggestion);
        seen.add(currentProfile.localUserId);
    }

    // Search document-level collaborators
    if (context === 'document' || context === 'all') {
        const docCollaborators = getDocumentCollaborators(options.document);
        for (const collaborator of docCollaborators) {
            if (seen.has(collaborator.userId)) continue;
            if (!query || matchesSearch(query, collaborator)) {
                collaborators.push(createMentionSuggestion(collaborator));
                seen.add(collaborator.userId);
            }
        }
    }

    // Search organization folder collaborators
    if (context === 'organization' || context === 'all') {
        const orgCollaborators = getOrganizationCollaborators(options.organizationFolder);
        for (const collaborator of orgCollaborators) {
            if (seen.has(collaborator.userId)) continue;
            if (!query || matchesSearch(query, collaborator)) {
                collaborators.push(createMentionSuggestion(collaborator));
                seen.add(collaborator.userId);
            }
        }
    }

    // Sort by priority and recent activity
    collaborators.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return (b.lastSeen || 0) - (a.lastSeen || 0);
    });

    return collaborators.slice(0, maxResults);
}

/**
 * Matches a search query against a collaborator's information.
 * @param {string} query - Lowercase search query
 * @param {Object} collaborator - Collaborator object
 * @returns {boolean} True if collaborator matches
 */
function matchesSearch(query, collaborator) {
    if (!query) return true;
    if (!collaborator) return false;

    const displayName = String(collaborator.displayName || '').toLowerCase();
    const name = String(collaborator.name || '').toLowerCase();
    const email = String(collaborator.email || '').toLowerCase();
    const jobTitle = String(collaborator.jobTitle || '').toLowerCase();
    const artRole = String(collaborator.artRole || '').toLowerCase();

    return (
        displayName.includes(query) ||
        name.includes(query) ||
        email.includes(query) ||
        jobTitle.includes(query) ||
        artRole.includes(query)
    );
}

/**
 * Gets collaborators who have participated in a document.
 * @param {Object} document - Document object
 * @returns {Object[]} Array of collaborators
 */
function getDocumentCollaborators(document = {}) {
    const collaborators = [];
    const seen = new Set();

    if (!document || typeof document !== 'object') return collaborators;

    // Add document author
    if (document.createdBy) {
        const suggestion = createMentionSuggestion(document.createdBy);
        if (suggestion.userId && !seen.has(suggestion.userId)) {
            collaborators.push(suggestion);
            seen.add(suggestion.userId);
        }
    }

    // Add document last modifier
    if (document.lastModifiedBy) {
        const suggestion = createMentionSuggestion(document.lastModifiedBy);
        if (suggestion.userId && !seen.has(suggestion.userId)) {
            collaborators.push(suggestion);
            seen.add(suggestion.userId);
        }
    }

    // Add from revision history if available
    if (Array.isArray(document.revisionHistory)) {
        for (const revision of document.revisionHistory) {
            if (revision.author) {
                const suggestion = createMentionSuggestion(revision.author);
                if (suggestion.userId && !seen.has(suggestion.userId)) {
                    collaborators.push(suggestion);
                    seen.add(suggestion.userId);
                }
            }
        }
    }

    return collaborators;
}

/**
 * Gets collaborators from organization folder metadata.
 * @param {Object} organizationFolder - Organization folder config
 * @returns {Object[]} Array of collaborators
 */
function getOrganizationCollaborators(organizationFolder = {}) {
    const collaborators = [];
    const seen = new Set();

    if (!organizationFolder || typeof organizationFolder !== 'object') return collaborators;

    // This would load from organization manifest or shared directory
    // For now, return empty as this requires file system access
    // In a full implementation, this would read from:
    // - .art/collaborators.json in the organization folder
    // - Metadata gathered from ART files in the folder
    // - Organization manifest file

    return collaborators;
}

/**
 * Parses text for @mention syntax.
 * @param {string} text - Text content to parse
 * @returns {Object[]} Array of found mentions with positions
 */
export function parseMentions(text = '') {
    const mentions = [];
    const content = String(text || '');
    const regex = /@(\w+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        mentions.push({
            text: match[0],
            name: match[1],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            resolved: false
        });
    }

    return mentions;
}

/**
 * Creates a rich mention object from parsed mention text.
 * @param {Object} mention - Parsed mention
 * @param {Object} collaborator - Resolved collaborator
 * @returns {Object} Rich mention with resolved data
 */
export function resolveMention(mention = {}, collaborator = {}) {
    return {
        ...mention,
        resolved: true,
        userId: String(collaborator.userId || '').trim(),
        displayName: String(collaborator.displayName || '').trim(),
        email: String(collaborator.email || '').trim(),
        jobTitle: String(collaborator.jobTitle || '').trim(),
        artRole: String(collaborator.artRole || '').trim()
    };
}

/**
 * Renders mention suggestions HTML for display.
 * @param {Object[]} suggestions - Array of collaborator suggestions
 * @returns {string} HTML markup for suggestions
 */
export function renderMentionSuggestions(suggestions = []) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return '<div class="mention-suggestions-empty">No collaborators found</div>';
    }

    const items = suggestions
        .map((suggestion, index) => {
            const displayText = suggestion.displayName || suggestion.email || suggestion.userId;
            const roleText = suggestion.artRole ? `(${suggestion.artRole})` : '';
            const jobText = suggestion.jobTitle ? ` - ${suggestion.jobTitle}` : '';

            return `
                <div class="mention-suggestion" role="option" aria-selected="false" data-user-id="${escapeHtml(suggestion.userId)}" tabindex="${index === 0 ? '0' : '-1'}">
                    <div class="mention-suggestion-name">${escapeHtml(displayText)} ${escapeHtml(roleText)}</div>
                    ${jobText ? `<div class="mention-suggestion-job">${escapeHtml(jobText)}</div>` : ''}
                    ${suggestion.email && suggestion.email !== displayText ? `<div class="mention-suggestion-email">${escapeHtml(suggestion.email)}</div>` : ''}
                </div>
            `;
        })
        .join('');

    return `
        <div class="mention-suggestions" role="listbox" aria-label="Collaborator suggestions">
            ${items}
        </div>
    `;
}

/**
 * Replaces a mention pattern with resolved mention markup.
 * @param {string} text - Original text with mention pattern
 * @param {Object} mention - Resolved mention
 * @returns {string} Text with mention replaced
 */
export function replaceMentionWithMarkup(text = '', mention = {}) {
    if (!mention.resolved) return text;

    const displayName = mention.displayName || mention.email || mention.userId || mention.name;
    const mentionMarkup = `<span class="mention" data-user-id="${escapeHtml(mention.userId)}" title="${escapeHtml(displayName)}">@${escapeHtml(displayName)}</span>`;

    return (
        text.substring(0, mention.startIndex) +
        mentionMarkup +
        text.substring(mention.endIndex)
    );
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
 * Escapes HTML special characters.
 * @param {any} value - Value to escape
 * @returns {string} Escaped string
 */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
