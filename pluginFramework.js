import { getApplicationInfo, getImportedAccessibilityStandards, getIntegrationStatusMap, getShortcutDefinitions, getUniversalSearchConfig, getUserTemplates } from './state.js';
import { commandRegistry } from './commandRegistry.js';
import { registerRelationshipProvider, registerRelationshipValidator } from './resourceRelationshipFramework.js';
import { registerUniversalSearchProvider } from './universalSearchFramework.js';

const PLUGIN_STORAGE_KEY = 'art-plugin-framework-state-v1';
const PLUGIN_FRAMEWORK_VERSION = '1.0.0';

const EXTENSION_POINTS = Object.freeze([
    'resourceTypes',
    'reportTypes',
    'importProviders',
    'exportProviders',
    'dashboardCards',
    'explorerNodes',
    'contextMenuCommands',
    'commands',
    'menuItems',
    'toolbars',
    'keyboardShortcuts',
    'searchProviders',
    'relationshipProviders',
    'relationshipValidators',
    'workingViewProviders',
    'validationRules',
    'accessibilityStandards',
    'wcagExtensions',
    'section508Extensions',
    'en301549Extensions',
    'customAccessibilityStandards',
    'aiProviders',
    'integrationProviders'
]);

const PACKAGE_TYPES = Object.freeze([
    'accessibility-standards',
    'report-templates',
    'dashboard-layouts',
    'keyboard-profiles',
    'working-view-presets',
    'saved-searches',
    'sample-data',
    'documentation-packages',
    'integration-providers'
]);

const RISKY_PERMISSIONS = Object.freeze([
    'filesystem.read',
    'filesystem.write',
    'network.http',
    'network.websocket',
    'clipboard.read',
    'clipboard.write',
    'integration.external'
]);

let initialized = false;

const runtime = {
    pluginsById: new Map(),
    packagesById: new Map(),
    extensionRegistry: new Map(),
    diagnostics: [],
    persisted: {
        plugins: [],
        packages: []
    }
};

EXTENSION_POINTS.forEach((point) => runtime.extensionRegistry.set(point, []));

function nowIso() {
    return new Date().toISOString();
}

function normalizeText(value) {
    return String(value || '').trim();
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function recordDiagnostic(level, message, detail = {}) {
    const item = {
        id: createId('plugin-diag'),
        at: nowIso(),
        level: normalizeText(level).toLowerCase() || 'info',
        message: normalizeText(message),
        detail: detail && typeof detail === 'object' ? detail : {}
    };
    runtime.diagnostics.push(item);
    if (runtime.diagnostics.length > 400) {
        runtime.diagnostics = runtime.diagnostics.slice(-400);
    }
    return item;
}

function emitPluginEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('art-plugin-framework-event', {
        detail: {
            type,
            at: nowIso(),
            ...detail
        }
    }));
}

function loadPersistedState() {
    try {
        const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        runtime.persisted = {
            plugins: Array.isArray(parsed?.plugins) ? parsed.plugins : [],
            packages: Array.isArray(parsed?.packages) ? parsed.packages : []
        };
    } catch (error) {
        runtime.persisted = { plugins: [], packages: [] };
        recordDiagnostic('warning', 'Plugin framework storage could not be read.', {
            reason: String(error?.message || error)
        });
    }
}

function persistState() {
    runtime.persisted.plugins = [...runtime.pluginsById.values()].filter((plugin) => plugin.origin !== 'builtin').map((plugin) => ({
        manifest: plugin.manifest,
        enabled: plugin.enabled !== false,
        installedAt: plugin.installedAt,
        updatedAt: plugin.updatedAt || plugin.installedAt
    }));

    runtime.persisted.packages = [...runtime.packagesById.values()].map((pkg) => ({
        ...pkg
    }));

    localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(runtime.persisted));
}

function normalizeVersion(value, fallback = '0.0.0') {
    const text = normalizeText(value);
    return text || fallback;
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function compareVersions(left, right) {
    const leftParts = normalizeVersion(left).split('.').map((part) => Number(part) || 0);
    const rightParts = normalizeVersion(right).split('.').map((part) => Number(part) || 0);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const a = leftParts[index] || 0;
        const b = rightParts[index] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

function normalizeDependencyEntry(value) {
    if (typeof value === 'string') {
        return {
            pluginId: normalizeText(value),
            version: '',
            optional: false
        };
    }

    if (!value || typeof value !== 'object') {
        return {
            pluginId: '',
            version: '',
            optional: false
        };
    }

    return {
        pluginId: normalizeText(value.pluginId || value.id || value.identifier),
        version: normalizeText(value.version || value.minimumVersion),
        optional: Boolean(value.optional)
    };
}

function normalizePermissionEntry(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeManifest(source = {}) {
    const metadata = source && typeof source === 'object' ? source : {};
    const pluginId = normalizeText(metadata.pluginId || metadata.id || metadata.identifier);
    const displayName = normalizeText(metadata.displayName || metadata.name);

    const capabilities = metadata.capabilities && typeof metadata.capabilities === 'object'
        ? metadata.capabilities
        : {};

    const normalizedCapabilities = {};
    EXTENSION_POINTS.forEach((point) => {
        normalizedCapabilities[point] = normalizeArray(capabilities[point]);
    });

    return {
        pluginId,
        displayName,
        description: normalizeText(metadata.description),
        version: normalizeVersion(metadata.version),
        author: normalizeText(metadata.author),
        publisher: normalizeText(metadata.publisher),
        license: normalizeText(metadata.license),
        homepage: normalizeText(metadata.homepage),
        documentationUrl: normalizeText(metadata.documentationUrl),
        supportedArtVersion: normalizeText(metadata.supportedArtVersion || '1.5'),
        pluginDependencies: normalizeArray(metadata.pluginDependencies).map((entry) => normalizeDependencyEntry(entry)).filter((entry) => entry.pluginId),
        requiredPermissions: normalizeArray(metadata.requiredPermissions).map((entry) => normalizePermissionEntry(entry)).filter(Boolean),
        minimumPluginFrameworkVersion: normalizeVersion(metadata.minimumPluginFrameworkVersion || '1.0.0'),
        capabilities: normalizedCapabilities,
        moduleFactory: typeof metadata.moduleFactory === 'function' ? metadata.moduleFactory : null,
        initialize: typeof metadata.initialize === 'function' ? metadata.initialize : null
    };
}

function checkPluginDependencyIssues(plugin, options = {}) {
    if (!plugin?.manifest) return [];
    const includeOptional = options.includeOptional === true;
    const issues = [];

    normalizeArray(plugin.manifest.pluginDependencies).forEach((dependency) => {
        const entry = normalizeDependencyEntry(dependency);
        if (!entry.pluginId) return;
        if (entry.optional && !includeOptional) return;

        const target = runtime.pluginsById.get(entry.pluginId);
        if (!target) {
            issues.push({
                code: 'missing-dependency',
                pluginId: entry.pluginId,
                optional: entry.optional,
                message: `Dependency ${entry.pluginId} is not installed.`
            });
            return;
        }

        if (target.enabled === false) {
            issues.push({
                code: 'disabled-dependency',
                pluginId: entry.pluginId,
                optional: entry.optional,
                message: `Dependency ${entry.pluginId} is installed but disabled.`
            });
        }

        if (normalizeText(entry.version) && compareVersions(target.manifest?.version || '0.0.0', entry.version) < 0) {
            issues.push({
                code: 'dependency-version-mismatch',
                pluginId: entry.pluginId,
                optional: entry.optional,
                expectedVersion: entry.version,
                actualVersion: target.manifest?.version || '0.0.0',
                message: `Dependency ${entry.pluginId} version ${entry.version} is required, installed ${target.manifest?.version || '0.0.0'}.`
            });
        }
    });

    return issues;
}

function findDependents(pluginId) {
    const targetId = normalizeText(pluginId);
    if (!targetId) return [];

    return [...runtime.pluginsById.values()].filter((plugin) => {
        if (plugin.pluginId === targetId) return false;
        return normalizeArray(plugin.manifest?.pluginDependencies).some((entry) => normalizeDependencyEntry(entry).pluginId === targetId);
    });
}

function classifyPermissions(permissions = []) {
    const normalized = normalizeArray(permissions).map((entry) => normalizePermissionEntry(entry)).filter(Boolean);
    const risky = normalized.filter((entry) => RISKY_PERMISSIONS.includes(entry));
    return {
        all: normalized,
        risky,
        riskLevel: risky.length > 0 ? 'elevated' : (normalized.length > 0 ? 'standard' : 'none')
    };
}

function validateVersionCompatibility(supportedArtVersion) {
    const applicationInfo = getApplicationInfo();
    const artVersion = normalizeText(applicationInfo?.version || '1.5');
    const expected = normalizeText(supportedArtVersion || artVersion);

    if (!expected || expected === '*' || expected.toLowerCase() === 'any') {
        return { compatible: true, artVersion, expected };
    }

    if (expected === artVersion) {
        return { compatible: true, artVersion, expected };
    }

    const expectedMajor = expected.split('.')[0];
    const actualMajor = artVersion.split('.')[0];
    if (expected.endsWith('.x') && expectedMajor === actualMajor) {
        return { compatible: true, artVersion, expected };
    }

    return { compatible: false, artVersion, expected };
}

export function validatePluginManifest(source = {}) {
    const manifest = normalizeManifest(source);
    const errors = [];

    if (!manifest.pluginId) errors.push('Plugin Identifier is required.');
    if (!manifest.displayName) errors.push('Display Name is required.');
    if (!manifest.description) errors.push('Description is required.');
    if (!manifest.version) errors.push('Version is required.');
    if (!manifest.author) errors.push('Author is required.');
    if (!manifest.publisher) errors.push('Publisher is required.');
    if (!manifest.license) errors.push('License is required.');

    if (!/^[a-z0-9._-]+$/i.test(manifest.pluginId || '')) {
        errors.push('Plugin Identifier must contain only letters, numbers, period, underscore, or hyphen.');
    }

    if (compareVersions(PLUGIN_FRAMEWORK_VERSION, manifest.minimumPluginFrameworkVersion) < 0) {
        errors.push(`Plugin requires Plugin Framework ${manifest.minimumPluginFrameworkVersion}; current framework is ${PLUGIN_FRAMEWORK_VERSION}.`);
    }

    const seenDependencies = new Set();
    normalizeArray(manifest.pluginDependencies).forEach((dependency) => {
        const entry = normalizeDependencyEntry(dependency);
        if (!entry.pluginId) {
            errors.push('Plugin dependency entries must include pluginId.');
            return;
        }
        const key = `${entry.pluginId}|${entry.version}|${entry.optional ? '1' : '0'}`;
        if (seenDependencies.has(key)) {
            errors.push(`Duplicate plugin dependency declared: ${entry.pluginId}.`);
        }
        seenDependencies.add(key);

        if (entry.pluginId === manifest.pluginId) {
            errors.push('Plugin cannot depend on itself.');
        }
    });

    const compatibility = validateVersionCompatibility(manifest.supportedArtVersion);
    if (!compatibility.compatible) {
        errors.push(`Supported ART Version mismatch: plugin requires ${compatibility.expected}, app is ${compatibility.artVersion}.`);
    }

    return {
        ok: errors.length === 0,
        errors,
        manifest,
        compatibility
    };
}

function clearPluginRegistrations(pluginId) {
    EXTENSION_POINTS.forEach((point) => {
        const current = runtime.extensionRegistry.get(point) || [];
        runtime.extensionRegistry.set(point, current.filter((entry) => entry.pluginId !== pluginId));
    });
}

function registerCommandCapability(pluginId, commandDefinition) {
    try {
        commandRegistry.registerCommand(commandDefinition);
    } catch (error) {
        if (error?.code === 'duplicate-keyboard-shortcut-registration') {
            const fallbackDefinition = {
                ...commandDefinition,
                keyboardShortcut: ''
            };
            commandRegistry.registerCommand(fallbackDefinition);
            recordDiagnostic('warning', 'Plugin command shortcut conflict; registered without shortcut.', {
                pluginId,
                commandId: fallbackDefinition.id,
                shortcut: commandDefinition.keyboardShortcut || ''
            });
            return;
        }
        throw error;
    }
}

function registerPluginCapabilities(plugin) {
    const { pluginId, capabilities } = plugin.manifest;

    EXTENSION_POINTS.forEach((point) => {
        const items = normalizeArray(capabilities?.[point]);
        if (items.length === 0) return;

        if (point === 'commands') {
            items.forEach((commandDefinition) => registerCommandCapability(pluginId, commandDefinition));
        }

        if (point === 'searchProviders') {
            items.forEach((provider) => {
                try {
                    registerUniversalSearchProvider(provider);
                } catch (error) {
                    recordDiagnostic('warning', 'Search provider registration failed for plugin.', {
                        pluginId,
                        reason: String(error?.message || error)
                    });
                }
            });
        }

        if (point === 'relationshipProviders') {
            items.forEach((provider) => {
                try {
                    registerRelationshipProvider(provider);
                } catch (error) {
                    recordDiagnostic('warning', 'Relationship provider registration failed for plugin.', {
                        pluginId,
                        reason: String(error?.message || error)
                    });
                }
            });
        }

        if (point === 'relationshipValidators') {
            items.forEach((validator) => {
                try {
                    registerRelationshipValidator(validator);
                } catch (error) {
                    recordDiagnostic('warning', 'Relationship validator registration failed for plugin.', {
                        pluginId,
                        reason: String(error?.message || error)
                    });
                }
            });
        }

        if (point === 'keyboardShortcuts') {
            const normalized = items.map((item) => ({
                ...item,
                shortcut: ''
            }));
            const current = runtime.extensionRegistry.get(point) || [];
            runtime.extensionRegistry.set(point, current.concat(normalized.map((item) => ({ pluginId, value: item }))));
            return;
        }

        const current = runtime.extensionRegistry.get(point) || [];
        runtime.extensionRegistry.set(point, current.concat(items.map((item) => ({ pluginId, value: item }))));
    });
}

function buildPluginRecord(manifest, origin = 'external') {
    return {
        pluginId: manifest.pluginId,
        manifest,
        origin,
        installedAt: nowIso(),
        updatedAt: nowIso(),
        discovered: true,
        validated: false,
        loaded: false,
        initialized: false,
        enabled: true,
        status: 'discovered',
        errors: []
    };
}

function loadEnabledPluginsInDependencyOrder() {
    const candidates = [...runtime.pluginsById.values()].filter((plugin) => plugin.enabled !== false && plugin.validated);
    const pending = new Set(candidates.map((plugin) => plugin.pluginId));
    let progressed = true;

    while (pending.size > 0 && progressed) {
        progressed = false;

        [...pending].forEach((pluginId) => {
            const plugin = runtime.pluginsById.get(pluginId);
            if (!plugin) {
                pending.delete(pluginId);
                return;
            }

            const blockingIssues = checkPluginDependencyIssues(plugin, { includeOptional: false })
                .filter((issue) => issue.optional !== true);
            if (blockingIssues.length > 0) {
                return;
            }

            loadPluginRuntime(plugin);
            pending.delete(pluginId);
            progressed = true;
        });
    }

    if (pending.size > 0) {
        [...pending].forEach((pluginId) => {
            const plugin = runtime.pluginsById.get(pluginId);
            if (!plugin) return;
            const issues = checkPluginDependencyIssues(plugin, { includeOptional: false });
            plugin.status = 'dependency-blocked';
            plugin.errors = [...new Set(plugin.errors.concat(issues.map((issue) => issue.message)))];
            recordDiagnostic('warning', 'Plugin is blocked by unresolved dependencies.', {
                pluginId,
                issues
            });
        });
    }
}

function registerDiscoveredPlugin(manifest, origin = 'external', options = {}) {
    const validation = validatePluginManifest(manifest);
    const plugin = buildPluginRecord(validation.manifest, origin);
    plugin.enabled = options.enabled !== false;
    plugin.validated = validation.ok;
    plugin.status = validation.ok ? 'validated' : 'validation-failed';
    plugin.errors = validation.errors;

    if (runtime.pluginsById.has(plugin.pluginId)) {
        const existing = runtime.pluginsById.get(plugin.pluginId);
        recordDiagnostic('warning', 'Duplicate plugin identifier detected. Duplicate plugin ignored.', {
            pluginId: plugin.pluginId,
            existingOrigin: existing.origin,
            duplicateOrigin: origin
        });
        emitPluginEvent('Plugin Validation Failed', {
            pluginId: plugin.pluginId,
            reason: 'duplicate-plugin-id'
        });
        return null;
    }

    runtime.pluginsById.set(plugin.pluginId, plugin);

    emitPluginEvent('Plugin Discovered', {
        pluginId: plugin.pluginId,
        origin
    });

    if (!validation.ok) {
        emitPluginEvent('Plugin Validation Failed', {
            pluginId: plugin.pluginId,
            errors: validation.errors
        });
    } else {
        emitPluginEvent('Plugin Validated', {
            pluginId: plugin.pluginId
        });
    }

    return plugin;
}

function loadPluginRuntime(plugin) {
    if (!plugin || !plugin.validated || plugin.enabled === false) return false;

    try {
        const api = {
            pluginId: plugin.pluginId,
            frameworkVersion: PLUGIN_FRAMEWORK_VERSION,
            registerCapability: (extensionPoint, value) => {
                if (!EXTENSION_POINTS.includes(extensionPoint)) {
                    throw new Error(`Unsupported extension point: ${extensionPoint}`);
                }
                const current = runtime.extensionRegistry.get(extensionPoint) || [];
                runtime.extensionRegistry.set(extensionPoint, current.concat([{ pluginId: plugin.pluginId, value }]));
            },
            emit: (name, detail = {}) => emitPluginEvent(name, { pluginId: plugin.pluginId, ...detail })
        };

        if (typeof plugin.manifest.moduleFactory === 'function') {
            const produced = plugin.manifest.moduleFactory(api);
            if (produced && typeof produced === 'object') {
                EXTENSION_POINTS.forEach((point) => {
                    if (Array.isArray(produced[point]) && produced[point].length > 0) {
                        plugin.manifest.capabilities[point] = produced[point];
                    }
                });
            }
        }

        registerPluginCapabilities(plugin);

        if (typeof plugin.manifest.initialize === 'function') {
            plugin.manifest.initialize(api);
        }

        plugin.loaded = true;
        plugin.initialized = true;
        plugin.status = 'enabled';
        emitPluginEvent('Plugin Loaded', { pluginId: plugin.pluginId });
        emitPluginEvent('Plugin Enabled', { pluginId: plugin.pluginId });
        return true;
    } catch (error) {
        plugin.status = 'load-failed';
        plugin.errors = plugin.errors.concat([String(error?.message || error)]);
        recordDiagnostic('error', 'Plugin failed during load/initialize.', {
            pluginId: plugin.pluginId,
            reason: String(error?.message || error)
        });
        emitPluginEvent('Plugin Validation Failed', {
            pluginId: plugin.pluginId,
            reason: 'load-failed',
            error: String(error?.message || error)
        });
        return false;
    }
}

function discoverBuiltInPlugins() {
    const builtIns = [
        {
            pluginId: 'art.builtin.accessibility-standards',
            displayName: 'Built-in Accessibility Standards',
            description: 'Registers built-in standards and standards extension metadata.',
            version: '1.0.0',
            author: 'ART Team',
            publisher: 'ART',
            license: 'MIT',
            supportedArtVersion: '1.5',
            capabilities: {
                accessibilityStandards: [{ id: 'builtin-wcag', name: 'WCAG Built-in Catalog' }],
                wcagExtensions: [{ id: 'wcag-core', name: 'WCAG Core' }]
            }
        },
        {
            pluginId: 'art.builtin.export-providers',
            displayName: 'Built-in Export Providers',
            description: 'Declares built-in export provider extension points.',
            version: '1.0.0',
            author: 'ART Team',
            publisher: 'ART',
            license: 'MIT',
            supportedArtVersion: '1.5',
            capabilities: {
                exportProviders: [{ id: 'builtin-json-export', format: 'json' }]
            }
        }
    ];

    builtIns.forEach((manifest) => {
        registerDiscoveredPlugin(manifest, 'builtin', { enabled: true });
    });
}

function discoverPersistedPlugins() {
    normalizeArray(runtime.persisted.plugins).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const manifest = entry.manifest && typeof entry.manifest === 'object' ? entry.manifest : null;
        if (!manifest) return;
        registerDiscoveredPlugin(manifest, 'external', {
            enabled: entry.enabled !== false
        });
    });
}

function restorePersistedPackages() {
    normalizeArray(runtime.persisted.packages).forEach((pkg) => {
        if (!pkg || typeof pkg !== 'object') return;
        if (!pkg.packageId) return;
        runtime.packagesById.set(pkg.packageId, { ...pkg });
    });
}

export function registerPluginManifest(manifest, options = {}) {
    const normalized = normalizeManifest(manifest);
    const existing = runtime.pluginsById.get(normalized.pluginId);
    if (existing && options.updateIfExists === true && existing.origin !== 'builtin') {
        return updatePluginManifest(normalized.pluginId, manifest);
    }

    const plugin = registerDiscoveredPlugin(manifest, options.origin || 'external', {
        enabled: options.enabled !== false
    });
    if (!plugin) return { ok: false, reason: 'duplicate-plugin-id' };

    persistState();
    return {
        ok: plugin.validated,
        pluginId: plugin.pluginId,
        errors: plugin.errors
    };
}

export function enablePlugin(pluginId) {
    const plugin = runtime.pluginsById.get(normalizeText(pluginId));
    if (!plugin) return { ok: false, reason: 'not-found' };

    const dependencyIssues = checkPluginDependencyIssues(plugin, { includeOptional: false })
        .filter((issue) => issue.optional !== true);
    if (dependencyIssues.length > 0) {
        plugin.status = 'dependency-blocked';
        plugin.errors = [...new Set(plugin.errors.concat(dependencyIssues.map((issue) => issue.message)))];
        persistState();
        return {
            ok: false,
            reason: 'dependency-failed',
            errors: dependencyIssues.map((issue) => issue.message)
        };
    }

    plugin.enabled = true;
    plugin.errors = [];

    clearPluginRegistrations(plugin.pluginId);
    const loaded = loadPluginRuntime(plugin);

    persistState();
    if (!loaded) {
        return { ok: false, reason: 'load-failed', errors: plugin.errors };
    }

    return { ok: true, pluginId: plugin.pluginId };
}

export function disablePlugin(pluginId) {
    const plugin = runtime.pluginsById.get(normalizeText(pluginId));
    if (!plugin) return { ok: false, reason: 'not-found' };

    const activeDependents = findDependents(plugin.pluginId).filter((dependent) => dependent.enabled !== false);
    if (activeDependents.length > 0) {
        return {
            ok: false,
            reason: 'required-by-dependent',
            dependents: activeDependents.map((item) => item.pluginId)
        };
    }

    plugin.enabled = false;
    plugin.loaded = false;
    plugin.initialized = false;
    plugin.status = 'disabled';

    clearPluginRegistrations(plugin.pluginId);
    emitPluginEvent('Plugin Disabled', { pluginId: plugin.pluginId });

    persistState();
    return { ok: true, pluginId: plugin.pluginId };
}

export function uninstallPlugin(pluginId) {
    const normalized = normalizeText(pluginId);
    const plugin = runtime.pluginsById.get(normalized);
    if (!plugin) return { ok: false, reason: 'not-found' };
    if (plugin.origin === 'builtin') return { ok: false, reason: 'builtin-plugin' };

    const activeDependents = findDependents(normalized).filter((dependent) => dependent.enabled !== false);
    if (activeDependents.length > 0) {
        return {
            ok: false,
            reason: 'required-by-dependent',
            dependents: activeDependents.map((item) => item.pluginId)
        };
    }

    clearPluginRegistrations(normalized);
    runtime.pluginsById.delete(normalized);

    emitPluginEvent('Plugin Uninstalled', { pluginId: normalized });
    persistState();
    return { ok: true };
}

export function updatePluginManifest(pluginId, nextManifest) {
    const normalized = normalizeText(pluginId);
    const plugin = runtime.pluginsById.get(normalized);
    if (!plugin) return { ok: false, reason: 'not-found' };
    if (plugin.origin === 'builtin') return { ok: false, reason: 'builtin-plugin' };

    const validation = validatePluginManifest(nextManifest);
    if (!validation.ok) {
        return { ok: false, reason: 'invalid-manifest', errors: validation.errors };
    }

    clearPluginRegistrations(normalized);

    plugin.manifest = validation.manifest;
    plugin.validated = true;
    plugin.updatedAt = nowIso();
    plugin.status = plugin.enabled ? 'validated' : 'disabled';
    plugin.errors = [];

    emitPluginEvent('Plugin Updated', { pluginId: normalized });

    if (plugin.enabled) {
        const dependencyIssues = checkPluginDependencyIssues(plugin, { includeOptional: false })
            .filter((issue) => issue.optional !== true);
        if (dependencyIssues.length > 0) {
            plugin.status = 'dependency-blocked';
            plugin.errors = dependencyIssues.map((issue) => issue.message);
            persistState();
            return {
                ok: false,
                reason: 'dependency-failed',
                errors: plugin.errors
            };
        }

        loadPluginRuntime(plugin);
    }

    persistState();
    return { ok: true, pluginId: normalized };
}

function normalizePackageDescriptor(source = {}) {
    const pkg = source && typeof source === 'object' ? source : {};
    const packageId = normalizeText(pkg.packageId || pkg.id || pkg.identifier) || createId('package');
    const packageType = normalizeText(pkg.packageType || pkg.type);
    const displayName = normalizeText(pkg.displayName || pkg.name || packageId);

    return {
        packageId,
        packageType,
        displayName,
        description: normalizeText(pkg.description),
        version: normalizeVersion(pkg.version, '1.0.0'),
        author: normalizeText(pkg.author),
        publisher: normalizeText(pkg.publisher),
        sourceWorkflow: normalizeText(pkg.sourceWorkflow || 'unknown'),
        compatibility: {
            supportedArtVersion: normalizeText(pkg.supportedArtVersion || '1.5')
        },
        metadata: pkg.metadata && typeof pkg.metadata === 'object' ? pkg.metadata : {},
        resources: normalizeArray(pkg.resources),
        importedAt: normalizeText(pkg.importedAt || nowIso()),
        enabled: pkg.enabled !== false
    };
}

function validatePackageDescriptor(source) {
    const descriptor = normalizePackageDescriptor(source);
    const errors = [];

    if (!descriptor.packageType) errors.push('Package Type is required.');
    if (!PACKAGE_TYPES.includes(descriptor.packageType)) {
        errors.push(`Unsupported package type: ${descriptor.packageType}`);
    }
    if (!descriptor.displayName) errors.push('Display Name is required.');

    const compatibility = validateVersionCompatibility(descriptor.compatibility.supportedArtVersion);
    if (!compatibility.compatible) {
        errors.push(`Package supported ART Version mismatch: ${compatibility.expected} vs ${compatibility.artVersion}`);
    }

    return {
        ok: errors.length === 0,
        errors,
        descriptor
    };
}

export function registerPackageFromWorkflow(source, options = {}) {
    const validation = validatePackageDescriptor({
        ...source,
        sourceWorkflow: options.sourceWorkflow || source?.sourceWorkflow || 'unknown'
    });

    if (!validation.ok) {
        recordDiagnostic('warning', 'Package registration failed validation.', {
            errors: validation.errors,
            packageId: validation.descriptor.packageId
        });
        return { ok: false, errors: validation.errors };
    }

    const existing = runtime.packagesById.get(validation.descriptor.packageId);
    const next = {
        ...(existing || {}),
        ...validation.descriptor,
        registeredAt: nowIso()
    };

    runtime.packagesById.set(next.packageId, next);
    emitPluginEvent('Package Registered', {
        packageId: next.packageId,
        packageType: next.packageType,
        sourceWorkflow: next.sourceWorkflow
    });
    persistState();
    return { ok: true, package: next };
}

export function unregisterPackageById(packageId) {
    const normalized = normalizeText(packageId);
    if (!runtime.packagesById.has(normalized)) return { ok: false, reason: 'not-found' };
    runtime.packagesById.delete(normalized);
    emitPluginEvent('Package Unregistered', { packageId: normalized });
    persistState();
    return { ok: true };
}

export function unregisterPackagesBySource(sourceWorkflow, resourceId = '') {
    const workflow = normalizeText(sourceWorkflow);
    const sourceId = normalizeText(resourceId);
    const removed = [];

    runtime.packagesById.forEach((pkg, packageId) => {
        const matchesWorkflow = !workflow || pkg.sourceWorkflow === workflow;
        const matchesResource = !sourceId || normalizeText(pkg.metadata?.sourceId) === sourceId;
        if (matchesWorkflow && matchesResource) {
            runtime.packagesById.delete(packageId);
            removed.push(packageId);
        }
    });

    if (removed.length > 0) {
        emitPluginEvent('Package Unregistered', {
            sourceWorkflow: workflow,
            removed
        });
        persistState();
    }

    return { ok: true, removed };
}

function syncBuiltInPackagesFromState() {
    const standards = getImportedAccessibilityStandards();
    standards.forEach((standard) => {
        registerPackageFromWorkflow({
            packageId: `standard:${normalizeText(standard.internalId || standard.id)}`,
            packageType: 'accessibility-standards',
            displayName: standard.displayName || standard.internalId || 'Imported Standard',
            description: 'Imported accessibility standards package.',
            version: standard.version || '1.0',
            sourceWorkflow: 'settingsImportStandard',
            metadata: {
                sourceId: normalizeText(standard.id),
                internalId: normalizeText(standard.internalId),
                criteriaCount: Array.isArray(standard.criteria) ? standard.criteria.length : 0
            },
            resources: [{ type: 'accessibility-standard', id: normalizeText(standard.id) }]
        }, {
            sourceWorkflow: 'settingsImportStandard'
        });
    });

    const templates = getUserTemplates();
    templates.forEach((template) => {
        registerPackageFromWorkflow({
            packageId: `template:${normalizeText(template.id)}`,
            packageType: 'report-templates',
            displayName: template.name || 'Template',
            description: 'Imported or user template package.',
            version: template.metadata?.version || '1.0.0',
            sourceWorkflow: 'importTemplate',
            metadata: {
                sourceId: normalizeText(template.id),
                templateOption: normalizeText(template.metadata?.source)
            },
            resources: [{ type: 'template', id: normalizeText(template.id) }]
        }, {
            sourceWorkflow: 'importTemplate'
        });
    });

    const integrations = getIntegrationStatusMap();
    Object.entries(integrations || {}).forEach(([key, status]) => {
        registerPackageFromWorkflow({
            packageId: `integration:${normalizeText(key)}`,
            packageType: 'integration-providers',
            displayName: normalizeText(status?.label || key),
            description: 'Integration provider package metadata.',
            version: normalizeVersion(status?.version || '1.0.0'),
            sourceWorkflow: 'connectIntegrations',
            metadata: {
                sourceId: normalizeText(key),
                status: normalizeText(status?.status || 'Not connected')
            },
            resources: [{ type: 'integration', id: normalizeText(key) }]
        }, {
            sourceWorkflow: 'connectIntegrations'
        });
    });

    registerPackageFromWorkflow({
        packageId: 'keyboard-profile:active',
        packageType: 'keyboard-profiles',
        displayName: 'Active Keyboard Profile',
        description: 'Current keyboard shortcut assignments.',
        version: '1.0.0',
        sourceWorkflow: 'keyboardManager',
        metadata: {
            shortcutCount: getShortcutDefinitions().length
        },
        resources: [{ type: 'keyboard-shortcuts', id: 'active' }]
    }, { sourceWorkflow: 'keyboardManager' });

    const savedSearches = getUniversalSearchConfig().savedSearches || [];
    registerPackageFromWorkflow({
        packageId: 'saved-searches:active',
        packageType: 'saved-searches',
        displayName: 'Saved Searches',
        description: 'Saved searches package metadata.',
        version: '1.0.0',
        sourceWorkflow: 'universalSearch',
        metadata: {
            savedSearchCount: savedSearches.length
        },
        resources: savedSearches.map((item) => ({ type: 'saved-search', id: normalizeText(item.id) }))
    }, { sourceWorkflow: 'universalSearch' });
}

export function syncFrameworkPackagesFromState() {
    syncBuiltInPackagesFromState();
    return true;
}

export function validateRegisteredExtensions() {
    const pluginChecks = [...runtime.pluginsById.values()].map((plugin) => {
        const dependencyIssues = checkPluginDependencyIssues(plugin, { includeOptional: false })
            .filter((issue) => issue.optional !== true);
        const ok = plugin.validated && (plugin.enabled ? plugin.status !== 'load-failed' : true) && dependencyIssues.length === 0;
        return {
            id: plugin.pluginId,
            type: 'plugin',
            ok,
            status: plugin.status,
            errors: plugin.errors.concat(dependencyIssues.map((issue) => issue.message))
        };
    });

    const packageChecks = [...runtime.packagesById.values()].map((pkg) => {
        const check = validatePackageDescriptor(pkg);
        return {
            id: pkg.packageId,
            type: 'package',
            ok: check.ok,
            status: check.ok ? 'registered' : 'invalid',
            errors: check.errors
        };
    });

    const results = [...pluginChecks, ...packageChecks];
    const failed = results.filter((item) => !item.ok);

    emitPluginEvent('Plugin Validation Completed', {
        total: results.length,
        failed: failed.length
    });

    return {
        ok: failed.length === 0,
        total: results.length,
        failed: failed.length,
        results
    };
}

export function getPluginFrameworkSnapshot() {
    return {
        frameworkVersion: PLUGIN_FRAMEWORK_VERSION,
        initialized,
        extensionPoints: [...EXTENSION_POINTS],
        packageTypes: [...PACKAGE_TYPES],
        plugins: [...runtime.pluginsById.values()].map((plugin) => ({
            pluginId: plugin.pluginId,
            displayName: plugin.manifest.displayName,
            description: plugin.manifest.description,
            version: plugin.manifest.version,
            author: plugin.manifest.author,
            publisher: plugin.manifest.publisher,
            supportedArtVersion: plugin.manifest.supportedArtVersion,
            enabled: plugin.enabled,
            origin: plugin.origin,
            status: plugin.status,
            dependencies: plugin.manifest.pluginDependencies,
            permissions: plugin.manifest.requiredPermissions,
            permissionSummary: classifyPermissions(plugin.manifest.requiredPermissions),
            dependencyIssues: checkPluginDependencyIssues(plugin, { includeOptional: true }),
            registeredExtensionPoints: EXTENSION_POINTS.filter((point) => (runtime.extensionRegistry.get(point) || []).some((entry) => entry.pluginId === plugin.pluginId))
        })),
        packages: [...runtime.packagesById.values()].map((pkg) => ({
            packageId: pkg.packageId,
            packageType: pkg.packageType,
            displayName: pkg.displayName,
            version: pkg.version,
            sourceWorkflow: pkg.sourceWorkflow,
            enabled: pkg.enabled,
            metadata: pkg.metadata,
            resources: pkg.resources,
            importedAt: pkg.importedAt,
            registeredAt: pkg.registeredAt
        })),
        extensionRegistry: Object.fromEntries(
            [...runtime.extensionRegistry.entries()].map(([key, list]) => [key, list.map((item) => ({ pluginId: item.pluginId, value: item.value }))])
        )
    };
}

export function exportPluginFrameworkState() {
    const payload = {
        exportedAt: nowIso(),
        frameworkVersion: PLUGIN_FRAMEWORK_VERSION,
        stateVersion: 1,
        plugins: runtime.persisted.plugins,
        packages: runtime.persisted.packages
    };
    return JSON.stringify(payload, null, 2);
}

export function importPluginFrameworkState(source = {}) {
    const payload = source && typeof source === 'object' ? source : {};
    const plugins = normalizeArray(payload.plugins);
    const packages = normalizeArray(payload.packages);

    const pluginResults = plugins.map((entry) => {
        if (!entry || typeof entry !== 'object' || !entry.manifest) {
            return { ok: false, reason: 'invalid-entry' };
        }

        return registerPluginManifest(entry.manifest, {
            origin: 'external',
            enabled: entry.enabled !== false,
            updateIfExists: true
        });
    });

    const packageResults = packages.map((entry) => registerPackageFromWorkflow(entry, {
        sourceWorkflow: entry?.sourceWorkflow || 'pluginFrameworkImport'
    }));

    persistState();
    emitPluginEvent('Plugin Framework Imported', {
        pluginCount: pluginResults.filter((item) => item?.ok).length,
        packageCount: packageResults.filter((item) => item?.ok).length
    });

    return {
        ok: pluginResults.every((item) => item?.ok !== false) && packageResults.every((item) => item?.ok !== false),
        pluginsProcessed: pluginResults.length,
        packagesProcessed: packageResults.length,
        pluginResults,
        packageResults
    };
}

export function getPluginFrameworkDiagnostics() {
    return [...runtime.diagnostics];
}

export function initPluginFramework() {
    if (initialized) return true;

    loadPersistedState();
    discoverBuiltInPlugins();
    discoverPersistedPlugins();
    restorePersistedPackages();

    loadEnabledPluginsInDependencyOrder();

    syncBuiltInPackagesFromState();

    emitPluginEvent('Plugin Framework Ready', {
        pluginCount: runtime.pluginsById.size,
        packageCount: runtime.packagesById.size
    });
    recordDiagnostic('info', 'Plugin Framework initialized.', {
        pluginCount: runtime.pluginsById.size,
        packageCount: runtime.packagesById.size
    });

    persistState();
    initialized = true;
    return true;
}
