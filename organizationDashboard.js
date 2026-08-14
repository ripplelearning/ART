// organizationDashboard.js
import { announce, getOrganizationMetricsConfig, updateOrganizationMetricsConfig } from './state.js';
import {
    METRIC_AVAILABILITY,
    buildOrganizationIndex,
    calculateOrganizationMetrics,
    getOrganizationSummaries
} from './organizationMetricsFramework.js';

const ORGANIZATION_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'findings', label: 'Findings' },
    { id: 'categories', label: 'Categories' },
    { id: 'products', label: 'Products' },
    { id: 'testers', label: 'Testers' },
    { id: 'data-quality', label: 'Data Quality' }
];

let dialogState = null;

function normalizeText(value) {
    return String(value ?? '').trim();
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

function renderDistribution(metric, heading) {
    const rendered = renderMetricValue(metric);
    if (!Array.isArray(metric?.value)) {
        return `<h4>${escapeHtml(heading)}</h4><p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>`;
    }

    return `
        <h4>${escapeHtml(heading)}</h4>
        <table class="organization-metrics-table">
            <caption class="sr-only">${escapeHtml(heading)}</caption>
            <thead><tr><th scope="col">Value</th><th scope="col">Findings</th><th scope="col">Percentage</th></tr></thead>
            <tbody>
                ${metric.value.map((entry) => `<tr><th scope="row">${escapeHtml(entry.label)}</th><td>${entry.count}</td><td>${entry.percentage}%</td></tr>`).join('')}
            </tbody>
        </table>
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

    if (tabId === 'products') {
        return renderDistribution(metrics.findingsByProduct, 'Findings by Product');
    }

    if (tabId === 'testers') {
        const metric = metrics.uniqueTesters;
        const rendered = renderMetricValue(metric);
        return `
            <h4>Unique Testers</h4>
            <p>${escapeHtml(rendered.text)}${rendered.note ? ` ${escapeHtml(rendered.note)}` : ''}</p>
            <p>Tester statistics describe testing activity and coverage. They are not a measure of individual performance.</p>
        `;
    }

    if (tabId === 'data-quality') {
        const completeness = metrics.metadataCompleteness;
        const quality = result.dataQuality || {};
        const variantNote = Array.isArray(quality.organizationNameVariants) && quality.organizationNameVariants.length > 1
            ? `<p>This organization appears under more than one spelling: ${quality.organizationNameVariants.map((name) => escapeHtml(name)).join(', ')}. ART keeps these separate unless you make them consistent.</p>`
            : '';
        const unassigned = Number(quality.reportsWithoutOrganization || 0);
        const unassignedNote = unassigned > 0
            ? `<p>${unassigned} report${unassigned === 1 ? '' : 's'} have no Organization/Client value and are excluded from organization statistics.</p>`
            : '<p>All available reports contain an Organization/Client value.</p>';

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
            `;
        }
        return `${unassignedNote}${variantNote}`;
    }

    return '<p>No data available.</p>';
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
    const result = selected
        ? calculateOrganizationMetrics({ organization: selected.displayName }, { index })
        : { metrics: {}, dataQuality: { reportsWithoutOrganization: index.unassignedReports.length }, reportCount: 0 };

    const activeTab = ORGANIZATION_TABS.some((tab) => tab.id === config.activeTab) ? config.activeTab : 'overview';

    const tablist = state.dialog.querySelector('#organization-tablist');
    if (tablist) {
        tablist.innerHTML = ORGANIZATION_TABS.map((tab) => `
            <button type="button" role="tab" id="organization-tab-${tab.id}"
                aria-controls="organization-panel-${tab.id}"
                aria-selected="${tab.id === activeTab ? 'true' : 'false'}"
                tabindex="${tab.id === activeTab ? '0' : '-1'}">${escapeHtml(tab.label)}</button>
        `).join('');
    }

    const panels = state.dialog.querySelector('#organization-panels');
    if (panels) {
        panels.innerHTML = ORGANIZATION_TABS.map((tab) => `
            <div role="tabpanel" id="organization-panel-${tab.id}" aria-labelledby="organization-tab-${tab.id}" tabindex="0" ${tab.id === activeTab ? '' : 'hidden'}>
                ${tab.id === activeTab ? buildTabPanelContent(tab.id, result) : ''}
            </div>
        `).join('');
    }

    const scopeStatus = state.dialog.querySelector('#organization-scope-status');
    if (scopeStatus) {
        scopeStatus.textContent = selected
            ? `Organization: ${selected.displayName}. ${result.reportCount} report${result.reportCount === 1 ? '' : 's'} included. Statistics reflect reports available to you.`
            : 'No reports contain an Organization/Client value, so organization statistics cannot be calculated yet.';
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
    const tabs = ORGANIZATION_TABS.map((tab) => tab.id);
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
            <p id="organization-scope-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div id="organization-tablist" role="tablist" aria-label="Organization statistics sections"></div>
            <div id="organization-panels"></div>
        `;
        document.body.appendChild(dialog);
    }

    dialogState = { dialog, lastTrigger: null };

    if (!dialog.dataset.organizationBound) {
        dialog.dataset.organizationBound = 'true';

        dialog.querySelector('#btn-organization-statistics-close')?.addEventListener('click', () => closeOrganizationStatistics(true));

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
            if (!(event.target instanceof HTMLSelectElement) || event.target.id !== 'organization-select') return;
            updateOrganizationMetricsConfig({ selectedOrganization: event.target.value }, { persist: true });
            renderDialog();
            announce(`Organization changed to ${event.target.selectedOptions[0]?.textContent || 'selection'}.`);
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
    return ORGANIZATION_TABS.map((tab) => ({ ...tab }));
}
