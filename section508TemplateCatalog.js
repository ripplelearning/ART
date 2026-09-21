const PRODUCT_TYPES = Object.freeze(['Web', 'Electronic Document', 'Software', 'Hardware']);
const CONFORMANCE_LEVELS = Object.freeze(['Level A', 'Level AA', 'Level AAA']);
const TEST_RESULTS = Object.freeze([
    { id: 'supports', label: 'Supports' },
    { id: 'supports-with-exceptions', label: 'Supports with Exceptions' },
    { id: 'does-not-support', label: 'Does Not Support' },
    { id: 'not-applicable', label: 'Not Applicable' },
    { id: 'not-evaluated', label: 'Not Evaluated' }
]);

const LOOKUP_CATEGORIES = Object.freeze([
    'ARIA & Live Regions',
    'Audio & Video',
    'Buttons & Navigation',
    'Color & Contrast',
    'Focus & Keyboard',
    'Forms & Inputs',
    'Images & Graphics'
]);

const TEMPLATE_URLS = Object.freeze({
    Web: './packages/accessibility-standards/section-508-templates/section-508-web-audit-report-template.json',
    Software: './packages/accessibility-standards/section-508-templates/section-508-software-audit-report-template.json'
});

let templatePromise = null;
let wcag20Promise = null;

function text(value) {
    return String(value ?? '').trim();
}

function classifyCriterion(criterion) {
    const source = `${text(criterion.Test)} ${text(criterion.TestName)} ${text(criterion.TestCondition)}`.toLowerCase();
    if (/keyboard|focus|tab order|modal|trap/.test(source)) return 'Focus & Keyboard';
    if (/form|label|input|name property|role|state|value/.test(source)) return 'Forms & Inputs';
    if (/image|graphic|alt|table/.test(source)) return 'Images & Graphics';
    if (/audio|video|caption|media|multimedia/.test(source)) return 'Audio & Video';
    if (/color|contrast|luminance/.test(source)) return 'Color & Contrast';
    if (/link|navigation|page title|multiple ways|skip/.test(source)) return 'Buttons & Navigation';
    return 'ARIA & Live Regions';
}

export function getSection508LookupCategory(value) {
    return classifyCriterion({
        Test: value?.test || value?.title || value?.categories,
        TestName: value?.testName || value?.title,
        TestCondition: value?.testCondition || value?.desc
    });
}

function normalizeCriterion(criterion, productType) {
    const fixedResult = text(criterion.Result || criterion.TestResult || criterion.FixedResult || criterion.RequiredResult)
        || (/should be recorded as NOT TESTED/i.test(text(criterion.TestCondition)) ? 'not-evaluated' : '');
    const levelText = text(criterion.Guideline);
    const level = /AAA/i.test(levelText) ? 'Level AAA' : /AA/i.test(levelText) ? 'Level AA' : 'Level A';
    return {
        productType,
        criterionId: text(criterion.CrtID),
        guideline: levelText,
        test: text(criterion.Test),
        testName: text(criterion.TestName),
        testId: text(criterion.TestID),
        testCondition: text(criterion.TestCondition),
        risk: text(criterion.Risk),
        optionMenu: text(criterion.OptMenu1),
        disabilityImpact: text(criterion.DisabilityImpact),
        groupId: text(criterion.GrpID),
        category: classifyCriterion(criterion),
        requirement: text(criterion.TestCondition),
        testProcedure: text(criterion.TestCondition),
        failures: text(criterion.TestCondition),
        resultGuidance: fixedResult ? `Record the authoritative fixed result: ${fixedResult}.` : 'Record Supports, Supports with Exceptions, Does Not Support, Not Applicable, or Not Evaluated.',
        documentationGuidance: 'Document the observed condition, evidence, result rationale, exceptions, and any retest information in the result and comments fields.',
        officialDocumentationUrl: 'https://www.access-board.gov/ict/',
        level,
        fixedResult: fixedResult || '',
        result: fixedResult || '',
        comments: '',
        applicable: true
    };
}

function normalizeTemplate(raw, productType) {
    const source = Array.isArray(raw) ? raw[0] : raw;
    return {
        productType,
        sourceTemplate: productType === 'Web' ? 'section-508-web-audit-report-template.json' : 'section-508-software-audit-report-template.json',
        product: source?.Product || {},
        system: source?.System || {},
        tester: source?.Tester || {},
        criteria: Array.isArray(source?.Criteria) ? source.Criteria.map((criterion) => normalizeCriterion(criterion, productType)) : []
    };
}

async function loadTemplate(productType) {
    const url = TEMPLATE_URLS[productType];
    if (!url) return { productType, criteria: [], product: {}, system: {}, tester: {} };
    const response = await fetch(new URL(url, import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Unable to load Section 508 ${productType} template: HTTP ${response.status}`);
    return normalizeTemplate(await response.json(), productType);
}

export function getSection508ProductTypes() {
    return [...PRODUCT_TYPES];
}

export function getSection508ConformanceLevels() {
    return [...CONFORMANCE_LEVELS];
}

export function getSection508TestResults() {
    return TEST_RESULTS.map((result) => ({ ...result }));
}

export function getSection508LookupCategories() {
    return [...LOOKUP_CATEGORIES];
}

export function filterSection508Criteria(criteria, productType, conformanceLevel) {
    const maxLevel = conformanceLevel ? CONFORMANCE_LEVELS.indexOf(conformanceLevel) : Number.POSITIVE_INFINITY;
    const levelRank = (value) => {
        const normalized = text(value).toUpperCase().replace(/^LEVEL\s+/, '');
        return normalized === 'AAA' ? 2 : normalized === 'AA' ? 1 : 0;
    };
    return (Array.isArray(criteria) ? criteria : []).filter((criterion) => {
        const criterionNumber = text(criterion.number || criterion.identifier).toLowerCase();
        if (criterionNumber.includes('software-interoperability') && productType !== 'Software') return false;
        if (criterionNumber.includes('support-documentation') && !['Electronic Document', 'Software', 'Hardware'].includes(productType)) return false;
        if (Array.isArray(criterion.productTypes) && productType && !criterion.productTypes.includes(productType)) return false;
        if (criterion.productType && criterion.productType !== productType) return false;
        return levelRank(criterion.level || 'Level A') <= maxLevel;
    });
}

export async function getSection508Wcag20Criteria() {
    if (!wcag20Promise) {
        const wcag21Only = new Set(['1.3.5', '1.3.6', '1.4.10', '1.4.11', '1.4.12', '1.4.13', '2.1.4', '2.2.6', '2.3.3', '2.5.1', '2.5.2', '2.5.3', '2.5.4', '2.5.5', '2.5.6']);
        wcag20Promise = fetch(new URL('./wcag_data.js', import.meta.url), { cache: 'no-cache' })
            .then((response) => {
                if (!response.ok) throw new Error(`Unable to load WCAG catalog: HTTP ${response.status}`);
                return response.text();
            })
            .then((source) => Function(`"use strict"; return (${source.trim().replace(/;\s*$/, '')});`)())
            .then((entries) => entries
                .filter((entry) => String(entry.ver) === '2.1' && !wcag21Only.has(String(entry.name || '').split(' ')[0]))
                .map((entry) => ({
                    number: String(entry.name || '').split(' ')[0],
                    title: String(entry.name || '').replace(/^\S+\s+/, ''),
                    level: String(entry.level || ''),
                    desc: String(entry.desc || ''),
                    failures: String(entry.failures || ''),
                    fixes: String(entry.fixes || ''),
                    understandingUrl: String(entry.Link || ''),
                    tags: Array.isArray(entry.tags) ? entry.tags : []
                })));
    }
    return wcag20Promise;
}

export async function getSection508Template(productType) {
    if (!templatePromise) {
        templatePromise = Promise.all(Object.keys(TEMPLATE_URLS).map(async (type) => [type, await loadTemplate(type)]))
            .then((entries) => Object.fromEntries(entries));
    }
    const templates = await templatePromise;
    return templates[productType] || { productType, criteria: [], product: {}, system: {}, tester: {} };
}
