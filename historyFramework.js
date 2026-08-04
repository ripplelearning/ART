import { commandExecutionService } from './commandExecutionService.js';

const STORAGE_KEY = 'art-history-framework-v1';
const FRAMEWORK_VERSION = '1.0.0';
const MAX_DEFAULT_HISTORY = 300;

const runtime = {
    initialized: false,
    historyEntries: [],
    undoStack: [],
    redoStack: [],
    transactions: {
        active: [],
        completed: []
    },
    versionsByResource: {},
    comparisonCache: {},
    diagnostics: [],
    retention: {
        historyMode: 'application-lifetime',
        maxHistoryEntries: MAX_DEFAULT_HISTORY,
        versionMode: 'keep-all',
        maxVersionsPerResource: 50,
        clearOnExit: false,
        preserveBetweenSessions: true
    },
    adapters: {
        getSnapshot: () => '',
        applySnapshot: () => false,
        normalizeSnapshot: (snapshot) => snapshot,
        onStateRestored: null,
        inferResource: null,
        captureResourceByType: null,
        restoreResourceByType: null
    },
    ui: {
        previousTitle: '',
        activeDialogId: ''
    }
};

function nowIso() {
    return new Date().toISOString();
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function safeJsonParse(text, fallback = null) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return fallback;
    }
}

function cloneDeep(value) {
    return safeJsonParse(JSON.stringify(value), null);
}

function emitHistoryEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('art-history-framework-event', {
        detail: {
            type,
            at: nowIso(),
            ...detail
        }
    }));
}

function recordDiagnostic(level, message, detail = {}) {
    const item = {
        id: createId('history-diag'),
        at: nowIso(),
        level: normalizeText(level).toLowerCase() || 'info',
        message: normalizeText(message) || 'History framework diagnostic.',
        detail: detail && typeof detail === 'object' ? detail : {}
    };
    runtime.diagnostics.push(item);
    if (runtime.diagnostics.length > 500) {
        runtime.diagnostics = runtime.diagnostics.slice(-500);
    }
    return item;
}

function normalizeResourceRef(resource = {}) {
    const source = resource && typeof resource === 'object' ? resource : {};
    return {
        resourceType: normalizeText(source.resourceType || source.type || 'application').toLowerCase() || 'application',
        resourceId: normalizeText(source.resourceId || source.id || 'state') || 'state',
        resourceName: normalizeText(source.resourceName || source.name),
        workspaceId: normalizeText(source.workspaceId || source.workspace)
    };
}

function getResourceKey(resource) {
    const ref = normalizeResourceRef(resource);
    return `${ref.workspaceId || 'global'}:${ref.resourceType}:${ref.resourceId}`;
}

function normalizeHistoryEntry(source = {}, index = 0) {
    const item = source && typeof source === 'object' ? source : {};
    return {
        id: normalizeText(item.id) || `history-entry-${Date.now()}-${index}`,
        timestamp: normalizeText(item.timestamp) || nowIso(),
        operationType: normalizeText(item.operationType || 'edit') || 'edit',
        resourceType: normalizeText(item.resourceType || 'application') || 'application',
        resourceId: normalizeText(item.resourceId || 'state') || 'state',
        resourceName: normalizeText(item.resourceName),
        description: normalizeText(item.description || 'Updated state') || 'Updated state',
        undoAvailable: item.undoAvailable !== false,
        redoAvailable: Boolean(item.redoAvailable),
        transactionId: normalizeText(item.transactionId),
        pluginSource: normalizeText(item.pluginSource),
        informational: Boolean(item.informational),
        metadata: item.metadata && typeof item.metadata === 'object' ? cloneDeep(item.metadata) : {}
    };
}

function normalizeVersionEntry(resource, source = {}, index = 0) {
    const ref = normalizeResourceRef(resource);
    const item = source && typeof source === 'object' ? source : {};
    return {
        versionId: normalizeText(item.versionId) || `version-${Date.now()}-${index}`,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        resourceName: normalizeText(item.resourceName || ref.resourceName),
        versionNumber: Number(item.versionNumber || 0),
        timestamp: normalizeText(item.timestamp) || nowIso(),
        operationType: normalizeText(item.operationType || 'edit') || 'edit',
        description: normalizeText(item.description || 'Updated resource') || 'Updated resource',
        pluginSource: normalizeText(item.pluginSource),
        transactionId: normalizeText(item.transactionId),
        snapshot: typeof item.snapshot === 'string' ? item.snapshot : JSON.stringify(item.snapshot || {}),
        metadata: item.metadata && typeof item.metadata === 'object' ? cloneDeep(item.metadata) : {}
    };
}

function normalizeUndoRedoItem(item = {}) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        id: normalizeText(source.id) || createId('history-tx'),
        description: normalizeText(source.description) || 'Updated state',
        beforeSnapshot: typeof source.beforeSnapshot === 'string' ? source.beforeSnapshot : '',
        afterSnapshot: typeof source.afterSnapshot === 'string' ? source.afterSnapshot : '',
        transactionId: normalizeText(source.transactionId),
        resource: normalizeResourceRef(source.resource || {}),
        pluginSource: normalizeText(source.pluginSource),
        operationType: normalizeText(source.operationType || 'edit') || 'edit',
        timestamp: normalizeText(source.timestamp) || nowIso()
    };
}

function normalizeRetention(source = {}) {
    const input = source && typeof source === 'object' ? source : {};
    const maxHistoryEntries = Number(input.maxHistoryEntries || MAX_DEFAULT_HISTORY);
    const maxVersionsPerResource = Number(input.maxVersionsPerResource || 50);
    return {
        historyMode: normalizeText(input.historyMode || 'application-lifetime') || 'application-lifetime',
        maxHistoryEntries: Number.isFinite(maxHistoryEntries) && maxHistoryEntries > 0 ? Math.round(maxHistoryEntries) : MAX_DEFAULT_HISTORY,
        versionMode: normalizeText(input.versionMode || 'keep-all') || 'keep-all',
        maxVersionsPerResource: Number.isFinite(maxVersionsPerResource) && maxVersionsPerResource > 0 ? Math.round(maxVersionsPerResource) : 50,
        clearOnExit: Boolean(input.clearOnExit),
        preserveBetweenSessions: input.preserveBetweenSessions !== false
    };
}

function getActiveTransaction() {
    if (!runtime.transactions.active.length) return null;
    return runtime.transactions.active[runtime.transactions.active.length - 1] || null;
}

function pruneRetention() {
    const maxHistoryEntries = runtime.retention.maxHistoryEntries;
    if (runtime.historyEntries.length > maxHistoryEntries) {
        runtime.historyEntries = runtime.historyEntries.slice(-maxHistoryEntries);
    }

    const maxVersions = runtime.retention.maxVersionsPerResource;
    Object.keys(runtime.versionsByResource).forEach((key) => {
        const list = normalizeArray(runtime.versionsByResource[key]);
        if (list.length > maxVersions) {
            runtime.versionsByResource[key] = list.slice(-maxVersions);
        }
    });
}

function persistRuntime() {
    if (!runtime.retention.preserveBetweenSessions) return;
    const payload = {
        frameworkVersion: FRAMEWORK_VERSION,
        historyEntries: runtime.historyEntries,
        undoStack: runtime.undoStack,
        redoStack: runtime.redoStack,
        transactions: {
            completed: runtime.transactions.completed
        },
        versionsByResource: runtime.versionsByResource,
        retention: runtime.retention,
        diagnostics: runtime.diagnostics.slice(-200)
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        recordDiagnostic('warning', 'History framework state could not be persisted.', {
            reason: String(error?.message || error)
        });
    }
}

function loadPersistedRuntime() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = safeJsonParse(raw, null);
        if (!parsed || typeof parsed !== 'object') return;

        runtime.historyEntries = normalizeArray(parsed.historyEntries).map((entry, index) => normalizeHistoryEntry(entry, index));
        runtime.undoStack = normalizeArray(parsed.undoStack).map((entry) => normalizeUndoRedoItem(entry));
        runtime.redoStack = normalizeArray(parsed.redoStack).map((entry) => normalizeUndoRedoItem(entry));
        runtime.transactions.completed = normalizeArray(parsed?.transactions?.completed).map((entry) => ({
            id: normalizeText(entry?.id) || createId('history-transaction'),
            description: normalizeText(entry?.description) || 'Transaction',
            startedAt: normalizeText(entry?.startedAt) || nowIso(),
            completedAt: normalizeText(entry?.completedAt) || nowIso(),
            status: normalizeText(entry?.status || 'committed') || 'committed',
            itemCount: Number(entry?.itemCount || 0)
        })).slice(-300);

        const versions = parsed.versionsByResource && typeof parsed.versionsByResource === 'object' ? parsed.versionsByResource : {};
        runtime.versionsByResource = {};
        Object.entries(versions).forEach(([key, value]) => {
            runtime.versionsByResource[key] = normalizeArray(value).map((item, index) => normalizeVersionEntry({ resourceType: 'application', resourceId: key }, item, index));
        });

        runtime.retention = normalizeRetention(parsed.retention);
        runtime.diagnostics = normalizeArray(parsed.diagnostics).map((entry) => ({
            id: normalizeText(entry?.id) || createId('history-diag'),
            at: normalizeText(entry?.at) || nowIso(),
            level: normalizeText(entry?.level || 'info') || 'info',
            message: normalizeText(entry?.message || 'History framework diagnostic.'),
            detail: entry?.detail && typeof entry.detail === 'object' ? cloneDeep(entry.detail) : {}
        })).slice(-200);

        pruneRetention();
    } catch (error) {
        runtime.historyEntries = [];
        runtime.undoStack = [];
        runtime.redoStack = [];
        runtime.versionsByResource = {};
        runtime.transactions.completed = [];
        runtime.diagnostics = [];
        recordDiagnostic('warning', 'History framework state could not be restored.', {
            reason: String(error?.message || error)
        });
    }
}

function withDocumentTitle(suffix = '') {
    if (!runtime.ui.previousTitle) {
        runtime.ui.previousTitle = String(document.title || 'ART').trim() || 'ART';
    }
    const base = runtime.ui.previousTitle;
    document.title = suffix ? `${base} | ${suffix}` : base;
}

function restoreDocumentTitle() {
    if (runtime.ui.previousTitle) {
        document.title = runtime.ui.previousTitle;
    }
    runtime.ui.previousTitle = '';
}

function ensureHistoryDialogs() {
    if (document.getElementById('art-history-dialog')) return;

    const historyDialog = document.createElement('section');
    historyDialog.id = 'art-history-dialog';
    historyDialog.className = 'workspace-dialog';
    historyDialog.hidden = true;
    historyDialog.setAttribute('role', 'dialog');
    historyDialog.setAttribute('aria-modal', 'true');
    historyDialog.setAttribute('aria-labelledby', 'art-history-dialog-heading');
    historyDialog.innerHTML = `
        <div class="workspace-dialog__surface">
            <header class="workspace-dialog__header">
                <h3 id="art-history-dialog-heading">History</h3>
                <button id="btn-art-history-close" type="button">Close</button>
            </header>
            <div id="art-history-content" class="workspace-dialog__content"></div>
            <div class="workspace-dialog__actions" role="group" aria-label="History actions">
                <button id="btn-art-history-clear" type="button">Clear History</button>
            </div>
        </div>
    `;
    document.body.appendChild(historyDialog);

    const versionDialog = document.createElement('section');
    versionDialog.id = 'art-version-history-dialog';
    versionDialog.className = 'workspace-dialog';
    versionDialog.hidden = true;
    versionDialog.setAttribute('role', 'dialog');
    versionDialog.setAttribute('aria-modal', 'true');
    versionDialog.setAttribute('aria-labelledby', 'art-version-history-dialog-heading');
    versionDialog.innerHTML = `
        <div class="workspace-dialog__surface">
            <header class="workspace-dialog__header">
                <h3 id="art-version-history-dialog-heading">Version History</h3>
                <button id="btn-art-version-history-close" type="button">Close</button>
            </header>
            <div id="art-version-history-content" class="workspace-dialog__content"></div>
        </div>
    `;
    document.body.appendChild(versionDialog);

    const compareDialog = document.createElement('section');
    compareDialog.id = 'art-compare-versions-dialog';
    compareDialog.className = 'workspace-dialog';
    compareDialog.hidden = true;
    compareDialog.setAttribute('role', 'dialog');
    compareDialog.setAttribute('aria-modal', 'true');
    compareDialog.setAttribute('aria-labelledby', 'art-compare-versions-heading');
    compareDialog.innerHTML = `
        <div class="workspace-dialog__surface">
            <header class="workspace-dialog__header">
                <h3 id="art-compare-versions-heading">Compare Versions</h3>
                <button id="btn-art-compare-close" type="button">Close</button>
            </header>
            <div id="art-compare-content" class="workspace-dialog__content"></div>
            <div class="workspace-dialog__actions" role="group" aria-label="Compare actions">
                <button id="btn-art-compare-prev" type="button">Previous Difference</button>
                <button id="btn-art-compare-next" type="button">Next Difference</button>
                <button id="btn-art-compare-export" type="button">Export Comparison</button>
            </div>
        </div>
    `;
    document.body.appendChild(compareDialog);
}

function openDialog(dialog, initialFocus = null, titleSuffix = '') {
    if (!(dialog instanceof HTMLElement)) return false;
    ensureHistoryDialogs();
    runtime.ui.activeDialogId = dialog.id;
    dialog.hidden = false;
    withDocumentTitle(titleSuffix);
    window.setTimeout(() => {
        if (initialFocus && typeof initialFocus.focus === 'function') {
            initialFocus.focus();
            return;
        }
        const focusTarget = dialog.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusTarget instanceof HTMLElement) focusTarget.focus();
    }, 0);
    return true;
}

function closeDialog(dialog, restoreFocus = null) {
    if (!(dialog instanceof HTMLElement)) return false;
    dialog.hidden = true;
    runtime.ui.activeDialogId = '';
    restoreDocumentTitle();
    if (restoreFocus && typeof restoreFocus.focus === 'function') {
        window.setTimeout(() => restoreFocus.focus(), 0);
    }
    return true;
}

function parseSnapshot(snapshot) {
    if (typeof snapshot !== 'string') return snapshot;
    return safeJsonParse(snapshot, {});
}

function flattenObject(value, path = []) {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
        return [{ path: path.join('.'), value }];
    }

    return Object.entries(value).flatMap(([key, next]) => flattenObject(next, [...path, key]));
}

function summarizeOperationCategory(operationType = '') {
    const normalized = normalizeText(operationType).toLowerCase();
    if (!normalized) return 'Modified';
    if (normalized.includes('create') || normalized.includes('import') || normalized.includes('add')) return 'Added';
    if (normalized.includes('delete') || normalized.includes('remove')) return 'Removed';
    if (normalized.includes('rename')) return 'Renamed';
    if (normalized.includes('restore')) return 'Restored';
    if (normalized.includes('move') || normalized.includes('reorder')) return 'Moved';
    return 'Modified';
}

function inferOperationType(description = '') {
    const text = normalizeText(description).toLowerCase();
    if (!text) return 'edit';
    if (text.includes('create') || text.includes('new ')) return 'create';
    if (text.includes('rename')) return 'rename';
    if (text.includes('delete') || text.includes('removed')) return 'delete';
    if (text.includes('restore')) return 'restore';
    if (text.includes('import')) return 'import';
    if (text.includes('export')) return 'export';
    if (text.includes('move') || text.includes('reorder')) return 'move';
    return 'edit';
}

function inferResourceFromDescription(description = '') {
    const lower = normalizeText(description).toLowerCase();
    if (!lower) {
        return {
            resourceType: 'application',
            resourceId: 'state',
            resourceName: 'Application State'
        };
    }

    if (lower.includes('workspace')) {
        return { resourceType: 'workspace', resourceId: 'active-workspace', resourceName: 'Project Workspace' };
    }
    if (lower.includes('report')) {
        return { resourceType: 'report', resourceId: 'active-report', resourceName: 'Report' };
    }
    if (lower.includes('template')) {
        return { resourceType: 'template', resourceId: 'active-template', resourceName: 'Template' };
    }
    if (lower.includes('asset')) {
        return { resourceType: 'asset', resourceId: 'active-asset', resourceName: 'Project Asset' };
    }
    if (lower.includes('tag')) {
        return { resourceType: 'tag', resourceId: 'active-tag', resourceName: 'Tag' };
    }
    if (lower.includes('collection')) {
        return { resourceType: 'collection', resourceId: 'active-collection', resourceName: 'Collection' };
    }
    if (lower.includes('saved view') || lower.includes('working view')) {
        return { resourceType: 'saved-view', resourceId: 'active-saved-view', resourceName: 'Saved View' };
    }
    if (lower.includes('plugin')) {
        return { resourceType: 'plugin', resourceId: 'active-plugin', resourceName: 'Plugin' };
    }
    if (lower.includes('package')) {
        return { resourceType: 'package', resourceId: 'active-package', resourceName: 'Package' };
    }

    return {
        resourceType: 'application',
        resourceId: 'state',
        resourceName: 'Application State'
    };
}

function buildHistoryEntryFromTransaction(item, options = {}) {
    const tx = normalizeUndoRedoItem(item);
    const resource = normalizeResourceRef(options.resource || tx.resource || {});
    return normalizeHistoryEntry({
        id: createId('history-entry'),
        timestamp: nowIso(),
        operationType: tx.operationType,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        resourceName: resource.resourceName,
        description: tx.description,
        undoAvailable: true,
        redoAvailable: runtime.redoStack.length > 0,
        transactionId: tx.transactionId || tx.id,
        pluginSource: tx.pluginSource,
        informational: false,
        metadata: {
            category: summarizeOperationCategory(tx.operationType)
        }
    });
}

function createVersionEntry(resource, payload = {}) {
    const ref = normalizeResourceRef(resource);
    const key = getResourceKey(ref);
    const existing = normalizeArray(runtime.versionsByResource[key]);
    const nextVersionNumber = existing.length + 1;
    const entry = normalizeVersionEntry(ref, {
        versionId: createId('version'),
        resourceName: ref.resourceName,
        versionNumber: nextVersionNumber,
        timestamp: nowIso(),
        operationType: normalizeText(payload.operationType || 'edit') || 'edit',
        description: normalizeText(payload.description || 'Updated resource') || 'Updated resource',
        pluginSource: normalizeText(payload.pluginSource),
        transactionId: normalizeText(payload.transactionId),
        snapshot: typeof payload.snapshot === 'string' ? payload.snapshot : JSON.stringify(payload.snapshot || {}),
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    });

    runtime.versionsByResource[key] = [...existing, entry];
    pruneRetention();

    emitHistoryEvent('Version Created', {
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        versionId: entry.versionId,
        versionNumber: entry.versionNumber,
        description: entry.description
    });

    return entry;
}

function collectVersionList(resource = {}) {
    const ref = normalizeResourceRef(resource);
    const key = getResourceKey(ref);
    return normalizeArray(runtime.versionsByResource[key]).sort((a, b) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0));
}

function getResourcePayloadForVersion(ref) {
    const customCapture = runtime.adapters.captureResourceByType;
    if (typeof customCapture === 'function') {
        const captured = customCapture(ref);
        if (captured !== undefined) return captured;
    }

    if (ref.resourceType === 'application') {
        return parseSnapshot(runtime.adapters.getSnapshot?.() || '{}');
    }

    return {
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        resourceName: ref.resourceName,
        capturedAt: nowIso()
    };
}

function storeOperation(item, options = {}) {
    const tx = normalizeUndoRedoItem(item);

    runtime.undoStack.push(tx);
    runtime.redoStack = [];

    const entry = buildHistoryEntryFromTransaction(tx, {
        resource: options.resource || tx.resource
    });
    runtime.historyEntries.push(entry);

    const resource = normalizeResourceRef(options.resource || tx.resource || inferResourceFromDescription(tx.description));
    const versionPayload = getResourcePayloadForVersion(resource);
    createVersionEntry(resource, {
        operationType: tx.operationType,
        description: tx.description,
        pluginSource: tx.pluginSource,
        transactionId: tx.transactionId || tx.id,
        snapshot: versionPayload,
        metadata: {
            undoable: true
        }
    });

    pruneRetention();
    persistRuntime();

    emitHistoryEvent('History Entry Recorded', {
        entryId: entry.id,
        description: entry.description,
        undoCount: runtime.undoStack.length,
        redoCount: runtime.redoStack.length
    });

    return entry;
}

export function configureHistoryFrameworkStateAdapter(adapter = {}) {
    const source = adapter && typeof adapter === 'object' ? adapter : {};

    if (typeof source.getSnapshot === 'function') runtime.adapters.getSnapshot = source.getSnapshot;
    if (typeof source.applySnapshot === 'function') runtime.adapters.applySnapshot = source.applySnapshot;
    if (typeof source.normalizeSnapshot === 'function') runtime.adapters.normalizeSnapshot = source.normalizeSnapshot;
    if (typeof source.onStateRestored === 'function') runtime.adapters.onStateRestored = source.onStateRestored;
    if (typeof source.inferResource === 'function') runtime.adapters.inferResource = source.inferResource;
    if (typeof source.captureResourceByType === 'function') runtime.adapters.captureResourceByType = source.captureResourceByType;
    if (typeof source.restoreResourceByType === 'function') runtime.adapters.restoreResourceByType = source.restoreResourceByType;

    return true;
}

export function initializeHistoryFramework() {
    if (runtime.initialized) return true;
    loadPersistedRuntime();
    ensureHistoryDialogs();

    window.addEventListener('beforeunload', () => {
        if (runtime.retention.clearOnExit) {
            clearHistory({ includeStacks: true, includeVersions: false, announceResult: false });
            return;
        }
        persistRuntime();
    });

    runtime.initialized = true;
    emitHistoryEvent('History Framework Ready', {
        frameworkVersion: FRAMEWORK_VERSION,
        historyEntryCount: runtime.historyEntries.length,
        undoCount: runtime.undoStack.length,
        redoCount: runtime.redoStack.length
    });
    return true;
}

export function beginTransaction(input = {}) {
    initializeHistoryFramework();
    const description = normalizeText(input.description || 'Transaction') || 'Transaction';
    const transaction = {
        id: createId('history-transaction'),
        description,
        startedAt: nowIso(),
        pluginSource: normalizeText(input.pluginSource),
        operationType: normalizeText(input.operationType || 'edit') || 'edit',
        resource: normalizeResourceRef(input.resource || inferResourceFromDescription(description)),
        beforeSnapshot: '',
        afterSnapshot: '',
        itemCount: 0
    };

    runtime.transactions.active.push(transaction);
    emitHistoryEvent('Transaction Started', {
        transactionId: transaction.id,
        description: transaction.description
    });
    return transaction;
}

export function recordStateChange(input = {}) {
    initializeHistoryFramework();
    const description = normalizeText(input.description || 'Updated state') || 'Updated state';
    const beforeSnapshot = typeof input.beforeSnapshot === 'string' ? input.beforeSnapshot : runtime.adapters.getSnapshot?.() || '';
    const afterSnapshot = typeof input.afterSnapshot === 'string' ? input.afterSnapshot : runtime.adapters.getSnapshot?.() || '';

    if (!beforeSnapshot || !afterSnapshot || beforeSnapshot === afterSnapshot) {
        return { ok: false, reason: 'no-change' };
    }

    const normalizedBefore = runtime.adapters.normalizeSnapshot(beforeSnapshot);
    const normalizedAfter = runtime.adapters.normalizeSnapshot(afterSnapshot);
    if (normalizedBefore === normalizedAfter) {
        return { ok: false, reason: 'no-change' };
    }

    const operationType = normalizeText(input.operationType || inferOperationType(description)) || 'edit';
    const inferred = runtime.adapters.inferResource ? runtime.adapters.inferResource(input, description) : null;
    const resource = normalizeResourceRef(input.resource || inferred || inferResourceFromDescription(description));

    const transaction = getActiveTransaction();
    if (transaction) {
        if (!transaction.beforeSnapshot) transaction.beforeSnapshot = normalizedBefore;
        transaction.afterSnapshot = normalizedAfter;
        transaction.itemCount += 1;
        return { ok: true, grouped: true, transactionId: transaction.id };
    }

    const txItem = normalizeUndoRedoItem({
        id: createId('history-op'),
        description,
        beforeSnapshot: normalizedBefore,
        afterSnapshot: normalizedAfter,
        resource,
        pluginSource: normalizeText(input.pluginSource),
        operationType,
        transactionId: normalizeText(input.transactionId)
    });

    storeOperation(txItem, { resource });
    return { ok: true, grouped: false, transactionId: txItem.transactionId || txItem.id };
}

export function commitTransaction(transactionId = '', options = {}) {
    initializeHistoryFramework();
    const id = normalizeText(transactionId);
    const active = getActiveTransaction();
    if (!active) return { ok: false, reason: 'no-active-transaction' };
    if (id && active.id !== id) return { ok: false, reason: 'transaction-mismatch' };

    runtime.transactions.active.pop();

    if (!active.beforeSnapshot || !active.afterSnapshot || active.beforeSnapshot === active.afterSnapshot) {
        runtime.transactions.completed.push({
            id: active.id,
            description: active.description,
            startedAt: active.startedAt,
            completedAt: nowIso(),
            status: 'no-op',
            itemCount: active.itemCount
        });
        persistRuntime();
        emitHistoryEvent('Transaction Committed', {
            transactionId: active.id,
            description: active.description,
            grouped: true,
            itemCount: active.itemCount,
            skipped: true
        });
        return { ok: true, skipped: true };
    }

    const txItem = normalizeUndoRedoItem({
        id: active.id,
        description: normalizeText(options.description || active.description) || active.description,
        beforeSnapshot: active.beforeSnapshot,
        afterSnapshot: active.afterSnapshot,
        resource: active.resource,
        operationType: normalizeText(options.operationType || active.operationType) || active.operationType,
        pluginSource: normalizeText(options.pluginSource || active.pluginSource),
        transactionId: active.id
    });

    storeOperation(txItem, { resource: txItem.resource });

    runtime.transactions.completed.push({
        id: active.id,
        description: txItem.description,
        startedAt: active.startedAt,
        completedAt: nowIso(),
        status: 'committed',
        itemCount: Math.max(1, active.itemCount)
    });
    if (runtime.transactions.completed.length > 300) {
        runtime.transactions.completed = runtime.transactions.completed.slice(-300);
    }

    persistRuntime();
    emitHistoryEvent('Transaction Committed', {
        transactionId: active.id,
        description: txItem.description,
        grouped: true,
        itemCount: Math.max(1, active.itemCount)
    });
    return { ok: true };
}

export function rollbackTransaction(transactionId = '', options = {}) {
    initializeHistoryFramework();
    const id = normalizeText(transactionId);
    const active = getActiveTransaction();
    if (!active) return { ok: false, reason: 'no-active-transaction' };
    if (id && active.id !== id) return { ok: false, reason: 'transaction-mismatch' };

    runtime.transactions.active.pop();
    let recovered = true;
    let errorMessage = '';

    if (active.beforeSnapshot) {
        try {
            recovered = runtime.adapters.applySnapshot(active.beforeSnapshot) !== false;
        } catch (error) {
            recovered = false;
            errorMessage = String(error?.message || error);
            recordDiagnostic('error', 'Transaction rollback failed.', {
                transactionId: active.id,
                reason: errorMessage
            });
        }
    }

    runtime.transactions.completed.push({
        id: active.id,
        description: active.description,
        startedAt: active.startedAt,
        completedAt: nowIso(),
        status: recovered ? 'rolled-back' : 'rollback-failed',
        itemCount: active.itemCount
    });

    const entry = normalizeHistoryEntry({
        id: createId('history-entry'),
        timestamp: nowIso(),
        operationType: 'rollback',
        resourceType: active.resource.resourceType,
        resourceId: active.resource.resourceId,
        resourceName: active.resource.resourceName,
        description: recovered
            ? `Recovered transaction: ${active.description}`
            : `Recovery failed for transaction: ${active.description}`,
        undoAvailable: false,
        redoAvailable: false,
        transactionId: active.id,
        informational: true,
        metadata: {
            failure: !recovered,
            errorMessage
        }
    });
    runtime.historyEntries.push(entry);
    pruneRetention();
    persistRuntime();

    emitHistoryEvent('Transaction Rolled Back', {
        transactionId: active.id,
        recovered,
        reason: errorMessage
    });

    return {
        ok: recovered,
        recovered,
        reason: errorMessage || (recovered ? 'ok' : 'rollback-failed')
    };
}

export function executeTransaction(input = {}, callback) {
    const tx = beginTransaction(input);
    try {
        const result = typeof callback === 'function' ? callback(tx) : true;
        if (result && typeof result.then === 'function') {
            return result
                .then((resolved) => {
                    const committed = commitTransaction(tx.id, {
                        description: normalizeText(input.description || tx.description) || tx.description,
                        operationType: normalizeText(input.operationType || tx.operationType) || tx.operationType,
                        pluginSource: normalizeText(input.pluginSource || tx.pluginSource)
                    });
                    if (!committed.ok) {
                        throw new Error('Transaction commit failed.');
                    }
                    return resolved;
                })
                .catch((error) => {
                    rollbackTransaction(tx.id);
                    throw error;
                });
        }

        const committed = commitTransaction(tx.id, {
            description: normalizeText(input.description || tx.description) || tx.description,
            operationType: normalizeText(input.operationType || tx.operationType) || tx.operationType,
            pluginSource: normalizeText(input.pluginSource || tx.pluginSource)
        });
        if (!committed.ok) {
            rollbackTransaction(tx.id);
            return { ok: false, reason: 'transaction-commit-failed' };
        }
        return { ok: true, value: result };
    } catch (error) {
        rollbackTransaction(tx.id);
        return {
            ok: false,
            reason: String(error?.message || error)
        };
    }
}

export function canUndo() {
    initializeHistoryFramework();
    return runtime.undoStack.length > 0;
}

export function canRedo() {
    initializeHistoryFramework();
    return runtime.redoStack.length > 0;
}

export function getUndoDescription() {
    initializeHistoryFramework();
    const item = runtime.undoStack[runtime.undoStack.length - 1] || null;
    return item ? normalizeText(item.description) : '';
}

export function getRedoDescription() {
    initializeHistoryFramework();
    const item = runtime.redoStack[runtime.redoStack.length - 1] || null;
    return item ? normalizeText(item.description) : '';
}

export function requestUndo(options = {}) {
    initializeHistoryFramework();
    if (!runtime.undoStack.length) return { ok: false, reason: 'empty-undo-stack' };

    const currentSnapshot = runtime.adapters.getSnapshot?.() || '';
    const item = runtime.undoStack.pop();

    let ok = true;
    try {
        ok = runtime.adapters.applySnapshot(item.beforeSnapshot) !== false;
    } catch (error) {
        ok = false;
        recordDiagnostic('error', 'Undo failed.', {
            transactionId: item.transactionId || item.id,
            reason: String(error?.message || error)
        });
    }

    if (!ok) {
        runtime.undoStack.push(item);
        persistRuntime();
        emitHistoryEvent('Undo Failed', {
            description: item.description
        });
        return { ok: false, reason: 'apply-snapshot-failed' };
    }

    runtime.redoStack.push(normalizeUndoRedoItem({
        ...item,
        beforeSnapshot: item.beforeSnapshot,
        afterSnapshot: currentSnapshot
    }));

    const entry = normalizeHistoryEntry({
        id: createId('history-entry'),
        timestamp: nowIso(),
        operationType: 'undo',
        resourceType: item.resource.resourceType,
        resourceId: item.resource.resourceId,
        resourceName: item.resource.resourceName,
        description: `Undo ${item.description}`,
        undoAvailable: runtime.undoStack.length > 0,
        redoAvailable: runtime.redoStack.length > 0,
        transactionId: item.transactionId || item.id,
        informational: false,
        metadata: {
            originalOperation: item.operationType
        }
    });

    runtime.historyEntries.push(entry);
    pruneRetention();
    persistRuntime();

    if (typeof runtime.adapters.onStateRestored === 'function') {
        runtime.adapters.onStateRestored({ reason: 'undo', description: item.description, options });
    }

    emitHistoryEvent('Undo Completed', {
        description: item.description,
        undoCount: runtime.undoStack.length,
        redoCount: runtime.redoStack.length
    });

    return { ok: true, description: item.description };
}

export function requestRedo(options = {}) {
    initializeHistoryFramework();
    if (!runtime.redoStack.length) return { ok: false, reason: 'empty-redo-stack' };

    const currentSnapshot = runtime.adapters.getSnapshot?.() || '';
    const item = runtime.redoStack.pop();

    let ok = true;
    try {
        ok = runtime.adapters.applySnapshot(item.afterSnapshot) !== false;
    } catch (error) {
        ok = false;
        recordDiagnostic('error', 'Redo failed.', {
            transactionId: item.transactionId || item.id,
            reason: String(error?.message || error)
        });
    }

    if (!ok) {
        runtime.redoStack.push(item);
        persistRuntime();
        emitHistoryEvent('Redo Failed', {
            description: item.description
        });
        return { ok: false, reason: 'apply-snapshot-failed' };
    }

    runtime.undoStack.push(normalizeUndoRedoItem({
        ...item,
        beforeSnapshot: currentSnapshot,
        afterSnapshot: item.afterSnapshot
    }));

    const entry = normalizeHistoryEntry({
        id: createId('history-entry'),
        timestamp: nowIso(),
        operationType: 'redo',
        resourceType: item.resource.resourceType,
        resourceId: item.resource.resourceId,
        resourceName: item.resource.resourceName,
        description: `Redo ${item.description}`,
        undoAvailable: runtime.undoStack.length > 0,
        redoAvailable: runtime.redoStack.length > 0,
        transactionId: item.transactionId || item.id,
        informational: false,
        metadata: {
            originalOperation: item.operationType
        }
    });

    runtime.historyEntries.push(entry);
    pruneRetention();
    persistRuntime();

    if (typeof runtime.adapters.onStateRestored === 'function') {
        runtime.adapters.onStateRestored({ reason: 'redo', description: item.description, options });
    }

    emitHistoryEvent('Redo Completed', {
        description: item.description,
        undoCount: runtime.undoStack.length,
        redoCount: runtime.redoStack.length
    });

    return { ok: true, description: item.description };
}

export function clearHistory(options = {}) {
    initializeHistoryFramework();
    const includeStacks = options.includeStacks !== false;
    const includeVersions = options.includeVersions === true;

    runtime.historyEntries = [];
    if (includeStacks) {
        runtime.undoStack = [];
        runtime.redoStack = [];
    }
    if (includeVersions) {
        runtime.versionsByResource = {};
    }

    persistRuntime();
    emitHistoryEvent('History Cleared', {
        includeStacks,
        includeVersions
    });

    return { ok: true };
}

export function queryHistory(query = {}) {
    initializeHistoryFramework();
    const input = query && typeof query === 'object' ? query : {};
    const text = normalizeText(input.search || '').toLowerCase();
    const resourceType = normalizeText(input.resourceType || '').toLowerCase();
    const operationType = normalizeText(input.operationType || '').toLowerCase();
    const limit = Number(input.limit || 200);

    const filtered = runtime.historyEntries
        .filter((entry) => {
            if (resourceType && normalizeText(entry.resourceType).toLowerCase() !== resourceType) return false;
            if (operationType && normalizeText(entry.operationType).toLowerCase() !== operationType) return false;
            if (text) {
                const haystack = `${entry.description} ${entry.resourceName} ${entry.resourceType}`.toLowerCase();
                if (!haystack.includes(text)) return false;
            }
            return true;
        })
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, Number.isFinite(limit) && limit > 0 ? Math.round(limit) : 200);

    return filtered;
}

export function createResourceVersion(resource = {}, payload = {}) {
    initializeHistoryFramework();
    const ref = normalizeResourceRef(resource);
    const snapshot = payload.snapshot !== undefined
        ? payload.snapshot
        : getResourcePayloadForVersion(ref);

    const entry = createVersionEntry(ref, {
        operationType: normalizeText(payload.operationType || 'edit') || 'edit',
        description: normalizeText(payload.description || 'Updated resource') || 'Updated resource',
        pluginSource: normalizeText(payload.pluginSource),
        transactionId: normalizeText(payload.transactionId),
        snapshot: typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot || {}),
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    });

    persistRuntime();
    return { ok: true, version: entry };
}

export function getResourceVersionHistory(resource = {}, options = {}) {
    initializeHistoryFramework();
    const versions = collectVersionList(resource);
    const limit = Number(options.limit || 200);
    return versions.slice(0, Number.isFinite(limit) && limit > 0 ? Math.round(limit) : 200);
}

export function restoreResourceVersion(resource = {}, versionId = '', options = {}) {
    initializeHistoryFramework();
    const ref = normalizeResourceRef(resource);
    const versions = collectVersionList(ref);
    const targetId = normalizeText(versionId);
    const target = versions.find((item) => item.versionId === targetId || String(item.versionNumber) === targetId) || null;
    if (!target) return { ok: false, reason: 'version-not-found' };

    const payload = parseSnapshot(target.snapshot);
    let restored = false;

    if (ref.resourceType === 'application') {
        restored = runtime.adapters.applySnapshot(target.snapshot) !== false;
    } else if (typeof runtime.adapters.restoreResourceByType === 'function') {
        restored = runtime.adapters.restoreResourceByType(ref, payload, target, options) !== false;
    }

    if (!restored) {
        recordDiagnostic('warning', 'Version restore was not supported for resource.', {
            resourceType: ref.resourceType,
            resourceId: ref.resourceId,
            versionId: target.versionId
        });
        return { ok: false, reason: 'restore-not-supported' };
    }

    const description = normalizeText(options.description || `Restored ${ref.resourceName || ref.resourceType} from Version ${target.versionNumber}`)
        || `Restored ${ref.resourceType}`;

    const snapshotAfterRestore = runtime.adapters.getSnapshot?.() || target.snapshot;
    const currentSnapshot = runtime.adapters.getSnapshot?.() || '';
    recordStateChange({
        description,
        beforeSnapshot: currentSnapshot,
        afterSnapshot: snapshotAfterRestore,
        operationType: 'restore',
        resource: ref
    });

    createVersionEntry(ref, {
        operationType: 'restore',
        description,
        snapshot: getResourcePayloadForVersion(ref),
        metadata: {
            restoredFromVersionId: target.versionId,
            restoredFromVersionNumber: target.versionNumber
        }
    });

    persistRuntime();

    emitHistoryEvent('Version Restored', {
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        versionId: target.versionId,
        versionNumber: target.versionNumber
    });

    return { ok: true, version: target };
}

export function compareResourceVersions(resource = {}, leftVersionId = '', rightVersionId = '') {
    initializeHistoryFramework();
    const ref = normalizeResourceRef(resource);
    const versions = collectVersionList(ref);
    const left = versions.find((entry) => entry.versionId === leftVersionId || String(entry.versionNumber) === String(leftVersionId)) || null;
    const right = versions.find((entry) => entry.versionId === rightVersionId || String(entry.versionNumber) === String(rightVersionId)) || null;
    if (!left || !right) {
        return { ok: false, reason: 'version-not-found', differences: [] };
    }

    const leftSnapshot = parseSnapshot(left.snapshot);
    const rightSnapshot = parseSnapshot(right.snapshot);

    const leftFlat = flattenObject(leftSnapshot);
    const rightFlat = flattenObject(rightSnapshot);

    const rightByPath = new Map(rightFlat.map((item) => [item.path, item.value]));
    const leftByPath = new Map(leftFlat.map((item) => [item.path, item.value]));

    const differences = [];

    leftFlat.forEach((item) => {
        if (!rightByPath.has(item.path)) {
            differences.push({
                path: item.path || '(root)',
                changeType: 'removed',
                previousValue: item.value,
                currentValue: undefined
            });
            return;
        }

        const currentValue = rightByPath.get(item.path);
        if (JSON.stringify(currentValue) !== JSON.stringify(item.value)) {
            differences.push({
                path: item.path || '(root)',
                changeType: 'modified',
                previousValue: item.value,
                currentValue
            });
        }
    });

    rightFlat.forEach((item) => {
        if (leftByPath.has(item.path)) return;
        differences.push({
            path: item.path || '(root)',
            changeType: 'added',
            previousValue: undefined,
            currentValue: item.value
        });
    });

    const summary = {
        total: differences.length,
        added: differences.filter((item) => item.changeType === 'added').length,
        removed: differences.filter((item) => item.changeType === 'removed').length,
        modified: differences.filter((item) => item.changeType === 'modified').length
    };

    emitHistoryEvent('Version Compared', {
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        leftVersionId: left.versionId,
        rightVersionId: right.versionId,
        differenceCount: differences.length
    });

    return {
        ok: true,
        resource: ref,
        left,
        right,
        summary,
        differences
    };
}

export function exportComparisonResult(comparison = {}) {
    const payload = comparison && typeof comparison === 'object' ? comparison : {};
    if (!payload.ok) return { ok: false, reason: 'invalid-comparison' };

    const lines = [];
    lines.push('ART Comparison Export');
    lines.push(`Resource: ${payload.resource.resourceName || payload.resource.resourceType}`);
    lines.push(`Left Version: ${payload.left.versionNumber} (${payload.left.versionId})`);
    lines.push(`Right Version: ${payload.right.versionNumber} (${payload.right.versionId})`);
    lines.push('');
    lines.push(`Differences: ${payload.summary.total}`);
    lines.push(`Added: ${payload.summary.added}`);
    lines.push(`Removed: ${payload.summary.removed}`);
    lines.push(`Modified: ${payload.summary.modified}`);
    lines.push('');
    lines.push('Details');

    payload.differences.forEach((difference, index) => {
        lines.push(`${index + 1}. ${difference.changeType.toUpperCase()} ${difference.path}`);
        lines.push(`   Previous: ${JSON.stringify(difference.previousValue)}`);
        lines.push(`   Current: ${JSON.stringify(difference.currentValue)}`);
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'art-version-comparison.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { ok: true };
}

function resolveResourceContext(context = {}) {
    const source = context && typeof context === 'object' ? context : {};
    const explicitType = normalizeText(source.resourceType || source.type).toLowerCase();
    const explicitId = normalizeText(source.resourceId || source.id);
    if (explicitType && explicitId) {
        return normalizeResourceRef({
            resourceType: explicitType,
            resourceId: explicitId,
            resourceName: normalizeText(source.resourceName || source.name),
            workspaceId: normalizeText(source.workspaceId || source.workspace)
        });
    }

    const anchor = source.triggerElement instanceof HTMLElement
        ? source.triggerElement
        : source.anchorElement instanceof HTMLElement
            ? source.anchorElement
            : document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

    const resourceNode = anchor?.closest?.('[data-resource-type][data-resource-id]');
    if (resourceNode instanceof HTMLElement) {
        return normalizeResourceRef({
            resourceType: resourceNode.getAttribute('data-resource-type') || 'application',
            resourceId: resourceNode.getAttribute('data-resource-id') || 'state',
            resourceName: resourceNode.getAttribute('data-resource-name') || '',
            workspaceId: resourceNode.getAttribute('data-workspace-id') || ''
        });
    }

    return normalizeResourceRef({
        resourceType: 'application',
        resourceId: 'state',
        resourceName: 'Application State'
    });
}

function renderHistoryDialogContent(options = {}) {
    const content = document.getElementById('art-history-content');
    const clearButton = document.getElementById('btn-art-history-clear');
    const closeButton = document.getElementById('btn-art-history-close');
    const dialog = document.getElementById('art-history-dialog');
    if (!(content instanceof HTMLElement) || !(clearButton instanceof HTMLButtonElement) || !(closeButton instanceof HTMLButtonElement) || !(dialog instanceof HTMLElement)) {
        return false;
    }

    const rows = queryHistory({ limit: 300 });
    content.innerHTML = `
        <p><strong>Undo Stack:</strong> ${runtime.undoStack.length}</p>
        <p><strong>Redo Stack:</strong> ${runtime.redoStack.length}</p>
        <p><strong>Total History Entries:</strong> ${runtime.historyEntries.length}</p>
        <label for="art-history-search">Search history</label>
        <input id="art-history-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search history entries">
        <ul id="art-history-list" class="workspace-explorer__resource-list">
            ${rows.map((entry) => `
                <li>
                    <article>
                        <h4>${entry.description}</h4>
                        <p>${entry.timestamp} | ${entry.resourceType} | ${entry.operationType}</p>
                    </article>
                </li>
            `).join('') || '<li><span class="workspace-explorer__empty">No history entries are available.</span></li>'}
        </ul>
    `;

    const search = document.getElementById('art-history-search');
    const list = document.getElementById('art-history-list');
    search?.addEventListener('input', () => {
        if (!(list instanceof HTMLElement) || !(search instanceof HTMLInputElement)) return;
        const query = search.value.trim().toLowerCase();
        const filtered = rows.filter((entry) => {
            if (!query) return true;
            return `${entry.description} ${entry.resourceType} ${entry.resourceName}`.toLowerCase().includes(query);
        });

        list.innerHTML = filtered.map((entry) => `
            <li>
                <article>
                    <h4>${entry.description}</h4>
                    <p>${entry.timestamp} | ${entry.resourceType} | ${entry.operationType}</p>
                </article>
            </li>
        `).join('') || '<li><span class="workspace-explorer__empty">No matching history entries.</span></li>';
    });

    clearButton.onclick = () => {
        clearHistory({ includeStacks: true, includeVersions: false });
        renderHistoryDialogContent(options);
    };

    closeButton.onclick = () => closeDialog(dialog, options.restoreFocus || null);
    dialog.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog(dialog, options.restoreFocus || null);
        }
    };

    openDialog(dialog, search || closeButton, 'History');
    return true;
}

function renderVersionHistoryDialog(resource, options = {}) {
    const dialog = document.getElementById('art-version-history-dialog');
    const content = document.getElementById('art-version-history-content');
    const closeButton = document.getElementById('btn-art-version-history-close');
    if (!(dialog instanceof HTMLElement) || !(content instanceof HTMLElement) || !(closeButton instanceof HTMLButtonElement)) return false;

    const versions = getResourceVersionHistory(resource, { limit: 300 });
    const ref = normalizeResourceRef(resource);

    content.innerHTML = `
        <h4>${normalizeText(ref.resourceName) || `${ref.resourceType}:${ref.resourceId}`}</h4>
        <p><strong>Resource:</strong> ${ref.resourceType} | <strong>Versions:</strong> ${versions.length}</p>
        <ul class="workspace-explorer__resource-list">
            ${versions.map((version) => `
                <li>
                    <article>
                        <h5>Version ${version.versionNumber}${version.versionNumber === versions[0].versionNumber ? ' (Current)' : ''}</h5>
                        <p>${version.timestamp}</p>
                        <p>${version.description}</p>
                        <div class="workspace-dialog__actions" role="group" aria-label="Version actions">
                            <button type="button" data-history-restore-version="${version.versionId}">Restore</button>
                            <button type="button" data-history-compare-base="${version.versionId}">Compare</button>
                        </div>
                    </article>
                </li>
            `).join('') || '<li><span class="workspace-explorer__empty">No versions are available.</span></li>'}
        </ul>
    `;

    closeButton.onclick = () => closeDialog(dialog, options.restoreFocus || null);
    dialog.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog(dialog, options.restoreFocus || null);
        }
    };

    content.querySelectorAll('[data-history-restore-version]').forEach((button) => {
        button.addEventListener('click', () => {
            const versionId = normalizeText(button.getAttribute('data-history-restore-version'));
            if (!versionId) return;
            restoreResourceVersion(ref, versionId);
            renderVersionHistoryDialog(ref, options);
        });
    });

    content.querySelectorAll('[data-history-compare-base]').forEach((button) => {
        button.addEventListener('click', () => {
            const leftVersionId = normalizeText(button.getAttribute('data-history-compare-base'));
            const latest = versions[0];
            if (!leftVersionId || !latest) return;
            const rightVersionId = leftVersionId === latest.versionId && versions[1] ? versions[1].versionId : latest.versionId;
            openCompareVersionsDialog({
                ...ref,
                leftVersionId,
                rightVersionId,
                triggerElement: button
            });
        });
    });

    openDialog(dialog, closeButton, `Version History: ${ref.resourceName || ref.resourceType}`);
    return true;
}

function renderComparisonDialog(comparison, options = {}) {
    const dialog = document.getElementById('art-compare-versions-dialog');
    const content = document.getElementById('art-compare-content');
    const closeButton = document.getElementById('btn-art-compare-close');
    const prevButton = document.getElementById('btn-art-compare-prev');
    const nextButton = document.getElementById('btn-art-compare-next');
    const exportButton = document.getElementById('btn-art-compare-export');
    if (!(dialog instanceof HTMLElement) || !(content instanceof HTMLElement) || !(closeButton instanceof HTMLButtonElement)
        || !(prevButton instanceof HTMLButtonElement) || !(nextButton instanceof HTMLButtonElement) || !(exportButton instanceof HTMLButtonElement)) {
        return false;
    }

    if (!comparison?.ok) {
        content.innerHTML = '<p>No comparison data is available.</p>';
        openDialog(dialog, closeButton, 'Compare Versions');
        return false;
    }

    const comparisonId = createId('comparison');
    runtime.comparisonCache[comparisonId] = {
        comparison,
        activeIndex: 0
    };

    const render = () => {
        const active = runtime.comparisonCache[comparisonId];
        if (!active) return;
        const { differences } = active.comparison;
        const activeIndex = Math.max(0, Math.min(active.activeIndex, differences.length - 1));
        active.activeIndex = activeIndex;

        content.innerHTML = `
            <p><strong>Resource:</strong> ${comparison.resource.resourceName || comparison.resource.resourceType}</p>
            <p><strong>Summary:</strong> ${comparison.summary.total} differences | ${comparison.summary.added} added | ${comparison.summary.modified} modified | ${comparison.summary.removed} removed</p>
            <label for="art-compare-filter">Filter differences</label>
            <select id="art-compare-filter">
                <option value="all">All</option>
                <option value="added">Added</option>
                <option value="removed">Removed</option>
                <option value="modified">Modified</option>
            </select>
            <ul id="art-compare-differences" class="workspace-explorer__resource-list">
                ${differences.map((difference, index) => `
                    <li data-compare-index="${index}" ${index === activeIndex ? 'aria-current="true"' : ''}>
                        <article>
                            <h4>${difference.changeType.toUpperCase()} | ${difference.path}</h4>
                            <p>Previous: ${JSON.stringify(difference.previousValue)}</p>
                            <p>Current: ${JSON.stringify(difference.currentValue)}</p>
                            <p>Difference ${index + 1} of ${differences.length}</p>
                        </article>
                    </li>
                `).join('') || '<li><span class="workspace-explorer__empty">No differences were detected.</span></li>'}
            </ul>
        `;

        const filter = document.getElementById('art-compare-filter');
        const list = document.getElementById('art-compare-differences');
        filter?.addEventListener('change', () => {
            if (!(list instanceof HTMLElement) || !(filter instanceof HTMLSelectElement)) return;
            const value = normalizeText(filter.value).toLowerCase();
            list.querySelectorAll('li[data-compare-index]').forEach((node) => {
                const idx = Number(node.getAttribute('data-compare-index'));
                const item = differences[idx];
                const visible = value === 'all' || item.changeType === value;
                node.hidden = !visible;
            });
        });
    };

    prevButton.onclick = () => {
        const active = runtime.comparisonCache[comparisonId];
        if (!active) return;
        active.activeIndex = Math.max(0, active.activeIndex - 1);
        render();
    };

    nextButton.onclick = () => {
        const active = runtime.comparisonCache[comparisonId];
        if (!active) return;
        active.activeIndex = Math.min(active.comparison.differences.length - 1, active.activeIndex + 1);
        render();
    };

    exportButton.onclick = () => {
        exportComparisonResult(comparison);
    };

    closeButton.onclick = () => {
        delete runtime.comparisonCache[comparisonId];
        closeDialog(dialog, options.restoreFocus || null);
    };

    dialog.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            delete runtime.comparisonCache[comparisonId];
            closeDialog(dialog, options.restoreFocus || null);
        }
    };

    render();
    openDialog(dialog, closeButton, 'Compare Versions');
    return true;
}

export function openHistoryDialogFromCommand(context = {}) {
    initializeHistoryFramework();
    ensureHistoryDialogs();
    return renderHistoryDialogContent({
        restoreFocus: context.triggerElement instanceof HTMLElement ? context.triggerElement : null
    });
}

export function openVersionHistoryFromCommand(context = {}) {
    initializeHistoryFramework();
    ensureHistoryDialogs();
    const resource = resolveResourceContext(context);
    return renderVersionHistoryDialog(resource, {
        restoreFocus: context.triggerElement instanceof HTMLElement ? context.triggerElement : null
    });
}

export function openCompareVersionsDialog(context = {}) {
    initializeHistoryFramework();
    ensureHistoryDialogs();

    const resource = resolveResourceContext(context);
    const versions = getResourceVersionHistory(resource, { limit: 300 });
    if (versions.length < 2) {
        return false;
    }

    const leftVersionId = normalizeText(context.leftVersionId || versions[0].versionId);
    const rightVersionId = normalizeText(context.rightVersionId || versions[1].versionId);

    const comparison = compareResourceVersions(resource, leftVersionId, rightVersionId);
    if (!comparison.ok) return false;
    return renderComparisonDialog(comparison, {
        restoreFocus: context.triggerElement instanceof HTMLElement ? context.triggerElement : null
    });
}

export function restorePreviousVersionFromCommand(context = {}) {
    initializeHistoryFramework();
    const resource = resolveResourceContext(context);
    const versions = getResourceVersionHistory(resource, { limit: 5 });
    if (versions.length < 2) {
        return { ok: false, reason: 'no-previous-version' };
    }

    const target = versions[1];
    return restoreResourceVersion(resource, target.versionId, {
        description: `Restored previous version for ${resource.resourceName || resource.resourceType}`
    });
}

export function clearHistoryFromCommand(context = {}) {
    const result = clearHistory({ includeStacks: true, includeVersions: false });
    if (result.ok) {
        emitHistoryEvent('History Cleared', {
            source: 'command',
            triggerElementId: context.triggerElement?.id || ''
        });
    }
    return result;
}

export function getHistoryFrameworkSnapshot() {
    initializeHistoryFramework();
    return {
        frameworkVersion: FRAMEWORK_VERSION,
        initialized: runtime.initialized,
        historyEntryCount: runtime.historyEntries.length,
        undoCount: runtime.undoStack.length,
        redoCount: runtime.redoStack.length,
        retention: { ...runtime.retention },
        transaction: {
            activeCount: runtime.transactions.active.length,
            completedCount: runtime.transactions.completed.length
        },
        versionsByResource: Object.fromEntries(
            Object.entries(runtime.versionsByResource).map(([key, value]) => [key, normalizeArray(value).map((entry) => ({
                versionId: entry.versionId,
                versionNumber: entry.versionNumber,
                timestamp: entry.timestamp,
                description: entry.description,
                operationType: entry.operationType,
                resourceType: entry.resourceType,
                resourceId: entry.resourceId,
                resourceName: entry.resourceName
            }))])
        ),
        history: queryHistory({ limit: 300 }),
        diagnostics: [...runtime.diagnostics]
    };
}

export function getHistoryResourceSummary(resource = {}) {
    initializeHistoryFramework();
    const ref = normalizeResourceRef(resource);
    const history = queryHistory({ resourceType: ref.resourceType, limit: 300 }).filter((entry) => entry.resourceId === ref.resourceId);
    const versions = getResourceVersionHistory(ref, { limit: 300 });
    return {
        resource: ref,
        historyCount: history.length,
        versionCount: versions.length,
        latestHistoryEntry: history[0] || null,
        latestVersion: versions[0] || null,
        canCompare: versions.length >= 2,
        canRestorePrevious: versions.length >= 2
    };
}

export function updateHistoryRetentionPolicy(config = {}) {
    initializeHistoryFramework();
    runtime.retention = normalizeRetention({
        ...runtime.retention,
        ...(config && typeof config === 'object' ? config : {})
    });
    pruneRetention();
    persistRuntime();
    emitHistoryEvent('Retention Policy Updated', {
        retention: runtime.retention
    });
    return { ok: true, retention: { ...runtime.retention } };
}

export function notifyHistoryFrameworkStateReset() {
    runtime.historyEntries = [];
    runtime.undoStack = [];
    runtime.redoStack = [];
    runtime.transactions.active = [];
    runtime.transactions.completed = [];
    runtime.versionsByResource = {};
    runtime.comparisonCache = {};
    persistRuntime();
    emitHistoryEvent('History Cleared', {
        source: 'state-reset'
    });
    return true;
}

export function getUndoMenuLabel() {
    const description = getUndoDescription();
    return description ? `Undo ${description}` : 'Undo';
}

export function getRedoMenuLabel() {
    const description = getRedoDescription();
    return description ? `Redo ${description}` : 'Redo';
}

export function executeUndoFromCommand() {
    return requestUndo({ source: 'command' });
}

export function executeRedoFromCommand() {
    return requestRedo({ source: 'command' });
}

export function runHistoryCommandAction(action, context = {}) {
    const normalized = normalizeText(action).toLowerCase();
    if (!normalized) return false;

    if (normalized === 'undo') {
        const result = executeUndoFromCommand();
        if (result.ok) {
            commandExecutionService.executeCommand('Application.RefreshUI', { source: 'history-framework', context }).catch(() => {
                // Refresh command may not exist; this is safe to ignore.
            });
        }
        return result.ok;
    }

    if (normalized === 'redo') {
        const result = executeRedoFromCommand();
        if (result.ok) {
            commandExecutionService.executeCommand('Application.RefreshUI', { source: 'history-framework', context }).catch(() => {
                // Refresh command may not exist; this is safe to ignore.
            });
        }
        return result.ok;
    }

    if (normalized === 'history') return openHistoryDialogFromCommand(context);
    if (normalized === 'version-history') return openVersionHistoryFromCommand(context);
    if (normalized === 'compare-versions') return openCompareVersionsDialog(context);
    if (normalized === 'restore-previous-version') return Boolean(restorePreviousVersionFromCommand(context)?.ok);
    if (normalized === 'clear-history') return Boolean(clearHistoryFromCommand(context)?.ok);
    return false;
}

export function setPendingHistoryAction(_action = '') {
    return true;
}
