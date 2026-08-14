import {
    addImportedAccessibilityStandard,
    announce,
    appState,
    clearImportedAccessibilityStandards,
    canPerformExternalCommunication,
    createArtBackupPayload,
    createRestorePoint,
    findImportedStandardConflict,
    findShortcutConflict,
    getAnalyticsConfig,
    getUniversalSearchConfig,
    updateUniversalSearchConfig,
    clearUniversalSearchHistory,
    clearRecentItems,
    getNavigationHistory,
    updateNavigationHistory,
    clearNavigationHistoryEntries,
    getSearchAnalytics,
    setSearchAnalyticsEnabled,
    clearSearchAnalytics,
    getApplicationInfo,
    getAssignableActions,
    getCollaborationConfig,
    getActiveProjectWorkspace,
    getIntegrationStatusMap,
    getImportedAccessibilityStandards,
    getWorkspaceViewConfig,
    importReportWithConflictStrategy,
    importTemplateWithConflictStrategy,
    getRestorePoints,
    getSecurityConfig,
    getShortcutDefinitions,
    redoState,
    removeImportedAccessibilityStandard,
    replaceImportedAccessibilityStandard,
    restoreArtBackupPayload,
    restoreFromPoint,
    setNetworkActivity,
    resetAllApplicationData,
    resetShortcutsToDefault,
    resetShortcutForAction,
    resetUserPreferences,
    getVisualAccessibilityConfig,
    resetVisualAccessibilityConfig,
    reportNameExists,
    recordSecurityAudit,
    serializeAccessibilityStandardsJsonPayload,
    undoState,
    updateImportedAccessibilityStandard,
    updateCollaborationConfig,
    updateWorkspaceViewConfig,
    updateSecurityConfig,
    updateAnalyticsConfig,
    updateVisualAccessibilityConfig,
    updateShortcut,
    templateNameExists,
    validateArtJsonPayload,
    validateTemplateJsonPayload,
    validateAccessibilityStandardPayload
} from './state.js';
import {
    clearCollaborationSessions,
    connectCollaborationLiveServer,
    createCollaborationDiscoverySnapshot,
    disconnectCollaborationLiveServer,
    getCollaborationConflictSummary,
    getCollaborationLiveConnectionSnapshot,
    getCollaborationProviders,
    getCollaborationSessionSummary,
    publishCollaborationWorkspaceSnapshot,
    queueCollaborationConflict,
    requestCollaborationWorkspaceSnapshot,
    resolveCollaborationConflict,
    startLiveCollaborationSession,
    upsertCollaborationSession
} from './collaborationFramework.js';
import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import {
    disablePlugin,
    enablePlugin,
    exportPluginFrameworkState,
    getPluginFrameworkDiagnostics,
    getPluginFrameworkSnapshot,
    importPluginFrameworkState,
    registerPackageFromWorkflow,
    registerPluginManifest,
    syncFrameworkPackagesFromState,
    uninstallPlugin,
    validatePluginManifest,
    validateRegisteredExtensions
} from './pluginFramework.js';

let isInitialized = false;
let activeSubDialog = null;
let pendingShortcutUpdate = null;
let pendingImportedStandard = null;
let pendingImportedStandards = null;
let pendingEditedStandard = null;
let pendingEditedStandardJson = null;
let pendingOverwrite = false;
let pendingClearStandards = false;
let lastTrigger = null;
let statusTick = 0;
let startSettingsStandardImportPicker = null;
let openSettingsPasteStandardsDialog = null;
let startSettingsReportImportPicker = null;
let startSettingsTemplateImportPicker = null;
let toggleSettingsPrivacyMode = null;
let createSettingsBackupNow = null;
let openSettingsResetDialog = null;
let pendingVisualAccessibilitySnapshot = null;
let pendingVisualAccessibilityDirty = false;
let isRefreshingSettingsView = false;
let liveAutoConnectAttempted = false;

async function executeSettingsAction(action, context = {}) {
    const command = commandRegistry.findCommands({ action })[0] || null;
    if (!command?.id) return null;
    return commandExecutionService.executeCommand(command.id, {
        source: 'settings',
        action,
        ...context
    });
}

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function getShortcutFromEvent(event) {
    if (event.key === 'Escape') return '';
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return '';

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    let key = event.key;
    if (/^f\d+$/i.test(key)) {
        key = key.toUpperCase();
    } else if (key.length === 1) {
        key = key.toUpperCase();
    } else if (key === ' ') {
        key = 'Space';
    } else {
        key = key[0].toUpperCase() + key.slice(1).toLowerCase();
    }

    parts.push(key);
    return parts.join('+');
}

function isBrowserReservedShortcut(shortcut) {
    const reservedShortcuts = ['Ctrl+L', 'Ctrl+T', 'Ctrl+W', 'Ctrl+R', 'Ctrl+P', 'Ctrl+N', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+Shift+N', 'Ctrl+Shift+T', 'Alt+F4'];
    const normalized = String(shortcut || '').trim().toLowerCase();
    return reservedShortcuts.some((reserved) => reserved.toLowerCase() === normalized);
}

function normalizeTableHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return '';
}

function createStandardIdSeed(value) {
    return String(value || 'imported-standard')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'imported-standard';
}

function splitTableRow(line, delimiter) {
    const text = String(line || '').trim();
    if (!text) return [];

    if (delimiter === '\t') {
        return text.split('\t').map((cell) => String(cell || '').trim());
    }

    if (delimiter === '|') {
        const stripped = text.startsWith('|') ? text.slice(1) : text;
        const normalized = stripped.endsWith('|') ? stripped.slice(0, -1) : stripped;
        return normalized.split('|').map((cell) => String(cell || '').trim());
    }

    return [text];
}

function isMarkdownSeparatorRow(line) {
    return /^[:\-\s|]+$/.test(String(line || '').trim());
}

function parsePastedStandardsTable(text) {
    const cleaned = String(text || '').replace(/\r/g, '').trim();
    if (!cleaned || /^\s*[\[{]/.test(cleaned)) return null;

    const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    const hasTabs = lines.some((line) => line.includes('\t'));
    const hasPipes = lines.some((line) => line.includes('|'));
    const delimiter = hasTabs ? '\t' : hasPipes ? '|' : null;
    if (!delimiter) return null;

    const tableLines = delimiter === '|'
        ? lines.filter((line) => !isMarkdownSeparatorRow(line))
        : lines;

    if (tableLines.length < 2) return null;

    const headers = splitTableRow(tableLines[0], delimiter).map(normalizeTableHeader);
    if (headers.length < 2) return null;

    const groups = new Map();

    tableLines.slice(1).forEach((line) => {
        const values = splitTableRow(line, delimiter);
        if (values.length === 0 || values.every((value) => !String(value || '').trim())) return;

        const row = {};
        headers.forEach((header, index) => {
            if (!header) return;
            row[header] = String(values[index] || '').trim();
        });

        const displayName = firstNonEmpty(
            row.standardname,
            row.standard,
            row.displayname,
            row.name,
            row.accessibilitystandard
        );
        const version = firstNonEmpty(row.version, row.standardversion);
        const source = firstNonEmpty(row.source, row.standardsource);
        const internalId = firstNonEmpty(row.internalid, row.identifier, row.id, row.standardid);
        const criterionNumber = firstNonEmpty(row.number, row.criterionnumber, row.requirementnumber, row.section);
        const criterionTitle = firstNonEmpty(row.title, row.criteriontitle, row.requirementtitle, row.requirement);
        const criterionDescription = firstNonEmpty(row.description, row.desc, row.details, row.text);

        const groupKey = firstNonEmpty(internalId, displayName, version, source).toLowerCase() || `row-${groups.size}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                internalId,
                displayName,
                version,
                source,
                criteria: []
            });
        }

        const criterion = {
            number: criterionNumber,
            title: criterionTitle,
            level: firstNonEmpty(row.level, row.conformancelevel),
            desc: criterionDescription,
            understandingUrl: firstNonEmpty(row.understandingurl, row.reference, row.link, row.url),
            recommendationUrl: firstNonEmpty(row.recommendationurl, row.recommendation),
            failures: firstNonEmpty(row.failures, row.failure),
            fixes: firstNonEmpty(row.fixes, row.fix),
            disabilitie: firstNonEmpty(row.disabilitie, row.disability, row.disabilities),
            categories: firstNonEmpty(row.categories, row.category),
            tags: firstNonEmpty(row.tags)
                ? firstNonEmpty(row.tags).split(/[|;,]/).map((tag) => tag.trim()).filter(Boolean)
                : []
        };

        if (!criterion.number && !criterion.title && !criterion.desc) return;

        groups.get(groupKey).criteria.push(criterion);
    });

    const standards = [...groups.values()]
        .filter((standard) => standard.criteria.length > 0)
        .map((standard) => ({
            ...standard,
            displayName: standard.displayName || standard.internalId || 'Imported Standard',
            internalId: standard.internalId || createStandardIdSeed(`${standard.displayName || 'Imported Standard'}-${standard.version || ''}-${standard.source || ''}`)
        }));

    return standards.length > 0 ? standards : null;
}

function writeStatus(text) {
    const status = document.getElementById('settings-status');
    if (!status) return;
    statusTick += 1;
    const suffix = statusTick % 2 === 0 ? ' ' : '  ';
    status.textContent = '';
    window.setTimeout(() => {
        status.textContent = `${text}${suffix}`;
        announce(`${text}${suffix}`);
    }, 20);
}

function openSubDialog(dialog, focusTarget, trigger) {
    activeSubDialog = {
        dialog,
        trigger: trigger || document.activeElement
    };
    dialog.hidden = false;
    window.setTimeout(() => {
        if (focusTarget) {
            focusTarget.focus();
            return;
        }
        getFocusableElements(dialog)[0]?.focus();
    }, 0);
}

function closeSubDialog(restoreFocus = true) {
    if (!activeSubDialog) return;
    const dialog = activeSubDialog.dialog;
    const trigger = activeSubDialog.trigger;
    dialog.hidden = true;
    activeSubDialog = null;
    if (restoreFocus) {
        if (trigger && typeof trigger.focus === 'function') {
            trigger.focus();
            return;
        }
        const settingsDialog = document.getElementById('app-settings-dialog');
        getFocusableElements(settingsDialog)[0]?.focus();
    }
}

// Filters top-level settings sections by heading and visible text so options stay discoverable.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMilliseconds(value) {
    const ms = Number(value) || 0;
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)} seconds` : `${ms.toFixed(1)} ms`;
}

function renderSearchAnalytics() {
    const summary = document.getElementById('settings-search-analytics-summary');
    const body = document.getElementById('settings-search-analytics-body');
    const providerBody = document.getElementById('settings-search-provider-body');
    const enabledCheckbox = document.getElementById('settings-search-analytics-enabled');
    if (!body || !providerBody) return;

    const analytics = getSearchAnalytics();
    if (enabledCheckbox) enabledCheckbox.checked = analytics.enabled !== false;

    const successRate = analytics.totalSearches > 0
        ? Math.round(((analytics.totalSearches - analytics.noResultSearches) / analytics.totalSearches) * 100)
        : 0;
    const averageDuration = analytics.totalSearches > 0 ? analytics.totalDurationMs / analytics.totalSearches : 0;

    if (summary) {
        summary.textContent = analytics.enabled === false
            ? 'Search analytics collection is off. Existing totals are kept until you clear them.'
            : analytics.totalSearches === 0
                ? 'No searches recorded yet. Search analytics are stored only on this device.'
                : `${analytics.totalSearches} searches recorded on this device. ${successRate}% returned at least one result, and ${analytics.resultSelections} ${analytics.resultSelections === 1 ? 'result was' : 'results were'} opened.`;
    }

    const rows = [
        ['Searches recorded', String(analytics.totalSearches)],
        ['Searches with results', String(analytics.totalSearches - analytics.noResultSearches)],
        ['Searches with no results', String(analytics.noResultSearches)],
        ['Searches that returned a result', `${successRate}%`],
        ['Results opened', String(analytics.resultSelections)],
        ['Average search time', formatMilliseconds(averageDuration)]
    ];
    body.innerHTML = rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');

    const providerRows = Object.entries(analytics.providerStats || {})
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([providerId, stats]) => {
            const average = stats.runs > 0 ? stats.totalDurationMs / stats.runs : 0;
            const errorRate = stats.runs > 0 ? stats.errors / stats.runs : 0;
            const status = stats.errors === 0 ? 'Available' : errorRate >= 0.5 ? 'Failing' : 'Degraded';
            return `<tr><th scope="row">${escapeHtml(providerId)}</th><td>${escapeHtml(status)}</td><td>${stats.runs}</td><td>${escapeHtml(formatMilliseconds(average))}</td><td>${stats.errors}</td></tr>`;
        });

    providerBody.innerHTML = providerRows.length > 0
        ? providerRows.join('')
        : '<tr><td colspan="5">No provider activity recorded yet.</td></tr>';
}

function bindSearchAnalyticsSettings() {
    const applyButton = document.getElementById('btn-settings-search-analytics-apply');
    const clearButton = document.getElementById('btn-settings-search-analytics-clear');
    const enabledCheckbox = document.getElementById('settings-search-analytics-enabled');

    applyButton?.addEventListener('click', () => {
        setSearchAnalyticsEnabled(Boolean(enabledCheckbox?.checked));
        writeStatus('Search analytics setting applied.');
        renderSearchAnalytics();
    });

    clearButton?.addEventListener('click', () => {
        clearSearchAnalytics();
        writeStatus('Search analytics cleared.');
        renderSearchAnalytics();
    });
}

function bindSettingsSearch() {
    const input = document.getElementById('settings-search-filter');
    const status = document.getElementById('settings-search-filter-status');
    const dialog = document.getElementById('app-settings-dialog');
    if (!(input instanceof HTMLInputElement) || !dialog) return;

    const getSections = () => [...dialog.querySelectorAll(':scope > section[aria-labelledby]')];

    input.addEventListener('input', () => {
        const query = String(input.value || '').trim().toLowerCase();
        const sections = getSections();

        if (!query) {
            sections.forEach((section) => { section.hidden = false; });
            if (status) status.textContent = '';
            return;
        }

        let matches = 0;
        sections.forEach((section) => {
            const text = String(section.textContent || '').toLowerCase();
            const isMatch = text.includes(query);
            section.hidden = !isMatch;
            if (isMatch) matches += 1;
        });

        if (status) {
            status.textContent = matches > 0
                ? `${matches} settings section${matches === 1 ? '' : 's'} match.`
                : 'No settings match your search.';
        }
    });
}

function renderShortcuts() {
    const body = document.getElementById('settings-shortcuts-body');
    if (!body) return;

    const assigned = new Map(getShortcutDefinitions().map((definition) => [definition.action, definition.shortcut]));
    const sortedActions = [...getAssignableActions()].sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }));
    body.innerHTML = sortedActions.map((definition) => `
        <tr>
            <td>${definition.label}</td>
            <td>
                <input
                    id="settings-shortcut-input-${definition.action}"
                    type="text"
                    value="${assigned.get(definition.action) || ''}"
                    readonly
                    aria-label="Shortcut for ${definition.label}"
                >
            </td>
            <td>
                <button
                    type="button"
                    data-shortcut-action="${definition.action}"
                    aria-label="Change ${definition.label}"
                >Change ${definition.label}</button>
                <button
                    type="button"
                    data-shortcut-reset-action="${definition.action}"
                    aria-label="Reset ${definition.label} to default"
                >Reset ${definition.label}</button>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('[data-shortcut-action]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-shortcut-action');
            const input = document.getElementById(`settings-shortcut-input-${action}`);
            if (!action || !input) return;
            pendingShortcutUpdate = { action, input };
            input.value = 'Press shortcut...';
            input.focus();
            writeStatus('Press the new shortcut now.');
        });
    });

    body.querySelectorAll('[data-shortcut-reset-action]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-shortcut-reset-action');
            if (!action) return;
            const result = resetShortcutForAction(action);
            if (!result.ok) return;
            renderShortcuts();
            const message = result.shortcut
                ? `${result.label} reset to ${result.shortcut}.`
                : `${result.label} reset to no shortcut.`;
            writeStatus(message);
            announce(message);
            document.querySelector(`[data-shortcut-reset-action="${action}"]`)?.focus();
        });
    });
}

function renderImportedStandards() {
    const list = document.getElementById('settings-standards-list');
    const count = document.getElementById('settings-standards-count');
    const exportButton = document.getElementById('btn-settings-export-standards');
    const clearButton = document.getElementById('btn-settings-clear-standards');
    if (!list) return;
    const imported = getImportedAccessibilityStandards();
    if (count) {
        count.textContent = `(${imported.length})`;
    }
    if (exportButton) {
        exportButton.disabled = imported.length === 0;
    }
    if (clearButton) {
        clearButton.disabled = imported.length === 0;
    }
    if (imported.length === 0) {
        list.innerHTML = '<li>No imported accessibility standards.</li>';
        return;
    }

    list.innerHTML = imported.map((standard) => `
        <li>
            <strong>${standard.displayName}</strong>
            <span> (${standard.version || 'No version'})</span>
            <div>${standard.criteria.length} criteria${standard.source ? ` · Source: ${standard.source}` : ''}${standard.importedAt ? ` · Imported: ${standard.importedAt.slice(0, 10)}` : ''}</div>
            <button type="button" data-edit-standard-id="${standard.id}">Edit JSON</button>
            <button type="button" data-copy-standard-id="${standard.id}">Copy JSON</button>
            <button type="button" data-export-standard-id="${standard.id}">Export</button>
            <button type="button" data-remove-standard-id="${standard.id}">Remove</button>
        </li>
    `).join('');

    list.querySelectorAll('[data-edit-standard-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const standardId = button.getAttribute('data-edit-standard-id');
            const standard = imported.find((item) => item.id === standardId);
            if (!standard) return;
            pendingEditedStandard = standard;
            pendingEditedStandardJson = JSON.stringify(standard, null, 2);
            const jsonDialog = document.getElementById('settings-standard-json-dialog');
            const jsonInput = document.getElementById('settings-standard-json-input');
            if (jsonInput) jsonInput.value = pendingEditedStandardJson;
            openSubDialog(jsonDialog, jsonInput, button);
        });
    });

    list.querySelectorAll('[data-remove-standard-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const standardId = button.getAttribute('data-remove-standard-id');
            const removed = removeImportedAccessibilityStandard(standardId || '');
            if (!removed) return;
            renderImportedStandards();
            renderAbout();
            writeStatus(`Removed accessibility standard ${removed.displayName}.`);
        });
    });

    list.querySelectorAll('[data-export-standard-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const standardId = button.getAttribute('data-export-standard-id');
            const standard = imported.find((item) => item.id === standardId);
            if (!standard) return;
            try {
                const payload = serializeAccessibilityStandardsJsonPayload([standard]);
                const blob = new Blob([payload], { type: 'application/json' });
                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const fileName = `${String(standard.displayName || 'standard').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'standard'}.json`;

                link.href = objectUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);
                writeStatus(`Exported ${standard.displayName}.`);
            } catch (error) {
                writeStatus(`Export failed for ${standard.displayName}.`);
            }
        });
    });

    list.querySelectorAll('[data-copy-standard-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            const standardId = button.getAttribute('data-copy-standard-id');
            const standard = imported.find((item) => item.id === standardId);
            if (!standard) return;

            try {
                const payload = serializeAccessibilityStandardsJsonPayload([standard]);
                await navigator.clipboard.writeText(payload);
                writeStatus(`Copied ${standard.displayName} JSON to the clipboard.`);
            } catch (error) {
                writeStatus(`Copy failed for ${standard.displayName}.`);
            }
        });
    });
}

function exportImportedStandards() {
    const imported = getImportedAccessibilityStandards();
    if (imported.length === 0) {
        writeStatus('No imported accessibility standards to export.');
        return;
    }

    try {
        const payload = serializeAccessibilityStandardsJsonPayload(imported);
        const blob = new Blob([payload], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `art-accessibility-standards-${new Date().toISOString().slice(0, 10)}.json`;

        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        writeStatus(`Exported ${imported.length} accessibility standard${imported.length === 1 ? '' : 's'}.`);
    } catch (error) {
        writeStatus('Export failed. Could not create standards backup.');
    }
}

function renderAbout() {
    const aboutList = document.getElementById('settings-about-list');
    if (!aboutList) return;
    const info = getApplicationInfo();
    const importedNames = info.importedStandards.length > 0
        ? info.importedStandards.map((standard) => standard.displayName).join(', ')
        : 'None';
    const importedCount = info.importedStandards.length;
    const privacyMode = Boolean(info.security?.privacyModeEnabled) ? 'Enabled' : 'Disabled';

    aboutList.innerHTML = `
        <div><dt>Application</dt><dd>${info.applicationName}</dd></div>
        <div><dt>Version</dt><dd>Version ${info.version}</dd></div>
        <div><dt>Build Date</dt><dd>${info.buildDate || 'Unavailable'}</dd></div>
        <div><dt>Data Schema Version</dt><dd>${info.dataSchemaVersion}</dd></div>
        <div><dt>Imported Accessibility Standard Count</dt><dd>${importedCount}</dd></div>
        <div><dt>Imported Accessibility Standards</dt><dd>${importedNames}</dd></div>
        <div><dt>Privacy Mode</dt><dd>${privacyMode}</dd></div>
    `;
}

function renderPluginManager() {
    const pluginList = document.getElementById('settings-plugins-list');
    const packageList = document.getElementById('settings-packages-list');
    const status = document.getElementById('settings-plugin-manager-status');
    if (!pluginList || !packageList || !status) return;
    const snapshot = getPluginFrameworkSnapshot();

    if (!Array.isArray(snapshot.plugins) || snapshot.plugins.length === 0) {
        pluginList.innerHTML = '<li>No plugins discovered.</li>';
    } else {
        pluginList.innerHTML = snapshot.plugins.map((plugin) => {
            const toggleLabel = plugin.enabled ? 'Disable' : 'Enable';
            const uninstallDisabled = plugin.origin === 'builtin' ? 'disabled' : '';
            const dependencySummary = Array.isArray(plugin.dependencies) && plugin.dependencies.length > 0
                ? plugin.dependencies.map((entry) => {
                    if (typeof entry === 'string') return entry;
                    const optional = entry.optional ? ' (optional)' : '';
                    const version = entry.version ? ` >= ${entry.version}` : '';
                    return `${entry.pluginId}${version}${optional}`;
                }).join(', ')
                : 'None';
            const permissionSummary = Array.isArray(plugin.permissions) && plugin.permissions.length > 0
                ? plugin.permissions.join(', ')
                : 'None';
            const dependencyIssues = Array.isArray(plugin.dependencyIssues) && plugin.dependencyIssues.length > 0
                ? plugin.dependencyIssues.map((issue) => issue.message).join(' | ')
                : '';
            return `
                <li>
                    <strong>${plugin.displayName}</strong> (${plugin.version})
                    <div>Identifier: ${plugin.pluginId}</div>
                    <div>Status: ${plugin.status}${plugin.origin ? ` · ${plugin.origin}` : ''}</div>
                    <div>Supported ART Version: ${plugin.supportedArtVersion || 'Any'}</div>
                    <div>Dependencies: ${dependencySummary}</div>
                    <div>Permissions: ${permissionSummary}</div>
                    ${dependencyIssues ? `<div>Dependency diagnostics: ${dependencyIssues}</div>` : ''}
                    <div class="viewer-dialog-actions" role="group" aria-label="Plugin actions for ${plugin.displayName}">
                        <button type="button" data-plugin-toggle-id="${plugin.pluginId}">${toggleLabel}</button>
                        <button type="button" data-plugin-uninstall-id="${plugin.pluginId}" ${uninstallDisabled}>Uninstall</button>
                    </div>
                </li>
            `;
        }).join('');
    }

    if (!Array.isArray(snapshot.packages) || snapshot.packages.length === 0) {
        packageList.innerHTML = '<li>No packages registered.</li>';
    } else {
        packageList.innerHTML = snapshot.packages.map((pkg) => `
            <li>
                <strong>${pkg.displayName}</strong> (${pkg.version})
                <div>Type: ${pkg.packageType}</div>
                <div>Source workflow: ${pkg.sourceWorkflow || 'unknown'}</div>
                <div>Resources: ${Array.isArray(pkg.resources) ? pkg.resources.length : 0}</div>
            </li>
        `).join('');
    }

    const diagnostics = getPluginFrameworkDiagnostics();
    const last = diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null;
    status.textContent = last
        ? `Plugin Framework ${snapshot.frameworkVersion}. ${snapshot.plugins.length} plugin(s), ${snapshot.packages.length} package(s). Last event: ${last.message}`
        : `Plugin Framework ${snapshot.frameworkVersion}. ${snapshot.plugins.length} plugin(s), ${snapshot.packages.length} package(s).`;

    pluginList.querySelectorAll('[data-plugin-toggle-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const pluginId = button.getAttribute('data-plugin-toggle-id');
            if (!pluginId) return;
            const current = getPluginFrameworkSnapshot().plugins.find((item) => item.pluginId === pluginId);
            if (!current) return;
            const result = current.enabled ? disablePlugin(pluginId) : enablePlugin(pluginId);
            if (!result.ok) {
                if (result.reason === 'required-by-dependent') {
                    const dependents = Array.isArray(result.dependents) ? result.dependents.join(', ') : 'another enabled plugin';
                    writeStatus(`Plugin action failed: required by ${dependents}.`);
                    return;
                }
                if (result.reason === 'dependency-failed') {
                    writeStatus(`Plugin action failed: ${(result.errors || []).join('; ') || 'dependency requirements are not met'}.`);
                    return;
                }
                writeStatus('Plugin action failed.');
                return;
            }
            renderPluginManager();
            writeStatus(`${current.enabled ? 'Disabled' : 'Enabled'} plugin ${current.displayName}.`);
        });
    });

    pluginList.querySelectorAll('[data-plugin-uninstall-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const pluginId = button.getAttribute('data-plugin-uninstall-id');
            if (!pluginId) return;
            const current = getPluginFrameworkSnapshot().plugins.find((item) => item.pluginId === pluginId);
            if (!current) return;
            const approved = window.confirm(`Uninstall plugin ${current.displayName}?`);
            if (!approved) return;
            const result = uninstallPlugin(pluginId);
            if (!result.ok) {
                if (result.reason === 'required-by-dependent') {
                    const dependents = Array.isArray(result.dependents) ? result.dependents.join(', ') : 'another enabled plugin';
                    writeStatus(`Plugin uninstall blocked: required by ${dependents}.`);
                    return;
                }
                writeStatus('Plugin uninstall failed.');
                return;
            }
            renderPluginManager();
            writeStatus(`Uninstalled plugin ${current.displayName}.`);
        });
    });
}

function getVisualAccessibilityControls() {
    return {
        theme: document.getElementById('settings-visual-theme'),
        zoom: document.getElementById('settings-visual-zoom'),
        fontSize: document.getElementById('settings-visual-font-size'),
        density: document.getElementById('settings-visual-density'),
        enhancedFocusIndicators: document.getElementById('settings-visual-focus-indicators'),
        reducedMotion: document.getElementById('settings-visual-reduced-motion'),
        borderVisibility: document.getElementById('settings-visual-border-visibility'),
        followSystemTheme: document.getElementById('settings-visual-follow-system-theme'),
        summary: document.getElementById('settings-visual-summary'),
        applyButton: document.getElementById('btn-settings-visual-apply'),
        cancelButton: document.getElementById('btn-settings-visual-cancel'),
        defaultsButton: document.getElementById('btn-settings-visual-defaults')
    };
}

function getVisualAccessibilityFormValues() {
    const controls = getVisualAccessibilityControls();
    return {
        activeProfile: 'Default',
        theme: controls.theme?.value || 'light',
        zoom: Number(controls.zoom?.value || 100),
        fontSize: Number(controls.fontSize?.value || 100),
        density: controls.density?.value || 'standard',
        enhancedFocusIndicators: Boolean(controls.enhancedFocusIndicators?.checked),
        reducedMotion: Boolean(controls.reducedMotion?.checked),
        borderVisibility: Boolean(controls.borderVisibility?.checked),
        followSystemTheme: Boolean(controls.followSystemTheme?.checked)
    };
}

function setVisualAccessibilityFormValues(config) {
    const controls = getVisualAccessibilityControls();
    if (controls.theme) controls.theme.value = config.theme;
    if (controls.zoom) controls.zoom.value = String(config.zoom);
    if (controls.fontSize) controls.fontSize.value = String(config.fontSize);
    if (controls.density) controls.density.value = config.density;
    if (controls.enhancedFocusIndicators) controls.enhancedFocusIndicators.checked = Boolean(config.enhancedFocusIndicators);
    if (controls.reducedMotion) controls.reducedMotion.checked = Boolean(config.reducedMotion);
    if (controls.borderVisibility) controls.borderVisibility.checked = Boolean(config.borderVisibility);
    if (controls.followSystemTheme) controls.followSystemTheme.checked = Boolean(config.followSystemTheme);
    if (controls.summary) {
        controls.summary.textContent = `Theme ${config.theme}. Zoom ${config.zoom} percent. Font size ${config.fontSize} percent. Density ${config.density}.`;
    }
}

function previewVisualAccessibilitySettings(nextConfig) {
    updateVisualAccessibilityConfig(nextConfig, { persist: false, action: 'Preview visual accessibility settings' });
    pendingVisualAccessibilityDirty = true;
    setVisualAccessibilityFormValues(getVisualAccessibilityConfig());
    writeStatus('Visual accessibility preview updated.');
}

function applyVisualAccessibilitySettings() {
    const nextConfig = getVisualAccessibilityFormValues();
    updateVisualAccessibilityConfig(nextConfig, { persist: true, action: 'Updated visual accessibility settings' });
    pendingVisualAccessibilitySnapshot = getVisualAccessibilityConfig();
    pendingVisualAccessibilityDirty = false;
    setVisualAccessibilityFormValues(pendingVisualAccessibilitySnapshot);
    writeStatus('Visual accessibility settings applied.');
}

function revertVisualAccessibilityPreview() {
    if (!pendingVisualAccessibilityDirty || !pendingVisualAccessibilitySnapshot) return;
    updateVisualAccessibilityConfig(pendingVisualAccessibilitySnapshot, { persist: false, action: 'Reverted visual accessibility preview' });
    pendingVisualAccessibilityDirty = false;
    setVisualAccessibilityFormValues(pendingVisualAccessibilitySnapshot);
}

function resetVisualAccessibilityPreviewToDefaults() {
    resetVisualAccessibilityConfig({ persist: false, action: 'Preview default visual accessibility settings' });
    pendingVisualAccessibilityDirty = true;
    setVisualAccessibilityFormValues(getVisualAccessibilityConfig());
    writeStatus('Default visual accessibility settings previewed.');
}

function renderVisualAccessibilitySettings() {
    setVisualAccessibilityFormValues(getVisualAccessibilityConfig());
}

function getWorkspaceViewControls() {
    return {
        defaultView: document.getElementById('settings-workspace-default-view'),
        rememberLast: document.getElementById('settings-workspace-remember-last'),
        showIcons: document.getElementById('settings-explorer-icons'),
        showBadges: document.getElementById('settings-explorer-badges'),
        showRecent: document.getElementById('settings-explorer-recent'),
        showFavorites: document.getElementById('settings-explorer-favorites'),
        showSavedSearches: document.getElementById('settings-explorer-saved-searches'),
        autoExpand: document.getElementById('settings-explorer-auto-expand'),
        restoreExpansion: document.getElementById('settings-explorer-restore-expansion'),
        restoreSelection: document.getElementById('settings-explorer-restore-selection'),
        restoreFocus: document.getElementById('settings-explorer-restore-focus'),
        restoreScroll: document.getElementById('settings-explorer-restore-scroll'),
        restoreContext: document.getElementById('settings-explorer-restore-context'),
        width: document.getElementById('settings-explorer-width'),
        widthValue: document.getElementById('settings-explorer-width-value'),
        applyButton: document.getElementById('btn-settings-workspace-apply')
    };
}

function renderWorkspaceViewSettings() {
    const controls = getWorkspaceViewControls();
    if (!controls.defaultView || !controls.rememberLast || !controls.width) return;

    const config = getWorkspaceViewConfig();
    const explorer = config.explorer || {};

    controls.defaultView.value = config.defaultView || 'dashboard';
    controls.rememberLast.checked = Boolean(config.rememberLastView);
    controls.showIcons.checked = explorer.showResourceIcons !== false;
    controls.showBadges.checked = explorer.showResourceBadges !== false;
    controls.showRecent.checked = explorer.showRecentResources !== false;
    controls.showFavorites.checked = explorer.showFavorites !== false;
    controls.showSavedSearches.checked = explorer.showSavedSearches !== false;
    controls.autoExpand.checked = explorer.autoExpandParents !== false;
    controls.restoreExpansion.checked = explorer.restoreExpansionState !== false;
    controls.restoreSelection.checked = explorer.restoreSelectedResource !== false;
    controls.restoreFocus.checked = explorer.restoreFocus !== false;
    controls.restoreScroll.checked = explorer.restoreScrollPosition !== false;
    controls.restoreContext.checked = explorer.restoreContext !== false;
    controls.width.value = String(explorer.width || 320);
    if (controls.widthValue) controls.widthValue.textContent = `${controls.width.value} px`;
}

function applyWorkspaceViewSettings() {
    const controls = getWorkspaceViewControls();
    if (!controls.defaultView || !controls.rememberLast || !controls.width) return false;

    updateWorkspaceViewConfig({
        defaultView: controls.defaultView.value || 'dashboard',
        rememberLastView: Boolean(controls.rememberLast.checked),
        explorer: {
            width: Number(controls.width.value || 320),
            showResourceIcons: Boolean(controls.showIcons?.checked),
            showResourceBadges: Boolean(controls.showBadges?.checked),
            showRecentResources: Boolean(controls.showRecent?.checked),
            showFavorites: Boolean(controls.showFavorites?.checked),
            showSavedSearches: Boolean(controls.showSavedSearches?.checked),
            autoExpandParents: Boolean(controls.autoExpand?.checked),
            restoreExpansionState: Boolean(controls.restoreExpansion?.checked),
            restoreSelectedResource: Boolean(controls.restoreSelection?.checked),
            restoreFocus: Boolean(controls.restoreFocus?.checked),
            restoreScrollPosition: Boolean(controls.restoreScroll?.checked),
            restoreContext: Boolean(controls.restoreContext?.checked)
        }
    }, {
        action: 'Updated workspace view settings',
        persist: true
    });

    writeStatus('Workspace view settings applied.');
    return true;
}

function getAnalyticsControls() {
    return {
        defaultScope: document.getElementById('settings-analytics-default-scope'),
        expandedOverview: document.getElementById('settings-analytics-expand-overview'),
        expandedFindings: document.getElementById('settings-analytics-expand-findings'),
        expandedProgress: document.getElementById('settings-analytics-expand-progress'),
        expandedQuality: document.getElementById('settings-analytics-expand-quality'),
        expandedActivity: document.getElementById('settings-analytics-expand-activity'),
        expandedPlugins: document.getElementById('settings-analytics-expand-plugins'),
        showPercentages: document.getElementById('settings-analytics-show-percentages'),
        showTrendPlaceholders: document.getElementById('settings-analytics-show-trends'),
        showPluginSections: document.getElementById('settings-analytics-show-plugins'),
        showUnrelatedReportTrends: document.getElementById('settings-analytics-show-unrelated-report-trends'),
        announceScopeChanges: document.getElementById('settings-analytics-announce-scope'),
        emphasizeDescriptions: document.getElementById('settings-analytics-emphasize-descriptions'),
        applyButton: document.getElementById('btn-settings-analytics-apply'),
        summary: document.getElementById('settings-analytics-summary')
    };
}

function getCollaborationControls() {
    return {
        enabled: document.getElementById('settings-collaboration-enabled'),
        showToolbar: document.getElementById('settings-collaboration-show-toolbar'),
        mode: document.getElementById('settings-collaboration-mode'),
        toolbarPosition: document.getElementById('settings-collaboration-toolbar-position'),
        providerId: document.getElementById('settings-collaboration-provider-id'),
        providerName: document.getElementById('settings-collaboration-provider-name'),
        providerStatus: document.getElementById('settings-collaboration-provider-status'),
        applyButton: document.getElementById('btn-settings-collaboration-apply'),
        summary: document.getElementById('settings-collaboration-summary'),
        providerList: document.getElementById('settings-collaboration-provider-list'),
        presetSummary: document.getElementById('settings-collaboration-preset-summary'),
        permissionsSummary: document.getElementById('settings-collaboration-permissions-summary'),
        sharingSummary: document.getElementById('settings-collaboration-sharing-summary'),
        sessionSummary: document.getElementById('settings-collaboration-session-summary'),
        syncSummary: document.getElementById('settings-collaboration-sync-summary'),
        discoveryScope: document.getElementById('settings-collaboration-discovery-scope'),
        allowDirectoryListing: document.getElementById('settings-collaboration-allow-directory-listing'),
        requireApproval: document.getElementById('settings-collaboration-require-approval'),
        allowGuestLinks: document.getElementById('settings-collaboration-allow-guest-links'),
        defaultExpiryDays: document.getElementById('settings-collaboration-default-expiry-days'),
        sharingChannels: document.getElementById('settings-collaboration-sharing-channels'),
        syncEnabled: document.getElementById('settings-collaboration-sync-enabled'),
        syncMode: document.getElementById('settings-collaboration-sync-mode'),
        conflictStrategy: document.getElementById('settings-collaboration-conflict-strategy'),
        autoMergeComments: document.getElementById('settings-collaboration-auto-merge-comments'),
        autoMergeMetadata: document.getElementById('settings-collaboration-auto-merge-metadata'),
        keepVersionHistory: document.getElementById('settings-collaboration-keep-version-history'),
        maxVersions: document.getElementById('settings-collaboration-max-versions'),
        syncNowButton: document.getElementById('btn-settings-collaboration-sync-now'),
        presetSoloButton: document.getElementById('btn-settings-collaboration-preset-solo'),
        presetTeamButton: document.getElementById('btn-settings-collaboration-preset-team'),
        resetBaselineButton: document.getElementById('btn-settings-collaboration-reset-baseline'),
        discoverySummary: document.getElementById('settings-collaboration-discovery-summary'),
        discoverySnapshotButton: document.getElementById('btn-settings-collaboration-discovery-snapshot'),
        conflictSummary: document.getElementById('settings-collaboration-conflict-summary'),
        queueConflictButton: document.getElementById('btn-settings-collaboration-conflict-queue'),
        resolveConflictButton: document.getElementById('btn-settings-collaboration-conflict-resolve'),
        liveServerUrl: document.getElementById('settings-collaboration-live-server-url'),
        liveSessionName: document.getElementById('settings-collaboration-live-session-name'),
        liveAutoConnect: document.getElementById('settings-collaboration-live-auto-connect'),
        liveAuthToken: document.getElementById('settings-collaboration-live-auth-token'),
        liveSummary: document.getElementById('settings-collaboration-live-summary'),
        liveQuickStartButton: document.getElementById('btn-settings-collaboration-live-quickstart'),
        liveConnectButton: document.getElementById('btn-settings-collaboration-live-connect'),
        liveDisconnectButton: document.getElementById('btn-settings-collaboration-live-disconnect'),
        liveStartSessionButton: document.getElementById('btn-settings-collaboration-live-start-session'),
        livePublishButton: document.getElementById('btn-settings-collaboration-live-publish'),
        livePullButton: document.getElementById('btn-settings-collaboration-live-pull'),
        startSessionButton: document.getElementById('btn-settings-collaboration-session-start'),
        clearSessionsButton: document.getElementById('btn-settings-collaboration-session-clear'),
        profileName: document.getElementById('settings-collaboration-profile-name'),
        profilePermissions: document.getElementById('settings-collaboration-profile-permissions'),
        addProfileButton: document.getElementById('btn-settings-collaboration-profile-add'),
        assignmentPrincipal: document.getElementById('settings-collaboration-assignment-principal'),
        assignmentResourceType: document.getElementById('settings-collaboration-assignment-resource-type'),
        assignmentResourceId: document.getElementById('settings-collaboration-assignment-resource-id'),
        assignmentPermissions: document.getElementById('settings-collaboration-assignment-permissions'),
        addAssignmentButton: document.getElementById('btn-settings-collaboration-assignment-add')
    };
}

function getCollaborationPresetLabel(config = getCollaborationConfig()) {
    const source = config && typeof config === 'object' ? config : {};
    const isSoloPreset = source.mode === 'independent'
        && source.sharing?.discoveryScope === 'resource'
        && source.synchronization?.enabled === false
        && source.synchronization?.mode === 'manual'
        && source.synchronization?.conflictStrategy === 'manual-review';
    const isTeamPreset = source.mode === 'asynchronous'
        && source.sharing?.discoveryScope === 'workspace'
        && source.synchronization?.enabled === true
        && source.synchronization?.mode === 'scheduled'
        && source.synchronization?.conflictStrategy === 'metadata-priority';

    return isSoloPreset ? 'Solo' : isTeamPreset ? 'Team' : 'Custom';
}

function getCollaborationBaselinePreset(config = getCollaborationConfig()) {
    const presetLabel = getCollaborationPresetLabel(config);
    if (presetLabel === 'Team') return 'team';
    if (presetLabel === 'Solo') return 'solo';

    const mode = String(config?.mode || 'independent').toLowerCase();
    return mode === 'asynchronous' || mode === 'synchronous' || mode === 'realtime' ? 'team' : 'solo';
}

function renderAnalyticsSettings() {
    const controls = getAnalyticsControls();
    if (!controls.defaultScope || !controls.applyButton) return;

    const config = getAnalyticsConfig();
    const expanded = new Set(Array.isArray(config.expandedSections) ? config.expandedSections : []);

    controls.defaultScope.value = String(config.defaultScope || 'auto');
    if (controls.expandedOverview) controls.expandedOverview.checked = expanded.has('workspace-overview') || expanded.has('report-overview');
    if (controls.expandedFindings) controls.expandedFindings.checked = expanded.has('workspace-findings') || expanded.has('report-findings');
    if (controls.expandedProgress) controls.expandedProgress.checked = expanded.has('workspace-progress') || expanded.has('report-progress');
    if (controls.expandedQuality) controls.expandedQuality.checked = expanded.has('workspace-quality');
    if (controls.expandedActivity) controls.expandedActivity.checked = expanded.has('workspace-activity');
    if (controls.expandedPlugins) controls.expandedPlugins.checked = expanded.has('plugin-default');

    if (controls.showPercentages) controls.showPercentages.checked = config.displayOptions?.showPercentages !== false;
    if (controls.showTrendPlaceholders) controls.showTrendPlaceholders.checked = config.displayOptions?.showTrendPlaceholders !== false;
    if (controls.showPluginSections) controls.showPluginSections.checked = config.displayOptions?.showPluginSections !== false;
    if (controls.showUnrelatedReportTrends) controls.showUnrelatedReportTrends.checked = config.displayOptions?.showUnrelatedReportTrends === true;
    if (controls.announceScopeChanges) controls.announceScopeChanges.checked = config.accessibilityOptions?.announceScopeChanges !== false;
    if (controls.emphasizeDescriptions) controls.emphasizeDescriptions.checked = config.accessibilityOptions?.emphasizeSectionDescriptions !== false;

    if (controls.summary) {
        controls.summary.textContent = `Default scope ${controls.defaultScope.value}. Percentages ${controls.showPercentages?.checked ? 'on' : 'off'}. Unrelated standalone trends ${controls.showUnrelatedReportTrends?.checked ? 'on' : 'off'}.`;
    }
}

function applyAnalyticsSettings() {
    const controls = getAnalyticsControls();
    if (!controls.defaultScope) return false;

    const expandedSections = [];
    if (controls.expandedOverview?.checked) expandedSections.push('workspace-overview', 'report-overview');
    if (controls.expandedFindings?.checked) expandedSections.push('workspace-findings', 'report-findings');
    if (controls.expandedProgress?.checked) expandedSections.push('workspace-progress', 'report-progress');
    if (controls.expandedQuality?.checked) expandedSections.push('workspace-quality');
    if (controls.expandedActivity?.checked) expandedSections.push('workspace-activity');
    if (controls.expandedPlugins?.checked) expandedSections.push('plugin-default');

    updateAnalyticsConfig({
        defaultScope: controls.defaultScope.value || 'auto',
        expandedSections,
        displayOptions: {
            showPercentages: Boolean(controls.showPercentages?.checked),
            showTrendPlaceholders: Boolean(controls.showTrendPlaceholders?.checked),
            showPluginSections: Boolean(controls.showPluginSections?.checked),
            showUnrelatedReportTrends: Boolean(controls.showUnrelatedReportTrends?.checked)
        },
        accessibilityOptions: {
            announceScopeChanges: Boolean(controls.announceScopeChanges?.checked),
            emphasizeSectionDescriptions: Boolean(controls.emphasizeDescriptions?.checked)
        }
    }, {
        action: 'Updated dashboard analytics settings',
        persist: true
    });

    writeStatus('Dashboard analytics settings applied.');
    renderAnalyticsSettings();
    return true;
}

function renderCollaborationSettings() {
    const controls = getCollaborationControls();
    if (!controls.enabled || !controls.applyButton) return;

    const config = getCollaborationConfig();
    const providers = getCollaborationProviders();
    const sessionSummary = getCollaborationSessionSummary();
    const conflictSummary = getCollaborationConflictSummary();
    const liveSnapshot = getCollaborationLiveConnectionSnapshot();
    const discoverySnapshot = createCollaborationDiscoverySnapshot({ workspaceId: appState.activeWorkspaceId, emitEvent: false });
    const sharingTargets = Array.isArray(config.resourceDefaults?.sharing) ? config.resourceDefaults.sharing : [];
    const permissionProfiles = Array.isArray(config.permissions?.profiles) ? config.permissions.profiles : [];
    const permissionAssignments = Array.isArray(config.permissions?.assignments) ? config.permissions.assignments : [];
    const profileSummary = permissionProfiles.length > 0
        ? permissionProfiles.map((profile) => `${profile.name || profile.id}: ${(profile.permissions || []).join(', ') || 'no permissions'}`).join(' | ')
        : 'No permission profiles are configured yet.';
    const assignmentSummary = permissionAssignments.length > 0
        ? permissionAssignments.map((assignment) => `${assignment.principalId || 'Unassigned'}${assignment.resourceType ? ` @ ${assignment.resourceType}` : ''}${assignment.resourceId ? `/${assignment.resourceId}` : ''}: ${(assignment.permissions || []).join(', ') || 'no permissions'}`).join(' | ')
        : 'No permission assignments are configured yet.';

    const presetLabel = getCollaborationPresetLabel(config);

    controls.enabled.checked = Boolean(config.enabled);
    controls.showToolbar.checked = Boolean(config.showToolbar);
    controls.mode.value = String(config.mode || 'independent');
    controls.toolbarPosition.value = String(config.toolbarPosition || 'top-right');
    controls.providerId.value = String(config.providerId || 'local');
    controls.providerName.value = String(config.providerName || 'Local collaboration');
    controls.providerStatus.value = String(config.providerStatus || 'available');
    if (controls.discoveryScope) controls.discoveryScope.value = String(config.sharing?.discoveryScope || 'workspace');
    if (controls.allowDirectoryListing) controls.allowDirectoryListing.checked = Boolean(config.sharing?.allowDirectoryListing);
    if (controls.requireApproval) controls.requireApproval.checked = config.sharing?.requireApproval !== false;
    if (controls.allowGuestLinks) controls.allowGuestLinks.checked = Boolean(config.sharing?.allowGuestLinks);
    if (controls.defaultExpiryDays) controls.defaultExpiryDays.value = String(config.sharing?.defaultExpiryDays || 30);
    if (controls.sharingChannels) controls.sharingChannels.value = Array.isArray(config.sharing?.channels) ? config.sharing.channels.join(', ') : '';
    if (controls.syncEnabled) controls.syncEnabled.checked = Boolean(config.synchronization?.enabled);
    if (controls.syncMode) controls.syncMode.value = String(config.synchronization?.mode || 'manual');
    if (controls.conflictStrategy) controls.conflictStrategy.value = String(config.synchronization?.conflictStrategy || 'manual-review');
    if (controls.autoMergeComments) controls.autoMergeComments.checked = config.synchronization?.autoMergeComments !== false;
    if (controls.autoMergeMetadata) controls.autoMergeMetadata.checked = Boolean(config.synchronization?.autoMergeMetadata);
    if (controls.keepVersionHistory) controls.keepVersionHistory.checked = config.synchronization?.keepVersionHistory !== false;
    if (controls.maxVersions) controls.maxVersions.value = String(config.synchronization?.maxVersionsPerResource || 20);
    if (controls.liveServerUrl) controls.liveServerUrl.value = String(config.live?.serverUrl || liveSnapshot.serverUrl || 'ws://localhost:8787/art-live');
    if (controls.liveSessionName) controls.liveSessionName.value = String(config.live?.sessionName || 'Live Session');
    if (controls.liveAutoConnect) controls.liveAutoConnect.checked = Boolean(config.live?.autoConnect);

    if (controls.summary) {
        controls.summary.textContent = config.enabled
            ? `Collaboration enabled via ${controls.providerName.value}. Mode ${controls.mode.value}. Toolbar ${controls.showToolbar.checked ? 'visible' : 'hidden'}.`
            : 'Collaboration is disabled.';
    }
    if (controls.presetSummary) {
        controls.presetSummary.textContent = `Current collaboration preset: ${presetLabel}.`;
    }
    if (controls.permissionsSummary) {
        controls.permissionsSummary.textContent = `Permission profiles ${permissionProfiles.length}. Assignments ${permissionAssignments.length}. ${profileSummary}`;
    }
    if (controls.sharingSummary) {
        const discoveryScope = String(config.sharing?.discoveryScope || 'workspace');
        const channels = Array.isArray(config.sharing?.channels) ? config.sharing.channels : [];
        controls.sharingSummary.textContent = sharingTargets.length > 0 || channels.length > 0
            ? `Discovery ${discoveryScope}. Sharing targets: ${sharingTargets.join(', ') || 'none'}. Channels: ${channels.join(', ') || 'none'}.`
            : 'Sharing is not configured yet.';
    }
    if (controls.sessionSummary) {
        controls.sessionSummary.textContent = sessionSummary.totalCount > 0
            ? `${sessionSummary.activeCount} active collaboration session${sessionSummary.activeCount === 1 ? '' : 's'} and ${sessionSummary.connectedCount} connected.`
            : 'No collaboration sessions are active.';
    }
    if (controls.syncSummary) {
        controls.syncSummary.textContent = `Mode ${config.mode}. Sync ${config.synchronization?.enabled ? 'enabled' : 'disabled'} (${config.synchronization?.mode || 'manual'}). Conflict strategy ${config.synchronization?.conflictStrategy || 'manual-review'}. Pending conflicts ${conflictSummary.pendingCount}. Presence ${config.providerCapabilities?.presence ? 'supported' : 'not supported'}. Synchronization capability ${config.providerCapabilities?.synchronization ? 'supported' : 'not supported'}. Version history ${config.synchronization?.keepVersionHistory !== false ? 'enabled' : 'disabled'}. Last sync ${config.synchronization?.lastSyncAt || 'not recorded'}.`;
    }
    if (controls.discoverySummary) {
        controls.discoverySummary.textContent = discoverySnapshot.totalEntries > 0
            ? `Discovery snapshot contains ${discoverySnapshot.totalEntries} resource${discoverySnapshot.totalEntries === 1 ? '' : 's'} for ${discoverySnapshot.workspaceName || 'workspace'} (${discoverySnapshot.discoveryScope}).`
            : 'Discovery snapshot not generated.';
    }
    if (controls.conflictSummary) {
        controls.conflictSummary.textContent = conflictSummary.pendingCount > 0
            ? `${conflictSummary.pendingCount} pending collaboration conflict${conflictSummary.pendingCount === 1 ? '' : 's'}.`
            : 'No collaboration conflicts are queued.';
    }
    if (controls.liveSummary) {
        const connectionState = String(config.live?.connectionState || liveSnapshot.connectionState || 'offline');
        const serverUrl = String(config.live?.serverUrl || liveSnapshot.serverUrl || 'ws://localhost:8787/art-live');
        const lastConnectedAt = String(config.live?.lastConnectedAt || liveSnapshot.lastConnectedAt || 'not connected');
        const lastError = String(config.live?.lastError || liveSnapshot.lastError || 'none');
        controls.liveSummary.textContent = `Live server ${connectionState}. URL ${serverUrl}. Last connected ${lastConnectedAt}. Last error ${lastError}.`;
    }
    if (controls.profilePermissions && !controls.profilePermissions.value) {
        controls.profilePermissions.value = 'view, comment, edit';
    }
    if (controls.assignmentPermissions && !controls.assignmentPermissions.value) {
        controls.assignmentPermissions.value = 'view';
    }
    if (controls.permissionsSummary && permissionAssignments.length > 0) {
        controls.permissionsSummary.textContent = `${controls.permissionsSummary.textContent} ${assignmentSummary}`;
    }

    if (controls.providerList) {
        controls.providerList.innerHTML = providers.length === 0
            ? '<li>No collaboration providers registered.</li>'
            : providers.map((provider) => `<li><strong>${provider.name}</strong> <span>(${provider.status})</span></li>`).join('');
    }
}

function applyCollaborationSettings() {
    const controls = getCollaborationControls();
    if (!controls.enabled || !controls.applyButton) return false;

    updateCollaborationConfig({
        enabled: Boolean(controls.enabled.checked),
        showToolbar: Boolean(controls.showToolbar.checked),
        mode: controls.mode.value || 'independent',
        toolbarPosition: controls.toolbarPosition.value || 'top-right',
        providerId: String(controls.providerId.value || '').trim() || 'local',
        providerName: String(controls.providerName.value || '').trim() || 'Local collaboration',
        providerStatus: controls.providerStatus.value || 'available',
        sharing: {
            discoveryScope: controls.discoveryScope?.value || 'workspace',
            allowDirectoryListing: Boolean(controls.allowDirectoryListing?.checked),
            requireApproval: controls.requireApproval?.checked !== false,
            allowGuestLinks: Boolean(controls.allowGuestLinks?.checked),
            defaultExpiryDays: Number.isFinite(Number(controls.defaultExpiryDays?.value)) ? Number(controls.defaultExpiryDays.value) : 30,
            channels: String(controls.sharingChannels?.value || '')
                .split(',')
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        },
        synchronization: {
            enabled: Boolean(controls.syncEnabled?.checked),
            mode: controls.syncMode?.value || 'manual',
            conflictStrategy: controls.conflictStrategy?.value || 'manual-review',
            autoMergeComments: controls.autoMergeComments?.checked !== false,
            autoMergeMetadata: Boolean(controls.autoMergeMetadata?.checked),
            keepVersionHistory: controls.keepVersionHistory?.checked !== false,
            maxVersionsPerResource: Number.isFinite(Number(controls.maxVersions?.value)) ? Number(controls.maxVersions.value) : 20
        },
        live: {
            serverUrl: String(controls.liveServerUrl?.value || '').trim() || 'ws://localhost:8787/art-live',
            autoConnect: Boolean(controls.liveAutoConnect?.checked),
            sessionName: String(controls.liveSessionName?.value || '').trim() || 'Live Session'
        }
    }, {
        action: 'Updated collaboration settings',
        persist: true
    });

    writeStatus('Collaboration settings applied.');
    renderCollaborationSettings();
    return true;
}

function registerPresenceSessionFromSettings() {
    const config = getCollaborationConfig();
    const activeWorkspace = getActiveProjectWorkspace();
    const session = upsertCollaborationSession({
        id: `presence-${activeWorkspace?.id || 'workspace'}-${config.providerId || 'local'}`,
        resourceType: 'workspace',
        resourceId: activeWorkspace?.id || 'workspace',
        userId: appState.auditors || 'User',
        state: 'active',
        providerId: config.providerId,
        connectionState: config.enabled ? 'connected' : 'offline',
        metadata: {
            workspaceName: activeWorkspace?.name || 'Active Workspace',
            visibility: config.resourceDefaults?.visibility || 'private'
        }
    }, {
        action: 'Registered collaboration presence session',
        state: 'active',
        connectionState: config.enabled ? 'connected' : 'offline',
        metadata: {
            source: 'settings'
        }
    });

    writeStatus(`Registered collaboration presence session ${session.id}.`);
    renderCollaborationSettings();
    return session;
}

function clearPresenceSessionsFromSettings() {
    clearCollaborationSessions({ action: 'Cleared collaboration sessions from settings' });
    writeStatus('Cleared collaboration sessions.');
    renderCollaborationSettings();
    return true;
}

function recordSyncCheckpointFromSettings() {
    const config = getCollaborationConfig();
    updateCollaborationConfig({
        synchronization: {
            ...config.synchronization,
            lastSyncAt: new Date().toISOString()
        }
    }, {
        action: 'Recorded collaboration sync checkpoint',
        persist: true
    });

    writeStatus('Recorded collaboration sync checkpoint.');
    renderCollaborationSettings();
    return true;
}

function applyCollaborationPresetFromSettings(preset = 'solo') {
    const kind = String(preset || 'solo').trim().toLowerCase();
    const isTeam = kind === 'team';
    const config = getCollaborationConfig();

    updateCollaborationConfig({
        enabled: true,
        showToolbar: true,
        mode: isTeam ? 'asynchronous' : 'independent',
        toolbarPosition: 'top-right',
        sharing: {
            discoveryScope: isTeam ? 'workspace' : 'resource',
            allowDirectoryListing: isTeam,
            requireApproval: true,
            allowGuestLinks: false,
            defaultExpiryDays: isTeam ? 14 : 30,
            channels: isTeam ? ['workspace', 'email'] : ['local']
        },
        synchronization: {
            ...config.synchronization,
            enabled: isTeam,
            mode: isTeam ? 'scheduled' : 'manual',
            conflictStrategy: isTeam ? 'metadata-priority' : 'manual-review',
            autoMergeComments: true,
            autoMergeMetadata: isTeam,
            keepVersionHistory: true,
            maxVersionsPerResource: isTeam ? 60 : 20
        },
        permissions: {
            ...config.permissions,
            profiles: isTeam
                ? [
                    { id: 'Owner', name: 'Owner', permissions: ['view', 'comment', 'edit', 'share', 'resolve'] },
                    { id: 'Reviewer', name: 'Reviewer', permissions: ['view', 'comment', 'resolve'] },
                    { id: 'Contributor', name: 'Contributor', permissions: ['view', 'comment', 'edit'] }
                ]
                : [
                    { id: 'Private', name: 'Private', permissions: ['view', 'edit'] }
                ]
        }
    }, {
        action: isTeam ? 'Applied team collaboration defaults' : 'Applied solo collaboration defaults',
        persist: true
    });

    writeStatus(isTeam ? 'Applied team collaboration defaults.' : 'Applied solo collaboration defaults.');
    renderCollaborationSettings();
    return true;
}

function resetCollaborationBaselineFromSettings() {
    const config = getCollaborationConfig();
    const baselinePreset = getCollaborationBaselinePreset(config);
    const isTeam = baselinePreset === 'team';

    applyCollaborationPresetFromSettings(baselinePreset);

    const refreshed = getCollaborationConfig();
    updateCollaborationConfig({
        sessions: [],
        auditHistory: [],
        resourceDefaults: {
            ...refreshed.resourceDefaults,
            sharing: [],
            auditHistory: []
        },
        permissions: {
            ...refreshed.permissions,
            assignments: []
        },
        synchronization: {
            ...refreshed.synchronization,
            enabled: isTeam,
            mode: isTeam ? 'scheduled' : 'manual',
            conflictStrategy: isTeam ? 'metadata-priority' : 'manual-review',
            pendingConflicts: [],
            lastSyncAt: ''
        }
    }, {
        action: 'Reset collaboration baseline operational data',
        persist: true
    });

    writeStatus(`Reset collaboration to ${isTeam ? 'team' : 'solo'} baseline and cleared sessions, conflicts, assignments, and sync checkpoint.`);
    renderCollaborationSettings();
    return true;
}

async function connectLiveCollaborationServerFromSettings(options = {}) {
    const controls = getCollaborationControls();
    const serverUrl = String(options.serverUrl || controls.liveServerUrl?.value || getCollaborationConfig().live?.serverUrl || 'ws://localhost:8787/art-live').trim() || 'ws://localhost:8787/art-live';
    const authToken = String(options.authToken || controls.liveAuthToken?.value || '').trim();

    const result = await connectCollaborationLiveServer({
        serverUrl,
        authToken
    });

    if (!result.ok) {
        writeStatus(`Unable to connect to live collaboration server (${result.reason || 'unknown'}).`);
        renderCollaborationSettings();
        return result;
    }

    if (controls.liveAuthToken) {
        controls.liveAuthToken.value = '';
    }
    writeStatus(`Connected to live collaboration server at ${serverUrl}.`);
    renderCollaborationSettings();
    return result;
}

function disconnectLiveCollaborationServerFromSettings() {
    const result = disconnectCollaborationLiveServer({ action: 'Disconnected live collaboration server from settings' });
    writeStatus('Disconnected from live collaboration server.');
    renderCollaborationSettings();
    return result;
}

function startLiveCollaborationSessionFromSettings() {
    const controls = getCollaborationControls();
    const sessionName = String(controls.liveSessionName?.value || getCollaborationConfig().live?.sessionName || 'Live Session').trim() || 'Live Session';
    const result = startLiveCollaborationSession({
        sessionName,
        workspaceId: appState.activeWorkspaceId
    });
    if (!result.ok) {
        writeStatus('Connect to a live collaboration server before starting a live session.');
        renderCollaborationSettings();
        return false;
    }
    writeStatus(`Started live collaboration session ${result.session.id}.`);
    renderCollaborationSettings();
    return true;
}

function publishAsyncCollaborationSnapshotFromSettings() {
    const result = publishCollaborationWorkspaceSnapshot({
        workspaceId: appState.activeWorkspaceId,
        persistence: 'shared-folder'
    });
    if (!result.ok) {
        writeStatus('Connect to a live collaboration server before publishing an async snapshot.');
        renderCollaborationSettings();
        return false;
    }
    writeStatus(`Published collaboration snapshot for workspace ${result.workspaceId} to shared synchronization storage.`);
    renderCollaborationSettings();
    return true;
}

async function pullAsyncCollaborationSnapshotFromSettings() {
    const result = await requestCollaborationWorkspaceSnapshot({
        workspaceId: appState.activeWorkspaceId,
        apply: true,
        timeoutMs: 10000
    });
    if (!result.ok) {
        writeStatus(`Unable to pull collaboration snapshot (${result.reason || 'unknown'}).`);
        renderCollaborationSettings();
        return false;
    }
    writeStatus(`Pulled and applied collaboration snapshot for workspace ${result.workspaceId}.`);
    renderCollaborationSettings();
    return true;
}

async function quickStartLiveCollaborationFromSettings() {
    const controls = getCollaborationControls();
    const current = getCollaborationConfig();
    const serverUrl = String(controls.liveServerUrl?.value || current.live?.serverUrl || 'ws://localhost:8787/art-live').trim() || 'ws://localhost:8787/art-live';
    const sessionName = String(controls.liveSessionName?.value || current.live?.sessionName || 'Live Session').trim() || 'Live Session';

    updateCollaborationConfig({
        enabled: true,
        showToolbar: true,
        mode: 'realtime',
        providerId: 'live-server',
        providerName: 'Live collaboration server',
        sharing: {
            ...(current.sharing || {}),
            discoveryScope: 'workspace',
            allowDirectoryListing: true,
            requireApproval: true
        },
        synchronization: {
            ...(current.synchronization || {}),
            enabled: true,
            mode: 'realtime',
            conflictStrategy: 'latest-write-wins',
            autoMergeComments: true,
            autoMergeMetadata: true,
            keepVersionHistory: true
        },
        live: {
            ...(current.live || {}),
            serverUrl,
            sessionName,
            autoConnect: true
        }
    }, {
        action: 'Prepared live collaboration quick start',
        persist: true
    });

    const connectResult = await connectLiveCollaborationServerFromSettings({ serverUrl });
    if (!connectResult.ok) return false;
    return startLiveCollaborationSessionFromSettings();
}

function maybeAutoConnectLiveCollaboration() {
    if (liveAutoConnectAttempted) return;
    liveAutoConnectAttempted = true;

    const config = getCollaborationConfig();
    const shouldAutoConnect = Boolean(config.live?.autoConnect)
        && Boolean(config.enabled)
        && String(config.providerId || '') === 'live-server'
        && String(config.live?.connectionState || 'offline') !== 'connected';

    if (!shouldAutoConnect) return;

    void connectLiveCollaborationServerFromSettings({
        serverUrl: config.live?.serverUrl
    });
}

function generateDiscoverySnapshotFromSettings() {
    const snapshot = createCollaborationDiscoverySnapshot({ workspaceId: appState.activeWorkspaceId });
    writeStatus(`Generated discovery snapshot with ${snapshot.totalEntries} resource${snapshot.totalEntries === 1 ? '' : 's'}.`);
    renderCollaborationSettings();
    return snapshot;
}

function queueTestConflictFromSettings() {
    const workspaceId = String(appState.activeWorkspaceId || 'workspace').trim() || 'workspace';
    const conflict = queueCollaborationConflict({
        resourceType: 'workspace',
        resourceId: workspaceId,
        workspaceId,
        summary: 'Synthetic conflict queued from Collaboration settings test action.',
        metadata: {
            incomingMetadata: {
                owner: 'Remote teammate',
                visibility: 'workspace',
                permissionProfile: 'Reviewer',
                sharing: ['workspace-channel'],
                permissionAssignments: [{ principalId: 'remote-user', principalType: 'user', permissions: ['view', 'comment'], source: 'remote' }]
            },
            incomingComments: [{ author: 'Remote teammate', text: 'Incoming collaborative review note.' }]
        }
    }, {
        action: 'Queued test collaboration conflict from settings'
    });
    writeStatus(`Queued collaboration conflict ${conflict.id}.`);
    renderCollaborationSettings();
    return conflict;
}

function resolveOldestConflictFromSettings() {
    const summary = getCollaborationConflictSummary();
    const oldest = summary.oldestPending;
    if (!oldest) {
        writeStatus('No pending collaboration conflicts to resolve.');
        return false;
    }

    const result = resolveCollaborationConflict(oldest.id, {
        strategy: getCollaborationConfig().synchronization?.conflictStrategy || 'manual-review',
        action: 'Resolved oldest collaboration conflict from settings'
    });
    if (!result.ok) {
        writeStatus('Unable to resolve the selected collaboration conflict.');
        return false;
    }

    const mutationText = result.mutation?.applied ? ` Applied ${result.mutation.reason}.` : ` No automatic metadata merge (${result.mutation?.reason || 'manual-review'}).`;
    writeStatus(`Resolved collaboration conflict ${oldest.id}.${mutationText}`);
    renderCollaborationSettings();
    return true;
}

function addPermissionProfileFromSettings() {
    const controls = getCollaborationControls();
    const profileName = String(controls.profileName?.value || '').trim();
    const profilePermissions = String(controls.profilePermissions?.value || '')
        .split(',')
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (!profileName) {
        writeStatus('Permission profile name is required.');
        return false;
    }

    const config = getCollaborationConfig();
    const profiles = Array.isArray(config.permissions?.profiles) ? [...config.permissions.profiles] : [];
    const existingIndex = profiles.findIndex((profile) => String(profile.id || profile.name || '').trim().toLowerCase() === profileName.toLowerCase());
    const profile = {
        id: profileName,
        name: profileName,
        permissions: profilePermissions
    };

    if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
    } else {
        profiles.push(profile);
    }

    updateCollaborationConfig({
        permissions: {
            ...config.permissions,
            profiles
        }
    }, {
        action: 'Updated collaboration permission profiles',
        persist: true
    });

    writeStatus(`Saved permission profile ${profileName}.`);
    renderCollaborationSettings();
    return true;
}

function addPermissionAssignmentFromSettings() {
    const controls = getCollaborationControls();
    const principalId = String(controls.assignmentPrincipal?.value || '').trim();
    const resourceType = String(controls.assignmentResourceType?.value || '').trim();
    const resourceId = String(controls.assignmentResourceId?.value || '').trim();
    const permissions = String(controls.assignmentPermissions?.value || '')
        .split(',')
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (!principalId) {
        writeStatus('Assignment principal is required.');
        return false;
    }

    const config = getCollaborationConfig();
    const assignments = Array.isArray(config.permissions?.assignments) ? [...config.permissions.assignments] : [];
    assignments.push({
        principalId,
        principalType: 'user',
        resourceType,
        resourceId,
        permissions,
        source: 'settings'
    });

    updateCollaborationConfig({
        permissions: {
            ...config.permissions,
            assignments
        }
    }, {
        action: 'Updated collaboration permission assignments',
        persist: true
    });

    writeStatus(`Saved permission assignment for ${principalId}.`);
    renderCollaborationSettings();
    return true;
}

function importAccessibilityStandardList(standards, overwrite = false) {
    const list = Array.isArray(standards) ? standards : [];
    if (list.length === 0) return { ok: false, reason: 'empty' };

    list.forEach((standard) => {
        const result = addImportedAccessibilityStandard(standard, standard.displayName, { overwrite });
        if (result?.ok && result.standard) {
            registerPackageFromWorkflow({
                packageId: `standard:${String(result.standard.internalId || result.standard.id || '').trim()}`,
                packageType: 'accessibility-standards',
                displayName: result.standard.displayName || 'Imported Standard',
                description: 'Imported accessibility standards package.',
                version: result.standard.version || '1.0',
                sourceWorkflow: 'settingsImportStandard',
                metadata: {
                    sourceId: result.standard.id,
                    internalId: result.standard.internalId,
                    criteriaCount: Array.isArray(result.standard.criteria) ? result.standard.criteria.length : 0
                },
                resources: [{ type: 'accessibility-standard', id: result.standard.id }]
            }, {
                sourceWorkflow: 'settingsImportStandard'
            });
        }
    });

    refreshSettingsView();
    writeStatus(`Imported ${list.length} accessibility standard${list.length === 1 ? '' : 's'}.`);
    return { ok: true };
}

function formatConnectionStatus(privacyModeEnabled) {
    if (privacyModeEnabled) {
        return 'Privacy Mode enabled. External integrations are blocked until disabled.';
    }
    return 'Local and network file workflows are available.';
}

function renderIntegrationSettings() {
    const statusSummary = document.getElementById('settings-local-files-status-summary');
    const privacyModeInput = document.getElementById('settings-privacy-mode');
    const privacyModeStatus = document.getElementById('settings-privacy-mode-status');
    const importReportButton = document.getElementById('btn-settings-import-report-file');
    const importTemplateButton = document.getElementById('btn-settings-import-template-file');
    const importStandardsFileButton = document.getElementById('btn-settings-import-standards-file');

    const localIntegrationStatus = document.getElementById('settings-integration-local-files-status');
    const jiraIntegrationStatus = document.getElementById('settings-integration-jira-status');
    const githubIntegrationStatus = document.getElementById('settings-integration-github-status');
    const azureIntegrationStatus = document.getElementById('settings-integration-azure-status');
    const backupAutoInput = document.getElementById('settings-backup-auto');
    const backupFrequencySelect = document.getElementById('settings-backup-frequency');
    const backupRetentionInput = document.getElementById('settings-backup-retention');
    const restorePointSelect = document.getElementById('settings-restore-point-select');
    const diagnostics = document.getElementById('settings-security-diagnostics');

    if (!statusSummary || !privacyModeInput || !privacyModeStatus || !importReportButton || !importTemplateButton || !importStandardsFileButton) return;

    const security = getSecurityConfig();
    const integrations = getIntegrationStatusMap();
    const privacyModeEnabled = Boolean(security.privacyModeEnabled);
    const statusText = formatConnectionStatus(privacyModeEnabled);
    statusSummary.textContent = statusText;
    privacyModeInput.checked = privacyModeEnabled;
    privacyModeStatus.textContent = privacyModeEnabled
        ? 'Privacy Mode enabled. External integrations are blocked until disabled.'
        : 'Privacy Mode disabled.';
    importReportButton.disabled = privacyModeEnabled;
    importTemplateButton.disabled = privacyModeEnabled;
    importStandardsFileButton.disabled = privacyModeEnabled;

    if (localIntegrationStatus) {
        localIntegrationStatus.textContent = 'Available';
    }
    if (jiraIntegrationStatus) jiraIntegrationStatus.textContent = integrations.jira.status;
    if (githubIntegrationStatus) githubIntegrationStatus.textContent = integrations.githubIssues.status;
    if (azureIntegrationStatus) azureIntegrationStatus.textContent = integrations.azureDevOps.status;

    if (backupAutoInput) backupAutoInput.checked = Boolean(security.backup.autoEnabled);
    if (backupFrequencySelect) backupFrequencySelect.value = String(security.backup.frequency || 'weekly');
    if (backupRetentionInput) backupRetentionInput.value = String(security.backup.retention || 5);
    if (restorePointSelect) {
        const points = getRestorePoints();
        restorePointSelect.innerHTML = points.length === 0
            ? '<option value="">No restore points</option>'
            : points.map((point) => `<option value="${point.id}">${point.label} - ${point.createdAt.slice(0, 16).replace('T', ' ')}</option>`).join('');
    }

    if (diagnostics) {
        const tail = security.auditLog.slice(-1)[0];
        diagnostics.textContent = tail
            ? `Last security event: ${tail.action} (${tail.at.slice(0, 16).replace('T', ' ')})`
            : 'No diagnostics available.';
    }
}

function refreshSettingsView() {
    if (isRefreshingSettingsView) return;
    isRefreshingSettingsView = true;

    try {
        // Keep package sync outside render to avoid event-feedback loops.
        syncFrameworkPackagesFromState();
        renderShortcuts();
        renderImportedStandards();
        renderIntegrationSettings();
        renderCollaborationSettings();
        renderVisualAccessibilitySettings();
        renderAnalyticsSettings();
        renderSearchSettings();
        renderSearchAnalytics();
        renderWorkspaceViewSettings();
        renderPluginManager();
        renderAbout();
    } finally {
        isRefreshingSettingsView = false;
    }
}

function refreshSettingsViewIfDialogOpen() {
    const dialog = document.getElementById('app-settings-dialog');
    if (!dialog || dialog.hidden) return;
    refreshSettingsView();
}

function bindIntegrationSettings() {
    const privacyModeInput = document.getElementById('settings-privacy-mode');
    const importReportButton = document.getElementById('btn-settings-import-report-file');
    const importTemplateButton = document.getElementById('btn-settings-import-template-file');
    const importStandardsFileButton = document.getElementById('btn-settings-import-standards-file');
    const backupAutoInput = document.getElementById('settings-backup-auto');
    const backupFrequencySelect = document.getElementById('settings-backup-frequency');
    const backupRetentionInput = document.getElementById('settings-backup-retention');
    const backupNowButton = document.getElementById('btn-settings-backup-now');
    const restoreImportButton = document.getElementById('btn-settings-restore-import');
    const createRestorePointButton = document.getElementById('btn-settings-restore-point-create');
    const restorePointSelect = document.getElementById('settings-restore-point-select');
    const restorePointApplyButton = document.getElementById('btn-settings-restore-point-apply');

    if (!privacyModeInput || !importReportButton || !importTemplateButton || !importStandardsFileButton || !backupAutoInput || !backupFrequencySelect || !backupRetentionInput || !backupNowButton || !restoreImportButton || !createRestorePointButton || !restorePointSelect || !restorePointApplyButton) return;

    const resolveReportImportConflictStrategy = (reportTitle) => {
        if (!reportNameExists(reportTitle)) return 'copy';
        return window.confirm(`A report named "${reportTitle}" already exists. Select OK to Replace, or Cancel to Import as Copy.`)
            ? 'replace'
            : 'copy';
    };

    const restoreInput = document.createElement('input');
    restoreInput.type = 'file';
    restoreInput.accept = '.json,application/json';
    restoreInput.hidden = true;
    document.body.appendChild(restoreInput);

    const importReportInput = document.createElement('input');
    importReportInput.type = 'file';
    importReportInput.accept = '.json,application/json';
    importReportInput.hidden = true;
    document.body.appendChild(importReportInput);

    const importTemplateInput = document.createElement('input');
    importTemplateInput.type = 'file';
    importTemplateInput.accept = '.artx,.json,application/json';
    importTemplateInput.hidden = true;
    document.body.appendChild(importTemplateInput);

    const importStandardsFileInput = document.createElement('input');
    importStandardsFileInput.type = 'file';
    importStandardsFileInput.accept = '.json,.txt,.tsv,.csv,text/plain,application/json';
    importStandardsFileInput.hidden = true;
    document.body.appendChild(importStandardsFileInput);

    const startReportImportPicker = () => {
        if (!canPerformExternalCommunication()) {
            writeStatus('Privacy Mode is enabled. Import from file is currently blocked.');
            return false;
        }
        importReportInput.value = '';
        importReportInput.click();
        return true;
    };

    const startTemplateImportPicker = () => {
        if (!canPerformExternalCommunication()) {
            writeStatus('Privacy Mode is enabled. Import from file is currently blocked.');
            return false;
        }
        importTemplateInput.value = '';
        importTemplateInput.click();
        return true;
    };

    const runCreateBackupNow = () => {
        const payload = createArtBackupPayload('Manual Backup');
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = payload.createdAt.slice(0, 19).replace(/[:T]/g, '-');
        link.href = objectUrl;
        link.download = `art-backup-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        recordSecurityAudit('Manual backup created', `Backup created at ${payload.createdAt}`);
        writeStatus('Backup created and downloaded.');
        renderIntegrationSettings();
        return true;
    };

    const runTogglePrivacyMode = () => {
        privacyModeInput.checked = !privacyModeInput.checked;
        privacyModeInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };

    startSettingsReportImportPicker = startReportImportPicker;
    startSettingsTemplateImportPicker = startTemplateImportPicker;
    createSettingsBackupNow = runCreateBackupNow;
    toggleSettingsPrivacyMode = runTogglePrivacyMode;

    privacyModeInput.addEventListener('change', () => {
        const enable = privacyModeInput.checked;
        updateSecurityConfig({ privacyModeEnabled: enable }, { action: enable ? 'Enabled Privacy Mode' : 'Disabled Privacy Mode' });
        if (enable) {
            setNetworkActivity('Privacy Mode Enabled', 'External integrations and automatic network activity are blocked.');
            recordSecurityAudit('Privacy Mode enabled', 'Cloud integrations paused. Existing connections remain inactive.');
        } else {
            setNetworkActivity('Offline', 'Privacy Mode disabled. No active external connections.');
            recordSecurityAudit('Privacy Mode disabled', 'Integrations may be reconnected by user action.');
        }
        renderIntegrationSettings();
        renderAbout();
        writeStatus(enable ? 'Privacy Mode enabled.' : 'Privacy Mode disabled.');
    });

    importReportButton.addEventListener('click', () => {
        void executeSettingsAction('settingsImportReportFile');
    });

    importReportInput.addEventListener('change', async () => {
        const selected = importReportInput.files && importReportInput.files[0];
        if (!selected) return;

        try {
            const text = await selected.text();
            const validation = validateArtJsonPayload(text);
            if (!validation.isValid) {
                writeStatus('Import failed. The selected file is not a valid ART report JSON payload.');
                return;
            }

            const strategy = resolveReportImportConflictStrategy(validation.reportTitle || 'Untitled Report');
            const imported = importReportWithConflictStrategy(validation.state, strategy);
            if (!imported) {
                writeStatus('Import failed. Report conflict could not be resolved.');
                return;
            }

            registerPackageFromWorkflow({
                packageId: `sample-report:${String(imported.id || imported.name || '').trim()}`,
                packageType: 'sample-data',
                displayName: imported.name || 'Imported Report',
                description: 'Imported report package metadata.',
                version: '1.0.0',
                sourceWorkflow: 'settingsImportReportFile',
                metadata: {
                    sourceId: imported.id,
                    reportType: imported.data?.reportType || ''
                },
                resources: [{ type: 'report', id: imported.id }]
            }, {
                sourceWorkflow: 'settingsImportReportFile'
            });

            setNetworkActivity('Offline', 'Local report import completed with no external transfer.');
            recordSecurityAudit('Local report import completed', `File: ${selected.name}`);
            writeStatus(`Imported report from file: ${imported.name}.`);
        } catch (error) {
            writeStatus('Import failed. Could not read the selected report file.');
        }
    });

    importTemplateButton.addEventListener('click', () => {
        void executeSettingsAction('settingsImportTemplateFile');
    });

    importTemplateInput.addEventListener('change', async () => {
        const selected = importTemplateInput.files && importTemplateInput.files[0];
        if (!selected) return;

        try {
            const text = await selected.text();
            const validation = validateTemplateJsonPayload(text);
            if (!validation.isValid) {
                writeStatus('Import failed. The selected file is not a valid template JSON payload.');
                return;
            }

            const hasConflict = templateNameExists(validation.displayName);
            const strategy = hasConflict && window.confirm(`A template named "${validation.displayName}" already exists. Select OK to Replace, or Cancel to Import as Copy.`)
                ? 'replace'
                : 'copy';
            const imported = importTemplateWithConflictStrategy(validation.template, strategy);
            if (!imported || imported.ok === false) {
                writeStatus('Import failed. Template conflict could not be resolved.');
                return;
            }

            registerPackageFromWorkflow({
                packageId: `template:${String(imported.id || imported.name || '').trim()}`,
                packageType: 'report-templates',
                displayName: imported.name || 'Imported Template',
                description: 'Imported template package metadata.',
                version: imported.metadata?.version || '1.0.0',
                sourceWorkflow: 'settingsImportTemplateFile',
                metadata: {
                    sourceId: imported.id,
                    source: imported.metadata?.source || 'import'
                },
                resources: [{ type: 'template', id: imported.id }]
            }, {
                sourceWorkflow: 'settingsImportTemplateFile'
            });

            setNetworkActivity('Offline', 'Local template import completed with no external transfer.');
            recordSecurityAudit('Local template import completed', `File: ${selected.name}`);
            writeStatus(`Imported template from file: ${imported.name}.`);
            refreshSettingsView();
        } catch (error) {
            writeStatus('Import failed. Could not read the selected template file.');
        }
    });

    importStandardsFileButton.addEventListener('click', () => {
        if (!canPerformExternalCommunication()) {
            writeStatus('Privacy Mode is enabled. Import from file is currently blocked.');
            return;
        }
        importStandardsFileInput.value = '';
        importStandardsFileInput.click();
    });

    importStandardsFileInput.addEventListener('change', async () => {
        const selected = importStandardsFileInput.files && importStandardsFileInput.files[0];
        if (!selected) return;

        try {
            const text = await selected.text();
            const standardsFromTable = parsePastedStandardsTable(text);
            if (standardsFromTable && standardsFromTable.length > 0) {
                const overwrite = window.confirm('One or more imported standards may conflict with existing identifiers. Select OK to overwrite matching identifiers, or Cancel to preserve existing standards.');
                importAccessibilityStandardList(standardsFromTable, overwrite);
                setNetworkActivity('Offline', 'Local standards import completed with no external transfer.');
                recordSecurityAudit('Local standards import completed', `File: ${selected.name}`);
                writeStatus(`Imported accessibility standards from file (${standardsFromTable.length} bundle${standardsFromTable.length === 1 ? '' : 's'}).`);
                return;
            }

            const validation = validateAccessibilityStandardPayload(text);
            if (!validation.isValid) {
                writeStatus('Import failed. Could not parse standards data from the selected file.');
                return;
            }

            if (validation.isBundle) {
                const overwrite = window.confirm('One or more imported standards may conflict with existing identifiers. Select OK to overwrite matching identifiers, or Cancel to preserve existing standards.');
                importAccessibilityStandardList(validation.standards, overwrite);
                setNetworkActivity('Offline', 'Local standards import completed with no external transfer.');
                recordSecurityAudit('Local standards import completed', `File: ${selected.name}`);
                writeStatus(`Imported accessibility standards from file (${validation.standards.length} bundle${validation.standards.length === 1 ? '' : 's'}).`);
                return;
            }

            const overwrite = Boolean(findImportedStandardConflict(validation.standard.internalId))
                && window.confirm('A standard with this identifier already exists. Select OK to overwrite, or Cancel to keep the existing standard.');
            const added = addImportedAccessibilityStandard(validation.standard, validation.standard.displayName, { overwrite });
            if (!added.ok) {
                writeStatus('Import failed. Could not import accessibility standard due to a conflict.');
                return;
            }

            registerPackageFromWorkflow({
                packageId: `standard:${String(added.standard.internalId || added.standard.id || '').trim()}`,
                packageType: 'accessibility-standards',
                displayName: added.standard.displayName || 'Imported Standard',
                description: 'Imported accessibility standards package.',
                version: added.standard.version || '1.0',
                sourceWorkflow: 'settingsImportStandardsFile',
                metadata: {
                    sourceId: added.standard.id,
                    internalId: added.standard.internalId,
                    criteriaCount: Array.isArray(added.standard.criteria) ? added.standard.criteria.length : 0
                },
                resources: [{ type: 'accessibility-standard', id: added.standard.id }]
            }, {
                sourceWorkflow: 'settingsImportStandardsFile'
            });

            setNetworkActivity('Offline', 'Local standards import completed with no external transfer.');
            recordSecurityAudit('Local standards import completed', `File: ${selected.name}`);
            writeStatus(`Imported accessibility standard ${added.standard.displayName}.`);
            refreshSettingsView();
        } catch (error) {
            writeStatus('Import failed. Could not read the selected standards file.');
        }
    });

    backupAutoInput.addEventListener('change', () => {
        updateSecurityConfig({
            backup: {
                ...getSecurityConfig().backup,
                autoEnabled: backupAutoInput.checked
            }
        }, { action: 'Updated backup automation setting' });
        renderIntegrationSettings();
        writeStatus(backupAutoInput.checked ? 'Automatic backups enabled.' : 'Automatic backups disabled.');
    });

    backupFrequencySelect.addEventListener('change', () => {
        updateSecurityConfig({
            backup: {
                ...getSecurityConfig().backup,
                frequency: backupFrequencySelect.value
            }
        }, { action: 'Updated backup frequency' });
        renderIntegrationSettings();
        writeStatus(`Backup frequency set to ${backupFrequencySelect.value}.`);
    });

    backupRetentionInput.addEventListener('change', () => {
        const retention = Number(backupRetentionInput.value || 5);
        updateSecurityConfig({
            backup: {
                ...getSecurityConfig().backup,
                retention
            }
        }, { action: 'Updated backup retention' });
        renderIntegrationSettings();
        writeStatus('Backup retention updated.');
    });

    backupNowButton.addEventListener('click', () => {
        void executeSettingsAction('settingsCreateBackup');
    });

    restoreImportButton.addEventListener('click', () => {
        restoreInput.value = '';
        restoreInput.click();
    });

    restoreInput.addEventListener('change', async () => {
        const selected = restoreInput.files && restoreInput.files[0];
        if (!selected) return;
        try {
            const text = await selected.text();
            const payload = JSON.parse(text);
            const approved = window.confirm('Restore backup now? This replaces current ART-managed data only. External files are never modified.');
            if (!approved) {
                writeStatus('Backup restore cancelled.');
                return;
            }
            const restored = restoreArtBackupPayload(payload);
            if (!restored.ok) {
                writeStatus('Restore failed. Backup file format is invalid.');
                return;
            }
            writeStatus('Backup restored.');
            refreshSettingsView();
        } catch (error) {
            writeStatus('Restore failed. Could not read backup file.');
        }
    });

    createRestorePointButton.addEventListener('click', () => {
        const point = createRestorePoint('Manual Restore Point');
        renderIntegrationSettings();
        writeStatus(`Restore point created: ${point.label}.`);
    });

    restorePointApplyButton.addEventListener('click', () => {
        const pointId = String(restorePointSelect.value || '').trim();
        if (!pointId) {
            writeStatus('No restore point selected.');
            return;
        }
        const approved = window.confirm('Apply selected restore point? This replaces current ART-managed data only. External files are never modified.');
        if (!approved) {
            writeStatus('Restore point apply cancelled.');
            return;
        }
        const restored = restoreFromPoint(pointId);
        if (!restored.ok) {
            writeStatus('Restore failed. Restore point was not found.');
            return;
        }
        writeStatus(`Restore point applied: ${restored.point.label}.`);
        refreshSettingsView();
    });
}

function trapSettingsFocus(event) {
    const dialog = document.getElementById('app-settings-dialog');
    if (!dialog || dialog.hidden) return;

    const trapContainer = activeSubDialog && !activeSubDialog.dialog.hidden ? activeSubDialog.dialog : dialog;

    if (event.type === 'focusin') {
        if (!trapContainer.contains(event.target)) {
            getFocusableElements(trapContainer)[0]?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        if (activeSubDialog) {
            closeSubDialog(true);
            return;
        }
        closeSettingsDialog(true);
        return;
    }

    if (event.key !== 'Tab') return;
    const focusables = getFocusableElements(trapContainer);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first.focus();
    }
}

function openSettingsDialog(trigger) {
    const dialog = document.getElementById('app-settings-dialog');
    const heading = document.getElementById('app-settings-heading');
    const closeButton = document.getElementById('btn-settings-close');
    if (!dialog || !closeButton) return false;

    lastTrigger = trigger || document.getElementById('btn-app-settings');
    pendingVisualAccessibilitySnapshot = getVisualAccessibilityConfig();
    pendingVisualAccessibilityDirty = false;
    refreshSettingsView();
    dialog.hidden = false;
    window.setTimeout(() => {
        if (heading) {
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus();
        } else {
            closeButton.focus();
        }
        announce('Application Settings dialog opened.');
    }, 0);
    return true;
}

function closeSettingsDialog(restoreFocus) {
    const dialog = document.getElementById('app-settings-dialog');
    if (!dialog) return false;
    revertVisualAccessibilityPreview();
    dialog.hidden = true;
    if (restoreFocus && lastTrigger) {
        lastTrigger.focus();
    }
    return true;
}

export function openSettingsDialogFromCommand() {
    const openButton = document.getElementById('btn-app-settings');
    return openSettingsDialog(openButton || null);
}

function focusSettingsSectionByHeadingId(headingId = '') {
    if (!openSettingsDialogFromCommand()) return false;
    window.setTimeout(() => {
        const heading = document.getElementById(String(headingId || '').trim());
        if (!heading) return;
        heading.scrollIntoView({ block: 'start' });
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus();
    }, 0);
    return true;
}

export function openSettingsAnalyticsSectionFromCommand() {
    return focusSettingsSectionByHeadingId('settings-analytics-heading');
}

export function openSettingsIntegrationsSectionFromCommand() {
    return focusSettingsSectionByHeadingId('settings-integrations-heading');
}

export function openSettingsCollaborationSectionFromCommand() {
    return focusSettingsSectionByHeadingId('settings-collaboration-heading');
}

export function applySoloCollaborationPresetFromCommand() {
    return applyCollaborationPresetFromSettings('solo');
}

export function applyTeamCollaborationPresetFromCommand() {
    return applyCollaborationPresetFromSettings('team');
}

export function resetCollaborationBaselineFromCommand() {
    return resetCollaborationBaselineFromSettings();
}

export function recordCollaborationSyncCheckpointFromCommand() {
    return recordSyncCheckpointFromSettings();
}

export function generateCollaborationDiscoverySnapshotFromCommand() {
    return generateDiscoverySnapshotFromSettings();
}

export function queueCollaborationTestConflictFromCommand() {
    return queueTestConflictFromSettings();
}

export function resolveOldestCollaborationConflictFromCommand() {
    return resolveOldestConflictFromSettings();
}

export function registerCollaborationPresenceSessionFromCommand() {
    return registerPresenceSessionFromSettings();
}

export function clearCollaborationSessionsFromCommand() {
    return clearPresenceSessionsFromSettings();
}

export async function quickStartLiveCollaborationFromCommand() {
    return quickStartLiveCollaborationFromSettings();
}

export async function connectLiveCollaborationFromCommand() {
    return connectLiveCollaborationServerFromSettings();
}

export function disconnectLiveCollaborationFromCommand() {
    return disconnectLiveCollaborationServerFromSettings();
}

export function startLiveCollaborationSessionFromCommand() {
    return startLiveCollaborationSessionFromSettings();
}

export function publishAsyncCollaborationSnapshotFromCommand() {
    return publishAsyncCollaborationSnapshotFromSettings();
}

export async function pullAsyncCollaborationSnapshotFromCommand() {
    return pullAsyncCollaborationSnapshotFromSettings();
}

export function closeSettingsDialogFromCommand() {
    const dialog = document.getElementById('app-settings-dialog');
    if (!dialog || dialog.hidden) return false;
    return closeSettingsDialog(true);
}

export function restoreSettingsShortcutsFromCommand() {
    resetShortcutsToDefault();
    refreshSettingsView();
    writeStatus('Default keyboard shortcuts restored.');
    return true;
}

export function applyVisualAccessibilitySettingsFromCommand() {
    applyVisualAccessibilitySettings();
    return true;
}

export function cancelVisualAccessibilitySettingsFromCommand() {
    revertVisualAccessibilityPreview();
    refreshSettingsView();
    writeStatus('Visual accessibility changes discarded.');
    return true;
}

export function restoreVisualAccessibilityDefaultsFromCommand() {
    resetVisualAccessibilityPreviewToDefaults();
    refreshSettingsView();
    return true;
}

export function startSettingsImportStandardFromCommand() {
    if (typeof startSettingsStandardImportPicker !== 'function') return false;
    return startSettingsStandardImportPicker();
}

export function openSettingsPasteStandardTableFromCommand() {
    if (typeof openSettingsPasteStandardsDialog !== 'function') return false;
    return openSettingsPasteStandardsDialog();
}

export function startSettingsImportReportFileFromCommand() {
    if (typeof startSettingsReportImportPicker !== 'function') return false;
    return startSettingsReportImportPicker();
}

export function startSettingsImportTemplateFileFromCommand() {
    if (typeof startSettingsTemplateImportPicker !== 'function') return false;
    return startSettingsTemplateImportPicker();
}

export function toggleSettingsPrivacyModeFromCommand() {
    if (typeof toggleSettingsPrivacyMode !== 'function') return false;
    return toggleSettingsPrivacyMode();
}

export function createSettingsBackupFromCommand() {
    if (typeof createSettingsBackupNow !== 'function') return false;
    return createSettingsBackupNow();
}

export function openSettingsResetDialogFromCommand() {
    if (typeof openSettingsResetDialog !== 'function') return false;
    return openSettingsResetDialog();
}

export function startSettingsPluginInstallFromCommand() {
    const input = document.getElementById('settings-plugin-install-input');
    if (!input) return false;
    input.value = '';
    input.click();
    return true;
}

export function validateSettingsPluginExtensionsFromCommand() {
    const result = validateRegisteredExtensions();
    renderPluginManager();
    if (result.ok) {
        writeStatus(`Validation completed. ${result.total} extension records are valid.`);
    } else {
        writeStatus(`Validation completed with ${result.failed} issue(s).`);
    }
    return true;
}

export function refreshSettingsPluginManagerFromCommand() {
    renderPluginManager();
    writeStatus('Plugin and package manager refreshed.');
    return true;
}

export function exportSettingsPluginFrameworkConfigFromCommand() {
    try {
        const payload = exportPluginFrameworkState();
        const blob = new Blob([payload], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `art-plugin-framework-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        writeStatus('Exported plugin framework configuration.');
        return true;
    } catch (error) {
        writeStatus('Plugin framework export failed.');
        return false;
    }
}

export function importSettingsPluginFrameworkConfigFromCommand() {
    const input = document.getElementById('settings-plugin-import-config-input');
    if (!input) return false;
    input.value = '';
    input.click();
    return true;
}

function bindShortcutCapture() {
    const dialog = document.getElementById('app-settings-dialog');
    const conflictDialog = document.getElementById('settings-shortcut-conflict-dialog');
    const conflictMessage = document.getElementById('settings-shortcut-conflict-message');
    const conflictAssign = document.getElementById('btn-settings-shortcut-conflict-assign');
    const conflictCancel = document.getElementById('btn-settings-shortcut-conflict-cancel');

    if (!dialog || !conflictDialog || !conflictMessage || !conflictAssign || !conflictCancel) return;

    dialog.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            const didAct = event.shiftKey ? redoState() : undoState();
            if (didAct) {
                refreshSettingsView();
                writeStatus(event.shiftKey ? 'Redo applied in Settings.' : 'Undo applied in Settings.');
            }
            return;
        }

        if (!pendingShortcutUpdate) return;
        event.preventDefault();
        const shortcut = getShortcutFromEvent(event);
        if (!shortcut) {
            pendingShortcutUpdate.input.value = getShortcutDefinitions().find((item) => item.action === pendingShortcutUpdate.action)?.shortcut || '';
            return;
        }

        const currentAction = pendingShortcutUpdate.action;
        const artConflict = findShortcutConflict(shortcut, currentAction);
        const browserConflict = isBrowserReservedShortcut(shortcut);

        if (!artConflict && !browserConflict) {
            const result = updateShortcut(currentAction, shortcut, { allowConflict: false });
            if (!result.ok) {
                if (result.reason === 'conflict') {
                    const conflictLabel = result.conflict?.label || 'another action';
                    const conflictText = `${shortcut} is already assigned to ${conflictLabel}. Assign it anyway?`;
                    conflictMessage.textContent = conflictText;
                    writeStatus(conflictText);
                    openSubDialog(conflictDialog, conflictAssign, pendingShortcutUpdate.input);
                    conflictAssign.onclick = () => {
                        const forceResult = updateShortcut(currentAction, shortcut, { allowConflict: true });
                        closeSubDialog(true);
                        if (!forceResult.ok) return;
                        const actionLabel = getAssignableActions().find((item) => item.action === currentAction)?.label || 'action';
                        refreshSettingsView();
                        pendingShortcutUpdate = null;
                        document.getElementById(`settings-shortcut-input-${currentAction}`)?.focus();
                        writeStatus(`Shortcut changed. ${shortcut} is now assigned to ${actionLabel}.`);
                    };
                    conflictCancel.onclick = () => {
                        closeSubDialog(true);
                        refreshSettingsView();
                        pendingShortcutUpdate = null;
                        document.getElementById(`settings-shortcut-input-${currentAction}`)?.focus();
                    };
                }
                return;
            }
            const actionLabel = getAssignableActions().find((item) => item.action === currentAction)?.label || 'action';
            writeStatus(`Shortcut changed. ${shortcut} is now assigned to ${actionLabel}.`);
            refreshSettingsView();
            pendingShortcutUpdate = null;
            document.getElementById(`settings-shortcut-input-${currentAction}`)?.focus();
            return;
        }

        if (artConflict || browserConflict) {
            const conflictText = browserConflict && artConflict
                ? `${shortcut} is already assigned to ${artConflict.label} and is reserved by the browser. Assign it anyway?`
                : browserConflict
                    ? `${shortcut} is reserved by the browser. Assign it anyway?`
                    : `${shortcut} is already assigned to ${artConflict.label}. Assign it anyway?`;
            conflictMessage.textContent = conflictText;
            writeStatus(conflictText);
            openSubDialog(conflictDialog, conflictAssign, pendingShortcutUpdate.input);
            conflictAssign.onclick = () => {
                const forceResult = updateShortcut(currentAction, shortcut, { allowConflict: true });
                closeSubDialog(true);
                if (!forceResult.ok) return;
                const actionLabel = getAssignableActions().find((item) => item.action === currentAction)?.label || 'action';
                refreshSettingsView();
                pendingShortcutUpdate = null;
                document.getElementById(`settings-shortcut-input-${currentAction}`)?.focus();
                writeStatus(`Shortcut changed. ${shortcut} is now assigned to ${actionLabel}.`);
            };
            conflictCancel.onclick = () => {
                closeSubDialog(true);
                refreshSettingsView();
                pendingShortcutUpdate = null;
                document.getElementById(`settings-shortcut-input-${currentAction}`)?.focus();
            };
        }
    });
}

function bindStandardImport() {
    const importButton = document.getElementById('btn-settings-import-standard');
    const pasteButton = document.getElementById('btn-settings-paste-standard');
    const nameDialog = document.getElementById('settings-standard-name-dialog');
    const nameInput = document.getElementById('settings-standard-name-input');
    const nameSave = document.getElementById('btn-settings-standard-name-save');
    const nameCancel = document.getElementById('btn-settings-standard-name-cancel');
    const jsonDialog = document.getElementById('settings-standard-json-dialog');
    const jsonInput = document.getElementById('settings-standard-json-input');
    const jsonSave = document.getElementById('btn-settings-standard-json-save');
    const jsonCancel = document.getElementById('btn-settings-standard-json-cancel');
    const overwriteDialog = document.getElementById('settings-standard-overwrite-dialog');
    const overwriteMessage = document.getElementById('settings-standard-overwrite-message');
    const overwriteYes = document.getElementById('btn-settings-standard-overwrite-yes');
    const overwriteNo = document.getElementById('btn-settings-standard-overwrite-no');
    const pasteDialog = document.getElementById('settings-standard-paste-dialog');
    const pasteInput = document.getElementById('settings-standard-paste-input');
    const pasteImport = document.getElementById('btn-settings-standard-paste-import');
    const pasteCancel = document.getElementById('btn-settings-standard-paste-cancel');
    const clearButton = document.getElementById('btn-settings-clear-standards');
    const clearDialog = document.getElementById('settings-clear-standards-dialog');
    const clearConfirm = document.getElementById('btn-settings-clear-standards-confirm');
    const clearCancel = document.getElementById('btn-settings-clear-standards-cancel');

    if (!importButton || !pasteButton || !nameDialog || !nameInput || !nameSave || !nameCancel || !jsonDialog || !jsonInput || !jsonSave || !jsonCancel || !overwriteDialog || !overwriteMessage || !overwriteYes || !overwriteNo || !pasteDialog || !pasteInput || !pasteImport || !pasteCancel || !clearButton || !clearDialog || !clearConfirm || !clearCancel) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    const openNameDialog = () => {
        if (!pendingImportedStandard) return;
        nameInput.value = pendingImportedStandard.displayName || '';
        nameSave.textContent = 'Save';
        openSubDialog(nameDialog, nameInput, importButton);
    };

    const startStandardImportPicker = () => {
        fileInput.value = '';
        fileInput.click();
        return true;
    };

    const openPasteStandardsDialog = () => {
        pasteInput.value = '';
        openSubDialog(pasteDialog, pasteInput, pasteButton);
        return true;
    };

    startSettingsStandardImportPicker = startStandardImportPicker;
    openSettingsPasteStandardsDialog = openPasteStandardsDialog;

    const processImportedText = async (text, triggerButton) => {
        const pastedText = String(text || '').trim();
        const tableStandards = parsePastedStandardsTable(pastedText);

        if (tableStandards && tableStandards.length > 0) {
            pendingImportedStandard = null;
            pendingEditedStandard = null;
            pendingImportedStandards = tableStandards;
            pendingOverwrite = false;

            const hasConflict = pendingImportedStandards.some((standard) => findImportedStandardConflict(standard.internalId));
            if (hasConflict) {
                overwriteMessage.textContent = 'One or more standards in this table already exist. Overwrite matching standards?';
                openSubDialog(overwriteDialog, overwriteYes, triggerButton || importButton);
                return;
            }

            importAccessibilityStandardList(pendingImportedStandards, false);
            pendingImportedStandards = null;
            return;
        }

        if (tableStandards === null && /\t|\|/.test(pastedText)) {
            writeStatus('Paste failed. The table could not be converted into accessibility standards.');
            return;
        }

        const validation = validateAccessibilityStandardPayload(pastedText);
        if (!validation.isValid) {
            writeStatus('Import failed. Accessibility standard JSON is invalid.');
            return;
        }

        if (validation.isBundle) {
            pendingImportedStandard = null;
            pendingEditedStandard = null;
            pendingImportedStandards = validation.standards;
            pendingOverwrite = false;

            const hasConflict = pendingImportedStandards.some((standard) => findImportedStandardConflict(standard.internalId));
            if (hasConflict) {
                overwriteMessage.textContent = 'One or more standards in this backup already exist. Overwrite matching standards?';
                openSubDialog(overwriteDialog, overwriteYes, triggerButton || importButton);
                return;
            }

            importAccessibilityStandardList(pendingImportedStandards, false);
            pendingImportedStandards = null;
            return;
        }

        pendingImportedStandard = validation.standard;
        pendingImportedStandards = null;
        pendingOverwrite = false;

        const conflict = findImportedStandardConflict(pendingImportedStandard.internalId);
        if (conflict) {
            overwriteMessage.textContent = `A standard with identifier ${pendingImportedStandard.internalId || pendingImportedStandard.displayName} already exists.`;
            openSubDialog(overwriteDialog, overwriteYes, triggerButton || importButton);
            return;
        }

        openNameDialog();
    };

    importButton.addEventListener('click', () => {
        void executeSettingsAction('settingsImportStandard');
    });

    pasteButton.addEventListener('click', () => {
        void executeSettingsAction('settingsPasteStandardTable');
    });

    jsonSave.addEventListener('click', () => {
        if (!pendingEditedStandard) return;

        const text = String(jsonInput.value || '').trim();
        if (!text) {
            writeStatus('Edit failed. No JSON was provided.');
            jsonInput.focus();
            return;
        }

        const validation = validateAccessibilityStandardPayload(text);
        if (!validation.isValid) {
            writeStatus('Edit failed. Accessibility standard JSON is invalid.');
            jsonInput.focus();
            return;
        }

        const nextStandard = validation.isBundle
            ? (validation.standards.length === 1 ? validation.standards[0] : null)
            : validation.standard;

        if (!nextStandard) {
            writeStatus('Edit failed. Please provide a single accessibility standard.');
            jsonInput.focus();
            return;
        }

        const result = replaceImportedAccessibilityStandard(pendingEditedStandard.id, nextStandard);
        if (!result || result.ok === false) {
            writeStatus('Edit failed. Another imported standard already uses that identifier.');
            jsonInput.focus();
            return;
        }

        pendingEditedStandard = null;
        pendingEditedStandardJson = null;
        closeSubDialog(true);
        refreshSettingsView();
        writeStatus(`Updated accessibility standard ${result.standard.displayName}.`);
    });

    jsonCancel.addEventListener('click', () => {
        pendingEditedStandard = null;
        pendingEditedStandardJson = null;
        closeSubDialog(true);
    });

    clearButton.addEventListener('click', () => {
        pendingClearStandards = true;
        openSubDialog(clearDialog, clearConfirm, clearButton);
    });

    fileInput.addEventListener('change', async () => {
        const selected = fileInput.files && fileInput.files[0];
        if (!selected) return;

        try {
            const text = await selected.text();
            await processImportedText(text, importButton);
        } catch (error) {
            writeStatus('Import failed. Could not read selected file.');
        }
    });

    pasteImport.addEventListener('click', async () => {
        const text = String(pasteInput.value || '').trim();
        if (!text) {
            writeStatus('Paste failed. No table data was provided.');
            pasteInput.focus();
            return;
        }

        try {
            await processImportedText(text, pasteButton);
            if (!pendingImportedStandard && !pendingImportedStandards) {
                closeSubDialog(true);
            }
        } catch (error) {
            writeStatus('Paste failed. Could not process pasted standards.');
        }
    });

    overwriteYes.addEventListener('click', () => {
        pendingOverwrite = true;
        if (pendingImportedStandards) {
            const standards = pendingImportedStandards;
            pendingImportedStandards = null;
            closeSubDialog(false);
            importAccessibilityStandardList(standards, true);
            pendingOverwrite = false;
            return;
        }
        closeSubDialog(false);
        openNameDialog();
    });

    overwriteNo.addEventListener('click', () => {
        pendingImportedStandard = null;
        pendingOverwrite = false;
        pendingImportedStandards = null;
        closeSubDialog(true);
    });

    clearConfirm.addEventListener('click', () => {
        if (!pendingClearStandards) return;
        const removed = clearImportedAccessibilityStandards();
        pendingClearStandards = false;
        closeSubDialog(true);
        if (removed.length === 0) {
            writeStatus('No imported accessibility standards to clear.');
            return;
        }
        refreshSettingsView();
        writeStatus(`Cleared ${removed.length} imported accessibility standard${removed.length === 1 ? '' : 's'}.`);
    });

    clearCancel.addEventListener('click', () => {
        pendingClearStandards = false;
        closeSubDialog(true);
    });

    nameSave.addEventListener('click', () => {
        if (pendingEditedStandard) {
            const displayName = nameInput.value.trim();
            if (!displayName) {
                nameInput.focus();
                return;
            }

            const updated = updateImportedAccessibilityStandard(pendingEditedStandard.id, { displayName });
            if (!updated) {
                writeStatus('Could not update accessibility standard.');
                return;
            }

            pendingEditedStandard = null;
            closeSubDialog(true);
            refreshSettingsView();
            writeStatus(`Updated accessibility standard ${displayName}.`);
            nameSave.textContent = 'Save';
            return;
        }

        if (!pendingImportedStandard) return;
        const displayName = nameInput.value.trim();
        if (!displayName) {
            nameInput.focus();
            return;
        }

        const result = addImportedAccessibilityStandard(pendingImportedStandard, displayName, { overwrite: pendingOverwrite });
        if (!result.ok) {
            writeStatus('Could not import standard due to a conflict.');
            return;
        }

        registerPackageFromWorkflow({
            packageId: `standard:${String(result.standard.internalId || result.standard.id || '').trim()}`,
            packageType: 'accessibility-standards',
            displayName: result.standard.displayName || displayName,
            description: 'Imported accessibility standards package.',
            version: result.standard.version || '1.0',
            sourceWorkflow: 'settingsImportStandard',
            metadata: {
                sourceId: result.standard.id,
                internalId: result.standard.internalId,
                criteriaCount: Array.isArray(result.standard.criteria) ? result.standard.criteria.length : 0
            },
            resources: [{ type: 'accessibility-standard', id: result.standard.id }]
        }, {
            sourceWorkflow: 'settingsImportStandard'
        });

        pendingImportedStandard = null;
        pendingOverwrite = false;
        pendingImportedStandards = null;
        closeSubDialog(true);
        refreshSettingsView();
        writeStatus(`Imported accessibility standard ${displayName}.`);
        nameSave.textContent = 'Save';
    });

    nameCancel.addEventListener('click', () => {
        pendingImportedStandard = null;
        pendingImportedStandards = null;
        pendingEditedStandard = null;
        pendingOverwrite = false;
        nameSave.textContent = 'Save';
        closeSubDialog(true);
    });

    pasteCancel.addEventListener('click', () => {
        closeSubDialog(true);
    });
}

function bindResetActions() {
    const resetButton = document.getElementById('btn-settings-reset-app');
    const resetDialog = document.getElementById('settings-reset-dialog');
    const resetConfirm = document.getElementById('btn-settings-reset-confirm');
    const resetCancel = document.getElementById('btn-settings-reset-cancel');

    if (!resetButton || !resetDialog || !resetConfirm || !resetCancel) return;

    const runOpenResetDialog = () => {
        const defaultOption = resetDialog.querySelector('input[name="settings-reset-option"][value="preferences"]');
        if (defaultOption) defaultOption.checked = true;
        openSubDialog(resetDialog, defaultOption || resetConfirm, resetButton);
        return true;
    };

    openSettingsResetDialog = runOpenResetDialog;

    resetButton.addEventListener('click', () => {
        void executeSettingsAction('settingsResetApp');
    });

    resetConfirm.addEventListener('click', () => {
        const selected = resetDialog.querySelector('input[name="settings-reset-option"]:checked');
        const option = selected?.value || 'preferences';

        if (option === 'all') {
            resetAllApplicationData();
            closeSubDialog(false);
            closeSettingsDialog(true);
            writeStatus('ART has been reset to its default state.');
            return;
        }

        resetUserPreferences();
        closeSubDialog(true);
        refreshSettingsView();
        writeStatus('Application settings restored.');
    });

    resetCancel.addEventListener('click', () => {
        closeSubDialog(true);
    });
}

function bindVisualAccessibilitySettings() {
    const themeSelect = document.getElementById('settings-visual-theme');
    const zoomSelect = document.getElementById('settings-visual-zoom');
    const fontSizeSelect = document.getElementById('settings-visual-font-size');
    const densitySelect = document.getElementById('settings-visual-density');
    const enhancedFocus = document.getElementById('settings-visual-focus-indicators');
    const reducedMotion = document.getElementById('settings-visual-reduced-motion');
    const borderVisibility = document.getElementById('settings-visual-border-visibility');
    const followSystemTheme = document.getElementById('settings-visual-follow-system-theme');
    const applyButton = document.getElementById('btn-settings-visual-apply');
    const cancelButton = document.getElementById('btn-settings-visual-cancel');
    const defaultsButton = document.getElementById('btn-settings-visual-defaults');

    if (!themeSelect || !zoomSelect || !fontSizeSelect || !densitySelect || !enhancedFocus || !reducedMotion || !borderVisibility || !followSystemTheme || !applyButton || !cancelButton || !defaultsButton) return;

    const previewNow = () => previewVisualAccessibilitySettings(getVisualAccessibilityFormValues());

    [themeSelect, zoomSelect, fontSizeSelect, densitySelect, enhancedFocus, reducedMotion, borderVisibility, followSystemTheme]
        .forEach((control) => {
            control.addEventListener('change', previewNow);
            control.addEventListener('input', previewNow);
        });

    applyButton.addEventListener('click', () => {
        applyVisualAccessibilitySettings();
    });

    cancelButton.addEventListener('click', () => {
        revertVisualAccessibilityPreview();
        refreshSettingsView();
        writeStatus('Visual accessibility changes discarded.');
    });

    defaultsButton.addEventListener('click', () => {
        resetVisualAccessibilityPreviewToDefaults();
    });
}

function bindWorkspaceViewSettings() {
    const controls = getWorkspaceViewControls();
    if (!controls.defaultView || !controls.rememberLast || !controls.width || !controls.applyButton) return;

    controls.width.addEventListener('input', () => {
        if (controls.widthValue) controls.widthValue.textContent = `${controls.width.value} px`;
    });

    controls.applyButton.addEventListener('click', () => {
        applyWorkspaceViewSettings();
    });
}

function getSearchControls() {
    return {
        defaultScope: document.getElementById('settings-search-default-scope'),
        historyEnabled: document.getElementById('settings-search-history-enabled'),
        recentEnabled: document.getElementById('settings-search-recent-enabled'),
        recentMax: document.getElementById('settings-search-recent-max'),
        navigationEnabled: document.getElementById('settings-navigation-history-enabled'),
        breadcrumbsEnabled: document.getElementById('settings-navigation-breadcrumbs-enabled'),
        navigationMax: document.getElementById('settings-navigation-history-max'),
        clearNavigationButton: document.getElementById('btn-settings-clear-navigation-history'),
        applyButton: document.getElementById('btn-settings-search-apply'),
        clearHistoryButton: document.getElementById('btn-settings-search-clear-history'),
        clearRecentButton: document.getElementById('btn-settings-search-clear-recent'),
        summary: document.getElementById('settings-search-summary')
    };
}

function renderSearchSettings() {
    const controls = getSearchControls();
    if (!controls.defaultScope || !controls.applyButton) return;

    const config = getUniversalSearchConfig();
    controls.defaultScope.value = String(config.scopePreference || 'auto');
    if (controls.historyEnabled) controls.historyEnabled.checked = config.historyEnabled !== false;
    if (controls.recentEnabled) controls.recentEnabled.checked = config.recentItemsEnabled !== false;
    if (controls.recentMax) controls.recentMax.value = String(config.maxRecentItems || 20);

    const navigation = getNavigationHistory();
    if (controls.navigationEnabled) controls.navigationEnabled.checked = navigation.enabled !== false;
    if (controls.breadcrumbsEnabled) controls.breadcrumbsEnabled.checked = navigation.breadcrumbsEnabled !== false;
    if (controls.navigationMax) controls.navigationMax.value = String(navigation.maxEntries || 50);

    if (controls.summary) {
        const historyCount = Array.isArray(config.history) ? config.history.length : 0;
        const recentCount = Array.isArray(config.recentItems) ? config.recentItems.length : 0;
        const scopeLabel = controls.defaultScope.selectedOptions?.[0]?.textContent || controls.defaultScope.value;
        controls.summary.textContent = `Default search scope ${scopeLabel}. Search history ${config.historyEnabled !== false ? 'on' : 'off'}, ${historyCount} saved ${historyCount === 1 ? 'entry' : 'entries'}. Recent items ${config.recentItemsEnabled !== false ? 'on' : 'off'}, ${recentCount} stored.`;
    }
}

function applySearchSettings() {
    const controls = getSearchControls();
    if (!controls.defaultScope) return false;

    updateUniversalSearchConfig({
        scopePreference: controls.defaultScope.value || 'auto',
        historyEnabled: Boolean(controls.historyEnabled?.checked),
        recentItemsEnabled: Boolean(controls.recentEnabled?.checked),
        maxRecentItems: Number(controls.recentMax?.value) || 20
    }, {
        action: 'Updated search settings',
        persist: true
    });

    updateNavigationHistory({
        enabled: Boolean(controls.navigationEnabled?.checked),
        breadcrumbsEnabled: Boolean(controls.breadcrumbsEnabled?.checked),
        maxEntries: Number(controls.navigationMax?.value) || 50
    }, {
        action: 'Updated navigation settings',
        persist: true
    });

    writeStatus('Search settings applied.');
    renderSearchSettings();
    return true;
}

function bindSearchSettings() {
    const controls = getSearchControls();
    if (!controls.applyButton) return;

    controls.applyButton.addEventListener('click', () => {
        applySearchSettings();
    });

    controls.clearHistoryButton?.addEventListener('click', () => {
        clearUniversalSearchHistory({ persist: true });
        writeStatus('Search history cleared.');
        renderSearchSettings();
    });

    controls.clearRecentButton?.addEventListener('click', () => {
        clearRecentItems({ persist: true });
        writeStatus('Recent items cleared.');
        renderSearchSettings();
    });

    controls.clearNavigationButton?.addEventListener('click', () => {
        clearNavigationHistoryEntries({ persist: true });
        writeStatus('Navigation history cleared. Favorites, bookmarks, and saved searches were not changed.');
        renderSearchSettings();
    });
}

function bindAnalyticsSettings() {
    const controls = getAnalyticsControls();
    if (!controls.applyButton) return;
    controls.applyButton.addEventListener('click', () => {
        applyAnalyticsSettings();
    });
    bindSearchSettings();
}

function bindCollaborationSettings() {
    const controls = getCollaborationControls();
    if (!controls.applyButton) return;
    controls.applyButton.addEventListener('click', () => {
        applyCollaborationSettings();
    });
    controls.startSessionButton?.addEventListener('click', () => {
        registerPresenceSessionFromSettings();
    });
    controls.clearSessionsButton?.addEventListener('click', () => {
        clearPresenceSessionsFromSettings();
    });
    controls.syncNowButton?.addEventListener('click', () => {
        recordSyncCheckpointFromSettings();
    });
    controls.presetSoloButton?.addEventListener('click', () => {
        applyCollaborationPresetFromSettings('solo');
    });
    controls.presetTeamButton?.addEventListener('click', () => {
        applyCollaborationPresetFromSettings('team');
    });
    controls.resetBaselineButton?.addEventListener('click', () => {
        resetCollaborationBaselineFromSettings();
    });
    controls.liveQuickStartButton?.addEventListener('click', async () => {
        await quickStartLiveCollaborationFromSettings();
    });
    controls.liveConnectButton?.addEventListener('click', async () => {
        await connectLiveCollaborationServerFromSettings();
    });
    controls.liveDisconnectButton?.addEventListener('click', () => {
        disconnectLiveCollaborationServerFromSettings();
    });
    controls.liveStartSessionButton?.addEventListener('click', () => {
        startLiveCollaborationSessionFromSettings();
    });
    controls.livePublishButton?.addEventListener('click', () => {
        publishAsyncCollaborationSnapshotFromSettings();
    });
    controls.livePullButton?.addEventListener('click', async () => {
        await pullAsyncCollaborationSnapshotFromSettings();
    });
    controls.discoverySnapshotButton?.addEventListener('click', () => {
        generateDiscoverySnapshotFromSettings();
    });
    controls.queueConflictButton?.addEventListener('click', () => {
        queueTestConflictFromSettings();
    });
    controls.resolveConflictButton?.addEventListener('click', () => {
        resolveOldestConflictFromSettings();
    });
    controls.addProfileButton?.addEventListener('click', () => {
        addPermissionProfileFromSettings();
    });
    controls.addAssignmentButton?.addEventListener('click', () => {
        addPermissionAssignmentFromSettings();
    });
}

function bindStandardExport() {
    const exportButton = document.getElementById('btn-settings-export-standards');
    if (!exportButton) return;

    exportButton.addEventListener('click', exportImportedStandards);
}

function bindPluginManager() {
    const installButton = document.getElementById('btn-settings-plugin-install');
    const validateButton = document.getElementById('btn-settings-plugin-validate');
    const refreshButton = document.getElementById('btn-settings-plugin-refresh');
    const exportButton = document.getElementById('btn-settings-plugin-export-config');
    const importButton = document.getElementById('btn-settings-plugin-import-config');
    const input = document.getElementById('settings-plugin-install-input');
    const importInput = document.getElementById('settings-plugin-import-config-input');

    if (!installButton || !validateButton || !refreshButton || !input) return;

    installButton.addEventListener('click', () => {
        input.value = '';
        input.click();
    });

    input.addEventListener('change', async () => {
        const selected = input.files && input.files[0];
        if (!selected) return;
        try {
            const text = await selected.text();
            const manifest = JSON.parse(text);
            const preview = validatePluginManifest(manifest);
            if (!preview.ok) {
                writeStatus(`Plugin install failed: ${(preview.errors || []).join('; ')}.`);
                return;
            }

            const existing = getPluginFrameworkSnapshot().plugins.find((item) => item.pluginId === preview.manifest.pluginId);
            const dependencySummary = preview.manifest.pluginDependencies.length > 0
                ? preview.manifest.pluginDependencies.map((entry) => {
                    const optional = entry.optional ? ' (optional)' : '';
                    const version = entry.version ? ` >= ${entry.version}` : '';
                    return `${entry.pluginId}${version}${optional}`;
                }).join(', ')
                : 'None';
            const permissionSummary = preview.manifest.requiredPermissions.length > 0
                ? preview.manifest.requiredPermissions.join(', ')
                : 'None';

            const approved = window.confirm(
                `${existing ? 'Update' : 'Install'} plugin ${preview.manifest.displayName}?\n\n` +
                `Identifier: ${preview.manifest.pluginId}\n` +
                `Version: ${preview.manifest.version}\n` +
                `Dependencies: ${dependencySummary}\n` +
                `Permissions: ${permissionSummary}`
            );
            if (!approved) {
                writeStatus('Plugin installation cancelled.');
                return;
            }

            const result = registerPluginManifest(manifest, { origin: 'external', enabled: true, updateIfExists: true });
            if (!result.ok) {
                writeStatus(`Plugin install failed: ${(result.errors || []).join('; ') || result.reason || 'Unknown error'}.`);
                return;
            }
            const targetPluginId = result.pluginId || preview.manifest.pluginId;
            const enableResult = enablePlugin(targetPluginId);
            if (!enableResult.ok) {
                writeStatus(`Plugin installed but could not be enabled: ${(enableResult.errors || []).join('; ') || enableResult.reason || 'unknown reason'}.`);
                renderPluginManager();
                return;
            }
            renderPluginManager();
            writeStatus(`${existing ? 'Updated' : 'Installed'} plugin ${targetPluginId}.`);
        } catch (error) {
            writeStatus('Plugin install failed. Manifest JSON is invalid.');
        }
    });

    validateButton.addEventListener('click', () => {
        validateSettingsPluginExtensionsFromCommand();
    });

    refreshButton.addEventListener('click', () => {
        refreshSettingsPluginManagerFromCommand();
    });

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            exportSettingsPluginFrameworkConfigFromCommand();
        });
    }

    if (importButton && importInput) {
        importButton.addEventListener('click', () => {
            importSettingsPluginFrameworkConfigFromCommand();
        });

        importInput.addEventListener('change', async () => {
            const selected = importInput.files && importInput.files[0];
            if (!selected) return;
            try {
                const text = await selected.text();
                const payload = JSON.parse(text);
                const result = importPluginFrameworkState(payload);
                renderPluginManager();
                if (!result.ok) {
                    writeStatus('Imported framework configuration with issues. Run Validate Extensions for details.');
                    return;
                }
                writeStatus(`Imported framework configuration: ${result.pluginsProcessed} plugin record(s), ${result.packagesProcessed} package record(s).`);
            } catch (error) {
                writeStatus('Plugin framework import failed. Configuration JSON is invalid.');
            }
        });
    }
}

export function initSettings() {
    if (isInitialized) return;

    const openButton = document.getElementById('btn-app-settings');
    const closeButton = document.getElementById('btn-settings-close');
    const restoreShortcutsButton = document.getElementById('btn-settings-shortcuts-reset');

    if (!openButton || !closeButton) return;

    openButton.addEventListener('click', () => {
        void executeSettingsAction('openSettings').then((result) => {
            if (!result?.ok) {
                openSettingsDialog(openButton);
            }
        });
    });
    closeButton.addEventListener('click', () => {
        void executeSettingsAction('settingsClose').then((result) => {
            if (!result?.ok) {
                closeSettingsDialog(true);
            }
        });
    });

    restoreShortcutsButton?.addEventListener('click', () => {
        void executeSettingsAction('settingsRestoreShortcuts');
    });

    bindShortcutCapture();
    bindSettingsSearch();
    bindSearchAnalyticsSettings();
    bindVisualAccessibilitySettings();
    bindAnalyticsSettings();
    bindCollaborationSettings();
    bindWorkspaceViewSettings();
    bindStandardImport();
    bindStandardExport();
    bindIntegrationSettings();
    bindPluginManager();
    bindResetActions();

    document.addEventListener('keydown', trapSettingsFocus);
    document.addEventListener('focusin', trapSettingsFocus);

    window.addEventListener('art-shortcuts-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-visual-accessibility-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-accessibility-standards-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-security-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-analytics-settings-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-collaboration-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-collaboration-framework-event', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-workspace-view-settings-updated', refreshSettingsViewIfDialogOpen);
    window.addEventListener('art-plugin-framework-event', refreshSettingsViewIfDialogOpen);

    maybeAutoConnectLiveCollaboration();

    isInitialized = true;
}
