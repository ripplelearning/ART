const DEFAULT_LAYOUT = {
    leftColumn: 20,
    mainColumn: 50,
    lookupColumn: 30,
    selectorHeight: 30
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function setLayoutVariables(container, layout) {
    container.style.setProperty('--left-column-width', `${layout.leftColumn}fr`);
    container.style.setProperty('--main-column-width', `${layout.mainColumn}fr`);
    container.style.setProperty('--lookup-column-width', `${layout.lookupColumn}fr`);
    container.style.setProperty('--selector-row-height', `${layout.selectorHeight}%`);
}

function createSplitter(className, orientation) {
    const splitter = document.createElement('div');
    splitter.className = className;
    splitter.setAttribute('aria-hidden', 'true');
    splitter.setAttribute('tabindex', '-1');
    splitter.dataset.orientation = orientation;
    return splitter;
}

function wrapIntoColumns(container, nav, dashboard, main, lookup) {
    const leftColumn = document.createElement('div');
    leftColumn.id = 'left-column';
    leftColumn.className = 'layout-column layout-column-left';

    const mainColumn = document.createElement('div');
    mainColumn.id = 'main-column';
    mainColumn.className = 'layout-column layout-column-main';

    const lookupColumn = document.createElement('div');
    lookupColumn.id = 'lookup-column';
    lookupColumn.className = 'layout-column layout-column-lookup';

    const splitterOne = createSplitter('layout-splitter layout-splitter-vertical', 'vertical');
    const splitterTwo = createSplitter('layout-splitter layout-splitter-vertical', 'vertical');
    const rowSplitter = createSplitter('layout-splitter layout-splitter-horizontal', 'horizontal');

    container.insertBefore(leftColumn, nav);
    container.insertBefore(splitterOne, main);
    container.insertBefore(mainColumn, main);
    container.insertBefore(splitterTwo, lookup);
    container.insertBefore(lookupColumn, lookup);

    leftColumn.append(nav);
    leftColumn.append(rowSplitter);
    leftColumn.append(dashboard);
    mainColumn.append(main);
    lookupColumn.append(lookup);

    return { leftColumn, mainColumn, lookupColumn, splitterOne, splitterTwo, rowSplitter };
}

function getNumericStyleValue(element, property, fallback) {
    const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
    return Number.isFinite(value) ? value : fallback;
}

function attachVerticalResize(splitter, container, leftColumn, mainColumn, lookupColumn, isLeftSplit) {
    splitter.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const startX = event.clientX;
        const containerWidth = container.getBoundingClientRect().width;
        const startLeft = getNumericStyleValue(container, '--left-column-width', DEFAULT_LAYOUT.leftColumn);
        const startMain = getNumericStyleValue(container, '--main-column-width', DEFAULT_LAYOUT.mainColumn);
        const startLookup = getNumericStyleValue(container, '--lookup-column-width', DEFAULT_LAYOUT.lookupColumn);

        splitter.setPointerCapture(event.pointerId);

        const moveHandler = (moveEvent) => {
            const delta = ((moveEvent.clientX - startX) / Math.max(containerWidth, 1)) * 100;
            const minColumn = 14;

            if (isLeftSplit) {
                const newLeft = clamp(startLeft + delta, minColumn, startLeft + startMain - minColumn);
                const newMain = clamp(startLeft + startMain - newLeft, minColumn, startMain + startLeft - minColumn);
                const newLookup = Math.max(minColumn, startLookup);
                setLayoutVariables(container, {
                    leftColumn: newLeft,
                    mainColumn: newMain,
                    lookupColumn: newLookup,
                    selectorHeight: getNumericStyleValue(container, '--selector-row-height', DEFAULT_LAYOUT.selectorHeight)
                });
                return;
            }

            const newLookup = clamp(startLookup - delta, minColumn, startMain + startLookup - minColumn);
            const newMain = clamp(startMain + startLookup - newLookup, minColumn, startMain + startLookup - minColumn);
            const newLeft = Math.max(minColumn, startLeft);
            setLayoutVariables(container, {
                leftColumn: newLeft,
                mainColumn: newMain,
                lookupColumn: newLookup,
                selectorHeight: getNumericStyleValue(container, '--selector-row-height', DEFAULT_LAYOUT.selectorHeight)
            });
        };

        const upHandler = () => {
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
        };

        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler, { once: true });
    });
}

function attachHorizontalResize(splitter, container) {
    const leftColumn = document.getElementById('left-column');
    const nav = document.getElementById('nav');
    const dashboard = document.getElementById('dashboard');
    if (!leftColumn || !nav || !dashboard) return;

    splitter.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const startY = event.clientY;
        const columnHeight = leftColumn.getBoundingClientRect().height;
        const startSelector = getNumericStyleValue(container, '--selector-row-height', DEFAULT_LAYOUT.selectorHeight);

        splitter.setPointerCapture(event.pointerId);

        const moveHandler = (moveEvent) => {
            const delta = ((moveEvent.clientY - startY) / Math.max(columnHeight, 1)) * 100;
            const minRow = 12;
            const maxRow = 88;
            const newSelector = clamp(startSelector + delta, minRow, maxRow);
            setLayoutVariables(container, {
                leftColumn: getNumericStyleValue(container, '--left-column-width', DEFAULT_LAYOUT.leftColumn),
                mainColumn: getNumericStyleValue(container, '--main-column-width', DEFAULT_LAYOUT.mainColumn),
                lookupColumn: getNumericStyleValue(container, '--lookup-column-width', DEFAULT_LAYOUT.lookupColumn),
                selectorHeight: newSelector
            });
        };

        const upHandler = () => {
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
        };

        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler, { once: true });
    });
}

export function initResizableLayout() {
    const container = document.querySelector('.app-container');
    const nav = document.getElementById('nav');
    const dashboard = document.getElementById('dashboard');
    const main = document.getElementById('main-content');
    const lookup = document.getElementById('lookup-tool');

    if (!container || !nav || !dashboard || !main || !lookup) return;
    if (document.getElementById('left-column')) return;

    const { splitterOne, splitterTwo, rowSplitter } = wrapIntoColumns(container, nav, dashboard, main, lookup);
    container.dataset.layout = 'resizable';

    setLayoutVariables(container, DEFAULT_LAYOUT);
    attachVerticalResize(splitterOne, container, document.getElementById('left-column'), document.getElementById('main-column'), document.getElementById('lookup-column'), true);
    attachVerticalResize(splitterTwo, container, document.getElementById('left-column'), document.getElementById('main-column'), document.getElementById('lookup-column'), false);
    attachHorizontalResize(rowSplitter, container);
}