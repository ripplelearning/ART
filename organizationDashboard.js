// organizationDashboard.js
import { announce, getOrganizationMetricsConfig, updateOrganizationMetricsConfig } from './state.js';
import {
    DATE_RANGE_OPTIONS,
    METRIC_AVAILABILITY,
    buildOrganizationIndex,
    calculateOrganizationMetrics,
    compareOrganizations,
    getOrganizationScopeOptions,
    getOrganizationSummaries,
    getOrganizationMetricSnapshots,
    recordOrganizationMetricSnapshot,
    resolveDateRange
} from './organizationMetricsFramework.js';

// `requires` names an Application Settings toggle; a tab is hidden when its section is turned off.
const ORGANIZATION_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'findings', label: 'Findings' },
    { id: 'categories', label: 'Categories' },
    { id: 'issue-types', label: 'Issue Types' },
    { id: 'standards', label: 'Standards' },
    { id: 'coverage', label: 'Testing Coverage' },
    { id: 'targets', label: 'Pages and Components' },
    { id: 'projects', label: 'Projects' },
    { id: 'workspaces', label: 'Workspaces' },
    { id: 'products', label: 'Products', requires: 'showProductAnalytics' },
    { id: 'testers', label: 'Testers', requires: 'showTesterAnalytics' },
    { id: 'trends', label: 'Trends' },
    { id: 'recurrence', label: 'Recurrence', requires: 'showRecurrenceAnalytics' },
    { id: 'remediation', label: 'Remediation' },
    { id: 'health', label: 'Accessibility Health', requires: 'showAccessibilityHealth' },
    { id: 'benchmarking', label: 'Comparison', requires: 'showBenchmarking' },
    { id: 'data-quality', label: 'Data Quality' }
];

function getVisibleTabs(config = getOrganizationMetricsConfig()) {
    return ORGANIZATION_TABS.filter((tab) => !tab.requires || config[tab.requires] !== false);
}

let dialogState = null;

function normalizeText(value) {
    return String(value ?? '').trim();
}

function getOrganizationSavedViews() {
    try {
        const stored = JSON.parse(localStorage.getItem('art-organization-statistics-views-v1') || '[]');
        return Array.isArray(stored)
            ? stored.filter((view) => view && typeof view === 'object' && normalizeText(view.name) && view.config && typeof view.config === 'object')
                .sort((left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name)))
            : [];
    } catch {
        return [];
    }
}

function saveOrganizationView(name, config) {
    const views = getOrganizationSavedViews();
    if (views.some((view) => normalizeText(view.name).toLowerCase() === name.toLowerCase())) {
        return { ok: false, message: `Saved view ${name} already exists.` };
    }
    const view = {
        id: `organization-view-${Date.now()}`,
        name,
        config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('art-organization-statistics-views-v1', JSON.stringify([...views, view]));
    return { ok: true, view };
}

function buildOrganizationViewConfig(dialog) {
    const config = getOrganizationMetricsConfig();
    return {
        organization: readFilterValue(dialog, '#organization-select'),
        product: readFilterValue(dialog, '#organization-product-filter'),
        project: readFilterValue(dialog, '#organization-project-filter'),
        workspaceId: readFilterValue(dialog, '#organization-workspace-filter'),
        dateRange: readFilterValue(dialog, '#organization-date-filter') || config.defaultDateRange,
        activeTab: config.activeTab,
        showProductAnalytics: config.showProductAnalytics,
        showTesterAnalytics: config.showTesterAnalytics,
        showRecurrenceAnalytics: config.showRecurrenceAnalytics,
        showAccessibilityHealth: config.showAccessibilityHealth,
        showBenchmarking: config.showBenchmarking
    };
}

function buildOrganizationMetricsScope(dialog) {
    const config = buildOrganizationViewConfig(dialog);
    return {
        organization: config.organization,
        product: config.product,
        project: config.project,
        workspaceId: config.workspaceId,
        ...resolveDateRange(config.dateRange)
    };
}

function buildOrganizationExportPayload(dialog) {
    const config = buildOrganizationViewConfig(dialog);
    const index = buildOrganizationIndex();
    const result = calculateOrganizationMetrics({
        organization: config.organization,
        product: config.product,
        project: config.project,
        workspaceId: config.workspaceId,
        ...resolveDateRange(config.dateRange)
    }, { index });

    return {
        artOrganizationStatisticsVersion: '1.0',
        exportedAt: new Date().toISOString(),
        scope: config,
        reportCount: result.reportCount,
        metrics: result.metrics,
        dataQuality: result.dataQuality,
        note: 'Statistics describe recorded report data. They are not a compliance score or certification.'
    };
}

function downloadOrganizationExport(dialog) {
    const payload = buildOrganizationExportPayload(dialog);
    const organization = normalizeText(payload.scope.organization).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'organization';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `art-organization-statistics-${organization}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    announce('Organization Statistics exported.');
    return payload;
}

function downloadOrganizationCsv(dialog) {
    const payload = buildOrganizationExportPayload(dialog);
    const rows = [['Metric', 'Availability', 'Value', 'Reason']];
    Object.entries(payload.metrics || {}).forEach(([id, metric]) => {
        const value = metric?.value && typeof metric.value === 'object'
            ? JSON.stringify(metric.value)
            : metric?.value ?? '';
        rows.push([id, metric?.availability || '', value, metric?.reason || '']);
    });
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'art-organization-statistics.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    announce('Organization Statistics exported as CSV.');
    return csv;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMetricValue(metric) {
    if (!metric || metric.availability === METRIC_AVAILABILITY.UNAVAILABLE) {
        return { text: 'Not available', note: metric?.reason || '' };
    }
    if (metric.availability === METRIC_AVAILABILITY.NOT_APPLICABLE) {
        return { text: 'Not applicable', note: metric.reason || '' };
    }
    return { text: String(metric.value), note: '' };
}

function renderSummaryTable(rows) {
    if (rows.length === 0) return '<p>No metrics available for this scope.</p>';
    return `
        <table class="organization-metrics-table">
            <caption class="sr-only">Organization metrics</caption>
            <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Notes</th></tr></thead>
            <tbody>
                ${rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.note)}</td></tr>`).join('')}
            </tbody>
        </table>
    `;
}

function renderDistribution(metric, heading, countLabel = 'Findings') {
    const rendered = renderMetricValue(metric);
    if (!Array.isArray(metric?.value)) {
        return `<h4>${escapeHtml(heading)}</h4><p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>`;
    }

    return `
        <h4>${escapeHtml(heading)}</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">${escapeHtml(heading)}</caption>
            <thead><tr><th scope="col">Value</th><th scope="col">${escapeHtml(countLabel)}</th><th scope="col">Percentage</th></tr></thead>
            <tbody>
                ${metric.value.map((entry) => `<tr><th scope="row">${escapeHtml(entry.label)}</th><td>${entry.count}</td><td>${entry.percentage}%</td></tr>`).join('')}
            </tbody>
        </table>
    `;
}

function renderKeyValueSummary(metric, heading, rows, note = '') {
    const rendered = renderMetricValue(metric);
    const value = metric?.value;
    if (!value || typeof value !== 'object') {
        return `<h4>${escapeHtml(heading)}</h4><p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>`;
    }

    const summaryRows = rows
        .filter((row) => value[row.key] !== undefined)
        .map((row) => ({
            label: row.label,
            value: value[row.key] === null ? 'Not available' : `${value[row.key]}${row.suffix || ''}`,
            note: ''
        }));

    return `<h4>${escapeHtml(heading)}</h4>${renderSummaryTable(summaryRows)}${note ? `<p>${escapeHtml(note)}</p>` : ''}`;
}

function renderTrend(metric, snapshots = []) {
    const rendered = renderMetricValue(metric);
    const periods = metric?.value?.periods;
    if (!Array.isArray(periods)) {
        return `<h4>Reporting Activity Over Time</h4><p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>${renderSnapshotHistory(snapshots)}`;
    }

    const undated = Number(metric.value.reportsWithoutDate || 0);
    return `
        <h4>Reporting Activity Over Time</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">Reports and findings by month</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Reports</th><th scope="col">Findings</th></tr></thead>
            <tbody>
                ${periods.map((entry) => `<tr><th scope="row">${escapeHtml(entry.period)}</th><td>${entry.reportCount}</td><td>${entry.findingCount}</td></tr>`).join('')}
            </tbody>
        </table>
        ${undated > 0 ? `<p>${undated} report${undated === 1 ? '' : 's'} have no usable date and are not shown in the trend.</p>` : ''}
        ${renderSnapshotHistory(snapshots)}
    `;
}

function renderSnapshotHistory(snapshots) {
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
        return '<h4>Recorded Metric Snapshots</h4><p>No historical snapshots have been recorded for this scope.</p>';
    }
    return `
        <h4>Recorded Metric Snapshots</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">Historical organization metric snapshots</caption>
            <thead><tr><th scope="col">Recorded</th><th scope="col">Reports</th><th scope="col">Findings</th><th scope="col">Resolved</th></tr></thead>
            <tbody>
                ${snapshots.map((snapshot) => {
                    const resolved = snapshot.remediationProgress?.value?.resolvedPercentage;
                    return `<tr><th scope="row">${escapeHtml(new Date(snapshot.recordedAt).toLocaleString())}</th><td>${snapshot.reportCount}</td><td>${snapshot.totalFindings?.value ?? 'Not available'}</td><td>${resolved === undefined || resolved === null ? 'Not available' : `${resolved}%`}</td></tr>`;
                }).join('')}
            </tbody>
        </table>
        <p>Snapshots are explicit records of this scope at the time they were captured; they do not rewrite report history.</p>
    `;
}

function renderRecurrence(metric) {
    const rendered = renderMetricValue(metric);
    const groups = metric?.value;
    if (!Array.isArray(groups)) {
        return `<h4>Recurring Findings</h4><p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>`;
    }
    if (groups.length === 0) {
        return '<h4>Recurring Findings</h4><p>No finding appears in more than one report in this scope.</p>';
    }

    return `
        <h4>Recurring Findings</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">Findings appearing in more than one report</caption>
            <thead><tr><th scope="col">Finding</th><th scope="col">Page or component</th><th scope="col">Reports</th><th scope="col">Occurrences</th></tr></thead>
            <tbody>
                ${groups.map((group) => `<tr><th scope="row">${escapeHtml(group.descriptor)}</th><td>${escapeHtml(group.target || 'Not recorded')}</td><td>${group.reportCount}</td><td>${group.occurrences}</td></tr>`).join('')}
            </tbody>
        </table>
        <p>Recurrence is matched on the text recorded in each report. Findings worded differently are counted separately.</p>
    `;
}

function renderComparison(rows) {
    if (!Array.isArray(rows) || rows.length < 2) {
        return '<h4>Organization Comparison</h4><p>Comparison needs at least two organizations with reports.</p>';
    }

    return `
        <h4>Organization Comparison</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">Comparison of organizations</caption>
            <thead><tr><th scope="col">Organization</th><th scope="col">Reports</th><th scope="col">Findings</th><th scope="col">Average findings per report</th><th scope="col">Percentage resolved</th></tr></thead>
            <tbody>
                ${rows.map((row) => `<tr><th scope="row">${escapeHtml(row.displayName)}</th><td>${row.reportCount}</td><td>${row.findingCount}</td><td>${row.averageFindingsPerReport ?? 'Not available'}</td><td>${row.resolvedPercentage === null ? 'Not available' : `${row.resolvedPercentage}%`}</td></tr>`).join('')}
            </tbody>
        </table>
        <p>Organizations differ in size, scope, and testing practice. These figures describe recorded activity and are not a ranking.</p>
    `;
}

function buildTabPanelContent(tabId, result) {
    const metrics = result.metrics || {};

    if (tabId === 'overview') {
        const rows = ['totalReports', 'totalFindings', 'uniqueProducts', 'uniqueProjects', 'uniqueWorkspaces', 'uniqueTesters', 'uniqueStandards']
            .map((id) => {
                const metric = metrics[id];
                if (!metric) return null;
                const rendered = renderMetricValue(metric);
                return { label: metric.definition?.name || id, value: rendered.text, note: rendered.note };
            })
            .filter(Boolean);
        return renderSummaryTable(rows);
    }

    if (tabId === 'findings') {
        return [
            renderDistribution(metrics.findingsBySeverity, 'Findings by Severity'),
            renderDistribution(metrics.findingsByStatus, 'Findings by Status'),
            renderDistribution(metrics.findingsByCriterion, 'Findings by Success Criterion')
        ].join('');
    }

    if (tabId === 'categories') {
        return renderDistribution(metrics.findingsByCategory, 'Findings by Category');
    }

    if (tabId === 'issue-types') {
        return renderDistribution(metrics.findingsByIssueType, 'Findings by Issue Type');
    }

    if (tabId === 'standards') {
        return renderDistribution(metrics.reportsByStandard, 'Reports by Accessibility Standard', 'Reports')
            + renderDistribution(metrics.reportsByType, 'Reports by Report Type', 'Reports');
    }

    if (tabId === 'coverage') {
        return renderKeyValueSummary(metrics.testingCoverage, 'Testing Coverage', [
            { key: 'reportsWithFindings', label: 'Reports with recorded findings' },
            { key: 'reportsWithoutFindings', label: 'Reports with no recorded findings' },
            { key: 'distinctTargets', label: 'Distinct pages, screens, or components' },
            { key: 'productsCovered', label: 'Products covered' },
            { key: 'projectsCovered', label: 'Projects covered' }
        ]);
    }

    if (tabId === 'targets') {
        return renderDistribution(metrics.findingsByTarget, 'Findings by Page, Screen, or Component');
    }

    if (tabId === 'projects') {
        return renderDistribution(metrics.reportsByProject, 'Reports by Project', 'Reports');
    }

    if (tabId === 'workspaces') {
        return renderDistribution(metrics.reportsByWorkspace, 'Reports by Project Workspace', 'Reports');
    }

    if (tabId === 'products') {
        return renderDistribution(metrics.findingsByProduct, 'Findings by Product')
            + renderDistribution(metrics.reportsByProduct, 'Reports by Product', 'Reports');
    }

    if (tabId === 'testers') {
        const metric = metrics.uniqueTesters;
        const rendered = renderMetricValue(metric);
        return `
            <h4>Unique Testers</h4>
            <p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>
            <p>Tester statistics describe testing activity and coverage. They are not a measure of individual performance.</p>
            ${renderDistribution(metrics.reportsByTester, 'Reports by Tester', 'Reports')}
        `;
    }

    if (tabId === 'trends') {
        return renderTrend(metrics.reportTrend, result.historicalSnapshots);
    }

    if (tabId === 'recurrence') {
        return renderRecurrence(metrics.findingRecurrence);
    }

    if (tabId === 'remediation') {
        return renderKeyValueSummary(metrics.remediationProgress, 'Remediation Progress', [
            { key: 'resolved', label: 'Findings recorded as resolved' },
            { key: 'open', label: 'Findings recorded as open' },
            { key: 'other', label: 'Findings with another recorded status' },
            { key: 'unclassified', label: 'Findings with no recorded status' },
            { key: 'resolvedPercentage', label: 'Percentage resolved', suffix: '%' }
        ], 'Status is read from each report\'s recorded status values. ART does not infer remediation that was not recorded.');
    }

    if (tabId === 'health') {
        return renderKeyValueSummary(metrics.accessibilityHealth, 'Accessibility Health Indicators', [
            { key: 'averageFindingsPerReport', label: 'Average findings per report' },
            { key: 'reportsWithFindings', label: 'Reports with findings' },
            { key: 'distinctCriteria', label: 'Distinct Success Criteria involved' },
            { key: 'resolvedPercentage', label: 'Percentage resolved', suffix: '%' }
        ], 'These indicators describe recorded testing activity. They are not a compliance score and do not certify conformance.');
    }

    if (tabId === 'benchmarking') {
        return renderComparison(result.comparison);
    }

    if (tabId === 'data-quality') {
        const completeness = metrics.metadataCompleteness;
        const details = metrics.metadataQualityDetails;
        const quality = result.dataQuality || {};
        const variantNote = Array.isArray(quality.organizationNameVariants) && quality.organizationNameVariants.length > 1
            ? `<p>This organization appears under more than one spelling: ${quality.organizationNameVariants.map((name) => escapeHtml(name)).join(', ')}. ART keeps these separate unless you make them consistent.</p>`
            : '';
        const unassigned = Number(quality.reportsWithoutOrganization || 0);
        const unassignedNote = unassigned > 0
            ? `<p>${unassigned} report${unassigned === 1 ? '' : 's'} have no Organization/Client value and are excluded from organization statistics.</p>`
            : '<p>All available reports contain an Organization/Client value.</p>';

        const detailTable = renderMetadataQualityDetails(details);
        if (!Array.isArray(completeness?.value) && completeness?.value && typeof completeness.value === 'object') {
            return `
                ${renderSummaryTable([
                    { label: 'Reports with Organization/Client', value: `${completeness.value.organization}%`, note: '' },
                    { label: 'Reports with Product', value: `${completeness.value.product}%`, note: '' },
                    { label: 'Reports with Tester', value: `${completeness.value.tester}%`, note: '' },
                    { label: 'Reports with a usable date', value: `${completeness.value.date}%`, note: '' }
                ])}
                ${unassignedNote}
                ${variantNote}
                ${detailTable}
            `;
        }
        return `${unassignedNote}${variantNote}${detailTable}`;
    }

    return '<p>No data available.</p>';
}

function renderMetadataQualityDetails(metric) {
    if (metric?.availability === METRIC_AVAILABILITY.UNAVAILABLE) {
        return `<p>${escapeHtml(metric.reason || 'Metadata quality details are not available.')}</p>`;
    }
    if (!Array.isArray(metric?.value) || metric.value.length === 0) {
        return '<h4>Reports Needing Metadata Attention</h4><p>All reports in this scope contain the tracked metadata fields.</p>';
    }
    return `
        <h4>Reports Needing Metadata Attention</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">Reports with missing metadata</caption>
            <thead><tr><th scope="col">Report</th><th scope="col">Missing fields</th></tr></thead>
            <tbody>
                ${metric.value.map((record) => `<tr><th scope="row">${escapeHtml(record.reportName)}</th><td>${escapeHtml(record.missing.join(', '))}</td></tr>`).join('')}
            </tbody>
        </table>
    `;
}

function renderDialog() {
    const state = dialogState;
    if (!state) return;

    const config = getOrganizationMetricsConfig();
    const summaries = getOrganizationSummaries();
    const selectedKey = normalizeText(config.selectedOrganization) || summaries[0]?.key || '';
    const selected = summaries.find((entry) => entry.key === selectedKey) || summaries[0] || null;

    const selector = state.dialog.querySelector('#organization-select');
    if (selector) {
        const markup = summaries.length > 0
            ? summaries.map((entry) => `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.displayName)} (${entry.reportCount})</option>`).join('')
            : '<option value="">No organizations available</option>';
        if (selector.dataset.signature !== markup) {
            selector.innerHTML = markup;
            selector.dataset.signature = markup;
        }
        if (selected) selector.value = selected.key;
    }

    const index = buildOrganizationIndex();
    const scopeOptions = selected ? getOrganizationScopeOptions(selected.displayName, { index }) : { products: [], projects: [], workspaces: [] };
    syncScopeFilters(state.dialog, scopeOptions, config);

    const scope = {
        organization: selected?.displayName || '',
        product: readFilterValue(state.dialog, '#organization-product-filter'),
        project: readFilterValue(state.dialog, '#organization-project-filter'),
        workspaceId: readFilterValue(state.dialog, '#organization-workspace-filter'),
        ...resolveDateRange(readFilterValue(state.dialog, '#organization-date-filter') || config.defaultDateRange)
    };

    const result = selected
        ? calculateOrganizationMetrics(scope, { index })
        : { metrics: {}, dataQuality: { reportsWithoutOrganization: index.unassignedReports.length }, reportCount: 0 };
    result.comparison = compareOrganizations({ index });
    result.historicalSnapshots = selected ? getOrganizationMetricSnapshots(scope) : [];

    const visibleTabs = getVisibleTabs(config);
    const activeTab = visibleTabs.some((tab) => tab.id === config.activeTab) ? config.activeTab : (visibleTabs[0]?.id || 'overview');

    const tablist = state.dialog.querySelector('#organization-tablist');
    if (tablist) {
        tablist.innerHTML = visibleTabs.map((tab) => `
            <button type="button" role="tab" id="organization-tab-${tab.id}"
                aria-controls="organization-panel-${tab.id}"
                aria-selected="${tab.id === activeTab ? 'true' : 'false'}"
                tabindex="${tab.id === activeTab ? '0' : '-1'}">${escapeHtml(tab.label)}</button>
        `).join('');
    }

    const panels = state.dialog.querySelector('#organization-panels');
    if (panels) {
        panels.innerHTML = visibleTabs.map((tab) => `
            <div role="tabpanel" id="organization-panel-${tab.id}" aria-labelledby="organization-tab-${tab.id}" tabindex="0" ${tab.id === activeTab ? '' : 'hidden'}>
                ${tab.id === activeTab ? buildTabPanelContent(tab.id, result) : ''}
            </div>
        `).join('');
    }

    const scopeStatus = state.dialog.querySelector('#organization-scope-status');
    if (scopeStatus) {
        scopeStatus.textContent = selected
            ? `Organization: ${selected.displayName}. ${result.reportCount} report${result.reportCount === 1 ? '' : 's'} included after filters. Statistics reflect reports available to you.`
            : 'No reports contain an Organization/Client value, so organization statistics cannot be calculated yet.';
    }

    const savedViewSelect = state.dialog.querySelector('#organization-saved-view-select');
    if (savedViewSelect instanceof HTMLSelectElement) {
        const savedViews = getOrganizationSavedViews();
        const previous = savedViewSelect.value;
        savedViewSelect.innerHTML = '<option value="">Choose a saved view</option>'
            + savedViews.map((view) => `<option value="${escapeHtml(view.id)}">${escapeHtml(view.name)}</option>`).join('');
        savedViewSelect.value = savedViews.some((view) => view.id === previous) ? previous : '';
    }
}

function readFilterValue(dialog, selector) {
    const element = dialog.querySelector(selector);
    return element instanceof HTMLSelectElement ? normalizeText(element.value) : '';
}

function setFilterValue(dialog, selector, value) {
    const element = dialog.querySelector(selector);
    if (element instanceof HTMLSelectElement && [...element.options].some((option) => option.value === normalizeText(value))) {
        element.value = normalizeText(value);
    }
}

function syncScopeFilters(dialog, scopeOptions, config) {
    const setOptions = (selector, options, allLabel) => {
        const element = dialog.querySelector(selector);
        if (!(element instanceof HTMLSelectElement)) return;
        const markup = [`<option value="">${escapeHtml(allLabel)}</option>`]
            .concat(options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`))
            .join('');
        if (element.dataset.signature === markup) return;
        const previous = element.value;
        element.innerHTML = markup;
        element.dataset.signature = markup;
        // Drop a stale selection rather than silently filtering on a value that no longer exists.
        element.value = options.some((option) => option.value === previous) ? previous : '';
    };

    setOptions('#organization-product-filter', scopeOptions.products.map((value) => ({ value, label: value })), 'All products');
    setOptions('#organization-project-filter', scopeOptions.projects.map((value) => ({ value, label: value })), 'All projects');
    setOptions('#organization-workspace-filter', scopeOptions.workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })), 'All workspaces');

    const dateFilter = dialog.querySelector('#organization-date-filter');
    if (dateFilter instanceof HTMLSelectElement && !dateFilter.dataset.signature) {
        dateFilter.innerHTML = DATE_RANGE_OPTIONS.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('');
        dateFilter.dataset.signature = 'ready';
        dateFilter.value = config.defaultDateRange || 'all';
    }
}

function activateTab(tabId) {
    updateOrganizationMetricsConfig({ activeTab: tabId }, { persist: true });
    renderDialog();
    const tab = document.getElementById(`organization-tab-${tabId}`);
    tab?.focus();
    const label = ORGANIZATION_TABS.find((entry) => entry.id === tabId)?.label || tabId;
    announce(`${label} tab selected.`);
}

function handleTablistKeydown(event) {
    const tabs = getVisibleTabs().map((tab) => tab.id);
    const currentId = normalizeText(document.activeElement?.id).replace('organization-tab-', '');
    const currentIndex = tabs.indexOf(currentId);
    if (currentIndex < 0) return;

    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    activateTab(tabs[nextIndex]);
}

function ensureDialog() {
    if (dialogState?.dialog instanceof HTMLElement) return dialogState;

    let dialog = document.getElementById('organization-statistics-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'organization-statistics-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'organization-statistics-heading');
        dialog.hidden = true;
        dialog.className = 'command-palette-dialog';
        dialog.innerHTML = `
            <div class="command-palette-header">
                <button id="btn-organization-statistics-close" type="button">Close</button>
                <h2 id="organization-statistics-heading">Organization Statistics</h2>
            </div>
            <p id="organization-statistics-description">Statistics are grouped using the Organization/Client value in each report's metadata.</p>
            <label for="organization-select">Organization</label>
            <select id="organization-select"></select>
            <div class="organization-filters">
                <label for="organization-product-filter">Product</label>
                <select id="organization-product-filter"></select>
                <label for="organization-project-filter">Project</label>
                <select id="organization-project-filter"></select>
                <label for="organization-workspace-filter">Project Workspace</label>
                <select id="organization-workspace-filter"></select>
                <label for="organization-date-filter">Date range</label>
                <select id="organization-date-filter"></select>
            </div>
            <p id="organization-scope-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div class="organization-view-actions" role="group" aria-label="Organization Statistics view actions">
                <label for="organization-view-name">View name</label>
                <input id="organization-view-name" type="text" value="Organization Statistics View" maxlength="100">
                <button id="btn-organization-save-view" type="button">Save View</button>
                <label for="organization-saved-view-select">Saved view</label>
                <select id="organization-saved-view-select"><option value="">Choose a saved view</option></select>
                <button id="btn-organization-load-view" type="button">Load View</button>
                <button id="btn-organization-record-snapshot" type="button">Record Snapshot</button>
                <button id="btn-organization-export" type="button">Export JSON</button>
                <button id="btn-organization-export-csv" type="button">Export CSV</button>
            </div>
            <div id="organization-tablist" role="tablist" aria-label="Organization statistics sections"></div>
            <div id="organization-panels"></div>
        `;
        document.body.appendChild(dialog);
    }

    dialogState = { dialog, lastTrigger: null };

    if (!dialog.dataset.organizationBound) {
        dialog.dataset.organizationBound = 'true';

        dialog.querySelector('#btn-organization-statistics-close')?.addEventListener('click', () => closeOrganizationStatistics(true));
        dialog.querySelector('#btn-organization-export')?.addEventListener('click', () => downloadOrganizationExport(dialog));
        dialog.querySelector('#btn-organization-export-csv')?.addEventListener('click', () => downloadOrganizationCsv(dialog));
        dialog.querySelector('#btn-organization-record-snapshot')?.addEventListener('click', () => {
            const snapshot = recordOrganizationMetricSnapshot(buildOrganizationMetricsScope(dialog));
            renderDialog();
            announce(`Metric snapshot recorded at ${new Date(snapshot.recordedAt).toLocaleString()}.`);
        });

        dialog.querySelector('#btn-organization-save-view')?.addEventListener('click', () => {
            const nameInput = dialog.querySelector('#organization-view-name');
            const name = normalizeText(nameInput?.value) || 'Organization Statistics View';
            const result = saveOrganizationView(name, buildOrganizationViewConfig(dialog));
            if (!result.ok) {
                announce(result.message || 'The Organization Statistics view could not be saved.');
                return;
            }
            renderDialog();
            announce(`Saved view ${name}.`);
        });

        dialog.querySelector('#btn-organization-load-view')?.addEventListener('click', () => {
            const select = dialog.querySelector('#organization-saved-view-select');
            const savedView = getOrganizationSavedViews().find((view) => view.id === select?.value);
            if (!savedView?.config) {
                announce('Choose a saved Organization Statistics view first.');
                return;
            }
            const view = savedView.config;
            updateOrganizationMetricsConfig({
                selectedOrganization: view.organization || '',
                activeTab: view.activeTab || 'overview',
                showProductAnalytics: view.showProductAnalytics !== false,
                showTesterAnalytics: view.showTesterAnalytics !== false,
                showRecurrenceAnalytics: view.showRecurrenceAnalytics !== false,
                showAccessibilityHealth: view.showAccessibilityHealth !== false,
                showBenchmarking: view.showBenchmarking !== false,
                defaultDateRange: view.dateRange || 'all'
            }, { persist: true });
            renderDialog();
            setFilterValue(dialog, '#organization-product-filter', view.product);
            setFilterValue(dialog, '#organization-project-filter', view.project);
            setFilterValue(dialog, '#organization-workspace-filter', view.workspaceId);
            setFilterValue(dialog, '#organization-date-filter', view.dateRange || 'all');
            renderDialog();
            announce(`Loaded view ${savedView.name}.`);
        });

        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeOrganizationStatistics(true);
                return;
            }
            if (event.target instanceof HTMLElement && event.target.getAttribute('role') === 'tab') {
                handleTablistKeydown(event);
            }
        });

        dialog.addEventListener('click', (event) => {
            const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
            if (!tab) return;
            activateTab(normalizeText(tab.id).replace('organization-tab-', ''));
        });

        dialog.addEventListener('change', (event) => {
            if (!(event.target instanceof HTMLSelectElement)) return;

            if (event.target.id === 'organization-select') {
                updateOrganizationMetricsConfig({ selectedOrganization: event.target.value }, { persist: true });
                renderDialog();
                announce(`Organization changed to ${event.target.selectedOptions[0]?.textContent || 'selection'}.`);
                return;
            }

            if (!event.target.id.startsWith('organization-') || !event.target.id.endsWith('-filter')) return;
            renderDialog();
            const status = dialog.querySelector('#organization-scope-status');
            announce(status?.textContent || 'Filters updated.');
        });
    }

    return dialogState;
}

export function openOrganizationStatistics(trigger = null, options = {}) {
    const state = ensureDialog();
    if (!state) return false;

    if (trigger) state.lastTrigger = trigger;
    if (options.tab) updateOrganizationMetricsConfig({ activeTab: options.tab }, { persist: false });

    state.dialog.hidden = false;
    renderDialog();

    const focusTarget = (attempt = 0) => {
        if (state.dialog.hidden) return;
        const selector = document.getElementById('organization-select');
        if (selector && document.activeElement !== selector) selector.focus();
        if (attempt >= 10) return;
        window.setTimeout(() => focusTarget(attempt + 1), 25);
    };
    focusTarget();

    announce('Organization Statistics opened.');
    return true;
}

export function exportOrganizationStatisticsFromCommand(context = {}) {
    const state = ensureDialog();
    if (!state) return false;
    if (context.triggerElement) state.lastTrigger = context.triggerElement;
    state.dialog.hidden = false;
    renderDialog();
    downloadOrganizationExport(state.dialog);
    return true;
}

export function exportOrganizationStatisticsCsvFromCommand(context = {}) {
    const state = ensureDialog();
    if (!state) return false;
    if (context.triggerElement) state.lastTrigger = context.triggerElement;
    state.dialog.hidden = false;
    renderDialog();
    downloadOrganizationCsv(state.dialog);
    return true;
}

export function recordOrganizationStatisticsSnapshotFromCommand(context = {}) {
    const state = ensureDialog();
    if (!state) return false;
    if (context.triggerElement) state.lastTrigger = context.triggerElement;
    state.dialog.hidden = false;
    renderDialog();
    const snapshot = recordOrganizationMetricSnapshot(buildOrganizationMetricsScope(state.dialog));
    renderDialog();
    announce(`Metric snapshot recorded at ${new Date(snapshot.recordedAt).toLocaleString()}.`);
    return true;
}

export function saveOrganizationStatisticsViewFromCommand() {
    const state = ensureDialog();
    if (!state) return false;
    const name = `Organization Statistics ${new Date().toISOString().slice(0, 10)}`;
    const result = saveOrganizationView(name, buildOrganizationViewConfig(state.dialog));
    announce(result.ok ? `Saved view ${name}.` : (result.message || 'The Organization Statistics view could not be saved.'));
    renderDialog();
    return result.ok;
}

export function openOrganizationSavedViewsFromCommand(trigger = null) {
    const opened = openOrganizationStatistics(trigger);
    if (!opened) return false;
    const state = ensureDialog();
    state.dialog.querySelector('#organization-saved-view-select')?.focus();
    announce('Saved Organization Statistics views are available.');
    return true;
}

export function closeOrganizationStatistics(restoreFocus = true) {
    const state = dialogState;
    if (!state) return false;

    state.dialog.hidden = true;
    if (restoreFocus && state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
        state.lastTrigger.focus();
    }
    return true;
}

export function getOrganizationTabs() {
    return getVisibleTabs().map((tab) => ({ ...tab }));
}
