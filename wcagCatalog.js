const WCAG_DATA_URL = 'wcag_data.js';

let catalogPromise = null;

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

    return {
        ...entry,
        standard,
        identifier: stableId,
        number: parsed.number,
        title: parsed.title,
        level: String(entry.level || '').trim(),
        understandingUrl,
        recommendationUrl: buildRecommendationUrl(understandingUrl),
        searchText: `${parsed.number} ${parsed.title} ${entry.desc || ''}`.toLowerCase()
    };
}

async function fetchCatalogData() {
    const response = await fetch(WCAG_DATA_URL, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Unable to load WCAG data: HTTP ${response.status}`);
    }
    const raw = await response.json();
    if (!Array.isArray(raw)) {
        throw new Error('WCAG data is not an array.');
    }
    return raw.map(normalizeCriterion);
}

export function loadWcagCatalog() {
    if (!catalogPromise) {
        catalogPromise = fetchCatalogData();
    }
    return catalogPromise;
}

export async function getWcagCriteriaForStandard(standard) {
    const catalog = await loadWcagCatalog();
    return catalog.filter((item) => item.standard === standard);
}

export async function getWcagCriterionByIdentifier(identifier) {
    const catalog = await loadWcagCatalog();
    return catalog.find((item) => item.identifier === identifier) || null;
}

export async function getAvailableWcagStandards() {
    const catalog = await loadWcagCatalog();
    return [...new Set(catalog.map((item) => item.standard))];
}

export function isWcagCriterionFieldType(type) {
    return String(type || '') === 'wcag-success-criterion';
}

export function formatWcagCriterionDisplay(value) {
    if (!value || typeof value !== 'object') return '';
    const number = String(value.number || '').trim();
    const title = String(value.title || '').trim();
    return [number, title].filter(Boolean).join(' ');
}
