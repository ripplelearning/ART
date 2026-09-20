const PRODUCT_TYPES = Object.freeze(['Web', 'Electronic Document', 'Software', 'Hardware']);
const CONFORMANCE_LEVELS = Object.freeze(['Level A', 'Level AA', 'Level AAA']);
const TEST_RESULTS = Object.freeze([
    { id: 'supports', label: 'Supports' },
    { id: 'supports-with-exceptions', label: 'Supports with Exceptions' },
    { id: 'does-not-support', label: 'Does Not Support' },
    { id: 'not-applicable', label: 'Not Applicable' },
    { id: 'not-evaluated', label: 'Not Evaluated' }
]);

const TEMPLATE_URLS = Object.freeze({
    Web: './packages/accessibility-standards/section-508-templates/section-508-web-audit-report-template.json',
    Software: './packages/accessibility-standards/section-508-templates/section-508-software-audit-report-template.json'
});

let templatePromise = null;

function text(value) {
    return String(value ?? '').trim();
}

function normalizeCriterion(criterion, productType) {
    const fixedResult = text(criterion.Result || criterion.TestResult || criterion.FixedResult || criterion.RequiredResult);
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

export function filterSection508Criteria(criteria, productType, conformanceLevel) {
    const maxLevel = CONFORMANCE_LEVELS.indexOf(conformanceLevel || 'Level A');
    return (Array.isArray(criteria) ? criteria : []).filter((criterion) => {
        if (criterion.productType && criterion.productType !== productType) return false;
        return CONFORMANCE_LEVELS.indexOf(criterion.level || 'Level A') <= maxLevel;
    });
}

export async function getSection508Template(productType) {
    if (!templatePromise) {
        templatePromise = Promise.all(Object.keys(TEMPLATE_URLS).map(async (type) => [type, await loadTemplate(type)]))
            .then((entries) => Object.fromEntries(entries));
    }
    const templates = await templatePromise;
    return templates[productType] || { productType, criteria: [], product: {}, system: {}, tester: {} };
}
