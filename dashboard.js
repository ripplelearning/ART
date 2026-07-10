// dashboard.js

/**
 * Initializes the dashboard buttons.
 * This is called by loader.js once the DOM is ready.
 */
export function renderDashboard() {
    const btnNew = document.getElementById('btn-new-report');
    
    // Safety check to prevent errors if the button is missing
    if (!btnNew) return;

    // Remove existing listeners if necessary (if renderDashboard is called multiple times)
    btnNew.replaceWith(btnNew.cloneNode(true));
    const newBtn = document.getElementById('btn-new-report');

    newBtn.addEventListener('click', () => {
        const builderTab = document.getElementById('tab-builder');
        if (builderTab) {
            // This triggers the tab click, which calls navigation.js's rendering logic
            builderTab.click();
        }
    });
}
