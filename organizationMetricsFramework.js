// organizationMetricsFramework.js
import { getProjectWorkspaces, getRecentReports } from './state.js';

// Availability is first-class: a metric that cannot be calculated is never reported as zero.
export const METRIC_AVAILABILITY = {
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    NOT_APPLICABLE: 'not-applicable'
};

const metricDefinitions = new Map();

function normalizeText(value) {
    return String(value ?? '').trim();
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

    const readValue = (entry, index) => (index >= 0 ? normalizeText(entry?.fieldValues?.[index]) : '');

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
                target: readValue(entry, targetIndex)
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
    const reports = (Array.isArray(options.reports) ? options.reports : getRecentReports()).filter(authorize);

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

    return {
        organizations: [...organizations.values()].map((organization) => ({
            ...organization,
            displayNameVariants: [...organization.displayNameVariants]
        })).sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' })),
        unassignedReports,
        totalReports: reports.length
    };
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
            const rawValue = normalizeText(selector(finding));
            if (!rawValue) return;
            counts.set(rawValue, Number(counts.get(rawValue) || 0) + 1);
            total += 1;
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
}

export function calculateOrganizationMetrics(scope = {}, options = {}) {
    registerBuiltInMetrics();

    const index = options.index || buildOrganizationIndex(options);
    const { organization, reports } = collectScopeReports(index, scope);

    const requestedIds = Array.isArray(options.metricIds) && options.metricIds.length > 0
        ? options.metricIds
        : [...metricDefinitions.keys()];

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

    return {
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
}

export function initializeOrganizationMetricsFramework() {
    registerBuiltInMetrics();
    return true;
}
