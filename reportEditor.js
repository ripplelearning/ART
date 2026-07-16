import {
    applyMetadataDraft,
    addAuditEntry,
    announce,
    appState,
    buildMetadataDraftFromValues,
    clearReportContentOnly,
    clearReportEverythingInSession,
    currentReportSupportsAuditEntries,
    deleteAuditEntry,
    ensureAuditEntries,
    getAuditEntries,
    getAuditEntryDisplayName,
    getCurrentReportMetrics,
    getMetadataDescriptors,
    moveAuditEntry,
    upsertCurrentReport,
    validateCurrentReport,
    validateMetadataDraft,
    updateAuditEntryFieldValue,
    updateEditorFieldValue
} from './state.js';
import { formatWcagCriterionDisplay, getWcagCriteriaForStandard, isWcagCriterionFieldType } from './wcagCatalog.js';
import { requestViewerExportDialog, requestViewerPrintPreview } from './reportViewer.js';

let pendingEntryFocus = null;
let pendingDeleteEntry = null;
let activeModalDialog = null;
let areModalListenersBound = false;
let pendingEditorFocusTargetId = '';
export function activateAddEntryWorkflow() {
    if (!currentReportSupportsAuditEntries()) {
        announce('Add Entry is unavailable for the current report type.');
        return false;
    }

    const newIndex = addAuditEntry();
    pendingEntryFocus = { entryIndex: newIndex, fieldIndex: 0 };
    announce(`Added audit entry ${getAuditEntries().length}.`);
    return true;
}

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

function getEntryFieldValue(entry, fieldIndex) {
    return entry?.fieldValues?.[fieldIndex] ?? '';
}

function renderWcagControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy) {
    const displayValue = typeof storedValue === 'object' ? formatWcagCriterionDisplay(storedValue) : String(storedValue || '');
    const inputId = `editor-field-${entryIndex}-${fieldIndex}`;
    if (readOnly) {
        return `<input type="text" id="${inputId}" value="${escapeHtml(displayValue)}" aria-labelledby="${escapeHtml(labelledBy)}" readonly aria-readonly="true">`;
    }

    return `
        <div class="wcag-combobox" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}">
            <input
                type="text"
                id="${inputId}"
                class="wcag-combobox-input"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-haspopup="listbox"
                aria-controls="${inputId}-listbox"
                aria-labelledby="${escapeHtml(labelledBy)}"
                aria-describedby="editor-select-help"
                autocomplete="off"
                value="${escapeHtml(displayValue)}"
            >
            <button type="button" class="wcag-combobox-toggle" aria-label="Show WCAG Success Criterion options for ${escapeHtml(field.label)}">Show options</button>
            <ul id="${inputId}-listbox" class="wcag-combobox-listbox" role="listbox" hidden></ul>
        </div>
    `;
}

function renderFieldControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy) {
    const type = normalizeFieldType(field.type);

    if (isWcagCriterionFieldType(type)) {
        return renderWcagControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy);
    }

    if (type === 'textarea') {
        return `<textarea id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}"${readOnly ? ' readonly aria-readonly="true"' : ''}>${escapeHtml(storedValue)}</textarea>`;
    }

    if (type === 'dropdown') {
        const options = Array.isArray(field.dropdownOptions) ? field.dropdownOptions : [];
        return `
            <select id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}" aria-describedby="editor-select-help" ${readOnly ? 'disabled aria-disabled="true"' : ''}>
                <option value="">Select an option</option>
                ${options.map((option) => {
                    const selected = String(storedValue) === String(option) ? 'selected' : '';
                    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
                }).join('')}
            </select>
        `;
    }

    return `<input type="text" id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}" value="${escapeHtml(storedValue)}"${readOnly ? ' readonly aria-readonly="true"' : ''}>`;
}

function updateEntryActionLabels(entryIndex) {
    const entryName = getAuditEntryDisplayName(entryIndex);
    const toggle = document.querySelector(`.btn-entry-toggle[data-entry-index="${entryIndex}"]`);
    const moveUp = document.querySelector(`.btn-entry-up[data-entry-index="${entryIndex}"]`);
    const moveDown = document.querySelector(`.btn-entry-down[data-entry-index="${entryIndex}"]`);
    const remove = document.querySelector(`.btn-entry-delete[data-entry-index="${entryIndex}"]`);

    if (toggle) {
        toggle.textContent = `Edit ${entryName}`;
        toggle.setAttribute('aria-label', `Edit ${entryName}`);
    }
    if (moveUp) moveUp.setAttribute('aria-label', `Move ${entryName} Up`);
    if (moveDown) moveDown.setAttribute('aria-label', `Move ${entryName} Down`);
    if (remove) remove.setAttribute('aria-label', `Delete ${entryName}`);
}

function attachWcagCombobox(control, criteria, entryIndex, fieldIndex) {
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
        if (appState.reportType === 'Audit Log') {
            updateAuditEntryFieldValue(entryIndex, fieldIndex, structuredValue);
            if (fieldIndex === 0) updateEntryActionLabels(entryIndex);
        } else {
            updateEditorFieldValue(fieldIndex, structuredValue);
        }
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

function getFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function closeModalDialog(restoreFocus = true) {
    if (!activeModalDialog) return;
    const { dialog, trigger } = activeModalDialog;
    dialog.hidden = true;
    activeModalDialog = null;
    if (restoreFocus && trigger) trigger.focus();
}

function openModalDialog(dialog, focusTarget, trigger) {
    activeModalDialog = { dialog, trigger };
    dialog.hidden = false;
    window.setTimeout(() => {
        if (focusTarget) {
            focusTarget.focus();
            return;
        }
        getFocusableElements(dialog)[0]?.focus();
    }, 0);
}

function trapModalFocus(event) {
    if (!activeModalDialog || activeModalDialog.dialog.hidden) return;
    const dialog = activeModalDialog.dialog;

    if (event.type === 'focusin') {
        if (!dialog.contains(event.target)) {
            getFocusableElements(dialog)[0]?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeModalDialog(true);
        return;
    }

    if (event.key !== 'Tab') return;
    const focusables = getFocusableElements(dialog);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first.focus();
    }
}

function renderMetadataEditDialog() {
    const descriptors = getMetadataDescriptors();
    const isBrandingEnabled = Boolean(appState.branding?.enabled);
    const groups = descriptors.reduce((acc, descriptor) => {
        const group = descriptor.groupLabel || 'Report Metadata';
        if (!acc[group]) acc[group] = [];
        acc[group].push(descriptor);
        return acc;
    }, {});

    const renderField = (descriptor) => {
        const id = `metadata-field-${descriptor.keyPath.replace(/\./g, '-')}`;
        const isBrandingExtra = descriptor.keyPath.startsWith('branding.') && descriptor.keyPath !== 'branding.enabled';
        const containerAttrs = isBrandingExtra
            ? ` data-branding-extra="true" ${isBrandingEnabled ? '' : 'hidden'}`
            : '';
        if (descriptor.inputType === 'textarea') {
            return `
                <div${containerAttrs}>
                    <label for="${id}">${escapeHtml(descriptor.label)}</label>
                    <textarea id="${id}" data-metadata-key="${descriptor.keyPath}">${escapeHtml(descriptor.value || '')}</textarea>
                </div>
            `;
        }
        if (descriptor.inputType === 'select') {
            return `
                <div${containerAttrs}>
                    <label for="${id}">${escapeHtml(descriptor.label)}</label>
                    <select id="${id}" data-metadata-key="${descriptor.keyPath}">
                        ${(descriptor.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(option) === String(descriptor.value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        if (descriptor.inputType === 'checkbox') {
            return `
                <div${containerAttrs}>
                    <label>
                        <input type="checkbox" id="${id}" data-metadata-key="${descriptor.keyPath}" ${descriptor.value ? 'checked' : ''}>
                        ${escapeHtml(descriptor.label)}
                    </label>
                </div>
            `;
        }
        return `
            <div${containerAttrs}>
                <label for="${id}">${escapeHtml(descriptor.label)}</label>
                <input type="${descriptor.inputType}" id="${id}" data-metadata-key="${descriptor.keyPath}" value="${escapeHtml(descriptor.value || '')}">
            </div>
        `;
    };

    return `
        <div id="editor-metadata-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-metadata-dialog-heading" aria-describedby="editor-metadata-dialog-desc" hidden>
            <h3 id="editor-metadata-dialog-heading">Edit Metadata</h3>
            <p id="editor-metadata-dialog-desc">Update report metadata values. Report fields, report type, layout, and templates are not changed here.</p>
            <div class="editor-metadata-dialog-grid">
                ${Object.entries(groups).map(([groupName, items]) => `
                    <fieldset>
                        <legend>${escapeHtml(groupName)}</legend>
                        ${items.map(renderField).join('')}
                    </fieldset>
                `).join('')}
            </div>
            <p id="editor-metadata-dialog-error" class="branding-error" role="status" aria-live="polite"></p>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-metadata-confirm" type="button">Confirm</button>
                <button id="btn-editor-metadata-cancel" type="button">Cancel</button>
            </div>
        </div>
    `;
}

function renderClearDialog() {
    return `
        <div id="editor-clear-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-clear-dialog-heading" aria-describedby="editor-clear-dialog-desc" hidden>
            <h3 id="editor-clear-dialog-heading">Clear Report</h3>
            <p id="editor-clear-dialog-desc">What would you like to clear?</p>

            <fieldset>
                <legend class="sr-only">Clear options</legend>
                <label>
                    <input type="radio" name="editor-clear-option" value="content" checked>
                    Clear report content only (recommended)
                </label>
                <p class="editor-clear-help">Removes all audit entries and entered field values while preserving report metadata, fields, report type, report layout, and template configuration.</p>

                <label>
                    <input type="radio" name="editor-clear-option" value="everything">
                    Clear everything
                </label>
                <p class="editor-clear-help">Removes report metadata, configured fields, report content, report type, and report layout, then returns to a blank configuration state.</p>
            </fieldset>

            <div class="viewer-dialog-actions">
                <button id="btn-editor-clear-confirm" type="button">Clear</button>
                <button id="btn-editor-clear-cancel" type="button">Cancel</button>
            </div>
        </div>
    `;
}

function renderValidationDialog() {
    return `
        <div id="editor-validation-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-validation-heading" aria-describedby="editor-validation-desc" hidden>
            <h3 id="editor-validation-heading">Validate Report</h3>
            <p id="editor-validation-desc">Review validation issues and activate an item to move to the related field.</p>
            <div id="editor-validation-results"></div>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-validation-close" type="button">Close</button>
            </div>
        </div>
    `;
}

function renderStatisticsDialog(metrics) {
    return `
        <div id="editor-statistics-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-statistics-heading" aria-describedby="editor-statistics-desc" hidden>
            <h3 id="editor-statistics-heading">Report Statistics</h3>
            <p id="editor-statistics-desc">Summary statistics for the current report.</p>
            <ul class="editor-statistics-list">
                <li>Total Audit Entries: ${metrics.totalAuditEntries}</li>
                <li>Total Issues: ${metrics.totalIssues}</li>
                <li>Issues by Severity: ${escapeHtml(metrics.issuesBySeverity)}</li>
                <li>Unique Pages Tested: ${metrics.pagesTested}</li>
                <li>WCAG Success Criteria Referenced: ${metrics.wcagCriteria}</li>
            </ul>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-statistics-close" type="button">Close</button>
            </div>
        </div>
    `;
}

function renderEditorActionBar() {
    const addEntryDisabled = !currentReportSupportsAuditEntries();
    return `
        <div class="editor-action-bar" role="group" aria-label="Report editor actions">
            <button id="btn-add-entry" type="button" ${addEntryDisabled ? 'disabled aria-disabled="true"' : ''}>Add Entry</button>
            <button id="btn-editor-configure-report" type="button">Configure Report</button>
            <button id="btn-editor-validate-report" type="button">Validate Report</button>
            <button id="btn-editor-report-statistics" type="button">Report Statistics</button>
            <button id="btn-editor-view-report" type="button">View Report</button>
            <button id="btn-editor-print-preview" type="button">Print Preview</button>
            <button id="btn-editor-export-report" type="button">Export Report...</button>
            <button id="btn-editor-close-report" type="button">Close Report</button>
        </div>
    `;
}

function renderValidationResults(issues) {
    const results = document.getElementById('editor-validation-results');
    if (!results) return;
    if (!issues.length) {
        results.innerHTML = '<p>No validation issues found.</p>';
        return;
    }

    results.innerHTML = `
        <ul class="editor-validation-list">
            ${issues.map((issue, index) => `
                <li>
                    <button type="button" class="btn-validation-issue" data-issue-index="${index}">${escapeHtml(issue.message)}</button>
                </li>
            `).join('')}
        </ul>
    `;
}

function focusValidationTarget(issue) {
    if (!issue) return;
    if (issue.targetType === 'metadata') {
        const editMetadataButton = document.getElementById('btn-edit-metadata');
        editMetadataButton?.click();
        window.setTimeout(() => {
            const target = document.querySelector(`[data-metadata-key="${issue.target}"]`);
            target?.focus();
        }, 0);
        return;
    }

    if (issue.targetType === 'builder') {
        const builderTab = document.getElementById('tab-builder');
        builderTab?.click();
        window.setTimeout(() => {
            const target = document.getElementById(issue.target || 'builder-heading');
            target?.focus();
        }, 0);
        return;
    }

    const target = document.getElementById(issue.target);
    if (target) {
        target.focus();
    }
}

function renderAuditTable(criteria) {
    ensureAuditEntries();
    const entries = getAuditEntries();
    const fields = appState.fields || [];

    return `
        <section aria-labelledby="audit-table-heading">
            <h3 id="audit-table-heading">Audit Entries</h3>
            <div class="editor-table-wrapper">
                <table class="editor-audit-table">
                    <thead>
                        <tr>
                            ${fields.map((field, fieldIndex) => `<th scope="col" id="audit-col-${fieldIndex}">${escapeHtml(field.label)}</th>`).join('')}
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.map((entry, entryIndex) => {
                            const entryName = getAuditEntryDisplayName(entryIndex);
                            const actionsPanelId = `entry-actions-${entryIndex}`;
                            return `
                                <tr>
                                    ${fields.map((field, fieldIndex) => `
                                        <td headers="audit-col-${fieldIndex}">
                                            ${renderFieldControl(field, entryIndex, fieldIndex, getEntryFieldValue(entry, fieldIndex), appState.editorReadOnly, `audit-col-${fieldIndex}`)}
                                        </td>
                                    `).join('')}
                                    <td>
                                        <button
                                            type="button"
                                            class="btn-entry-toggle"
                                            data-entry-index="${entryIndex}"
                                            aria-label="Edit ${escapeHtml(entryName)}"
                                            aria-expanded="false"
                                            aria-controls="${actionsPanelId}"
                                        >Edit ${escapeHtml(entryName)}</button>
                                        <div id="${actionsPanelId}" class="entry-actions-menu" hidden>
                                            <button type="button" class="btn-entry-up" data-entry-index="${entryIndex}" aria-label="Move ${escapeHtml(entryName)} Up" ${entryIndex === 0 ? 'disabled' : ''}>Move Up</button>
                                            <button type="button" class="btn-entry-down" data-entry-index="${entryIndex}" aria-label="Move ${escapeHtml(entryName)} Down" ${entryIndex === entries.length - 1 ? 'disabled' : ''}>Move Down</button>
                                            <button type="button" class="btn-entry-delete" data-entry-index="${entryIndex}" aria-label="Delete ${escapeHtml(entryName)}">Delete Entry</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div id="entry-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="entry-delete-heading" aria-describedby="entry-delete-message" hidden>
                <h3 id="entry-delete-heading">Delete Entry?</h3>
                <p id="entry-delete-message"></p>
                <button id="btn-entry-delete-confirm" type="button">Confirm</button>
                <button id="btn-entry-delete-cancel" type="button">Cancel</button>
            </div>
        </section>
    `;
}

function renderSingleEntryEditor() {
    return `
        <div class="editor-fields-grid">
            ${appState.fields.map((field, index) => {
                const labelId = `editor-field-label-${index}`;
                const labelAttrs = isWcagCriterionFieldType(field.type)
                    ? `id="${labelId}"`
                    : `id="${labelId}" for="editor-field-0-${index}"`;
                return `
                    <label ${labelAttrs}>${escapeHtml(field.label)}</label>
                    ${renderFieldControl(field, 0, index, appState.editorFieldValues[index] ?? '', appState.editorReadOnly, labelId)}
                `;
            }).join('')}
        </div>
    `;
}

function focusPendingEntryControl() {
    if (!pendingEntryFocus) return false;
    const { entryIndex, fieldIndex } = pendingEntryFocus;
    let target = document.getElementById(`editor-field-${entryIndex}-${fieldIndex}`);
    if (!target) {
        target = document.querySelector('.editor-audit-table tbody tr:last-child [data-field-index="0"]')
            || document.querySelector('.editor-audit-table tbody tr:last-child .wcag-combobox-input')
            || document.querySelector('.editor-audit-table tbody tr:last-child .btn-entry-toggle');
    }
    pendingEntryFocus = null;
    if (target) {
        window.setTimeout(() => {
            target.focus();
        }, 0);
        return true;
    }
    return false;
}

function bindAuditTableEvents(criteria) {
    const container = document.getElementById('main-inner');
    if (!container) return;

    const addEntryButton = document.getElementById('btn-add-entry');
    if (addEntryButton) {
        addEntryButton.addEventListener('click', () => {
            if (!activateAddEntryWorkflow()) return;
            renderEditor();
        });
    }

    container.querySelectorAll('.btn-entry-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const entryIndex = button.getAttribute('data-entry-index');
            const panel = document.getElementById(button.getAttribute('aria-controls'));
            if (!panel) return;
            const expanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            panel.hidden = expanded;
            if (!expanded) {
                panel.querySelector('button:not([disabled])')?.focus();
            }
        });
    });

    container.querySelectorAll('.btn-entry-up').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            const movedTo = moveAuditEntry(index, -1);
            if (movedTo === null) return;
            const movedLabel = getAuditEntryDisplayName(movedTo);
            pendingEntryFocus = { entryIndex: movedTo, fieldIndex: 0 };
            renderEditor();
            const announcer = document.getElementById('announcer');
            if (announcer) announcer.textContent = `Moved before ${movedLabel}`;
        });
    });

    container.querySelectorAll('.btn-entry-down').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            const movedTo = moveAuditEntry(index, 1);
            if (movedTo === null) return;
            const movedLabel = getAuditEntryDisplayName(movedTo);
            pendingEntryFocus = { entryIndex: movedTo, fieldIndex: 0 };
            renderEditor();
            const announcer = document.getElementById('announcer');
            if (announcer) announcer.textContent = `Moved after ${movedLabel}`;
        });
    });

    const deleteDialog = document.getElementById('entry-delete-dialog');
    const deleteMessage = document.getElementById('entry-delete-message');
    const deleteConfirm = document.getElementById('btn-entry-delete-confirm');
    const deleteCancel = document.getElementById('btn-entry-delete-cancel');

    container.querySelectorAll('.btn-entry-delete').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            pendingDeleteEntry = { index, triggerId: `entry-delete-trigger-${index}` };
            button.id = pendingDeleteEntry.triggerId;
            if (deleteMessage) {
                deleteMessage.innerHTML = `Are you sure you want to delete the <strong>${escapeHtml(getAuditEntryDisplayName(index))}</strong> entry?<br>This action cannot be undone.`;
            }
            if (deleteDialog) {
                openModalDialog(deleteDialog, deleteConfirm, button);
            }
        });
    });

    const closeDeleteDialog = (restoreFocus) => {
        closeModalDialog(restoreFocus);
        pendingDeleteEntry = null;
    };

    deleteCancel?.addEventListener('click', () => closeDeleteDialog(true));

    deleteConfirm?.addEventListener('click', () => {
        if (!pendingDeleteEntry) return;
        const deletedIndex = pendingDeleteEntry.index;
        deleteAuditEntry(deletedIndex);
        closeDeleteDialog(false);
        renderEditor();
        const nextIndex = Math.min(deletedIndex, Math.max(0, getAuditEntries().length - 1));
        window.setTimeout(() => {
            const nextDeleteButton = document.querySelector(`.btn-entry-delete[data-entry-index="${nextIndex}"]`);
            if (nextDeleteButton) nextDeleteButton.focus();
        }, 0);
    });

    container.querySelectorAll('[data-entry-index][data-field-index]').forEach((control) => {
        if (control.classList.contains('wcag-combobox')) {
            const entryIndex = Number(control.getAttribute('data-entry-index'));
            const fieldIndex = Number(control.getAttribute('data-field-index'));
            attachWcagCombobox(control, criteria, entryIndex, fieldIndex);
            return;
        }
        const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
        control.addEventListener(eventName, (event) => {
            const entryIndex = Number(event.target.getAttribute('data-entry-index'));
            const fieldIndex = Number(event.target.getAttribute('data-field-index'));
            updateAuditEntryFieldValue(entryIndex, fieldIndex, event.target.value);
            if (fieldIndex === 0) updateEntryActionLabels(entryIndex);
        });
    });
}

function bindEditorDialogEvents() {
    const editMetadataButton = document.getElementById('btn-edit-metadata');
    const clearReportButton = document.getElementById('btn-clear-report-data');
    const configureReportButton = document.getElementById('btn-editor-configure-report');
    const validateReportButton = document.getElementById('btn-editor-validate-report');
    const reportStatisticsButton = document.getElementById('btn-editor-report-statistics');
    const viewReportButton = document.getElementById('btn-editor-view-report');
    const printPreviewButton = document.getElementById('btn-editor-print-preview');
    const exportReportButton = document.getElementById('btn-editor-export-report');
    const closeReportButton = document.getElementById('btn-editor-close-report');
    const metadataDialog = document.getElementById('editor-metadata-dialog');
    const clearDialog = document.getElementById('editor-clear-dialog');
    const validationDialog = document.getElementById('editor-validation-dialog');
    const statisticsDialog = document.getElementById('editor-statistics-dialog');
    const metadataConfirm = document.getElementById('btn-editor-metadata-confirm');
    const metadataCancel = document.getElementById('btn-editor-metadata-cancel');
    const clearConfirm = document.getElementById('btn-editor-clear-confirm');
    const clearCancel = document.getElementById('btn-editor-clear-cancel');
    const validationClose = document.getElementById('btn-editor-validation-close');
    const statisticsClose = document.getElementById('btn-editor-statistics-close');
    const metadataError = document.getElementById('editor-metadata-dialog-error');
    const brandingEnabledField = document.getElementById('metadata-field-branding-enabled');

    if (!editMetadataButton || !clearReportButton || !metadataDialog || !clearDialog || !metadataConfirm || !metadataCancel || !clearConfirm || !clearCancel || !validationDialog || !statisticsDialog || !validationClose || !statisticsClose) return;

    const syncMetadataBrandingVisibility = () => {
        const enabled = Boolean(brandingEnabledField?.checked);
        metadataDialog.querySelectorAll('[data-branding-extra="true"]').forEach((section) => {
            section.hidden = !enabled;
            section.querySelectorAll('input, select, textarea, button').forEach((input) => {
                input.disabled = !enabled;
            });
        });
    };

    brandingEnabledField?.addEventListener('change', syncMetadataBrandingVisibility);
    syncMetadataBrandingVisibility();

    editMetadataButton.addEventListener('click', () => {
        const firstField = metadataDialog.querySelector('[data-metadata-key]');
        openModalDialog(metadataDialog, firstField, editMetadataButton);
    });

    clearReportButton.addEventListener('click', () => {
        const firstRadio = clearDialog.querySelector('input[name="editor-clear-option"]');
        openModalDialog(clearDialog, firstRadio, clearReportButton);
    });

    configureReportButton?.addEventListener('click', () => {
        upsertCurrentReport({ name: appState.reportTitle || appState.templateName || 'Untitled Report' });
        const builderTab = document.getElementById('tab-builder');
        builderTab?.click();
        window.setTimeout(() => {
            document.getElementById('builder-heading')?.focus();
        }, 0);
    });

    validateReportButton?.addEventListener('click', () => {
        const issues = validateCurrentReport();
        renderValidationResults(issues);
        validationDialog.querySelectorAll('.btn-validation-issue').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.getAttribute('data-issue-index'));
                const issue = issues[index];
                closeModalDialog(false);
                window.setTimeout(() => focusValidationTarget(issue), 0);
            });
        });
        openModalDialog(validationDialog, validationClose, validateReportButton);
    });

    reportStatisticsButton?.addEventListener('click', () => {
        openModalDialog(statisticsDialog, statisticsClose, reportStatisticsButton);
    });

    viewReportButton?.addEventListener('click', () => {
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
        window.setTimeout(() => document.getElementById('viewer-heading')?.focus(), 0);
    });

    printPreviewButton?.addEventListener('click', () => {
        requestViewerPrintPreview();
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
    });

    exportReportButton?.addEventListener('click', () => {
        requestViewerExportDialog();
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
    });

    closeReportButton?.addEventListener('click', () => {
        upsertCurrentReport({ name: appState.reportTitle || appState.templateName || 'Untitled Report' });
        const welcomeTab = document.getElementById('tab-welcome');
        welcomeTab?.click();
        window.setTimeout(() => {
            const heading = document.getElementById('dash-heading');
            if (!heading) return;
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus();
        }, 0);
    });

    metadataCancel.addEventListener('click', () => closeModalDialog(true));
    clearCancel.addEventListener('click', () => closeModalDialog(true));
    validationClose.addEventListener('click', () => closeModalDialog(true));
    statisticsClose.addEventListener('click', () => closeModalDialog(true));

    metadataConfirm.addEventListener('click', () => {
        const values = {};
        metadataDialog.querySelectorAll('[data-metadata-key]').forEach((field) => {
            const key = field.getAttribute('data-metadata-key');
            if (!key) return;
            if (field.type === 'checkbox') {
                values[key] = field.checked;
                return;
            }
            values[key] = field.value;
        });
        const draft = buildMetadataDraftFromValues(values);
        const validation = validateMetadataDraft(draft);
        if (!validation.isValid) {
            if (metadataError) metadataError.textContent = validation.message;
            const altField = metadataDialog.querySelector('[data-metadata-key="branding.logoAltText"]');
            altField?.focus();
            return;
        }
        applyMetadataDraft(draft);
        closeModalDialog(false);
        pendingEditorFocusTargetId = 'btn-edit-metadata';
        renderEditor();
    });

    clearConfirm.addEventListener('click', () => {
        const selected = clearDialog.querySelector('input[name="editor-clear-option"]:checked')?.value || 'content';
        if (selected === 'everything') {
            clearReportEverythingInSession();
            closeModalDialog(false);
            const builderTab = document.getElementById('tab-builder');
            if (builderTab) builderTab.click();
            window.setTimeout(() => {
                document.getElementById('builder-heading')?.focus();
            }, 0);
            return;
        }

        clearReportContentOnly();
        closeModalDialog(false);
        pendingEntryFocus = { entryIndex: 0, fieldIndex: 0 };
        renderEditor();
    });

    if (!areModalListenersBound) {
        document.addEventListener('keydown', trapModalFocus);
        document.addEventListener('focusin', trapModalFocus);
        areModalListenersBound = true;
    }
}

export async function renderEditor() {
    const container = document.getElementById('main-inner');
    const activeElementBeforeRender = document.activeElement;
    const preserveFocusId = activeElementBeforeRender && container?.contains(activeElementBeforeRender)
        ? String(activeElementBeforeRender.id || '')
        : '';
    const editorHeading = getEditorHeadingText();
    const wcagCriteria = await getWcagCriteriaForStandard(appState.standard).catch(() => []);

    const isAuditLog = appState.reportType === 'Audit Log';
    if (isAuditLog) ensureAuditEntries();

    container.innerHTML = `
        <section id="editor-view" aria-labelledby="editor-heading">
            <h2 id="editor-heading" tabindex="-1">${escapeHtml(editorHeading)}</h2>
            <div id="editor-instructions" class="editor-instructions">
                <p>Fill in the audit report fields in the table.</p>
                <p>Use Add Entry to create another audit entry.</p>
                <p>Use Edit Entry to open options for moving or deleting entries.</p>
            </div>
            <p id="editor-select-help" class="sr-only">Use arrow keys to review select options.</p>
            ${renderMetadataPlainText()}
            <button id="btn-edit-metadata" type="button">Edit Metadata...</button>
            ${isAuditLog ? renderAuditTable(wcagCriteria) : renderSingleEntryEditor()}
            ${renderEditorActionBar()}
            <button id="btn-clear-report-data" type="button">Clear Report Data...</button>
            ${renderMetadataEditDialog()}
            ${renderClearDialog()}
            ${renderValidationDialog()}
            ${renderStatisticsDialog(getCurrentReportMetrics())}
        </section>
    `;

    const headingAfterRender = document.getElementById('editor-heading');

    let didApplyPendingEntryFocus = false;

    if (isAuditLog) {
        bindAuditTableEvents(wcagCriteria);
        didApplyPendingEntryFocus = focusPendingEntryControl();
    } else {
        container.querySelectorAll('[data-entry-index][data-field-index]').forEach((control) => {
            if (control.classList.contains('wcag-combobox')) {
                const entryIndex = Number(control.getAttribute('data-entry-index'));
                const fieldIndex = Number(control.getAttribute('data-field-index'));
                const label = document.getElementById(`editor-field-label-${fieldIndex}`);
                const input = control.querySelector('.wcag-combobox-input');
                if (input && label) input.setAttribute('aria-labelledby', label.id);
                attachWcagCombobox(control, wcagCriteria, entryIndex, fieldIndex);
                return;
            }
            const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
            control.addEventListener(eventName, (event) => {
                const fieldIndex = Number(event.target.getAttribute('data-field-index'));
                updateEditorFieldValue(fieldIndex, event.target.value);
            });
        });
    }

    bindEditorDialogEvents();

    if (pendingEditorFocusTargetId) {
        const target = document.getElementById(pendingEditorFocusTargetId);
        pendingEditorFocusTargetId = '';
        if (target) {
            window.setTimeout(() => {
                target.focus();
            }, 0);
        }
    } else if (preserveFocusId && !didApplyPendingEntryFocus) {
        const preserved = document.getElementById(preserveFocusId);
        if (preserved) {
            window.setTimeout(() => {
                preserved.focus();
            }, 0);
            return;
        }
    }

    if (headingAfterRender && !pendingEntryFocus && !didApplyPendingEntryFocus) {
        window.setTimeout(() => {
            headingAfterRender.focus();
        }, 0);
    }

}
