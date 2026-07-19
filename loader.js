// loader.js
import { setupTabs, initNavListener } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initLookupTool } from './lookupTool.js';
import { initSettings } from './settings.js';
import { renderWelcome } from './welcome.js';
import { initApplicationIdentity } from './appIdentity.js';
import { initResizableLayout } from './layout.js';
import { initHelp } from './help.js';
import { announce, canPerformExternalCommunication, recordSecurityAudit, setNetworkActivity } from './state.js';

/**
 * The orchestrator: ensures all modules are initialized 
 * only after the DOM is fully parsed.
 */
let hasInitialized = false;

function isExternalHttpUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function bindExternalNavigationGuard() {
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target?.closest('a[href]');
        if (!anchor) return;

        const href = anchor.getAttribute('href') || '';
        if (!isExternalHttpUrl(href)) return;
        if (canPerformExternalCommunication()) return;

        event.preventDefault();
        const message = 'Privacy Mode is enabled. External links are blocked.';
        setNetworkActivity('Privacy Mode Enabled', 'External navigation blocked by Privacy Mode.');
        recordSecurityAudit('External navigation blocked', href);
        announce(message);
    }, true);

    const originalOpen = window.open.bind(window);
    window.open = function guardedWindowOpen(url, target, features) {
        if (isExternalHttpUrl(url) && !canPerformExternalCommunication()) {
            const message = 'Privacy Mode is enabled. External links are blocked.';
            setNetworkActivity('Privacy Mode Enabled', 'External navigation blocked by Privacy Mode.');
            recordSecurityAudit('External window.open blocked', String(url || ''));
            announce(message);
            return null;
        }
        return originalOpen(url, target, features);
    };
}

function initializeApp() {
    if (hasInitialized) return;
    hasInitialized = true;

    // 1. Initialize global navigation and keyboard shortcuts
    initResizableLayout();
    initNavListener();
    setupTabs();
    initApplicationIdentity();
    bindExternalNavigationGuard();
    
    // 2. Initialize side-panel tools
    initLookupTool();
    
    // 3. Initialize interactive dashboard elements
    renderDashboard();

    // 4. Initialize application settings modal
    initSettings();

    // 5. Initialize integrated help system
    initHelp();
    
    // 6. Set the default application view
    renderWelcome();
    
    console.log("ART System fully initialized.");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
    initializeApp();
}
