import { runUniversalSearch } from './universalSearchFramework.js';

const DEFAULT_WIDGET_IDS = [
    'quick-actions',
    'continue-working',
    'current-project',
    'current-report',
    'report-metrics',
    'recent-activity',
    'notifications',
    'dashboard-search'
];

const DEFAULT_TAB_DEFINITIONS = [
    { id: 'workspace', name: 'Workspace', widgetIds: ['quick-actions', 'continue-working', 'recent-activity', 'notifications', 'dashboard-search'] },
    { id: 'projects', name: 'Projects', widgetIds: ['current-project'] },
    { id: 'reports', name: 'Reports', widgetIds: ['current-report', 'report-metrics'] },
    { id: 'analytics', name: 'Analytics', widgetIds: ['recent-activity'] }
];

const DEFAULT_LAYOUT = 'cards';
const LAYOUT_OPTIONS = ['cards', 'tabs', 'compact'];

const registry = new Map();
let runtime = null;
let configDialogState = null;

function normalizeText(value) {
    return String(value || '').trim();
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function ensureUnique(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter((value) => {
        const key = String(value || '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getRegisteredWidgetIds() {
    return [...registry.keys()];
}

function normalizeCustomWidget(item, fallbackOrder = 1000) {
    const id = normalizeText(item?.id) || createId('custom-widget');
    const heading = normalizeText(item?.heading || item?.name) || 'Custom Widget';
    return {
        id,
        kind: 'custom',
        name: normalizeText(item?.name) || heading,
        heading,
        regionLabel: normalizeText(item?.regionLabel) || `${heading} widget`,
        description: normalizeText(item?.description),
        category: normalizeText(item?.category) || 'Custom',
        priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : fallbackOrder,
        refreshPolicy: normalizeText(item?.refreshPolicy) || 'manual',
        helpTopic: normalizeText(item?.helpTopic),
        minimumVersion: normalizeText(item?.minimumVersion) || '2.0',
        markdown: String(item?.markdown || ''),
        commandAction: normalizeText(item?.commandAction),
        linkUrl: normalizeText(item?.linkUrl),
        linkText: normalizeText(item?.linkText) || 'Open link'
    };
}

function normalizeTabs(tabs, availableWidgetIds) {
    const fallback = clone(DEFAULT_TAB_DEFINITIONS);
    const source = Array.isArray(tabs) && tabs.length > 0 ? tabs : fallback;

    const normalized = source.map((tab, index) => {
        const id = normalizeText(tab?.id) || `tab-${index + 1}`;
        const name = normalizeText(tab?.name) || `Tab ${index + 1}`;
        const widgetIds = ensureUnique(tab?.widgetIds).filter((widgetId) => availableWidgetIds.includes(widgetId));
        return { id, name, widgetIds };
    });

    if (normalized.length === 0) {
        return clone(DEFAULT_TAB_DEFINITIONS);
    }

    return normalized;
}

function normalizeDashboardConfig(rawConfig, widgetIds) {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const allWidgetIds = ensureUnique([...DEFAULT_WIDGET_IDS, ...widgetIds]);

    const layout = LAYOUT_OPTIONS.includes(source.layout) ? source.layout : DEFAULT_LAYOUT;
    const visibleWidgetIds = ensureUnique(source.visibleWidgetIds).filter((id) => allWidgetIds.includes(id));
    const widgetOrder = ensureUnique(source.widgetOrder).filter((id) => allWidgetIds.includes(id));
    const collapsedWidgets = source.collapsedWidgets && typeof source.collapsedWidgets === 'object'
        ? source.collapsedWidgets
        : {};

    const customWidgets = ensureUnique((source.customWidgets || []).map((item) => normalizeCustomWidget(item).id));
    const customWidgetObjects = (Array.isArray(source.customWidgets) ? source.customWidgets : [])
        .map((item, index) => normalizeCustomWidget(item, 5000 + index));

    const finalizedOrder = ensureUnique([
        ...widgetOrder,
        ...allWidgetIds,
        ...customWidgets
    ]);

    const finalizedVisible = ensureUnique(
        visibleWidgetIds.length > 0
            ? visibleWidgetIds
            : [...DEFAULT_WIDGET_IDS, ...customWidgets]
    ).filter((id) => finalizedOrder.includes(id));

    const tabs = normalizeTabs(source.tabs, finalizedOrder);

    return {
        layout,
        widgetOrder: finalizedOrder,
        visibleWidgetIds: finalizedVisible,
        collapsedWidgets: Object.fromEntries(
            Object.entries(collapsedWidgets).map(([key, value]) => [String(key), Boolean(value)])
        ),
        tabs,
        customWidgets: customWidgetObjects
    };
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function markdownToHtml(markdown) {
    const escaped = escapeHtml(markdown || '');
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, '<br>');
}

function getContext() {
    return typeof runtime?.getContext === 'function' ? runtime.getContext() : {};
}

function persistConfig(nextConfig, action = 'Updated dashboard configuration') {
    if (!runtime || typeof runtime.persistConfig !== 'function') return;
    runtime.persistConfig(nextConfig, action);
}

function loadConfig() {
    const raw = runtime && typeof runtime.loadConfig === 'function' ? runtime.loadConfig() : {};
    const widgetIds = getRegisteredWidgetIds();
    return normalizeDashboardConfig(raw, widgetIds);
}

function getWidgetById(widgetId) {
    if (registry.has(widgetId)) return registry.get(widgetId);
    const config = loadConfig();
    return config.customWidgets.find((item) => item.id === widgetId) || null;
}

function resolveAllWidgets(config) {
    const builtInWidgets = [...registry.values()];
    const customWidgets = (config.customWidgets || []).map((item) => ({
        ...item,
        isCustomWidget: true,
        visibility: () => ({ visible: true })
    }));

    const widgetsById = new Map();
    [...builtInWidgets, ...customWidgets].forEach((widget, index) => {
        const id = normalizeText(widget.id);
        if (!id) return;
        widgetsById.set(id, {
            ...widget,
            id,
            priority: Number.isFinite(Number(widget.priority)) ? Number(widget.priority) : index
        });
    });

    const orderedIds = ensureUnique([...(config.widgetOrder || []), ...widgetsById.keys()]);
    return orderedIds
        .map((id) => widgetsById.get(id))
        .filter(Boolean);
}

function announce(message) {
    if (typeof runtime?.announce === 'function') {
        runtime.announce(message);
    }
}

function getWidgetVisibility(widget, context) {
    if (typeof widget.visibility !== 'function') {
        return { visible: true, message: '' };
    }

    try {
        const result = widget.visibility(context);
        if (typeof result === 'boolean') {
            return { visible: result, message: result ? '' : 'Not currently available.' };
        }
        return {
            visible: result?.visible !== false,
            message: normalizeText(result?.message)
        };
    } catch (error) {
        return { visible: false, message: 'Widget failed to evaluate availability.' };
    }
}

function createWidgetHeadingButton(widget, widgetBodyId, isCollapsed, config) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dashboard-widget__toggle';
    button.id = `dashboard-widget-toggle-${widget.id}`;
    button.setAttribute('aria-controls', widgetBodyId);
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.textContent = normalizeText(widget.heading || widget.name || widget.id);

    button.addEventListener('click', () => {
        const nextConfig = clone(config);
        nextConfig.collapsedWidgets = {
            ...(nextConfig.collapsedWidgets || {}),
            [widget.id]: !Boolean(nextConfig.collapsedWidgets?.[widget.id])
        };
        persistConfig(nextConfig, `Toggled dashboard widget ${widget.heading || widget.name || widget.id}`);
        renderDashboard();
        announce(`${widget.heading || widget.name || widget.id} ${nextConfig.collapsedWidgets[widget.id] ? 'collapsed' : 'expanded'}.`);
    });

    button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        button.click();
    });

    return button;
}

function renderCustomWidgetBody(widget, body) {
    const markdown = String(widget.markdown || '').trim();
    const description = normalizeText(widget.description);

    const parts = [];
    if (description) {
        parts.push(`<p>${escapeHtml(description)}</p>`);
    }
    if (markdown) {
        parts.push(`<div class="dashboard-widget__markdown">${markdownToHtml(markdown)}</div>`);
    }

    if (widget.linkUrl) {
        const safeText = escapeHtml(widget.linkText || 'Open link');
        const safeUrl = escapeHtml(widget.linkUrl);
        parts.push(`<p><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a></p>`);
    }

    if (widget.commandAction) {
        const commandId = `dashboard-custom-command-${widget.id}`;
        parts.push(`<button id="${commandId}" type="button">Run Command: ${escapeHtml(widget.commandAction)}</button>`);
        body.innerHTML = parts.join('');
        const button = body.querySelector(`#${commandId}`);
        button?.addEventListener('click', () => {
            if (typeof runtime?.executeAction === 'function') {
                runtime.executeAction(widget.commandAction, { source: 'dashboard-widget', widgetId: widget.id });
            }
        });
        return;
    }

    body.innerHTML = parts.join('') || '<p>No custom widget content configured.</p>';
}

function renderWidgetContent(widget, body, context, visibility) {
    body.innerHTML = '';

    if (!visibility.visible) {
        if (widget.hideWhenUnavailable === true) {
            body.hidden = true;
            return;
        }
        const message = document.createElement('p');
        message.className = 'dashboard-widget__status';
        message.textContent = visibility.message || 'No data is currently available.';
        body.appendChild(message);
        return;
    }

    if (widget.isCustomWidget) {
        renderCustomWidgetBody(widget, body);
        return;
    }

    if (typeof widget.render === 'function') {
        widget.render(body, context);
        return;
    }

    if (typeof widget.resolveElement === 'function') {
        let element = runtime?.widgetSourceElements?.get(widget.id) || null;
        if (!element) {
            element = widget.resolveElement();
            if (element && runtime?.widgetSourceElements) {
                runtime.widgetSourceElements.set(widget.id, element);
            }
        }
        if (element) {
            element.hidden = false;
            body.appendChild(element);
            return;
        }
    }

    const fallback = document.createElement('p');
    fallback.className = 'dashboard-widget__status';
    fallback.textContent = 'Widget is registered but did not render content.';
    body.appendChild(fallback);
}

function buildWidgetSection(widget, config) {
    const section = document.createElement('section');
    section.className = 'dashboard-widget';
    section.dataset.widgetId = widget.id;
    section.setAttribute('role', 'region');

    const headingId = `dashboard-widget-heading-${widget.id}`;
    const bodyId = `dashboard-widget-body-${widget.id}`;
    section.setAttribute('aria-labelledby', headingId);
    section.setAttribute('aria-label', normalizeText(widget.regionLabel || widget.heading || widget.name || widget.id));

    const heading = document.createElement('h3');
    heading.className = 'dashboard-widget__heading';

    const isCollapsed = Boolean(config.collapsedWidgets?.[widget.id]);
    const toggle = createWidgetHeadingButton(widget, bodyId, isCollapsed, config);
    toggle.id = headingId;
    heading.appendChild(toggle);

    const body = document.createElement('div');
    body.id = bodyId;
    body.className = 'dashboard-widget__body';
    body.hidden = isCollapsed;

    const context = getContext();
    const visibility = getWidgetVisibility(widget, context);
    renderWidgetContent(widget, body, context, visibility);

    section.append(heading, body);
    return section;
}

function assignWidgetsToTabs(widgets, config) {
    const assignment = new Map();
    (config.tabs || []).forEach((tab) => {
        (tab.widgetIds || []).forEach((widgetId) => {
            assignment.set(widgetId, tab.id);
        });
    });

    const fallbackTabId = config.tabs?.[0]?.id || 'workspace';
    return widgets.map((widget) => ({
        widget,
        tabId: assignment.get(widget.id) || fallbackTabId
    }));
}

function renderCardsLayout(root, widgets, config, compact = false) {
    const deck = document.createElement('div');
    deck.className = compact ? 'dashboard-widget-deck dashboard-widget-deck--compact' : 'dashboard-widget-deck';
    widgets.forEach((widget) => {
        deck.appendChild(buildWidgetSection(widget, config));
    });
    root.appendChild(deck);
}

function activateTab(tablist, panelMap, targetId, shouldFocus = true) {
    const buttons = Array.from(tablist.querySelectorAll('[role="tab"]'));
    buttons.forEach((button) => {
        const selected = button.dataset.tabId === targetId;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const panel = panelMap.get(button.dataset.tabId);
        if (panel) panel.hidden = !selected;
        if (selected && shouldFocus) button.focus();
    });
}

function renderTabsLayout(root, widgets, config) {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'dashboard-widget-tabs';

    const tablist = document.createElement('div');
    tablist.className = 'dashboard-widget-tabs__tablist';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Dashboard widget tabs');

    const panelWrap = document.createElement('div');
    panelWrap.className = 'dashboard-widget-tabs__panels';

    const assignments = assignWidgetsToTabs(widgets, config);
    const panelMap = new Map();

    config.tabs.forEach((tab, index) => {
        const tabButton = document.createElement('button');
        tabButton.type = 'button';
        tabButton.className = 'dashboard-widget-tabs__tab';
        tabButton.setAttribute('role', 'tab');
        tabButton.dataset.tabId = tab.id;
        tabButton.id = `dashboard-tab-${tab.id}`;
        tabButton.setAttribute('aria-controls', `dashboard-tab-panel-${tab.id}`);
        tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tabButton.tabIndex = index === 0 ? 0 : -1;
        tabButton.textContent = tab.name;

        tabButton.addEventListener('click', () => activateTab(tablist, panelMap, tab.id, false));

        tabButton.addEventListener('keydown', (event) => {
            const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
            const currentIndex = tabs.indexOf(tabButton);
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                const next = tabs[(currentIndex + 1) % tabs.length];
                activateTab(tablist, panelMap, next.dataset.tabId, true);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const previous = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                activateTab(tablist, panelMap, previous.dataset.tabId, true);
            } else if (event.key === 'Home') {
                event.preventDefault();
                activateTab(tablist, panelMap, tabs[0].dataset.tabId, true);
            } else if (event.key === 'End') {
                event.preventDefault();
                activateTab(tablist, panelMap, tabs[tabs.length - 1].dataset.tabId, true);
            }
        });

        tablist.appendChild(tabButton);

        const panel = document.createElement('div');
        panel.className = 'dashboard-widget-tabs__panel';
        panel.setAttribute('role', 'tabpanel');
        panel.id = `dashboard-tab-panel-${tab.id}`;
        panel.setAttribute('aria-labelledby', tabButton.id);
        panel.hidden = index !== 0;
        panelMap.set(tab.id, panel);
        panelWrap.appendChild(panel);
    });

    assignments.forEach(({ widget, tabId }) => {
        const panel = panelMap.get(tabId) || panelMap.get(config.tabs[0].id);
        if (!panel) return;
        panel.appendChild(buildWidgetSection(widget, config));
    });

    tabsContainer.append(tablist, panelWrap);
    root.appendChild(tabsContainer);
}

function getVisibleWidgets(config) {
    const allWidgets = resolveAllWidgets(config);
    const visibleSet = new Set(config.visibleWidgetIds || []);
    return allWidgets.filter((widget) => visibleSet.has(widget.id));
}

function renderDashboard() {
    if (!runtime?.layoutRoot) return;
    const config = loadConfig();
    runtime.layoutRoot.innerHTML = '';

    const visibleWidgets = getVisibleWidgets(config);
    if (visibleWidgets.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dashboard-widget__status';
        empty.textContent = 'No dashboard widgets are visible. Use Configure Dashboard to show widgets.';
        runtime.layoutRoot.appendChild(empty);
        return;
    }

    if (config.layout === 'tabs') {
        renderTabsLayout(runtime.layoutRoot, visibleWidgets, config);
        return;
    }

    if (config.layout === 'compact') {
        renderCardsLayout(runtime.layoutRoot, visibleWidgets, config, true);
        return;
    }

    renderCardsLayout(runtime.layoutRoot, visibleWidgets, config, false);
}

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function ensureDialog() {
    if (!runtime?.dashboardElement) return null;
    let dialog = document.getElementById('dashboard-config-dialog');
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'dashboard-config-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'dashboard-config-heading');
    dialog.hidden = true;
    dialog.innerHTML = `
        <div class="dashboard-config-header">
            <h3 id="dashboard-config-heading">Configure Dashboard</h3>
            <button type="button" data-role="close">Close</button>
        </div>
        <p id="dashboard-config-description">Choose layout, show or hide widgets, reorder widgets, assign widgets to tabs, and manage custom widgets.</p>
        <label for="dashboard-config-layout">Dashboard Layout</label>
        <select id="dashboard-config-layout" data-role="layout">
            <option value="cards">Dashboard Cards</option>
            <option value="tabs">Dashboard Tabs</option>
            <option value="compact">Compact Dashboard</option>
        </select>

        <section>
            <h4>Widgets</h4>
            <div class="dashboard-config-widget-list" data-role="widget-list"></div>
        </section>

        <section>
            <h4>Tabs</h4>
            <div class="dashboard-config-tabs-list" data-role="tabs-list"></div>
            <div class="viewer-dialog-actions">
                <button type="button" data-role="add-tab">Add Tab</button>
            </div>
        </section>

        <section>
            <h4>Custom Widgets</h4>
            <div class="dashboard-config-custom-form">
                <label>Heading<input type="text" data-role="custom-heading"></label>
                <label>Description<input type="text" data-role="custom-description"></label>
                <label>Markdown<textarea rows="5" data-role="custom-markdown"></textarea></label>
                <label>Command Action<input type="text" data-role="custom-command" placeholder="Example: openHelp"></label>
                <label>Link URL<input type="url" data-role="custom-link-url" placeholder="https://example.com"></label>
                <label>Link Text<input type="text" data-role="custom-link-text" placeholder="Open link"></label>
                <div class="viewer-dialog-actions">
                    <button type="button" data-role="custom-add">Create Custom Widget</button>
                </div>
            </div>
            <div class="dashboard-config-custom-list" data-role="custom-list"></div>
            <input type="file" data-role="custom-import-file" accept=".json,application/json" hidden>
            <div class="viewer-dialog-actions">
                <button type="button" data-role="custom-import">Import Custom Widgets</button>
                <button type="button" data-role="custom-export">Export Custom Widgets</button>
            </div>
        </section>

        <div class="viewer-dialog-actions">
            <button type="button" data-role="restore-defaults">Restore Defaults</button>
            <button type="button" data-role="done">Done</button>
        </div>
        <p class="open-report-status" role="status" aria-live="polite" data-role="status"></p>
    `;

    runtime.dashboardElement.appendChild(dialog);
    return dialog;
}

function updateStatus(text) {
    const status = configDialogState?.dialog?.querySelector('[data-role="status"]');
    if (status) status.textContent = text;
    if (text) announce(text);
}

function reassignWidgetToTab(config, widgetId, tabId) {
    config.tabs = (config.tabs || []).map((tab) => ({
        ...tab,
        widgetIds: (tab.widgetIds || []).filter((id) => id !== widgetId)
    }));
    const target = config.tabs.find((tab) => tab.id === tabId) || config.tabs[0];
    if (!target) return;
    target.widgetIds = ensureUnique([...(target.widgetIds || []), widgetId]);
}

function persistDialogConfig(actionText) {
    const normalized = normalizeDashboardConfig(configDialogState.workingConfig, getRegisteredWidgetIds());
    configDialogState.workingConfig = normalized;
    persistConfig(normalized, actionText || 'Updated dashboard configuration');
    renderDashboard();
    populateDialog();
}

function buildWidgetRows(config) {
    const widgetList = configDialogState.dialog.querySelector('[data-role="widget-list"]');
    widgetList.innerHTML = '';

    const widgets = resolveAllWidgets(config);

    widgets.forEach((widget, index) => {
        const row = document.createElement('div');
        row.className = 'dashboard-config-widget-row';

        const visibleLabel = document.createElement('label');
        visibleLabel.className = 'dashboard-config-widget-visible';
        const visibleInput = document.createElement('input');
        visibleInput.type = 'checkbox';
        visibleInput.checked = config.visibleWidgetIds.includes(widget.id);
        visibleInput.addEventListener('change', () => {
            if (visibleInput.checked) {
                config.visibleWidgetIds = ensureUnique([...config.visibleWidgetIds, widget.id]);
            } else {
                config.visibleWidgetIds = config.visibleWidgetIds.filter((id) => id !== widget.id);
            }
            persistDialogConfig(`Updated widget visibility for ${widget.heading || widget.name}`);
        });
        visibleLabel.append(visibleInput, document.createTextNode(` ${widget.heading || widget.name}`));

        const category = document.createElement('span');
        category.className = 'dashboard-config-widget-category';
        category.textContent = widget.category || 'General';

        const tabSelect = document.createElement('select');
        tabSelect.setAttribute('aria-label', `Dashboard tab for ${widget.heading || widget.name}`);
        (config.tabs || []).forEach((tab) => {
            const option = document.createElement('option');
            option.value = tab.id;
            option.textContent = tab.name;
            tabSelect.appendChild(option);
        });
        const assignedTab = (config.tabs || []).find((tab) => (tab.widgetIds || []).includes(widget.id));
        tabSelect.value = assignedTab?.id || config.tabs?.[0]?.id || '';
        tabSelect.addEventListener('change', () => {
            reassignWidgetToTab(config, widget.id, tabSelect.value);
            persistDialogConfig(`Updated tab assignment for ${widget.heading || widget.name}`);
        });

        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'Up';
        up.disabled = index === 0;
        up.addEventListener('click', () => {
            const order = [...config.widgetOrder];
            const current = order.indexOf(widget.id);
            if (current <= 0) return;
            const previous = order[current - 1];
            order[current - 1] = order[current];
            order[current] = previous;
            config.widgetOrder = order;
            persistDialogConfig(`Moved widget ${widget.heading || widget.name} up`);
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.textContent = 'Down';
        down.disabled = index === widgets.length - 1;
        down.addEventListener('click', () => {
            const order = [...config.widgetOrder];
            const current = order.indexOf(widget.id);
            if (current < 0 || current >= order.length - 1) return;
            const next = order[current + 1];
            order[current + 1] = order[current];
            order[current] = next;
            config.widgetOrder = order;
            persistDialogConfig(`Moved widget ${widget.heading || widget.name} down`);
        });

        const controls = document.createElement('div');
        controls.className = 'dashboard-config-widget-controls';
        controls.append(tabSelect, up, down);

        row.append(visibleLabel, category, controls);
        widgetList.appendChild(row);
    });
}

function buildTabsRows(config) {
    const tabsList = configDialogState.dialog.querySelector('[data-role="tabs-list"]');
    tabsList.innerHTML = '';

    config.tabs.forEach((tab, index) => {
        const row = document.createElement('div');
        row.className = 'dashboard-config-tab-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = tab.name;
        nameInput.setAttribute('aria-label', `Dashboard tab name ${index + 1}`);
        nameInput.addEventListener('change', () => {
            tab.name = normalizeText(nameInput.value) || `Tab ${index + 1}`;
            persistDialogConfig(`Renamed dashboard tab to ${tab.name}`);
        });

        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'Up';
        up.disabled = index === 0;
        up.addEventListener('click', () => {
            const tabs = [...config.tabs];
            [tabs[index - 1], tabs[index]] = [tabs[index], tabs[index - 1]];
            config.tabs = tabs;
            persistDialogConfig('Reordered dashboard tabs');
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.textContent = 'Down';
        down.disabled = index === config.tabs.length - 1;
        down.addEventListener('click', () => {
            const tabs = [...config.tabs];
            [tabs[index + 1], tabs[index]] = [tabs[index], tabs[index + 1]];
            config.tabs = tabs;
            persistDialogConfig('Reordered dashboard tabs');
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.disabled = config.tabs.length <= 1;
        remove.addEventListener('click', () => {
            const removed = config.tabs.splice(index, 1)[0];
            if (!removed) return;
            const fallback = config.tabs[0];
            if (fallback) {
                fallback.widgetIds = ensureUnique([...(fallback.widgetIds || []), ...(removed.widgetIds || [])]);
            }
            persistDialogConfig(`Removed dashboard tab ${removed.name}`);
        });

        row.append(nameInput, up, down, remove);
        tabsList.appendChild(row);
    });
}

function buildCustomRows(config) {
    const customList = configDialogState.dialog.querySelector('[data-role="custom-list"]');
    customList.innerHTML = '';

    const customWidgets = config.customWidgets || [];
    if (customWidgets.length === 0) {
        customList.innerHTML = '<p>No custom widgets created yet.</p>';
        return;
    }

    customWidgets.forEach((widget) => {
        const row = document.createElement('div');
        row.className = 'dashboard-config-custom-row';

        const label = document.createElement('strong');
        label.textContent = widget.heading;

        const details = document.createElement('span');
        details.textContent = widget.description || 'No description';

        const duplicateButton = document.createElement('button');
        duplicateButton.type = 'button';
        duplicateButton.textContent = 'Duplicate';
        duplicateButton.addEventListener('click', () => {
            const duplicate = normalizeCustomWidget({
                ...widget,
                id: createId('custom-widget'),
                name: `${widget.name} Copy`,
                heading: `${widget.heading} Copy`
            });
            config.customWidgets.push(duplicate);
            config.widgetOrder = ensureUnique([...config.widgetOrder, duplicate.id]);
            config.visibleWidgetIds = ensureUnique([...config.visibleWidgetIds, duplicate.id]);
            reassignWidgetToTab(config, duplicate.id, config.tabs[0]?.id);
            persistDialogConfig(`Duplicated custom widget ${widget.heading}`);
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            config.customWidgets = config.customWidgets.filter((item) => item.id !== widget.id);
            config.widgetOrder = config.widgetOrder.filter((id) => id !== widget.id);
            config.visibleWidgetIds = config.visibleWidgetIds.filter((id) => id !== widget.id);
            config.tabs = config.tabs.map((tab) => ({
                ...tab,
                widgetIds: (tab.widgetIds || []).filter((id) => id !== widget.id)
            }));
            persistDialogConfig(`Deleted custom widget ${widget.heading}`);
        });

        const controls = document.createElement('div');
        controls.className = 'dashboard-config-custom-controls';
        controls.append(duplicateButton, deleteButton);

        row.append(label, details, controls);
        customList.appendChild(row);
    });
}

function populateDialog() {
    if (!configDialogState?.dialog) return;
    const config = configDialogState.workingConfig;

    const layoutSelect = configDialogState.dialog.querySelector('[data-role="layout"]');
    layoutSelect.value = config.layout;

    buildWidgetRows(config);
    buildTabsRows(config);
    buildCustomRows(config);
}

function trapDialogFocus(event) {
    if (!configDialogState?.isOpen || !configDialogState.dialog || configDialogState.dialog.hidden) return;
    if (event.type === 'focusin') {
        if (!configDialogState.dialog.contains(event.target)) {
            const focusables = getFocusableElements(configDialogState.dialog);
            focusables[0]?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeConfigureDashboardDialog();
        return;
    }

    if (event.key !== 'Tab') return;

    const focusables = getFocusableElements(configDialogState.dialog);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function bindDialogActions() {
    const dialog = ensureDialog();
    if (!dialog) return;

    dialog.querySelector('[data-role="close"]')?.addEventListener('click', () => closeConfigureDashboardDialog());
    dialog.querySelector('[data-role="done"]')?.addEventListener('click', () => closeConfigureDashboardDialog());

    dialog.querySelector('[data-role="layout"]')?.addEventListener('change', (event) => {
        if (!configDialogState) return;
        configDialogState.workingConfig.layout = event.target.value;
        persistDialogConfig('Changed dashboard layout');
    });

    dialog.querySelector('[data-role="add-tab"]')?.addEventListener('click', () => {
        if (!configDialogState) return;
        const tab = { id: createId('dashboard-tab'), name: 'New Tab', widgetIds: [] };
        configDialogState.workingConfig.tabs.push(tab);
        persistDialogConfig('Added dashboard tab');
    });

    dialog.querySelector('[data-role="restore-defaults"]')?.addEventListener('click', () => {
        if (!configDialogState) return;
        configDialogState.workingConfig = normalizeDashboardConfig({}, getRegisteredWidgetIds());
        persistDialogConfig('Restored default dashboard configuration');
        updateStatus('Dashboard defaults restored.');
    });

    dialog.querySelector('[data-role="custom-add"]')?.addEventListener('click', () => {
        if (!configDialogState) return;
        const heading = normalizeText(dialog.querySelector('[data-role="custom-heading"]')?.value);
        const description = normalizeText(dialog.querySelector('[data-role="custom-description"]')?.value);
        const markdown = String(dialog.querySelector('[data-role="custom-markdown"]')?.value || '');
        const commandAction = normalizeText(dialog.querySelector('[data-role="custom-command"]')?.value);
        const linkUrl = normalizeText(dialog.querySelector('[data-role="custom-link-url"]')?.value);
        const linkText = normalizeText(dialog.querySelector('[data-role="custom-link-text"]')?.value);

        if (!heading) {
            updateStatus('Custom widget heading is required.');
            return;
        }

        const customWidget = normalizeCustomWidget({
            id: createId('custom-widget'),
            name: heading,
            heading,
            description,
            markdown,
            commandAction,
            linkUrl,
            linkText
        });

        configDialogState.workingConfig.customWidgets.push(customWidget);
        configDialogState.workingConfig.widgetOrder = ensureUnique([...configDialogState.workingConfig.widgetOrder, customWidget.id]);
        configDialogState.workingConfig.visibleWidgetIds = ensureUnique([...configDialogState.workingConfig.visibleWidgetIds, customWidget.id]);
        reassignWidgetToTab(configDialogState.workingConfig, customWidget.id, configDialogState.workingConfig.tabs[0]?.id);
        persistDialogConfig(`Created custom widget ${heading}`);

        dialog.querySelector('[data-role="custom-heading"]').value = '';
        dialog.querySelector('[data-role="custom-description"]').value = '';
        dialog.querySelector('[data-role="custom-markdown"]').value = '';
        dialog.querySelector('[data-role="custom-command"]').value = '';
        dialog.querySelector('[data-role="custom-link-url"]').value = '';
        dialog.querySelector('[data-role="custom-link-text"]').value = '';
        updateStatus(`Custom widget ${heading} created.`);
    });

    const importInput = dialog.querySelector('[data-role="custom-import-file"]');

    dialog.querySelector('[data-role="custom-import"]')?.addEventListener('click', () => {
        if (importInput) {
            importInput.value = '';
            importInput.click();
        }
    });

    importInput?.addEventListener('change', async () => {
        if (!configDialogState) return;
        const file = importInput.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const items = Array.isArray(payload?.widgets) ? payload.widgets : [];
            if (items.length === 0) {
                updateStatus('No custom widgets were found in the selected file.');
                return;
            }

            const imported = items.map((item, index) => normalizeCustomWidget(item, 5000 + index));
            configDialogState.workingConfig.customWidgets = ensureUnique([
                ...configDialogState.workingConfig.customWidgets.map((item) => item.id),
                ...imported.map((item) => item.id)
            ]).map((id) => {
                return imported.find((item) => item.id === id)
                    || configDialogState.workingConfig.customWidgets.find((item) => item.id === id);
            }).filter(Boolean);

            imported.forEach((widget) => {
                configDialogState.workingConfig.widgetOrder = ensureUnique([...configDialogState.workingConfig.widgetOrder, widget.id]);
                configDialogState.workingConfig.visibleWidgetIds = ensureUnique([...configDialogState.workingConfig.visibleWidgetIds, widget.id]);
                reassignWidgetToTab(configDialogState.workingConfig, widget.id, configDialogState.workingConfig.tabs[0]?.id);
            });

            persistDialogConfig('Imported custom widgets');
            updateStatus(`Imported ${imported.length} custom widget${imported.length === 1 ? '' : 's'}.`);
        } catch (error) {
            updateStatus('Custom widget import failed. The selected file is not valid JSON.');
        }
    });

    dialog.querySelector('[data-role="custom-export"]')?.addEventListener('click', () => {
        if (!configDialogState) return;
        const payload = {
            artDashboardWidgetsVersion: '1.0',
            exportedAt: new Date().toISOString(),
            widgets: configDialogState.workingConfig.customWidgets || []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'art-custom-widgets.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        updateStatus('Custom widgets exported.');
    });

    document.addEventListener('keydown', trapDialogFocus);
    document.addEventListener('focusin', trapDialogFocus);
}

export function openConfigureDashboardDialogFromCommand() {
    if (!runtime) return false;
    const dialog = ensureDialog();
    if (!dialog) return false;

    configDialogState = {
        dialog,
        isOpen: true,
        opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        workingConfig: loadConfig()
    };

    populateDialog();
    dialog.hidden = false;
    const first = getFocusableElements(dialog)[0];
    first?.focus();
    announce('Configure Dashboard dialog opened.');
    return true;
}

export function closeConfigureDashboardDialog() {
    if (!configDialogState?.dialog) return;
    const opener = configDialogState.opener;
    configDialogState.isOpen = false;
    configDialogState.dialog.hidden = true;
    configDialogState = null;
    if (opener) opener.focus();
    announce('Configure Dashboard dialog closed.');
}

export function registerDashboardWidget(definition) {
    const widget = definition && typeof definition === 'object' ? definition : null;
    if (!widget) throw new Error('Dashboard widget definition is required.');

    const id = normalizeText(widget.id);
    if (!id) throw new Error('Dashboard widget id is required.');
    if (registry.has(id)) throw new Error(`Dashboard widget ${id} is already registered.`);

    registry.set(id, {
        id,
        name: normalizeText(widget.name) || id,
        heading: normalizeText(widget.heading) || normalizeText(widget.name) || id,
        description: normalizeText(widget.description),
        category: normalizeText(widget.category) || 'Workspace',
        priority: Number.isFinite(Number(widget.priority)) ? Number(widget.priority) : registry.size,
        regionLabel: normalizeText(widget.regionLabel) || `${normalizeText(widget.heading || widget.name || id)} widget`,
        refreshPolicy: normalizeText(widget.refreshPolicy) || 'automatic',
        visibility: typeof widget.visibility === 'function' ? widget.visibility : null,
        render: typeof widget.render === 'function' ? widget.render : null,
        resolveElement: typeof widget.resolveElement === 'function' ? widget.resolveElement : null,
        commandActions: Array.isArray(widget.commandActions) ? widget.commandActions.map((value) => normalizeText(value)).filter(Boolean) : [],
        helpTopic: normalizeText(widget.helpTopic),
        minimumVersion: normalizeText(widget.minimumVersion) || '2.0',
        hideWhenUnavailable: widget.hideWhenUnavailable === true
    });

    if (runtime) {
        const config = loadConfig();
        persistConfig(config, `Registered dashboard widget ${id}`);
        renderDashboard();
    }

    return registry.get(id);
}

export function unregisterDashboardWidget(widgetId) {
    const id = normalizeText(widgetId);
    if (!id) return null;
    const widget = registry.get(id) || null;
    if (!widget) return null;
    registry.delete(id);
    if (runtime) {
        const config = loadConfig();
        config.widgetOrder = (config.widgetOrder || []).filter((item) => item !== id);
        config.visibleWidgetIds = (config.visibleWidgetIds || []).filter((item) => item !== id);
        config.tabs = (config.tabs || []).map((tab) => ({
            ...tab,
            widgetIds: (tab.widgetIds || []).filter((item) => item !== id)
        }));
        persistConfig(config, `Unregistered dashboard widget ${id}`);
        renderDashboard();
    }
    return widget;
}

export function getRegisteredDashboardWidgets() {
    return [...registry.values()].map((item) => ({ ...item }));
}

export function refreshDashboardWidgetFramework() {
    renderDashboard();
}

export function initializeDashboardWidgetFramework(options = {}) {
    const dashboardElement = options.dashboardElement || document.getElementById('dashboard');
    if (!dashboardElement) return false;

    let layoutRoot = dashboardElement.querySelector('#dashboard-widget-layout-root');
    if (!layoutRoot) {
        layoutRoot = document.createElement('div');
        layoutRoot.id = 'dashboard-widget-layout-root';
        layoutRoot.className = 'dashboard-widget-layout-root';
        dashboardElement.appendChild(layoutRoot);
    }

    runtime = {
        dashboardElement,
        layoutRoot,
        widgetSourceElements: new Map(),
        announce: typeof options.announce === 'function' ? options.announce : null,
        executeAction: typeof options.executeAction === 'function' ? options.executeAction : null,
        loadConfig: typeof options.loadConfig === 'function' ? options.loadConfig : () => ({}),
        persistConfig: typeof options.persistConfig === 'function' ? options.persistConfig : () => {},
        getContext: typeof options.getContext === 'function' ? options.getContext : () => ({})
    };

    const currentConfig = loadConfig();
    persistConfig(currentConfig, 'Initialized dashboard widget framework');

    const configureButton = document.getElementById('btn-configure-dashboard');
    if (configureButton && !configureButton.dataset.dashboardConfigBound) {
        configureButton.dataset.dashboardConfigBound = 'true';
        configureButton.addEventListener('click', () => {
            openConfigureDashboardDialogFromCommand();
        });
    }

    if (!runtime.dashboardElement.dataset.dashboardWidgetDialogBound) {
        runtime.dashboardElement.dataset.dashboardWidgetDialogBound = 'true';
        bindDialogActions();
    }

    renderDashboard();
    return true;
}

export function runDashboardSearch(query = '') {
    const output = runUniversalSearch(query, {
        source: 'dashboard-search-widget',
        providerIds: ['commands', 'reports', 'dashboard-widgets'],
        scope: 'workspace',
        limit: 20
    });
    return output.results || [];
}
