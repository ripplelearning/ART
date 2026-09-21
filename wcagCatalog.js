import defaultStandards from './defaultStandards.js';
import { getImportedAccessibilityStandards } from './state.js';
import { getSection508LookupCategory } from './section508TemplateCatalog.js';

let builtInCatalogPromise = null;

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseCriterionName(name) {
    const text = String(name || '').trim();
    const match = text.match(/^(\d+\.\d+\.\d+)\s+(.+)$/);
    if (!match) {
        return {
            number: text,
            title: text
        };
    }

    return {
        number: match[1],
        title: match[2]
    };
}

function normalizeStandard(ver) {
    return `WCAG ${String(ver)}`;
}

function buildRecommendationUrl(understandingUrl) {
    if (!understandingUrl) return '';
    const numberMatch = String(understandingUrl).match(/Understanding\/[^/]+$/);
    if (!numberMatch) return '';
    return '';
}

function normalizeCriterion(entry) {
    const standard = normalizeStandard(entry.ver);
    const parsed = parseCriterionName(entry.name);
    const understandingUrl = String(entry.Link || '').trim();
    const stableId = `${slugify(standard)}-${parsed.number || slugify(parsed.title)}`;
    const references = understandingUrl
        ? [{ label: 'Official reference', url: understandingUrl }]
        : [];

    return {
        ...entry,
        standard,
        identifier: stableId,
        number: parsed.number,
        title: parsed.title,
        level: String(entry.level || '').trim(),
        understandingUrl,
        references,
        recommendationUrl: buildRecommendationUrl(understandingUrl),
        searchText: `${parsed.number} ${parsed.title} ${entry.desc || ''}`.toLowerCase()
    };
}

function normalizeImportedCatalogEntry(criterion, standardName) {
    const number = String(criterion?.number || '').trim();
    const title = String(criterion?.title || criterion?.name || '').trim();
    const desc = String(criterion?.desc || '').trim();
    const understandingUrl = String(criterion?.understandingUrl || criterion?.Link || '').trim();
    const references = Array.isArray(criterion?.references)
        ? criterion.references
        : understandingUrl
            ? [{ label: 'Official reference', url: understandingUrl }]
            : [];
    const identifier = String(
        criterion?.identifier
        || `${slugify(standardName)}-${slugify(number || title || Math.random().toString(36).slice(2))}`
    );

    const isSection508 = standardName.toLowerCase().includes('section 508');
    const section508Category = isSection508
        ? getSection508LookupCategory(criterion)
        : '';
    const section508Type = isSection508
        ? (String(number).startsWith('302.') ? 'Functional Performance Criteria' : section508Category === 'Software' ? 'Software Requirements' : section508Category === 'Support Documentation and Services' ? 'Support Requirements' : 'Technical Requirements')
        : '';
    return {
        ...criterion,
        standard: standardName,
        identifier,
        number,
        title,
        level: String(criterion?.level || '').trim(),
        understandingUrl,
        recommendationUrl: String(criterion?.recommendationUrl || '').trim(),
        references,
        searchText: `${number} ${title} ${desc}`.toLowerCase(),
        desc,
        failures: String(criterion?.failures || '').trim(),
        fixes: String(criterion?.fixes || '').trim(),
        disabilitie: String(criterion?.disabilitie || criterion?.disabilities || '').trim(),
        categories: isSection508
            ? String(section508Category || '').trim()
            : String(criterion?.categories || '').trim(),
        section508Type,
        tags: Array.isArray(criterion?.tags)
            ? criterion.tags
            : String(criterion?.tags || '').split('|').map((tag) => tag.trim()).filter(Boolean)
    };
}

async function loadBuiltInCatalog() {
    if (!builtInCatalogPromise) {
        if (!Array.isArray(defaultStandards)) {
            throw new Error('Default standards are not available.');
        }
        builtInCatalogPromise = Promise.resolve(defaultStandards.map(normalizeCriterion));
    }
    return builtInCatalogPromise;
}

async function buildMergedCatalog() {
    const builtInCatalog = await loadBuiltInCatalog();
    const importedStandards = getImportedAccessibilityStandards();
    const importedCriteria = importedStandards.flatMap((standard) => {
        const standardName = String(standard.displayName || standard.internalId || 'Imported Standard').trim();
        return (Array.isArray(standard.criteria) ? standard.criteria : []).map((criterion) => normalizeImportedCatalogEntry(criterion, standardName));
    });
    return [...builtInCatalog, ...importedCriteria];
}

export function loadWcagCatalog() {
    return buildMergedCatalog();
}

// Search providers run synchronously, so expose the catalog without awaiting the merged promise.
export function getWcagCatalogSync() {
    if (!Array.isArray(defaultStandards)) return [];
    const builtInCatalog = defaultStandards.map(normalizeCriterion);
    const importedCriteria = getImportedAccessibilityStandards().flatMap((standard) => {
        const standardName = String(standard.displayName || standard.internalId || 'Imported Standard').trim();
        return (Array.isArray(standard.criteria) ? standard.criteria : []).map((criterion) => normalizeImportedCatalogEntry(criterion, standardName));
    });
    return [...builtInCatalog, ...importedCriteria];
}

export async function getWcagCriteriaForStandard(standard) {
    const catalog = await loadWcagCatalog();
    return catalog.filter((item) => item.standard === standard);
}

export async function getAvailableWcagStandards() {
    const catalog = await loadWcagCatalog();
    return [...new Set(catalog.map((item) => item.standard))];
}

export async function getSection508LookupCriteria() {
    const imported = getImportedAccessibilityStandards().find((standard) => String(standard.internalId || '').trim().toLowerCase() === 'section-508');
    if (!imported) return [];
    const { getSection508Template } = await import('./section508TemplateCatalog.js');
    const templates = await Promise.all(['Web', 'Software'].map((productType) => getSection508Template(productType).catch(() => null)));
    return templates.flatMap((template) => (template?.criteria || []).map((criterion) => ({
        ...criterion,
        standard: imported.displayName || 'Section 508',
        section508Type: template.productType === 'Software' ? 'Software Requirements' : template.productType === 'Hardware' ? 'Hardware Requirements' : 'Technical Requirements',
        identifier: `section-508-${String(criterion.testId || criterion.testName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        number: criterion.testId,
        title: criterion.testName,
        level: criterion.level,
        desc: criterion.requirement || criterion.testCondition,
        failures: criterion.failures,
        fixes: criterion.documentationGuidance,
        categories: criterion.category,
        tags: [criterion.category, criterion.test, criterion.testName, criterion.testCondition].filter(Boolean),
        understandingUrl: criterion.officialDocumentationUrl,
        testProcedure: criterion.testProcedure,
        resultGuidance: criterion.resultGuidance,
        documentationGuidance: criterion.documentationGuidance,
        searchText: `${criterion.testId} ${criterion.testName} ${criterion.testCondition}`.toLowerCase()
    })));
}

export function isWcagCriterionFieldType(type) {
    return String(type || '') === 'wcag-success-criterion';
}

export function formatWcagCriterionDisplay(value) {
    if (!value || typeof value !== 'object') return '';
    const number = String(value.number || '').trim();
    const title = String(value.title || '').trim();
    const level = String(value.level || value.conformanceLevel || value.conformance || '').trim();
    const normalizedLevel = level.replace(/^level\s+/i, '').toUpperCase();
    const levelText = normalizedLevel ? `(Level ${normalizedLevel})` : '';
    return [number, title, levelText].filter(Boolean).join(' ');
}
