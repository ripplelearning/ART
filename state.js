// state.js
import {
    canRedo,
    canUndo,
    configureHistoryFrameworkStateAdapter,
    getRedoDescription,
    getUndoDescription,
    notifyHistoryFrameworkStateReset,
    recordStateChange,
    requestRedo,
    requestUndo,
    setPendingHistoryAction as setCentralPendingHistoryAction
} from './historyFramework.js';
import { commandRegistry } from './commandRegistry.js';
import {
    getRequiredTopLevelMenuLabels,
    getTopLevelMenuLabelFromAction,
    getTopLevelMenuShortcutDescriptor,
    isTopLevelMenuShortcutAction,
    mergeTopLevelMenuLabels
} from './menuShortcuts.js';

const REQUIRED_TOP_LEVEL_MENU_SHORTCUT_DEFAULTS = Object.fromEntries(
    getRequiredTopLevelMenuLabels()
        .map((menuLabel) => getTopLevelMenuShortcutDescriptor(menuLabel))
        .filter(Boolean)
        .map((descriptor) => [descriptor.action, ''])
);

const defaultState = {
    reportTitle: "",
    orgClient: "",
    product: "",
    projectName: "",
    scopeUrl: "",
    auditDateStart: "",
    auditDateEnd: "",
    auditors: "",
    standard: "WCAG 2.2",
    testingInstructions: "",
    reportType: "",
    reportLayout: "",
    fieldsExpanded: true,
    templateOption: "",
    templateName: "",
    templateDescription: "",
    progressLogEnabled: false,
    progressLogAppendixEnabled: false,
    progressItems: [],
    fields: [],
    editingIndex: -1,
    editorUsesReportTitle: false,
    editorReadOnly: false,
    editorFieldValues: {},
    auditEntries: [],
    activeAuditEntryIndex: 0,
    reports: [],
    selectedReportId: '',
    userTemplates: [],
    templateEditingId: null,
    templateCreateMode: false,
    lastCreatedTemplateId: "",
    userStandards: [],
    shortcuts: {
        spellCheck: 'F7',
        spellReplace: 'Alt+R',
        spellReplaceAll: 'Alt+A',
        spellIgnore: 'Alt+I',
        spellIgnoreAll: 'Alt+G',
        spellAddToDictionary: '',
        spellUndoLastCorrection: 'Alt+U',
        spellCancel: 'Alt+C',
        nextLandmark: 'Ctrl+F6',
        previousLandmark: 'Ctrl+Shift+F6',
        focusNavigation: 'Alt+Shift+N',
        focusDashboard: 'Alt+Shift+S',
        showDashboard: '',
        showExplorer: '',
        toggleWorkspaceView: '',
        openWorkingView: 'Ctrl+Alt+W',
        newWorkingView: '',
        exitWorkingView: 'Ctrl+Alt+X',
        applyWorkingView: 'Ctrl+Alt+Shift+W',
        saveWorkingView: '',
        loadWorkingView: '',
        deleteWorkingView: '',
        refreshWorkingView: '',
        resetWorkingView: '',
        batchSetWorkingViewStatus: '',
        batchAssignWorkingViewReviewer: '',
        batchSetWorkingViewSeverity: '',
        batchAddWorkingViewTag: '',
        nextWorkingViewFinding: '',
        previousWorkingViewFinding: '',
        nextWorkingViewGroup: '',
        previousWorkingViewGroup: '',
        revealWorkingViewInExplorer: '',
        revealWorkingViewInReport: '',
        expandAllWorkingViewGroups: '',
        collapseAllWorkingViewGroups: '',
        setStandardReportView: '',
        setWorkingReportView: '',
        setOutlineReportView: '',
        setCompactReportView: '',
        setExpandedReportView: '',
        setReadingReportView: '',
        setReviewReportView: '',
        setTableReportView: '',
        toggleReportViewMode: '',
        configureDashboard: 'Alt+Shift+G',
        focusMainContent: '',
        openWelcome: 'Alt+Shift+W',
        openHelp: 'F1',
        openCommandPalette: 'Ctrl+Shift+P',
        openBuilder: 'Alt+Shift+U',
        openEditor: 'Alt+Shift+E',
        openViewer: 'Alt+Shift+V',
        openProgressLog: 'Alt+Shift+P',
        focusLookup: 'Alt+Shift+L',
        focusMenuBar: 'F10',
        focusMenuSearch: 'Alt+Q',
        ...REQUIRED_TOP_LEVEL_MENU_SHORTCUT_DEFAULTS,
        undo: 'Ctrl+Z',
        redo: 'Ctrl+Y',
        openHistory: '',
        openVersionHistory: '',
        compareVersions: '',
        restorePreviousVersion: '',
        clearHistory: '',
        searchEverywhere: 'Ctrl+K',
        quickOpen: '',
        openRecentItems: '',
        clearRecentItems: '',
        addToFavorites: '',
        removeFromFavorites: '',
        openFavorites: '',
        addBookmark: '',
        openBookmarks: '',
        clearBookmarks: '',
        navigateBack: 'Alt+[',
        navigateForward: 'Alt+]',
        openOrganizationStatistics: '',
        openOrganizationOverview: '',
        openOrganizationFindings: '',
        openOrganizationTrends: '',
        openOrganizationRecurrence: '',
        openOrganizationComparison: '',
        openOrganizationSavedViews: '',
        saveOrganizationStatisticsView: '',
        exportOrganizationStatistics: '',
        exportOrganizationStatisticsCsv: '',
        recordOrganizationStatisticsSnapshot: '',
        openOrganizationDataQuality: '',
        toggleOrganizationDashboardSection: '',
        openNavigationHistory: '',
        clearNavigationHistory: '',
        searchCurrentReport: '',
        searchCurrentProjectWorkspace: '',
        searchAllProjects: '',
        searchAccessibilityStandards: '',
        searchHelpDocumentation: '',
        searchCommands: '',
        searchKeyboardShortcuts: '',
        searchProjectAssets: '',
        searchTemplates: '',
        searchDashboard: '',
        findInCurrentResource: 'Ctrl+F',
        findNextMatch: 'F3',
        findPreviousMatch: 'Shift+F3',
        nextSearchResult: 'Alt+F3',
        previousSearchResult: 'Alt+Shift+F3',
        clearSearchHighlights: 'Alt+Shift+H',
        clearSearchHistory: '',
        saveCurrentSearch: 'Ctrl+Shift+K',
        openSavedSearches: 'Ctrl+Alt+K',
        addField: 'Alt+Shift+F',
        done: 'Alt+Shift+O',
        addEntry: 'Alt+Shift+A',
        attachFile: 'Alt+Shift+T',
        openProject: 'Ctrl+O',
        saveProject: 'Ctrl+S',
        saveProjectAs: 'Ctrl+Shift+S',
        importData: 'Ctrl+Shift+I',
        newProjectWorkspace: 'Ctrl+Alt+N',
        openProjectWorkspace: 'Ctrl+Alt+O',
        openRecentProjectWorkspace: '',
        continueWorking: 'Ctrl+Alt+R',
        closeProjectWorkspace: 'Alt+Ctrl+Shift+C',
        saveProjectWorkspace: 'Ctrl+Alt+S',
        saveProjectWorkspaceAs: 'Ctrl+Alt+Shift+S',
        renameProjectWorkspace: '',
        duplicateProjectWorkspace: '',
        importProjectWorkspace: '',
        exportProjectWorkspace: '',
        deleteProjectWorkspace: '',
        addProjectAsset: 'Ctrl+Alt+A',
        createAssetFolder: '',
        removeProjectAsset: '',
        refreshWorkspaceAssets: '',
        openProjectProperties: 'Ctrl+Alt+P',
        openResourceRelationships: '',
        openResourceDependents: '',
        openResourceReferences: '',
        previewResourceDeletionImpact: '',
        repairWorkspaceRelationships: '',
        openTagManager: '',
        createTag: '',
        assignTagToSelectedResource: '',
        removeTagFromSelectedResource: '',
        mergeTags: '',
        openCollectionManager: '',
        createCollection: '',
        addSelectedResourceToCollection: '',
        removeSelectedResourceFromCollection: '',
        openSavedViewManager: '',
        createSavedViewFromCurrentWorkingView: '',
        openSavedView: '',
        deleteSavedView: '',
        exportResourceOrganizationMetadata: '',
        importResourceOrganizationMetadata: '',
        toggleTagFavorite: '',
        toggleCollectionFavorite: '',
        toggleSavedViewFavorite: '',
        openProjectStatistics: '',
        openWorkspaceSettings: '',
        openReport: '',
        exportReport: 'Ctrl+Shift+E',
        newReport: 'Alt+N',
        newReportFromTemplate: 'Ctrl+Shift+N',
        resetLookup: 'Alt+Shift+D',
        closeReport: 'Alt+Shift+C',
        configureReport: '',
        openPresentationDesigner: '',
        presentationApplyDetailedAuditLayout: '',
        presentationApplyExecutiveLayout: '',
        presentationApplyDefaultTheme: '',
        presentationApplyHighContrastTheme: '',
        presentationApplyDefaultBranding: '',
        presentationCyclePreviewMode: '',
        presentationValidate: '',
        renameReport: '',
        replaceReport: '',
        editReport: '',
        viewReport: '',
        deleteReport: '',
        newTemplate: '',
        useTemplate: '',
        openTemplate: '',
        renameTemplate: '',
        replaceTemplate: '',
        editTemplate: '',
        deleteTemplate: '',
        importTemplate: '',
        exportTemplate: '',
        openSettings: '',
        settingsClose: '',
        settingsRestoreShortcuts: '',
        settingsImportStandard: '',
        settingsPasteStandardTable: '',
        settingsImportReportFile: '',
        settingsImportTemplateFile: '',
        settingsOpenIntegrations: '',
        settingsCustomizeAnalytics: '',
        settingsCustomizeCollaboration: '',
        toggleCollaboration: '',
        toggleCollaborationToolbar: '',
        settingsCollaborationApplySoloDefaults: '',
        settingsCollaborationApplyTeamDefaults: '',
        settingsCollaborationResetBaseline: '',
        settingsCollaborationRecordSyncCheckpoint: '',
        settingsCollaborationGenerateDiscoverySnapshot: '',
        settingsCollaborationQueueTestConflict: '',
        settingsCollaborationResolveOldestConflict: '',
        settingsCollaborationRegisterPresenceSession: '',
        settingsCollaborationClearSessions: '',
        settingsCollaborationLiveQuickStart: '',
        settingsCollaborationLiveConnect: '',
        settingsCollaborationLiveDisconnect: '',
        settingsCollaborationLiveStartSession: '',
        settingsCollaborationPublishAsyncSnapshot: '',
        settingsCollaborationPullAsyncSnapshot: '',
        settingsPluginInstall: '',
        settingsPluginValidate: '',
        settingsPluginRefresh: '',
        settingsPluginExportConfig: '',
        settingsPluginImportConfig: '',
        settingsTogglePrivacyMode: '',
        settingsCreateBackup: '',
        settingsResetApp: '',
        settingsCloseReport: '',
        copyEntry: '',
        copyName: '',
        copyDescription: '',
        copyFailures: '',
        copyFixes: '',
        copyLink: ''
    },
    importedStandards: [],
    spellUserDictionary: [],
    branding: {
        enabled: false,
        headerText: "",
        headerHtml: "",
        footerHtml: "",
        headerImages: [],
        footerImages: [],
        pageMargins: {
            top: 48,
            right: 48,
            bottom: 48,
            left: 48
        },
        showPageNumbers: true,
        primaryColor: "#005a9c",
        logoDataUrl: "",
        logoAltText: "",
        logoDecorative: false,
        logoFileName: ""
    },
    presentation: {
        resourceLibrary: {
            layouts: [],
            themes: [],
            brandings: [],
            publishingProfiles: []
        },
        selection: {
            layoutId: 'layout-detailed-accessibility-audit',
            themeId: 'theme-art-accessible-default',
            brandingId: '',
            publishingProfileId: ''
        },
        reportPresentation: {
            allowOverrides: true,
            layoutOverride: null,
            themeOverride: null,
            brandingOverride: null
        },
        preview: {
            mode: 'screen',
            lastValidatedAt: '',
            validationMessages: []
        },
        ui: {
            expandedSections: {
                layout: false,
                theme: false,
                branding: false,
                header: false,
                footer: false,
                coverPage: false,
                tableOfContents: false,
                pageNumbering: false,
                accessibility: false,
                advanced: false
            }
        }
    },
    integrations: {
        jira: {
            status: 'disconnected'
        },
        githubIssues: {
            status: 'disconnected'
        },
        azureDevOps: {
            status: 'disconnected'
        }
    },
    projectDocument: {
        fileName: '',
        filePath: '',
        formatVersion: '1.0',
        schemaVersion: '1.0',
        createdWith: '',
        lastSavedWith: '',
        createdAt: '',
        lastModifiedAt: '',
        recoveryLabel: '',
        hasRecoveredChanges: false
    },
    recentProjectFiles: [],
    hasUnsavedChanges: false,
    security: {
        privacyModeEnabled: false,
        networkActivityStatus: 'Offline',
        networkActivityDetail: 'No external connection activity.',
        backup: {
            autoEnabled: false,
            frequency: 'weekly',
            retention: 5
        },
        restorePoints: [],
        auditLog: []
    },
    visualAccessibility: {
        activeProfile: 'Default',
        customProfiles: [],
        theme: 'light',
        zoom: 100,
        fontSize: 100,
        density: 'standard',
        enhancedFocusIndicators: false,
        reducedMotion: false,
        borderVisibility: false,
        followSystemTheme: false
    },
    dashboard: {
        layout: 'cards',
        widgetOrder: [
            'quick-actions',
            'continue-working',
            'current-project',
            'current-report',
            'report-metrics',
            'dashboard-analytics',
            'recent-activity',
            'notifications',
            'dashboard-search'
        ],
        visibleWidgetIds: [
            'quick-actions',
            'continue-working',
            'current-project',
            'current-report',
            'report-metrics',
            'dashboard-analytics',
            'organization-statistics',
            'recent-activity',
            'notifications',
            'dashboard-search'
        ],
        collapsedWidgets: {},
        tabs: [
            {
                id: 'workspace',
                name: 'Workspace',
                widgetIds: ['quick-actions', 'continue-working', 'recent-activity', 'notifications', 'dashboard-search']
            },
            {
                id: 'projects',
                name: 'Projects',
                widgetIds: ['current-project']
            },
            {
                id: 'reports',
                name: 'Reports',
                widgetIds: ['current-report', 'report-metrics']
            },
            {
                id: 'analytics',
                name: 'Analytics',
                widgetIds: ['dashboard-analytics', 'recent-activity']
            }
        ],
        customWidgets: []
    },
    analytics: {
        defaultScope: 'auto',
        expandedSections: [],
        displayOptions: {
            showPercentages: true,
            showTrendPlaceholders: true,
            showPluginSections: true,
            showUnrelatedReportTrends: false
        },
        accessibilityOptions: {
            announceScopeChanges: true,
            emphasizeSectionDescriptions: true
        }
    },
    collaboration: {
        enabled: false,
        showToolbar: false,
        toolbarPosition: 'top-right',
        mode: 'independent',
        providerId: 'local',
        providerName: 'Local collaboration',
        providerStatus: 'available',
        providerCapabilities: {
            sharedWorkspaces: true,
            asynchronousCollaboration: true,
            synchronizedCollaboration: false,
            realtimeEditing: false,
            comments: true,
            sharing: false,
            permissions: false,
            versionHistory: false,
            presence: false,
            synchronization: false,
            offline: true
        },
        resourceDefaults: {
            owner: '',
            visibility: 'private',
            permissionProfile: 'Private',
            sharing: [],
            auditHistory: []
        },
        permissions: {
            profiles: [],
            assignments: []
        },
        sharing: {
            discoveryScope: 'workspace',
            allowDirectoryListing: false,
            requireApproval: true,
            allowGuestLinks: false,
            defaultExpiryDays: 30,
            channels: []
        },
        synchronization: {
            enabled: false,
            mode: 'manual',
            conflictStrategy: 'manual-review',
            autoMergeComments: true,
            autoMergeMetadata: false,
            keepVersionHistory: true,
            maxVersionsPerResource: 20,
            lastSyncAt: '',
            pendingConflicts: []
        },
        live: {
            serverUrl: 'ws://localhost:8787/art-live',
            autoConnect: false,
            connectionState: 'offline',
            lastConnectedAt: '',
            lastError: '',
            sessionName: 'Live Session'
        },
        sessions: [],
        auditHistory: []
    },
    workspaceView: {
        active: 'dashboard',
        defaultView: 'dashboard',
        rememberLastView: false,
        explorer: {
            width: 320,
            showResourceIcons: true,
            showResourceBadges: true,
            showRecentResources: true,
            showFavorites: true,
            showSavedSearches: true,
            autoExpandParents: true,
            restoreExpansionState: true,
            restoreSelectedResource: true,
            restoreFocus: true,
            restoreScrollPosition: true,
            restoreContext: true,
            expandedResourceIds: [],
            selectedResourceId: '',
            focusedResourceId: '',
            scrollTop: 0,
            lastContextKind: '',
            favorites: [],
            recentResources: []
        }
    },
    resourceOrganization: {
        frameworkVersion: '1.0.0',
        tags: [],
        collections: [],
        savedViews: [],
        favorites: {
            tags: [],
            collections: [],
            savedViews: []
        },
        recent: {
            collections: [],
            savedViews: []
        },
        unresolvedReferences: []
    },
    workspaces: [],
    activeWorkspaceId: '',
    recentProjectWorkspaces: [],
    universalSearch: {
        scopePreference: 'auto',
        defaultScopeOverride: '',
        history: [],
        savedSearches: [],
        collections: [],
        favorites: [],
        providers: [],
        activeSession: {
            id: '',
            query: '',
            scope: 'workspace',
            filters: {},
            sortBy: 'relevance',
            sortDirection: 'desc',
            results: [],
            selectedResultIndex: -1,
            selectedMatchIndex: 0,
            navigationHistory: [],
            highlights: [],
            resultCounts: {}
        },
        indexStatus: {
            lastIndexedAt: '',
            providerStatuses: {},
            isIndexing: false,
            indexedItemCount: 0
        },
        analytics: {
            enabled: true,
            totalSearches: 0,
            noResultSearches: 0,
            resultSelections: 0,
            totalDurationMs: 0,
            providerStats: {},
            lastUpdatedAt: ''
        }
    },
    navigationHistory: {
        enabled: true,
        breadcrumbsEnabled: true,
        maxEntries: 50,
        entries: [],
        currentIndex: -1
    },
    organizationMetrics: {
        enabled: false,
        dashboardSectionVisible: true,
        selectedOrganization: '',
        activeTab: 'overview',
        visibleTabs: [],
        defaultDateRange: 'all',
        showProductAnalytics: true,
        showTesterAnalytics: true,
        showRecurrenceAnalytics: true,
        showAccessibilityHealth: true,
        showBenchmarking: true
    }
};

const reportDefaults = {
    reportTitle: defaultState.reportTitle,
    orgClient: defaultState.orgClient,
    product: defaultState.product,
    projectName: defaultState.projectName,
    scopeUrl: defaultState.scopeUrl,
    auditDateStart: defaultState.auditDateStart,
    auditDateEnd: defaultState.auditDateEnd,
    auditors: defaultState.auditors,
    standard: defaultState.standard,
    testingInstructions: defaultState.testingInstructions,
    reportType: defaultState.reportType,
    reportLayout: defaultState.reportLayout,
    fieldsExpanded: defaultState.fieldsExpanded,
    templateOption: defaultState.templateOption,
    templateName: defaultState.templateName,
    templateDescription: defaultState.templateDescription,
    progressLogEnabled: defaultState.progressLogEnabled,
    progressLogAppendixEnabled: defaultState.progressLogAppendixEnabled,
    progressItems: defaultState.progressItems,
    fields: defaultState.fields,
    branding: defaultState.branding,
    presentation: defaultState.presentation
};

const DEFAULT_PROGRESS_ITEM_TYPES = ['Page', 'Screen', 'Component', 'Flow', 'Document'];
const DEFAULT_PROGRESS_STATUSES = [
    'Not Started',
    'In Progress',
    'On Hold',
    'Blocked',
    'Needs Review',
    'Retest Required',
    'Not Applicable',
    'Complete'
];

function normalizeProgressLogEnabled(value, reportType) {
    if (String(reportType || '').trim() !== 'Audit Log') return false;
    return value !== false;
}

function normalizeProgressLogAppendixEnabled(value, reportType) {
    if (String(reportType || '').trim() !== 'Audit Log') return false;
    return value !== false;
}

function normalizeProgressItemType(value) {
    const text = String(value || '').trim();
    return text || DEFAULT_PROGRESS_ITEM_TYPES[0];
}

function normalizeProgressItemStatus(value) {
    const text = String(value || '').trim();
    return DEFAULT_PROGRESS_STATUSES.includes(text) ? text : 'Not Started';
}

function normalizeIsoDateTime(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeProgressItem(item, index) {
    const status = normalizeProgressItemStatus(item?.status);
    const started = normalizeIsoDateTime(item?.dateStarted);
    const completed = normalizeIsoDateTime(item?.dateCompleted);
    const findingsCount = Number(item?.findingsCount);

    return {
        id: String(item?.id || `progress-${Date.now()}-${index}`),
        name: String(item?.name || item?.evaluationItemName || '').trim(),
        type: normalizeProgressItemType(item?.type),
        location: String(item?.location || item?.url || item?.urlLocation || '').trim(),
        status,
        notes: String(item?.notes || '').trim(),
        findingsCount: Number.isFinite(findingsCount) ? Math.max(0, Math.round(findingsCount)) : 0,
        assignedTester: String(item?.assignedTester || '').trim(),
        dateStarted: status !== 'Not Started' && status !== 'Not Applicable' ? (started || new Date().toISOString()) : '',
        dateCompleted: status === 'Complete' ? (completed || new Date().toISOString()) : ''
    };
}

function normalizeProgressItems(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => normalizeProgressItem(item, index));
}

function normalizeBrandingImage(image, index = 0) {
    const source = image && typeof image === 'object' ? image : {};
    const id = String(source.id || `branding-image-${Date.now()}-${index}`).trim() || `branding-image-${Date.now()}-${index}`;
    const dataUrl = String(source.dataUrl || source.src || '').trim();
    const fileName = String(source.fileName || '').trim();
    const altText = String(source.altText || source.alt || '').trim();
    const alignmentRaw = String(source.alignment || 'inline').trim().toLowerCase();
    const alignment = ['inline', 'left', 'center', 'right'].includes(alignmentRaw) ? alignmentRaw : 'inline';
    const spacingRaw = Number(source.spacing);
    const maxDisplayWidthRaw = Number(source.maxDisplayWidth ?? source.maxWidth);
    const maxDisplayHeightRaw = Number(source.maxDisplayHeight ?? source.maxHeight);

    return {
        id,
        dataUrl,
        fileName,
        altText,
        alignment,
        spacing: Number.isFinite(spacingRaw) ? Math.max(0, Math.min(64, Math.round(spacingRaw))) : 8,
        maxDisplayWidth: Number.isFinite(maxDisplayWidthRaw) ? Math.max(24, Math.min(2000, Math.round(maxDisplayWidthRaw))) : 160,
        maxDisplayHeight: Number.isFinite(maxDisplayHeightRaw) ? Math.max(24, Math.min(2000, Math.round(maxDisplayHeightRaw))) : 80
    };
}

function normalizeBrandingImages(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((image, index) => normalizeBrandingImage(image, index))
        .filter((image) => String(image.dataUrl || '').trim());
}

function normalizeBrandingMargins(margins) {
    const source = margins && typeof margins === 'object' ? margins : {};
    const fallback = defaultState.branding.pageMargins || { top: 48, right: 48, bottom: 48, left: 48 };
    const normalize = (value, fallbackValue) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallbackValue;
        return Math.max(0, Math.min(200, Math.round(parsed)));
    };

    return {
        top: normalize(source.top, fallback.top),
        right: normalize(source.right, fallback.right),
        bottom: normalize(source.bottom, fallback.bottom),
        left: normalize(source.left, fallback.left)
    };
}

function getBrandingAltValidationMessage(branding) {
    const source = normalizeBranding(branding);
    const imageCollections = [
        ...(Array.isArray(source.headerImages) ? source.headerImages : []),
        ...(Array.isArray(source.footerImages) ? source.footerImages : [])
    ];

    const hasMissingImageAlt = imageCollections.some((image) => {
        const hasImage = String(image?.dataUrl || '').trim() !== '';
        return hasImage && !String(image?.altText || '').trim();
    });
    if (hasMissingImageAlt) {
        return 'Alternative text is required for every branding image.';
    }

    if (source.enabled && source.logoDataUrl && !source.logoDecorative && !String(source.logoAltText || '').trim()) {
        return 'Logo alternative text is required when logo is not decorative.';
    }

    return '';
}

function normalizeBranding(branding) {
    const toBool = (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return Boolean(value);
    };

    const rawColor = String(branding?.primaryColor || defaultState.branding.primaryColor);
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : defaultState.branding.primaryColor;
    const headerImages = normalizeBrandingImages(branding?.headerImages);
    const footerImages = normalizeBrandingImages(branding?.footerImages);

    if (headerImages.length === 0 && String(branding?.logoDataUrl || '').trim()) {
        headerImages.push(normalizeBrandingImage({
            id: 'branding-legacy-logo',
            dataUrl: branding.logoDataUrl,
            fileName: String(branding.logoFileName || '').trim(),
            altText: String(branding.logoDecorative ? '' : (branding.logoAltText || '')).trim(),
            alignment: 'left',
            spacing: 8,
            maxDisplayWidth: 160,
            maxDisplayHeight: 80
        }, 0));
    }

    return {
        ...defaultState.branding,
        ...(branding && typeof branding === 'object' ? branding : {}),
        enabled: toBool(branding?.enabled),
        headerText: String(branding?.headerText || ''),
        headerHtml: String(branding?.headerHtml || ''),
        footerHtml: String(branding?.footerHtml || ''),
        headerImages,
        footerImages,
        pageMargins: normalizeBrandingMargins(branding?.pageMargins),
        showPageNumbers: toBool(branding?.showPageNumbers ?? defaultState.branding.showPageNumbers),
        primaryColor: safeColor,
        logoDataUrl: String(branding?.logoDataUrl || ''),
        logoAltText: String(branding?.logoAltText || ''),
        logoDecorative: toBool(branding?.logoDecorative),
        logoFileName: String(branding?.logoFileName || '')
    };
}

function normalizeStandardValue(value) {
    const normalized = String(value || '').trim();
    return normalized || defaultState.standard;
}

function normalizeIntegrationStatus(value) {
    const status = String(value || 'disconnected').trim().toLowerCase();
    const allowed = new Set(['disconnected', 'connected', 'authorization-required', 'connection-failed']);
    return allowed.has(status) ? status : 'disconnected';
}

function normalizeIntegrationsConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    return {
        jira: {
            status: normalizeIntegrationStatus(source?.jira?.status)
        },
        githubIssues: {
            status: normalizeIntegrationStatus(source?.githubIssues?.status)
        },
        azureDevOps: {
            status: normalizeIntegrationStatus(source?.azureDevOps?.status)
        }
    };
}

function normalizeSecurityConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const backupSource = source.backup && typeof source.backup === 'object' ? source.backup : {};
    const frequency = String(backupSource.frequency || defaultState.security.backup.frequency).trim().toLowerCase();
    const allowedFrequencies = new Set(['daily', 'weekly', 'monthly']);
    const retentionNumber = Number(backupSource.retention);

    return {
        privacyModeEnabled: Boolean(source.privacyModeEnabled),
        networkActivityStatus: String(source.networkActivityStatus || defaultState.security.networkActivityStatus),
        networkActivityDetail: String(source.networkActivityDetail || defaultState.security.networkActivityDetail),
        backup: {
            autoEnabled: Boolean(backupSource.autoEnabled),
            frequency: allowedFrequencies.has(frequency) ? frequency : defaultState.security.backup.frequency,
            retention: Number.isFinite(retentionNumber) ? Math.min(50, Math.max(1, Math.round(retentionNumber))) : defaultState.security.backup.retention
        },
        restorePoints: Array.isArray(source.restorePoints)
            ? source.restorePoints.map((point) => ({
                id: String(point?.id || `restore-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
                label: String(point?.label || 'Restore Point'),
                createdAt: String(point?.createdAt || new Date().toISOString()),
                projectName: String(point?.projectName || ''),
                snapshot: point?.snapshot && typeof point.snapshot === 'object' ? point.snapshot : null
            })).filter((point) => point.snapshot)
            : [],
        auditLog: Array.isArray(source.auditLog)
            ? source.auditLog.map((entry) => ({
                at: String(entry?.at || new Date().toISOString()),
                action: String(entry?.action || 'Security event'),
                detail: String(entry?.detail || '')
            }))
            : []
    };
}

function normalizeVisualAccessibilityConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const allowedThemes = new Set(['light', 'dark', 'high-contrast-light', 'high-contrast-dark', 'system']);
    const allowedDensity = new Set(['standard', 'comfortable', 'compact']);
    const theme = String(source.theme || defaultState.visualAccessibility.theme).trim().toLowerCase();
    const density = String(source.density || defaultState.visualAccessibility.density).trim().toLowerCase();
    const zoomValue = Number(source.zoom);
    const fontSizeValue = Number(source.fontSize);

    return {
        activeProfile: String(source.activeProfile || defaultState.visualAccessibility.activeProfile || 'Default').trim() || 'Default',
        customProfiles: Array.isArray(source.customProfiles) ? source.customProfiles.map((profile) => String(profile || '').trim()).filter(Boolean) : [],
        theme: allowedThemes.has(theme) ? theme : defaultState.visualAccessibility.theme,
        zoom: Number.isFinite(zoomValue) ? Math.min(200, Math.max(80, Math.round(zoomValue))) : defaultState.visualAccessibility.zoom,
        fontSize: Number.isFinite(fontSizeValue) ? Math.min(200, Math.max(80, Math.round(fontSizeValue))) : defaultState.visualAccessibility.fontSize,
        density: allowedDensity.has(density) ? density : defaultState.visualAccessibility.density,
        enhancedFocusIndicators: Boolean(source.enhancedFocusIndicators),
        reducedMotion: Boolean(source.reducedMotion),
        borderVisibility: Boolean(source.borderVisibility),
        followSystemTheme: Boolean(source.followSystemTheme)
    };
}

function normalizeProjectDocumentConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    return {
        fileName: String(source.fileName || ''),
        filePath: String(source.filePath || ''),
        formatVersion: String(source.formatVersion || '1.0'),
        schemaVersion: String(source.schemaVersion || '1.0'),
        createdWith: String(source.createdWith || ''),
        lastSavedWith: String(source.lastSavedWith || ''),
        createdAt: String(source.createdAt || ''),
        lastModifiedAt: String(source.lastModifiedAt || ''),
        recoveryLabel: String(source.recoveryLabel || ''),
        hasRecoveredChanges: Boolean(source.hasRecoveredChanges)
    };
}

function normalizeRecentProjectFile(item) {
    return {
        id: String(item?.id || `project-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
        fileName: String(item?.fileName || ''),
        filePath: String(item?.filePath || ''),
        lastOpenedAt: String(item?.lastOpenedAt || new Date().toISOString()),
        status: String(item?.status || 'saved')
    };
}

function normalizeRecentProjectFiles(list) {
    if (!Array.isArray(list)) return [];
    const normalized = list.map(normalizeRecentProjectFile);
    return normalized.slice(0, 25);
}

function normalizeDashboardConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const allowedLayouts = new Set(['cards', 'tabs', 'compact']);
    const defaultWidgetOrder = [...defaultState.dashboard.widgetOrder];
    const defaultVisibleWidgetIds = [...defaultState.dashboard.visibleWidgetIds];
    const defaultTabs = defaultState.dashboard.tabs.map((tab) => ({ ...tab, widgetIds: [...tab.widgetIds] }));

    const mergeUnique = (primary = [], fallback = []) => {
        const seen = new Set();
        return [...primary, ...fallback].filter((value) => {
            const key = String(value || '').trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const widgetOrder = mergeUnique(
        Array.isArray(source.widgetOrder)
            ? source.widgetOrder.map((value) => String(value || '').trim()).filter(Boolean)
            : [],
        defaultWidgetOrder
    );

    const visibleWidgetIds = mergeUnique(
        Array.isArray(source.visibleWidgetIds)
            ? source.visibleWidgetIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [],
        defaultVisibleWidgetIds
    );

    const collapsedWidgets = source.collapsedWidgets && typeof source.collapsedWidgets === 'object'
        ? Object.fromEntries(Object.entries(source.collapsedWidgets).map(([key, value]) => [String(key), Boolean(value)]))
        : {};

    const tabsSource = Array.isArray(source.tabs) && source.tabs.length > 0
        ? source.tabs
        : defaultTabs;
    const tabs = tabsSource.map((tab, index) => {
        const fallbackTab = defaultTabs[index] || { id: `tab-${index + 1}`, name: `Tab ${index + 1}`, widgetIds: [] };
        return {
            id: String(tab?.id || fallbackTab.id || `tab-${index + 1}`).trim() || `tab-${index + 1}`,
            name: String(tab?.name || fallbackTab.name || `Tab ${index + 1}`).trim() || `Tab ${index + 1}`,
            widgetIds: mergeUnique(
                Array.isArray(tab?.widgetIds)
                    ? tab.widgetIds.map((value) => String(value || '').trim()).filter(Boolean)
                    : [],
                Array.isArray(fallbackTab.widgetIds) ? fallbackTab.widgetIds : []
            )
        };
    });

    const customWidgets = Array.isArray(source.customWidgets)
        ? source.customWidgets.map((item, index) => ({
            id: String(item?.id || `custom-widget-${Date.now()}-${index}`).trim() || `custom-widget-${Date.now()}-${index}`,
            kind: 'custom',
            name: String(item?.name || item?.heading || `Custom Widget ${index + 1}`).trim() || `Custom Widget ${index + 1}`,
            heading: String(item?.heading || item?.name || `Custom Widget ${index + 1}`).trim() || `Custom Widget ${index + 1}`,
            regionLabel: String(item?.regionLabel || '').trim(),
            description: String(item?.description || '').trim(),
            category: String(item?.category || 'Custom').trim() || 'Custom',
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : 5000 + index,
            refreshPolicy: String(item?.refreshPolicy || 'manual').trim() || 'manual',
            helpTopic: String(item?.helpTopic || '').trim(),
            minimumVersion: String(item?.minimumVersion || '2.0').trim() || '2.0',
            markdown: String(item?.markdown || ''),
            commandAction: String(item?.commandAction || '').trim(),
            linkUrl: String(item?.linkUrl || '').trim(),
            linkText: String(item?.linkText || '').trim()
        }))
        : [];

    return {
        layout: allowedLayouts.has(String(source.layout || '').trim()) ? String(source.layout).trim() : defaultState.dashboard.layout,
        widgetOrder,
        visibleWidgetIds,
        collapsedWidgets,
        tabs,
        customWidgets
    };
}

function normalizeAnalyticsConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const allowedScopes = new Set(['auto', 'report', 'workspace']);
    const defaultScope = String(source.defaultScope || defaultState.analytics.defaultScope).trim().toLowerCase();
    const expandedSections = Array.isArray(source.expandedSections)
        ? [...new Set(source.expandedSections.map((value) => String(value || '').trim()).filter(Boolean))]
        : [...defaultState.analytics.expandedSections];

    const displaySource = source.displayOptions && typeof source.displayOptions === 'object'
        ? source.displayOptions
        : {};
    const accessibilitySource = source.accessibilityOptions && typeof source.accessibilityOptions === 'object'
        ? source.accessibilityOptions
        : {};

    return {
        defaultScope: allowedScopes.has(defaultScope) ? defaultScope : defaultState.analytics.defaultScope,
        expandedSections,
        displayOptions: {
            showPercentages: displaySource.showPercentages !== false,
            showTrendPlaceholders: displaySource.showTrendPlaceholders !== false,
            showPluginSections: displaySource.showPluginSections !== false,
            showUnrelatedReportTrends: displaySource.showUnrelatedReportTrends === true
        },
        accessibilityOptions: {
            announceScopeChanges: accessibilitySource.announceScopeChanges !== false,
            emphasizeSectionDescriptions: accessibilitySource.emphasizeSectionDescriptions !== false
        }
    };
}

function normalizeCollaborationCapabilities(capabilities) {
    const source = capabilities && typeof capabilities === 'object' ? capabilities : {};
    return {
        sharedWorkspaces: source.sharedWorkspaces !== false,
        asynchronousCollaboration: source.asynchronousCollaboration !== false,
        synchronizedCollaboration: Boolean(source.synchronizedCollaboration),
        realtimeEditing: Boolean(source.realtimeEditing),
        comments: Boolean(source.comments),
        sharing: Boolean(source.sharing),
        permissions: Boolean(source.permissions),
        versionHistory: Boolean(source.versionHistory),
        presence: Boolean(source.presence),
        synchronization: Boolean(source.synchronization),
        offline: source.offline !== false
    };
}

function normalizeCollaborationConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const allowedModes = new Set(['independent', 'asynchronous', 'synchronous', 'realtime']);
    const allowedPositions = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    const allowedVisibility = new Set(['private', 'shared', 'workspace', 'organization', 'public']);
    const allowedDiscoveryScopes = new Set(['resource', 'workspace', 'organization']);
    const allowedSyncModes = new Set(['manual', 'scheduled', 'realtime']);
    const allowedConflictStrategies = new Set(['manual-review', 'latest-write-wins', 'metadata-priority', 'comments-append']);

    return {
        enabled: Boolean(source.enabled),
        showToolbar: Boolean(source.showToolbar),
        toolbarPosition: allowedPositions.has(String(source.toolbarPosition || defaultState.collaboration.toolbarPosition).trim())
            ? String(source.toolbarPosition || defaultState.collaboration.toolbarPosition).trim()
            : defaultState.collaboration.toolbarPosition,
        mode: allowedModes.has(String(source.mode || defaultState.collaboration.mode).trim())
            ? String(source.mode || defaultState.collaboration.mode).trim()
            : defaultState.collaboration.mode,
        providerId: String(source.providerId || defaultState.collaboration.providerId).trim() || defaultState.collaboration.providerId,
        providerName: String(source.providerName || defaultState.collaboration.providerName).trim() || defaultState.collaboration.providerName,
        providerStatus: String(source.providerStatus || defaultState.collaboration.providerStatus).trim() || defaultState.collaboration.providerStatus,
        providerCapabilities: normalizeCollaborationCapabilities(source.providerCapabilities),
        resourceDefaults: {
            owner: String(source.resourceDefaults?.owner || '').trim(),
            visibility: allowedVisibility.has(String(source.resourceDefaults?.visibility || defaultState.collaboration.resourceDefaults.visibility).trim())
                ? String(source.resourceDefaults?.visibility || defaultState.collaboration.resourceDefaults.visibility).trim()
                : defaultState.collaboration.resourceDefaults.visibility,
            permissionProfile: String(source.resourceDefaults?.permissionProfile || defaultState.collaboration.resourceDefaults.permissionProfile).trim() || defaultState.collaboration.resourceDefaults.permissionProfile,
            sharing: Array.isArray(source.resourceDefaults?.sharing)
                ? source.resourceDefaults.sharing.map((value) => String(value || '').trim()).filter(Boolean)
                : [],
            auditHistory: Array.isArray(source.resourceDefaults?.auditHistory)
                ? source.resourceDefaults.auditHistory.map((entry) => ({
                    at: String(entry?.at || ''),
                    action: String(entry?.action || 'Collaboration event'),
                    detail: String(entry?.detail || '')
                }))
                : []
        },
        permissions: {
            profiles: Array.isArray(source.permissions?.profiles)
                ? source.permissions.profiles.map((profile) => ({
                    id: String(profile?.id || '').trim(),
                    name: String(profile?.name || '').trim(),
                    permissions: Array.isArray(profile?.permissions) ? profile.permissions.map((item) => String(item || '').trim()).filter(Boolean) : []
                })).filter((profile) => profile.id || profile.name)
                : [],
            assignments: Array.isArray(source.permissions?.assignments)
                ? source.permissions.assignments.map((assignment) => ({
                    resourceType: String(assignment?.resourceType || '').trim(),
                    resourceId: String(assignment?.resourceId || '').trim(),
                    principalId: String(assignment?.principalId || '').trim(),
                    principalType: String(assignment?.principalType || 'user').trim(),
                    visibility: allowedVisibility.has(String(assignment?.visibility || '').trim()) ? String(assignment?.visibility || '').trim() : '',
                    permissions: Array.isArray(assignment?.permissions) ? assignment.permissions.map((item) => String(item || '').trim()).filter(Boolean) : [],
                    inheritedFrom: String(assignment?.inheritedFrom || '').trim(),
                    source: String(assignment?.source || '').trim()
                })).filter((assignment) => assignment.resourceType || assignment.resourceId || assignment.principalId)
                : []
        },
        sharing: {
            discoveryScope: allowedDiscoveryScopes.has(String(source.sharing?.discoveryScope || defaultState.collaboration.sharing.discoveryScope).trim())
                ? String(source.sharing?.discoveryScope || defaultState.collaboration.sharing.discoveryScope).trim()
                : defaultState.collaboration.sharing.discoveryScope,
            allowDirectoryListing: Boolean(source.sharing?.allowDirectoryListing),
            requireApproval: source.sharing?.requireApproval !== false,
            allowGuestLinks: Boolean(source.sharing?.allowGuestLinks),
            defaultExpiryDays: Number.isFinite(Number(source.sharing?.defaultExpiryDays))
                ? Math.max(1, Math.min(3650, Number(source.sharing.defaultExpiryDays)))
                : defaultState.collaboration.sharing.defaultExpiryDays,
            channels: Array.isArray(source.sharing?.channels)
                ? source.sharing.channels.map((channel) => String(channel || '').trim()).filter(Boolean)
                : []
        },
        synchronization: {
            enabled: Boolean(source.synchronization?.enabled),
            mode: allowedSyncModes.has(String(source.synchronization?.mode || defaultState.collaboration.synchronization.mode).trim())
                ? String(source.synchronization?.mode || defaultState.collaboration.synchronization.mode).trim()
                : defaultState.collaboration.synchronization.mode,
            conflictStrategy: allowedConflictStrategies.has(String(source.synchronization?.conflictStrategy || defaultState.collaboration.synchronization.conflictStrategy).trim())
                ? String(source.synchronization?.conflictStrategy || defaultState.collaboration.synchronization.conflictStrategy).trim()
                : defaultState.collaboration.synchronization.conflictStrategy,
            autoMergeComments: source.synchronization?.autoMergeComments !== false,
            autoMergeMetadata: Boolean(source.synchronization?.autoMergeMetadata),
            keepVersionHistory: source.synchronization?.keepVersionHistory !== false,
            maxVersionsPerResource: Number.isFinite(Number(source.synchronization?.maxVersionsPerResource))
                ? Math.max(1, Math.min(500, Number(source.synchronization.maxVersionsPerResource)))
                : defaultState.collaboration.synchronization.maxVersionsPerResource,
            lastSyncAt: String(source.synchronization?.lastSyncAt || '').trim(),
            pendingConflicts: Array.isArray(source.synchronization?.pendingConflicts)
                ? source.synchronization.pendingConflicts.map((conflict, index) => ({
                    id: String(conflict?.id || `conflict-${index + 1}`).trim(),
                    resourceType: String(conflict?.resourceType || '').trim(),
                    resourceId: String(conflict?.resourceId || '').trim(),
                    workspaceId: String(conflict?.workspaceId || '').trim(),
                    summary: String(conflict?.summary || '').trim(),
                    strategy: String(conflict?.strategy || 'manual-review').trim() || 'manual-review',
                    status: String(conflict?.status || 'pending').trim() || 'pending',
                    detectedAt: String(conflict?.detectedAt || '').trim(),
                    resolvedAt: String(conflict?.resolvedAt || '').trim(),
                    metadata: conflict?.metadata && typeof conflict.metadata === 'object' ? { ...conflict.metadata } : {}
                })).filter((conflict) => conflict.id)
                : []
        },
        live: {
            serverUrl: String(source.live?.serverUrl || defaultState.collaboration.live.serverUrl).trim() || defaultState.collaboration.live.serverUrl,
            autoConnect: Boolean(source.live?.autoConnect),
            connectionState: String(source.live?.connectionState || defaultState.collaboration.live.connectionState).trim() || defaultState.collaboration.live.connectionState,
            lastConnectedAt: String(source.live?.lastConnectedAt || '').trim(),
            lastError: String(source.live?.lastError || '').trim(),
            sessionName: String(source.live?.sessionName || defaultState.collaboration.live.sessionName).trim() || defaultState.collaboration.live.sessionName
        },
        sessions: Array.isArray(source.sessions)
            ? source.sessions.map((session, index) => ({
                id: String(session?.id || `collaboration-session-${index + 1}`).trim(),
                resourceType: String(session?.resourceType || '').trim(),
                resourceId: String(session?.resourceId || '').trim(),
                userId: String(session?.userId || '').trim(),
                state: String(session?.state || 'inactive').trim(),
                providerId: String(session?.providerId || '').trim(),
                connectionState: String(session?.connectionState || 'offline').trim(),
                startedAt: String(session?.startedAt || ''),
                lastActivityAt: String(session?.lastActivityAt || ''),
                metadata: session?.metadata && typeof session.metadata === 'object' ? { ...session.metadata } : {}
            }))
            : [],
        auditHistory: Array.isArray(source.auditHistory)
            ? source.auditHistory.map((entry) => ({
                at: String(entry?.at || ''),
                action: String(entry?.action || 'Collaboration event'),
                detail: String(entry?.detail || '')
            }))
            : []
    };
}

function normalizeWorkspaceAsset(asset, index = 0) {
    const source = asset && typeof asset === 'object' ? asset : {};
    const now = new Date().toISOString();
    const id = String(source.id || `asset-${Date.now()}-${index}`).trim() || `asset-${Date.now()}-${index}`;
    return {
        id,
        title: String(source.title || source.fileName || `Asset ${index + 1}`).trim() || `Asset ${index + 1}`,
        fileName: String(source.fileName || '').trim(),
        extension: String(source.extension || '').trim(),
        mimeType: String(source.mimeType || '').trim(),
        category: String(source.category || 'Other').trim() || 'Other',
        description: String(source.description || '').trim(),
        dateAdded: String(source.dateAdded || now),
        lastModified: String(source.lastModified || now),
        addedBy: String(source.addedBy || '').trim(),
        tags: Array.isArray(source.tags) ? source.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
        linkedReportIds: Array.isArray(source.linkedReportIds)
            ? source.linkedReportIds.map((idValue) => String(idValue || '').trim()).filter(Boolean)
            : [],
        linkedFindingIds: Array.isArray(source.linkedFindingIds)
            ? source.linkedFindingIds.map((idValue) => String(idValue || '').trim()).filter(Boolean)
            : [],
        relativePath: String(source.relativePath || '').trim(),
        sourceFileName: String(source.sourceFileName || source.fileName || '').trim(),
        sourceSize: Number.isFinite(Number(source.sourceSize)) ? Number(source.sourceSize) : 0,
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
    };
}

function normalizeWorkspaceRelationship(relationship, index = 0) {
    const source = relationship && typeof relationship === 'object' ? relationship : {};
    return {
        id: String(source.id || `relationship-${Date.now()}-${index}`).trim() || `relationship-${Date.now()}-${index}`,
        type: String(source.type || 'resource-link').trim() || 'resource-link',
        fromType: String(source.fromType || '').trim(),
        fromId: String(source.fromId || '').trim(),
        toType: String(source.toType || '').trim(),
        toId: String(source.toId || '').trim(),
        label: String(source.label || '').trim(),
        metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
    };
}

function normalizeProjectWorkspace(workspace, index = 0) {
    const source = workspace && typeof workspace === 'object' ? workspace : {};
    const now = new Date().toISOString();
    const id = String(source.id || source.workspaceId || `workspace-${Date.now()}-${index}`).trim() || `workspace-${Date.now()}-${index}`;
    const name = String(source.name || source.projectName || `Project Workspace ${index + 1}`).trim() || `Project Workspace ${index + 1}`;
    const resources = source.resources && typeof source.resources === 'object' ? source.resources : {};
    const workspaceState = source.workspaceState && typeof source.workspaceState === 'object' ? source.workspaceState : {};
    const extensions = source.extensions && typeof source.extensions === 'object' ? source.extensions : {};
    const integrationMetadata = source.integrationMetadata && typeof source.integrationMetadata === 'object' ? source.integrationMetadata : {};
    const brandingDefaultsSource = source.brandingDefaults || integrationMetadata.brandingDefaults || null;
    const collaboration = source.collaboration && typeof source.collaboration === 'object'
        ? normalizeCollaborationConfig(source.collaboration)
        : normalizeCollaborationConfig(defaultState.collaboration);

    return {
        id,
        name,
        description: String(source.description || '').trim(),
        owner: String(source.owner || '').trim(),
        organization: String(source.organization || '').trim(),
        status: String(source.status || 'Draft').trim() || 'Draft',
        version: String(source.version || '2.0').trim() || '2.0',
        createdAt: String(source.createdAt || now),
        lastModifiedAt: String(source.lastModifiedAt || now),
        folderName: String(source.folderName || name).trim() || name,
        folderPath: String(source.folderPath || '').trim(),
        projectFileName: String(source.projectFileName || 'Project.artproj').trim() || 'Project.artproj',
        projectVersion: String(source.projectVersion || '2.0').trim() || '2.0',
        collaboration,
        associatedReportIds: Array.isArray(source.associatedReportIds)
            ? source.associatedReportIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [],
        associatedTemplateIds: Array.isArray(source.associatedTemplateIds)
            ? source.associatedTemplateIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [],
        resources: {
            reports: Array.isArray(resources.reports) ? resources.reports.map((value) => String(value || '').trim()).filter(Boolean) : [],
            templates: Array.isArray(resources.templates) ? resources.templates.map((value) => String(value || '').trim()).filter(Boolean) : [],
            auditLogs: Array.isArray(resources.auditLogs) ? resources.auditLogs.map((value) => String(value || '').trim()).filter(Boolean) : [],
            progressLogs: Array.isArray(resources.progressLogs) ? resources.progressLogs.map((value) => String(value || '').trim()).filter(Boolean) : [],
            reportLayouts: Array.isArray(resources.reportLayouts) ? resources.reportLayouts.map((value) => String(value || '').trim()).filter(Boolean) : [],
            reportThemes: Array.isArray(resources.reportThemes) ? resources.reportThemes.map((value) => String(value || '').trim()).filter(Boolean) : [],
            reportBranding: Array.isArray(resources.reportBranding) ? resources.reportBranding.map((value) => String(value || '').trim()).filter(Boolean) : [],
            publishingProfiles: Array.isArray(resources.publishingProfiles) ? resources.publishingProfiles.map((value) => String(value || '').trim()).filter(Boolean) : [],
            projectAssets: Array.isArray(resources.projectAssets) ? resources.projectAssets.map((item, itemIndex) => normalizeWorkspaceAsset(item, itemIndex)) : [],
            attachments: Array.isArray(resources.attachments) ? resources.attachments.map((item, itemIndex) => normalizeWorkspaceAsset(item, itemIndex)) : [],
            exports: Array.isArray(resources.exports) ? resources.exports.map((item) => String(item || '').trim()).filter(Boolean) : [],
            backups: Array.isArray(resources.backups) ? resources.backups.map((item) => String(item || '').trim()).filter(Boolean) : [],
            extensions: resources.extensions && typeof resources.extensions === 'object' ? { ...resources.extensions } : {}
        },
        relationships: Array.isArray(source.relationships)
            ? source.relationships.map((item, relationshipIndex) => normalizeWorkspaceRelationship(item, relationshipIndex))
            : [],
        tags: Array.isArray(source.tags) ? source.tags.map((item) => String(item || '').trim()).filter(Boolean) : [],
        presentationDefaults: source.presentationDefaults && typeof source.presentationDefaults === 'object'
            ? {
                layoutId: String(source.presentationDefaults.layoutId || '').trim(),
                themeId: String(source.presentationDefaults.themeId || '').trim(),
                brandingId: String(source.presentationDefaults.brandingId || '').trim(),
                publishingProfileId: String(source.presentationDefaults.publishingProfileId || '').trim()
            }
            : {
                layoutId: '',
                themeId: '',
                brandingId: '',
                publishingProfileId: ''
            },
        brandingDefaults: brandingDefaultsSource ? normalizeBranding(brandingDefaultsSource) : null,
        integrationMetadata: {
            ...integrationMetadata,
            ...(brandingDefaultsSource ? { brandingDefaults: normalizeBranding(brandingDefaultsSource) } : {})
        },
        pluginMetadata: source.pluginMetadata && typeof source.pluginMetadata === 'object' ? { ...source.pluginMetadata } : {},
        workspaceState: {
            openReportIds: Array.isArray(workspaceState.openReportIds)
                ? workspaceState.openReportIds.map((value) => String(value || '').trim()).filter(Boolean)
                : [],
            activeReportId: String(workspaceState.activeReportId || '').trim(),
            selectedEvaluationItem: String(workspaceState.selectedEvaluationItem || '').trim(),
            cursorPosition: workspaceState.cursorPosition && typeof workspaceState.cursorPosition === 'object'
                ? { ...workspaceState.cursorPosition }
                : null,
            expandedSections: workspaceState.expandedSections && typeof workspaceState.expandedSections === 'object'
                ? { ...workspaceState.expandedSections }
                : {},
            searchFilters: workspaceState.searchFilters && typeof workspaceState.searchFilters === 'object'
                ? { ...workspaceState.searchFilters }
                : {},
            sortOrder: String(workspaceState.sortOrder || '').trim(),
            dashboardConfig: workspaceState.dashboardConfig && typeof workspaceState.dashboardConfig === 'object'
                ? { ...workspaceState.dashboardConfig }
                : null,
            dashboardLayout: String(workspaceState.dashboardLayout || '').trim(),
            widgetState: workspaceState.widgetState && typeof workspaceState.widgetState === 'object'
                ? { ...workspaceState.widgetState }
                : {},
            resourceNavigator: workspaceState.resourceNavigator && typeof workspaceState.resourceNavigator === 'object'
                ? { ...workspaceState.resourceNavigator }
                : {},
            keyboardFocusTarget: String(workspaceState.keyboardFocusTarget || '').trim()
        },
        statistics: source.statistics && typeof source.statistics === 'object' ? { ...source.statistics } : {},
        health: source.health && typeof source.health === 'object' ? { ...source.health } : {},
        extensions: { ...extensions }
    };
}

function normalizeProjectWorkspaces(list) {
    if (!Array.isArray(list)) return [];
    return list.map((workspace, index) => normalizeProjectWorkspace(workspace, index));
}

function normalizeRecentProjectWorkspaces(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => {
        const source = item && typeof item === 'object' ? item : {};
        const id = String(source.id || source.workspaceId || `recent-workspace-${index + 1}`).trim() || `recent-workspace-${index + 1}`;
        return {
            id,
            workspaceId: String(source.workspaceId || source.id || '').trim(),
            name: String(source.name || source.projectName || source.workspaceName || 'Project Workspace').trim() || 'Project Workspace',
            folderPath: String(source.folderPath || '').trim(),
            lastOpenedAt: String(source.lastOpenedAt || ''),
            workspaceName: String(source.workspaceName || source.name || '').trim(),
            description: String(source.description || '').trim(),
            projectName: String(source.projectName || source.name || '').trim(),
            metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {}
        };
    });
}

function normalizeSearchCollection(item, index = 0) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        id: String(source.id || `search-collection-${Date.now()}-${index}`).trim() || `search-collection-${Date.now()}-${index}`,
        name: String(source.name || `Search Collection ${index + 1}`).trim() || `Search Collection ${index + 1}`,
        queryIds: Array.isArray(source.queryIds) ? source.queryIds.map((id) => String(id || '').trim()).filter(Boolean) : []
    };
}

function normalizeSavedSearch(item, index = 0) {
    const source = item && typeof item === 'object' ? item : {};
    const name = String(source.name || source.query || `Saved Search ${index + 1}`).trim() || `Saved Search ${index + 1}`;
    return {
        id: String(source.id || `saved-search-${Date.now()}-${index}`).trim() || `saved-search-${Date.now()}-${index}`,
        name,
        query: String(source.query || '').trim(),
        scope: String(source.scope || 'workspace').trim() || 'workspace',
        filters: source.filters && typeof source.filters === 'object' ? { ...source.filters } : {},
        sortBy: String(source.sortBy || 'relevance').trim() || 'relevance',
        sortDirection: String(source.sortDirection || 'desc').trim() || 'desc',
        createdAt: String(source.createdAt || new Date().toISOString()),
        updatedAt: String(source.updatedAt || new Date().toISOString())
    };
}

function normalizeSearchHistoryEntry(item, index = 0) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        id: String(source.id || `search-history-${Date.now()}-${index}`).trim() || `search-history-${Date.now()}-${index}`,
        query: String(source.query || '').trim(),
        scope: String(source.scope || 'workspace').trim() || 'workspace',
        workspaceId: String(source.workspaceId || '').trim(),
        reportId: String(source.reportId || '').trim(),
        resultCount: Number.isFinite(Number(source.resultCount)) ? Number(source.resultCount) : 0,
        searchedAt: String(source.searchedAt || new Date().toISOString())
    };
}

function normalizeSearchSession(session) {
    const source = session && typeof session === 'object' ? session : {};
    return {
        id: String(source.id || '').trim(),
        query: String(source.query || '').trim(),
        scope: String(source.scope || 'workspace').trim() || 'workspace',
        filters: source.filters && typeof source.filters === 'object' ? { ...source.filters } : {},
        sortBy: String(source.sortBy || 'relevance').trim() || 'relevance',
        sortDirection: String(source.sortDirection || 'desc').trim() || 'desc',
        results: Array.isArray(source.results) ? source.results.map((item) => ({ ...item })) : [],
        selectedResultIndex: Number.isInteger(Number(source.selectedResultIndex)) ? Number(source.selectedResultIndex) : -1,
        selectedMatchIndex: Number.isInteger(Number(source.selectedMatchIndex)) ? Number(source.selectedMatchIndex) : 0,
        navigationHistory: Array.isArray(source.navigationHistory) ? source.navigationHistory.map((item) => ({ ...item })) : [],
        highlights: Array.isArray(source.highlights) ? source.highlights.map((item) => ({ ...item })) : [],
        resultCounts: source.resultCounts && typeof source.resultCounts === 'object' ? { ...source.resultCounts } : {}
    };
}

function normalizeSearchScopePreference(value) {
    const preference = String(value || 'auto').trim().toLowerCase();
    const allowedPreferences = new Set(['auto', 'current-project-workspace', 'current-report', 'entire-workspace', 'prompt']);
    if (allowedPreferences.has(preference)) return preference;
    if (preference === 'report') return 'current-report';
    if (preference === 'workspace') return 'entire-workspace';
    return 'auto';
}

function normalizeFavoriteItem(item, index) {
    const source = item && typeof item === 'object' ? item : { resultId: String(item || '') };
    return {
        id: String(source.id || `favorite-${index}`),
        resultId: String(source.resultId || '').trim(),
        resourceType: String(source.resourceType || source.type || '').trim(),
        title: String(source.title || '').trim(),
        subtitle: String(source.subtitle || '').trim(),
        context: String(source.context || '').trim(),
        payload: source.payload && typeof source.payload === 'object' ? source.payload : null,
        addedAt: String(source.addedAt || new Date().toISOString())
    };
}

function normalizeBookmark(bookmark, index) {
    const source = bookmark && typeof bookmark === 'object' ? bookmark : {};
    return {
        id: String(source.id || `bookmark-${index}`),
        name: String(source.name || '').trim(),
        description: String(source.description || '').trim(),
        targetType: String(source.targetType || '').trim(),
        context: String(source.context || '').trim(),
        workspaceId: String(source.workspaceId || '').trim(),
        reportId: String(source.reportId || '').trim(),
        payload: source.payload && typeof source.payload === 'object' ? source.payload : null,
        createdAt: String(source.createdAt || new Date().toISOString()),
        updatedAt: String(source.updatedAt || source.createdAt || new Date().toISOString())
    };
}

function normalizeRecentItem(item, index) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        id: String(source.id || `recent-${index}`),
        resultId: String(source.resultId || '').trim(),
        resourceType: String(source.resourceType || source.type || '').trim(),
        title: String(source.title || '').trim(),
        subtitle: String(source.subtitle || '').trim(),
        context: String(source.context || '').trim(),
        scope: String(source.scope || '').trim(),
        workspaceId: String(source.workspaceId || '').trim(),
        reportId: String(source.reportId || '').trim(),
        payload: source.payload && typeof source.payload === 'object' ? source.payload : null,
        openedAt: String(source.openedAt || new Date().toISOString())
    };
}

function normalizeSearchAnalytics(analytics) {
    const source = analytics && typeof analytics === 'object' ? analytics : {};
    const providerStats = source.providerStats && typeof source.providerStats === 'object' ? source.providerStats : {};
    const normalizedProviders = {};

    Object.entries(providerStats).forEach(([providerId, stats]) => {
        const id = String(providerId || '').trim();
        if (!id) return;
        const entry = stats && typeof stats === 'object' ? stats : {};
        normalizedProviders[id] = {
            runs: Math.max(0, Number(entry.runs) || 0),
            errors: Math.max(0, Number(entry.errors) || 0),
            totalDurationMs: Math.max(0, Number(entry.totalDurationMs) || 0),
            resultCount: Math.max(0, Number(entry.resultCount) || 0),
            lastSuccessAt: String(entry.lastSuccessAt || ''),
            lastErrorAt: String(entry.lastErrorAt || ''),
            lastErrorMessage: String(entry.lastErrorMessage || '')
        };
    });

    return {
        enabled: source.enabled !== false,
        totalSearches: Math.max(0, Number(source.totalSearches) || 0),
        noResultSearches: Math.max(0, Number(source.noResultSearches) || 0),
        resultSelections: Math.max(0, Number(source.resultSelections) || 0),
        totalDurationMs: Math.max(0, Number(source.totalDurationMs) || 0),
        providerStats: normalizedProviders,
        lastUpdatedAt: String(source.lastUpdatedAt || '')
    };
}

function normalizeUniversalSearchConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    return {
        scopePreference: normalizeSearchScopePreference(source.scopePreference),
        historyEnabled: source.historyEnabled !== false,
        recentItemsEnabled: source.recentItemsEnabled !== false,
        maxRecentItems: Number.isFinite(Number(source.maxRecentItems)) && Number(source.maxRecentItems) > 0
            ? Math.min(100, Math.floor(Number(source.maxRecentItems)))
            : 20,
        recentItems: Array.isArray(source.recentItems)
            ? source.recentItems.map((item, index) => normalizeRecentItem(item, index)).slice(0, 100)
            : [],
        defaultScopeOverride: String(source.defaultScopeOverride || '').trim(),
        history: Array.isArray(source.history)
            ? source.history.map((item, index) => normalizeSearchHistoryEntry(item, index)).slice(0, 100)
            : [],
        savedSearches: Array.isArray(source.savedSearches)
            ? source.savedSearches.map((item, index) => normalizeSavedSearch(item, index)).slice(0, 100)
            : [],
        collections: Array.isArray(source.collections)
            ? source.collections.map((item, index) => normalizeSearchCollection(item, index)).slice(0, 100)
            : [],
        favorites: Array.isArray(source.favorites)
            ? source.favorites.map((item, index) => normalizeFavoriteItem(item, index)).filter((item) => item.resultId || item.title).slice(0, 200)
            : [],
        bookmarks: Array.isArray(source.bookmarks)
            ? source.bookmarks.map((item, index) => normalizeBookmark(item, index)).filter((item) => item.name).slice(0, 200)
            : [],
        providers: Array.isArray(source.providers)
            ? source.providers.map((item) => String(item || '').trim()).filter(Boolean)
            : [],
        activeSession: normalizeSearchSession(source.activeSession),
        analytics: normalizeSearchAnalytics(source.analytics),
        indexStatus: {
            lastIndexedAt: String(source.indexStatus?.lastIndexedAt || ''),
            providerStatuses: source.indexStatus?.providerStatuses && typeof source.indexStatus.providerStatuses === 'object'
                ? { ...source.indexStatus.providerStatuses }
                : {},
            isIndexing: Boolean(source.indexStatus?.isIndexing),
            indexedItemCount: Number.isFinite(Number(source.indexStatus?.indexedItemCount)) ? Number(source.indexStatus.indexedItemCount) : 0
        }
    };
}

function normalizeOrganizationResourceRef(reference) {
    const source = reference && typeof reference === 'object' ? reference : {};
    return {
        resourceType: String(source.resourceType || source.type || '').trim().toLowerCase(),
        resourceId: String(source.resourceId || source.id || '').trim(),
        workspaceId: String(source.workspaceId || source.workspace || '').trim(),
        unresolved: Boolean(source.unresolved)
    };
}

function normalizeResourceOrganizationConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const favorites = source.favorites && typeof source.favorites === 'object' ? source.favorites : {};
    const recent = source.recent && typeof source.recent === 'object' ? source.recent : {};

    return {
        frameworkVersion: String(source.frameworkVersion || defaultState.resourceOrganization.frameworkVersion).trim() || defaultState.resourceOrganization.frameworkVersion,
        tags: Array.isArray(source.tags)
            ? source.tags.map((tag, index) => {
                const item = tag && typeof tag === 'object' ? tag : {};
                return {
                    ...item,
                    id: String(item.id || `tag-${Date.now()}-${index}`).trim() || `tag-${Date.now()}-${index}`,
                    name: String(item.name || `Tag ${index + 1}`).trim() || `Tag ${index + 1}`,
                    scope: String(item.scope || 'workspace').trim().toLowerCase() || 'workspace',
                    assignments: Array.isArray(item.assignments)
                        ? item.assignments.map((ref) => normalizeOrganizationResourceRef(ref)).filter((ref) => ref.resourceType && ref.resourceId)
                        : []
                };
            })
            : [],
        collections: Array.isArray(source.collections)
            ? source.collections.map((collection, index) => {
                const item = collection && typeof collection === 'object' ? collection : {};
                return {
                    ...item,
                    id: String(item.id || `collection-${Date.now()}-${index}`).trim() || `collection-${Date.now()}-${index}`,
                    name: String(item.name || `Collection ${index + 1}`).trim() || `Collection ${index + 1}`,
                    scope: String(item.scope || 'workspace').trim().toLowerCase() || 'workspace',
                    resourceRefs: Array.isArray(item.resourceRefs)
                        ? item.resourceRefs.map((ref) => normalizeOrganizationResourceRef(ref)).filter((ref) => ref.resourceType && ref.resourceId)
                        : []
                };
            })
            : [],
        savedViews: Array.isArray(source.savedViews)
            ? source.savedViews.map((savedView, index) => {
                const item = savedView && typeof savedView === 'object' ? savedView : {};
                return {
                    ...item,
                    id: String(item.id || `saved-view-${Date.now()}-${index}`).trim() || `saved-view-${Date.now()}-${index}`,
                    name: String(item.name || `Saved View ${index + 1}`).trim() || `Saved View ${index + 1}`,
                    scope: String(item.scope || 'workspace').trim().toLowerCase() || 'workspace',
                    config: item.config && typeof item.config === 'object' ? { ...item.config } : {}
                };
            })
            : [],
        favorites: {
            tags: Array.isArray(favorites.tags) ? favorites.tags.map((value) => String(value || '').trim()).filter(Boolean) : [],
            collections: Array.isArray(favorites.collections) ? favorites.collections.map((value) => String(value || '').trim()).filter(Boolean) : [],
            savedViews: Array.isArray(favorites.savedViews) ? favorites.savedViews.map((value) => String(value || '').trim()).filter(Boolean) : []
        },
        recent: {
            collections: Array.isArray(recent.collections) ? recent.collections.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 50) : [],
            savedViews: Array.isArray(recent.savedViews) ? recent.savedViews.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 50) : []
        },
        unresolvedReferences: Array.isArray(source.unresolvedReferences)
            ? source.unresolvedReferences.map((ref) => normalizeOrganizationResourceRef(ref)).filter((ref) => ref.resourceType && ref.resourceId)
            : []
    };
}

function normalizeWorkspaceViewName(value, fallback = 'dashboard') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'explorer') return 'explorer';
    return fallback === 'explorer' ? 'explorer' : 'dashboard';
}

function normalizeExplorerRecentResources(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const id = String(item.id || '').trim();
            const label = String(item.label || '').trim();
            if (!id || !label) return null;
            return {
                id,
                label,
                type: String(item.type || '').trim(),
                action: String(item.action || '').trim(),
                at: String(item.at || '').trim() || new Date().toISOString()
            };
        })
        .filter(Boolean)
        .slice(0, 100);
}

function normalizeWorkspaceViewConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const defaultView = normalizeWorkspaceViewName(source.defaultView, defaultState.workspaceView.defaultView);
    const rememberLastView = Boolean(source.rememberLastView);
    const active = normalizeWorkspaceViewName(rememberLastView ? source.active : defaultView, defaultView);
    const explorerSource = source.explorer && typeof source.explorer === 'object' ? source.explorer : {};
    const explorerDefaults = defaultState.workspaceView.explorer;
    const parsedWidth = Number(explorerSource.width);

    return {
        active,
        defaultView,
        rememberLastView,
        explorer: {
            ...explorerDefaults,
            ...explorerSource,
            width: Number.isFinite(parsedWidth) ? Math.max(240, Math.min(560, Math.round(parsedWidth))) : explorerDefaults.width,
            showResourceIcons: explorerSource.showResourceIcons !== false,
            showResourceBadges: explorerSource.showResourceBadges !== false,
            showRecentResources: explorerSource.showRecentResources !== false,
            showFavorites: explorerSource.showFavorites !== false,
            showSavedSearches: explorerSource.showSavedSearches !== false,
            autoExpandParents: explorerSource.autoExpandParents !== false,
            restoreExpansionState: explorerSource.restoreExpansionState !== false,
            restoreSelectedResource: explorerSource.restoreSelectedResource !== false,
            restoreFocus: explorerSource.restoreFocus !== false,
            restoreScrollPosition: explorerSource.restoreScrollPosition !== false,
            restoreContext: explorerSource.restoreContext !== false,
            expandedResourceIds: Array.isArray(explorerSource.expandedResourceIds)
                ? explorerSource.expandedResourceIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [],
            selectedResourceId: String(explorerSource.selectedResourceId || '').trim(),
            focusedResourceId: String(explorerSource.focusedResourceId || '').trim(),
            scrollTop: Math.max(0, Number(explorerSource.scrollTop || 0)),
            lastContextKind: String(explorerSource.lastContextKind || '').trim(),
            favorites: Array.isArray(explorerSource.favorites)
                ? explorerSource.favorites.map((id) => String(id || '').trim()).filter(Boolean)
                : [],
            recentResources: normalizeExplorerRecentResources(explorerSource.recentResources)
        }
    };
}

const REQUIRED_TOP_LEVEL_MENU_SHORTCUT_DEFINITIONS = getRequiredTopLevelMenuLabels()
    .map((menuLabel) => getTopLevelMenuShortcutDescriptor(menuLabel))
    .filter(Boolean)
    .map((descriptor) => ({
        action: descriptor.action,
        label: descriptor.label,
        defaultShortcut: defaultState.shortcuts[descriptor.action] || ''
    }));

const SHORTCUT_DEFINITIONS = [
    { action: 'spellCheck', label: 'Spell Check', defaultShortcut: defaultState.shortcuts.spellCheck },
    { action: 'spellReplace', label: 'Spell Check Replace', defaultShortcut: defaultState.shortcuts.spellReplace },
    { action: 'spellReplaceAll', label: 'Spell Check Replace All', defaultShortcut: defaultState.shortcuts.spellReplaceAll },
    { action: 'spellIgnore', label: 'Spell Check Ignore', defaultShortcut: defaultState.shortcuts.spellIgnore },
    { action: 'spellIgnoreAll', label: 'Spell Check Ignore All', defaultShortcut: defaultState.shortcuts.spellIgnoreAll },
    { action: 'spellAddToDictionary', label: 'Spell Check Add to Dictionary', defaultShortcut: defaultState.shortcuts.spellAddToDictionary },
    { action: 'spellUndoLastCorrection', label: 'Spell Check Undo Last Correction', defaultShortcut: defaultState.shortcuts.spellUndoLastCorrection },
    { action: 'spellCancel', label: 'Spell Check Cancel', defaultShortcut: defaultState.shortcuts.spellCancel },
    { action: 'nextLandmark', label: 'Navigate to next application region', defaultShortcut: defaultState.shortcuts.nextLandmark },
    { action: 'previousLandmark', label: 'Navigate to previous application region', defaultShortcut: defaultState.shortcuts.previousLandmark },
    { action: 'focusNavigation', label: 'Focus navigation tablist', defaultShortcut: defaultState.shortcuts.focusNavigation },
    { action: 'focusDashboard', label: 'Focus dashboard region', defaultShortcut: defaultState.shortcuts.focusDashboard },
    { action: 'showDashboard', label: 'Show Dashboard workspace view', defaultShortcut: defaultState.shortcuts.showDashboard },
    { action: 'showExplorer', label: 'Show Explorer workspace view', defaultShortcut: defaultState.shortcuts.showExplorer },
    { action: 'toggleWorkspaceView', label: 'Toggle workspace view', defaultShortcut: defaultState.shortcuts.toggleWorkspaceView },
    { action: 'openWorkingView', label: 'Open Working View', defaultShortcut: defaultState.shortcuts.openWorkingView },
    { action: 'newWorkingView', label: 'New Working View', defaultShortcut: defaultState.shortcuts.newWorkingView },
    { action: 'exitWorkingView', label: 'Exit Working View', defaultShortcut: defaultState.shortcuts.exitWorkingView },
    { action: 'applyWorkingView', label: 'Apply Working View', defaultShortcut: defaultState.shortcuts.applyWorkingView },
    { action: 'saveWorkingView', label: 'Save Working View', defaultShortcut: defaultState.shortcuts.saveWorkingView },
    { action: 'loadWorkingView', label: 'Load Working View', defaultShortcut: defaultState.shortcuts.loadWorkingView },
    { action: 'deleteWorkingView', label: 'Delete Working View', defaultShortcut: defaultState.shortcuts.deleteWorkingView },
    { action: 'refreshWorkingView', label: 'Refresh Working View', defaultShortcut: defaultState.shortcuts.refreshWorkingView },
    { action: 'resetWorkingView', label: 'Reset Working View', defaultShortcut: defaultState.shortcuts.resetWorkingView },
    { action: 'batchSetWorkingViewStatus', label: 'Batch Set Working View Status', defaultShortcut: defaultState.shortcuts.batchSetWorkingViewStatus },
    { action: 'batchAssignWorkingViewReviewer', label: 'Batch Assign Working View Reviewer', defaultShortcut: defaultState.shortcuts.batchAssignWorkingViewReviewer },
    { action: 'batchSetWorkingViewSeverity', label: 'Batch Set Working View Severity', defaultShortcut: defaultState.shortcuts.batchSetWorkingViewSeverity },
    { action: 'batchAddWorkingViewTag', label: 'Batch Add Working View Tag', defaultShortcut: defaultState.shortcuts.batchAddWorkingViewTag },
    { action: 'nextWorkingViewFinding', label: 'Next Working View Finding', defaultShortcut: defaultState.shortcuts.nextWorkingViewFinding },
    { action: 'previousWorkingViewFinding', label: 'Previous Working View Finding', defaultShortcut: defaultState.shortcuts.previousWorkingViewFinding },
    { action: 'nextWorkingViewGroup', label: 'Next Working View Group', defaultShortcut: defaultState.shortcuts.nextWorkingViewGroup },
    { action: 'previousWorkingViewGroup', label: 'Previous Working View Group', defaultShortcut: defaultState.shortcuts.previousWorkingViewGroup },
    { action: 'revealWorkingViewInExplorer', label: 'Reveal Working View Item in Explorer', defaultShortcut: defaultState.shortcuts.revealWorkingViewInExplorer },
    { action: 'revealWorkingViewInReport', label: 'Reveal Working View Item in Report', defaultShortcut: defaultState.shortcuts.revealWorkingViewInReport },
    { action: 'expandAllWorkingViewGroups', label: 'Expand All Working View Groups', defaultShortcut: defaultState.shortcuts.expandAllWorkingViewGroups },
    { action: 'collapseAllWorkingViewGroups', label: 'Collapse All Working View Groups', defaultShortcut: defaultState.shortcuts.collapseAllWorkingViewGroups },
    { action: 'setStandardReportView', label: 'Set Standard Report View', defaultShortcut: defaultState.shortcuts.setStandardReportView },
    { action: 'setWorkingReportView', label: 'Set Working Report View', defaultShortcut: defaultState.shortcuts.setWorkingReportView },
    { action: 'setOutlineReportView', label: 'Set Outline Report View', defaultShortcut: defaultState.shortcuts.setOutlineReportView },
    { action: 'setCompactReportView', label: 'Set Compact Report View', defaultShortcut: defaultState.shortcuts.setCompactReportView },
    { action: 'setExpandedReportView', label: 'Set Expanded Report View', defaultShortcut: defaultState.shortcuts.setExpandedReportView },
    { action: 'setReadingReportView', label: 'Set Reading Report View', defaultShortcut: defaultState.shortcuts.setReadingReportView },
    { action: 'setReviewReportView', label: 'Set Review Report View', defaultShortcut: defaultState.shortcuts.setReviewReportView },
    { action: 'setTableReportView', label: 'Set Table Report View', defaultShortcut: defaultState.shortcuts.setTableReportView },
    { action: 'toggleReportViewMode', label: 'Toggle Report View Mode', defaultShortcut: defaultState.shortcuts.toggleReportViewMode },
    { action: 'configureDashboard', label: 'Configure Dashboard', defaultShortcut: defaultState.shortcuts.configureDashboard },
    { action: 'focusMainContent', label: 'Focus main content region', defaultShortcut: defaultState.shortcuts.focusMainContent },
    { action: 'openWelcome', label: 'Open Welcome tab', defaultShortcut: defaultState.shortcuts.openWelcome },
    { action: 'openHelp', label: 'Open Help documentation', defaultShortcut: defaultState.shortcuts.openHelp },
    { action: 'openCommandPalette', label: 'Open Command Palette', defaultShortcut: defaultState.shortcuts.openCommandPalette },
    { action: 'openBuilder', label: 'Open Report Builder tab', defaultShortcut: defaultState.shortcuts.openBuilder },
    { action: 'openEditor', label: 'Open Report Editor tab', defaultShortcut: defaultState.shortcuts.openEditor },
    { action: 'openViewer', label: 'Open Report Viewer tab', defaultShortcut: defaultState.shortcuts.openViewer },
    { action: 'openProgressLog', label: 'Open Progress Log', defaultShortcut: defaultState.shortcuts.openProgressLog },
    { action: 'focusLookup', label: 'Focus Accessibility Lookup search', defaultShortcut: defaultState.shortcuts.focusLookup },
    { action: 'focusMenuBar', label: 'Focus Menu Bar', defaultShortcut: defaultState.shortcuts.focusMenuBar },
    { action: 'focusMenuSearch', label: 'Focus Menu Bar Command Search', defaultShortcut: defaultState.shortcuts.focusMenuSearch },
    ...REQUIRED_TOP_LEVEL_MENU_SHORTCUT_DEFINITIONS,
    { action: 'undo', label: 'Undo', defaultShortcut: defaultState.shortcuts.undo },
    { action: 'redo', label: 'Redo', defaultShortcut: defaultState.shortcuts.redo },
    { action: 'openHistory', label: 'Open History', defaultShortcut: defaultState.shortcuts.openHistory },
    { action: 'openVersionHistory', label: 'Open Version History', defaultShortcut: defaultState.shortcuts.openVersionHistory },
    { action: 'compareVersions', label: 'Compare Versions', defaultShortcut: defaultState.shortcuts.compareVersions },
    { action: 'restorePreviousVersion', label: 'Restore Previous Version', defaultShortcut: defaultState.shortcuts.restorePreviousVersion },
    { action: 'clearHistory', label: 'Clear History', defaultShortcut: defaultState.shortcuts.clearHistory },
    { action: 'searchEverywhere', label: 'Search Everywhere', defaultShortcut: defaultState.shortcuts.searchEverywhere },
    { action: 'quickOpen', label: 'Quick Open', defaultShortcut: defaultState.shortcuts.quickOpen },
    { action: 'openRecentItems', label: 'Open Recent Items', defaultShortcut: defaultState.shortcuts.openRecentItems },
    { action: 'clearRecentItems', label: 'Clear Recent Items', defaultShortcut: defaultState.shortcuts.clearRecentItems },
    { action: 'addToFavorites', label: 'Add To Favorites', defaultShortcut: defaultState.shortcuts.addToFavorites },
    { action: 'removeFromFavorites', label: 'Remove From Favorites', defaultShortcut: defaultState.shortcuts.removeFromFavorites },
    { action: 'openFavorites', label: 'Open Favorites', defaultShortcut: defaultState.shortcuts.openFavorites },
    { action: 'addBookmark', label: 'Bookmark This Location', defaultShortcut: defaultState.shortcuts.addBookmark },
    { action: 'openBookmarks', label: 'Open Bookmarks', defaultShortcut: defaultState.shortcuts.openBookmarks },
    { action: 'clearBookmarks', label: 'Clear Bookmarks', defaultShortcut: defaultState.shortcuts.clearBookmarks },
    { action: 'navigateBack', label: 'Back', defaultShortcut: defaultState.shortcuts.navigateBack },
    { action: 'navigateForward', label: 'Forward', defaultShortcut: defaultState.shortcuts.navigateForward },
    { action: 'openNavigationHistory', label: 'Open Navigation History', defaultShortcut: defaultState.shortcuts.openNavigationHistory },
    { action: 'clearNavigationHistory', label: 'Clear Navigation History', defaultShortcut: defaultState.shortcuts.clearNavigationHistory },
    { action: 'openOrganizationStatistics', label: 'Open Organization Statistics', defaultShortcut: defaultState.shortcuts.openOrganizationStatistics },
    { action: 'openOrganizationOverview', label: 'Open Organization Overview', defaultShortcut: defaultState.shortcuts.openOrganizationOverview },
    { action: 'openOrganizationFindings', label: 'Open Organization Findings', defaultShortcut: defaultState.shortcuts.openOrganizationFindings },
    { action: 'openOrganizationTrends', label: 'Open Organization Trends', defaultShortcut: defaultState.shortcuts.openOrganizationTrends },
    { action: 'openOrganizationRecurrence', label: 'Open Organization Recurrence', defaultShortcut: defaultState.shortcuts.openOrganizationRecurrence },
    { action: 'openOrganizationComparison', label: 'Open Organization Comparison', defaultShortcut: defaultState.shortcuts.openOrganizationComparison },
    { action: 'openOrganizationSavedViews', label: 'Open Organization Saved Views', defaultShortcut: defaultState.shortcuts.openOrganizationSavedViews },
    { action: 'saveOrganizationStatisticsView', label: 'Save Organization Statistics View', defaultShortcut: defaultState.shortcuts.saveOrganizationStatisticsView },
    { action: 'exportOrganizationStatistics', label: 'Export Organization Statistics', defaultShortcut: defaultState.shortcuts.exportOrganizationStatistics },
    { action: 'exportOrganizationStatisticsCsv', label: 'Export Organization Statistics CSV', defaultShortcut: defaultState.shortcuts.exportOrganizationStatisticsCsv },
    { action: 'recordOrganizationStatisticsSnapshot', label: 'Record Organization Statistics Snapshot', defaultShortcut: defaultState.shortcuts.recordOrganizationStatisticsSnapshot },
    { action: 'openOrganizationDataQuality', label: 'Open Organization Data Quality', defaultShortcut: defaultState.shortcuts.openOrganizationDataQuality },
    { action: 'toggleOrganizationDashboardSection', label: 'Show or Hide Organization Statistics Dashboard Section', defaultShortcut: defaultState.shortcuts.toggleOrganizationDashboardSection },
    { action: 'searchCurrentReport', label: 'Search Current Report', defaultShortcut: defaultState.shortcuts.searchCurrentReport },
    { action: 'searchCurrentProjectWorkspace', label: 'Search Current Project Workspace', defaultShortcut: defaultState.shortcuts.searchCurrentProjectWorkspace },
    { action: 'searchAllProjects', label: 'Search All Projects', defaultShortcut: defaultState.shortcuts.searchAllProjects },
    { action: 'searchAccessibilityStandards', label: 'Search Accessibility Standards', defaultShortcut: defaultState.shortcuts.searchAccessibilityStandards },
    { action: 'searchHelpDocumentation', label: 'Search Help Documentation', defaultShortcut: defaultState.shortcuts.searchHelpDocumentation },
    { action: 'searchCommands', label: 'Search Commands', defaultShortcut: defaultState.shortcuts.searchCommands },
    { action: 'searchKeyboardShortcuts', label: 'Search Keyboard Shortcuts', defaultShortcut: defaultState.shortcuts.searchKeyboardShortcuts },
    { action: 'searchProjectAssets', label: 'Search Project Assets', defaultShortcut: defaultState.shortcuts.searchProjectAssets },
    { action: 'searchTemplates', label: 'Search Templates', defaultShortcut: defaultState.shortcuts.searchTemplates },
    { action: 'searchDashboard', label: 'Search Dashboard', defaultShortcut: defaultState.shortcuts.searchDashboard },
    { action: 'findInCurrentResource', label: 'Find In Current Resource', defaultShortcut: defaultState.shortcuts.findInCurrentResource },
    { action: 'findNextMatch', label: 'Find Next Match', defaultShortcut: defaultState.shortcuts.findNextMatch },
    { action: 'findPreviousMatch', label: 'Find Previous Match', defaultShortcut: defaultState.shortcuts.findPreviousMatch },
    { action: 'nextSearchResult', label: 'Next Search Result', defaultShortcut: defaultState.shortcuts.nextSearchResult },
    { action: 'previousSearchResult', label: 'Previous Search Result', defaultShortcut: defaultState.shortcuts.previousSearchResult },
    { action: 'clearSearchHighlights', label: 'Clear Search Highlights', defaultShortcut: defaultState.shortcuts.clearSearchHighlights },
    { action: 'clearSearchHistory', label: 'Clear Search History', defaultShortcut: defaultState.shortcuts.clearSearchHistory },
    { action: 'saveCurrentSearch', label: 'Save Current Search', defaultShortcut: defaultState.shortcuts.saveCurrentSearch },
    { action: 'openSavedSearches', label: 'Open Saved Searches', defaultShortcut: defaultState.shortcuts.openSavedSearches },
    { action: 'addField', label: 'Add field in Report Builder', defaultShortcut: defaultState.shortcuts.addField },
    { action: 'done', label: 'Complete Builder and move to Editor', defaultShortcut: defaultState.shortcuts.done },
    { action: 'addEntry', label: 'Add entry in Report Editor', defaultShortcut: defaultState.shortcuts.addEntry },
    { action: 'attachFile', label: 'Attach File in Report Editor', defaultShortcut: defaultState.shortcuts.attachFile },
    { action: 'openProject', label: 'Open ART Project', defaultShortcut: defaultState.shortcuts.openProject },
    { action: 'saveProject', label: 'Save ART Project', defaultShortcut: defaultState.shortcuts.saveProject },
    { action: 'saveProjectAs', label: 'Save ART Project As', defaultShortcut: defaultState.shortcuts.saveProjectAs },
    { action: 'importData', label: 'Import Data', defaultShortcut: defaultState.shortcuts.importData },
    { action: 'newProjectWorkspace', label: 'Create new Project Workspace', defaultShortcut: defaultState.shortcuts.newProjectWorkspace },
    { action: 'openProjectWorkspace', label: 'Open Project Workspace', defaultShortcut: defaultState.shortcuts.openProjectWorkspace },
    { action: 'openRecentProjectWorkspace', label: 'Open recent Project Workspace', defaultShortcut: defaultState.shortcuts.openRecentProjectWorkspace },
    { action: 'continueWorking', label: 'Continue Working', defaultShortcut: defaultState.shortcuts.continueWorking },
    { action: 'closeProjectWorkspace', label: 'Close Workspace', defaultShortcut: defaultState.shortcuts.closeProjectWorkspace },
    { action: 'saveProjectWorkspace', label: 'Save Project Workspace', defaultShortcut: defaultState.shortcuts.saveProjectWorkspace },
    { action: 'saveProjectWorkspaceAs', label: 'Save Project Workspace As', defaultShortcut: defaultState.shortcuts.saveProjectWorkspaceAs },
    { action: 'renameProjectWorkspace', label: 'Rename Project Workspace', defaultShortcut: defaultState.shortcuts.renameProjectWorkspace },
    { action: 'duplicateProjectWorkspace', label: 'Duplicate Project Workspace', defaultShortcut: defaultState.shortcuts.duplicateProjectWorkspace },
    { action: 'importProjectWorkspace', label: 'Import Project Workspace', defaultShortcut: defaultState.shortcuts.importProjectWorkspace },
    { action: 'exportProjectWorkspace', label: 'Export Project Workspace', defaultShortcut: defaultState.shortcuts.exportProjectWorkspace },
    { action: 'deleteProjectWorkspace', label: 'Delete Project Workspace', defaultShortcut: defaultState.shortcuts.deleteProjectWorkspace },
    { action: 'addProjectAsset', label: 'Add Project Asset', defaultShortcut: defaultState.shortcuts.addProjectAsset },
    { action: 'createAssetFolder', label: 'Create Asset Folder', defaultShortcut: defaultState.shortcuts.createAssetFolder },
    { action: 'removeProjectAsset', label: 'Remove Project Asset', defaultShortcut: defaultState.shortcuts.removeProjectAsset },
    { action: 'refreshWorkspaceAssets', label: 'Refresh Workspace Assets', defaultShortcut: defaultState.shortcuts.refreshWorkspaceAssets },
    { action: 'openProjectProperties', label: 'Open Project Properties', defaultShortcut: defaultState.shortcuts.openProjectProperties },
    { action: 'openResourceRelationships', label: 'Show Resource Relationships', defaultShortcut: defaultState.shortcuts.openResourceRelationships },
    { action: 'openResourceDependents', label: 'Show Resource Dependents', defaultShortcut: defaultState.shortcuts.openResourceDependents },
    { action: 'openResourceReferences', label: 'Show Resource References', defaultShortcut: defaultState.shortcuts.openResourceReferences },
    { action: 'previewResourceDeletionImpact', label: 'Preview Resource Deletion Impact', defaultShortcut: defaultState.shortcuts.previewResourceDeletionImpact },
    { action: 'repairWorkspaceRelationships', label: 'Repair Workspace Relationships', defaultShortcut: defaultState.shortcuts.repairWorkspaceRelationships },
    { action: 'openTagManager', label: 'Open Tag Manager', defaultShortcut: defaultState.shortcuts.openTagManager },
    { action: 'createTag', label: 'Create Tag', defaultShortcut: defaultState.shortcuts.createTag },
    { action: 'assignTagToSelectedResource', label: 'Assign Tag To Selected Resource', defaultShortcut: defaultState.shortcuts.assignTagToSelectedResource },
    { action: 'removeTagFromSelectedResource', label: 'Remove Tag From Selected Resource', defaultShortcut: defaultState.shortcuts.removeTagFromSelectedResource },
    { action: 'mergeTags', label: 'Merge Tags', defaultShortcut: defaultState.shortcuts.mergeTags },
    { action: 'openCollectionManager', label: 'Open Collection Manager', defaultShortcut: defaultState.shortcuts.openCollectionManager },
    { action: 'createCollection', label: 'Create Collection', defaultShortcut: defaultState.shortcuts.createCollection },
    { action: 'addSelectedResourceToCollection', label: 'Add Selected Resource To Collection', defaultShortcut: defaultState.shortcuts.addSelectedResourceToCollection },
    { action: 'removeSelectedResourceFromCollection', label: 'Remove Selected Resource From Collection', defaultShortcut: defaultState.shortcuts.removeSelectedResourceFromCollection },
    { action: 'openSavedViewManager', label: 'Open Saved View Manager', defaultShortcut: defaultState.shortcuts.openSavedViewManager },
    { action: 'createSavedViewFromCurrentWorkingView', label: 'Create Saved View From Current Working View', defaultShortcut: defaultState.shortcuts.createSavedViewFromCurrentWorkingView },
    { action: 'openSavedView', label: 'Open Saved View', defaultShortcut: defaultState.shortcuts.openSavedView },
    { action: 'deleteSavedView', label: 'Delete Saved View', defaultShortcut: defaultState.shortcuts.deleteSavedView },
    { action: 'exportResourceOrganizationMetadata', label: 'Export Resource Organization Metadata', defaultShortcut: defaultState.shortcuts.exportResourceOrganizationMetadata },
    { action: 'importResourceOrganizationMetadata', label: 'Import Resource Organization Metadata', defaultShortcut: defaultState.shortcuts.importResourceOrganizationMetadata },
    { action: 'toggleTagFavorite', label: 'Toggle Tag Favorite', defaultShortcut: defaultState.shortcuts.toggleTagFavorite },
    { action: 'toggleCollectionFavorite', label: 'Toggle Collection Favorite', defaultShortcut: defaultState.shortcuts.toggleCollectionFavorite },
    { action: 'toggleSavedViewFavorite', label: 'Toggle Saved View Favorite', defaultShortcut: defaultState.shortcuts.toggleSavedViewFavorite },
    { action: 'openProjectStatistics', label: 'Open Project Statistics', defaultShortcut: defaultState.shortcuts.openProjectStatistics },
    { action: 'openWorkspaceSettings', label: 'Open Workspace Settings', defaultShortcut: defaultState.shortcuts.openWorkspaceSettings },
    { action: 'openReport', label: 'Open/Import report', defaultShortcut: defaultState.shortcuts.openReport },
    { action: 'exportReport', label: 'Export report', defaultShortcut: defaultState.shortcuts.exportReport },
    { action: 'newReport', label: 'Create new report', defaultShortcut: defaultState.shortcuts.newReport },
    { action: 'newReportFromTemplate', label: 'Create new report from template', defaultShortcut: defaultState.shortcuts.newReportFromTemplate },
    { action: 'resetLookup', label: 'Reset Accessibility Lookup Tool', defaultShortcut: defaultState.shortcuts.resetLookup },
    { action: 'closeReport', label: 'Close Report', defaultShortcut: defaultState.shortcuts.closeReport },
    { action: 'closeWorkingView', label: 'Close Working View', defaultShortcut: defaultState.shortcuts.closeWorkingView },
    { action: 'configureReport', label: 'Configure Report', defaultShortcut: defaultState.shortcuts.configureReport },
    { action: 'renameReport', label: 'Rename Report', defaultShortcut: defaultState.shortcuts.renameReport },
    { action: 'replaceReport', label: 'Replace Report', defaultShortcut: defaultState.shortcuts.replaceReport },
    { action: 'editReport', label: 'Edit Report', defaultShortcut: defaultState.shortcuts.editReport },
    { action: 'viewReport', label: 'View Report', defaultShortcut: defaultState.shortcuts.viewReport },
    { action: 'deleteReport', label: 'Delete Report', defaultShortcut: defaultState.shortcuts.deleteReport },
    { action: 'newTemplate', label: 'Create Template', defaultShortcut: defaultState.shortcuts.newTemplate },
    { action: 'useTemplate', label: 'Use Template', defaultShortcut: defaultState.shortcuts.useTemplate },
    { action: 'openTemplate', label: 'View Template', defaultShortcut: defaultState.shortcuts.openTemplate },
    { action: 'renameTemplate', label: 'Rename Template', defaultShortcut: defaultState.shortcuts.renameTemplate },
    { action: 'replaceTemplate', label: 'Replace Template', defaultShortcut: defaultState.shortcuts.replaceTemplate },
    { action: 'editTemplate', label: 'Edit Template', defaultShortcut: defaultState.shortcuts.editTemplate },
    { action: 'deleteTemplate', label: 'Delete Template', defaultShortcut: defaultState.shortcuts.deleteTemplate },
    { action: 'importTemplate', label: 'Import Template', defaultShortcut: defaultState.shortcuts.importTemplate },
    { action: 'exportTemplate', label: 'Export Template', defaultShortcut: defaultState.shortcuts.exportTemplate },
    { action: 'openSettings', label: 'Open Application Settings', defaultShortcut: defaultState.shortcuts.openSettings },
    { action: 'settingsClose', label: 'Close Application Settings', defaultShortcut: defaultState.shortcuts.settingsClose },
    { action: 'settingsRestoreShortcuts', label: 'Restore Default Shortcuts', defaultShortcut: defaultState.shortcuts.settingsRestoreShortcuts },
    { action: 'settingsImportStandard', label: 'Import Accessibility Standard', defaultShortcut: defaultState.shortcuts.settingsImportStandard },
    { action: 'settingsPasteStandardTable', label: 'Paste Standards As Table', defaultShortcut: defaultState.shortcuts.settingsPasteStandardTable },
    { action: 'settingsImportReportFile', label: 'Import Report File from Device', defaultShortcut: defaultState.shortcuts.settingsImportReportFile },
    { action: 'settingsImportTemplateFile', label: 'Import Template File from Device', defaultShortcut: defaultState.shortcuts.settingsImportTemplateFile },
    { action: 'settingsOpenIntegrations', label: 'Open Integrations Section', defaultShortcut: defaultState.shortcuts.settingsOpenIntegrations },
    { action: 'settingsCustomizeAnalytics', label: 'Open Analytics Settings Section', defaultShortcut: defaultState.shortcuts.settingsCustomizeAnalytics },
    { action: 'settingsCustomizeCollaboration', label: 'Open Collaboration Settings Section', defaultShortcut: defaultState.shortcuts.settingsCustomizeCollaboration },
    { action: 'toggleCollaboration', label: 'Toggle Collaboration', defaultShortcut: defaultState.shortcuts.toggleCollaboration },
    { action: 'toggleCollaborationToolbar', label: 'Toggle Collaboration Toolbar', defaultShortcut: defaultState.shortcuts.toggleCollaborationToolbar },
    { action: 'settingsCollaborationApplySoloDefaults', label: 'Apply Collaboration Solo Defaults', defaultShortcut: defaultState.shortcuts.settingsCollaborationApplySoloDefaults },
    { action: 'settingsCollaborationApplyTeamDefaults', label: 'Apply Collaboration Team Defaults', defaultShortcut: defaultState.shortcuts.settingsCollaborationApplyTeamDefaults },
    { action: 'settingsCollaborationResetBaseline', label: 'Reset Collaboration Baseline', defaultShortcut: defaultState.shortcuts.settingsCollaborationResetBaseline },
    { action: 'settingsCollaborationRecordSyncCheckpoint', label: 'Record Collaboration Sync Checkpoint', defaultShortcut: defaultState.shortcuts.settingsCollaborationRecordSyncCheckpoint },
    { action: 'settingsCollaborationGenerateDiscoverySnapshot', label: 'Generate Collaboration Discovery Snapshot', defaultShortcut: defaultState.shortcuts.settingsCollaborationGenerateDiscoverySnapshot },
    { action: 'settingsCollaborationQueueTestConflict', label: 'Queue Collaboration Test Conflict', defaultShortcut: defaultState.shortcuts.settingsCollaborationQueueTestConflict },
    { action: 'settingsCollaborationResolveOldestConflict', label: 'Resolve Oldest Collaboration Conflict', defaultShortcut: defaultState.shortcuts.settingsCollaborationResolveOldestConflict },
    { action: 'settingsCollaborationRegisterPresenceSession', label: 'Register Collaboration Presence Session', defaultShortcut: defaultState.shortcuts.settingsCollaborationRegisterPresenceSession },
    { action: 'settingsCollaborationClearSessions', label: 'Clear Collaboration Sessions', defaultShortcut: defaultState.shortcuts.settingsCollaborationClearSessions },
    { action: 'settingsCollaborationLiveQuickStart', label: 'Quick Start Live Collaboration', defaultShortcut: defaultState.shortcuts.settingsCollaborationLiveQuickStart },
    { action: 'settingsCollaborationLiveConnect', label: 'Connect Live Collaboration Server', defaultShortcut: defaultState.shortcuts.settingsCollaborationLiveConnect },
    { action: 'settingsCollaborationLiveDisconnect', label: 'Disconnect Live Collaboration Server', defaultShortcut: defaultState.shortcuts.settingsCollaborationLiveDisconnect },
    { action: 'settingsCollaborationLiveStartSession', label: 'Start Live Collaboration Session', defaultShortcut: defaultState.shortcuts.settingsCollaborationLiveStartSession },
    { action: 'settingsCollaborationPublishAsyncSnapshot', label: 'Publish Async Collaboration Snapshot', defaultShortcut: defaultState.shortcuts.settingsCollaborationPublishAsyncSnapshot },
    { action: 'settingsCollaborationPullAsyncSnapshot', label: 'Pull Async Collaboration Snapshot', defaultShortcut: defaultState.shortcuts.settingsCollaborationPullAsyncSnapshot },
    { action: 'settingsPluginInstall', label: 'Install Plugin Manifest', defaultShortcut: defaultState.shortcuts.settingsPluginInstall },
    { action: 'settingsPluginValidate', label: 'Validate Plugin Extensions', defaultShortcut: defaultState.shortcuts.settingsPluginValidate },
    { action: 'settingsPluginRefresh', label: 'Refresh Plugin Manager', defaultShortcut: defaultState.shortcuts.settingsPluginRefresh },
    { action: 'settingsPluginExportConfig', label: 'Export Plugin Framework Configuration', defaultShortcut: defaultState.shortcuts.settingsPluginExportConfig },
    { action: 'settingsPluginImportConfig', label: 'Import Plugin Framework Configuration', defaultShortcut: defaultState.shortcuts.settingsPluginImportConfig },
    { action: 'settingsTogglePrivacyMode', label: 'Toggle Privacy Mode', defaultShortcut: defaultState.shortcuts.settingsTogglePrivacyMode },
    { action: 'settingsCreateBackup', label: 'Create Backup', defaultShortcut: defaultState.shortcuts.settingsCreateBackup },
    { action: 'settingsResetApp', label: 'Reset ART Application Data', defaultShortcut: defaultState.shortcuts.settingsResetApp },
    { action: 'settingsCloseReport', label: 'Close Report from Settings', defaultShortcut: defaultState.shortcuts.settingsCloseReport },
    { action: 'copyEntry', label: 'Copy Entry', defaultShortcut: defaultState.shortcuts.copyEntry },
    { action: 'copyName', label: 'Copy Name', defaultShortcut: defaultState.shortcuts.copyName },
    { action: 'copyDescription', label: 'Copy Description', defaultShortcut: defaultState.shortcuts.copyDescription },
    { action: 'copyFailures', label: 'Copy Failures', defaultShortcut: defaultState.shortcuts.copyFailures },
    { action: 'copyFixes', label: 'Copy Fixes', defaultShortcut: defaultState.shortcuts.copyFixes },
    { action: 'copyLink', label: 'Copy References', defaultShortcut: defaultState.shortcuts.copyLink }
];

function getTopLevelMenuRootFromCommand(command) {
    const source = command && typeof command === 'object' ? command : {};
    const location = String(source.menuLocation || '').trim();
    const segments = location.split('>').map((part) => String(part || '').trim()).filter(Boolean);
    const root = segments[0] || String(source.category || '').trim();
    if (!root || root.toLowerCase() === 'application') return '';
    return root;
}

function getTopLevelMenuLabelsFromRegisteredCommands() {
    return commandRegistry.getCommands()
        .map((command) => getTopLevelMenuRootFromCommand(command))
        .filter(Boolean);
}

function dedupeShortcutDefinitions(definitions) {
    const unique = [];
    const seen = new Set();

    definitions.forEach((definition) => {
        const item = definition && typeof definition === 'object' ? definition : null;
        const action = String(item?.action || '').trim();
        if (!action || seen.has(action)) return;
        seen.add(action);
        unique.push(item);
    });

    return unique;
}

function getRuntimeTopLevelMenuShortcutDefinitions(shortcutSource = {}) {
    const source = shortcutSource && typeof shortcutSource === 'object' ? shortcutSource : {};
    const labels = mergeTopLevelMenuLabels(getTopLevelMenuLabelsFromRegisteredCommands());
    const definitions = labels
        .map((menuLabel) => getTopLevelMenuShortcutDescriptor(menuLabel))
        .filter(Boolean)
        .map((descriptor) => ({
            action: descriptor.action,
            label: descriptor.label,
            defaultShortcut: defaultState.shortcuts[descriptor.action] || ''
        }));

    const knownActions = new Set(definitions.map((definition) => definition.action));
    Object.keys(source).forEach((action) => {
        if (!isTopLevelMenuShortcutAction(action) || knownActions.has(action)) return;

        const menuLabel = getTopLevelMenuLabelFromAction(action) || action;
        definitions.push({
            action,
            label: `Open ${menuLabel} menu`,
            defaultShortcut: defaultState.shortcuts[action] || ''
        });
        knownActions.add(action);
    });

    return definitions;
}

function getAllShortcutDefinitions(shortcutSource = {}) {
    return dedupeShortcutDefinitions([
        ...SHORTCUT_DEFINITIONS,
        ...getRuntimeTopLevelMenuShortcutDefinitions(shortcutSource)
    ]);
}

const APP_INFO = {
    applicationName: 'ART (the Accessibility Reporting Tool)',
    version: '1.5',
    buildDate: '2026-07-16',
    dataSchemaVersion: '1.0'
};

function normalizeShortcutValue(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizeShortcuts(rawShortcuts) {
    const source = rawShortcuts && typeof rawShortcuts === 'object' ? rawShortcuts : {};
    const normalized = { ...defaultState.shortcuts };
    const allShortcutDefinitions = getAllShortcutDefinitions(source);
    const hasProjectShortcutKeys = ['openProject', 'saveProject', 'saveProjectAs', 'importData']
        .some((key) => Object.prototype.hasOwnProperty.call(source, key));

    allShortcutDefinitions.forEach((definition) => {
        normalized[definition.action] = normalizeShortcutValue(source[definition.action], definition.defaultShortcut);
    });

    const legacyNewReport = String(source.newReport || '').trim().toLowerCase();
    if (!legacyNewReport || legacyNewReport === 'ctrl+n') {
        normalized.newReport = defaultState.shortcuts.newReport;
    }

    if (!hasProjectShortcutKeys) {
        normalized.openProject = defaultState.shortcuts.openProject;
        normalized.saveProject = defaultState.shortcuts.saveProject;
        normalized.saveProjectAs = defaultState.shortcuts.saveProjectAs;
        normalized.importData = defaultState.shortcuts.importData;

        const legacyOpenReport = String(source.openReport || '').trim().toLowerCase();
        const legacyExportReport = String(source.exportReport || '').trim().toLowerCase();
        if (!legacyOpenReport || legacyOpenReport === 'ctrl+o') {
            normalized.openReport = defaultState.shortcuts.openReport;
        }
        if (!legacyExportReport || legacyExportReport === 'ctrl+shift+s') {
            normalized.exportReport = defaultState.shortcuts.exportReport;
        }
    }

    return normalized;
}

export function getAssignableActions() {
    const assignableActions = [
        { action: 'spellCheck', label: 'Spell Check' },
        { action: 'spellReplace', label: 'Spell Check Replace' },
        { action: 'spellReplaceAll', label: 'Spell Check Replace All' },
        { action: 'spellIgnore', label: 'Spell Check Ignore' },
        { action: 'spellIgnoreAll', label: 'Spell Check Ignore All' },
        { action: 'spellAddToDictionary', label: 'Spell Check Add to Dictionary' },
        { action: 'spellUndoLastCorrection', label: 'Spell Check Undo Last Correction' },
        { action: 'spellCancel', label: 'Spell Check Cancel' },
        { action: 'nextLandmark', label: 'Navigate to next application region' },
        { action: 'previousLandmark', label: 'Navigate to previous application region' },
        { action: 'focusNavigation', label: 'Focus navigation tablist' },
        { action: 'focusDashboard', label: 'Focus dashboard region' },
        { action: 'showDashboard', label: 'Show Dashboard workspace view' },
        { action: 'showExplorer', label: 'Show Explorer workspace view' },
        { action: 'toggleWorkspaceView', label: 'Toggle workspace view' },
        { action: 'openWorkingView', label: 'Open Working View' },
        { action: 'newWorkingView', label: 'New Working View' },
        { action: 'exitWorkingView', label: 'Exit Working View' },
        { action: 'applyWorkingView', label: 'Apply Working View' },
        { action: 'saveWorkingView', label: 'Save Working View' },
        { action: 'loadWorkingView', label: 'Load Working View' },
        { action: 'deleteWorkingView', label: 'Delete Working View' },
        { action: 'refreshWorkingView', label: 'Refresh Working View' },
        { action: 'resetWorkingView', label: 'Reset Working View' },
        { action: 'batchSetWorkingViewStatus', label: 'Batch Set Working View Status' },
        { action: 'batchAssignWorkingViewReviewer', label: 'Batch Assign Working View Reviewer' },
        { action: 'batchSetWorkingViewSeverity', label: 'Batch Set Working View Severity' },
        { action: 'batchAddWorkingViewTag', label: 'Batch Add Working View Tag' },
        { action: 'nextWorkingViewFinding', label: 'Next Working View Finding' },
        { action: 'previousWorkingViewFinding', label: 'Previous Working View Finding' },
        { action: 'nextWorkingViewGroup', label: 'Next Working View Group' },
        { action: 'previousWorkingViewGroup', label: 'Previous Working View Group' },
        { action: 'revealWorkingViewInExplorer', label: 'Reveal Working View Item in Explorer' },
        { action: 'revealWorkingViewInReport', label: 'Reveal Working View Item in Report' },
        { action: 'expandAllWorkingViewGroups', label: 'Expand All Working View Groups' },
        { action: 'collapseAllWorkingViewGroups', label: 'Collapse All Working View Groups' },
        { action: 'setStandardReportView', label: 'Set Standard Report View' },
        { action: 'setWorkingReportView', label: 'Set Working Report View' },
        { action: 'setOutlineReportView', label: 'Set Outline Report View' },
        { action: 'setCompactReportView', label: 'Set Compact Report View' },
        { action: 'setExpandedReportView', label: 'Set Expanded Report View' },
        { action: 'setReadingReportView', label: 'Set Reading Report View' },
        { action: 'setReviewReportView', label: 'Set Review Report View' },
        { action: 'toggleReportViewMode', label: 'Toggle Report View Mode' },
        { action: 'configureDashboard', label: 'Configure Dashboard' },
        { action: 'focusMainContent', label: 'Focus main content region' },
        { action: 'openWelcome', label: 'Open Welcome tab' },
        { action: 'openHelp', label: 'Open Help documentation' },
        { action: 'openCommandPalette', label: 'Open Command Palette' },
        { action: 'openBuilder', label: 'Open Report Builder tab' },
        { action: 'openEditor', label: 'Open Report Editor tab' },
        { action: 'openViewer', label: 'Open Report Viewer tab' },
        { action: 'openProgressLog', label: 'Open Progress Log' },
        { action: 'focusLookup', label: 'Focus Accessibility Lookup search' },
        { action: 'focusMenuBar', label: 'Focus Menu Bar' },
        { action: 'focusMenuSearch', label: 'Focus Menu Bar Command Search' },
        { action: 'undo', label: 'Undo' },
        { action: 'redo', label: 'Redo' },
        { action: 'openHistory', label: 'Open History' },
        { action: 'openVersionHistory', label: 'Open Version History' },
        { action: 'compareVersions', label: 'Compare Versions' },
        { action: 'restorePreviousVersion', label: 'Restore Previous Version' },
        { action: 'clearHistory', label: 'Clear History' },
        { action: 'searchEverywhere', label: 'Search Everywhere' },
        { action: 'quickOpen', label: 'Quick Open' },
        { action: 'openRecentItems', label: 'Open Recent Items' },
        { action: 'clearRecentItems', label: 'Clear Recent Items' },
        { action: 'addToFavorites', label: 'Add To Favorites' },
        { action: 'removeFromFavorites', label: 'Remove From Favorites' },
        { action: 'openFavorites', label: 'Open Favorites' },
        { action: 'addBookmark', label: 'Bookmark This Location' },
        { action: 'openBookmarks', label: 'Open Bookmarks' },
        { action: 'clearBookmarks', label: 'Clear Bookmarks' },
        { action: 'navigateBack', label: 'Back' },
        { action: 'navigateForward', label: 'Forward' },
        { action: 'openNavigationHistory', label: 'Open Navigation History' },
        { action: 'clearNavigationHistory', label: 'Clear Navigation History' },
        { action: 'openOrganizationStatistics', label: 'Open Organization Statistics' },
        { action: 'openOrganizationOverview', label: 'Open Organization Overview' },
        { action: 'openOrganizationFindings', label: 'Open Organization Findings' },
        { action: 'openOrganizationTrends', label: 'Open Organization Trends' },
        { action: 'openOrganizationRecurrence', label: 'Open Organization Recurrence' },
        { action: 'openOrganizationComparison', label: 'Open Organization Comparison' },
        { action: 'openOrganizationSavedViews', label: 'Open Organization Saved Views' },
        { action: 'saveOrganizationStatisticsView', label: 'Save Organization Statistics View' },
        { action: 'exportOrganizationStatistics', label: 'Export Organization Statistics' },
        { action: 'exportOrganizationStatisticsCsv', label: 'Export Organization Statistics CSV' },
        { action: 'recordOrganizationStatisticsSnapshot', label: 'Record Organization Statistics Snapshot' },
        { action: 'openOrganizationDataQuality', label: 'Open Organization Data Quality' },
        { action: 'toggleOrganizationDashboardSection', label: 'Show or Hide Organization Statistics Dashboard Section' },
        { action: 'searchCurrentReport', label: 'Search Current Report' },
        { action: 'searchCurrentProjectWorkspace', label: 'Search Current Project Workspace' },
        { action: 'searchAllProjects', label: 'Search All Projects' },
        { action: 'searchAccessibilityStandards', label: 'Search Accessibility Standards' },
        { action: 'searchHelpDocumentation', label: 'Search Help Documentation' },
        { action: 'searchCommands', label: 'Search Commands' },
        { action: 'searchKeyboardShortcuts', label: 'Search Keyboard Shortcuts' },
        { action: 'searchProjectAssets', label: 'Search Project Assets' },
        { action: 'searchTemplates', label: 'Search Templates' },
        { action: 'searchDashboard', label: 'Search Dashboard' },
        { action: 'findInCurrentResource', label: 'Find In Current Resource' },
        { action: 'findNextMatch', label: 'Find Next Match' },
        { action: 'findPreviousMatch', label: 'Find Previous Match' },
        { action: 'nextSearchResult', label: 'Next Search Result' },
        { action: 'previousSearchResult', label: 'Previous Search Result' },
        { action: 'clearSearchHighlights', label: 'Clear Search Highlights' },
        { action: 'clearSearchHistory', label: 'Clear Search History' },
        { action: 'saveCurrentSearch', label: 'Save Current Search' },
        { action: 'openSavedSearches', label: 'Open Saved Searches' },
        { action: 'addField', label: 'Add field in Report Builder' },
        { action: 'done', label: 'Complete Builder and move to Editor' },
        { action: 'addEntry', label: 'Add entry in Report Editor' },
        { action: 'attachFile', label: 'Attach File in Report Editor' },
        { action: 'openProject', label: 'Open ART Project' },
        { action: 'saveProject', label: 'Save ART Project' },
        { action: 'saveProjectAs', label: 'Save ART Project As' },
        { action: 'importData', label: 'Import Data' },
        { action: 'newProjectWorkspace', label: 'Create new Project Workspace' },
        { action: 'openProjectWorkspace', label: 'Open Project Workspace' },
        { action: 'openRecentProjectWorkspace', label: 'Open recent Project Workspace' },
        { action: 'continueWorking', label: 'Continue Working' },
        { action: 'closeProjectWorkspace', label: 'Close Workspace' },
        { action: 'saveProjectWorkspace', label: 'Save Project Workspace' },
        { action: 'saveProjectWorkspaceAs', label: 'Save Project Workspace As' },
        { action: 'renameProjectWorkspace', label: 'Rename Project Workspace' },
        { action: 'duplicateProjectWorkspace', label: 'Duplicate Project Workspace' },
        { action: 'importProjectWorkspace', label: 'Import Project Workspace' },
        { action: 'exportProjectWorkspace', label: 'Export Project Workspace' },
        { action: 'deleteProjectWorkspace', label: 'Delete Project Workspace' },
        { action: 'addProjectAsset', label: 'Add Project Asset' },
        { action: 'createAssetFolder', label: 'Create Asset Folder' },
        { action: 'removeProjectAsset', label: 'Remove Project Asset' },
        { action: 'refreshWorkspaceAssets', label: 'Refresh Workspace Assets' },
        { action: 'openProjectProperties', label: 'Open Project Properties' },
        { action: 'openResourceRelationships', label: 'Show Resource Relationships' },
        { action: 'openResourceDependents', label: 'Show Resource Dependents' },
        { action: 'openResourceReferences', label: 'Show Resource References' },
        { action: 'previewResourceDeletionImpact', label: 'Preview Resource Deletion Impact' },
        { action: 'repairWorkspaceRelationships', label: 'Repair Workspace Relationships' },
        { action: 'openTagManager', label: 'Open Tag Manager' },
        { action: 'createTag', label: 'Create Tag' },
        { action: 'assignTagToSelectedResource', label: 'Assign Tag To Selected Resource' },
        { action: 'removeTagFromSelectedResource', label: 'Remove Tag From Selected Resource' },
        { action: 'mergeTags', label: 'Merge Tags' },
        { action: 'openCollectionManager', label: 'Open Collection Manager' },
        { action: 'createCollection', label: 'Create Collection' },
        { action: 'addSelectedResourceToCollection', label: 'Add Selected Resource To Collection' },
        { action: 'removeSelectedResourceFromCollection', label: 'Remove Selected Resource From Collection' },
        { action: 'openSavedViewManager', label: 'Open Saved View Manager' },
        { action: 'createSavedViewFromCurrentWorkingView', label: 'Create Saved View From Current Working View' },
        { action: 'openSavedView', label: 'Open Saved View' },
        { action: 'deleteSavedView', label: 'Delete Saved View' },
        { action: 'exportResourceOrganizationMetadata', label: 'Export Resource Organization Metadata' },
        { action: 'importResourceOrganizationMetadata', label: 'Import Resource Organization Metadata' },
        { action: 'toggleTagFavorite', label: 'Toggle Tag Favorite' },
        { action: 'toggleCollectionFavorite', label: 'Toggle Collection Favorite' },
        { action: 'toggleSavedViewFavorite', label: 'Toggle Saved View Favorite' },
        { action: 'openProjectStatistics', label: 'Open Project Statistics' },
        { action: 'openWorkspaceSettings', label: 'Open Workspace Settings' },
        { action: 'openReport', label: 'Open/Import report' },
        { action: 'exportReport', label: 'Export report' },
        { action: 'newReport', label: 'Create new report' },
        { action: 'newReportFromTemplate', label: 'Create new report from template' },
        { action: 'resetLookup', label: 'Reset Accessibility Lookup Tool' },
        { action: 'closeReport', label: 'Close Report' },
        { action: 'closeWorkingView', label: 'Close Working View' },
        { action: 'configureReport', label: 'Configure Report' },
        { action: 'renameReport', label: 'Rename Report' },
        { action: 'replaceReport', label: 'Replace Report' },
        { action: 'editReport', label: 'Edit Report' },
        { action: 'viewReport', label: 'View Report' },
        { action: 'deleteReport', label: 'Delete Report' },
        { action: 'newTemplate', label: 'Create Template' },
        { action: 'useTemplate', label: 'Use Template' },
        { action: 'openTemplate', label: 'View Template' },
        { action: 'renameTemplate', label: 'Rename Template' },
        { action: 'replaceTemplate', label: 'Replace Template' },
        { action: 'editTemplate', label: 'Edit Template' },
        { action: 'deleteTemplate', label: 'Delete Template' },
        { action: 'importTemplate', label: 'Import Template' },
        { action: 'exportTemplate', label: 'Export Template' },
        { action: 'openSettings', label: 'Open Application Settings' },
        { action: 'settingsClose', label: 'Close Application Settings' },
        { action: 'settingsRestoreShortcuts', label: 'Restore Default Shortcuts' },
        { action: 'settingsImportStandard', label: 'Import Accessibility Standard' },
        { action: 'settingsPasteStandardTable', label: 'Paste Standards As Table' },
        { action: 'settingsImportReportFile', label: 'Import Report File from Device' },
        { action: 'settingsImportTemplateFile', label: 'Import Template File from Device' },
        { action: 'settingsOpenIntegrations', label: 'Open Integrations Section' },
        { action: 'settingsCustomizeAnalytics', label: 'Open Analytics Settings Section' },
        { action: 'settingsCustomizeCollaboration', label: 'Open Collaboration Settings Section' },
        { action: 'toggleCollaboration', label: 'Toggle Collaboration' },
        { action: 'toggleCollaborationToolbar', label: 'Toggle Collaboration Toolbar' },
        { action: 'settingsCollaborationApplySoloDefaults', label: 'Apply Collaboration Solo Defaults' },
        { action: 'settingsCollaborationApplyTeamDefaults', label: 'Apply Collaboration Team Defaults' },
        { action: 'settingsCollaborationResetBaseline', label: 'Reset Collaboration Baseline' },
        { action: 'settingsCollaborationRecordSyncCheckpoint', label: 'Record Collaboration Sync Checkpoint' },
        { action: 'settingsCollaborationGenerateDiscoverySnapshot', label: 'Generate Collaboration Discovery Snapshot' },
        { action: 'settingsCollaborationQueueTestConflict', label: 'Queue Collaboration Test Conflict' },
        { action: 'settingsCollaborationResolveOldestConflict', label: 'Resolve Oldest Collaboration Conflict' },
        { action: 'settingsCollaborationRegisterPresenceSession', label: 'Register Collaboration Presence Session' },
        { action: 'settingsCollaborationClearSessions', label: 'Clear Collaboration Sessions' },
        { action: 'settingsCollaborationLiveQuickStart', label: 'Quick Start Live Collaboration' },
        { action: 'settingsCollaborationLiveConnect', label: 'Connect Live Collaboration Server' },
        { action: 'settingsCollaborationLiveDisconnect', label: 'Disconnect Live Collaboration Server' },
        { action: 'settingsCollaborationLiveStartSession', label: 'Start Live Collaboration Session' },
        { action: 'settingsCollaborationPublishAsyncSnapshot', label: 'Publish Async Collaboration Snapshot' },
        { action: 'settingsCollaborationPullAsyncSnapshot', label: 'Pull Async Collaboration Snapshot' },
        { action: 'settingsPluginInstall', label: 'Install Plugin Manifest' },
        { action: 'settingsPluginValidate', label: 'Validate Plugin Extensions' },
        { action: 'settingsPluginRefresh', label: 'Refresh Plugin Manager' },
        { action: 'settingsPluginExportConfig', label: 'Export Plugin Framework Configuration' },
        { action: 'settingsPluginImportConfig', label: 'Import Plugin Framework Configuration' },
        { action: 'settingsTogglePrivacyMode', label: 'Toggle Privacy Mode' },
        { action: 'settingsCreateBackup', label: 'Create Backup' },
        { action: 'settingsResetApp', label: 'Reset ART Application Data' },
        { action: 'settingsCloseReport', label: 'Close Report from Settings' },
        { action: 'copyEntry', label: 'Copy Entry' },
        { action: 'copyName', label: 'Copy Name' },
        { action: 'copyDescription', label: 'Copy Description' },
        { action: 'copyFailures', label: 'Copy Failures' },
        { action: 'copyFixes', label: 'Copy Fixes' },
        { action: 'copyLink', label: 'Copy References' }
    ];

    const knownActions = new Set(assignableActions.map((definition) => definition.action));
    getRuntimeTopLevelMenuShortcutDefinitions(appState.shortcuts).forEach((definition) => {
        if (knownActions.has(definition.action)) return;
        assignableActions.push({
            action: definition.action,
            label: definition.label
        });
        knownActions.add(definition.action);
    });

    return assignableActions;
}

function normalizeImportedCriterion(criterion, defaultStandard) {
    const number = String(criterion?.number || '').trim();
    const title = String(criterion?.title || criterion?.name || '').trim();
    const desc = String(criterion?.desc || criterion?.description || '').trim();
    const level = String(criterion?.level || '').trim();
    const understandingUrl = String(criterion?.understandingUrl || criterion?.Link || '').trim();
    const identifierSeed = number || title || `${Math.random().toString(36).slice(2)}`;

    return {
        standard: String(defaultStandard || ''),
        identifier: String(criterion?.identifier || `${String(defaultStandard || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${identifierSeed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
        number,
        title,
        level,
        desc,
        understandingUrl,
        recommendationUrl: String(criterion?.recommendationUrl || '').trim(),
        failures: String(criterion?.failures || '').trim(),
        fixes: String(criterion?.fixes || '').trim(),
        disabilitie: String(criterion?.disabilitie || criterion?.disabilities || '').trim(),
        categories: String(criterion?.categories || '').trim(),
        tags: Array.isArray(criterion?.tags)
            ? criterion.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : String(criterion?.tags || '').split('|').map((tag) => tag.trim()).filter(Boolean)
    };
}

function normalizeImportedStandard(standard) {
    const displayName = String(standard?.displayName || '').trim();
    const internalId = String(standard?.internalId || standard?.id || '').trim();
    const version = String(standard?.version || '').trim();
    const source = String(standard?.source || '').trim();
    const criteria = Array.isArray(standard?.criteria)
        ? standard.criteria
        : [];

    return {
        id: String(standard?.id || `standard-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
        internalId,
        displayName: displayName || internalId || 'Imported Standard',
        version,
        source,
        importedAt: String(standard?.importedAt || new Date().toISOString()),
        criteria: criteria.map((criterion) => normalizeImportedCriterion(criterion, displayName || internalId || 'Imported Standard'))
    };
}

function normalizeImportedStandards(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeImportedStandard);
}

function normalizeUserStandards(list) {
    return normalizeImportedStandards(list);
}

function normalizeSpellUserDictionary(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const normalized = [];
    list.forEach((entry) => {
        const value = String(entry || '').trim();
        if (!value) return;
        if (seen.has(value)) return;
        seen.add(value);
        normalized.push(value);
    });
    return normalized;
}

const builtInTemplates = [
    {
        id: 'builtin-audit-log-basic',
        name: 'Audit Log Basic',
        data: {
            ...reportDefaults,
            reportTitle: 'Audit Log Template',
            reportType: 'Audit Log',
            reportLayout: 'Tabular',
            fields: [
                { label: 'Page', type: 'text', dropdownOptions: [] },
                { label: 'Issue', type: 'textarea', dropdownOptions: [] },
                { label: 'Severity', type: 'dropdown', dropdownOptions: ['Low', 'Medium', 'High', 'Critical'] }
            ]
        }
    },
    {
        id: 'builtin-exec-summary-basic',
        name: 'Executive Summary Basic',
        data: {
            ...reportDefaults,
            reportTitle: 'Executive Summary Template',
            reportType: 'Executive Summary',
            reportLayout: 'Bullets',
            fields: [
                { label: 'Overview', type: 'textarea', dropdownOptions: [] },
                { label: 'Top Findings', type: 'textarea', dropdownOptions: [] },
                { label: 'Risk Level', type: 'dropdown', dropdownOptions: ['Low', 'Moderate', 'High'] }
            ]
        }
    }
];

function normalizeField(field) {
    const normalizedType = field?.type === 'select' ? 'dropdown' : field?.type || 'text';
    const dropdownOptions = Array.isArray(field?.dropdownOptions)
        ? field.dropdownOptions
        : typeof field?.dropdownOptions === 'string'
            ? field.dropdownOptions.split('\n')
            : [];

    return {
        ...field,
        type: normalizedType,
        dropdownOptions: dropdownOptions.map((option) => option.trim()).filter(Boolean)
    };
}

function normalizeEditorFieldValue(value) {
    if (Array.isArray(value)) return normalizeAttachmentFieldValue(value);
    if (value && typeof value === 'object' && Array.isArray(value.files)) {
        return normalizeAttachmentFieldValue(value.files);
    }
    if (value && typeof value === 'object' && 'dataBase64' in value && 'name' in value) {
        return normalizeAttachmentFieldValue([value]);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    if (!('identifier' in value) && !('number' in value) && !('title' in value)) return value;

    return {
        standard: String(value.standard || ''),
        identifier: String(value.identifier || ''),
        number: String(value.number || ''),
        title: String(value.title || ''),
        level: String(value.level || ''),
        understandingUrl: String(value.understandingUrl || ''),
        recommendationUrl: String(value.recommendationUrl || '')
    };
}

function normalizeAttachmentFieldValue(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => normalizeAttachmentItem(item, index))
        .filter(Boolean);
}

function normalizeAttachmentItem(item, index) {
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name || '').trim();
    const dataBase64 = String(item.dataBase64 || '').trim();
    if (!name || !dataBase64) return null;

    const safeSize = Number(item.size);
    const safeLastModified = Number(item.lastModified);
    return {
        id: String(item.id || `attachment-${Date.now()}-${index}`),
        name,
        type: String(item.type || 'application/octet-stream'),
        size: Number.isFinite(safeSize) && safeSize >= 0 ? safeSize : 0,
        lastModified: Number.isFinite(safeLastModified) && safeLastModified >= 0 ? safeLastModified : 0,
        dataBase64
    };
}

function normalizeEditorFieldValues(values) {
    if (!values || typeof values !== 'object') return {};
    const normalized = {};
    Object.entries(values).forEach(([key, value]) => {
        normalized[key] = normalizeEditorFieldValue(value);
    });
    return normalized;
}

function createBlankFieldValues(fields) {
    const values = {};
    (fields || []).forEach((field, index) => {
        values[index] = '';
    });
    return values;
}

function normalizeAuditEntry(entry, fields, fallbackId) {
    const fieldValues = normalizeEditorFieldValues(entry?.fieldValues);
    const normalizedFieldValues = { ...createBlankFieldValues(fields), ...fieldValues };
    return {
        id: String(entry?.id || fallbackId || `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
        fieldValues: normalizedFieldValues
    };
}

function normalizeAuditEntries(entries, fields, legacyEditorValues) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) {
        return [normalizeAuditEntry({ fieldValues: normalizeEditorFieldValues(legacyEditorValues) }, fields, 'entry-1')];
    }
    return list.map((entry, index) => normalizeAuditEntry(entry, fields, `entry-${index + 1}`));
}

function normalizeSavedReport(report, index) {
    const rawData = report?.data && typeof report.data === 'object' ? report.data : {};
    const fields = Array.isArray(rawData.fields) ? rawData.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(rawData.editorFieldValues);
    const auditEntries = normalizeAuditEntries(rawData.auditEntries, fields, editorFieldValues);
    const reportType = String(rawData.reportType || reportDefaults.reportType);
    const progressItems = normalizeProgressItems(rawData.progressItems);

    return {
        id: String(report?.id || `report-${Date.now()}-${index}`),
        name: String(report?.name || rawData.reportTitle || `Untitled Report ${index + 1}`),
        updatedAt: Number(report?.updatedAt || Date.now()),
        data: {
            ...reportDefaults,
            ...rawData,
            branding: normalizeBranding(rawData.branding),
            progressLogEnabled: normalizeProgressLogEnabled(rawData.progressLogEnabled, reportType),
            progressLogAppendixEnabled: normalizeProgressLogAppendixEnabled(rawData.progressLogAppendixEnabled, reportType),
            progressItems,
            fields,
            editorFieldValues,
            auditEntries,
            activeAuditEntryIndex: Number(rawData.activeAuditEntryIndex || 0)
        }
    };
}

function normalizeReports(reports) {
    if (!Array.isArray(reports)) return [];
    return reports.map(normalizeSavedReport);
}

function normalizeTemplate(template) {
    const metadata = template?.metadata && typeof template.metadata === 'object'
        ? template.metadata
        : {};
    const rawData = template?.data && typeof template.data === 'object' ? template.data : {};
    const reportType = String(rawData.reportType || reportDefaults.reportType);
    const fields = Array.isArray(rawData.fields) ? rawData.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(rawData.editorFieldValues);

    return {
        id: template?.id || `user-${Date.now()}`,
        name: String(template?.name || 'Untitled Template').trim(),
        metadata: {
            schemaVersion: String(metadata.schemaVersion || '1.0'),
            exportedAt: String(metadata.exportedAt || ''),
            source: String(metadata.source || '')
        },
        data: {
            ...reportDefaults,
            ...rawData,
            branding: normalizeBranding(rawData.branding),
            progressLogEnabled: normalizeProgressLogEnabled(rawData.progressLogEnabled, reportType),
            progressLogAppendixEnabled: normalizeProgressLogAppendixEnabled(rawData.progressLogAppendixEnabled, reportType),
            progressItems: normalizeProgressItems(rawData.progressItems),
            fields,
            editorFieldValues,
            auditEntries: normalizeAuditEntries(rawData.auditEntries, fields, editorFieldValues),
            activeAuditEntryIndex: Number(rawData.activeAuditEntryIndex || 0)
        }
    };
}

// Initializing the application state from local storage or defaults
const storedState = JSON.parse(localStorage.getItem('art-state')) || {};
if (!Array.isArray(storedState.importedStandards) && Array.isArray(storedState.userStandards)) {
    storedState.importedStandards = storedState.userStandards;
}
const normalizedInitialFields = Array.isArray(storedState.fields) ? storedState.fields.map(normalizeField) : [];
const normalizedInitialEditorValues = normalizeEditorFieldValues(storedState.editorFieldValues);
const normalizedInitialUserStandards = normalizeUserStandards(storedState.userStandards || storedState.importedStandards);
export let appState = {
    ...defaultState,
    ...storedState,
    standard: normalizeStandardValue(storedState.standard),
    branding: normalizeBranding(storedState.branding),
    presentation: storedState.presentation && typeof storedState.presentation === 'object'
        ? {
            ...defaultState.presentation,
            ...storedState.presentation,
            resourceLibrary: {
                ...defaultState.presentation.resourceLibrary,
                ...(storedState.presentation.resourceLibrary && typeof storedState.presentation.resourceLibrary === 'object'
                    ? storedState.presentation.resourceLibrary
                    : {})
            },
            selection: {
                ...defaultState.presentation.selection,
                ...(storedState.presentation.selection && typeof storedState.presentation.selection === 'object'
                    ? storedState.presentation.selection
                    : {})
            },
            reportPresentation: {
                ...defaultState.presentation.reportPresentation,
                ...(storedState.presentation.reportPresentation && typeof storedState.presentation.reportPresentation === 'object'
                    ? storedState.presentation.reportPresentation
                    : {})
            },
            preview: {
                ...defaultState.presentation.preview,
                ...(storedState.presentation.preview && typeof storedState.presentation.preview === 'object'
                    ? storedState.presentation.preview
                    : {})
            },
            ui: {
                ...defaultState.presentation.ui,
                ...(storedState.presentation.ui && typeof storedState.presentation.ui === 'object'
                    ? storedState.presentation.ui
                    : {}),
                expandedSections: {
                    ...defaultState.presentation.ui.expandedSections,
                    ...(storedState.presentation.ui?.expandedSections && typeof storedState.presentation.ui.expandedSections === 'object'
                        ? storedState.presentation.ui.expandedSections
                        : {})
                }
            }
        }
        : defaultState.presentation,
    progressLogEnabled: normalizeProgressLogEnabled(storedState.progressLogEnabled, storedState.reportType),
    progressLogAppendixEnabled: normalizeProgressLogAppendixEnabled(storedState.progressLogAppendixEnabled, storedState.reportType),
    progressItems: normalizeProgressItems(storedState.progressItems),
    fields: normalizedInitialFields,
    editorFieldValues: normalizedInitialEditorValues,
    auditEntries: normalizeAuditEntries(storedState.auditEntries, normalizedInitialFields, normalizedInitialEditorValues),
    reports: normalizeReports(storedState.reports),
    selectedReportId: String(storedState.selectedReportId || ''),
    shortcuts: normalizeShortcuts(storedState.shortcuts),
    userStandards: normalizedInitialUserStandards,
    importedStandards: normalizeImportedStandards(storedState.importedStandards),
    spellUserDictionary: normalizeSpellUserDictionary(storedState.spellUserDictionary),
    integrations: normalizeIntegrationsConfig(storedState.integrations),
    projectDocument: normalizeProjectDocumentConfig(storedState.projectDocument),
    recentProjectFiles: normalizeRecentProjectFiles(storedState.recentProjectFiles),
    hasUnsavedChanges: Boolean(storedState.hasUnsavedChanges),
    security: normalizeSecurityConfig(storedState.security),
    visualAccessibility: normalizeVisualAccessibilityConfig(storedState.visualAccessibility),
    analytics: normalizeAnalyticsConfig(storedState.analytics),
    collaboration: normalizeCollaborationConfig(storedState.collaboration),
    workspaceView: normalizeWorkspaceViewConfig(storedState.workspaceView),
    userTemplates: Array.isArray(storedState.userTemplates)
        ? storedState.userTemplates.map(normalizeTemplate)
        : [],
    dashboard: normalizeDashboardConfig(storedState.dashboard),
    resourceOrganization: normalizeResourceOrganizationConfig(storedState.resourceOrganization),
    workspaces: normalizeProjectWorkspaces(storedState.workspaces),
    activeWorkspaceId: String(storedState.activeWorkspaceId || ''),
    recentProjectWorkspaces: normalizeRecentProjectWorkspaces(storedState.recentProjectWorkspaces),
    universalSearch: normalizeUniversalSearchConfig(storedState.universalSearch),
    navigationHistory: normalizeNavigationHistory(storedState.navigationHistory),
    organizationMetrics: normalizeOrganizationMetricsConfig(storedState.organizationMetrics)
};

function normalizeStateSnapshot(rawState) {
    const base = {
        ...defaultState,
        ...(rawState || {})
    };
    const fields = Array.isArray(base.fields) ? base.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(base.editorFieldValues);
    const reportType = String(base.reportType || defaultState.reportType);
    return {
        ...base,
        branding: normalizeBranding(base.branding),
        presentation: base.presentation && typeof base.presentation === 'object'
            ? {
                ...defaultState.presentation,
                ...base.presentation,
                resourceLibrary: {
                    ...defaultState.presentation.resourceLibrary,
                    ...(base.presentation.resourceLibrary && typeof base.presentation.resourceLibrary === 'object'
                        ? base.presentation.resourceLibrary
                        : {})
                },
                selection: {
                    ...defaultState.presentation.selection,
                    ...(base.presentation.selection && typeof base.presentation.selection === 'object'
                        ? base.presentation.selection
                        : {})
                },
                reportPresentation: {
                    ...defaultState.presentation.reportPresentation,
                    ...(base.presentation.reportPresentation && typeof base.presentation.reportPresentation === 'object'
                        ? base.presentation.reportPresentation
                        : {})
                },
                preview: {
                    ...defaultState.presentation.preview,
                    ...(base.presentation.preview && typeof base.presentation.preview === 'object'
                        ? base.presentation.preview
                        : {})
                },
                ui: {
                    ...defaultState.presentation.ui,
                    ...(base.presentation.ui && typeof base.presentation.ui === 'object'
                        ? base.presentation.ui
                        : {}),
                    expandedSections: {
                        ...defaultState.presentation.ui.expandedSections,
                        ...(base.presentation.ui?.expandedSections && typeof base.presentation.ui.expandedSections === 'object'
                            ? base.presentation.ui.expandedSections
                            : {})
                    }
                }
            }
            : defaultState.presentation,
        standard: normalizeStandardValue(base.standard),
        shortcuts: normalizeShortcuts(base.shortcuts),
        integrations: normalizeIntegrationsConfig(base.integrations),
        projectDocument: normalizeProjectDocumentConfig(base.projectDocument),
        recentProjectFiles: normalizeRecentProjectFiles(base.recentProjectFiles),
        hasUnsavedChanges: Boolean(base.hasUnsavedChanges),
        security: normalizeSecurityConfig(base.security),
        visualAccessibility: normalizeVisualAccessibilityConfig(base.visualAccessibility),
        analytics: normalizeAnalyticsConfig(base.analytics),
        collaboration: normalizeCollaborationConfig(base.collaboration),
        workspaceView: normalizeWorkspaceViewConfig(base.workspaceView),
        dashboard: normalizeDashboardConfig(base.dashboard),
        resourceOrganization: normalizeResourceOrganizationConfig(base.resourceOrganization),
        workspaces: normalizeProjectWorkspaces(base.workspaces),
        activeWorkspaceId: String(base.activeWorkspaceId || ''),
        recentProjectWorkspaces: normalizeRecentProjectWorkspaces(base.recentProjectWorkspaces),
        universalSearch: normalizeUniversalSearchConfig(base.universalSearch),
        navigationHistory: normalizeNavigationHistory(base.navigationHistory),
        organizationMetrics: normalizeOrganizationMetricsConfig(base.organizationMetrics),
        userStandards: normalizeUserStandards(base.userStandards || base.importedStandards),
        importedStandards: normalizeUserStandards(base.userStandards || base.importedStandards),
        spellUserDictionary: normalizeSpellUserDictionary(base.spellUserDictionary),
        progressLogEnabled: normalizeProgressLogEnabled(base.progressLogEnabled, reportType),
        progressLogAppendixEnabled: normalizeProgressLogAppendixEnabled(base.progressLogAppendixEnabled, reportType),
        progressItems: normalizeProgressItems(base.progressItems),
        fields,
        editorFieldValues,
        auditEntries: normalizeAuditEntries(base.auditEntries, fields, editorFieldValues),
        reports: normalizeReports(base.reports),
        selectedReportId: String(base.selectedReportId || ''),
        userTemplates: Array.isArray(base.userTemplates)
            ? base.userTemplates.map(normalizeTemplate)
            : []
    };
}

let isHistoryRestoreInProgress = false;
let pendingHistoryAction = 'Updated report state';
let lastSavedSnapshot = JSON.stringify(appState);

function persistCurrentState() {
    localStorage.setItem('art-state', JSON.stringify(appState));
}

function setAppStateFromSnapshot(snapshot) {
    const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    appState = normalizeStateSnapshot(parsed);
    lastSavedSnapshot = JSON.stringify(appState);
    persistCurrentState();
    window.dispatchEvent(new CustomEvent('art-state-restored'));
}

function inferHistoryResourceFromDescription(description = '') {
    const text = String(description || '').trim().toLowerCase();
    if (!text) {
        return {
            resourceType: 'application',
            resourceId: 'state',
            resourceName: 'Application State'
        };
    }

    if (text.includes('workspace')) {
        return {
            resourceType: 'workspace',
            resourceId: String(appState.activeWorkspaceId || 'active-workspace').trim() || 'active-workspace',
            resourceName: 'Project Workspace'
        };
    }

    if (text.includes('report')) {
        return {
            resourceType: 'report',
            resourceId: String(appState.selectedReportId || 'active-report').trim() || 'active-report',
            resourceName: String(appState.reportTitle || 'Report').trim() || 'Report'
        };
    }

    if (text.includes('template')) {
        return {
            resourceType: 'template',
            resourceId: String(appState.templateEditingId || appState.templateOption || 'active-template').trim() || 'active-template',
            resourceName: String(appState.templateName || 'Template').trim() || 'Template'
        };
    }

    if (text.includes('standard')) {
        return {
            resourceType: 'accessibility-standard',
            resourceId: String(appState.standard || 'active-standard').trim() || 'active-standard',
            resourceName: String(appState.standard || 'Accessibility Standard').trim() || 'Accessibility Standard'
        };
    }

    if (text.includes('tag')) {
        return {
            resourceType: 'tag',
            resourceId: 'active-tag',
            resourceName: 'Tag'
        };
    }

    if (text.includes('collection')) {
        return {
            resourceType: 'collection',
            resourceId: 'active-collection',
            resourceName: 'Collection'
        };
    }

    if (text.includes('saved view') || text.includes('working view')) {
        return {
            resourceType: 'saved-view',
            resourceId: 'active-saved-view',
            resourceName: 'Saved View'
        };
    }

    return {
        resourceType: 'application',
        resourceId: 'state',
        resourceName: 'Application State'
    };
}

configureHistoryFrameworkStateAdapter({
    getSnapshot: () => JSON.stringify(appState),
    applySnapshot: (snapshot) => {
        isHistoryRestoreInProgress = true;
        try {
            setAppStateFromSnapshot(snapshot);
            return true;
        } finally {
            isHistoryRestoreInProgress = false;
        }
    },
    normalizeSnapshot: (snapshot) => {
        const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
        return JSON.stringify(normalizeStateSnapshot(parsed));
    },
    inferResource: (_input, description) => inferHistoryResourceFromDescription(description)
});

function getCurrentReportSnapshotData() {
    return {
        reportTitle: appState.reportTitle,
        orgClient: appState.orgClient,
        product: appState.product,
        projectName: appState.projectName,
        scopeUrl: appState.scopeUrl,
        auditDateStart: appState.auditDateStart,
        auditDateEnd: appState.auditDateEnd,
        auditors: appState.auditors,
        standard: appState.standard,
        testingInstructions: appState.testingInstructions,
        reportType: appState.reportType,
        reportLayout: appState.reportLayout,
        templateOption: appState.templateOption,
        templateName: appState.templateName,
        templateDescription: appState.templateDescription,
        progressLogEnabled: appState.progressLogEnabled,
        progressLogAppendixEnabled: appState.progressLogAppendixEnabled,
        progressItems: normalizeProgressItems(appState.progressItems),
        branding: normalizeBranding(appState.branding),
        fields: appState.fields.map((field) => normalizeField(field)),
        editorFieldValues: normalizeEditorFieldValues(appState.editorFieldValues),
        auditEntries: normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues),
        activeAuditEntryIndex: appState.activeAuditEntryIndex
    };
}

function getUniqueReportName(baseName) {
    const safeBase = String(baseName || 'Untitled Report').trim() || 'Untitled Report';
    const existing = new Set((appState.reports || []).map((report) => String(report.name || '').toLowerCase()));
    if (!existing.has(safeBase.toLowerCase())) return safeBase;
    let suffix = 2;
    let candidate = `${safeBase} (${suffix})`;
    while (existing.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${safeBase} (${suffix})`;
    }
    return candidate;
}

function getUniqueTemplateName(baseName) {
    const safeBase = String(baseName || 'Untitled Template').trim() || 'Untitled Template';
    const existing = new Set([
        ...getBuiltInTemplates().map((template) => String(template.name || '').toLowerCase()),
        ...(appState.userTemplates || []).map((template) => String(template.name || '').toLowerCase())
    ]);

    if (!existing.has(safeBase.toLowerCase())) return safeBase;

    let suffix = 2;
    let candidate = `${safeBase} (${suffix})`;
    while (existing.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${safeBase} (${suffix})`;
    }
    return candidate;
}

function getReportDisplayName() {
    return String(appState.reportTitle || appState.templateName || 'Untitled Report').trim() || 'Untitled Report';
}

function getDefaultMetadataObject() {
    return {
        reportTitle: defaultState.reportTitle,
        orgClient: defaultState.orgClient,
        product: defaultState.product,
        projectName: defaultState.projectName,
        scopeUrl: defaultState.scopeUrl,
        auditDateStart: defaultState.auditDateStart,
        auditDateEnd: defaultState.auditDateEnd,
        auditors: defaultState.auditors,
        standard: defaultState.standard,
        testingInstructions: defaultState.testingInstructions,
        branding: normalizeBranding(defaultState.branding)
    };
}

function getDefaultBrandingForNewReport() {
    const activeWorkspace = getActiveProjectWorkspace();
    const workspaceBranding = activeWorkspace?.brandingDefaults
        || activeWorkspace?.integrationMetadata?.brandingDefaults
        || null;
    if (workspaceBranding && typeof workspaceBranding === 'object') {
        return normalizeBranding(workspaceBranding);
    }
    return normalizeBranding(defaultState.branding);
}

function keyToLabel(key) {
    const map = {
        reportTitle: 'Report Title',
        orgClient: 'Organization/Client',
        product: 'Product',
        projectName: 'Project Name',
        scopeUrl: 'URL / Scope',
        auditDateStart: 'Audit Start',
        auditDateEnd: 'Audit End',
        auditors: 'Auditor(s)',
        standard: 'Accessibility Standard',
        testingInstructions: 'Testing Instructions',
        branding: 'Branding',
        enabled: 'Enable Branding',
        headerText: 'Brand Header Text',
        headerHtml: 'Brand Header Rich Text (HTML)',
        footerHtml: 'Brand Footer Rich Text (HTML)',
        headerImages: 'Brand Header Images',
        footerImages: 'Brand Footer Images',
        pageMargins: 'Branding Page Margins',
        showPageNumbers: 'Show Branding Page Numbers',
        primaryColor: 'Primary Brand Color',
        logoDataUrl: 'Brand Logo (Data URL)',
        logoAltText: 'Logo Alternative Text',
        logoDecorative: 'Logo Is Decorative',
        logoFileName: 'Logo File Name'
    };
    if (map[key]) return map[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function flattenMetadataObject(value, path = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [{ path, value }];
    }
    return Object.entries(value).flatMap(([key, next]) => flattenMetadataObject(next, [...path, key]));
}

function setObjectPath(target, path, value) {
    if (path.length === 0) return;
    let ref = target;
    for (let i = 0; i < path.length - 1; i += 1) {
        const segment = path[i];
        if (!ref[segment] || typeof ref[segment] !== 'object') ref[segment] = {};
        ref = ref[segment];
    }
    ref[path[path.length - 1]] = value;
}

function castMetadataValue(path, value) {
    const key = path.join('.');
    if (key === 'standard') return normalizeStandardValue(String(value || defaultState.standard));
    if (key === 'branding.enabled' || key === 'branding.logoDecorative') {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return Boolean(value);
    }
    if (key === 'auditDateStart' || key === 'auditDateEnd') return String(value || '');
    return String(value || '');
}

function syncSelectedReportSnapshot() {
    if (!appState.selectedReportId) return;
    const index = (appState.reports || []).findIndex((report) => report.id === appState.selectedReportId);
    if (index < 0) return;
    appState.reports[index] = {
        ...appState.reports[index],
        name: getReportDisplayName(),
        updatedAt: Date.now(),
        data: getCurrentReportSnapshotData()
    };
}

function syncEditorValuesFromActiveEntry() {
    const activeEntry = appState.auditEntries[appState.activeAuditEntryIndex] || appState.auditEntries[0];
    appState.editorFieldValues = normalizeEditorFieldValues(activeEntry?.fieldValues || createBlankFieldValues(appState.fields));
}

function syncAuditEntriesFromEditorValues() {
    if (!Array.isArray(appState.auditEntries) || appState.auditEntries.length === 0) {
        appState.auditEntries = normalizeAuditEntries([], appState.fields, appState.editorFieldValues);
    }
    if (appState.activeAuditEntryIndex < 0 || appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = 0;
    }
    const activeEntry = appState.auditEntries[appState.activeAuditEntryIndex];
    if (activeEntry) {
        activeEntry.fieldValues = {
            ...createBlankFieldValues(appState.fields),
            ...normalizeEditorFieldValues(activeEntry.fieldValues),
            ...normalizeEditorFieldValues(appState.editorFieldValues)
        };
    }
}

export function getBuiltInTemplates() {
    return builtInTemplates.map(normalizeTemplate);
}

export function getUserTemplates() {
    return appState.userTemplates.map(normalizeTemplate);
}

export function getTemplateById(templateId) {
    if (!templateId) return null;
    const allTemplates = [...getBuiltInTemplates(), ...getUserTemplates()];
    return allTemplates.find((template) => template.id === templateId) || null;
}

function captureCurrentReportData() {
    return {
        reportTitle: appState.reportTitle,
        orgClient: appState.orgClient,
        product: appState.product,
        projectName: appState.projectName,
        scopeUrl: appState.scopeUrl,
        auditDateStart: appState.auditDateStart,
        auditDateEnd: appState.auditDateEnd,
        auditors: appState.auditors,
        standard: appState.standard,
        testingInstructions: appState.testingInstructions,
        reportType: appState.reportType,
        reportLayout: appState.reportLayout,
        fieldsExpanded: appState.fieldsExpanded,
        templateOption: appState.templateOption,
        templateName: appState.templateName,
        templateDescription: appState.templateDescription,
        progressLogEnabled: appState.progressLogEnabled,
        progressLogAppendixEnabled: appState.progressLogAppendixEnabled,
        progressItems: normalizeProgressItems(appState.progressItems),
        branding: normalizeBranding(appState.branding),
        presentation: appState.presentation && typeof appState.presentation === 'object'
            ? JSON.parse(JSON.stringify(appState.presentation))
            : JSON.parse(JSON.stringify(defaultState.presentation)),
        fields: appState.fields.map((field) => normalizeField(field)),
        editorFieldValues: normalizeEditorFieldValues(appState.editorFieldValues),
        auditEntries: normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues),
        activeAuditEntryIndex: Number(appState.activeAuditEntryIndex || 0)
    };
}

function applyReportData(data) {
    const reportType = String(data?.reportType || reportDefaults.reportType);
    const fields = Array.isArray(data?.fields) ? data.fields.map(normalizeField) : [];
    const editorFieldValues = normalizeEditorFieldValues(data?.editorFieldValues);
    const normalized = {
        ...reportDefaults,
        ...(data || {}),
        branding: normalizeBranding(data?.branding),
        presentation: data?.presentation && typeof data.presentation === 'object'
            ? {
                ...defaultState.presentation,
                ...data.presentation,
                resourceLibrary: {
                    ...defaultState.presentation.resourceLibrary,
                    ...(data.presentation.resourceLibrary && typeof data.presentation.resourceLibrary === 'object'
                        ? data.presentation.resourceLibrary
                        : {})
                },
                selection: {
                    ...defaultState.presentation.selection,
                    ...(data.presentation.selection && typeof data.presentation.selection === 'object'
                        ? data.presentation.selection
                        : {})
                },
                reportPresentation: {
                    ...defaultState.presentation.reportPresentation,
                    ...(data.presentation.reportPresentation && typeof data.presentation.reportPresentation === 'object'
                        ? data.presentation.reportPresentation
                        : {})
                },
                preview: {
                    ...defaultState.presentation.preview,
                    ...(data.presentation.preview && typeof data.presentation.preview === 'object'
                        ? data.presentation.preview
                        : {})
                },
                ui: {
                    ...defaultState.presentation.ui,
                    ...(data.presentation.ui && typeof data.presentation.ui === 'object'
                        ? data.presentation.ui
                        : {}),
                    expandedSections: {
                        ...defaultState.presentation.ui.expandedSections,
                        ...(data.presentation.ui?.expandedSections && typeof data.presentation.ui.expandedSections === 'object'
                            ? data.presentation.ui.expandedSections
                            : {})
                    }
                }
            }
            : JSON.parse(JSON.stringify(defaultState.presentation)),
        progressLogEnabled: normalizeProgressLogEnabled(data?.progressLogEnabled, reportType),
        progressLogAppendixEnabled: normalizeProgressLogAppendixEnabled(data?.progressLogAppendixEnabled, reportType),
        progressItems: normalizeProgressItems(data?.progressItems),
        fields,
        editorFieldValues,
        auditEntries: normalizeAuditEntries(data?.auditEntries, fields, editorFieldValues),
        activeAuditEntryIndex: Number(data?.activeAuditEntryIndex || 0)
    };

    Object.assign(appState, normalized, {
        editingIndex: -1,
        editorReadOnly: false,
        editorFieldValues: normalized.editorFieldValues,
        auditEntries: normalized.auditEntries,
        activeAuditEntryIndex: normalized.activeAuditEntryIndex
    });
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Applied report configuration' });
}

export function resetReportToBlank() {
    applyReportData({
        ...reportDefaults,
        branding: getDefaultBrandingForNewReport()
    });
    appState.templateEditingId = null;
    saveState({ action: 'Reset report to blank' });
}

export function loadTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    applyReportData(template.data);
    appState.templateEditingId = null;
    saveState({ action: `Loaded template ${template.name}` });
    return template;
}

export function createUserTemplate(name, templateData) {
    const templateName = String(name || '').trim();
    if (!templateName) return null;

    const template = normalizeTemplate({
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: templateName,
        metadata: {
            schemaVersion: '1.0',
            source: 'user'
        },
        data: templateData || captureCurrentReportData()
    });
    appState.userTemplates.push(template);
    saveState({ action: `Created template ${template.name}` });
    window.dispatchEvent(new Event('art-templates-updated'));
    return template;
}

export function createUserTemplateFromSelection(templateId, name) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    return createUserTemplate(name, template.data);
}

export function deleteUserTemplate(templateId) {
    const idx = appState.userTemplates.findIndex((template) => template.id === templateId);
    if (idx < 0) return null;
    const removed = appState.userTemplates.splice(idx, 1)[0];
    saveState({ action: `Deleted template ${removed.name}` });
    window.dispatchEvent(new Event('art-templates-updated'));
    return removed;
}

export function renameUserTemplateById(templateId, newName) {
    const idx = appState.userTemplates.findIndex((template) => template.id === templateId);
    if (idx < 0) return null;

    const name = String(newName || '').trim();
    if (!name) return null;

    const updatedTemplate = normalizeTemplate({
        ...appState.userTemplates[idx],
        name
    });
    appState.userTemplates[idx] = updatedTemplate;

    if (String(appState.templateEditingId || '').trim() === templateId) {
        appState.templateName = name;
    }

    saveState({ action: `Renamed template ${updatedTemplate.name}` });
    window.dispatchEvent(new Event('art-templates-updated'));
    return updatedTemplate;
}

export function saveCurrentReportToUserTemplate(templateId) {
    const idx = appState.userTemplates.findIndex((template) => template.id === templateId);
    if (idx < 0) return null;

    const resolvedTemplateName = String(
        appState.templateName || appState.reportTitle || appState.userTemplates[idx].name || 'Untitled Template'
    ).trim();

    const updatedTemplate = normalizeTemplate({
        ...appState.userTemplates[idx],
        name: resolvedTemplateName,
        data: captureCurrentReportData()
    });
    appState.userTemplates[idx] = updatedTemplate;
    saveState({ action: `Saved template ${updatedTemplate.name}` });
    window.dispatchEvent(new Event('art-templates-updated'));
    return updatedTemplate;
}

const ART_JSON_VERSION = '1.0';
const ART_JSON_WARNING = 'Warning: Do not edit. This file is used for importing your report back into ART and will not work if modified.';
const ART_TEMPLATE_JSON_VERSION = '1.0';
const ART_TEMPLATE_WARNING = 'Warning: Do not edit. This file is used for importing templates back into ART and may fail validation if modified.';
const ART_PROJECT_FORMAT_VERSION = '1.0';
const ART_PROJECT_SCHEMA_VERSION = '1.0';
const ART_TEMPLATE_FORMAT_VERSION = '1.0';
const ART_TEMPLATE_SCHEMA_VERSION = '1.0';

function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
}

function computeFNV1a32(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = (hash >>> 0) * 0x01000193;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function cloneCurrentAppState() {
    return cloneDeep(appState);
}

export function computeArtStateChecksum(reportState) {
    return computeFNV1a32(JSON.stringify(reportState));
}

export function createArtJsonPayload(reportState = cloneCurrentAppState()) {
    const safeState = cloneDeep(reportState);
    return {
        artVersion: ART_JSON_VERSION,
        _warning: ART_JSON_WARNING,
        integrity: {
            algorithm: 'fnv1a-32',
            reportStateChecksum: computeArtStateChecksum(safeState)
        },
        reportState: safeState
    };
}

export function serializeArtJsonPayload(reportState) {
    return JSON.stringify(createArtJsonPayload(reportState), null, 2);
}

function getAppVersionLabel() {
    const appName = String(APP_INFO.applicationName || 'ART').trim();
    const version = String(APP_INFO.version || 'unknown').trim();
    return `${appName} Version ${version}`;
}

function createProjectMetadata(overrides = {}) {
    const now = new Date().toISOString();
    const existing = normalizeProjectDocumentConfig(appState.projectDocument);
    const createdAt = String(overrides.createdAt || existing.createdAt || now);
    const lastModifiedAt = String(overrides.lastModifiedAt || now);
    return {
        formatVersion: ART_PROJECT_FORMAT_VERSION,
        schemaVersion: ART_PROJECT_SCHEMA_VERSION,
        createdWith: String(overrides.createdWith || existing.createdWith || getAppVersionLabel()),
        lastSavedWith: String(overrides.lastSavedWith || getAppVersionLabel()),
        createdAt,
        lastModifiedAt
    };
}

export function createArtProjectPayload() {
    return {
        format: 'ART Project',
        formatVersion: ART_PROJECT_FORMAT_VERSION,
        schemaVersion: ART_PROJECT_SCHEMA_VERSION,
        metadata: createProjectMetadata(),
        project: createManagedDataSnapshot()
    };
}

export function serializeArtProjectPayload() {
    return JSON.stringify(createArtProjectPayload(), null, 2);
}

export function validateArtProjectPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') return { isValid: false, reason: 'invalid-payload' };
    if (String(payload.format || '').trim() !== 'ART Project') return { isValid: false, reason: 'invalid-format' };
    if (!String(payload.formatVersion || '').trim()) return { isValid: false, reason: 'missing-format-version' };
    if (!String(payload.schemaVersion || '').trim()) return { isValid: false, reason: 'missing-schema-version' };
    if (String(payload.formatVersion).trim() !== ART_PROJECT_FORMAT_VERSION) return { isValid: false, reason: 'unsupported-format-version' };
    if (String(payload.schemaVersion).trim() !== ART_PROJECT_SCHEMA_VERSION) return { isValid: false, reason: 'unsupported-schema-version' };
    if (!payload.project || typeof payload.project !== 'object') return { isValid: false, reason: 'missing-project-data' };
    if (!payload.metadata || typeof payload.metadata !== 'object') return { isValid: false, reason: 'missing-metadata' };

    return {
        isValid: true,
        reason: 'ok',
        payload: {
            ...payload,
            metadata: createProjectMetadata(payload.metadata)
        }
    };
}

export function importArtProjectPayload(input) {
    const validation = validateArtProjectPayload(input);
    if (!validation.isValid) return validation;

    applyManagedDataSnapshot(validation.payload.project);
    const fileName = String(validation.payload?.metadata?.fileName || appState.projectDocument.fileName || '');
    appState.projectDocument = normalizeProjectDocumentConfig({
        ...appState.projectDocument,
        ...validation.payload.metadata,
        fileName,
        hasRecoveredChanges: false,
        recoveryLabel: ''
    });
    appState.hasUnsavedChanges = false;
    saveState({ action: 'Opened ART project file', recordHistory: false });
    return validation;
}

export function createArtxTemplatePayload(template) {
    const normalized = normalizeTemplatePayloadData(template);
    return {
        format: 'ART Template',
        formatVersion: ART_TEMPLATE_FORMAT_VERSION,
        schemaVersion: ART_TEMPLATE_SCHEMA_VERSION,
        metadata: {
            createdWith: getAppVersionLabel(),
            exportedAt: new Date().toISOString()
        },
        template: {
            name: normalized.name,
            metadata: normalized.metadata,
            data: normalized.data
        }
    };
}

export function serializeArtxTemplatePayload(template) {
    return JSON.stringify(createArtxTemplatePayload(template), null, 2);
}

export function validateArtxTemplatePayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') return { isValid: false, reason: 'invalid-payload' };
    if (String(payload.format || '').trim() !== 'ART Template') return { isValid: false, reason: 'invalid-format' };
    if (!String(payload.formatVersion || '').trim()) return { isValid: false, reason: 'missing-format-version' };
    if (!String(payload.schemaVersion || '').trim()) return { isValid: false, reason: 'missing-schema-version' };
    if (String(payload.formatVersion).trim() !== ART_TEMPLATE_FORMAT_VERSION) return { isValid: false, reason: 'unsupported-format-version' };
    if (String(payload.schemaVersion).trim() !== ART_TEMPLATE_SCHEMA_VERSION) return { isValid: false, reason: 'unsupported-schema-version' };
    if (!payload.template || typeof payload.template !== 'object') return { isValid: false, reason: 'missing-template' };
    if (!String(payload.template.name || '').trim()) return { isValid: false, reason: 'missing-template-name' };
    if (!payload.template.data || typeof payload.template.data !== 'object') return { isValid: false, reason: 'missing-template-data' };

    return {
        isValid: true,
        reason: 'ok',
        payload: {
            ...payload,
            template: normalizeTemplatePayloadData(payload.template)
        }
    };
}

function normalizeTemplatePayloadData(templateData) {
    const normalized = normalizeTemplate({
        name: String(templateData?.name || 'Untitled Template'),
        metadata: templateData?.metadata,
        data: templateData?.data || {}
    });

    return {
        name: normalized.name,
        metadata: {
            schemaVersion: String(normalized.metadata?.schemaVersion || '1.0'),
            exportedAt: String(normalized.metadata?.exportedAt || ''),
            source: String(normalized.metadata?.source || '')
        },
        data: normalized.data
    };
}

export function createTemplateJsonPayload(template) {
    const normalized = normalizeTemplatePayloadData(template);
    return {
        artTemplateVersion: ART_TEMPLATE_JSON_VERSION,
        _warning: ART_TEMPLATE_WARNING,
        template: {
            name: normalized.name,
            metadata: {
                ...normalized.metadata,
                exportedAt: new Date().toISOString()
            },
            data: normalized.data
        }
    };
}

export function serializeTemplateJsonPayload(template) {
    return JSON.stringify(createTemplateJsonPayload(template), null, 2);
}

function normalizeAccessibilityStandardsPayload(standards) {
    const list = Array.isArray(standards) ? standards : getImportedAccessibilityStandards();
    return {
        artAccessibilityStandardsVersion: '1.0',
        exportedAt: new Date().toISOString(),
        standards: list.map((standard) => normalizeImportedStandard(standard))
    };
}

export function createAccessibilityStandardsJsonPayload(standards) {
    return normalizeAccessibilityStandardsPayload(standards);
}

export function serializeAccessibilityStandardsJsonPayload(standards) {
    return JSON.stringify(createAccessibilityStandardsJsonPayload(standards), null, 2);
}

export function validateTemplateJsonPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') {
        return { isValid: false, reason: 'invalid-payload' };
    }

    if (String(payload.format || '').trim() === 'ART Template') {
        return validateArtxTemplatePayload(payload);
    }

    if (payload.artTemplateVersion !== ART_TEMPLATE_JSON_VERSION || typeof payload._warning !== 'string') {
        return { isValid: false, reason: 'missing-template-header' };
    }

    if (!payload.template || typeof payload.template !== 'object') {
        return { isValid: false, reason: 'missing-template' };
    }

    if (!String(payload.template.name || '').trim()) {
        return { isValid: false, reason: 'missing-template-name' };
    }

    if (!payload.template.data || typeof payload.template.data !== 'object') {
        return { isValid: false, reason: 'missing-template-data' };
    }

    const normalizedTemplate = normalizeTemplatePayloadData(payload.template);
    return {
        isValid: true,
        reason: 'ok',
        payload: {
            ...payload,
            template: normalizedTemplate
        }
    };
}

export function validateArtJsonPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (!payload || typeof payload !== 'object') {
        return { isValid: false, reason: 'invalid-payload' };
    }

    if (payload.artVersion !== ART_JSON_VERSION || typeof payload._warning !== 'string') {
        return { isValid: false, reason: 'missing-required-header' };
    }

    const integrity = payload.integrity;
    if (
        !integrity
        || integrity.algorithm !== 'fnv1a-32'
        || typeof integrity.reportStateChecksum !== 'string'
    ) {
        return { isValid: false, reason: 'missing-integrity' };
    }

    if (!payload.reportState || typeof payload.reportState !== 'object') {
        return { isValid: false, reason: 'missing-report-state' };
    }

    const actualChecksum = computeArtStateChecksum(payload.reportState);
    if (actualChecksum !== integrity.reportStateChecksum) {
        return { isValid: false, reason: 'checksum-mismatch' };
    }

    return { isValid: true, reason: 'ok', payload };
}

export function importArtJsonPayload(input) {
    const validation = validateArtJsonPayload(input);
    if (!validation.isValid) return validation;

    const rawState = validation.payload.reportState || {};

    appState = normalizeStateSnapshot(rawState);
    saveState({ action: `Imported report ${appState.reportTitle || 'Untitled Report'}` });
    return validation;
}

export function templateNameExists(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;

    const allTemplates = [...getBuiltInTemplates(), ...getUserTemplates()];
    return allTemplates.some((template) => String(template.name || '').trim().toLowerCase() === normalized);
}

export function importTemplateWithConflictStrategy(templatePayload, strategy = 'copy') {
    const normalized = normalizeTemplatePayloadData(templatePayload);
    const importName = normalized.name;
    const existingIndex = appState.userTemplates.findIndex(
        (template) => String(template.name || '').trim().toLowerCase() === importName.toLowerCase()
    );

    let targetName = importName;
    if (strategy === 'copy' || (strategy === 'replace' && existingIndex < 0 && templateNameExists(importName))) {
        targetName = getUniqueTemplateName(importName);
    }

    const importedTemplate = normalizeTemplate({
        id: existingIndex >= 0 && strategy === 'replace'
            ? appState.userTemplates[existingIndex].id
            : `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: targetName,
        metadata: {
            schemaVersion: String(normalized.metadata?.schemaVersion || '1.0'),
            source: 'import',
            exportedAt: String(normalized.metadata?.exportedAt || '')
        },
        data: normalized.data
    });

    if (existingIndex >= 0 && strategy === 'replace') {
        appState.userTemplates[existingIndex] = importedTemplate;
    } else {
        appState.userTemplates.push(importedTemplate);
    }

    appState.lastCreatedTemplateId = importedTemplate.id;
    saveState({ action: `Imported template ${importedTemplate.name}` });
    window.dispatchEvent(new Event('art-templates-updated'));
    return importedTemplate;
}

/**
 * Persists current state to local browser storage.
 */
export function saveState(options = {}) {
    const action = String(options.action || pendingHistoryAction || 'Updated report state');
    const shouldRecordHistory = options.recordHistory !== false;
    const previousSnapshot = lastSavedSnapshot;
    syncSelectedReportSnapshot();
    const nextSnapshot = JSON.stringify(appState);

    if (shouldRecordHistory && !isHistoryRestoreInProgress && nextSnapshot !== lastSavedSnapshot) {
        pendingHistoryAction = action;
        recordStateChange({
            description: action,
            beforeSnapshot: previousSnapshot,
            afterSnapshot: nextSnapshot,
            resource: options.historyResource || inferHistoryResourceFromDescription(action)
        });
    }

    const changed = nextSnapshot !== lastSavedSnapshot;
    if (changed) {
        appState.hasUnsavedChanges = true;
    }

    if (options.markProjectSaved === true) {
        appState.hasUnsavedChanges = false;
        appState.projectDocument = normalizeProjectDocumentConfig({
            ...appState.projectDocument,
            ...createProjectMetadata({
                createdAt: appState.projectDocument.createdAt || new Date().toISOString()
            }),
            hasRecoveredChanges: false,
            recoveryLabel: ''
        });
    }

    lastSavedSnapshot = JSON.stringify(appState);
    persistCurrentState();
    window.dispatchEvent(new Event('art-state-updated'));
}

export function setHistoryAction(action) {
    pendingHistoryAction = String(action || 'Updated report state');
    setCentralPendingHistoryAction(pendingHistoryAction);
}

export function undoState() {
    if (!canUndo()) {
        announce('Nothing to undo.');
        return false;
    }

    const result = requestUndo({ source: 'state-wrapper' });
    if (!result.ok) {
        announce('Undo failed.');
        return false;
    }

    announce(`Undo: ${result.description || getUndoDescription() || 'Completed action'}.`);
    return true;
}

export function redoState() {
    if (!canRedo()) {
        announce('Nothing to redo.');
        return false;
    }

    const result = requestRedo({ source: 'state-wrapper' });
    if (!result.ok) {
        announce('Redo failed.');
        return false;
    }

    announce(`Redo: ${result.description || getRedoDescription() || 'Completed action'}.`);
    return true;
}

export function canUndoState() {
    return canUndo();
}

export function canRedoState() {
    return canRedo();
}

export function getUndoStateDescription() {
    return getUndoDescription();
}

export function getRedoStateDescription() {
    return getRedoDescription();
}

export function getRecentReports() {
    return [...(appState.reports || [])].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export function getProjectDocumentInfo() {
    return normalizeProjectDocumentConfig(appState.projectDocument);
}

export function hasUnsavedProjectChanges() {
    return Boolean(appState.hasUnsavedChanges);
}

export function markProjectRecovered(label = 'Recovered changes available') {
    appState.projectDocument = normalizeProjectDocumentConfig({
        ...appState.projectDocument,
        hasRecoveredChanges: true,
        recoveryLabel: String(label || 'Recovered changes available')
    });
    saveState({ action: 'Marked project recovery state', recordHistory: false });
}

export function clearProjectRecoveryMark() {
    appState.projectDocument = normalizeProjectDocumentConfig({
        ...appState.projectDocument,
        hasRecoveredChanges: false,
        recoveryLabel: ''
    });
    saveState({ action: 'Cleared project recovery state', recordHistory: false });
}

export function updateProjectDocumentInfo(updates = {}, options = {}) {
    const next = normalizeProjectDocumentConfig({
        ...appState.projectDocument,
        ...(updates && typeof updates === 'object' ? updates : {})
    });
    appState.projectDocument = next;

    if (updates.fileName || updates.filePath || updates.lastModifiedAt || updates.createdAt) {
        const newEntry = normalizeRecentProjectFile({
            id: `${String(updates.filePath || updates.fileName || 'project')}-${Date.now()}`,
            fileName: String(updates.fileName || next.fileName || 'Untitled.art'),
            filePath: String(updates.filePath || next.filePath || ''),
            lastOpenedAt: String(updates.lastModifiedAt || new Date().toISOString()),
            status: next.hasRecoveredChanges ? 'recovered' : 'saved'
        });
        const deduped = [newEntry, ...(appState.recentProjectFiles || [])].filter((item, index, arr) => {
            const key = `${String(item.fileName || '').toLowerCase()}|${String(item.filePath || '').toLowerCase()}`;
            return arr.findIndex((candidate) => `${String(candidate.fileName || '').toLowerCase()}|${String(candidate.filePath || '').toLowerCase()}` === key) === index;
        });
        appState.recentProjectFiles = normalizeRecentProjectFiles(deduped);
    }

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated project document'), recordHistory: false });
    }
    return next;
}

export function getRecentProjectFiles() {
    return normalizeRecentProjectFiles(appState.recentProjectFiles);
}

function dispatchWorkspaceEvent(type, detail = {}) {
    const payload = {
        type: String(type || 'WorkspaceUpdated'),
        at: new Date().toISOString(),
        ...detail
    };
    window.dispatchEvent(new CustomEvent('art-workspace-event', { detail: payload }));
    window.dispatchEvent(new CustomEvent(`art-workspace-${payload.type}`, { detail: payload }));
}

function withWorkspaceIndex(workspaceId) {
    const id = String(workspaceId || appState.activeWorkspaceId || '').trim();
    const index = (appState.workspaces || []).findIndex((workspace) => workspace.id === id);
    return { id, index };
}

export function getProjectWorkspaces() {
    return normalizeProjectWorkspaces(appState.workspaces);
}

export function getActiveProjectWorkspace() {
    const { index } = withWorkspaceIndex(appState.activeWorkspaceId);
    if (index < 0) return null;
    return normalizeProjectWorkspace(appState.workspaces[index]);
}

export function getRecentProjectWorkspaces() {
    return normalizeRecentProjectWorkspaces(appState.recentProjectWorkspaces);
}

export function getUniversalSearchConfig() {
    return normalizeUniversalSearchConfig(appState.universalSearch);
}

function normalizeNavigationEntry(entry, index) {
    const source = entry && typeof entry === 'object' ? entry : {};
    return {
        id: String(source.id || `navigation-${index}`),
        label: String(source.label || '').trim(),
        context: String(source.context || '').trim(),
        targetType: String(source.targetType || source.type || '').trim(),
        payload: source.payload && typeof source.payload === 'object' ? source.payload : null,
        focusId: String(source.focusId || '').trim(),
        breadcrumbs: Array.isArray(source.breadcrumbs)
            ? source.breadcrumbs.map((crumb) => ({
                label: String(crumb?.label || '').trim(),
                payload: crumb?.payload && typeof crumb.payload === 'object' ? crumb.payload : null
            })).filter((crumb) => crumb.label)
            : [],
        visitedAt: String(source.visitedAt || new Date().toISOString())
    };
}

function normalizeNavigationHistory(history) {
    const source = history && typeof history === 'object' ? history : {};
    const maxEntries = Number.isFinite(Number(source.maxEntries)) && Number(source.maxEntries) > 0
        ? Math.min(200, Math.floor(Number(source.maxEntries)))
        : 50;
    const entries = Array.isArray(source.entries)
        ? source.entries.map((entry, index) => normalizeNavigationEntry(entry, index)).filter((entry) => entry.label).slice(-maxEntries)
        : [];
    const rawIndex = Number.isFinite(Number(source.currentIndex)) ? Math.floor(Number(source.currentIndex)) : entries.length - 1;

    return {
        enabled: source.enabled !== false,
        breadcrumbsEnabled: source.breadcrumbsEnabled !== false,
        maxEntries,
        entries,
        currentIndex: Math.max(-1, Math.min(rawIndex, entries.length - 1))
    };
}

function normalizeOrganizationMetricsConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    return {
        enabled: source.enabled === true,
        dashboardSectionVisible: source.dashboardSectionVisible !== false,
        selectedOrganization: String(source.selectedOrganization || '').trim(),
        activeTab: String(source.activeTab || 'overview').trim() || 'overview',
        visibleTabs: Array.isArray(source.visibleTabs)
            ? source.visibleTabs.map((tab) => String(tab || '').trim()).filter(Boolean)
            : [],
        defaultDateRange: String(source.defaultDateRange || 'all').trim() || 'all',
        showProductAnalytics: source.showProductAnalytics !== false,
        showTesterAnalytics: source.showTesterAnalytics !== false,
        showRecurrenceAnalytics: source.showRecurrenceAnalytics !== false,
        showAccessibilityHealth: source.showAccessibilityHealth !== false,
        showBenchmarking: source.showBenchmarking !== false
    };
}

export function getOrganizationMetricsConfig() {
    return normalizeOrganizationMetricsConfig(appState.organizationMetrics);
}

export function isOrganizationStatisticsEnabled() {
    return getOrganizationMetricsConfig().enabled === true;
}

export function updateOrganizationMetricsConfig(updates = {}, options = {}) {
    const next = normalizeOrganizationMetricsConfig({
        ...getOrganizationMetricsConfig(),
        ...(updates && typeof updates === 'object' ? updates : {})
    });
    appState.organizationMetrics = next;

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated organization metrics settings'), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-organization-metrics-updated', {
        detail: { type: String(options.eventType || 'organization-metrics-updated'), config: next }
    }));

    return next;
}

export function getNavigationHistory() {
    return normalizeNavigationHistory(appState.navigationHistory);
}

export function updateNavigationHistory(updates = {}, options = {}) {
    const next = normalizeNavigationHistory({
        ...getNavigationHistory(),
        ...(updates && typeof updates === 'object' ? updates : {})
    });
    appState.navigationHistory = next;

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated navigation history'), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-navigation-history-updated', {
        detail: { type: String(options.eventType || 'navigation-history-updated'), history: next }
    }));

    return next;
}

export function clearNavigationHistoryEntries(options = {}) {
    return updateNavigationHistory({ entries: [], currentIndex: -1 }, {
        ...options,
        action: String(options.action || 'Cleared navigation history'),
        eventType: 'navigation-history-cleared'
    });
}

export function getSearchAnalytics() {
    return getUniversalSearchConfig().analytics;
}

// Search analytics are personal, local, and aggregate only. No query text is stored.
export function recordSearchAnalyticsRun(entry = {}, options = {}) {
    const analytics = getSearchAnalytics();
    if (analytics.enabled === false) return false;

    const providerStats = { ...analytics.providerStats };
    (Array.isArray(entry.providerRuns) ? entry.providerRuns : []).forEach((run) => {
        const id = String(run?.providerId || '').trim();
        if (!id) return;
        const existing = providerStats[id] || {
            runs: 0, errors: 0, totalDurationMs: 0, resultCount: 0,
            lastSuccessAt: '', lastErrorAt: '', lastErrorMessage: ''
        };
        const failed = Boolean(run.error);
        providerStats[id] = {
            runs: existing.runs + 1,
            errors: existing.errors + (failed ? 1 : 0),
            totalDurationMs: existing.totalDurationMs + Math.max(0, Number(run.durationMs) || 0),
            resultCount: existing.resultCount + Math.max(0, Number(run.resultCount) || 0),
            lastSuccessAt: failed ? existing.lastSuccessAt : new Date().toISOString(),
            lastErrorAt: failed ? new Date().toISOString() : existing.lastErrorAt,
            lastErrorMessage: failed ? String(run.error).slice(0, 200) : existing.lastErrorMessage
        };
    });

    const next = {
        ...analytics,
        totalSearches: analytics.totalSearches + 1,
        noResultSearches: analytics.noResultSearches + (Number(entry.resultCount) === 0 ? 1 : 0),
        totalDurationMs: analytics.totalDurationMs + Math.max(0, Number(entry.durationMs) || 0),
        providerStats,
        lastUpdatedAt: new Date().toISOString()
    };

    return updateUniversalSearchConfig({ analytics: next }, {
        ...options,
        persist: options.persist === true,
        action: 'Recorded search analytics',
        eventType: 'search-analytics-updated'
    });
}

export function recordSearchResultSelection(options = {}) {
    const analytics = getSearchAnalytics();
    if (analytics.enabled === false) return false;

    return updateUniversalSearchConfig({
        analytics: {
            ...analytics,
            resultSelections: analytics.resultSelections + 1,
            lastUpdatedAt: new Date().toISOString()
        }
    }, {
        ...options,
        persist: true,
        action: 'Recorded search result selection',
        eventType: 'search-analytics-updated'
    });
}

export function setSearchAnalyticsEnabled(enabled, options = {}) {
    const analytics = getSearchAnalytics();
    return updateUniversalSearchConfig({ analytics: { ...analytics, enabled: Boolean(enabled) } }, {
        ...options,
        persist: true,
        action: 'Updated search analytics setting',
        eventType: 'search-analytics-updated'
    });
}

export function clearSearchAnalytics(options = {}) {
    const analytics = getSearchAnalytics();
    return updateUniversalSearchConfig({
        analytics: {
            enabled: analytics.enabled,
            totalSearches: 0,
            noResultSearches: 0,
            resultSelections: 0,
            totalDurationMs: 0,
            providerStats: {},
            lastUpdatedAt: ''
        }
    }, {
        ...options,
        persist: true,
        action: 'Cleared search analytics',
        eventType: 'search-analytics-cleared'
    });
}

export function getFavoriteItems() {
    const config = getUniversalSearchConfig();
    return Array.isArray(config.favorites) ? config.favorites : [];
}

export function isFavoriteResource(resultId) {
    const target = String(resultId || '').trim();
    if (!target) return false;
    return getFavoriteItems().some((item) => item.resultId === target);
}

export function addFavoriteItem(entry, options = {}) {
    const favorite = normalizeFavoriteItem({
        ...entry,
        id: entry?.id || `favorite-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        addedAt: new Date().toISOString()
    }, 0);
    if (!favorite.resultId && !favorite.title) return false;
    if (isFavoriteResource(favorite.resultId)) return false;

    const existing = getFavoriteItems();
    return updateUniversalSearchConfig({ favorites: [favorite, ...existing].slice(0, 200) }, {
        ...options,
        action: String(options.action || `Added ${favorite.title || 'resource'} to favorites`),
        eventType: 'favorites-updated'
    });
}

export function removeFavoriteItem(resultId, options = {}) {
    const target = String(resultId || '').trim();
    const existing = getFavoriteItems();
    const filtered = existing.filter((item) => item.resultId !== target && item.id !== target);
    if (filtered.length === existing.length) return false;

    return updateUniversalSearchConfig({ favorites: filtered }, {
        ...options,
        action: String(options.action || 'Removed resource from favorites'),
        eventType: 'favorites-updated'
    });
}

export function getBookmarks() {
    const config = getUniversalSearchConfig();
    return Array.isArray(config.bookmarks) ? config.bookmarks : [];
}

export function addBookmark(entry, options = {}) {
    const bookmark = normalizeBookmark({
        ...entry,
        id: entry?.id || `bookmark-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }, 0);
    if (!bookmark.name) return false;

    const existing = getBookmarks();
    return updateUniversalSearchConfig({ bookmarks: [bookmark, ...existing].slice(0, 200) }, {
        ...options,
        action: String(options.action || `Added bookmark ${bookmark.name}`),
        eventType: 'bookmarks-updated'
    });
}

export function updateBookmark(bookmarkId, updates = {}, options = {}) {
    const target = String(bookmarkId || '').trim();
    const existing = getBookmarks();
    let changed = false;
    const next = existing.map((item) => {
        if (item.id !== target) return item;
        changed = true;
        return normalizeBookmark({ ...item, ...updates, updatedAt: new Date().toISOString() }, 0);
    });
    if (!changed) return false;

    return updateUniversalSearchConfig({ bookmarks: next }, {
        ...options,
        action: String(options.action || 'Updated bookmark'),
        eventType: 'bookmarks-updated'
    });
}

export function removeBookmark(bookmarkId, options = {}) {
    const target = String(bookmarkId || '').trim();
    const existing = getBookmarks();
    const filtered = existing.filter((item) => item.id !== target);
    if (filtered.length === existing.length) return false;

    return updateUniversalSearchConfig({ bookmarks: filtered }, {
        ...options,
        action: String(options.action || 'Removed bookmark'),
        eventType: 'bookmarks-updated'
    });
}

export function clearBookmarks(options = {}) {
    return updateUniversalSearchConfig({ bookmarks: [] }, {
        ...options,
        action: String(options.action || 'Cleared bookmarks'),
        eventType: 'bookmarks-cleared'
    });
}

export function getRecentItems() {
    const config = getUniversalSearchConfig();
    return Array.isArray(config.recentItems) ? config.recentItems : [];
}

// Recent items are personal navigation data and are recorded only on a successful open.
export function recordRecentItem(entry, options = {}) {
    const config = getUniversalSearchConfig();
    if (config.recentItemsEnabled === false) return false;

    const nextEntry = normalizeRecentItem({
        ...entry,
        id: entry?.id || `recent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        openedAt: new Date().toISOString()
    }, 0);
    if (!nextEntry.title && !nextEntry.resultId) return false;

    const existing = Array.isArray(config.recentItems) ? config.recentItems : [];
    const deduped = [
        nextEntry,
        ...existing.filter((item) => !(item.resultId && item.resultId === nextEntry.resultId))
    ].slice(0, Number(config.maxRecentItems || 20));

    return updateUniversalSearchConfig({ recentItems: deduped }, {
        ...options,
        action: String(options.action || `Opened ${nextEntry.title || 'resource'}`),
        eventType: 'recent-items-updated'
    });
}

export function removeRecentItem(recentItemId, options = {}) {
    const config = getUniversalSearchConfig();
    const existing = Array.isArray(config.recentItems) ? config.recentItems : [];
    const targetId = String(recentItemId || '').trim();
    const filtered = existing.filter((item) => item.id !== targetId);
    if (filtered.length === existing.length) return false;

    return updateUniversalSearchConfig({ recentItems: filtered }, {
        ...options,
        action: String(options.action || 'Removed recent item'),
        eventType: 'recent-items-updated'
    });
}

export function clearRecentItems(options = {}) {
    return updateUniversalSearchConfig({ recentItems: [] }, {
        ...options,
        action: String(options.action || 'Cleared recent items'),
        eventType: 'recent-items-cleared'
    });
}

export function updateUniversalSearchConfig(updates = {}, options = {}) {
    const source = updates && typeof updates === 'object' ? updates : {};
    const next = normalizeUniversalSearchConfig({
        ...appState.universalSearch,
        ...source,
        activeSession: {
            ...(appState.universalSearch?.activeSession || {}),
            ...(source.activeSession && typeof source.activeSession === 'object' ? source.activeSession : {})
        },
        indexStatus: {
            ...(appState.universalSearch?.indexStatus || {}),
            ...(source.indexStatus && typeof source.indexStatus === 'object' ? source.indexStatus : {})
        }
    });
    appState.universalSearch = next;

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated universal search settings'), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-search-state-updated', {
        detail: {
            type: String(options.eventType || 'search-config-updated'),
            config: next
        }
    }));

    return getUniversalSearchConfig();
}

export function getWorkspaceViewConfig() {
    return normalizeWorkspaceViewConfig(appState.workspaceView);
}

export function getActiveWorkspaceView() {
    return normalizeWorkspaceViewName(appState.workspaceView?.active, 'dashboard');
}

export function setActiveWorkspaceView(view, options = {}) {
    const current = getWorkspaceViewConfig();
    const nextView = normalizeWorkspaceViewName(view, current.defaultView);

    appState.workspaceView = normalizeWorkspaceViewConfig({
        ...current,
        active: nextView
    });

    if (options.persist !== false) {
        saveState({ action: String(options.action || `Switched workspace view to ${nextView}`), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-workspace-view-changed', {
        detail: {
            active: nextView,
            config: getWorkspaceViewConfig()
        }
    }));

    return nextView;
}

export function updateWorkspaceViewConfig(updates = {}, options = {}) {
    const current = getWorkspaceViewConfig();
    const source = updates && typeof updates === 'object' ? updates : {};

    appState.workspaceView = normalizeWorkspaceViewConfig({
        ...current,
        ...source,
        explorer: {
            ...(current.explorer || {}),
            ...(source.explorer && typeof source.explorer === 'object' ? source.explorer : {})
        }
    });

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated workspace view settings'), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-workspace-view-settings-updated', {
        detail: {
            config: getWorkspaceViewConfig()
        }
    }));

    window.dispatchEvent(new CustomEvent('art-workspace-view-changed', {
        detail: {
            active: appState.workspaceView.active,
            config: getWorkspaceViewConfig()
        }
    }));

    return getWorkspaceViewConfig();
}

export function getAnalyticsConfig() {
    return normalizeAnalyticsConfig(appState.analytics);
}

export function updateAnalyticsConfig(updates = {}, options = {}) {
    const source = updates && typeof updates === 'object' ? updates : {};
    const next = normalizeAnalyticsConfig({
        ...appState.analytics,
        ...source,
        displayOptions: {
            ...(appState.analytics?.displayOptions || {}),
            ...(source.displayOptions && typeof source.displayOptions === 'object' ? source.displayOptions : {})
        },
        accessibilityOptions: {
            ...(appState.analytics?.accessibilityOptions || {}),
            ...(source.accessibilityOptions && typeof source.accessibilityOptions === 'object' ? source.accessibilityOptions : {})
        }
    });

    appState.analytics = next;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated analytics settings'), recordHistory: false });
    }

    window.dispatchEvent(new CustomEvent('art-analytics-settings-updated', {
        detail: {
            config: getAnalyticsConfig()
        }
    }));

    return getAnalyticsConfig();
}

export function getCollaborationConfig() {
    return normalizeCollaborationConfig(appState.collaboration);
}

export function updateCollaborationConfig(updates = {}, options = {}) {
    const source = updates && typeof updates === 'object' ? updates : {};
    const next = normalizeCollaborationConfig({
        ...appState.collaboration,
        ...source,
        resourceDefaults: {
            ...(appState.collaboration?.resourceDefaults || {}),
            ...(source.resourceDefaults && typeof source.resourceDefaults === 'object' ? source.resourceDefaults : {})
        },
        providerCapabilities: {
            ...(appState.collaboration?.providerCapabilities || {}),
            ...(source.providerCapabilities && typeof source.providerCapabilities === 'object' ? source.providerCapabilities : {})
        },
        permissions: {
            ...(appState.collaboration?.permissions || {}),
            ...(source.permissions && typeof source.permissions === 'object' ? source.permissions : {})
        },
        sharing: {
            ...(appState.collaboration?.sharing || {}),
            ...(source.sharing && typeof source.sharing === 'object' ? source.sharing : {})
        },
        synchronization: {
            ...(appState.collaboration?.synchronization || {}),
            ...(source.synchronization && typeof source.synchronization === 'object' ? source.synchronization : {})
        },
        live: {
            ...(appState.collaboration?.live || {}),
            ...(source.live && typeof source.live === 'object' ? source.live : {})
        }
    });

    appState.collaboration = next;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated collaboration settings'), recordHistory: false });
    }

    window.dispatchEvent(new Event('art-collaboration-updated'));

    return getCollaborationConfig();
}

export function resetCollaborationConfig(options = {}) {
    return updateCollaborationConfig(defaultState.collaboration, {
        ...options,
        action: String(options.action || 'Reset collaboration settings')
    });
}

export function isCollaborationEnabled() {
    return Boolean(getCollaborationConfig().enabled);
}

export function canShowCollaborationToolbar() {
    const collaboration = getCollaborationConfig();
    return collaboration.enabled && collaboration.showToolbar;
}

export function setCollaborationToolbarPosition(position, options = {}) {
    return updateCollaborationConfig({ toolbarPosition: String(position || '').trim() || defaultState.collaboration.toolbarPosition }, options);
}

export function normalizeCollaborationResourceMetadata(resourceType, metadata = {}) {
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    const allowedVisibility = new Set(['private', 'shared', 'workspace', 'organization', 'public']);
    const permissionProfile = String(source.permissionProfile || '').trim();
    const visibility = allowedVisibility.has(String(source.visibility || 'private').trim()) ? String(source.visibility || 'private').trim() : 'private';

    return {
        resourceType: String(resourceType || '').trim(),
        owner: String(source.owner || '').trim(),
        visibility,
        permissionProfile,
        permissionAssignments: Array.isArray(source.permissionAssignments)
            ? source.permissionAssignments.map((assignment) => ({
                principalId: String(assignment?.principalId || '').trim(),
                principalType: String(assignment?.principalType || 'user').trim(),
                permissions: Array.isArray(assignment?.permissions) ? assignment.permissions.map((item) => String(item || '').trim()).filter(Boolean) : [],
                source: String(assignment?.source || '').trim()
            })).filter((assignment) => assignment.principalId)
            : [],
        sharing: Array.isArray(source.sharing) ? source.sharing.map((item) => String(item || '').trim()).filter(Boolean) : [],
        comments: Array.isArray(source.comments)
            ? source.comments.map((comment) => ({
                at: String(comment?.at || '').trim(),
                author: String(comment?.author || '').trim(),
                text: String(comment?.text || '').trim()
            })).filter((comment) => comment.text)
            : [],
        auditHistory: Array.isArray(source.auditHistory)
            ? source.auditHistory.map((entry) => ({
                at: String(entry?.at || ''),
                action: String(entry?.action || 'Collaboration event'),
                detail: String(entry?.detail || '')
            }))
            : []
    };
}

export function setUniversalSearchScopePreference(scopePreference, options = {}) {
    return updateUniversalSearchConfig({ scopePreference }, {
        ...options,
        action: String(options.action || 'Updated search scope preference'),
        eventType: 'search-scope-preference-updated'
    });
}

export function recordUniversalSearchHistory(entry, options = {}) {
    const current = getUniversalSearchConfig();
    if (current.historyEnabled === false) return false;
    const existing = Array.isArray(current.history) ? current.history : [];
    const nextEntry = normalizeSearchHistoryEntry(entry, 0);
    const deduped = [nextEntry, ...existing.filter((item) => !(item.query === nextEntry.query && item.scope === nextEntry.scope))].slice(0, 100);
    return updateUniversalSearchConfig({ history: deduped }, {
        ...options,
        action: String(options.action || 'Recorded universal search history'),
        eventType: 'search-history-updated'
    });
}

export function clearUniversalSearchHistory(options = {}) {
    return updateUniversalSearchConfig({ history: [] }, {
        ...options,
        action: String(options.action || 'Cleared universal search history'),
        eventType: 'search-history-cleared'
    });
}

export function saveUniversalSearch(search, options = {}) {
    const current = getUniversalSearchConfig();
    const input = normalizeSavedSearch(search, 0);
    const existing = Array.isArray(current.savedSearches) ? current.savedSearches : [];
    const index = existing.findIndex((item) => item.id === input.id);
    const updated = {
        ...input,
        createdAt: index >= 0 ? existing[index].createdAt : input.createdAt,
        updatedAt: new Date().toISOString()
    };
    const next = index >= 0
        ? existing.map((item, itemIndex) => (itemIndex === index ? updated : item))
        : [updated, ...existing];
    return updateUniversalSearchConfig({ savedSearches: next.slice(0, 100) }, {
        ...options,
        action: String(options.action || `Saved universal search ${updated.name}`),
        eventType: 'saved-searches-updated'
    });
}

export function deleteSavedUniversalSearch(searchId, options = {}) {
    const target = String(searchId || '').trim();
    const current = getUniversalSearchConfig();
    const next = (current.savedSearches || []).filter((item) => item.id !== target);
    return updateUniversalSearchConfig({ savedSearches: next }, {
        ...options,
        action: String(options.action || 'Deleted saved universal search'),
        eventType: 'saved-searches-updated'
    });
}

export function setActiveUniversalSearchSession(session, options = {}) {
    const nextSession = normalizeSearchSession(session);
    return updateUniversalSearchConfig({ activeSession: nextSession }, {
        ...options,
        action: String(options.action || 'Updated active universal search session'),
        eventType: 'active-search-session-updated'
    });
}

export function updateRecentProjectWorkspaces(list, action = 'Updated recent project workspaces') {
    appState.recentProjectWorkspaces = normalizeRecentProjectWorkspaces(list);
    saveState({ action, recordHistory: false });
    dispatchWorkspaceEvent('RecentUpdated', { recentCount: appState.recentProjectWorkspaces.length });
    return getRecentProjectWorkspaces();
}

export function addRecentProjectWorkspace(entry, options = {}) {
    const normalized = normalizeRecentProjectWorkspaces([entry])[0];
    if (!normalized) return getRecentProjectWorkspaces();

    const existing = normalizeRecentProjectWorkspaces(appState.recentProjectWorkspaces);
    const merged = [normalized, ...existing.filter((item) => item.id !== normalized.id && item.workspaceId !== normalized.workspaceId)];
    appState.recentProjectWorkspaces = normalizeRecentProjectWorkspaces(merged);
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated recent project workspaces'), recordHistory: false });
    }
    dispatchWorkspaceEvent('RecentUpdated', { recentCount: appState.recentProjectWorkspaces.length });
    return getRecentProjectWorkspaces();
}

export function upsertProjectWorkspace(workspace, options = {}) {
    const normalized = normalizeProjectWorkspace(workspace);
    const { index } = withWorkspaceIndex(normalized.id);

    if (index >= 0) {
        appState.workspaces[index] = normalized;
    } else {
        appState.workspaces = [...(appState.workspaces || []), normalized];
    }

    if (options.setActive !== false) {
        appState.activeWorkspaceId = normalized.id;
    }

    addRecentProjectWorkspace({
        id: normalized.id,
        workspaceId: normalized.id,
        name: normalized.name,
        folderPath: normalized.folderPath,
        lastOpenedAt: new Date().toISOString(),
        pinned: false
    }, { persist: false });

    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated project workspace'), recordHistory: false });
    }

    dispatchWorkspaceEvent(index >= 0 ? 'WorkspaceUpdated' : 'WorkspaceCreated', {
        workspaceId: normalized.id,
        workspaceName: normalized.name
    });

    return normalized;
}

export function setActiveWorkspaceDefaultBranding(branding, options = {}) {
    const active = getActiveProjectWorkspace();
    if (!active) return null;

    const normalizedBranding = normalizeBranding(branding);
    const updated = normalizeProjectWorkspace({
        ...active,
        brandingDefaults: normalizedBranding,
        integrationMetadata: {
            ...(active.integrationMetadata || {}),
            brandingDefaults: normalizedBranding
        },
        lastModifiedAt: new Date().toISOString()
    });

    const { index } = withWorkspaceIndex(updated.id);
    if (index < 0) return null;
    appState.workspaces[index] = updated;

    if (options.persist !== false) {
        saveState({ action: String(options.action || `Updated workspace branding defaults for ${updated.name}`), recordHistory: false });
    }

    dispatchWorkspaceEvent('WorkspaceBrandingDefaultsUpdated', {
        workspaceId: updated.id,
        workspaceName: updated.name
    });

    return updated;
}

export function setActiveProjectWorkspace(workspaceId, options = {}) {
    const { id, index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return false;

    appState.activeWorkspaceId = id;
    const active = appState.workspaces[index];
    if (options.persist !== false) {
        saveState({ action: String(options.action || `Opened project workspace ${active.name}`), recordHistory: false });
    }

    addRecentProjectWorkspace({
        id: active.id,
        workspaceId: active.id,
        name: active.name,
        folderPath: active.folderPath,
        lastOpenedAt: new Date().toISOString(),
        pinned: false
    }, { persist: false });

    dispatchWorkspaceEvent('WorkspaceOpened', {
        workspaceId: active.id,
        workspaceName: active.name
    });
    return true;
}

export function closeActiveProjectWorkspace(options = {}) {
    const active = getActiveProjectWorkspace();
    appState.activeWorkspaceId = '';
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Closed project workspace'), recordHistory: false });
    }
    dispatchWorkspaceEvent('WorkspaceClosed', {
        workspaceId: active?.id || '',
        workspaceName: active?.name || ''
    });
    return true;
}

export function renameProjectWorkspace(workspaceId, newName, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const name = String(newName || '').trim();
    if (!name) return null;

    const current = appState.workspaces[index];
    const next = normalizeProjectWorkspace({
        ...current,
        name,
        folderName: String(options.folderName || name),
        lastModifiedAt: new Date().toISOString()
    });
    appState.workspaces[index] = next;
    addRecentProjectWorkspace({
        id: next.id,
        workspaceId: next.id,
        name: next.name,
        folderPath: next.folderPath,
        lastOpenedAt: new Date().toISOString(),
        pinned: false
    }, { persist: false });
    if (options.persist !== false) {
        saveState({ action: String(options.action || `Renamed project workspace ${next.name}`), recordHistory: false });
    }
    dispatchWorkspaceEvent('WorkspaceRenamed', {
        workspaceId: next.id,
        workspaceName: next.name
    });
    return next;
}

export function duplicateProjectWorkspace(workspaceId, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const source = appState.workspaces[index];
    const duplicate = normalizeProjectWorkspace({
        ...source,
        id: `workspace-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: String(options.name || `${source.name} Copy`).trim() || `${source.name} Copy`,
        folderName: String(options.folderName || `${source.folderName} Copy`).trim() || `${source.folderName} Copy`,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString()
    });

    appState.workspaces = [...(appState.workspaces || []), duplicate];
    appState.activeWorkspaceId = duplicate.id;
    addRecentProjectWorkspace({
        id: duplicate.id,
        workspaceId: duplicate.id,
        name: duplicate.name,
        folderPath: duplicate.folderPath,
        lastOpenedAt: new Date().toISOString(),
        pinned: false
    }, { persist: false });
    saveState({ action: String(options.action || `Duplicated project workspace ${source.name}`), recordHistory: false });
    dispatchWorkspaceEvent('WorkspaceDuplicated', {
        workspaceId: duplicate.id,
        workspaceName: duplicate.name,
        sourceWorkspaceId: source.id
    });
    return duplicate;
}

export function deleteProjectWorkspace(workspaceId, options = {}) {
    const targetId = String(workspaceId || '').trim();
    const before = normalizeProjectWorkspaces(appState.workspaces);
    const target = before.find((item) => item.id === targetId) || null;
    if (!target) return null;

    appState.workspaces = before.filter((item) => item.id !== targetId);
    if (appState.activeWorkspaceId === targetId) appState.activeWorkspaceId = '';
    appState.recentProjectWorkspaces = normalizeRecentProjectWorkspaces((appState.recentProjectWorkspaces || []).filter((item) => item.id !== targetId && item.workspaceId !== targetId));

    if (options.persist !== false) {
        saveState({ action: String(options.action || `Deleted project workspace ${target.name}`), recordHistory: false });
    }

    dispatchWorkspaceEvent('WorkspaceDeleted', {
        workspaceId: target.id,
        workspaceName: target.name
    });
    return target;
}

export function addProjectWorkspaceAsset(workspaceId, asset, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const workspace = normalizeProjectWorkspace(appState.workspaces[index]);
    const nextAsset = normalizeWorkspaceAsset(asset, workspace.resources.projectAssets.length);

    workspace.resources.projectAssets = [...workspace.resources.projectAssets, nextAsset];
    workspace.lastModifiedAt = new Date().toISOString();
    appState.workspaces[index] = workspace;

    if (options.persist !== false) {
        saveState({ action: String(options.action || `Added project asset ${nextAsset.title}`), recordHistory: false });
    }

    dispatchWorkspaceEvent('ProjectAssetAdded', {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        assetId: nextAsset.id,
        assetTitle: nextAsset.title
    });
    return nextAsset;
}

export function removeProjectWorkspaceAsset(workspaceId, assetId, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const workspace = normalizeProjectWorkspace(appState.workspaces[index]);
    const before = workspace.resources.projectAssets;
    const removed = before.find((asset) => asset.id === assetId) || null;
    if (!removed) return null;

    workspace.resources.projectAssets = before.filter((asset) => asset.id !== assetId);
    workspace.relationships = workspace.relationships.filter((relationship) => relationship.fromId !== assetId && relationship.toId !== assetId);
    workspace.lastModifiedAt = new Date().toISOString();
    appState.workspaces[index] = workspace;

    if (options.persist !== false) {
        saveState({ action: String(options.action || `Removed project asset ${removed.title}`), recordHistory: false });
    }

    dispatchWorkspaceEvent('ProjectAssetRemoved', {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        assetId: removed.id,
        assetTitle: removed.title
    });
    return removed;
}

export function addProjectWorkspaceRelationship(workspaceId, relationship, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const workspace = normalizeProjectWorkspace(appState.workspaces[index]);
    const nextRelationship = normalizeWorkspaceRelationship(relationship, workspace.relationships.length);
    workspace.relationships = [...workspace.relationships, nextRelationship];
    workspace.lastModifiedAt = new Date().toISOString();
    appState.workspaces[index] = workspace;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated workspace relationships'), recordHistory: false });
    }
    dispatchWorkspaceEvent('RelationshipUpdated', {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        relationshipId: nextRelationship.id
    });
    return nextRelationship;
}

export function updateProjectWorkspaceState(workspaceId, updates = {}, options = {}) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;
    const workspace = normalizeProjectWorkspace(appState.workspaces[index]);
    workspace.workspaceState = {
        ...workspace.workspaceState,
        ...(updates && typeof updates === 'object' ? updates : {})
    };
    workspace.lastModifiedAt = new Date().toISOString();
    appState.workspaces[index] = workspace;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated workspace state'), recordHistory: false });
    }
    dispatchWorkspaceEvent('WorkspaceRestored', {
        workspaceId: workspace.id,
        workspaceName: workspace.name
    });
    return workspace;
}

export function calculateProjectWorkspaceStatistics(workspaceId) {
    const { index } = withWorkspaceIndex(workspaceId);
    if (index < 0) return null;

    const workspace = normalizeProjectWorkspace(appState.workspaces[index]);
    const reportIds = new Set([
        ...workspace.associatedReportIds,
        ...workspace.resources.reports
    ]);
    const templateIds = new Set([
        ...workspace.associatedTemplateIds,
        ...workspace.resources.templates
    ]);

    const reports = (appState.reports || []).filter((report) => reportIds.size === 0 || reportIds.has(report.id));
    const completeReports = reports.filter((report) => String(report.data?.reportType || '').trim() !== '').length;
    const draftReports = Math.max(0, reports.length - completeReports);
    const findings = reports.reduce((sum, report) => {
        const entries = Array.isArray(report.data?.auditEntries) ? report.data.auditEntries.length : 0;
        return sum + entries;
    }, 0);

    return {
        totalReports: reports.length,
        completedReports: completeReports,
        draftReports,
        templates: templateIds.size,
        projectAssets: workspace.resources.projectAssets.length,
        attachments: workspace.resources.attachments.length,
        auditLogs: workspace.resources.auditLogs.length,
        progressLogs: workspace.resources.progressLogs.length,
        relationships: workspace.relationships.length,
        accessibilityFindings: findings,
        openFindings: findings,
        resolvedFindings: 0,
        deferredFindings: 0,
        exports: workspace.resources.exports.length,
        imports: normalizeRecentProjectWorkspaces(appState.recentProjectWorkspaces)
            .filter((item) => item.workspaceId === workspace.id).length
    };
}

export function calculateProjectWorkspaceHealth(workspaceId) {
    const statistics = calculateProjectWorkspaceStatistics(workspaceId);
    if (!statistics) return null;

    const total = statistics.totalReports;
    const completion = total > 0 ? Math.round((statistics.completedReports / total) * 100) : 0;
    const validationStatus = statistics.relationships >= statistics.projectAssets ? 'stable' : 'needs-review';

    return {
        projectCompletion: completion,
        reportsRemaining: Math.max(0, statistics.totalReports - statistics.completedReports),
        outstandingFindings: statistics.openFindings,
        criticalFindings: 0,
        projectActivity: statistics.imports + statistics.exports,
        recentChanges: statistics.relationships,
        validationStatus
    };
}

function parseSeveritySummary(summaryText) {
    const counts = {};
    String(summaryText || '')
        .split(',')
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .forEach((part) => {
            const [labelRaw, countRaw] = part.split(':');
            const label = String(labelRaw || '').trim();
            const count = Number(String(countRaw || '').trim());
            if (!label || !Number.isFinite(count)) return;
            counts[label] = (Number(counts[label]) || 0) + count;
        });
    return counts;
}

function getInsightFieldIndexes(fields = []) {
    const indexed = (Array.isArray(fields) ? fields : []).map((field, index) => ({
        field,
        index,
        label: String(field?.label || '').trim()
    }));

    const findIndexes = (patterns = []) => indexed
        .filter((item) => patterns.some((pattern) => pattern.test(item.label)))
        .map((item) => item.index);

    return {
        issueTypeIndexes: findIndexes([/issue\s*type/i, /finding\s*type/i, /category/i, /defect\s*type/i]),
        severityIndexes: findIndexes([/severity/i, /risk/i, /priority/i]),
        statusIndexes: findIndexes([/status/i, /state/i, /disposition/i]),
        pageIndexes: findIndexes([/page/i, /url/i, /screen/i, /view/i])
    };
}

function getInsightValue(rawValue) {
    if (rawValue && typeof rawValue === 'object') {
        const preferred = String(rawValue.label || rawValue.name || rawValue.identifier || rawValue.value || '').trim();
        if (preferred) return preferred;
        return String(rawValue.title || '').trim();
    }
    return String(rawValue || '').trim();
}

function buildSortedCountList(countMap = new Map()) {
    return [...countMap.entries()]
        .map(([label, count]) => ({ label, count: Number(count || 0) }))
        .filter((item) => item.label && item.count > 0)
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function addCountListToObject(target = {}, list = []) {
    (Array.isArray(list) ? list : []).forEach((item) => {
        const label = String(item?.label || '').trim();
        const count = Number(item?.count || 0);
        if (!label || count <= 0) return;
        target[label] = Number(target[label] || 0) + count;
    });
    return target;
}

function buildSortedCountListFromObject(counts = {}) {
    return Object.entries(counts || {})
        .map(([label, count]) => ({ label: String(label || '').trim(), count: Number(count || 0) }))
        .filter((item) => item.label && item.count > 0)
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function summarizeReportInsights(reportData) {
    const fields = Array.isArray(reportData?.fields) ? reportData.fields : [];
    const entries = Array.isArray(reportData?.auditEntries) && reportData.auditEntries.length > 0
        ? reportData.auditEntries
        : [{ fieldValues: reportData?.editorFieldValues || {} }];

    const {
        issueTypeIndexes,
        severityIndexes,
        statusIndexes,
        pageIndexes
    } = getInsightFieldIndexes(fields);

    const issueTypeCounts = new Map();
    const severityCounts = new Map();
    const statusCounts = new Map();
    const pageCounts = new Map();

    entries.forEach((entry) => {
        const values = entry?.fieldValues || {};

        issueTypeIndexes.forEach((index) => {
            const value = getInsightValue(values[index]);
            if (!value) return;
            issueTypeCounts.set(value, Number(issueTypeCounts.get(value) || 0) + 1);
        });

        severityIndexes.forEach((index) => {
            const value = getInsightValue(values[index]);
            if (!value) return;
            severityCounts.set(value, Number(severityCounts.get(value) || 0) + 1);
        });

        statusIndexes.forEach((index) => {
            const value = getInsightValue(values[index]);
            if (!value) return;
            statusCounts.set(value, Number(statusCounts.get(value) || 0) + 1);
        });

        pageIndexes.forEach((index) => {
            const value = getInsightValue(values[index]);
            if (!value) return;
            pageCounts.set(value, Number(pageCounts.get(value) || 0) + 1);
        });
    });

    const issueTypeList = buildSortedCountList(issueTypeCounts);
    const severityList = buildSortedCountList(severityCounts);
    const statusList = buildSortedCountList(statusCounts);
    const pageList = buildSortedCountList(pageCounts);

    return {
        issueTypeCounts: issueTypeList,
        severityCounts: severityList,
        statusCounts: statusList,
        pageCounts: pageList,
        topIssueType: issueTypeList[0] || null,
        topSeverity: severityList[0] || null,
        topStatus: statusList[0] || null,
        topPage: pageList[0] || null
    };
}

function toIsoDate(value) {
    const timestamp = Number(value || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    return new Date(timestamp).toISOString();
}

function normalizeOrganizationName(value) {
    const text = String(value || '').trim();
    return text || 'Unspecified Organization';
}

function buildReportTrendPoint(report) {
    const metrics = computeReportMetrics(report);
    const insights = summarizeReportInsights(report?.data || {});
    return {
        reportId: report.id,
        reportName: String(report.name || '').trim() || 'Untitled Report',
        organization: normalizeOrganizationName(report?.data?.orgClient),
        updatedAt: Number(report.updatedAt || 0),
        updatedAtIso: toIsoDate(report.updatedAt),
        totalIssues: Number(metrics.totalIssues || 0),
        openFindings: Number(metrics.totalAuditEntries || 0),
        topIssueType: insights.topIssueType,
        topSeverity: insights.topSeverity
    };
}

function summarizeTrendGroup(id, label, reports = []) {
    const sorted = [...reports]
        .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0));
    const points = sorted.map((report) => buildReportTrendPoint(report));
    const latest = points[points.length - 1] || null;
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const deltaTotalIssues = latest && previous
        ? Number(latest.totalIssues || 0) - Number(previous.totalIssues || 0)
        : 0;
    const direction = points.length < 2
        ? 'no-baseline'
        : deltaTotalIssues > 0
            ? 'up'
            : deltaTotalIssues < 0
                ? 'down'
                : 'flat';

    return {
        id: String(id || '').trim() || `trend-${Date.now()}`,
        label: String(label || '').trim() || 'Trend Group',
        reportCount: points.length,
        latest,
        previous,
        deltaTotalIssues,
        direction,
        points
    };
}

export function getAnalyticsTrendSnapshot(options = {}) {
    const source = options && typeof options === 'object' ? options : {};
    const includeUnrelated = Boolean(source.includeUnrelatedReports);
    const reports = Array.isArray(appState.reports) ? [...appState.reports] : [];
    const workspaces = getProjectWorkspaces();

    const workspaceReportIds = new Set();
    const reportToWorkspaceId = {};
    const workspaceTrends = workspaces
        .map((workspace) => {
            const ids = new Set([
                ...(workspace.associatedReportIds || []),
                ...((workspace.resources && Array.isArray(workspace.resources.reports)) ? workspace.resources.reports : [])
            ]);

            ids.forEach((reportId) => {
                workspaceReportIds.add(reportId);
                reportToWorkspaceId[reportId] = workspace.id;
            });

            const relatedReports = reports.filter((report) => ids.has(report.id));
            return summarizeTrendGroup(`workspace:${workspace.id}`, workspace.name || 'Untitled Workspace', relatedReports);
        })
        .filter((trend) => trend.reportCount > 0)
        .sort((left, right) => left.label.localeCompare(right.label));

    const standaloneReports = reports.filter((report) => !workspaceReportIds.has(report.id));
    const standaloneByOrg = standaloneReports.reduce((map, report) => {
        const org = normalizeOrganizationName(report?.data?.orgClient);
        if (!map.has(org)) map.set(org, []);
        map.get(org).push(report);
        return map;
    }, new Map());

    const organizationTrends = [...standaloneByOrg.entries()]
        .map(([org, orgReports]) => summarizeTrendGroup(`organization:${org.toLowerCase()}`, org, orgReports))
        .filter((trend) => trend.reportCount > 0)
        .sort((left, right) => left.label.localeCompare(right.label));

    const unrelatedStandaloneTrend = includeUnrelated
        ? summarizeTrendGroup('standalone:all', 'All Standalone Reports', standaloneReports)
        : null;

    return {
        workspaceTrends,
        organizationTrends,
        unrelatedStandaloneTrend: unrelatedStandaloneTrend && unrelatedStandaloneTrend.reportCount > 0
            ? unrelatedStandaloneTrend
            : null,
        reportToWorkspaceId,
        standaloneReportIds: standaloneReports.map((report) => report.id)
    };
}

export function getReportAnalyticsSnapshot(reportId = '') {
    const targetId = String(reportId || appState.selectedReportId || '').trim();
    const report = targetId ? getReportById(targetId) : null;
    if (!report) {
        const hasCurrentReport = Boolean(String(appState.reportTitle || '').trim())
            || (Array.isArray(appState.fields) && appState.fields.length > 0)
            || (Array.isArray(appState.auditEntries) && appState.auditEntries.length > 0);
        if (!hasCurrentReport) return null;

        return {
            reportId: targetId || 'current-report',
            reportName: String(appState.reportTitle || 'Untitled Report').trim() || 'Untitled Report',
            reportType: String(appState.reportType || '').trim(),
            organization: normalizeOrganizationName(appState.orgClient),
            metrics: getCurrentReportMetrics(),
            progress: getProgressLogMetrics(),
            insights: summarizeReportInsights(getCurrentReportSnapshotData()),
            updatedAt: Date.now()
        };
    }

    return {
        reportId: report.id,
        reportName: String(report.name || '').trim() || 'Untitled Report',
        reportType: String(report.data?.reportType || '').trim(),
        organization: normalizeOrganizationName(report?.data?.orgClient),
        metrics: computeReportMetrics(report),
        progress: getProgressLogMetrics(report),
        insights: summarizeReportInsights(report.data || {}),
        updatedAt: Number(report.updatedAt || 0)
    };
}

export function getWorkspaceAnalyticsSnapshot(workspaceId = '') {
    const activeWorkspace = getActiveProjectWorkspace();
    const targetWorkspaceId = String(workspaceId || activeWorkspace?.id || '').trim();
    if (!targetWorkspaceId) return null;

    const statistics = calculateProjectWorkspaceStatistics(targetWorkspaceId);
    const health = calculateProjectWorkspaceHealth(targetWorkspaceId);
    if (!statistics || !health) return null;

    const workspace = getProjectWorkspaces().find((item) => item.id === targetWorkspaceId) || null;
    if (!workspace) return null;

    const reportIds = new Set([
        ...(workspace.associatedReportIds || []),
        ...((workspace.resources && Array.isArray(workspace.resources.reports)) ? workspace.resources.reports : [])
    ]);
    const reports = (appState.reports || []).filter((report) => reportIds.size === 0 || reportIds.has(report.id));

    const aggregate = reports.reduce((accumulator, report) => {
        const reportMetrics = computeReportMetrics(report);
        const progressMetrics = getProgressLogMetrics(report);
        const reportInsights = summarizeReportInsights(report.data || {});

        accumulator.totalIssues += Number(reportMetrics.totalIssues || 0);
        accumulator.totalAuditEntries += Number(reportMetrics.totalAuditEntries || 0);
        accumulator.pagesTested += Number(reportMetrics.pagesTested || 0);
        accumulator.wcagCriteria += Number(reportMetrics.wcagCriteria || 0);
        accumulator.totalEvaluationItems += Number(progressMetrics.totalEvaluationItems || 0);
        accumulator.completedEvaluationItems += Number(progressMetrics.completed || 0);

        addCountListToObject(accumulator.severityCounts, reportInsights.severityCounts);
        addCountListToObject(accumulator.issueTypeCounts, reportInsights.issueTypeCounts);
        addCountListToObject(accumulator.statusCounts, reportInsights.statusCounts);
        addCountListToObject(accumulator.pageCounts, reportInsights.pageCounts);

        return accumulator;
    }, {
        totalIssues: 0,
        totalAuditEntries: 0,
        pagesTested: 0,
        wcagCriteria: 0,
        totalEvaluationItems: 0,
        completedEvaluationItems: 0,
        severityCounts: {},
        issueTypeCounts: {},
        statusCounts: {},
        pageCounts: {}
    });

    const severityList = buildSortedCountListFromObject(aggregate.severityCounts);
    const issueTypeList = buildSortedCountListFromObject(aggregate.issueTypeCounts);
    const statusList = buildSortedCountListFromObject(aggregate.statusCounts);
    const pageList = buildSortedCountListFromObject(aggregate.pageCounts);

    return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        statistics,
        health,
        reportAggregate: {
            totalReports: reports.length,
            totalIssues: aggregate.totalIssues,
            totalAuditEntries: aggregate.totalAuditEntries,
            pagesTested: aggregate.pagesTested,
            wcagCriteria: aggregate.wcagCriteria,
            severityCounts: aggregate.severityCounts
        },
        insights: {
            severityCounts: severityList,
            issueTypeCounts: issueTypeList,
            statusCounts: statusList,
            pageCounts: pageList,
            topIssueType: issueTypeList[0] || null,
            topSeverity: severityList[0] || null,
            topStatus: statusList[0] || null,
            topPage: pageList[0] || null
        },
        progressAggregate: {
            totalEvaluationItems: aggregate.totalEvaluationItems,
            completed: aggregate.completedEvaluationItems,
            completionPercent: aggregate.totalEvaluationItems > 0
                ? Math.round((aggregate.completedEvaluationItems / aggregate.totalEvaluationItems) * 100)
                : 0
        }
    };
}

export function getShortcutDefinitions() {
    return getAllShortcutDefinitions(appState.shortcuts).map((definition) => ({
        ...definition,
        shortcut: appState.shortcuts[definition.action] || definition.defaultShortcut
    }));
}

export function getSpellUserDictionary() {
    return [...(appState.spellUserDictionary || [])];
}

export function addSpellUserDictionaryWord(word) {
    const value = String(word || '').trim();
    if (!value) return { ok: false, reason: 'missing-word' };
    if ((appState.spellUserDictionary || []).includes(value)) {
        return { ok: true, alreadyExists: true, word: value };
    }

    appState.spellUserDictionary = [...(appState.spellUserDictionary || []), value];
    saveState({ action: `Added ${value} to spell dictionary` });
    return { ok: true, alreadyExists: false, word: value };
}

export function getShortcutMap() {
    return { ...appState.shortcuts };
}

export function getShortcutForAction(action) {
    const definition = getAllShortcutDefinitions(appState.shortcuts).find((item) => item.action === action);
    if (!definition) return '';
    return String(appState.shortcuts[action] || definition.defaultShortcut || '').trim();
}

export function findShortcutConflict(shortcut, exceptAction = '') {
    const normalized = String(shortcut || '').trim().toLowerCase();
    if (!normalized) return null;
    const conflict = getAllShortcutDefinitions(appState.shortcuts).find((definition) => {
        if (definition.action === exceptAction) return false;
        const current = String(appState.shortcuts[definition.action] || '').trim().toLowerCase();
        return current === normalized;
    });
    if (!conflict) return null;
    return {
        action: conflict.action,
        label: conflict.label,
        shortcut: appState.shortcuts[conflict.action]
    };
}

export function updateShortcut(action, shortcut, options = {}) {
    const definition = getAllShortcutDefinitions(appState.shortcuts).find((item) => item.action === action);
    if (!definition) {
        return { ok: false, reason: 'unknown-action' };
    }

    const normalizedShortcut = String(shortcut || '').trim();
    if (!normalizedShortcut) {
        return { ok: false, reason: 'missing-shortcut' };
    }

    const conflict = findShortcutConflict(normalizedShortcut, action);
    if (conflict && options.allowConflict !== true) {
        return { ok: false, reason: 'conflict', conflict };
    }

    appState.shortcuts[action] = normalizedShortcut;
    saveState({ action: `Updated shortcut for ${definition.label}` });
    window.dispatchEvent(new Event('art-shortcuts-updated'));
    return { ok: true, conflict };
}

export function resetShortcutForAction(action) {
    const definition = getAllShortcutDefinitions(appState.shortcuts).find((item) => item.action === action);
    if (!definition) {
        return { ok: false, reason: 'unknown-action' };
    }

    const defaultShortcut = String(defaultState.shortcuts?.[action] ?? '');
    appState.shortcuts[action] = defaultShortcut;
    saveState({ action: `Reset shortcut for ${definition.label}` });
    window.dispatchEvent(new Event('art-shortcuts-updated'));
    return { ok: true, shortcut: defaultShortcut, label: definition.label };
}

export function resetShortcutsToDefault() {
    appState.shortcuts = normalizeShortcuts(defaultState.shortcuts);
    saveState({ action: 'Restored default keyboard shortcuts' });
    window.dispatchEvent(new Event('art-shortcuts-updated'));
}

export function getImportedAccessibilityStandards() {
    return normalizeUserStandards(appState.userStandards || appState.importedStandards);
}

export function getUserStandards() {
    return getImportedAccessibilityStandards();
}

export function getAllAccessibilityStandardNames() {
    const builtIns = ['WCAG 2.2', 'WCAG 2.1'];
    const imported = getUserStandards().map((standard) => standard.displayName);
    return [...new Set([...builtIns, ...imported])];
}

export function getProgressStatuses() {
    return [...DEFAULT_PROGRESS_STATUSES];
}

export function getDefaultProgressItemTypes() {
    return [...DEFAULT_PROGRESS_ITEM_TYPES];
}

export function isProgressLogAvailable() {
    return String(appState.reportType || '').trim() === 'Audit Log';
}

export function isProgressLogEnabled() {
    return isProgressLogAvailable() && Boolean(appState.progressLogEnabled);
}

export function isProgressLogAppendixEnabled() {
    return isProgressLogEnabled() && Boolean(appState.progressLogAppendixEnabled);
}

export function getProgressItems() {
    return normalizeProgressItems(appState.progressItems);
}

export function getProgressItemNames() {
    const seen = new Set();
    return getProgressItems()
        .map((item) => String(item.name || '').trim())
        .filter((name) => {
            if (!name) return false;
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export function updateProgressLogSettings(updates = {}, options = {}) {
    const nextEnabled = normalizeProgressLogEnabled(
        Object.prototype.hasOwnProperty.call(updates, 'progressLogEnabled') ? updates.progressLogEnabled : appState.progressLogEnabled,
        appState.reportType
    );
    const nextAppendix = normalizeProgressLogAppendixEnabled(
        Object.prototype.hasOwnProperty.call(updates, 'progressLogAppendixEnabled') ? updates.progressLogAppendixEnabled : appState.progressLogAppendixEnabled,
        appState.reportType
    );

    appState.progressLogEnabled = nextEnabled;
    appState.progressLogAppendixEnabled = nextEnabled ? nextAppendix : false;
    appState.progressItems = nextEnabled ? normalizeProgressItems(appState.progressItems) : normalizeProgressItems(appState.progressItems);
    saveState({ action: String(options.action || 'Updated progress log settings') });
    window.dispatchEvent(new Event('art-progress-log-updated'));
    return {
        progressLogEnabled: appState.progressLogEnabled,
        progressLogAppendixEnabled: appState.progressLogAppendixEnabled
    };
}

function syncProgressItemDates(item, nextStatus) {
    const status = normalizeProgressItemStatus(nextStatus);
    const started = normalizeIsoDateTime(item?.dateStarted);
    return {
        ...item,
        status,
        dateStarted: status !== 'Not Started' && status !== 'Not Applicable' ? (started || new Date().toISOString()) : '',
        dateCompleted: status === 'Complete' ? (normalizeIsoDateTime(item?.dateCompleted) || new Date().toISOString()) : ''
    };
}

export function addProgressItem(seed = {}) {
    const item = normalizeProgressItem(seed, appState.progressItems.length);
    appState.progressItems = [...getProgressItems(), item];
    saveState({ action: `Added evaluation item ${item.name || appState.progressItems.length}` });
    window.dispatchEvent(new Event('art-progress-log-updated'));
    return item;
}

export function updateProgressItem(itemId, updates = {}) {
    const targetId = String(itemId || '').trim();
    let updatedItem = null;
    appState.progressItems = getProgressItems().map((item, index) => {
        if (item.id !== targetId) return item;
        const merged = normalizeProgressItem({ ...item, ...updates, id: item.id }, index);
        updatedItem = syncProgressItemDates(merged, merged.status);
        return updatedItem;
    });
    if (!updatedItem) return null;
    saveState({ action: `Updated evaluation item ${updatedItem.name || updatedItem.id}` });
    window.dispatchEvent(new Event('art-progress-log-updated'));
    return updatedItem;
}

export function updateProgressItemStatus(itemId, status) {
    const targetId = String(itemId || '').trim();
    let updatedItem = null;
    appState.progressItems = getProgressItems().map((item) => {
        if (item.id !== targetId) return item;
        updatedItem = syncProgressItemDates(item, status);
        return updatedItem;
    });
    if (!updatedItem) return null;
    saveState({ action: `Updated evaluation item status ${updatedItem.name || updatedItem.id}` });
    window.dispatchEvent(new Event('art-progress-log-updated'));
    return updatedItem;
}

export function removeProgressItem(itemId) {
    const targetId = String(itemId || '').trim();
    const existing = getProgressItems();
    const removed = existing.find((item) => item.id === targetId) || null;
    if (!removed) return null;
    appState.progressItems = existing.filter((item) => item.id !== targetId);
    saveState({ action: `Removed evaluation item ${removed.name || removed.id}` });
    window.dispatchEvent(new Event('art-progress-log-updated'));
    return removed;
}

export function getProgressLogMetrics(report = null) {
    const source = report ? normalizeStateSnapshot(getReportDataFromSnapshot(report)) : appState;
    const items = normalizeProgressItems(source.progressItems);
    if (String(source.reportType || '').trim() !== 'Audit Log' || !Boolean(source.progressLogEnabled) || items.length === 0) {
        return {
            totalEvaluationItems: 0,
            completed: 0,
            testingCompletionPercent: 0,
            inProgress: 0,
            onHold: 0,
            blocked: 0,
            needsReview: 0,
            retestRequired: 0,
            notApplicable: 0
        };
    }

    const counts = {
        'In Progress': 0,
        'On Hold': 0,
        Blocked: 0,
        'Needs Review': 0,
        'Retest Required': 0,
        'Not Applicable': 0,
        Complete: 0
    };

    items.forEach((item) => {
        const status = normalizeProgressItemStatus(item.status);
        if (Object.prototype.hasOwnProperty.call(counts, status)) {
            counts[status] += 1;
        }
    });

    const total = items.length;
    const completed = counts.Complete;
    return {
        totalEvaluationItems: total,
        completed,
        testingCompletionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        inProgress: counts['In Progress'],
        onHold: counts['On Hold'],
        blocked: counts.Blocked,
        needsReview: counts['Needs Review'],
        retestRequired: counts['Retest Required'],
        notApplicable: counts['Not Applicable']
    };
}

export function validateAccessibilityStandardPayload(input) {
    let payload;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input);
        } catch (error) {
            return { isValid: false, reason: 'invalid-json' };
        }
    } else {
        payload = input;
    }

    if (payload && typeof payload === 'object' && payload.artAccessibilityStandardsVersion === '1.0' && Array.isArray(payload.standards)) {
        const normalizedStandards = payload.standards
            .map((standard) => validateAccessibilityStandardPayload(standard))
            .filter((result) => result.isValid && result.standard)
            .map((result) => result.standard);

        if (normalizedStandards.length === 0) {
            return { isValid: false, reason: 'missing-criteria' };
        }

        return {
            isValid: true,
            reason: 'ok',
            isBundle: true,
            standards: normalizedStandards
        };
    }

    const standardNode = payload?.standard && typeof payload.standard === 'object'
        ? payload.standard
        : payload;

    if (!standardNode || typeof standardNode !== 'object') {
        return { isValid: false, reason: 'invalid-payload' };
    }

    const criteria = Array.isArray(standardNode.criteria)
        ? standardNode.criteria
        : Array.isArray(standardNode.successCriteria)
            ? standardNode.successCriteria
            : null;

    if (!criteria || criteria.length === 0) {
        return { isValid: false, reason: 'missing-criteria' };
    }

    const internalId = String(standardNode.id || standardNode.identifier || '').trim();
    const version = String(standardNode.version || payload?.version || '').trim();
    const source = String(standardNode.source || payload?.source || '').trim();
    const provisionalDisplayName = String(standardNode.displayName || internalId || version || 'Imported Standard').trim();

    const normalized = normalizeImportedStandard({
        internalId,
        displayName: provisionalDisplayName,
        version,
        source,
        criteria
    });

    return {
        isValid: true,
        reason: 'ok',
        standard: normalized
    };
}

export function findImportedStandardConflict(internalId) {
    const normalizedInternalId = String(internalId || '').trim().toLowerCase();
    if (!normalizedInternalId) return null;
    return (appState.userStandards || []).find((item) => String(item.internalId || '').trim().toLowerCase() === normalizedInternalId) || null;
}

export function addImportedAccessibilityStandard(standard, displayName, options = {}) {
    const normalized = normalizeImportedStandard({
        ...standard,
        displayName
    });
    const targetInternalId = String(normalized.internalId || '').trim().toLowerCase();
    const existingIndex = (appState.userStandards || []).findIndex((item) => String(item.internalId || '').trim().toLowerCase() === targetInternalId && targetInternalId);

    if (existingIndex >= 0 && options.overwrite !== true) {
        return {
            ok: false,
            reason: 'conflict',
            existing: appState.userStandards[existingIndex]
        };
    }

    if (existingIndex >= 0) {
        const existing = appState.userStandards[existingIndex];
        appState.userStandards[existingIndex] = {
            ...normalized,
            id: existing.id
        };
    } else {
        appState.userStandards.push(normalized);
    }

    appState.importedStandards = appState.userStandards;

    saveState({ action: `Imported accessibility standard ${normalized.displayName}` });
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    return { ok: true, standard: normalized, replaced: existingIndex >= 0 };
}

export function updateImportedAccessibilityStandard(standardId, updates = {}) {
    const index = (appState.userStandards || []).findIndex((standard) => standard.id === standardId);
    if (index < 0) return null;

    const existing = appState.userStandards[index];
    const nextStandard = normalizeImportedStandard({
        ...existing,
        ...updates,
        id: existing.id,
        internalId: existing.internalId,
        importedAt: existing.importedAt
    });

    appState.userStandards[index] = {
        ...existing,
        ...nextStandard,
        id: existing.id,
        internalId: existing.internalId,
        importedAt: existing.importedAt
    };
    appState.importedStandards = appState.userStandards;
    saveState({ action: `Updated accessibility standard ${appState.userStandards[index].displayName}` });
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    return appState.userStandards[index];
}

export function replaceImportedAccessibilityStandard(standardId, standardData) {
    const index = (appState.userStandards || []).findIndex((standard) => standard.id === standardId);
    if (index < 0) return null;

    const existing = appState.userStandards[index];
    const normalized = normalizeImportedStandard({
        ...standardData,
        id: existing.id,
        internalId: standardData?.internalId || standardData?.id || existing.internalId,
        importedAt: existing.importedAt
    });

    const conflictIndex = (appState.userStandards || []).findIndex((standard, currentIndex) => {
        if (currentIndex === index) return false;
        return String(standard.internalId || '').trim().toLowerCase() === String(normalized.internalId || '').trim().toLowerCase();
    });

    if (conflictIndex >= 0) {
        return { ok: false, reason: 'conflict', existing: appState.userStandards[conflictIndex] };
    }

    appState.userStandards[index] = {
        ...existing,
        ...normalized,
        id: existing.id,
        importedAt: existing.importedAt
    };
    appState.importedStandards = appState.userStandards;

    if (appState.standard === existing.displayName) {
        appState.standard = appState.userStandards[index].displayName;
        window.dispatchEvent(new CustomEvent('art-standard-changed', {
            detail: { standard: appState.standard }
        }));
    }

    saveState({ action: `Replaced accessibility standard ${appState.userStandards[index].displayName}` });
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    return { ok: true, standard: appState.userStandards[index] };
}

export function removeImportedAccessibilityStandard(standardId) {
    const index = (appState.userStandards || []).findIndex((standard) => standard.id === standardId);
    if (index < 0) return null;
    const [removed] = appState.userStandards.splice(index, 1);
    appState.importedStandards = appState.userStandards;
    if (appState.standard === removed.displayName) {
        appState.standard = defaultState.standard;
        window.dispatchEvent(new CustomEvent('art-standard-changed', {
            detail: { standard: appState.standard }
        }));
    }
    saveState({ action: `Removed accessibility standard ${removed.displayName}` });
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    return removed;
}

export function clearImportedAccessibilityStandards() {
    const removedStandards = getImportedAccessibilityStandards();
    if (removedStandards.length === 0) return [];

    appState.userStandards = [];
    appState.importedStandards = appState.userStandards;
    saveState({ action: 'Cleared imported accessibility standards' });
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    return removedStandards;
}

export function resetUserPreferences() {
    appState.shortcuts = normalizeShortcuts(defaultState.shortcuts);
    appState.standard = defaultState.standard;
    appState.security = normalizeSecurityConfig(defaultState.security);
    appState.visualAccessibility = normalizeVisualAccessibilityConfig(defaultState.visualAccessibility);
    appState.analytics = normalizeAnalyticsConfig(defaultState.analytics);
    appState.dashboard = normalizeDashboardConfig(defaultState.dashboard);
    appState.workspaceView = normalizeWorkspaceViewConfig(defaultState.workspaceView);
    saveState({ action: 'Reset user preferences' });
    window.dispatchEvent(new Event('art-shortcuts-updated'));
    window.dispatchEvent(new Event('art-security-updated'));
    window.dispatchEvent(new Event('art-visual-accessibility-updated'));
    window.dispatchEvent(new Event('art-analytics-settings-updated'));
    window.dispatchEvent(new Event('art-dashboard-config-updated'));
    window.dispatchEvent(new Event('art-workspace-view-settings-updated'));
    window.dispatchEvent(new CustomEvent('art-workspace-view-changed', {
        detail: {
            active: appState.workspaceView.active,
            config: getWorkspaceViewConfig()
        }
    }));
    window.dispatchEvent(new CustomEvent('art-standard-changed', {
        detail: { standard: appState.standard }
    }));
}

export function resetAllApplicationData() {
    localStorage.clear();
    appState = normalizeStateSnapshot(defaultState);
    lastSavedSnapshot = JSON.stringify(appState);
    notifyHistoryFrameworkStateReset();
    persistCurrentState();
    window.dispatchEvent(new Event('art-state-restored'));
    window.dispatchEvent(new Event('art-reports-updated'));
    window.dispatchEvent(new Event('art-shortcuts-updated'));
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    window.dispatchEvent(new Event('art-security-updated'));
    window.dispatchEvent(new Event('art-visual-accessibility-updated'));
    window.dispatchEvent(new Event('art-analytics-settings-updated'));
    window.dispatchEvent(new Event('art-workspace-view-settings-updated'));
    window.dispatchEvent(new CustomEvent('art-workspace-view-changed', {
        detail: {
            active: appState.workspaceView?.active || 'dashboard',
            config: getWorkspaceViewConfig()
        }
    }));
    window.dispatchEvent(new CustomEvent('art-standard-changed', {
        detail: { standard: appState.standard }
    }));
}

export function getApplicationInfo() {
    return {
        ...APP_INFO,
        security: {
            ...normalizeSecurityConfig(appState.security)
        },
        importedStandards: getUserStandards().map((standard) => ({
            id: standard.id,
            displayName: standard.displayName,
            internalId: standard.internalId,
            version: standard.version,
            source: standard.source,
            criteriaCount: Array.isArray(standard.criteria) ? standard.criteria.length : 0
        })),
        visualAccessibility: getVisualAccessibilityConfig(),
        analytics: getAnalyticsConfig(),
        collaboration: getCollaborationConfig(),
        workspaceView: getWorkspaceViewConfig()
    };
}

function createManagedDataSnapshot() {
    // Connection/account state is intentionally excluded so backup/restore
    // never transfers integration identities between different user profiles.
    return {
        reportTitle: appState.reportTitle,
        orgClient: appState.orgClient,
        product: appState.product,
        projectName: appState.projectName,
        scopeUrl: appState.scopeUrl,
        auditDateStart: appState.auditDateStart,
        auditDateEnd: appState.auditDateEnd,
        auditors: appState.auditors,
        standard: appState.standard,
        testingInstructions: appState.testingInstructions,
        reportType: appState.reportType,
        reportLayout: appState.reportLayout,
        fieldsExpanded: appState.fieldsExpanded,
        templateOption: appState.templateOption,
        templateName: appState.templateName,
        templateDescription: appState.templateDescription,
        progressLogEnabled: appState.progressLogEnabled,
        progressLogAppendixEnabled: appState.progressLogAppendixEnabled,
        progressItems: appState.progressItems,
        fields: appState.fields,
        editorFieldValues: appState.editorFieldValues,
        auditEntries: appState.auditEntries,
        activeAuditEntryIndex: appState.activeAuditEntryIndex,
        reports: appState.reports,
        selectedReportId: appState.selectedReportId,
        userTemplates: appState.userTemplates,
        userStandards: appState.userStandards,
        importedStandards: appState.importedStandards,
        shortcuts: appState.shortcuts,
        analytics: appState.analytics,
        collaboration: appState.collaboration,
        dashboard: appState.dashboard,
        workspaceView: appState.workspaceView,
        resourceOrganization: appState.resourceOrganization,
        workspaces: appState.workspaces,
        activeWorkspaceId: appState.activeWorkspaceId,
        recentProjectWorkspaces: appState.recentProjectWorkspaces,
        universalSearch: appState.universalSearch,
        branding: appState.branding,
        spellUserDictionary: appState.spellUserDictionary
    };
}

function applyManagedDataSnapshot(snapshot) {
    const normalized = normalizeStateSnapshot({
        ...appState,
        ...(snapshot && typeof snapshot === 'object' ? snapshot : {})
    });

    Object.assign(appState, normalized);
    saveState({ action: 'Restored ART backup data' });
    window.dispatchEvent(new Event('art-state-restored'));
    window.dispatchEvent(new Event('art-reports-updated'));
    window.dispatchEvent(new Event('art-shortcuts-updated'));
    window.dispatchEvent(new Event('art-accessibility-standards-updated'));
    window.dispatchEvent(new Event('art-security-updated'));
    window.dispatchEvent(new Event('art-analytics-settings-updated'));
    window.dispatchEvent(new Event('art-workspace-view-settings-updated'));
    window.dispatchEvent(new CustomEvent('art-workspace-view-changed', {
        detail: {
            active: appState.workspaceView?.active || 'dashboard',
            config: getWorkspaceViewConfig()
        }
    }));
}

export function getSecurityConfig() {
    return normalizeSecurityConfig(appState.security);
}

export function canPerformExternalCommunication() {
    const security = getSecurityConfig();
    return !Boolean(security.privacyModeEnabled);
}

export function updateSecurityConfig(updates = {}, options = {}) {
    const source = updates && typeof updates === 'object' ? updates : {};
    const next = normalizeSecurityConfig({
        ...appState.security,
        ...source,
        backup: {
            ...appState.security?.backup,
            ...(source.backup && typeof source.backup === 'object' ? source.backup : {})
        }
    });
    appState.security = next;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated security settings') });
    }
    window.dispatchEvent(new Event('art-security-updated'));
    return next;
}

export function getVisualAccessibilityConfig() {
    return normalizeVisualAccessibilityConfig(appState.visualAccessibility);
}

export function updateVisualAccessibilityConfig(updates = {}, options = {}) {
    const next = normalizeVisualAccessibilityConfig({
        ...appState.visualAccessibility,
        ...(updates && typeof updates === 'object' ? updates : {})
    });
    appState.visualAccessibility = next;
    if (options.persist !== false) {
        saveState({ action: String(options.action || 'Updated visual accessibility settings') });
    }
    window.dispatchEvent(new Event('art-visual-accessibility-updated'));
    return next;
}

export function resetVisualAccessibilityConfig(options = {}) {
    return updateVisualAccessibilityConfig(defaultState.visualAccessibility, {
        ...options,
        action: String(options.action || 'Reset visual accessibility settings')
    });
}

export function setNetworkActivity(status, detail = '') {
    const next = updateSecurityConfig({
        networkActivityStatus: String(status || 'Offline'),
        networkActivityDetail: String(detail || '')
    }, {
        action: 'Updated network activity status'
    });
    return next;
}

export function recordSecurityAudit(action, detail = '') {
    const current = getSecurityConfig();
    const nextLog = [
        ...current.auditLog,
        {
            at: new Date().toISOString(),
            action: String(action || 'Security event'),
            detail: String(detail || '')
        }
    ].slice(-200);

    return updateSecurityConfig({ auditLog: nextLog }, { action: 'Recorded security audit event' });
}

export function getIntegrationStatusMap() {
    return normalizeIntegrationsConfig(appState.integrations);
}

export function updateIntegrationStatus(name, status) {
    const key = String(name || '').trim();
    if (!['jira', 'githubIssues', 'azureDevOps'].includes(key)) return normalizeIntegrationsConfig(appState.integrations);
    const next = normalizeIntegrationsConfig({
        ...appState.integrations,
        [key]: {
            status: normalizeIntegrationStatus(status)
        }
    });
    appState.integrations = next;
    saveState({ action: `Updated integration status ${key}` });
    window.dispatchEvent(new Event('art-security-updated'));
    return next;
}

export function createArtBackupPayload(label = '') {
    return {
        artBackupVersion: '1.0',
        label: String(label || 'ART Backup'),
        createdAt: new Date().toISOString(),
        projectName: String(appState.projectName || appState.reportTitle || ''),
        managedData: createManagedDataSnapshot()
    };
}

export function restoreArtBackupPayload(payload) {
    const backup = payload && typeof payload === 'object' ? payload : null;
    if (!backup || backup.artBackupVersion !== '1.0' || !backup.managedData || typeof backup.managedData !== 'object') {
        return { ok: false, reason: 'invalid-backup' };
    }

    applyManagedDataSnapshot(backup.managedData);
    recordSecurityAudit('Backup restore', `Restored backup created ${String(backup.createdAt || 'unknown date')}`);
    return { ok: true };
}

export function createRestorePoint(label = '') {
    const current = getSecurityConfig();
    const point = {
        id: `restore-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        label: String(label || 'Restore Point'),
        createdAt: new Date().toISOString(),
        projectName: String(appState.projectName || appState.reportTitle || ''),
        snapshot: createManagedDataSnapshot()
    };
    const nextPoints = [point, ...current.restorePoints].slice(0, current.backup.retention);
    updateSecurityConfig({ restorePoints: nextPoints }, { action: 'Created restore point' });
    recordSecurityAudit('Restore point created', point.label);
    return point;
}

export function getRestorePoints() {
    return [...getSecurityConfig().restorePoints];
}

export function restoreFromPoint(pointId) {
    const targetId = String(pointId || '').trim();
    const point = getSecurityConfig().restorePoints.find((item) => item.id === targetId);
    if (!point || !point.snapshot) {
        return { ok: false, reason: 'missing-point' };
    }
    applyManagedDataSnapshot(point.snapshot);
    recordSecurityAudit('Restore point applied', point.label);
    return { ok: true, point };
}

export function getMetadataDescriptors() {
    const metadata = getDefaultMetadataObject();
    return flattenMetadataObject(metadata)
        .filter((item) => item.path[0] !== 'branding' || item.path.length <= 2)
        .map((item) => {
            const keyPath = item.path.join('.');
            const currentValue = item.path.reduce((acc, part) => acc?.[part], appState);
            const inputType = keyPath === 'auditDateStart' || keyPath === 'auditDateEnd'
                ? 'date'
                : keyPath === 'testingInstructions'
                    ? 'textarea'
                    : keyPath === 'standard'
                        ? 'select'
                        : keyPath === 'branding.enabled' || keyPath === 'branding.logoDecorative'
                            ? 'checkbox'
                            : keyPath === 'branding.primaryColor'
                                ? 'color'
                                : 'text';

            return {
                keyPath,
                path: item.path,
                label: keyToLabel(item.path[item.path.length - 1]),
                groupLabel: item.path.length > 1 ? keyToLabel(item.path[0]) : 'Report Metadata',
                inputType,
                value: currentValue ?? item.value,
                options: keyPath === 'standard'
                    ? getAllAccessibilityStandardNames()
                    : []
            };
        });
}

export function validateMetadataDraft(draft) {
    const brandingDraft = normalizeBranding(draft?.branding || appState.branding);
    const brandingMessage = getBrandingAltValidationMessage(brandingDraft);
    if (brandingMessage) {
        return {
            isValid: false,
            message: brandingMessage
        };
    }
    return { isValid: true, message: '' };
}

export function applyMetadataDraft(draft) {
    const normalizedDraft = {
        ...getDefaultMetadataObject(),
        ...(draft || {}),
        branding: normalizeBranding(draft?.branding || appState.branding)
    };

    appState.reportTitle = String(normalizedDraft.reportTitle || '');
    appState.orgClient = String(normalizedDraft.orgClient || '');
    appState.projectName = String(normalizedDraft.projectName || '');
    appState.scopeUrl = String(normalizedDraft.scopeUrl || '');
    appState.auditDateStart = String(normalizedDraft.auditDateStart || '');
    appState.auditDateEnd = String(normalizedDraft.auditDateEnd || '');
    appState.auditors = String(normalizedDraft.auditors || '');
    appState.standard = normalizeStandardValue(normalizedDraft.standard || defaultState.standard);
    appState.testingInstructions = String(normalizedDraft.testingInstructions || '');
    appState.branding = normalizeBranding(normalizedDraft.branding);

    saveState({ action: 'Updated report metadata' });
    window.dispatchEvent(new CustomEvent('art-standard-changed', {
        detail: { standard: appState.standard }
    }));
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function buildMetadataDraftFromValues(values) {
    const draft = getDefaultMetadataObject();
    Object.entries(values || {}).forEach(([keyPath, rawValue]) => {
        const path = keyPath.split('.').filter(Boolean);
        if (path.length === 0) return;
        setObjectPath(draft, path, castMetadataValue(path, rawValue));
    });
    draft.branding = normalizeBranding(draft.branding);
    return draft;
}

export function clearReportContentOnly() {
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    saveState({ action: 'Cleared report content' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function clearReportEverythingInSession() {
    const metadataDefaults = getDefaultMetadataObject();
    appState.reportTitle = metadataDefaults.reportTitle;
    appState.orgClient = metadataDefaults.orgClient;
    appState.projectName = metadataDefaults.projectName;
    appState.scopeUrl = metadataDefaults.scopeUrl;
    appState.auditDateStart = metadataDefaults.auditDateStart;
    appState.auditDateEnd = metadataDefaults.auditDateEnd;
    appState.auditors = metadataDefaults.auditors;
    appState.standard = metadataDefaults.standard;
    appState.testingInstructions = metadataDefaults.testingInstructions;
    appState.reportType = defaultState.reportType;
    appState.reportLayout = defaultState.reportLayout;
    appState.templateOption = defaultState.templateOption;
    appState.templateName = defaultState.templateName;
    appState.templateDescription = defaultState.templateDescription;
    appState.progressLogEnabled = defaultState.progressLogEnabled;
    appState.progressLogAppendixEnabled = defaultState.progressLogAppendixEnabled;
    appState.progressItems = [];
    appState.fields = [];
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    appState.fieldsExpanded = defaultState.fieldsExpanded;
    appState.branding = normalizeBranding(defaultState.branding);
    appState.editingIndex = -1;

    saveState({ action: 'Cleared report configuration and content' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function closeCurrentReportSession() {
    appState.selectedReportId = '';
    appState.reportTitle = defaultState.reportTitle;
    appState.orgClient = defaultState.orgClient;
    appState.projectName = defaultState.projectName;
    appState.scopeUrl = defaultState.scopeUrl;
    appState.auditDateStart = defaultState.auditDateStart;
    appState.auditDateEnd = defaultState.auditDateEnd;
    appState.auditors = defaultState.auditors;
    appState.standard = defaultState.standard;
    appState.testingInstructions = defaultState.testingInstructions;
    appState.reportType = defaultState.reportType;
    appState.reportLayout = defaultState.reportLayout;
    appState.templateOption = defaultState.templateOption;
    appState.templateName = defaultState.templateName;
    appState.templateDescription = defaultState.templateDescription;
    appState.progressLogEnabled = defaultState.progressLogEnabled;
    appState.progressLogAppendixEnabled = defaultState.progressLogAppendixEnabled;
    appState.progressItems = [];
    appState.fieldsExpanded = defaultState.fieldsExpanded;
    appState.fields = [];
    appState.editingIndex = -1;
    appState.editorUsesReportTitle = false;
    appState.editorReadOnly = false;
    appState.editorFieldValues = {};
    appState.auditEntries = [];
    appState.activeAuditEntryIndex = 0;
    appState.templateEditingId = null;
    appState.templateCreateMode = false;
    appState.branding = normalizeBranding(defaultState.branding);

    saveState({ action: 'Closed active report' });
    window.dispatchEvent(new Event('art-reports-updated'));
}

export function getReportById(reportId) {
    return (appState.reports || []).find((report) => report.id === reportId) || null;
}

export function currentReportSupportsAuditEntries() {
    if (appState.reportType === 'Audit Log') return true;

    const hasAuditEntries = Array.isArray(appState.auditEntries) && appState.auditEntries.length > 0;
    if (hasAuditEntries) return true;

    const hasAuditStyleSelectionField = Array.isArray(appState.fields)
        && appState.fields.some((field) => String(field?.type || '') === 'evaluation-item-selection');
    return hasAuditStyleSelectionField;
}

function getReportDataFromSnapshot(report) {
    return report?.data && typeof report.data === 'object' ? report.data : null;
}

function getMetricsFromReportData(reportData) {
    if (!reportData) {
        return {
            totalIssues: 0,
            pagesTested: 0,
            issuesBySeverity: 'None',
            wcagCriteria: 0,
            totalAuditEntries: 0
        };
    }

    const fields = Array.isArray(reportData.fields) ? reportData.fields : [];
    const entries = Array.isArray(reportData.auditEntries) && reportData.auditEntries.length > 0
        ? reportData.auditEntries
        : [{ fieldValues: reportData.editorFieldValues || {} }];

    const pageFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => /page|url|scope/i.test(String(item.field?.label || '')))
        .map((item) => item.index);

    const severityFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => /severity|risk/i.test(String(item.field?.label || '')))
        .map((item) => item.index);

    const wcagFieldIndexes = fields
        .map((field, index) => ({ field, index }))
        .filter((item) => String(item.field?.type || '') === 'wcag-success-criterion')
        .map((item) => item.index);

    const pages = new Set();
    const wcagSet = new Set();
    const severityCounts = new Map();

    entries.forEach((entry) => {
        const values = entry?.fieldValues || {};
        pageFieldIndexes.forEach((fieldIndex) => {
            const value = String(values[fieldIndex] || '').trim();
            if (value) pages.add(value);
        });
        severityFieldIndexes.forEach((fieldIndex) => {
            const value = String(values[fieldIndex] || '').trim();
            if (!value) return;
            severityCounts.set(value, Number(severityCounts.get(value) || 0) + 1);
        });
        wcagFieldIndexes.forEach((fieldIndex) => {
            const value = values[fieldIndex];
            if (value && typeof value === 'object' && value.identifier) {
                wcagSet.add(String(value.identifier));
                return;
            }
            const rawText = String(value || '');
            const match = rawText.match(/\b\d+\.\d+\.\d+\b/);
            if (match) wcagSet.add(match[0]);
        });
    });

    const issuesBySeverity = [...severityCounts.entries()]
        .map(([label, count]) => `${label}: ${count}`)
        .join(', ') || 'None';

    return {
        totalIssues: entries.length,
        pagesTested: pages.size,
        issuesBySeverity,
        wcagCriteria: wcagSet.size,
        totalAuditEntries: entries.length
    };
}

export function computeReportMetrics(report) {
    return getMetricsFromReportData(getReportDataFromSnapshot(report));
}

export function getCurrentReportMetrics() {
    return getMetricsFromReportData(getCurrentReportSnapshotData());
}

export function validateCurrentReport() {
    const issues = [];
    const metadataChecks = [
        ['reportTitle', appState.reportTitle, 'Report title is required.', 'metadata', 'reportTitle'],
        ['orgClient', appState.orgClient, 'Organization/Client is required.', 'metadata', 'orgClient'],
        ['projectName', appState.projectName, 'Project name is required.', 'metadata', 'projectName'],
        ['scopeUrl', appState.scopeUrl, 'URL / Scope is required.', 'metadata', 'scopeUrl'],
        ['auditors', appState.auditors, 'Auditor(s) is required.', 'metadata', 'auditors'],
        ['reportType', appState.reportType, 'Report type is required.', 'builder', 'report-type-select'],
        ['reportLayout', appState.reportLayout, 'Report layout is required.', 'builder', 'report-layout-select']
    ];

    metadataChecks.forEach(([keyPath, value, message, targetType, target]) => {
        if (!String(value || '').trim()) {
            issues.push({
                code: `metadata-${keyPath}`,
                message,
                targetType,
                target
            });
        }
    });

    if (!Array.isArray(appState.fields) || appState.fields.length === 0) {
        issues.push({
            code: 'fields-missing',
            message: 'At least one report field must be configured.',
            targetType: 'builder',
            target: 'btn-toggle-config'
        });
    }

    const brandingMessage = getBrandingAltValidationMessage(appState.branding);
    if (brandingMessage) {
        issues.push({
            code: 'branding-alt-missing',
            message: brandingMessage,
            targetType: 'builder',
            target: 'branding-config-heading'
        });
    }

    const entries = currentReportSupportsAuditEntries()
        ? getAuditEntries()
        : [{ fieldValues: appState.editorFieldValues || {} }];

    if (currentReportSupportsAuditEntries() && (!Array.isArray(entries) || entries.length === 0)) {
        issues.push({
            code: 'entries-missing',
            message: 'At least one audit entry is required.',
            targetType: 'editor',
            target: 'btn-add-entry'
        });
    }

    const seenIdentifiers = new Map();

    entries.forEach((entry, entryIndex) => {
        (appState.fields || []).forEach((field, fieldIndex) => {
            const type = field?.type === 'select' ? 'dropdown' : field?.type || 'text';
            const label = String(field?.label || `Field ${fieldIndex + 1}`);
            const rawValue = entry?.fieldValues?.[fieldIndex];
            const isStructuredWcag = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue);
            const textValue = isStructuredWcag
                ? `${rawValue.number || ''} ${rawValue.title || ''}`.trim()
                : String(rawValue || '').trim();

            if (!textValue) {
                issues.push({
                    code: `empty-${entryIndex}-${fieldIndex}`,
                    message: `${label} is required for entry ${entryIndex + 1}.`,
                    targetType: 'entry-field',
                    target: `editor-field-${entryIndex}-${fieldIndex}`
                });
                return;
            }

            if (fieldIndex === 0) {
                const normalized = textValue.toLowerCase();
                if (seenIdentifiers.has(normalized)) {
                    issues.push({
                        code: `duplicate-${entryIndex}-${fieldIndex}`,
                        message: `Duplicate identifier ${textValue} found in the first column.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                } else {
                    seenIdentifiers.set(normalized, entryIndex);
                }
            }

            if (type === 'dropdown') {
                const allowed = Array.isArray(field.dropdownOptions) ? field.dropdownOptions.map((option) => String(option)) : [];
                if (!allowed.includes(String(rawValue))) {
                    issues.push({
                        code: `invalid-dropdown-${entryIndex}-${fieldIndex}`,
                        message: `${label} contains an invalid value for entry ${entryIndex + 1}.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                }
            }

            if (type === 'evaluation-item-selection') {
                const allowed = getProgressItemNames();
                if (allowed.length > 0 && !allowed.includes(String(rawValue))) {
                    issues.push({
                        code: `invalid-evaluation-item-${entryIndex}-${fieldIndex}`,
                        message: `${label} must reference an available Progress Log evaluation item for entry ${entryIndex + 1}.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                }
            }

            if (type === 'wcag-success-criterion') {
                const hasIdentifier = isStructuredWcag
                    ? String(rawValue.identifier || '').trim()
                    : textValue.match(/\b\d+\.\d+\.\d+\b/);
                if (!hasIdentifier) {
                    issues.push({
                        code: `missing-wcag-${entryIndex}-${fieldIndex}`,
                        message: `${label} must reference a valid WCAG success criterion for entry ${entryIndex + 1}.`,
                        targetType: 'entry-field',
                        target: `editor-field-${entryIndex}-${fieldIndex}`
                    });
                }
            }
        });
    });

    return issues;
}

export function upsertCurrentReport(options = {}) {
    const preferredName = String(options.name || getReportDisplayName()).trim();
    const reportName = preferredName || 'Untitled Report';
    const reportData = getCurrentReportSnapshotData();
    const selected = appState.selectedReportId ? getReportById(appState.selectedReportId) : null;
    const reportId = selected?.id || `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existingIndex = (appState.reports || []).findIndex((report) => report.id === reportId);

    const snapshot = {
        id: reportId,
        name: reportName,
        updatedAt: Date.now(),
        data: reportData
    };

    if (existingIndex >= 0) {
        appState.reports[existingIndex] = snapshot;
    } else {
        appState.reports.push(snapshot);
    }

    appState.selectedReportId = reportId;
    saveState({ action: `Saved report ${reportName}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return snapshot;
}

export function loadReportById(reportId) {
    const report = getReportById(reportId);
    if (!report) return null;

    const mergedState = normalizeStateSnapshot({
        ...appState,
        ...report.data,
        selectedReportId: report.id
    });
    appState = mergedState;
    syncEditorValuesFromActiveEntry();
    saveState({ action: `Loaded report ${report.name}`, recordHistory: false });
    return report;
}

export function deleteReportById(reportId) {
    const index = (appState.reports || []).findIndex((report) => report.id === reportId);
    if (index < 0) return null;
    const [removed] = appState.reports.splice(index, 1);
    if (appState.selectedReportId === removed.id) {
        appState.selectedReportId = appState.reports[0]?.id || '';
    }
    saveState({ action: `Deleted report ${removed.name}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return removed;
}

export function renameReportById(reportId, newName) {
    const index = (appState.reports || []).findIndex((report) => report.id === reportId);
    if (index < 0) return null;

    const name = String(newName || '').trim();
    if (!name) return null;

    const current = appState.reports[index];
    const updated = {
        ...current,
        name,
        updatedAt: Date.now(),
        data: {
            ...current.data,
            reportTitle: name
        }
    };
    appState.reports[index] = updated;

    if (String(appState.selectedReportId || '').trim() === reportId) {
        appState.reportTitle = name;
    }

    saveState({ action: `Renamed report ${updated.name}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return updated;
}

export function reportNameExists(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    return (appState.reports || []).some((report) => String(report.name || '').trim().toLowerCase() === normalized);
}

export function importReportWithConflictStrategy(reportState, strategy) {
    const normalizedImport = normalizeStateSnapshot(reportState);
    const importName = String(normalizedImport.reportTitle || 'Untitled Report').trim() || 'Untitled Report';
    const reports = appState.reports || [];
    const sameNameIndex = reports.findIndex((report) => String(report.name || '').trim().toLowerCase() === importName.toLowerCase());

    let targetName = importName;
    let targetId = '';

    if (sameNameIndex >= 0) {
        if (strategy === 'replace') {
            targetId = reports[sameNameIndex].id;
        } else if (strategy === 'copy') {
            targetName = getUniqueReportName(importName);
        } else {
            return null;
        }
    }

    const snapshot = {
        id: targetId || `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: targetName,
        updatedAt: Date.now(),
        data: getCurrentReportSnapshotData()
    };

    const mergedState = normalizeStateSnapshot({
        ...appState,
        ...normalizedImport,
        reportTitle: targetName,
        selectedReportId: snapshot.id
    });
    appState = mergedState;
    syncEditorValuesFromActiveEntry();

    const existingIndex = reports.findIndex((report) => report.id === snapshot.id);
    const savedSnapshot = {
        ...snapshot,
        data: getCurrentReportSnapshotData()
    };

    if (existingIndex >= 0) {
        appState.reports[existingIndex] = savedSnapshot;
    } else {
        appState.reports.push(savedSnapshot);
    }

    saveState({ action: `Imported report ${targetName}` });
    window.dispatchEvent(new Event('art-reports-updated'));
    return savedSnapshot;
}

export function ensureAuditEntries() {
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    if (appState.activeAuditEntryIndex < 0 || appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = 0;
    }
    syncEditorValuesFromActiveEntry();
}

export function addAuditEntry() {
    ensureAuditEntries();
    const newEntry = normalizeAuditEntry({ fieldValues: createBlankFieldValues(appState.fields) }, appState.fields);
    appState.auditEntries.push(newEntry);
    appState.activeAuditEntryIndex = appState.auditEntries.length - 1;
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Added audit entry' });
    return appState.activeAuditEntryIndex;
}

export function setActiveAuditEntryIndex(index) {
    if (!Array.isArray(appState.auditEntries) || appState.auditEntries.length === 0) {
        ensureAuditEntries();
    }
    const safeIndex = Math.max(0, Math.min(Number(index || 0), appState.auditEntries.length - 1));
    appState.activeAuditEntryIndex = safeIndex;
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Changed active audit entry', recordHistory: false });
}

export function updateAuditEntryFieldValue(entryIndex, fieldIndex, value) {
    ensureAuditEntries();
    const entry = appState.auditEntries[entryIndex];
    if (!entry) return;
    entry.fieldValues[fieldIndex] = normalizeEditorFieldValue(value);
    if (entryIndex === appState.activeAuditEntryIndex) {
        appState.editorFieldValues[fieldIndex] = normalizeEditorFieldValue(value);
    }
    saveState({ action: 'Updated audit entry content' });
}

export function moveAuditEntry(entryIndex, direction) {
    ensureAuditEntries();
    const from = Number(entryIndex);
    const to = from + Number(direction);
    if (from < 0 || from >= appState.auditEntries.length || to < 0 || to >= appState.auditEntries.length) return null;

    const moved = appState.auditEntries.splice(from, 1)[0];
    appState.auditEntries.splice(to, 0, moved);
    if (appState.activeAuditEntryIndex === from) {
        appState.activeAuditEntryIndex = to;
    } else if (from < appState.activeAuditEntryIndex && to >= appState.activeAuditEntryIndex) {
        appState.activeAuditEntryIndex -= 1;
    } else if (from > appState.activeAuditEntryIndex && to <= appState.activeAuditEntryIndex) {
        appState.activeAuditEntryIndex += 1;
    }
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Moved audit entry' });
    return to;
}

export function deleteAuditEntry(entryIndex) {
    ensureAuditEntries();
    const index = Number(entryIndex);
    if (index < 0 || index >= appState.auditEntries.length) return null;
    const [removed] = appState.auditEntries.splice(index, 1);
    if (appState.auditEntries.length === 0) {
        appState.auditEntries = normalizeAuditEntries([], appState.fields, {});
    }
    if (appState.activeAuditEntryIndex >= appState.auditEntries.length) {
        appState.activeAuditEntryIndex = appState.auditEntries.length - 1;
    }
    syncEditorValuesFromActiveEntry();
    saveState({ action: 'Deleted audit entry' });
    return removed;
}

export function getAuditEntries() {
    ensureAuditEntries();
    return appState.auditEntries;
}

export function getAuditEntryDisplayName(entryIndex) {
    ensureAuditEntries();
    const entry = appState.auditEntries[entryIndex];
    if (!entry) return `Entry ${entryIndex + 1}`;
    const firstField = appState.fields?.[0];
    const firstValue = String(entry.fieldValues?.[0] || '').trim();
    if (firstValue) return firstValue;
    if (firstField?.label) return `${firstField.label} ${entryIndex + 1}`;
    return `Entry ${entryIndex + 1}`;
}

/**
 * Updates an announcer element (for screen readers).
 */
export function announce(msg) {
    const announcer = document.getElementById('announcer');
    if (!announcer) return;

    // Clear first so repeated/rapid messages still get announced by AT.
    announcer.textContent = '';
    window.setTimeout(() => {
        announcer.textContent = msg;
    }, 20);
}

/**
 * Updates a specific metadata field and persists the change.
 */
export function updateHeader(key, val) {
    appState[key] = val;
    saveState({ action: `Updated ${key}` });
}

/**
 * Updates a specific editor field value and persists the change.
 */
export function updateEditorFieldValue(index, value) {
    appState.editorFieldValues[index] = normalizeEditorFieldValue(value);
    if (appState.reportType === 'Audit Log') {
        syncAuditEntriesFromEditorValues();
    }
    saveState({ action: 'Updated report content' });
}

// --- Field Management Logic ---

/**
 * Adds a new field or updates an existing one based on editingIndex.
 */
export function addOrUpdateField() {
    const labelInput = document.getElementById('field-label-input');
    const typeInput = document.getElementById('field-type-input');
    const optionsInput = document.getElementById('field-dropdown-options-input');
    
    if (!labelInput || !labelInput.value) return;

    const typeValue = typeInput?.value === 'select' ? 'dropdown' : typeInput?.value || 'text';
    const dropdownOptions = typeValue === 'dropdown' && optionsInput
        ? optionsInput.value.split('\n').map((option) => option.trim()).filter(Boolean)
        : [];
    const fieldData = {
        label: labelInput.value,
        type: typeValue,
        dropdownOptions
    };

    if (appState.editingIndex === -1) {
        // Add new field
        appState.fields.push(fieldData);
        appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
        announce(`Added field ${labelInput.value}`);
    } else {
        // Update existing field
        appState.fields[appState.editingIndex] = fieldData;
        appState.editingIndex = -1; // Reset mode
        appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
        announce("Field updated");
    }
    
    saveState({ action: `Updated report field ${labelInput.value}` });
}

/**
 * Sets the builder into edit mode for a specific field.
 */
export function setEditMode(index) {
    appState.editingIndex = index;
    const field = appState.fields[index];

    announce(`Editing ${field.label}`);
}

/**
 * Removes a field from the state.
 */
export function deleteField(index) {
    const removed = appState.fields.splice(index, 1);
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    saveState({ action: `Deleted report field ${removed[0].label}` });
    announce(`Deleted ${removed[0].label}`);
}

/**
 * Moves a field up or down in the array.
 */
export function moveField(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= appState.fields.length) return;

    const adjacentField = appState.fields[newIdx];
    const referenceLabel = adjacentField?.label || appState.fields[index]?.label || 'field';
    
    const field = appState.fields.splice(index, 1)[0];
    appState.fields.splice(newIdx, 0, field);
    appState.auditEntries = normalizeAuditEntries(appState.auditEntries, appState.fields, appState.editorFieldValues);
    saveState({ action: `Moved report field ${field.label}` });
    announce(`Moved ${direction < 0 ? 'before' : 'after'} ${referenceLabel}`);
    return newIdx;
}
