// loader.js
import { setupTabs, initNavListener } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initLookupTool } from './lookupTool.js';
import { initSettings } from './settings.js';
import { renderWelcome } from './welcome.js';
import { initApplicationIdentity } from './appIdentity.js';
import { initResizableLayout } from './layout.js';
import { initHelp, openHelpDialog } from './help.js';
import { initThemeEngine } from './themeEngine.js';
import { initCommandPalette } from './commandPalette.js';
import { initMenuBar } from './menuBar.js';
import { initGlobalContextMenuFramework } from './globalContextMenuFramework.js';
import { registerApplicationCommands } from './commandCatalog.js';
import { initExplorerFramework } from './explorerFramework.js';
import { initReportViewsFramework } from './reportViewsFramework.js';
import { initPluginFramework } from './pluginFramework.js';
import { announce, canPerformExternalCommunication, recordSecurityAudit, setNetworkActivity } from './state.js';
import { initializeUniversalSearchFramework } from './universalSearchFramework.js';

/**
 * The orchestrator: ensures all modules are initialized 
 * only after the DOM is fully parsed.
 */
let hasInitialized = false;
const STARTUP_STAGE_WARN_MS = 800;
const STARTUP_HANG_WARN_MS = 6000;

const startupWatchdog = {
    startedAt: 0,
    stages: [],
    complete: false,
    timeoutId: 0
};

function startupNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function beginStartupWatchdog() {
    startupWatchdog.startedAt = startupNow();
    startupWatchdog.stages = [];
    startupWatchdog.complete = false;

    if (startupWatchdog.timeoutId) {
        window.clearTimeout(startupWatchdog.timeoutId);
    }

    startupWatchdog.timeoutId = window.setTimeout(() => {
        if (startupWatchdog.complete) return;
        const elapsed = Math.round(startupNow() - startupWatchdog.startedAt);
        console.warn(`[ART startup] Initialization still running after ${elapsed}ms.`);
        window.dispatchEvent(new CustomEvent('art-startup-watchdog', {
            detail: {
                type: 'startup-timeout-warning',
                elapsedMs: elapsed,
                stages: [...startupWatchdog.stages]
            }
        }));
    }, STARTUP_HANG_WARN_MS);
}

function recordStartupStage(name, startedAt, endedAt) {
    const durationMs = Math.round(endedAt - startedAt);
    const stage = { name, durationMs };
    startupWatchdog.stages.push(stage);

    if (durationMs >= STARTUP_STAGE_WARN_MS) {
        console.warn(`[ART startup] Slow stage detected: ${name} took ${durationMs}ms.`);
    }
}

function runStartupStage(name, work) {
    const startedAt = startupNow();
    try {
        return work();
    } catch (error) {
        console.error(`[ART startup] Stage failed: ${name}.`, error);
        window.dispatchEvent(new CustomEvent('art-startup-stage-failed', {
            detail: {
                stage: name,
                message: String(error?.message || error)
            }
        }));
        return null;
    } finally {
        recordStartupStage(name, startedAt, startupNow());
    }
}

function completeStartupWatchdog() {
    startupWatchdog.complete = true;
    if (startupWatchdog.timeoutId) {
        window.clearTimeout(startupWatchdog.timeoutId);
        startupWatchdog.timeoutId = 0;
    }

    const totalMs = Math.round(startupNow() - startupWatchdog.startedAt);
    console.info(`[ART startup] Initialization completed in ${totalMs}ms.`, startupWatchdog.stages);
    window.dispatchEvent(new CustomEvent('art-startup-watchdog', {
        detail: {
            type: 'startup-complete',
            elapsedMs: totalMs,
            stages: [...startupWatchdog.stages]
        }
    }));
}

function isHelpDirectLink() {
    const path = String(window.location.pathname || '').toLowerCase();
    return /\/art-help(?:\/|\/index\.html)?$/.test(path);
}

function openHelpFromDirectLink() {
    if (!isHelpDirectLink()) return;

    openHelpDialog(null);

    const hash = String(window.location.hash || '');
    if (!hash || !hash.startsWith('#help-')) return;

    window.setTimeout(() => {
        const target = document.querySelector(hash);
        if (!target) return;

        const headingId = target.getAttribute('aria-labelledby') || '';
        const heading = headingId
            ? document.getElementById(headingId)
            : target.querySelector('h1, h2, h3, h4, h5, h6');

        if (heading) {
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }

        target.scrollIntoView({ block: 'start' });
    }, 0);
}

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

    beginStartupWatchdog();

    // 1. Initialize global navigation and keyboard shortcuts
    runStartupStage('initResizableLayout', () => initResizableLayout());
    runStartupStage('registerApplicationCommands', () => registerApplicationCommands());
    runStartupStage('initNavListener', () => initNavListener());
    runStartupStage('setupTabs', () => setupTabs());
    runStartupStage('initApplicationIdentity', () => initApplicationIdentity());
    runStartupStage('initThemeEngine', () => initThemeEngine());
    runStartupStage('initializeUniversalSearchFramework', () => initializeUniversalSearchFramework());
    runStartupStage('bindExternalNavigationGuard', () => bindExternalNavigationGuard());
    runStartupStage('initMenuBar', () => initMenuBar());
    runStartupStage('initGlobalContextMenuFramework', () => initGlobalContextMenuFramework());
    
    // 2. Initialize side-panel tools
    runStartupStage('initLookupTool', () => initLookupTool());
    
    // 3. Initialize interactive dashboard elements
    runStartupStage('renderDashboard', () => renderDashboard());

    // 3b. Initialize workspace explorer/dashboard switching
    runStartupStage('initExplorerFramework', () => initExplorerFramework());

    // 3c. Initialize report views framework (non-blocking for core startup)
    runStartupStage('initReportViewsFramework', () => {
        try {
            initReportViewsFramework();
        } catch (error) {
            console.error('[ART startup] Report views initialization failed.', error);
            announce('Report Views could not be initialized. Core application features remain available.');
        }
    });

    // 3d. Initialize plugin framework (non-blocking for core startup)
    runStartupStage('initPluginFramework', () => {
        try {
            initPluginFramework();
        } catch (error) {
            console.error('[ART startup] Plugin framework initialization failed.', error);
            announce('Plugin Framework could not be initialized. Core application features remain available.');
        }
    });

    // 4. Initialize application settings modal
    runStartupStage('initSettings', () => {
        initSettings();
    });

    // 5. Initialize the Command Palette
    runStartupStage('initCommandPalette', () => initCommandPalette());

    // 6. Initialize integrated help system
    runStartupStage('initHelp', () => initHelp());
    
    // 7. Set the default application view
    runStartupStage('renderWelcome', () => renderWelcome());

    // 8. Support direct Help deep links without changing existing Help behavior
    runStartupStage('openHelpFromDirectLink', () => openHelpFromDirectLink());

    completeStartupWatchdog();
    
    console.log("ART System fully initialized.");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
    initializeApp();
}
