import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import {
    announce,
    appState,
    getActiveProjectWorkspace,
    getImportedAccessibilityStandards,
    getProjectWorkspaces,
    getRecentReports,
    getShortcutDefinitions,
    getUniversalSearchConfig,
    recordUniversalSearchHistory,
    saveUniversalSearch,
    setActiveUniversalSearchSession,
    clearUniversalSearchHistory
} from './state.js';
import { getResourceRegistrySnapshot } from './resourceFramework.js';
import { createSearchResultsController } from './searchResultsFramework.js';

const providerRegistry = new Map();
let initialized = false;
let dialogState = null;
let activeHighlights = [];

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeSearchText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeShortcutText(value) {
    return normalizeText(value).toLowerCase().replace(/[\s+]/g, '');
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function wildcardToRegExp(pattern) {
    const escaped = String(pattern || '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*')
        .replace(/\\\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
}

function parseSearchQuery(rawQuery) {
    const query = normalizeText(rawQuery);
    const quoted = [];
    const stripped = query.replace(/"([^"]+)"/g, (_, phrase) => {
        quoted.push(normalizeSearchText(phrase));
        return ' ';
    });

    const terms = stripped
        .split(/\s+/)
        .map((term) => normalizeText(term))
        .filter(Boolean);

    const include = [];
    const exclude = [];
    const optional = [];

    for (const term of terms) {
        if (term.startsWith('-') && term.length > 1) {
            exclude.push(normalizeSearchText(term.slice(1)));
            continue;
        }
        if (term.startsWith('+') && term.length > 1) {
            include.push(normalizeSearchText(term.slice(1)));
            continue;
        }
        optional.push(normalizeSearchText(term));
    }

    return {
        raw: query,
        normalized: normalizeSearchText(query),
        include,
        exclude,
        optional,
        phrases: quoted,
        hasQuery: Boolean(query)
    };
}

function matchesQueryText(text, queryModel) {
    const haystack = normalizeSearchText(text);

    const termMatches = (term) => {
        if (!term) return false;
        if (term.includes('*') || term.includes('?')) {
            const regex = wildcardToRegExp(term);
            return haystack.split(/\s+/).some((word) => regex.test(word));
        }
        return haystack.includes(term);
    };

    for (const term of queryModel.exclude) {
        if (!term) continue;
        if (termMatches(term)) return false;
    }

    for (const phrase of queryModel.phrases) {
        if (phrase && !haystack.includes(phrase)) return false;
    }

    for (const term of queryModel.include) {
        if (!term) continue;
        if (!termMatches(term)) return false;
    }

    if (queryModel.optional.length > 0) {
        const hasOptionalMatch = queryModel.optional.some((term) => termMatches(term));
        if (!hasOptionalMatch) return false;
    }

    return true;
}

function scoreTextMatch(searchableText, queryModel) {
    if (!queryModel.hasQuery) return 0;

    const text = normalizeSearchText(searchableText);
    const normalized = queryModel.normalized;

    if (text === normalized) return 0;
    if (text.startsWith(normalized)) return 1;

    let score = 2;
    for (const phrase of queryModel.phrases) {
        if (text.includes(phrase)) score -= 0.3;
    }
    for (const include of queryModel.include) {
        if (text.includes(include)) score -= 0.2;
    }
    for (const optional of queryModel.optional) {
        if (optional && text.includes(optional)) score -= 0.1;
    }

    if (text.includes(normalized)) score -= 0.2;
    return Math.max(1.2, score);
}

function buildCommandSearchableText(command, shortcut) {
    return [
        command.id,
        command.action,
        command.displayName,
        command.description,
        command.category,
        shortcut,
        command.helpTopic,
        command.menuLocation,
        command.notes
    ].join(' ').toLowerCase();
}

function normalizeProvider(provider) {
    const source = provider && typeof provider === 'object' ? provider : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Search provider requires an id.');

    return {
        id,
        name: normalizeText(source.name || id),
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 100,
        capabilities: {
            scopes: Array.isArray(source.capabilities?.scopes) ? source.capabilities.scopes.map((item) => normalizeText(item)).filter(Boolean) : ['workspace'],
            itemTypes: Array.isArray(source.capabilities?.itemTypes) ? source.capabilities.itemTypes.map((item) => normalizeText(item)).filter(Boolean) : ['resource'],
            supportsFieldSearch: source.capabilities?.supportsFieldSearch !== false,
            supportsBoolean: source.capabilities?.supportsBoolean !== false,
            supportsWildcard: source.capabilities?.supportsWildcard !== false,
            supportsPhrase: source.capabilities?.supportsPhrase !== false,
            advertisedFields: Array.isArray(source.capabilities?.advertisedFields) ? source.capabilities.advertisedFields.map((item) => normalizeText(item)).filter(Boolean) : []
        },
        search: typeof source.search === 'function' ? source.search : () => []
    };
}

export function registerUniversalSearchProvider(provider) {
    const normalized = normalizeProvider(provider);
    providerRegistry.set(normalized.id, normalized);
    return normalized;
}

export function getUniversalSearchProviders() {
    return [...providerRegistry.values()]
        .sort((a, b) => a.priority - b.priority)
        .map((provider) => ({
            id: provider.id,
            name: provider.name,
            priority: provider.priority,
            capabilities: { ...provider.capabilities }
        }));
}

export function getUniversalSearchProviderCapabilities() {
    return getUniversalSearchProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        scopes: provider.capabilities.scopes,
        itemTypes: provider.capabilities.itemTypes,
        supportsFieldSearch: provider.capabilities.supportsFieldSearch,
        supportsBoolean: provider.capabilities.supportsBoolean,
        supportsWildcard: provider.capabilities.supportsWildcard,
        supportsPhrase: provider.capabilities.supportsPhrase,
        advertisedFields: provider.capabilities.advertisedFields
    }));
}

function getActiveReportFromState() {
    const selectedReportId = String(appState.selectedReportId || '').trim();
    if (!selectedReportId) return null;
    return (appState.reports || []).find((report) => report.id === selectedReportId) || null;
}

function buildCommandProviderResults(queryModel, context) {
    const commands = commandRegistry.getCommands()
        .map((command) => {
            const state = commandExecutionService.getCommandExecutionState(command.id, context);
            const shortcut = String(context.shortcutMap?.get(command.action) || command.keyboardShortcut || '').trim();
            const commandView = {
                ...command,
                ...state,
                keyboardShortcut: shortcut
            };
            commandView.searchableText = buildCommandSearchableText(commandView, shortcut);
            return commandView;
        })
        .filter((command) => command.visible !== false)
        .filter((command) => matchesQueryText(command.searchableText, queryModel));

    return commands.map((command) => {
        const compactQuery = queryModel.normalized.replace(/[\s+]/g, '');
        const shortcut = normalizeShortcutText(command.keyboardShortcut);
        let score = scoreTextMatch(command.searchableText, queryModel);
        if (shortcut && compactQuery && shortcut.includes(compactQuery)) score -= 0.4;
        if (normalizeSearchText(command.displayName) === queryModel.normalized) score -= 1;

        return {
            id: `command:${command.id}`,
            providerId: 'commands',
            type: 'command',
            title: command.displayName,
            subtitle: `${command.category}${command.keyboardShortcut ? ` | ${command.keyboardShortcut}` : ''}`,
            description: command.description || '',
            disabled: command.canExecute === false,
            score,
            command
        };
    });
}

function buildReportProviderResults(queryModel) {
    const reports = getRecentReports()
        .filter((report) => {
            const text = `${report.name} ${report.data?.reportType || ''} ${report.data?.projectName || ''}`;
            return matchesQueryText(text, queryModel);
        });

    return reports.map((report) => ({
        id: `report:${report.id}`,
        providerId: 'reports',
        type: 'report',
        title: report.name,
        subtitle: `Report | ${report.data?.reportType || 'Unknown Type'}`,
        description: report.data?.projectName ? `Project: ${report.data.projectName}` : '',
        score: scoreTextMatch(`${report.name} ${report.data?.reportType || ''} ${report.data?.projectName || ''}`, queryModel),
        report
    }));
}

function buildTemplateProviderResults(queryModel) {
    const templates = Array.isArray(appState.userTemplates) ? appState.userTemplates : [];
    return templates
        .filter((template) => matchesQueryText(`${template.name} ${template.metadata?.source || ''} template`, queryModel))
        .map((template) => ({
            id: `template:${template.id}`,
            providerId: 'templates',
            type: 'template',
            title: template.name,
            subtitle: `Template | ${template.metadata?.source || 'user'}`,
            description: 'User template',
            score: scoreTextMatch(`${template.name} ${template.metadata?.source || ''}`, queryModel),
            template
        }));
}

function buildStandardsProviderResults(queryModel) {
    const standards = getImportedAccessibilityStandards();
    const results = [];

    standards.forEach((standard) => {
        const standardName = String(standard.displayName || standard.internalId || 'Imported Standard');
        if (matchesQueryText(standardName, queryModel)) {
            results.push({
                id: `standard:${standard.id}`,
                providerId: 'accessibility-standards',
                type: 'standard',
                title: standardName,
                subtitle: 'Accessibility Standard',
                description: `Criteria: ${Array.isArray(standard.criteria) ? standard.criteria.length : 0}`,
                score: scoreTextMatch(standardName, queryModel),
                standard
            });
        }

        (Array.isArray(standard.criteria) ? standard.criteria : []).forEach((criterion) => {
            const criterionText = `${criterion.number || ''} ${criterion.title || ''} ${criterion.desc || ''} ${standardName}`;
            if (!matchesQueryText(criterionText, queryModel)) return;

            results.push({
                id: `criterion:${standard.id}:${criterion.identifier || criterion.number || createId('criterion')}`,
                providerId: 'accessibility-standards',
                type: 'criterion',
                title: `${criterion.number || ''} ${criterion.title || ''}`.trim() || standardName,
                subtitle: `${standardName}${criterion.level ? ` | Level ${criterion.level}` : ''}`,
                description: String(criterion.desc || '').slice(0, 180),
                score: scoreTextMatch(criterionText, queryModel),
                standard,
                criterion
            });
        });
    });

    return results;
}

function buildShortcutProviderResults(queryModel) {
    return getShortcutDefinitions()
        .filter((item) => {
            const text = `${item.label} ${item.action} ${item.shortcut}`;
            return matchesQueryText(text, queryModel);
        })
        .map((item) => ({
            id: `shortcut:${item.action}`,
            providerId: 'shortcuts',
            type: 'shortcut',
            title: item.label,
            subtitle: item.shortcut || 'Unassigned',
            description: item.action,
            score: scoreTextMatch(`${item.label} ${item.shortcut} ${item.action}`, queryModel),
            shortcut: item
        }));
}

function buildWorkspaceProviderResults(queryModel) {
    const workspaces = getProjectWorkspaces();
    return workspaces
        .filter((workspace) => {
            const text = `${workspace.name} ${workspace.folderPath || ''} ${workspace.description || ''}`;
            return matchesQueryText(text, queryModel);
        })
        .map((workspace) => ({
            id: `workspace:${workspace.id}`,
            providerId: 'project-workspaces',
            type: 'workspace',
            title: workspace.name,
            subtitle: 'Project Workspace',
            description: workspace.folderPath || '',
            score: scoreTextMatch(`${workspace.name} ${workspace.folderPath || ''} ${workspace.description || ''}`, queryModel),
            workspace
        }));
}

function buildProjectAssetProviderResults(queryModel) {
    const workspaces = getProjectWorkspaces();
    const assets = [];

    workspaces.forEach((workspace) => {
        const projectAssets = Array.isArray(workspace.resources?.projectAssets) ? workspace.resources.projectAssets : [];
        projectAssets.forEach((asset) => {
            const text = `${asset.title || ''} ${asset.kind || ''} ${asset.tags || ''} ${workspace.name}`;
            if (!matchesQueryText(text, queryModel)) return;
            assets.push({
                id: `asset:${workspace.id}:${asset.id}`,
                providerId: 'project-assets',
                type: 'asset',
                title: asset.title || asset.path || 'Asset',
                subtitle: `${workspace.name} | ${asset.kind || 'asset'}`,
                description: asset.path || '',
                score: scoreTextMatch(text, queryModel),
                workspace,
                asset
            });
        });
    });

    return assets;
}

function buildHelpProviderResults(queryModel) {
    const candidates = [
        { id: 'help:user-guide', title: 'ART User Guide and Documentation', description: 'Integrated Help content and navigation.', anchor: '#help-heading' },
        { id: 'help:shortcuts', title: 'Keyboard Shortcuts', description: 'Shortcut tables and command references.', anchor: '#help-shortcuts' },
        { id: 'help:workspace', title: 'Project Workspace', description: 'Workspace lifecycle and resource guidance.', anchor: '#help-project-workspace' },
        { id: 'help:lookup', title: 'Accessibility Lookup Tool', description: 'Lookup search and criterion workflow details.', anchor: '#help-wcag-lookup' }
    ];

    return candidates
        .filter((topic) => matchesQueryText(`${topic.title} ${topic.description}`, queryModel))
        .map((topic) => ({
            id: topic.id,
            providerId: 'help-topics',
            type: 'help-topic',
            title: topic.title,
            subtitle: 'Help',
            description: topic.description,
            score: scoreTextMatch(`${topic.title} ${topic.description}`, queryModel),
            topic
        }));
}

function buildDashboardProviderResults(queryModel) {
    const widgets = Array.isArray(appState.dashboard?.visibleWidgetIds) ? appState.dashboard.visibleWidgetIds : [];
    return widgets
        .filter((widgetId) => matchesQueryText(`${widgetId} dashboard widget`, queryModel))
        .map((widgetId) => ({
            id: `dashboard-widget:${widgetId}`,
            providerId: 'dashboard-widgets',
            type: 'dashboard-widget',
            title: widgetId.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
            subtitle: 'Dashboard Widget',
            description: 'Visible dashboard widget',
            score: scoreTextMatch(`${widgetId} dashboard widget`, queryModel),
            widgetId
        }));
}

function buildResourceProviderResults(queryModel) {
    const registry = getResourceRegistrySnapshot();
    const groups = [
        { key: 'reports', label: 'Reports', items: registry.reports || [] },
        { key: 'templates', label: 'Templates', items: registry.templates || [] },
        { key: 'standards', label: 'Accessibility Standards', items: registry.standards || [] },
        { key: 'shortcuts', label: 'Keyboard Shortcuts', items: registry.shortcuts || [] },
        { key: 'visual-accessibility', label: 'Visual Accessibility', items: registry.visualAccessibility || [] },
        { key: 'saved-searches', label: 'Saved Searches', items: registry.savedSearches || [] }
    ];

    return groups.flatMap((group) => group.items.map((item) => {
        const searchableText = item.searchableText || `${item.name || ''} ${item.subtitle || ''} ${item.description || ''} ${item.category || ''}`;
        if (!matchesQueryText(searchableText, queryModel)) return null;

        return {
            id: `${group.key}:${item.id}`,
            providerId: 'resources',
            type: item.type || 'resource',
            title: item.title || item.name || group.label,
            subtitle: item.subtitle ? `${group.label} | ${item.subtitle}` : group.label,
            description: item.description || '',
            score: scoreTextMatch(searchableText, queryModel),
            resource: {
                ...item,
                group: group.key,
                groupLabel: group.label
            }
        };
    })).filter(Boolean);
}

function registerBuiltInProviders() {
    if (providerRegistry.size > 0) return;

    registerUniversalSearchProvider({
        id: 'commands',
        name: 'Commands',
        priority: 10,
        capabilities: {
            scopes: ['workspace', 'commands', 'global'],
            itemTypes: ['command'],
            advertisedFields: ['displayName', 'description', 'category', 'shortcut', 'action']
        },
        search: ({ queryModel, context }) => buildCommandProviderResults(queryModel, context)
    });

    registerUniversalSearchProvider({
        id: 'reports',
        name: 'Reports',
        priority: 20,
        capabilities: {
            scopes: ['workspace', 'reports'],
            itemTypes: ['report'],
            advertisedFields: ['name', 'reportType', 'projectName']
        },
        search: ({ queryModel }) => buildReportProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'templates',
        name: 'Templates',
        priority: 30,
        capabilities: {
            scopes: ['workspace', 'templates'],
            itemTypes: ['template'],
            advertisedFields: ['name', 'source']
        },
        search: ({ queryModel }) => buildTemplateProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'accessibility-standards',
        name: 'Accessibility Standards',
        priority: 40,
        capabilities: {
            scopes: ['workspace', 'standards'],
            itemTypes: ['standard', 'criterion'],
            advertisedFields: ['displayName', 'number', 'title', 'level', 'desc']
        },
        search: ({ queryModel }) => buildStandardsProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'shortcuts',
        name: 'Keyboard Shortcuts',
        priority: 50,
        capabilities: {
            scopes: ['workspace', 'shortcuts'],
            itemTypes: ['shortcut'],
            advertisedFields: ['label', 'action', 'shortcut']
        },
        search: ({ queryModel }) => buildShortcutProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'project-workspaces',
        name: 'Project Workspaces',
        priority: 60,
        capabilities: {
            scopes: ['workspace', 'project-workspace'],
            itemTypes: ['workspace'],
            advertisedFields: ['name', 'description', 'folderPath']
        },
        search: ({ queryModel }) => buildWorkspaceProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'project-assets',
        name: 'Project Assets',
        priority: 70,
        capabilities: {
            scopes: ['workspace', 'project-assets'],
            itemTypes: ['asset'],
            advertisedFields: ['title', 'kind', 'tags', 'path']
        },
        search: ({ queryModel }) => buildProjectAssetProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'help-topics',
        name: 'Help Topics',
        priority: 80,
        capabilities: {
            scopes: ['workspace', 'help'],
            itemTypes: ['help-topic'],
            advertisedFields: ['title', 'description']
        },
        search: ({ queryModel }) => buildHelpProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'dashboard-widgets',
        name: 'Dashboard Widgets',
        priority: 90,
        capabilities: {
            scopes: ['workspace', 'dashboard'],
            itemTypes: ['dashboard-widget'],
            advertisedFields: ['id', 'title']
        },
        search: ({ queryModel }) => buildDashboardProviderResults(queryModel)
    });

    registerUniversalSearchProvider({
        id: 'resources',
        name: 'Resources',
        priority: 95,
        capabilities: {
            scopes: ['workspace', 'global'],
            itemTypes: ['resource', 'report', 'template', 'standard', 'shortcut', 'saved-search', 'visual-accessibility-profile'],
            advertisedFields: ['name', 'title', 'type', 'category', 'subtitle', 'description']
        },
        search: ({ queryModel }) => buildResourceProviderResults(queryModel)
    });
}

function resolveProviderIdsForScope(scope) {
    switch (scope) {
        case 'commands': return ['commands'];
        case 'reports': return ['reports'];
        case 'templates': return ['templates'];
        case 'standards': return ['accessibility-standards'];
        case 'shortcuts': return ['shortcuts'];
        case 'project-workspace': return ['project-workspaces'];
        case 'project-assets': return ['project-assets'];
        case 'help': return ['help-topics'];
        case 'dashboard': return ['dashboard-widgets'];
        case 'current-project-workspace': return ['project-workspaces', 'project-assets', 'reports'];
        case 'current-report': return ['reports'];
        case 'workspace':
        case 'global':
        default:
            return getUniversalSearchProviders().map((provider) => provider.id);
    }
}

function resolveScope(scope, context = {}) {
    const requested = normalizeText(scope || context.scope || 'auto');
    if (requested && requested !== 'auto') return requested;

    const config = getUniversalSearchConfig();
    const preference = normalizeText(config.scopePreference || 'auto');

    if (preference === 'current-project-workspace') {
        return getActiveProjectWorkspace() ? 'current-project-workspace' : 'workspace';
    }

    if (preference === 'current-report') {
        return getActiveReportFromState() ? 'current-report' : 'workspace';
    }

    if (preference === 'entire-workspace') return 'workspace';
    if (preference === 'prompt') return 'workspace';

    return 'workspace';
}

function normalizeResult(result, provider, queryModel) {
    const source = result && typeof result === 'object' ? result : {};
    const title = normalizeText(source.title || source.label || source.name);
    const description = normalizeText(source.description || '');
    const searchable = `${title} ${source.subtitle || ''} ${description}`;

    return {
        id: normalizeText(source.id) || `${provider.id}:${createId('result')}`,
        providerId: provider.id,
        providerName: provider.name,
        type: normalizeText(source.type || provider.capabilities.itemTypes[0] || 'resource'),
        title: title || provider.name,
        subtitle: normalizeText(source.subtitle || provider.name),
        description,
        disabled: Boolean(source.disabled),
        score: Number.isFinite(Number(source.score)) ? Number(source.score) : scoreTextMatch(searchable, queryModel) + (provider.priority / 100),
        raw: source
    };
}

function dedupeResults(results) {
    const seen = new Set();
    return results.filter((result) => {
        const key = `${result.providerId}|${result.type}|${result.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function runUniversalSearch(query = '', options = {}) {
    initializeUniversalSearchFramework();

    const context = {
        source: normalizeText(options.source || 'universal-search'),
        scope: resolveScope(options.scope, options),
        shortcutMap: new Map(getShortcutDefinitions().map((item) => [item.action, item.shortcut]))
    };

    const queryModel = parseSearchQuery(query);
    const providerIds = Array.isArray(options.providerIds) && options.providerIds.length > 0
        ? options.providerIds.map((id) => normalizeText(id)).filter(Boolean)
        : resolveProviderIdsForScope(context.scope);

    const providers = providerIds
        .map((id) => providerRegistry.get(id))
        .filter(Boolean);

    const aggregate = [];

    providers.forEach((provider) => {
        try {
            const items = provider.search({ queryModel, context, options });
            const normalizedItems = Array.isArray(items)
                ? items.map((item) => normalizeResult(item, provider, queryModel))
                : [];
            aggregate.push(...normalizedItems);
        } catch (error) {
            aggregate.push({
                id: `${provider.id}:error`,
                providerId: provider.id,
                providerName: provider.name,
                type: 'error',
                title: `${provider.name} provider error`,
                subtitle: provider.name,
                description: String(error?.message || 'Unknown provider error'),
                disabled: true,
                score: 999,
                raw: { error }
            });
        }
    });

    const filtered = dedupeResults(aggregate)
        .sort((left, right) => {
            if (left.score !== right.score) return left.score - right.score;
            const providerSort = left.providerName.localeCompare(right.providerName, undefined, { sensitivity: 'base' });
            if (providerSort !== 0) return providerSort;
            return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
        });

    const limited = Number.isFinite(Number(options.limit))
        ? filtered.slice(0, Math.max(1, Number(options.limit)))
        : filtered;

    const groupedCounts = limited.reduce((acc, item) => {
        acc[item.providerId] = Number(acc[item.providerId] || 0) + 1;
        return acc;
    }, {});

    const session = {
        id: createId('search-session'),
        query: queryModel.raw,
        scope: context.scope,
        filters: {},
        sortBy: 'relevance',
        sortDirection: 'desc',
        results: limited,
        selectedResultIndex: limited.length > 0 ? 0 : -1,
        selectedMatchIndex: 0,
        navigationHistory: [],
        highlights: [],
        resultCounts: groupedCounts
    };

    setActiveUniversalSearchSession(session, {
        action: `Ran universal search for ${queryModel.raw || 'all resources'}`,
        persist: true
    });

    if (queryModel.hasQuery) {
        recordUniversalSearchHistory({
            id: createId('search-history'),
            query: queryModel.raw,
            scope: context.scope,
            workspaceId: String(appState.activeWorkspaceId || ''),
            reportId: String(appState.selectedReportId || ''),
            resultCount: limited.length,
            searchedAt: new Date().toISOString()
        }, {
            persist: true
        });
    }

    return {
        query: queryModel.raw,
        scope: context.scope,
        providerIds,
        resultCounts: groupedCounts,
        totalResults: limited.length,
        results: limited,
        session
    };
}

function ensureSearchDialogElements() {
    if (dialogState?.dialog instanceof HTMLElement) return dialogState;

    let dialog = document.getElementById('search-everywhere-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'search-everywhere-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'search-everywhere-heading');
        dialog.hidden = true;
        dialog.className = 'command-palette-dialog';
        dialog.innerHTML = `
            <div class="command-palette-header">
                <button id="btn-search-everywhere-close" type="button">Close</button>
                <h2 id="search-everywhere-heading">Search Everywhere</h2>
            </div>
            <p id="search-everywhere-description">Search commands, reports, templates, workspaces, help topics, and accessibility standards.</p>
            <label for="search-everywhere-input">Search</label>
            <input id="search-everywhere-input" type="search" autocomplete="off" spellcheck="false" aria-controls="search-everywhere-results" aria-describedby="search-everywhere-status" />
            <p id="search-everywhere-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div id="search-everywhere-results" role="listbox" aria-label="Universal search results"></div>
            <div class="viewer-dialog-actions" role="group" aria-label="Universal search actions">
                <button id="btn-search-everywhere-save" type="button">Save Search</button>
                <button id="btn-search-everywhere-saved" type="button">Saved Searches</button>
                <button id="btn-search-everywhere-clear-history" type="button">Clear History</button>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    const closeButton = document.getElementById('btn-search-everywhere-close');
    const input = document.getElementById('search-everywhere-input');
    const status = document.getElementById('search-everywhere-status');
    const results = document.getElementById('search-everywhere-results');
    const saveButton = document.getElementById('btn-search-everywhere-save');
    const savedButton = document.getElementById('btn-search-everywhere-saved');
    const clearHistoryButton = document.getElementById('btn-search-everywhere-clear-history');

    if (!(dialog instanceof HTMLElement) || !(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) {
        return null;
    }

    const controller = createSearchResultsController({
        container: results,
        statusElement: status,
        idPrefix: 'search-everywhere',
        listboxLabel: 'Universal search results',
        itemClass: 'command-palette-option',
        itemActiveClass: 'command-palette-option--active',
        itemDisabledClass: 'command-palette-option--disabled',
        titleClass: 'command-palette-option-name',
        subtitleClass: 'command-palette-option-shortcut',
        descriptionClass: 'command-palette-option-description',
        emptyClass: 'command-palette-empty',
        emptyMessage: 'No matching search results found.',
        onActivate: (result) => {
            executeUniversalSearchResult(result);
        },
        onSelectionChange: () => {
            input.setAttribute('aria-activedescendant', controller.getActiveOptionId() || '');
        }
    });

    dialogState = {
        dialog,
        closeButton,
        input,
        status,
        results,
        saveButton,
        savedButton,
        clearHistoryButton,
        controller,
        lastTrigger: null,
        scope: 'workspace'
    };

    if (!dialog.dataset.searchBound) {
        dialog.dataset.searchBound = 'true';

        closeButton?.addEventListener('click', () => closeSearchEverywhereDialog(true));

        input.addEventListener('input', () => {
            const output = runUniversalSearch(input.value, {
                source: 'search-everywhere-dialog',
                scope: dialogState?.scope || 'workspace',
                limit: 60
            });
            controller.setResults(output.results.map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: `${item.providerName}${item.subtitle ? ` | ${item.subtitle}` : ''}`,
                description: item.description,
                disabled: item.disabled,
                result: item
            })));
            input.setAttribute('aria-activedescendant', controller.getActiveOptionId() || '');
            const scopeLabel = String(dialogState?.scope || 'workspace').replace(/-/g, ' ');
            if (dialogState?.status) {
                dialogState.status.textContent = `${output.totalResults} result${output.totalResults === 1 ? '' : 's'} in ${scopeLabel}.`;
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeSearchEverywhereDialog(true);
                return;
            }
            controller.handleKeydown(event);
        });

        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeSearchEverywhereDialog(true);
            }
        });

        saveButton?.addEventListener('click', () => {
            const query = normalizeText(input.value);
            if (!query) {
                announce('Enter a search query before saving.');
                return;
            }
            const name = window.prompt('Save search as:', query);
            if (!name) return;
            saveUniversalSearch({
                id: createId('saved-search'),
                name,
                query,
                scope: 'workspace'
            });
            announce(`Saved search ${name}.`);
        });

        savedButton?.addEventListener('click', () => {
            const config = getUniversalSearchConfig();
            const searches = Array.isArray(config.savedSearches) ? config.savedSearches : [];
            if (!searches.length) {
                announce('No saved searches available.');
                return;
            }
            const list = searches.map((item, index) => `${index + 1}. ${item.name} (${item.query})`).join('\n');
            const choice = window.prompt(`Select a saved search by number:\n${list}`);
            const index = Number(choice) - 1;
            if (!Number.isFinite(index) || index < 0 || index >= searches.length) return;
            const selected = searches[index];
            input.value = selected.query;
            input.dispatchEvent(new Event('input'));
            announce(`Loaded saved search ${selected.name}.`);
        });

        clearHistoryButton?.addEventListener('click', () => {
            clearUniversalSearchHistory();
            announce('Universal search history cleared.');
        });
    }

    return dialogState;
}

function focusSearchDialogInput() {
    const state = ensureSearchDialogElements();
    if (!state) return false;
    window.setTimeout(() => {
        state.input.focus();
        state.input.select();
    }, 0);
    return true;
}

export function openSearchEverywhereDialog(trigger = null, prefillQuery = '', scope = 'workspace') {
    initializeUniversalSearchFramework();
    const state = ensureSearchDialogElements();
    if (!state) return false;

    if (trigger) state.lastTrigger = trigger;
    state.scope = normalizeText(scope || 'workspace') || 'workspace';

    state.dialog.hidden = false;
    state.input.value = normalizeText(prefillQuery);
    state.input.dispatchEvent(new Event('input'));
    focusSearchDialogInput();
    announce('Search Everywhere opened.');
    return true;
}

export function closeSearchEverywhereDialog(restoreFocus = true) {
    const state = ensureSearchDialogElements();
    if (!state) return false;

    state.dialog.hidden = true;
    state.controller.setResults([]);
    state.input.value = '';
    state.input.removeAttribute('aria-activedescendant');

    if (restoreFocus && state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
        state.lastTrigger.focus();
    }
    return true;
}

export function getActiveUniversalSearchSession() {
    return getUniversalSearchConfig().activeSession;
}

export function moveUniversalSearchSelection(delta = 1) {
    const config = getUniversalSearchConfig();
    const session = config.activeSession;
    const results = Array.isArray(session.results) ? session.results : [];
    if (!results.length) return null;

    const current = Number(session.selectedResultIndex || 0);
    const next = ((current + Number(delta || 0)) % results.length + results.length) % results.length;
    const updated = {
        ...session,
        selectedResultIndex: next,
        navigationHistory: [...(session.navigationHistory || []), {
            at: new Date().toISOString(),
            resultId: results[next].id,
            direction: Number(delta || 0) > 0 ? 'next' : 'previous'
        }].slice(-100)
    };

    setActiveUniversalSearchSession(updated, {
        action: 'Moved active universal search result',
        persist: true
    });

    return updated;
}

export function executeUniversalSearchResult(result) {
    const item = result?.result || result;
    if (!item || typeof item !== 'object') return false;

    if (item.type === 'command' && item.raw?.command?.id) {
        void commandExecutionService.executeCommand(item.raw.command.id, {
            source: 'universal-search',
            invocation: 'result-activation'
        });
        return true;
    }

    if (item.type === 'report' && item.raw?.report?.id) {
        const select = document.getElementById('recent-reports-select');
        if (select instanceof HTMLSelectElement) {
            select.value = item.raw.report.id;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    if (item.type === 'help-topic') {
        const helpButton = document.getElementById('btn-help');
        helpButton?.click();
        const anchor = item.raw?.topic?.anchor;
        if (anchor) {
            window.setTimeout(() => {
                const target = document.querySelector(anchor);
                if (target instanceof HTMLElement) {
                    target.scrollIntoView({ block: 'start' });
                    target.focus();
                }
            }, 0);
        }
        return true;
    }

    return false;
}

function clearHighlights() {
    activeHighlights.forEach((highlight) => {
        const textNode = document.createTextNode(highlight.textContent || '');
        highlight.replaceWith(textNode);
    });
    activeHighlights = [];
}

export function clearUniversalSearchHighlights() {
    clearHighlights();
    announce('Cleared search highlights.');
    return true;
}

function highlightMatchesInElement(container, query) {
    if (!(container instanceof HTMLElement)) return 0;
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 0;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node || !node.nodeValue || !normalizeText(node.nodeValue)) continue;
        textNodes.push(node);
    }

    let count = 0;
    textNodes.forEach((node) => {
        const text = node.nodeValue || '';
        const lower = text.toLowerCase();
        const matchIndex = lower.indexOf(normalizedQuery.toLowerCase());
        if (matchIndex < 0) return;

        const before = text.slice(0, matchIndex);
        const match = text.slice(matchIndex, matchIndex + normalizedQuery.length);
        const after = text.slice(matchIndex + normalizedQuery.length);

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match;
        fragment.appendChild(mark);
        activeHighlights.push(mark);

        if (after) fragment.appendChild(document.createTextNode(after));

        node.parentNode?.replaceChild(fragment, node);
        count += 1;
    });

    return count;
}

function getCurrentSearchContainer() {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dashboard = document.getElementById('dashboard');
    const main = document.getElementById('main-content');
    const lookup = document.getElementById('lookup-tool');

    if (active?.closest('#dashboard')) return dashboard;
    if (active?.closest('#lookup-tool')) return lookup;
    return main || dashboard || lookup;
}

export function findInCurrentResource(query = '') {
    const config = getUniversalSearchConfig();
    const activeQuery = normalizeText(query || config.activeSession?.query || '');
    const container = getCurrentSearchContainer();

    clearHighlights();
    const count = highlightMatchesInElement(container, activeQuery);
    announce(count > 0
        ? `Found ${count} match${count === 1 ? '' : 'es'} in current resource.`
        : 'No matches found in current resource.');

    return { ok: true, count, query: activeQuery };
}

export function initializeUniversalSearchFramework() {
    if (initialized) return true;
    registerBuiltInProviders();
    initialized = true;
    return true;
}
