// dashboard.js
import { renderBuilder } from './reportBuilder.js';

export function renderDashboard() {
    const btnNew = document.getElementById('btn-new-report');
    
    // Add event listener to the "New Report" button
    btnNew.addEventListener('click', () => {
        // 1. Find the Builder tab
        const builderTab = document.getElementById('tab-builder');
        
        if (builderTab) {
            // 2. Programmatically click the tab to trigger the navigation logic
            // defined in navigation.js (which handles rendering and aria-selection)
            builderTab.click();
        }
    });
}
