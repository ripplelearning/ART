import {
    addImportedAccessibilityStandard,
    announce,
    clearImportedAccessibilityStandards,
    createArtBackupPayload,
    createRestorePoint,
    findImportedStandardConflict,
    findShortcutConflict,
    getApplicationInfo,
    getAssignableActions,
    getGoogleWorkspaceConfig,
    getIntegrationStatusMap,
    getImportedAccessibilityStandards,
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
    resetUserPreferences,
    recordSecurityAudit,
    serializeAccessibilityStandardsJsonPayload,
    undoState,
    updateImportedAccessibilityStandard,
    updateGoogleWorkspaceConfig,
    updateSecurityConfig,
    updateShortcut,
    validateAccessibilityStandardPayload
} from './state.js';
import {
    connectGoogleWorkspace,
    disconnectGoogleWorkspace,
    getRequiredGoogleWorkspaceScopes,
    reconnectGoogleWorkspace
} from './googleWorkspace.js';

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
    const googleStatus = String(info.googleWorkspace?.status || 'disconnected');
    const googleTarget = String(info.googleWorkspace?.defaultExportTarget || 'google-drive');
    const privacyMode = Boolean(info.security?.privacyModeEnabled) ? 'Enabled' : 'Disabled';
    const networkStatus = String(info.security?.networkActivityStatus || 'Offline');

    aboutList.innerHTML = `
        <div><dt>Application</dt><dd>${info.applicationName}</dd></div>
        <div><dt>Version</dt><dd>${info.version}</dd></div>
        <div><dt>Build Date</dt><dd>${info.buildDate || 'Unavailable'}</dd></div>
        <div><dt>Data Schema Version</dt><dd>${info.dataSchemaVersion}</dd></div>
        <div><dt>Imported Accessibility Standard Count</dt><dd>${importedCount}</dd></div>
        <div><dt>Imported Accessibility Standards</dt><dd>${importedNames}</dd></div>
        <div><dt>Privacy Mode</dt><dd>${privacyMode}</dd></div>
        <div><dt>Network Activity</dt><dd>${networkStatus}</dd></div>
        <div><dt>Google Workspace Status</dt><dd>${googleStatus}</dd></div>
        <div><dt>Google Default Export Target</dt><dd>${googleTarget}</dd></div>
    `;
}

function importAccessibilityStandardList(standards, overwrite = false) {
    const list = Array.isArray(standards) ? standards : [];
    if (list.length === 0) return { ok: false, reason: 'empty' };

    list.forEach((standard) => {
        addImportedAccessibilityStandard(standard, standard.displayName, { overwrite });
    });

    refreshSettingsView();
    writeStatus(`Imported ${list.length} accessibility standard${list.length === 1 ? '' : 's'}.`);
    return { ok: true };
}

function formatGoogleConnectionStatus(config) {
    const status = String(config?.status || 'disconnected').toLowerCase();
    if (status === 'connected') {
        const connectedAt = String(config.connectedAt || '').trim();
        const label = connectedAt
            ? `Connected${config.accountEmail ? ` as ${config.accountEmail}` : ''}. Connected ${connectedAt.slice(0, 10)}.`
            : `Connected${config.accountEmail ? ` as ${config.accountEmail}` : ''}.`;
        return label;
    }
    if (status === 'connecting') return 'Connecting to Google Workspace...';
    if (status === 'expired') return 'Google Workspace session expired. Reconnect to continue.';
    if (status === 'error') {
        const detail = String(config.lastError || '').trim();
        return detail ? `Connection error: ${detail}` : 'Connection error. Check your Google settings and try again.';
    }
    return 'Not connected.';
}

function formatGoogleScopeLabel(scope) {
    const value = String(scope || '').trim();
    if (!value) return '';
    if (value.endsWith('/drive.file')) return 'Google Drive: create and manage ART-created files';
    if (value.endsWith('/documents')) return 'Google Docs: create and update ART-exported documents';
    if (value.endsWith('/spreadsheets')) return 'Google Sheets: create and update ART-exported spreadsheets';
    return value;
}

function renderGoogleWorkspaceSettings() {
    const launcherButton = document.getElementById('btn-settings-google-workspace');
    const statusSummary = document.getElementById('settings-google-status-summary');
    const privacyModeInput = document.getElementById('settings-privacy-mode');
    const privacyModeStatus = document.getElementById('settings-privacy-mode-status');
    const enabledInput = document.getElementById('settings-google-enabled');
    const clientIdInput = document.getElementById('settings-google-client-id');
    const exportTargetSelect = document.getElementById('settings-google-export-target');
    const statusElement = document.getElementById('settings-google-connection-status');
    const scopeList = document.getElementById('settings-google-scope-list');
    const connectButton = document.getElementById('btn-settings-google-connect');
    const reconnectButton = document.getElementById('btn-settings-google-reconnect');
    const disconnectButton = document.getElementById('btn-settings-google-disconnect');

    const googleIntegrationStatus = document.getElementById('settings-integration-google-status');
    const jiraIntegrationStatus = document.getElementById('settings-integration-jira-status');
    const githubIntegrationStatus = document.getElementById('settings-integration-github-status');
    const azureIntegrationStatus = document.getElementById('settings-integration-azure-status');
    const backupAutoInput = document.getElementById('settings-backup-auto');
    const backupFrequencySelect = document.getElementById('settings-backup-frequency');
    const backupRetentionInput = document.getElementById('settings-backup-retention');
    const restorePointSelect = document.getElementById('settings-restore-point-select');
    const diagnostics = document.getElementById('settings-security-diagnostics');

    if (!launcherButton || !statusSummary || !privacyModeInput || !privacyModeStatus || !enabledInput || !clientIdInput || !exportTargetSelect || !statusElement || !scopeList || !connectButton || !reconnectButton || !disconnectButton) return;

    const config = getGoogleWorkspaceConfig();
    const security = getSecurityConfig();
    const integrations = getIntegrationStatusMap();
    const privacyModeEnabled = Boolean(security.privacyModeEnabled);
    enabledInput.checked = Boolean(config.enabled);
    clientIdInput.value = String(config.clientId || '');
    exportTargetSelect.value = String(config.defaultExportTarget || 'google-drive');
    const statusText = formatGoogleConnectionStatus(config);
    statusElement.textContent = statusText;
    statusSummary.textContent = statusText;
    privacyModeInput.checked = privacyModeEnabled;
    privacyModeStatus.textContent = privacyModeEnabled
        ? 'Privacy Mode enabled. External integrations are blocked until disabled.'
        : 'Privacy Mode disabled.';
    const scopes = getRequiredGoogleWorkspaceScopes();
    scopeList.innerHTML = scopes
        .map((scope) => `<li>${formatGoogleScopeLabel(scope)}</li>`)
        .join('');

    const isConnected = String(config.status || '').toLowerCase() === 'connected';
    launcherButton.textContent = isConnected
        ? 'Disconnect Google Workspace...'
        : 'Connect Google Workspace...';
    launcherButton.disabled = privacyModeEnabled;
    enabledInput.disabled = privacyModeEnabled;
    clientIdInput.disabled = privacyModeEnabled;
    exportTargetSelect.disabled = privacyModeEnabled;
    connectButton.disabled = privacyModeEnabled || !config.enabled || !String(config.clientId || '').trim() || isConnected;
    reconnectButton.disabled = privacyModeEnabled || !config.enabled || !String(config.clientId || '').trim();
    disconnectButton.disabled = !isConnected;

    if (googleIntegrationStatus) {
        googleIntegrationStatus.textContent = privacyModeEnabled
            ? 'Privacy Mode Enabled'
            : (isConnected ? 'Connected' : 'Not connected');
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
    renderShortcuts();
    renderImportedStandards();
    renderGoogleWorkspaceSettings();
    renderAbout();
}

function bindGoogleWorkspaceSettings() {
    const launcherButton = document.getElementById('btn-settings-google-workspace');
    const googleDialog = document.getElementById('settings-google-dialog');
    const closeButton = document.getElementById('btn-settings-google-close');
    const privacyModeInput = document.getElementById('settings-privacy-mode');
    const enabledInput = document.getElementById('settings-google-enabled');
    const clientIdInput = document.getElementById('settings-google-client-id');
    const exportTargetSelect = document.getElementById('settings-google-export-target');
    const connectButton = document.getElementById('btn-settings-google-connect');
    const reconnectButton = document.getElementById('btn-settings-google-reconnect');
    const disconnectButton = document.getElementById('btn-settings-google-disconnect');
    const backupAutoInput = document.getElementById('settings-backup-auto');
    const backupFrequencySelect = document.getElementById('settings-backup-frequency');
    const backupRetentionInput = document.getElementById('settings-backup-retention');
    const backupNowButton = document.getElementById('btn-settings-backup-now');
    const restoreImportButton = document.getElementById('btn-settings-restore-import');
    const createRestorePointButton = document.getElementById('btn-settings-restore-point-create');
    const restorePointSelect = document.getElementById('settings-restore-point-select');
    const restorePointApplyButton = document.getElementById('btn-settings-restore-point-apply');

    if (!launcherButton || !googleDialog || !closeButton || !privacyModeInput || !enabledInput || !clientIdInput || !exportTargetSelect || !connectButton || !reconnectButton || !disconnectButton || !backupAutoInput || !backupFrequencySelect || !backupRetentionInput || !backupNowButton || !restoreImportButton || !createRestorePointButton || !restorePointSelect || !restorePointApplyButton) return;

    const restoreInput = document.createElement('input');
    restoreInput.type = 'file';
    restoreInput.accept = '.json,application/json';
    restoreInput.hidden = true;
    document.body.appendChild(restoreInput);

    privacyModeInput.addEventListener('change', () => {
        const enable = privacyModeInput.checked;
        updateSecurityConfig({ privacyModeEnabled: enable }, { action: enable ? 'Enabled Privacy Mode' : 'Disabled Privacy Mode' });
        if (enable) {
            const disconnected = disconnectGoogleWorkspace();
            updateGoogleWorkspaceConfig({
                status: disconnected.status,
                connectedAt: disconnected.connectedAt,
                expiresAt: disconnected.expiresAt,
                scopes: disconnected.scopes,
                accountEmail: disconnected.accountEmail,
                accountName: disconnected.accountName,
                lastError: ''
            }, { action: 'Privacy Mode disconnected Google Workspace' });
            setNetworkActivity('Privacy Mode Enabled', 'External integrations and automatic network activity are blocked.');
            recordSecurityAudit('Privacy Mode enabled', 'Cloud integrations disabled.');
        } else {
            setNetworkActivity('Offline', 'Privacy Mode disabled. No active external connections.');
            recordSecurityAudit('Privacy Mode disabled', 'Integrations may be reconnected by user action.');
        }
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus(enable ? 'Privacy Mode enabled.' : 'Privacy Mode disabled.');
    });

    launcherButton.addEventListener('click', () => {
        if (getSecurityConfig().privacyModeEnabled) {
            writeStatus('Privacy Mode is enabled. Disable it to manage external integrations.');
            return;
        }
        openSubDialog(googleDialog, enabledInput, launcherButton);
    });

    closeButton.addEventListener('click', () => {
        closeSubDialog(true);
    });

    enabledInput.addEventListener('change', () => {
        updateGoogleWorkspaceConfig({ enabled: enabledInput.checked }, { action: 'Updated Google Workspace integration state' });
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus(enabledInput.checked
            ? 'Google Workspace integration enabled.'
            : 'Google Workspace integration disabled.');
    });

    clientIdInput.addEventListener('blur', () => {
        const clientId = String(clientIdInput.value || '').trim();
        updateGoogleWorkspaceConfig({ clientId }, { action: 'Updated Google Workspace client ID' });
        renderGoogleWorkspaceSettings();
        renderAbout();
    });

    exportTargetSelect.addEventListener('change', () => {
        updateGoogleWorkspaceConfig({ defaultExportTarget: exportTargetSelect.value }, { action: 'Updated Google default export target' });
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus(`Google default export target set to ${exportTargetSelect.options[exportTargetSelect.selectedIndex]?.text || exportTargetSelect.value}.`);
    });

    connectButton.addEventListener('click', async () => {
        if (getSecurityConfig().privacyModeEnabled) {
            writeStatus('Privacy Mode is enabled. Connection is blocked.');
            return;
        }
        const current = getGoogleWorkspaceConfig();
        updateGoogleWorkspaceConfig({ status: 'connecting', lastError: '' }, { action: 'Connecting Google Workspace' });
        setNetworkActivity('Authorization Required', 'Google Workspace connection requires user authorization.');
        recordSecurityAudit('Google Workspace connect requested', 'User initiated connection flow.');
        renderGoogleWorkspaceSettings();

        const result = await connectGoogleWorkspace(current);
        if (!result.ok) {
            updateGoogleWorkspaceConfig({ status: 'error', lastError: result.lastError || 'Connection failed.' }, { action: 'Google Workspace connection failed' });
            setNetworkActivity('Connection Failed', result.lastError || 'Google Workspace connection failed.');
            recordSecurityAudit('Google Workspace connection failed', result.lastError || 'Unknown error');
            renderGoogleWorkspaceSettings();
            renderAbout();
            writeStatus(formatGoogleConnectionStatus(getGoogleWorkspaceConfig()));
            return;
        }

        updateGoogleWorkspaceConfig({
            status: 'connected',
            connectedAt: result.connectedAt,
            expiresAt: result.expiresAt,
            scopes: result.scopes || getRequiredGoogleWorkspaceScopes(),
            accountEmail: result.accountEmail || '',
            accountName: result.accountName || '',
            lastError: ''
        }, { action: 'Connected Google Workspace' });
        setNetworkActivity('Connected to Google Workspace', 'Google Workspace authorization is active.');
        recordSecurityAudit('Google Workspace connected', 'User authorized Google Workspace access.');
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus('Google Workspace connected.');
    });

    reconnectButton.addEventListener('click', async () => {
        if (getSecurityConfig().privacyModeEnabled) {
            writeStatus('Privacy Mode is enabled. Reconnect is blocked.');
            return;
        }
        const current = getGoogleWorkspaceConfig();
        updateGoogleWorkspaceConfig({ status: 'connecting', lastError: '' }, { action: 'Reconnecting Google Workspace' });
        setNetworkActivity('Authorization Required', 'Google Workspace reconnection requires user authorization.');
        recordSecurityAudit('Google Workspace reconnect requested', 'User initiated reconnect flow.');
        renderGoogleWorkspaceSettings();

        const result = await reconnectGoogleWorkspace(current);
        if (!result.ok) {
            updateGoogleWorkspaceConfig({ status: 'error', lastError: result.lastError || 'Reconnect failed.' }, { action: 'Google Workspace reconnect failed' });
            setNetworkActivity('Connection Failed', result.lastError || 'Google Workspace reconnect failed.');
            recordSecurityAudit('Google Workspace reconnect failed', result.lastError || 'Unknown error');
            renderGoogleWorkspaceSettings();
            renderAbout();
            writeStatus(formatGoogleConnectionStatus(getGoogleWorkspaceConfig()));
            return;
        }

        updateGoogleWorkspaceConfig({
            status: 'connected',
            connectedAt: result.connectedAt,
            expiresAt: result.expiresAt,
            scopes: result.scopes || getRequiredGoogleWorkspaceScopes(),
            accountEmail: result.accountEmail || '',
            accountName: result.accountName || '',
            lastError: ''
        }, { action: 'Reconnected Google Workspace' });
        setNetworkActivity('Connected to Google Workspace', 'Google Workspace authorization is active.');
        recordSecurityAudit('Google Workspace reconnected', 'User reauthorized Google Workspace access.');
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus('Google Workspace reconnected.');
    });

    disconnectButton.addEventListener('click', () => {
        const result = disconnectGoogleWorkspace();
        updateGoogleWorkspaceConfig({
            status: result.status,
            connectedAt: result.connectedAt,
            expiresAt: result.expiresAt,
            scopes: result.scopes,
            accountEmail: result.accountEmail,
            accountName: result.accountName,
            lastError: ''
        }, { action: 'Disconnected Google Workspace' });
        setNetworkActivity('Offline', 'Google Workspace disconnected.');
        recordSecurityAudit('Google Workspace disconnected', 'User disconnected Google Workspace.');
        renderGoogleWorkspaceSettings();
        renderAbout();
        writeStatus('Google Workspace disconnected.');
    });

    backupAutoInput.addEventListener('change', () => {
        updateSecurityConfig({
            backup: {
                ...getSecurityConfig().backup,
                autoEnabled: backupAutoInput.checked
            }
        }, { action: 'Updated backup automation setting' });
        renderGoogleWorkspaceSettings();
        writeStatus(backupAutoInput.checked ? 'Automatic backups enabled.' : 'Automatic backups disabled.');
    });

    backupFrequencySelect.addEventListener('change', () => {
        updateSecurityConfig({
            backup: {
                ...getSecurityConfig().backup,
                frequency: backupFrequencySelect.value
            }
        }, { action: 'Updated backup frequency' });
        renderGoogleWorkspaceSettings();
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
        renderGoogleWorkspaceSettings();
        writeStatus('Backup retention updated.');
    });

    backupNowButton.addEventListener('click', () => {
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
        renderGoogleWorkspaceSettings();
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
        renderGoogleWorkspaceSettings();
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
    const closeButton = document.getElementById('btn-settings-close');
    if (!dialog || !closeButton) return;

    lastTrigger = trigger || document.getElementById('btn-app-settings');
    refreshSettingsView();
    dialog.hidden = false;
    window.setTimeout(() => closeButton.focus(), 0);
}

function closeSettingsDialog(restoreFocus) {
    const dialog = document.getElementById('app-settings-dialog');
    if (!dialog) return;
    dialog.hidden = true;
    if (restoreFocus && lastTrigger) {
        lastTrigger.focus();
    }
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
            if (!result.ok) return;
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
        fileInput.value = '';
        fileInput.click();
    });

    pasteButton.addEventListener('click', () => {
        pasteInput.value = '';
        openSubDialog(pasteDialog, pasteInput, pasteButton);
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

    resetButton.addEventListener('click', () => {
        const defaultOption = resetDialog.querySelector('input[name="settings-reset-option"][value="preferences"]');
        if (defaultOption) defaultOption.checked = true;
        openSubDialog(resetDialog, defaultOption || resetConfirm, resetButton);
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

function bindStandardExport() {
    const exportButton = document.getElementById('btn-settings-export-standards');
    if (!exportButton) return;

    exportButton.addEventListener('click', exportImportedStandards);
}

export function initSettings() {
    if (isInitialized) return;

    const openButton = document.getElementById('btn-app-settings');
    const closeButton = document.getElementById('btn-settings-close');
    const restoreShortcutsButton = document.getElementById('btn-settings-shortcuts-reset');

    if (!openButton || !closeButton || !restoreShortcutsButton) return;

    openButton.addEventListener('click', () => openSettingsDialog(openButton));
    closeButton.addEventListener('click', () => closeSettingsDialog(true));

    restoreShortcutsButton.addEventListener('click', () => {
        resetShortcutsToDefault();
        refreshSettingsView();
        writeStatus('Default keyboard shortcuts restored.');
    });

    bindShortcutCapture();
    bindStandardImport();
    bindStandardExport();
    bindGoogleWorkspaceSettings();
    bindResetActions();

    document.addEventListener('keydown', trapSettingsFocus);
    document.addEventListener('focusin', trapSettingsFocus);

    window.addEventListener('art-shortcuts-updated', refreshSettingsView);
    window.addEventListener('art-accessibility-standards-updated', refreshSettingsView);
    window.addEventListener('art-google-workspace-updated', refreshSettingsView);
    window.addEventListener('art-security-updated', refreshSettingsView);

    isInitialized = true;
}
