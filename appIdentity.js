import { appState } from './state.js';

const APP_NAME = 'ART';
const TAB_PANEL_MAP = {
    'tab-welcome': 'Welcome',
    'tab-builder': 'Report Builder',
    'tab-editor': 'Report Editor',
    'tab-view': 'Report Viewer'
};

let lastTitleSignature = '';
let activePanelHint = '';

function getSelectedTabPanelName() {
    const selected = document.querySelector('#top-tabs button[role="tab"][aria-selected="true"]');
    if (!selected) return 'Welcome';
    return TAB_PANEL_MAP[selected.id] || 'Welcome';
}

function getReportName() {
    const selectedReport = (appState.reports || []).find((report) => report.id === appState.selectedReportId);
    const preferred = String(appState.reportTitle || selectedReport?.name || appState.templateName || '').trim();
    return preferred;
}

function hasOpenReport() {
    return Boolean(
        String(appState.reportTitle || '').trim()
        || String(appState.reportType || '').trim()
        || (Array.isArray(appState.fields) && appState.fields.length > 0)
        || String(appState.selectedReportId || '').trim()
    );
}

function getCurrentPanelName() {
    return activePanelHint || getSelectedTabPanelName();
}

export function setActivePanel(panelName) {
    const normalized = String(panelName || '').trim();
    if (!normalized) return;
    if (activePanelHint === normalized) return;
    activePanelHint = normalized;
    syncDocumentTitle();
}

export function syncDocumentTitle() {
    const panelName = getCurrentPanelName();
    const reportName = getReportName();
    const title = hasOpenReport() && reportName
        ? `${reportName} – ${panelName} | ${APP_NAME}`
        : `${panelName} | ${APP_NAME}`;

    if (lastTitleSignature === title) return;
    document.title = title;
    lastTitleSignature = title;
}

function mapPanelFromFocusTarget(target) {
    if (!target || typeof target.closest !== 'function') return '';
    if (target.closest('#dashboard')) return 'Dashboard';
    if (target.closest('#lookup-tool')) return 'WCAG Lookup Tool';
    if (target.closest('#main-inner')) return getSelectedTabPanelName();
    return '';
}

export function initApplicationIdentity() {
    window.addEventListener('art-panel-changed', (event) => {
        setActivePanel(event?.detail?.panel || '');
    });

    window.addEventListener('art-state-updated', () => {
        syncDocumentTitle();
    });

    window.addEventListener('art-state-restored', () => {
        syncDocumentTitle();
    });

    window.addEventListener('art-reports-updated', () => {
        syncDocumentTitle();
    });

    document.addEventListener('focusin', (event) => {
        const focusedPanel = mapPanelFromFocusTarget(event.target);
        if (focusedPanel) setActivePanel(focusedPanel);
    });

    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.addEventListener('click', () => setActivePanel('Dashboard'));
    }

    const lookup = document.getElementById('lookup-tool');
    if (lookup) {
        lookup.addEventListener('click', () => setActivePanel('WCAG Lookup Tool'));
        lookup.addEventListener('focusin', () => setActivePanel('WCAG Lookup Tool'));
    }

    const tabList = document.getElementById('top-tabs');
    if (tabList) {
        const observer = new MutationObserver(() => {
            const current = getSelectedTabPanelName();
            if (current) {
                activePanelHint = current;
                syncDocumentTitle();
            }
        });
        observer.observe(tabList, {
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-selected']
        });
    }

    if (!activePanelHint) {
        activePanelHint = getSelectedTabPanelName();
    }
    syncDocumentTitle();
}
