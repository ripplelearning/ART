// organizationMetricsFramework.js
import { getProjectWorkspaces, getRecentReports } from './state.js';

// Availability is first-class: a metric that cannot be calculated is never reported as zero.
export const METRIC_AVAILABILITY = {
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    NOT_APPLICABLE: 'not-applicable'
};

const metricDefinitions = new Map();
const runtimeCache = {
    index: null,
    metrics: new Map(),
    hits: 0,
    misses: 0
};
const HISTORICAL_SNAPSHOT_KEY = 'art-organization-metrics-snapshots-v1';

function normalizeText(value) {
    return String(value ?? '').trim();
}

function getReportsSignature(reports) {
    return (Array.isArray(reports) ? reports : [])
        .map((report) => `${normalizeText(report?.id)}:${Number(report?.updatedAt || 0)}`)
        .sort()
        .join('|');
}

function getScopeSignature(scope) {
    const source = scope && typeof scope === 'object' ? scope : {};
    return JSON.stringify({
        organization: getOrganizationKey(source.organization),
        product: normalizeText(source.product),
        project: normalizeText(source.project),
        workspaceId: normalizeText(source.workspaceId),
        dateFrom: source.dateFrom instanceof Date ? source.dateFrom.toISOString() : normalizeText(source.dateFrom),
        dateTo: source.dateTo instanceof Date ? source.dateTo.toISOString() : normalizeText(source.dateTo)
    });
}

export function clearOrganizationMetricsCache() {
    runtimeCache.index = null;
    runtimeCache.metrics.clear();
}

export function getOrganizationMetricsCacheStats() {
    return { hits: runtimeCache.hits, misses: runtimeCache.misses, metricEntries: runtimeCache.metrics.size };
}

function readHistoricalSnapshots() {
    try {
        const stored = JSON.parse(localStorage.getItem(HISTORICAL_SNAPSHOT_KEY) || '[]');
        return Array.isArray(stored) ? stored.filter((snapshot) => snapshot && typeof snapshot === 'object') : [];
    } catch {
        return [];
    }
}

export function getOrganizationMetricSnapshots(scope = {}) {
    const signature = getScopeSignature(scope);
    return readHistoricalSnapshots()
        .filter((snapshot) => snapshot.scopeSignature === signature)
        .sort((left, right) => String(left.recordedAt).localeCompare(String(right.recordedAt)));
}

export function recordOrganizationMetricSnapshot(scope = {}, options = {}) {
    const index = options.index || buildOrganizationIndex(options);
    const result = calculateOrganizationMetrics(scope, { ...options, index });
    const snapshot = {
        id: `organization-snapshot-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        scopeSignature: getScopeSignature(scope),
        scope: result.scope,
        reportCount: result.reportCount,
        totalFindings: result.metrics.totalFindings || null,
        remediationProgress: result.metrics.remediationProgress || null,
        metadataCompleteness: result.metrics.metadataCompleteness || null
    };
    const snapshots = [...readHistoricalSnapshots(), snapshot].slice(-200);
    localStorage.setItem(HISTORICAL_SNAPSHOT_KEY, JSON.stringify(snapshots));
    return snapshot;
}

export function clearOrganizationMetricSnapshots() {
    localStorage.removeItem(HISTORICAL_SNAPSHOT_KEY);
}

// Organization identity is kept separate from its display name so a future canonical
// organization record can replace the key without redesigning the metrics engine.
export function getOrganizationKey(organizationName) {
    const text = normalizeText(organizationName);
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ');
}

export function createMetricValue(value, availability = METRIC_AVAILABILITY.AVAILABLE, reason = '') {
    return {
        value: availability === METRIC_AVAILABILITY.AVAILABLE ? value : null,
        availability,
        reason: normalizeText(reason)
    };
}

export function registerMetricDefinition(definition) {
    const source = definition && typeof definition === 'object' ? definition : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Metric definitions require an id.');

    const normalized = {
        id,
        name: normalizeText(source.name) || id,
        description: normalizeText(source.description),
        source: normalizeText(source.source),
        requires: Array.isArray(source.requires) ? source.requires.map(normalizeText).filter(Boolean) : [],
        supports: Array.isArray(source.supports) ? source.supports.map(normalizeText).filter(Boolean) : [],
        measure: normalizeText(source.measure) || 'count',
        version: normalizeText(source.version) || 'v1',
        calculate: typeof source.calculate === 'function' ? source.calculate : () => createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No calculation defined.')
    };

    metricDefinitions.set(id, normalized);
    return normalized;
}

export function getMetricDefinitions() {
    return [...metricDefinitions.values()].map((definition) => ({ ...definition }));
}

export function getMetricDefinition(metricId) {
    const definition = metricDefinitions.get(normalizeText(metricId));
    return definition ? { ...definition } : null;
}

function getReportDate(report) {
    const data = report?.data || {};
    const candidate = normalizeText(data.auditDateEnd) || normalizeText(data.auditDateStart);
    if (candidate) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const updated = Number(report?.updatedAt);
    return Number.isFinite(updated) && updated > 0 ? new Date(updated) : null;
}

function splitTesters(value) {
    return normalizeText(value)
        .split(/[,;]|\band\b/gi)
        .map((entry) => normalizeText(entry))
        .filter(Boolean);
}

// Only collapses exact case/whitespace differences. Distinct names stay distinct.
export function getTesterKey(testerName) {
    const text = normalizeText(testerName);
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ');
}

function getWorkspaceForReport(reportId) {
    const workspaces = getProjectWorkspaces();
    return workspaces.find((workspace) => {
        const reports = Array.isArray(workspace.resources?.reports) ? workspace.resources.reports : [];
        return reports.some((entry) => normalizeText(entry?.reportId || entry?.id) === normalizeText(reportId));
    }) || null;
}

function buildFindingRecords(report) {
    const data = report?.data || {};
    const fields = Array.isArray(data.fields) ? data.fields : [];
    const entries = Array.isArray(data.auditEntries) ? data.auditEntries : [];

    const findField = (matcher) => fields.findIndex((field) => matcher(normalizeText(field?.label).toLowerCase()));
    const severityIndex = findField((label) => label.includes('severity'));
    const categoryIndex = findField((label) => label.includes('category'));
    const statusIndex = findField((label) => label.includes('status') || label.includes('result'));
    const criterionIndex = fields.findIndex((field) => String(field?.type || '').includes('wcag'));
    const targetIndex = findField((label) => label.includes('page') || label.includes('screen') || label.includes('component') || label.includes('url'));
    const issueTypeIndex = findField((label) => label === 'type' || label.includes('issue type') || label.includes('defect type'));
    const heuristicIndex = fields.findIndex((field) => String(field?.type || '').includes('heuristic') || normalizeText(field?.label).toLowerCase().includes('heuristic'));

    const readValue = (entry, index) => (index >= 0 ? normalizeText(entry?.fieldValues?.[index]) : '');

    if (entries.length === 0 && Array.isArray(data.editorFieldValues) && data.editorFieldValues.length > 0) {
        const hasContent = data.editorFieldValues.some((value) => normalizeText(value));
        if (hasContent) {
            const readEditorVal = (idx) => (idx >= 0 ? normalizeText(data.editorFieldValues[idx]) : '');
            return [{
                id: `${report.id}:single`,
                reportId: report.id,
                entryIndex: 0,
                severity: readEditorVal(severityIndex),
                category: readEditorVal(categoryIndex),
                status: readEditorVal(statusIndex),
                criterion: readEditorVal(criterionIndex),
                target: readEditorVal(targetIndex),
                issueType: readEditorVal(issueTypeIndex),
                heuristics: readEditorVal(heuristicIndex)
            }];
        }
    }

    return entries
        .map((entry, entryIndex) => {
            const hasContent = Object.values(entry?.fieldValues || {}).some((value) => normalizeText(value));
            if (!hasContent) return null;
            return {
                id: `${report.id}:${entry?.id || entryIndex}`,
                reportId: report.id,
                entryIndex,
                severity: readValue(entry, severityIndex),
                category: readValue(entry, categoryIndex),
                status: readValue(entry, statusIndex),
                criterion: readValue(entry, criterionIndex),
                target: readValue(entry, targetIndex),
                issueType: readValue(entry, issueTypeIndex),
                heuristics: readValue(entry, heuristicIndex)
            };
        })
        .filter(Boolean);
}

/**
 * Builds the derived analytics view. Source reports are never modified.
 * Permission filtering is applied here, before aggregation, so totals cannot
 * leak information about resources the user cannot access.
 */
export function buildOrganizationIndex(options = {}) {
    const authorize = typeof options.authorize === 'function' ? options.authorize : () => true;
    const sourceReports = Array.isArray(options.reports) ? options.reports : getRecentReports();
    const reportsSignature = getReportsSignature(sourceReports);

    if (!options.reports && !options.authorize && runtimeCache.index?.signature === reportsSignature) {
        runtimeCache.hits += 1;
        return runtimeCache.index.value;
    }

    const reports = sourceReports.filter(authorize);

    const organizations = new Map();
    const unassignedReports = [];

    reports.forEach((report) => {
        const data = report?.data || {};
        const organizationName = normalizeText(data.orgClient);
        const organizationKey = getOrganizationKey(organizationName);

        const workspace = getWorkspaceForReport(report.id);
        const record = {
            id: report.id,
            name: normalizeText(report.name),
            organizationName,
            organizationKey,
            product: normalizeText(data.product),
            projectName: normalizeText(data.projectName),
            workspaceId: normalizeText(workspace?.id),
            workspaceName: normalizeText(workspace?.name),
            standard: normalizeText(data.standard),
            reportType: normalizeText(data.reportType),
            testers: splitTesters(data.auditors),
            date: getReportDate(report),
            findings: buildFindingRecords(report)
        };

        if (!organizationKey) {
            unassignedReports.push(record);
            return;
        }

        if (!organizations.has(organizationKey)) {
            organizations.set(organizationKey, {
                key: organizationKey,
                displayName: organizationName,
                displayNameVariants: new Set([organizationName]),
                reports: []
            });
        }

        const organization = organizations.get(organizationKey);
        organization.displayNameVariants.add(organizationName);
        organization.reports.push(record);
    });

    const index = {
        signature: reportsSignature,
        organizations: [...organizations.values()].map((organization) => ({
            ...organization,
            displayNameVariants: [...organization.displayNameVariants]
        })).sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' })),
        unassignedReports,
        totalReports: reports.length
    };

    if (!options.reports && !options.authorize) {
        runtimeCache.index = { signature: reportsSignature, value: index };
    }
    return index;
}

export function getOrganizationSummaries(options = {}) {
    const index = buildOrganizationIndex(options);
    return index.organizations.map((organization) => ({
        key: organization.key,
        displayName: organization.displayName,
        reportCount: organization.reports.length,
        hasNameVariants: organization.displayNameVariants.length > 1
    }));
}

function collectScopeReports(index, scope = {}) {
    const organizationKey = getOrganizationKey(scope.organization);
    const organization = index.organizations.find((entry) => entry.key === organizationKey) || null;
    let reports = organization ? [...organization.reports] : [];

    const product = normalizeText(scope.product);
    if (product) reports = reports.filter((report) => report.product === product);

    const projectName = normalizeText(scope.project);
    if (projectName) reports = reports.filter((report) => report.projectName === projectName);

    const workspaceId = normalizeText(scope.workspaceId);
    if (workspaceId) reports = reports.filter((report) => report.workspaceId === workspaceId);

    if (scope.dateFrom instanceof Date) {
        reports = reports.filter((report) => report.date instanceof Date && report.date >= scope.dateFrom);
    }
    if (scope.dateTo instanceof Date) {
        reports = reports.filter((report) => report.date instanceof Date && report.date <= scope.dateTo);
    }

    return { organization, reports };
}

function countDistinct(values) {
    return new Set(values.filter(Boolean)).size;
}

function buildDistribution(reports, selector) {
    const counts = new Map();
    let total = 0;

    reports.forEach((report) => {
        report.findings.forEach((finding) => {
            const raw = selector(finding);
            const values = (Array.isArray(raw) ? raw : [raw]).map(normalizeText).filter(Boolean);
            values.forEach((rawValue) => {
                counts.set(rawValue, Number(counts.get(rawValue) || 0) + 1);
                total += 1;
            });
        });
    });

    if (total === 0) return null;

    return [...counts.entries()]
        .map(([label, count]) => ({
            label,
            count,
            // Percentages are always relative to the filtered population that produced them.
            percentage: Math.round((count / total) * 1000) / 10
        }))
        .sort((left, right) => right.count - left.count);
}

// Counts reports rather than findings. `selector` may return a string or an array of strings.
function buildReportDistribution(reports, selector) {
    const counts = new Map();
    let total = 0;

    reports.forEach((report) => {
        const raw = selector(report);
        const values = (Array.isArray(raw) ? raw : [raw]).map(normalizeText).filter(Boolean);
        new Set(values).forEach((value) => {
            counts.set(value, Number(counts.get(value) || 0) + 1);
            total += 1;
        });
    });

    if (total === 0) return null;

    return [...counts.entries()]
        .map(([label, count]) => ({
            label,
            count,
            percentage: Math.round((count / total) * 1000) / 10
        }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

const RESOLVED_STATUS_PATTERN = /\b(pass|passed|resolved|fixed|closed|complete|completed|remediated)\b/i;
const OPEN_STATUS_PATTERN = /\b(fail|failed|open|new|in progress|in-progress|pending|deferred|blocked)\b/i;

function classifyStatus(status) {
    const text = normalizeText(status);
    if (!text) return 'unknown';
    if (RESOLVED_STATUS_PATTERN.test(text)) return 'resolved';
    if (OPEN_STATUS_PATTERN.test(text)) return 'open';
    return 'other';
}

function getMonthKey(date) {
    if (!(date instanceof Date)) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Recurrence is matched on the recorded text of a finding, not on a stable finding identity,
// so near-duplicate wording is reported separately rather than merged.
function buildRecurrenceGroups(reports) {
    const groups = new Map();

    reports.forEach((report) => {
        report.findings.forEach((finding) => {
            const descriptor = normalizeText(finding.criterion) || normalizeText(finding.issueType) || normalizeText(finding.category);
            if (!descriptor) return;
            const target = normalizeText(finding.target);
            const key = `${descriptor.toLowerCase()}||${target.toLowerCase()}`;
            if (!groups.has(key)) {
                groups.set(key, { descriptor, target, occurrences: 0, reportIds: new Set() });
            }
            const group = groups.get(key);
            group.occurrences += 1;
            group.reportIds.add(report.id);
        });
    });

    return [...groups.values()]
        .filter((group) => group.reportIds.size > 1)
        .map((group) => ({
            descriptor: group.descriptor,
            target: group.target,
            occurrences: group.occurrences,
            reportCount: group.reportIds.size
        }))
        .sort((left, right) => right.reportCount - left.reportCount || right.occurrences - left.occurrences);
}

function registerBuiltInMetrics() {
    if (metricDefinitions.size > 0) return;

    const define = (id, name, description, measure, calculate, extras = {}) => registerMetricDefinition({
        id,
        name,
        description,
        measure,
        source: extras.source || 'Report data',
        requires: extras.requires || [],
        supports: extras.supports || ['organization', 'product', 'project', 'workspace', 'report', 'dateRange'],
        calculate
    });

    define('totalReports', 'Total Reports', 'Number of reports within the selected scope.', 'count',
        ({ reports }) => createMetricValue(reports.length));

    define('totalFindings', 'Total Findings', 'Total number of findings within the selected scope.', 'count',
        ({ reports }) => createMetricValue(reports.reduce((total, report) => total + report.findings.length, 0)),
        { requires: ['findings'] });

    define('uniqueProducts', 'Products', 'Number of distinct products represented.', 'uniqueCount',
        ({ reports }) => {
            const products = reports.map((report) => report.product).filter(Boolean);
            if (products.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope contain a Product value.');
            }
            return createMetricValue(countDistinct(products));
        }, { requires: ['product'] });

    define('uniqueProjects', 'Projects', 'Number of distinct projects represented.', 'uniqueCount',
        ({ reports }) => {
            const projects = reports.map((report) => report.projectName).filter(Boolean);
            if (projects.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope contain a Project value.');
            }
            return createMetricValue(countDistinct(projects));
        }, { requires: ['projectName'] });

    define('uniqueWorkspaces', 'Workspaces', 'Number of distinct Project Workspaces represented.', 'uniqueCount',
        ({ reports }) => {
            const workspaces = reports.map((report) => report.workspaceId).filter(Boolean);
            if (workspaces.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope belong to a Project Workspace.');
            }
            return createMetricValue(countDistinct(workspaces));
        });

    define('uniqueTesters', 'Unique Testers', 'Number of distinct testers represented, counted once per person.', 'uniqueCount',
        ({ reports }) => {
            const testerKeys = reports.flatMap((report) => report.testers.map(getTesterKey)).filter(Boolean);
            if (testerKeys.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope contain Tester information.');
            }
            return createMetricValue(countDistinct(testerKeys));
        }, { requires: ['auditors'], source: 'Report Auditor(s) metadata' });

    define('uniqueStandards', 'Accessibility Standards', 'Number of distinct accessibility standards represented.', 'uniqueCount',
        ({ reports }) => {
            const standards = reports.map((report) => report.standard).filter(Boolean);
            if (standards.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No accessibility standard information is available.');
            }
            return createMetricValue(countDistinct(standards));
        });

    define('findingsBySeverity', 'Findings by Severity', 'Distribution of findings by severity value.', 'distribution',
        ({ reports }) => {
            const distribution = buildDistribution(reports, (finding) => finding.severity);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Reports in this scope do not record a severity value.');
        }, { requires: ['severity'] });

    define('findingsByCategory', 'Findings by Category', 'Distribution of findings by category value.', 'distribution',
        ({ reports }) => {
            const distribution = buildDistribution(reports, (finding) => finding.category);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Reports in this scope do not record a category value.');
        }, { requires: ['category'] });

    define('findingsByStatus', 'Findings by Status', 'Distribution of findings by status value.', 'distribution',
        ({ reports }) => {
            const distribution = buildDistribution(reports, (finding) => finding.status);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Reports in this scope do not record a status value.');
        }, { requires: ['status'] });

    define('findingsByCriterion', 'Findings by Success Criterion', 'Distribution of findings by WCAG Success Criterion.', 'distribution',
        ({ reports }) => {
            const distribution = buildDistribution(reports, (finding) => finding.criterion);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Reports in this scope do not record Success Criterion values.');
        });

    define('findingsByProduct', 'Findings by Product', 'Number of findings for each product.', 'distribution',
        ({ reports }) => {
            const counts = new Map();
            let total = 0;
            reports.forEach((report) => {
                if (!report.product) return;
                counts.set(report.product, Number(counts.get(report.product) || 0) + report.findings.length);
                total += report.findings.length;
            });
            if (counts.size === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope contain a Product value.');
            }
            const distribution = [...counts.entries()]
                .map(([label, count]) => ({ label, count, percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
                .sort((left, right) => right.count - left.count);
            return createMetricValue(distribution);
        }, { requires: ['product'] });

    define('metadataCompleteness', 'Metadata Completeness', 'Percentage of reports containing key organization metadata.', 'percentage',
        ({ reports }) => {
            if (reports.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope.');
            }
            const percent = (count) => Math.round((count / reports.length) * 1000) / 10;
            return createMetricValue({
                organization: percent(reports.filter((report) => report.organizationName).length),
                product: percent(reports.filter((report) => report.product).length),
                tester: percent(reports.filter((report) => report.testers.length > 0).length),
                date: percent(reports.filter((report) => report.date instanceof Date).length)
            });
        });

    define('metadataQualityDetails', 'Metadata Quality Details', 'Reports with missing organization metadata fields.', 'records',
        ({ reports }) => {
            if (reports.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope.');
            }
            const records = reports.map((report) => ({
                reportId: report.id,
                reportName: report.name || report.id,
                missing: [
                    !report.organizationName ? 'Organization/Client' : '',
                    !report.product ? 'Product' : '',
                    report.testers.length === 0 ? 'Tester' : '',
                    !(report.date instanceof Date) ? 'Date' : ''
                ].filter(Boolean)
            })).filter((record) => record.missing.length > 0);
            return createMetricValue(records);
        });

    const distributionMetric = (id, name, description, selector, emptyReason, extras = {}) => define(
        id, name, description, 'distribution',
        ({ reports }) => {
            const distribution = buildDistribution(reports, selector);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, emptyReason);
        },
        extras
    );

    distributionMetric('findingsByIssueType', 'Findings by Issue Type', 'Distribution of findings by issue or defect type.',
        (finding) => finding.issueType, 'Reports in this scope do not record an issue type value.', { requires: ['issueType'] });

    distributionMetric('findingsByUsabilityHeuristic', 'Findings by Usability Heuristic', 'Distribution of findings by Usability Heuristic.',
        (finding) => {
            const raw = finding.heuristics;
            if (!raw) return null;
            return raw.split(/[\r\n,;]+/).map((v) => v.trim()).filter(Boolean);
        }, 'Reports in this scope do not record a Usability Heuristic value.', { requires: ['usability-heuristics'] });

    distributionMetric('findingsByTarget', 'Findings by Page, Screen, or Component', 'Where findings were recorded.',
        (finding) => finding.target, 'Reports in this scope do not record a page, screen, or component value.', { requires: ['target'] });

    const reportDistributionMetric = (id, name, description, selector, emptyReason, extras = {}) => define(
        id, name, description, 'distribution',
        ({ reports }) => {
            const distribution = buildReportDistribution(reports, selector);
            return distribution
                ? createMetricValue(distribution)
                : createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, emptyReason);
        },
        extras
    );

    reportDistributionMetric('reportsByStandard', 'Reports by Accessibility Standard', 'Number of reports evaluated against each standard.',
        (report) => report.standard, 'No reports in this scope record an accessibility standard.');

    reportDistributionMetric('reportsByProject', 'Reports by Project', 'Number of reports for each project.',
        (report) => report.projectName, 'No reports in this scope contain a Project value.', { requires: ['projectName'] });

    reportDistributionMetric('reportsByWorkspace', 'Reports by Project Workspace', 'Number of reports in each Project Workspace.',
        (report) => report.workspaceName, 'No reports in this scope belong to a Project Workspace.');

    reportDistributionMetric('reportsByProduct', 'Reports by Product', 'Number of reports for each product.',
        (report) => report.product, 'No reports in this scope contain a Product value.', { requires: ['product'] });

    reportDistributionMetric('reportsByType', 'Reports by Report Type', 'Number of reports of each report type.',
        (report) => report.reportType, 'No reports in this scope record a report type.');

    reportDistributionMetric('reportsByTester', 'Reports by Tester', 'Number of reports each tester contributed to. This describes testing activity, not individual performance.',
        (report) => report.testers, 'No reports in this scope contain Tester information.',
        { requires: ['auditors'], source: 'Report Auditor(s) metadata' });

    define('testingCoverage', 'Testing Coverage', 'How much of the organization\'s recorded work has been covered by testing activity.', 'summary',
        ({ reports }) => {
            if (reports.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope.');
            }
            const targets = new Set();
            reports.forEach((report) => report.findings.forEach((finding) => {
                if (finding.target) targets.add(finding.target.toLowerCase());
            }));
            return createMetricValue({
                reportsWithFindings: reports.filter((report) => report.findings.length > 0).length,
                reportsWithoutFindings: reports.filter((report) => report.findings.length === 0).length,
                distinctTargets: targets.size,
                productsCovered: countDistinct(reports.map((report) => report.product).filter(Boolean)),
                projectsCovered: countDistinct(reports.map((report) => report.projectName).filter(Boolean))
            });
        });

    define('reportTrend', 'Reporting Activity Over Time', 'Reports and findings recorded in each month.', 'timeSeries',
        ({ reports }) => {
            const dated = reports.filter((report) => report.date instanceof Date);
            if (dated.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope contain a usable date.');
            }
            const buckets = new Map();
            dated.forEach((report) => {
                const key = getMonthKey(report.date);
                if (!buckets.has(key)) buckets.set(key, { period: key, reportCount: 0, findingCount: 0 });
                const bucket = buckets.get(key);
                bucket.reportCount += 1;
                bucket.findingCount += report.findings.length;
            });
            return createMetricValue({
                periods: [...buckets.values()].sort((left, right) => left.period.localeCompare(right.period)),
                reportsWithoutDate: reports.length - dated.length
            });
        });

    define('findingRecurrence', 'Recurring Findings', 'Findings recorded in more than one report, matched on their recorded text.', 'summary',
        ({ reports }) => {
            const hasDescriptors = reports.some((report) => report.findings.some((finding) => finding.criterion || finding.issueType || finding.category));
            if (!hasDescriptors) {
                return createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Findings in this scope do not record a criterion, issue type, or category to match on.');
            }
            if (reports.length < 2) {
                return createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Recurrence needs at least two reports in the selected scope.');
            }
            return createMetricValue(buildRecurrenceGroups(reports));
        }, { requires: ['findings'] });

    define('remediationProgress', 'Remediation Progress', 'How many findings are recorded as resolved versus open.', 'summary',
        ({ reports }) => {
            const statuses = reports.flatMap((report) => report.findings.map((finding) => classifyStatus(finding.status)));
            const classified = statuses.filter((status) => status !== 'unknown');
            if (classified.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'Findings in this scope do not record a status value.');
            }
            const resolved = classified.filter((status) => status === 'resolved').length;
            const open = classified.filter((status) => status === 'open').length;
            const other = classified.filter((status) => status === 'other').length;
            return createMetricValue({
                resolved,
                open,
                other,
                unclassified: statuses.length - classified.length,
                resolvedPercentage: Math.round((resolved / classified.length) * 1000) / 10
            });
        }, { requires: ['status'] });

    define('accessibilityHealth', 'Accessibility Health Indicators', 'Descriptive indicators of accessibility activity. These are not a compliance score.', 'summary',
        ({ reports }) => {
            if (reports.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'No reports in this scope.');
            }
            const findings = reports.flatMap((report) => report.findings);
            if (findings.length === 0) {
                return createMetricValue(null, METRIC_AVAILABILITY.NOT_APPLICABLE, 'No findings are recorded in this scope.');
            }
            const statuses = findings.map((finding) => classifyStatus(finding.status));
            const classified = statuses.filter((status) => status !== 'unknown');
            return createMetricValue({
                averageFindingsPerReport: Math.round((findings.length / reports.length) * 10) / 10,
                reportsWithFindings: reports.filter((report) => report.findings.length > 0).length,
                distinctCriteria: countDistinct(findings.map((finding) => finding.criterion).filter(Boolean)),
                resolvedPercentage: classified.length > 0
                    ? Math.round((classified.filter((status) => status === 'resolved').length / classified.length) * 1000) / 10
                    : null
            });
        });
}

export function calculateOrganizationMetrics(scope = {}, options = {}) {
    registerBuiltInMetrics();

    const index = options.index || buildOrganizationIndex(options);
    const { organization, reports } = collectScopeReports(index, scope);

    const requestedIds = Array.isArray(options.metricIds) && options.metricIds.length > 0
        ? options.metricIds
        : [...metricDefinitions.keys()];
    const canCache = !options.authorize && Boolean(index.signature);
    const cacheKey = canCache
        ? `${index.signature}|${getScopeSignature(scope)}|${requestedIds.map(normalizeText).sort().join(',')}`
        : '';
    if (cacheKey && runtimeCache.metrics.has(cacheKey)) {
        runtimeCache.hits += 1;
        return runtimeCache.metrics.get(cacheKey);
    }
    runtimeCache.misses += 1;

    const context = { reports, organization, scope, index };
    const metrics = {};

    requestedIds.forEach((metricId) => {
        const definition = metricDefinitions.get(normalizeText(metricId));
        if (!definition) return;
        try {
            metrics[definition.id] = { ...definition.calculate(context), definition: { id: definition.id, name: definition.name, measure: definition.measure } };
        } catch (error) {
            metrics[definition.id] = createMetricValue(null, METRIC_AVAILABILITY.UNAVAILABLE, 'This metric could not be calculated.');
        }
    });

    const result = {
        scope: {
            organization: organization?.displayName || '',
            product: normalizeText(scope.product),
            project: normalizeText(scope.project),
            workspaceId: normalizeText(scope.workspaceId),
            dateFrom: scope.dateFrom instanceof Date ? scope.dateFrom.toISOString() : '',
            dateTo: scope.dateTo instanceof Date ? scope.dateTo.toISOString() : ''
        },
        reportCount: reports.length,
        metrics,
        dataQuality: {
            reportsWithoutOrganization: index.unassignedReports.length,
            organizationNameVariants: organization?.displayNameVariants?.length > 1
                ? organization.displayNameVariants
                : []
        }
    };

    if (cacheKey) runtimeCache.metrics.set(cacheKey, result);
    return result;
}

export function initializeOrganizationMetricsFramework() {
    registerBuiltInMetrics();
    if (typeof window !== 'undefined' && !window.__artOrganizationMetricsCacheBound) {
        window.__artOrganizationMetricsCacheBound = true;
        window.addEventListener('art-state-updated', clearOrganizationMetricsCache);
        window.addEventListener('art-state-restored', clearOrganizationMetricsCache);
    }
    return true;
}

// Filter choices are derived from the reports already in scope so the UI never offers
// a filter that would produce an empty result.
export function getOrganizationScopeOptions(organizationName, options = {}) {
    const index = options.index || buildOrganizationIndex(options);
    const { reports } = collectScopeReports(index, { organization: organizationName });
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

    return {
        products: unique(reports.map((report) => report.product)),
        projects: unique(reports.map((report) => report.projectName)),
        workspaces: [...new Map(reports
            .filter((report) => report.workspaceId)
            .map((report) => [report.workspaceId, { id: report.workspaceId, name: report.workspaceName }])).values()]
            .sort((left, right) => left.name.localeCompare(right.name))
    };
}

export const DATE_RANGE_OPTIONS = [
    { id: 'all', label: 'All dates' },
    { id: 'last-30-days', label: 'Last 30 days' },
    { id: 'last-90-days', label: 'Last 90 days' },
    { id: 'last-12-months', label: 'Last 12 months' }
];

export function resolveDateRange(rangeId) {
    const days = { 'last-30-days': 30, 'last-90-days': 90, 'last-12-months': 365 }[normalizeText(rangeId)];
    if (!days) return {};
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    return { dateFrom };
}

// Comparison is descriptive only: organizations differ in size, scope, and testing practice,
// so these figures are not a ranking.
export function compareOrganizations(options = {}) {
    const index = options.index || buildOrganizationIndex(options);
    return index.organizations.map((organization) => {
        const findings = organization.reports.flatMap((report) => report.findings);
        const statuses = findings.map((finding) => classifyStatus(finding.status)).filter((status) => status !== 'unknown');
        return {
            key: organization.key,
            displayName: organization.displayName,
            reportCount: organization.reports.length,
            findingCount: findings.length,
            averageFindingsPerReport: organization.reports.length > 0
                ? Math.round((findings.length / organization.reports.length) * 10) / 10
                : null,
            resolvedPercentage: statuses.length > 0
                ? Math.round((statuses.filter((status) => status === 'resolved').length / statuses.length) * 1000) / 10
                : null
        };
    });
}
