const LOCALE_PREFERENCE_KEY = 'art-locale-preference-v1';

export const SUPPORTED_LOCALES = Object.freeze([
    { id: 'en-US', language: 'English', label: 'English (United States)', direction: 'ltr', interfaceAvailable: true },
    { id: 'en-GB', language: 'English', label: 'English (United Kingdom)', direction: 'ltr', interfaceAvailable: false },
    { id: 'de-DE', language: 'German', label: 'German (Germany)', direction: 'ltr', interfaceAvailable: false },
    { id: 'es-ES', language: 'Spanish', label: 'Spanish (Spain)', direction: 'ltr', interfaceAvailable: false },
    { id: 'fr-FR', language: 'French', label: 'French (France)', direction: 'ltr', interfaceAvailable: false },
    { id: 'ar', language: 'Arabic', label: 'Arabic', direction: 'rtl', interfaceAvailable: false }
]);

function normalizeLocale(locale) {
    const value = String(locale || '').trim();
    return SUPPORTED_LOCALES.some((entry) => entry.id === value) ? value : 'en-US';
}

function readPreference() {
    try {
        const value = JSON.parse(localStorage.getItem(LOCALE_PREFERENCE_KEY) || '{}');
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

export function getLocalePreference() {
    const preference = readPreference();
    const locale = normalizeLocale(preference.locale || navigator.language);
    const definition = SUPPORTED_LOCALES.find((entry) => entry.id === locale) || SUPPORTED_LOCALES[0];
    return { locale, direction: definition.direction, interfaceAvailable: definition.interfaceAvailable };
}

export function updateLocalePreference(locale) {
    const preference = { locale: normalizeLocale(locale), updatedAt: new Date().toISOString() };
    localStorage.setItem(LOCALE_PREFERENCE_KEY, JSON.stringify(preference));
    applyLocalePreference();
    window.dispatchEvent(new CustomEvent('art-locale-preference-updated', { detail: getLocalePreference() }));
    return getLocalePreference();
}

export function formatLocalizedDate(value, options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(getLocalePreference().locale, options).format(date);
}

export function formatLocalizedNumber(value, options = {}) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return new Intl.NumberFormat(getLocalePreference().locale, options).format(number);
}

export function applyLocalePreference() {
    const preference = getLocalePreference();
    document.documentElement.lang = preference.locale;
    document.documentElement.dir = preference.direction;
    document.documentElement.dataset.artInterfaceLanguage = preference.interfaceAvailable ? preference.locale : 'en-US';
    return preference;
}

export function initializeInternationalizationFramework() {
    applyLocalePreference();
    return true;
}
