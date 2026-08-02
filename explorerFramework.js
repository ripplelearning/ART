import {
    announce,
    getActiveWorkspaceView,
    getWorkspaceViewConfig,
    setActiveWorkspaceView
} from './state.js';
import { revealWorkspaceReportFromCommand } from './projectWorkspaceFramework.js';

let initialized = false;

function getElements() {
    return {
        dashboardPanel: document.getElementById('dashboard-workspace-view-dashboard'),
        explorerPanel: document.getElementById('art-explorer-view'),
        explorerSections: document.getElementById('art-explorer-sections'),
        explorerHeading: document.getElementById('art-explorer-heading'),
        explorerSearch: document.getElementById('art-explorer-search'),
        explorerStatus: document.getElementById('art-explorer-status'),
        clearSearchButton: document.getElementById('btn-art-explorer-clear-search'),
        showExplorerButton: document.getElementById('btn-switch-to-explorer'),
        showDashboardButton: document.getElementById('btn-switch-to-dashboard')
    };
}

function getNormalizedView(value, fallback = 'dashboard') {
    return String(value || '').trim().toLowerCase() === 'explorer' ? 'explorer' : fallback;
}

function applyExplorerWidth() {
    const { explorerPanel } = getElements();
    const config = getWorkspaceViewConfig();
    const width = Number(config?.explorer?.width || 320);
    if (!explorerPanel) return;
    explorerPanel.style.setProperty('--art-explorer-width', `${Math.max(240, Math.min(560, Math.round(width)))}px`);
}

function syncResourceFilterFromExplorer(value) {
    const filter = document.getElementById('workspace-resource-filter');
    if (!filter) return;
    if (filter.value !== value) {
        filter.value = value;
        filter.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function mountWorkspaceExplorer() {
    const { explorerSections } = getElements();
    const workspaceExplorer = document.getElementById('workspace-explorer');
    if (!explorerSections || !workspaceExplorer) return;
    if (workspaceExplorer.parentElement !== explorerSections) {
        explorerSections.appendChild(workspaceExplorer);
    }
}

function setExplorerStatus(message) {
    const { explorerStatus } = getElements();
    if (explorerStatus) explorerStatus.textContent = message;
}

function applyWorkspaceView(view, options = {}) {
    const {
        dashboardPanel,
        explorerPanel,
        explorerHeading,
        showExplorerButton,
        showDashboardButton
    } = getElements();
    if (!dashboardPanel || !explorerPanel) return false;

    const normalized = getNormalizedView(view, 'dashboard');
    const isExplorer = normalized === 'explorer';

    dashboardPanel.hidden = isExplorer;
    explorerPanel.hidden = !isExplorer;

    if (showExplorerButton) {
        showExplorerButton.disabled = isExplorer;
        showExplorerButton.setAttribute('aria-pressed', String(isExplorer));
    }
    if (showDashboardButton) {
        showDashboardButton.disabled = !isExplorer;
        showDashboardButton.setAttribute('aria-pressed', String(!isExplorer));
    }

    mountWorkspaceExplorer();
    applyExplorerWidth();

    setActiveWorkspaceView(normalized, {
        persist: options.persist !== false,
        action: String(options.action || `Switched workspace view to ${normalized}`)
    });

    if (options.announce !== false) {
        const text = isExplorer ? 'Explorer view shown.' : 'Dashboard view shown.';
        announce(text);
        setExplorerStatus(text);
    }

    if (isExplorer && options.focusExplorer === true && explorerHeading) {
        explorerHeading.focus({ preventScroll: true });
    }

    return true;
}

function bindViewSwitchButtons() {
    const { showExplorerButton, showDashboardButton } = getElements();
    showExplorerButton?.addEventListener('click', () => {
        showExplorerViewFromCommand();
    });
    showDashboardButton?.addEventListener('click', () => {
        showDashboardViewFromCommand();
    });
}

function getPreferredInitialView() {
    const config = getWorkspaceViewConfig();
    const defaultView = getNormalizedView(config.defaultView, 'dashboard');
    if (!config.rememberLastView) return defaultView;
    return getNormalizedView(config.active, defaultView);
}

function bindExplorerSearch() {
    const { explorerSearch, clearSearchButton } = getElements();
    if (!explorerSearch || !clearSearchButton) return;

    explorerSearch.addEventListener('input', () => {
        syncResourceFilterFromExplorer(explorerSearch.value || '');
    });

    clearSearchButton.addEventListener('click', () => {
        explorerSearch.value = '';
        syncResourceFilterFromExplorer('');
        explorerSearch.focus();
    });
}

function bindExplorerSyncEvents() {
    window.addEventListener('art-project-workspace-updated', () => {
        mountWorkspaceExplorer();
    });

    window.addEventListener('art-workspace-view-settings-updated', () => {
        applyExplorerWidth();
    });

    window.addEventListener('art-state-restored', () => {
        applyWorkspaceView(getPreferredInitialView(), {
            persist: false,
            announce: false,
            focusExplorer: false
        });
    });

    window.addEventListener('art-working-view-reveal-in-explorer', (event) => {
        const reportId = String(event?.detail?.reportId || '').trim();
        const findingLabel = String(event?.detail?.findingLabel || '').trim();
        if (!reportId) return;

        showExplorerViewFromCommand();
        const success = revealWorkspaceReportFromCommand(reportId, {
            filterText: findingLabel,
            select: true
        });

        if (!success) {
            setExplorerStatus('Explorer opened, but the report could not be revealed in Resource Navigator.');
        } else if (findingLabel) {
            setExplorerStatus(`Explorer opened. Report revealed for finding: ${findingLabel}.`);
        }
    });
}

export function initExplorerFramework() {
    if (initialized) return true;
    initialized = true;

    const { dashboardPanel, explorerPanel } = getElements();
    if (!dashboardPanel || !explorerPanel) return false;

    bindExplorerSearch();
    bindViewSwitchButtons();
    bindExplorerSyncEvents();
    mountWorkspaceExplorer();

    applyWorkspaceView(getPreferredInitialView(), {
        persist: false,
        announce: false,
        focusExplorer: false
    });

    return true;
}

export function showDashboardViewFromCommand() {
    return applyWorkspaceView('dashboard', {
        persist: true,
        announce: true,
        focusExplorer: false,
        action: 'Showed dashboard workspace view'
    });
}

export function showExplorerViewFromCommand() {
    return applyWorkspaceView('explorer', {
        persist: true,
        announce: true,
        focusExplorer: true,
        action: 'Showed explorer workspace view'
    });
}

export function toggleWorkspaceViewFromCommand() {
    const current = getNormalizedView(getActiveWorkspaceView(), 'dashboard');
    const next = current === 'explorer' ? 'dashboard' : 'explorer';
    return applyWorkspaceView(next, {
        persist: true,
        announce: true,
        focusExplorer: next === 'explorer',
        action: 'Toggled workspace view'
    });
}
