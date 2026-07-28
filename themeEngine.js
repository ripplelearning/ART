import { getVisualAccessibilityConfig } from './state.js';

let themeEngineInitialized = false;
let systemThemeMediaQuery = null;
let systemThemeListener = null;

function getResolvedTheme(config) {
    if (config.theme !== 'system' || typeof window.matchMedia !== 'function') {
        return config.theme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeVariables(config) {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    const resolvedTheme = getResolvedTheme(config);
    const palette = {
        light: {
            '--art-page-background': '#f4f7fb',
            '--art-surface-background': '#ffffff',
            '--art-surface-alt-background': '#f8fafc',
            '--art-text-color': '#10212b',
            '--art-muted-text-color': '#44515d',
            '--art-border-color': '#c7d1db',
            '--art-focus-color': '#005a9c',
            '--art-accent-color': '#0d6efd',
            '--art-button-background': '#f7fafc',
            '--art-button-text': '#10212b',
            '--art-input-background': '#ffffff',
            '--art-input-text': '#10212b'
        },
        dark: {
            '--art-page-background': '#101820',
            '--art-surface-background': '#1a2430',
            '--art-surface-alt-background': '#202d3b',
            '--art-text-color': '#eef4f8',
            '--art-muted-text-color': '#b4c3cf',
            '--art-border-color': '#506070',
            '--art-focus-color': '#7cc4ff',
            '--art-accent-color': '#7cc4ff',
            '--art-button-background': '#253240',
            '--art-button-text': '#eef4f8',
            '--art-input-background': '#121a23',
            '--art-input-text': '#eef4f8'
        },
        'high-contrast-light': {
            '--art-page-background': '#ffffff',
            '--art-surface-background': '#ffffff',
            '--art-surface-alt-background': '#ffffff',
            '--art-text-color': '#000000',
            '--art-muted-text-color': '#000000',
            '--art-border-color': '#000000',
            '--art-focus-color': '#0000ff',
            '--art-accent-color': '#0000ff',
            '--art-button-background': '#ffffff',
            '--art-button-text': '#000000',
            '--art-input-background': '#ffffff',
            '--art-input-text': '#000000'
        },
        'high-contrast-dark': {
            '--art-page-background': '#000000',
            '--art-surface-background': '#000000',
            '--art-surface-alt-background': '#000000',
            '--art-text-color': '#ffffff',
            '--art-muted-text-color': '#ffffff',
            '--art-border-color': '#ffffff',
            '--art-focus-color': '#ffff00',
            '--art-accent-color': '#ffff00',
            '--art-button-background': '#000000',
            '--art-button-text': '#ffffff',
            '--art-input-background': '#000000',
            '--art-input-text': '#ffffff'
        }
    };

    const themePalette = palette[resolvedTheme] || palette.light;
    Object.entries(themePalette).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    root.style.setProperty('--art-ui-font-scale', String(config.fontSize / 100));
    root.style.setProperty('--art-ui-zoom', String(config.zoom / 100));
    root.style.setProperty('--art-ui-density-multiplier', config.density === 'compact' ? '0.82' : config.density === 'comfortable' ? '1.08' : '1');
    root.style.setProperty('--art-focus-outline-width', config.enhancedFocusIndicators ? '4px' : '3px');
    root.style.setProperty('--art-border-width', config.borderVisibility ? '2px' : '1px');

    body.dataset.artTheme = resolvedTheme;
    body.dataset.artThemeSetting = config.theme;
    body.dataset.artDensity = config.density;
    body.dataset.artReducedMotion = String(Boolean(config.reducedMotion));
    body.dataset.artEnhancedFocus = String(Boolean(config.enhancedFocusIndicators));
    body.dataset.artBorderVisibility = config.borderVisibility ? 'enhanced' : 'standard';
    body.style.fontSize = `calc(16px * ${config.fontSize / 100})`;
    body.style.zoom = String(config.zoom / 100);
}

function syncTheme() {
    applyThemeVariables(getVisualAccessibilityConfig());
}

function bindSystemThemeListener() {
    if (typeof window.matchMedia !== 'function') return;

    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeListener = () => {
        if (getVisualAccessibilityConfig().theme === 'system') {
            syncTheme();
        }
    };

    if (typeof systemThemeMediaQuery.addEventListener === 'function') {
        systemThemeMediaQuery.addEventListener('change', systemThemeListener);
    } else if (typeof systemThemeMediaQuery.addListener === 'function') {
        systemThemeMediaQuery.addListener(systemThemeListener);
    }
}

export function initThemeEngine() {
    if (themeEngineInitialized) return true;
    themeEngineInitialized = true;

    syncTheme();
    window.addEventListener('art-visual-accessibility-updated', syncTheme);
    window.addEventListener('art-state-restored', syncTheme);
    window.addEventListener('art-state-updated', syncTheme);
    bindSystemThemeListener();

    return true;
}
