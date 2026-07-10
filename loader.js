// loader.js
import { setupTabs, initNavListener } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initLookupTool } from './lookupTool.js';
import { renderWelcome } from './welcome.js';

/**
 * The orchestrator: ensures all modules are initialized 
 * only after the DOM is fully parsed.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize global navigation and keyboard shortcuts
    initNavListener();
    setupTabs();
    
    // 2. Initialize side-panel tools
    initLookupTool();
    
    // 3. Initialize interactive dashboard elements
    renderDashboard();
    
    // 4. Set the default application view
    renderWelcome();
    
    console.log("ART System fully initialized.");
});
