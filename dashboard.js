// dashboard.js

/**
 * Initializes the dashboard buttons.
 * This is called by loader.js once the DOM is ready.
 */
export function renderDashboard() {
    const btnNew = document.getElementById('btn-new-report');
    const btnBuild = document.getElementById('btn-build-report');
    const newReportOptions = document.getElementById('new-report-options');

    if (!btnNew || !newReportOptions || !btnBuild) return;

    btnNew.addEventListener('click', () => {
        newReportOptions.removeAttribute('hidden');
        const templateDropdown = document.getElementById('template-dropdown');
        if (templateDropdown) {
            templateDropdown.focus();
        }
    });

    btnBuild.addEventListener('click', () => {
        const builderTab = document.getElementById('tab-builder');
        if (builderTab) {
            builderTab.click();
        }
    });
}
