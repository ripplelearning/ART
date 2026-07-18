// loader.js
import { setupTabs, initNavListener } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initLookupTool } from './lookupTool.js';
import { initSettings } from './settings.js';
import { renderWelcome } from './welcome.js';
import { initApplicationIdentity } from './appIdentity.js';
import { initResizableLayout } from './layout.js';
import { initHelp } from './help.js';

/**
 * The orchestrator: ensures all modules are initialized 
 * only after the DOM is fully parsed.
 */
let hasInitialized = false;

function initializeApp() {
    if (hasInitialized) return;
    hasInitialized = true;

    // 1. Initialize global navigation and keyboard shortcuts
    initResizableLayout();
    initNavListener();
    setupTabs();
    initApplicationIdentity();
    
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
