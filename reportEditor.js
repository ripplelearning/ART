import { appState, saveState, updateEditorFieldValue } from './state.js';
import { formatWcagCriterionDisplay, getWcagCriteriaForStandard, isWcagCriterionFieldType } from './wcagCatalog.js';

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getEditorHeadingText() {
    if (!appState.editorUsesReportTitle) return 'Report Editor';
    return appState.reportTitle?.trim() || 'Report Editor';
}

function renderMetadataPlainText() {
    const metadata = [
        ['Report Title', appState.reportTitle],
        ['Organization/Client', appState.orgClient],
        ['Project Name', appState.projectName],
        ['URL / Scope', appState.scopeUrl],
        ['Audit Start', appState.auditDateStart],
        ['Audit End', appState.auditDateEnd],
        ['Auditor(s)', appState.auditors],
        ['Accessibility Standard', appState.standard],
        ['Testing Instructions', appState.testingInstructions],
        ['Report Type', appState.reportType],
        ['Report Layout', appState.reportLayout],
        ['Template Option', appState.templateOption],
        ['Template Name', appState.templateName],
        ['Template Description', appState.templateDescription]
    ];

    const visibleRows = metadata.filter(([, value]) => String(value || '').trim() !== '');
    if (visibleRows.length === 0) return '';

    return `
        <dl class="editor-metadata-list" aria-label="Report metadata values">
            ${visibleRows.map(([label, value]) => `
                <div class="editor-metadata-item">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${escapeHtml(value)}</dd>
                </div>
            `).join('')}
        </dl>
    `;
}

function renderFieldControl(field, index) {
    const type = normalizeFieldType(field.type);
    const storedValue = appState.editorFieldValues[index] ?? '';
    const readOnlyAttrs = appState.editorReadOnly ? ' readonly aria-readonly="true"' : '';

    if (isWcagCriterionFieldType(type)) {
        const displayValue = typeof storedValue === 'object' ? formatWcagCriterionDisplay(storedValue) : String(storedValue || '');
        if (appState.editorReadOnly) {
            return `<input type="text" id="editor-field-${index}" value="${escapeHtml(displayValue)}" readonly aria-readonly="true">`;
        }

        return `
            <div class="wcag-combobox" data-editor-field-index="${index}">
                <input
                    type="text"
                    id="editor-field-${index}"
                    class="wcag-combobox-input"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded="false"
                    aria-haspopup="listbox"
                    aria-controls="editor-field-${index}-listbox"
                    aria-describedby="editor-select-help"
                    autocomplete="off"
                    value="${escapeHtml(displayValue)}"
                >
                <button type="button" class="wcag-combobox-toggle" aria-label="Show WCAG Success Criterion options for ${escapeHtml(field.label)}">Show options</button>
                <ul id="editor-field-${index}-listbox" class="wcag-combobox-listbox" role="listbox" hidden></ul>
            </div>
        `;
    }

    if (type === 'textarea') {
        return `<textarea id="editor-field-${index}" data-editor-field-index="${index}"${readOnlyAttrs}>${escapeHtml(storedValue)}</textarea>`;
    }

    if (type === 'dropdown') {
        const options = Array.isArray(field.dropdownOptions) ? field.dropdownOptions : [];
        return `
            <select id="editor-field-${index}" data-editor-field-index="${index}" aria-label="${escapeHtml(field.label)}" aria-describedby="editor-select-help" ${appState.editorReadOnly ? 'disabled aria-disabled="true"' : ''}>
                <option value="">Select an option</option>
                ${options.map((option) => {
                    const selected = String(storedValue) === String(option) ? 'selected' : '';
                    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
                }).join('')}
            </select>
        `;
    }

    return `<input type="text" id="editor-field-${index}" data-editor-field-index="${index}" value="${escapeHtml(storedValue)}"${readOnlyAttrs}>`;
}

function attachWcagCombobox(control, criteria, index) {
    const input = control.querySelector('.wcag-combobox-input');
    const toggle = control.querySelector('.wcag-combobox-toggle');
    const listbox = control.querySelector('.wcag-combobox-listbox');
    if (!input || !toggle || !listbox) return;

    let filtered = [...criteria];
    let activeIndex = -1;

    const commitSelection = (criterion) => {
        const structuredValue = {
            standard: criterion.standard,
            identifier: criterion.identifier,
            number: criterion.number,
            title: criterion.title,
            level: criterion.level,
            understandingUrl: criterion.understandingUrl,
            recommendationUrl: criterion.recommendationUrl
        };
        input.value = `${criterion.number} ${criterion.title}`;
        updateEditorFieldValue(index, structuredValue);
        closeListbox();
    };

    const renderOptions = () => {
        listbox.innerHTML = filtered.map((criterion, optionIndex) => `
            <li
                id="${listbox.id}-option-${optionIndex}"
                role="option"
                aria-selected="${optionIndex === activeIndex ? 'true' : 'false'}"
                data-option-index="${optionIndex}"
            >${escapeHtml(`${criterion.number} ${criterion.title}`)}</li>
        `).join('');
    };

    const openListbox = () => {
        listbox.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        renderOptions();
    };

    function closeListbox() {
        listbox.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        activeIndex = -1;
    }

    const updateFilter = () => {
        const q = input.value.trim().toLowerCase();
        filtered = criteria.filter((criterion) => criterion.searchText.includes(q));
        activeIndex = filtered.length > 0 ? 0 : -1;
        renderOptions();
        if (filtered.length > 0) {
            openListbox();
            input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
        } else {
            closeListbox();
        }
    };

    const moveActive = (delta) => {
        if (filtered.length === 0) return;
        if (listbox.hidden) openListbox();
        activeIndex = activeIndex < 0 ? 0 : (activeIndex + delta + filtered.length) % filtered.length;
        renderOptions();
        input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
    };

    input.addEventListener('input', updateFilter);
    input.addEventListener('focus', () => {
        filtered = [...criteria];
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActive(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActive(-1);
            return;
        }
        if (event.key === 'Enter' && !listbox.hidden && activeIndex >= 0 && filtered[activeIndex]) {
            event.preventDefault();
            commitSelection(filtered[activeIndex]);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeListbox();
        }
    });

    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (!control.contains(document.activeElement)) closeListbox();
        }, 0);
    });

    toggle.addEventListener('click', () => {
        if (listbox.hidden) {
            filtered = [...criteria];
            activeIndex = filtered.length > 0 ? 0 : -1;
            openListbox();
            if (activeIndex >= 0) {
                input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
            }
            input.focus();
            return;
        }
        closeListbox();
        input.focus();
    });

    listbox.addEventListener('mousedown', (event) => event.preventDefault());
    listbox.addEventListener('click', (event) => {
        const option = event.target.closest('[data-option-index]');
        if (!option) return;
        const optionIndex = Number(option.getAttribute('data-option-index'));
        if (filtered[optionIndex]) {
            commitSelection(filtered[optionIndex]);
            input.focus();
        }
    });
}

export async function renderEditor() {
    const container = document.getElementById('main-inner');
    const editorHeading = getEditorHeadingText();
    const wcagCriteria = await getWcagCriteriaForStandard(appState.standard).catch(() => []);

    container.innerHTML = `
        <section id="editor-view">
            <h2 id="editor-heading" tabindex="-1">${escapeHtml(editorHeading)}</h2>
            <p id="editor-select-help" class="sr-only">Use Up and Down arrow keys to review options, then Enter to confirm.</p>
            ${renderMetadataPlainText()}
            <div class="editor-fields-grid">
                ${appState.fields.map((field, index) => {
                    const labelAttrs = isWcagCriterionFieldType(field.type)
                        ? `id="editor-field-label-${index}"`
                        : `for="editor-field-${index}"`;
                    return `
                        <label ${labelAttrs}>${escapeHtml(field.label)}</label>
                        ${renderFieldControl(field, index)}
                    `;
                }).join('')}
            </div>
        </section>
    `;

    container.querySelectorAll('[data-editor-field-index]').forEach((control) => {
        if (control.classList.contains('wcag-combobox')) {
            const index = Number(control.getAttribute('data-editor-field-index'));
            const input = control.querySelector('.wcag-combobox-input');
            const label = document.getElementById(`editor-field-label-${index}`);
            if (input && label) {
                input.setAttribute('aria-labelledby', label.id);
            }
            attachWcagCombobox(control, wcagCriteria, index);
            return;
        }
        const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
        control.addEventListener(eventName, (event) => {
            const index = Number(event.target.getAttribute('data-editor-field-index'));
            updateEditorFieldValue(index, event.target.value);
        });
    });

    const heading = document.getElementById('editor-heading');
    if (heading) {
        window.setTimeout(() => {
            heading.focus();
        }, 0);
    }

    saveState();
}
