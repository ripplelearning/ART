// navigation.js
import { renderBuilder } from './reportBuilder.js';
import { renderEditor } from './reportEditor.js';
import { renderWelcome } from './welcome.js';

const landmarks = ['nav', 'dashboard', 'main-content', 'lookup-tool'];
const renderMap = {
    'tab-welcome': renderWelcome,
    'tab-builder': renderBuilder,
    'tab-editor': renderEditor
};

export function initNavigation() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            navigateLandmarks(direction);
        }
    });
}

export function initNavListener() {
    initNavigation();
}

export function setupTabs() {
    const tabs = document.querySelectorAll('#top-tabs button[role="tab"]');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((btn) => btn.setAttribute('aria-selected', 'false'));
            tab.setAttribute('aria-selected', 'true');

            const renderFn = renderMap[tab.id];
            if (renderFn) {
                renderFn();
            }
        });
    });
}

function navigateLandmarks(direction) {
    const activeEl = document.activeElement;
    let currentIndex = landmarks.findIndex(id => activeEl.closest(`#${id}`));

    if (currentIndex === -1) currentIndex = 0;

    let nextIndex = currentIndex + direction;
    if (nextIndex >= landmarks.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = landmarks.length - 1;

    const targetId = landmarks[nextIndex];
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
        if (!targetElement.hasAttribute('tabindex')) {
            targetElement.setAttribute('tabindex', '-1');
        }
        targetElement.focus();
    }
}
