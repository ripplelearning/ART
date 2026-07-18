// reportBuilder.js
import { announce, appState, createUserTemplate, getBuiltInTemplates, getUserTemplates, updateHeader, addOrUpdateField, setEditMode, deleteField, moveField, saveCurrentReportToUserTemplate, saveState, upsertCurrentReport } from './state.js';
import { getAvailableWcagStandards, getWcagCriteriaForStandard, isWcagCriterionFieldType } from './wcagCatalog.js';

let pendingFocus = null;
let pendingDelete = null;

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function getFieldTypeLabel(type) {
    const normalizedType = normalizeFieldType(type);
    if (normalizedType === 'textarea') return 'Textarea';
    if (normalizedType === 'dropdown') return 'Dropdown';
    if (isWcagCriterionFieldType(normalizedType)) return 'WCAG Success Criterion';
    return 'Text';
}

function getFieldOptionsText(field) {
    return Array.isArray(field?.dropdownOptions) ? field.dropdownOptions.join('\n') : '';
}

function getEditField() {
    return appState.editingIndex >= 0 ? appState.fields[appState.editingIndex] : null;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBrandingState() {
    return {
        enabled: Boolean(appState.branding?.enabled),
        headerText: String(appState.branding?.headerText || ''),
        primaryColor: String(appState.branding?.primaryColor || '#005a9c'),
        logoDataUrl: String(appState.branding?.logoDataUrl || ''),
        logoAltText: String(appState.branding?.logoAltText || ''),
        logoDecorative: Boolean(appState.branding?.logoDecorative),
        logoFileName: String(appState.branding?.logoFileName || '')
    };
}

function validateBrandingInputs(shouldAnnounce = true) {
    const branding = getBrandingState();
    const errorEl = document.getElementById('branding-logo-alt-error');
    const altInput = document.getElementById('branding-logo-alt');

    const hasError = branding.enabled && branding.logoDataUrl && !branding.logoDecorative && !branding.logoAltText.trim();
    if (!hasError) {
        if (errorEl) errorEl.textContent = '';
        if (altInput) altInput.removeAttribute('aria-invalid');
        return true;
    }

    const msg = 'Logo alternative text is required when logo is not decorative.';
    if (errorEl) errorEl.textContent = msg;
    if (altInput) altInput.setAttribute('aria-invalid', 'true');
    if (shouldAnnounce) {
        announce(msg);
        if (altInput) altInput.focus();
    }
    return false;
}

function focusAfterRender() {
    if (!pendingFocus) return false;

    const { index, action } = pendingFocus;
    pendingFocus = null;

    if (
        action === 'template-name-input'
        || action === 'choose-template-select'
        || action === 'template-file-input'
        || action === 'template-option-select'
        || action === 'report-type-select'
        || action === 'btn-toggle-config'
        || action === 'report-layout-select'
        || action === 'branding-enabled'
    ) {
        const target = document.getElementById(action);
        if (target) {
            target.focus();
            return true;
        }
        return false;
    }

    if (action === 'field-label-input') {
        const fieldLabelInput = document.getElementById('field-label-input');
        if (fieldLabelInput) {
            fieldLabelInput.focus();
            return true;
        }
        return false;
    }

    if (action === 'btn-add-field') {
        const addButton = document.getElementById('btn-add-field');
        if (addButton) {
            addButton.focus();
            return true;
        }
        return false;
    }

    const selector = `[data-field-action="${action}"][data-field-index="${index}"]`;
    const button = document.querySelector(selector);
    if (button) {
        button.focus();
        return true;
    }
    return false;
}

function buildTemplateSelectionMarkup() {
    const builtIns = getBuiltInTemplates();
    const users = getUserTemplates();
    const sections = ['<option value="">Choose Template</option>'];

    if (builtIns.length > 0) {
        sections.push(`
            <optgroup label="Built-in templates">
                ${builtIns.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')}
            </optgroup>
        `);
    }

    if (users.length > 0) {
        sections.push(`
            <optgroup label="User templates">
                ${users.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')}
            </optgroup>
        `);
    }

    return sections.join('');
}

function showDeleteDialog(index) {
    pendingDelete = {
        index,
        field: appState.fields[index],
        trigger: document.getElementById(`btn-delete-${index}`)
    };

    const dialog = document.getElementById('delete-confirm-dialog');
    const message = document.getElementById('delete-confirm-message');
    if (!dialog || !message || !pendingDelete.field) return;

    message.textContent = `Are you sure you want to delete ${pendingDelete.field.label} from this report?`;
    dialog.hidden = false;
    const yesButton = document.getElementById('btn-delete-yes');
    if (yesButton) yesButton.focus();
}

function hideDeleteDialog(restoreFocus = true) {
    const dialog = document.getElementById('delete-confirm-dialog');
    if (dialog) dialog.hidden = true;

    if (restoreFocus && pendingDelete?.trigger) {
        pendingDelete.trigger.focus();
    }

    pendingDelete = null;
}

function handleDialogKeydown(event) {
    if (event.key === 'Escape' && !document.getElementById('delete-confirm-dialog')?.hidden) {
        event.preventDefault();
        hideDeleteDialog(true);
    }
}

function setupSelectAnnouncement(selectElement, label) {
    if (!selectElement) return;

    const announceCurrentOption = () => {
        const currentOption = selectElement.options[selectElement.selectedIndex];
        if (currentOption) {
            announce(`${label} ${currentOption.text}`);
        }
    };

    selectElement.addEventListener('focus', announceCurrentOption);
    selectElement.addEventListener('change', announceCurrentOption);
    selectElement.addEventListener('input', announceCurrentOption);
    selectElement.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
        window.setTimeout(announceCurrentOption, 20);
    });
}

export async function renderBuilder() {
    const container = document.getElementById('main-inner');
    const activeElementBeforeRender = document.activeElement;
    const preserveFocusId = !pendingFocus
        && activeElementBeforeRender
        && container?.contains(activeElementBeforeRender)
        && activeElementBeforeRender.id
        ? activeElementBeforeRender.id
        : '';
    const editField = getEditField();
    const editType = normalizeFieldType(editField?.type);
    const availableStandards = await getAvailableWcagStandards().catch(() => ['WCAG 2.2', 'WCAG 2.1']);
    const standardOptions = availableStandards.length > 0 ? availableStandards : ['WCAG 2.2', 'WCAG 2.1'];
    const wcagCriteria = await getWcagCriteriaForStandard(appState.standard).catch(() => []);
    const reportLayouts = {
        'Audit Log': ['Paragraphs', 'Tabular', 'Template'],
        'Executive Summary': ['Paragraphs', 'Bullets', 'Template']
    };
    const selectedLayouts = appState.reportType ? reportLayouts[appState.reportType] || [] : [];
    const templateOptions = appState.reportType === 'Audit Log'
        ? [{ value: 'Create Template', label: 'Create Template' }, { value: 'Choose Template', label: 'Choose Template' }]
        : appState.reportType === 'Executive Summary'
            ? [{ value: 'Create New', label: 'Create New' }, { value: 'Upload from File', label: 'Upload from File' }]
            : [];
    const showTemplateSection = appState.reportLayout === 'Template' && !!appState.reportType;
    const branding = getBrandingState();

    container.innerHTML = `
        <section id="builder-view" aria-labelledby="builder-heading">
            <h2 id="builder-heading" tabindex="-1">Report Builder</h2>
            <h3 id="builder-metadata-heading" tabindex="-1">Report Metadata</h3>
            <p id="builder-select-help" class="sr-only">Use Up and Down arrow keys to review options, then Enter to confirm.</p>
            <div class="metadata-grid">
                <label>Report Title: <input type="text" id="report-title" value="${appState.reportTitle || ''}"></label>
                <label>Organization/Client: <input type="text" id="org-client" value="${appState.orgClient || ''}"></label>
                <label>Project Name: <input type="text" id="project-name" value="${appState.projectName || ''}"></label>
                <label>URL / Scope: <input type="text" id="scope-url" value="${appState.scopeUrl || ''}"></label>
                <label>Audit Start: <input type="date" id="date-start" value="${appState.auditDateStart || ''}"></label>
                <label>Audit End: <input type="date" id="date-end" value="${appState.auditDateEnd || ''}"></label>
                <label>Auditor(s): <input type="text" id="auditors" value="${appState.auditors || ''}"></label>
                <label>Accessibility Standard:
                    <select id="standard-select" aria-label="Accessibility Standard" aria-describedby="builder-select-help">
                        ${standardOptions.map((standard) => `<option value="${escapeHtml(standard)}" ${appState.standard === standard ? 'selected' : ''}>${escapeHtml(standard)}</option>`).join('')}
                    </select>
                </label>
                <label>Testing Instructions: <textarea id="testing-instructions">${appState.testingInstructions || ''}</textarea></label>
                <div>
                    <label for="report-type-select">Report Type</label>
                    <select id="report-type-select" aria-describedby="builder-select-help">
                        <option value="" ${!appState.reportType ? 'selected' : ''}>Select Report Type</option>
                        <option value="Audit Log" ${appState.reportType === 'Audit Log' ? 'selected' : ''}>Audit Log</option>
                        <option value="Executive Summary" ${appState.reportType === 'Executive Summary' ? 'selected' : ''}>Executive Summary</option>
                    </select>
                </div>
                <div>
                    <label for="report-layout-select">Report Layout</label>
                    <select id="report-layout-select" aria-describedby="builder-select-help" ${appState.reportType ? '' : 'disabled'}>
                        <option value="" ${!appState.reportLayout ? 'selected' : ''}>Select Report Layout</option>
                        ${selectedLayouts.map((layout) => `<option value="${layout}" ${appState.reportLayout === layout ? 'selected' : ''}>${layout}</option>`).join('')}
                    </select>
                </div>
            </div>

            <section class="branding-config" aria-labelledby="branding-config-heading">
                <h3 id="branding-config-heading">Report Branding</h3>
                <label class="branding-toggle">
                    <input type="checkbox" id="branding-enabled" ${branding.enabled ? 'checked' : ''}>
                    Enable branding
                </label>

                <div id="branding-controls" ${branding.enabled ? '' : 'hidden'}>
                    <label>Brand Header Text: <input type="text" id="branding-header-text" value="${escapeHtml(branding.headerText)}"></label>
                    <label>Primary Brand Color: <input type="color" id="branding-primary-color" value="${escapeHtml(branding.primaryColor)}"></label>
                    <label>Brand Logo: <input type="file" id="branding-logo-file" accept="image/*"></label>
                    <p id="branding-logo-file-name">${branding.logoFileName ? `Selected logo: ${escapeHtml(branding.logoFileName)}` : 'No logo selected'}</p>
                    ${branding.logoDataUrl ? '<button id="branding-remove-logo" type="button">Remove Logo</button>' : ''}
                    <label class="branding-toggle">
                        <input type="checkbox" id="branding-logo-decorative" ${branding.logoDecorative ? 'checked' : ''} ${branding.logoDataUrl ? '' : 'disabled'}>
                        Logo is decorative
                    </label>
                    <label>Logo Alternative Text:
                        <input type="text" id="branding-logo-alt" value="${escapeHtml(branding.logoAltText)}" aria-describedby="branding-logo-alt-help branding-logo-alt-error" ${branding.logoDataUrl && !branding.logoDecorative ? '' : 'disabled'}>
                    </label>
                    <p id="branding-logo-alt-help">Use concise text such as Apple logo when the logo conveys brand identity.</p>
                    <p id="branding-logo-alt-error" class="branding-error" role="status" aria-live="polite"></p>
                    ${branding.logoDataUrl ? `<img class="branding-preview" src="${escapeHtml(branding.logoDataUrl)}" ${branding.logoDecorative ? 'alt=""' : `alt="${escapeHtml(branding.logoAltText || 'Brand logo')}"`} />` : ''}
                </div>
            </section>

            ${showTemplateSection ? `
                <div id="template-config-section" class="template-config">
                    <label>Template Option:
                        <select id="template-option-select" aria-label="Template Option" aria-describedby="builder-select-help">
                            <option value="" ${!appState.templateOption ? 'selected' : ''}>Select Option</option>
                            ${templateOptions.map((option) => `<option value="${option.value}" ${appState.templateOption === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                        </select>
                    </label>
                    ${appState.templateOption === 'Create Template' || appState.templateOption === 'Create New' ? `
                        <label>Template Name: <input type="text" id="template-name-input" value="${appState.templateName || ''}"></label>
                        <label>Template Description: <textarea id="template-description-input">${appState.templateDescription || ''}</textarea></label>
                    ` : ''}
                    ${appState.templateOption === 'Choose Template' ? `
                        <label>Choose Template: <select id="choose-template-select" aria-label="Choose Template" aria-describedby="builder-select-help">${buildTemplateSelectionMarkup()}</select></label>
                    ` : ''}
                    ${appState.templateOption === 'Upload from File' ? `
                        <label>Upload from File: <input type="file" id="template-file-input"></label>
                    ` : ''}
                </div>
            ` : ''}

            <button id="btn-toggle-config" type="button" aria-expanded="${appState.fieldsExpanded}" aria-controls="fields-section">
                ${appState.fieldsExpanded ? 'Hide Field Configuration' : 'Configure Report Fields'}
            </button>
            
            <section id="fields-section" ${appState.fieldsExpanded ? '' : 'hidden'}>
                <h3>Report Fields</h3>
                <label for="field-label-input">Field Name</label>
                <input type="text" id="field-label-input" value="${editField?.label || ''}">
                <label for="field-type-input">Field Type</label>
                <select id="field-type-input" aria-label="Field Type" aria-describedby="builder-select-help">
                    <option value="text" ${editType === 'text' ? 'selected' : ''}>Text</option>
                    <option value="textarea" ${editType === 'textarea' ? 'selected' : ''}>Textarea</option>
                    <option value="dropdown" ${editType === 'dropdown' ? 'selected' : ''}>Dropdown</option>
                    <option value="wcag-success-criterion" ${isWcagCriterionFieldType(editType) ? 'selected' : ''}>WCAG Success Criterion</option>
                </select>
                <div id="dropdown-options-container" ${editType === 'dropdown' ? '' : 'hidden'}>
                    <label for="field-dropdown-options-input">Dropdown Options</label>
                    <p id="dropdown-options-help">Type each entry for the dropdown on a new line.</p>
                    <textarea id="field-dropdown-options-input" aria-describedby="dropdown-options-help">${getFieldOptionsText(editField)}</textarea>
                </div>
                <div id="wcag-options-container" ${isWcagCriterionFieldType(editType) ? '' : 'hidden'}>
                    <label for="wcag-options-preview">WCAG Success Criteria Preview</label>
                    <p id="wcag-options-help">The Report Editor will provide a searchable combobox using the currently selected accessibility standard.</p>
                    <select id="wcag-options-preview" size="6" aria-describedby="wcag-options-help" disabled>
                        ${wcagCriteria.map((criterion) => `<option>${escapeHtml(`${criterion.number} ${criterion.title}`)}</option>`).join('')}
                    </select>
                </div>
                <table>
                    <thead><tr><th scope="col">Field Label</th><th scope="col">Field Type</th><th scope="col">Actions</th></tr></thead>
                    <tbody id="fields-tbody"></tbody>
                </table>
                <button id="btn-add-field" type="button">${appState.editingIndex === -1 ? 'Add Field' : 'Apply Changes'}</button>
                <div id="delete-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-message" hidden>
                    <p id="delete-confirm-message"></p>
                    <button id="btn-delete-yes" type="button">Yes</button>
                    <button id="btn-delete-no" type="button">No</button>
                </div>
            </section>
            ${appState.templateEditingId ? '<button id="btn-save-template-changes" type="button">Apply Template Changes</button>' : ''}
            <button id="btn-done" type="button">Done</button>
        </section>
    `;

    // --- Listeners ---
    const toggleConfigButton = document.getElementById('btn-toggle-config');
    if (toggleConfigButton) {
        toggleConfigButton.onclick = () => {
            appState.fieldsExpanded = !appState.fieldsExpanded;
            saveState();
            renderBuilder();
        };
    }

    const metadataFields = [
        ['report-title', 'reportTitle'],
        ['org-client', 'orgClient'],
        ['project-name', 'projectName'],
        ['scope-url', 'scopeUrl'],
        ['date-start', 'auditDateStart'],
        ['date-end', 'auditDateEnd'],
        ['auditors', 'auditors'],
        ['testing-instructions', 'testingInstructions']
    ];

    metadataFields.forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => updateHeader(key, e.target.value));
        }
    });

    const standardSelect = document.getElementById('standard-select');
    if (standardSelect) {
        standardSelect.addEventListener('change', (e) => {
            updateHeader('standard', e.target.value);
            window.dispatchEvent(new CustomEvent('art-standard-changed', {
                detail: { standard: e.target.value }
            }));
            if (isWcagCriterionFieldType(document.getElementById('field-type-input')?.value)) {
                renderBuilder();
            }
        });
    }

    const brandingEnabled = document.getElementById('branding-enabled');
    if (brandingEnabled) {
        brandingEnabled.addEventListener('change', (e) => {
            appState.branding = {
                ...getBrandingState(),
                enabled: e.target.checked
            };
            saveState();
            renderBuilder();
        });
    }

    const brandingHeaderText = document.getElementById('branding-header-text');
    if (brandingHeaderText) {
        brandingHeaderText.addEventListener('input', (e) => {
            appState.branding = {
                ...getBrandingState(),
                headerText: e.target.value
            };
            saveState();
        });
    }

    const brandingPrimaryColor = document.getElementById('branding-primary-color');
    if (brandingPrimaryColor) {
        brandingPrimaryColor.addEventListener('input', (e) => {
            appState.branding = {
                ...getBrandingState(),
                primaryColor: e.target.value
            };
            saveState();
        });
    }

    const brandingLogoDecorative = document.getElementById('branding-logo-decorative');
    if (brandingLogoDecorative) {
        brandingLogoDecorative.addEventListener('change', (e) => {
            appState.branding = {
                ...getBrandingState(),
                logoDecorative: e.target.checked
            };
            saveState();
            renderBuilder();
        });
    }

    const brandingLogoAlt = document.getElementById('branding-logo-alt');
    if (brandingLogoAlt) {
        brandingLogoAlt.addEventListener('input', (e) => {
            appState.branding = {
                ...getBrandingState(),
                logoAltText: e.target.value
            };
            saveState();
            validateBrandingInputs(false);
        });
    }

    const brandingLogoFile = document.getElementById('branding-logo-file');
    if (brandingLogoFile) {
        brandingLogoFile.addEventListener('change', async (e) => {
            const selectedFile = e.target.files && e.target.files[0];
            if (!selectedFile) return;

            try {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('read-failed'));
                    reader.readAsDataURL(selectedFile);
                });

                appState.branding = {
                    ...getBrandingState(),
                    logoDataUrl: dataUrl,
                    logoFileName: selectedFile.name
                };
                saveState();
                announce('Logo selected. Add alternative text or mark as decorative.');
                renderBuilder();
            } catch (error) {
                announce('Could not read logo file.');
            }
        });
    }

    const brandingRemoveLogo = document.getElementById('branding-remove-logo');
    if (brandingRemoveLogo) {
        brandingRemoveLogo.addEventListener('click', () => {
            appState.branding = {
                ...getBrandingState(),
                logoDataUrl: '',
                logoFileName: '',
                logoAltText: '',
                logoDecorative: false
            };
            saveState();
            announce('Logo removed.');
            renderBuilder();
        });
    }

    validateBrandingInputs(false);

    const reportTypeSelect = document.getElementById('report-type-select');
    if (reportTypeSelect) {
        setupSelectAnnouncement(reportTypeSelect, 'Report Type');
        reportTypeSelect.addEventListener('change', (e) => {
            appState.reportType = e.target.value;
            appState.reportLayout = '';
            appState.templateOption = '';
            appState.templateName = '';
            appState.templateDescription = '';
            saveState();
            pendingFocus = { index: null, action: 'report-type-select' };
            renderBuilder();
        });
    }

    const reportLayoutSelect = document.getElementById('report-layout-select');
    if (reportLayoutSelect) {
        setupSelectAnnouncement(reportLayoutSelect, 'Report Layout');
        reportLayoutSelect.addEventListener('change', (e) => {
            appState.reportLayout = e.target.value;
            if (appState.reportLayout !== 'Template') {
                appState.templateOption = '';
                appState.templateName = '';
                appState.templateDescription = '';
                saveState();
                pendingFocus = { index: null, action: 'report-layout-select' };
                renderBuilder();
                return;
            }
            saveState();
            pendingFocus = { index: null, action: 'report-layout-select' };
            renderBuilder();
        });
    }

    const templateOptionSelect = document.getElementById('template-option-select');
    if (templateOptionSelect) {
        setupSelectAnnouncement(templateOptionSelect, 'Template Option');
        templateOptionSelect.addEventListener('change', (e) => {
            appState.templateOption = e.target.value;
            if (e.target.value !== 'Create Template' && e.target.value !== 'Create New') {
                appState.templateName = '';
                appState.templateDescription = '';
            }
            saveState();
            pendingFocus = { index: null, action: 'template-option-select' };
            renderBuilder();
        });
    }

    const chooseTemplateSelect = document.getElementById('choose-template-select');
    if (chooseTemplateSelect) {
        setupSelectAnnouncement(chooseTemplateSelect, 'Choose Template');
    }

    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput) {
        templateNameInput.addEventListener('input', (e) => {
            appState.templateName = e.target.value;
            saveState();
        });
    }

    const templateDescriptionInput = document.getElementById('template-description-input');
    if (templateDescriptionInput) {
        templateDescriptionInput.addEventListener('input', (e) => {
            appState.templateDescription = e.target.value;
            saveState();
        });
    }

    const fieldTypeInput = document.getElementById('field-type-input');
    const dropdownOptionsContainer = document.getElementById('dropdown-options-container');
    const wcagOptionsContainer = document.getElementById('wcag-options-container');
    if (fieldTypeInput && dropdownOptionsContainer && wcagOptionsContainer) {
        setupSelectAnnouncement(fieldTypeInput, 'Field Type');
        const commitFieldType = () => {
            dropdownOptionsContainer.hidden = fieldTypeInput.value !== 'dropdown';
            wcagOptionsContainer.hidden = !isWcagCriterionFieldType(fieldTypeInput.value);
        };
        fieldTypeInput.addEventListener('change', (e) => {
            appState.fieldsExpanded = true;
            saveState();
            commitFieldType();
        });
        fieldTypeInput.addEventListener('blur', commitFieldType);
        commitFieldType();
    }

    document.getElementById('btn-add-field').addEventListener('click', () => {
        const isAdding = appState.editingIndex === -1;
        addOrUpdateField();
        if (isAdding) {
            pendingFocus = { index: null, action: 'field-label-input' };
        }
        renderBuilder();
    });

    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (deleteDialog) {
        deleteDialog.addEventListener('keydown', handleDialogKeydown);
    }

    const deleteYesButton = document.getElementById('btn-delete-yes');
    if (deleteYesButton) {
        deleteYesButton.addEventListener('click', () => {
            if (!pendingDelete) return;

            const deleteIndex = pendingDelete.index;
            const nextIndex = deleteIndex < appState.fields.length - 1 ? deleteIndex : deleteIndex - 1;
            deleteField(deleteIndex);
            hideDeleteDialog(false);
            if (nextIndex >= 0) {
                pendingFocus = { index: nextIndex, action: 'delete' };
            } else {
                pendingFocus = { index: null, action: 'btn-add-field' };
            }
            renderBuilder();
        });
    }

    const deleteNoButton = document.getElementById('btn-delete-no');
    if (deleteNoButton) {
        deleteNoButton.addEventListener('click', () => hideDeleteDialog(true));
    }

    const doneButton = document.getElementById('btn-done');
    if (doneButton) {
        doneButton.addEventListener('click', () => {
            if (!validateBrandingInputs(true)) return;

            if (appState.templateCreateMode) {
                const baseName = (appState.templateName || appState.reportTitle || 'Untitled Template').trim();
                const existing = new Set((appState.userTemplates || []).map((t) => String(t.name || '').toLowerCase()));
                let resolvedName = baseName || 'Untitled Template';
                let suffix = 2;
                while (existing.has(resolvedName.toLowerCase())) {
                    resolvedName = `${baseName || 'Untitled Template'} ${suffix}`;
                    suffix += 1;
                }

                const created = createUserTemplate(resolvedName);
                if (created) {
                    appState.lastCreatedTemplateId = created.id;
                    appState.templateCreateMode = false;
                    announce(`${created.name} template created`);
                    window.dispatchEvent(new Event('art-templates-updated'));
                }
            }

            if (appState.templateEditingId && appState.templateEditingId.startsWith('user-')) {
                const updated = saveCurrentReportToUserTemplate(appState.templateEditingId);
                if (updated) {
                    appState.lastCreatedTemplateId = updated.id;
                    window.dispatchEvent(new Event('art-templates-updated'));
                }
            }
            appState.editorUsesReportTitle = true;
            appState.editorReadOnly = false;
            appState.templateEditingId = null;
            saveState({ action: 'Completed report configuration' });
            upsertCurrentReport({ name: appState.reportTitle || appState.templateName || 'Untitled Report' });
            window.dispatchEvent(new Event('art-reports-updated'));
            announce('Report moved to Editor.');
            const editorTab = document.getElementById('tab-editor');
            if (editorTab) editorTab.click();
            window.setTimeout(() => {
                const editorHeading = document.getElementById('editor-heading');
                if (editorHeading) editorHeading.focus();
            }, 30);
        });
    }

    const saveTemplateChangesButton = document.getElementById('btn-save-template-changes');
    if (saveTemplateChangesButton) {
        saveTemplateChangesButton.addEventListener('click', () => {
            if (!validateBrandingInputs(true)) return;
            if (!appState.templateEditingId) return;
            const updated = saveCurrentReportToUserTemplate(appState.templateEditingId);
            if (!updated) return;
            appState.lastCreatedTemplateId = updated.id;
            saveState();
            window.dispatchEvent(new Event('art-templates-updated'));
            announce(`${updated.name} template changes saved`);
        });
    }

    // Populate Table Logic
    const tbody = document.getElementById('fields-tbody');
    if (tbody) {
        appState.fields.forEach((f, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${f.label}</td><td>${getFieldTypeLabel(f.type)}</td>
                <td id="actions-${i}"></td>`;
            tbody.appendChild(tr);

            const btnEdit = document.createElement('button');
            btnEdit.innerText = 'Edit';
            btnEdit.id = `btn-edit-${i}`;
            btnEdit.dataset.fieldAction = 'edit';
            btnEdit.dataset.fieldIndex = String(i);
            btnEdit.setAttribute('aria-label', `Edit ${f.label}`);
            btnEdit.onclick = () => { setEditMode(i); pendingFocus = { index: null, action: 'field-label-input' }; renderBuilder(); };

            const btnMoveUp = document.createElement('button');
            btnMoveUp.innerText = 'Move Up';
            btnMoveUp.id = `btn-move-up-${i}`;
            btnMoveUp.dataset.fieldAction = 'move-edit';
            btnMoveUp.dataset.fieldIndex = String(i - 1 >= 0 ? i - 1 : i);
            btnMoveUp.setAttribute('aria-label', `Move ${f.label} Up`);
            btnMoveUp.disabled = i === 0;
            btnMoveUp.onclick = () => {
                const newIndex = moveField(i, -1);
                if (newIndex === undefined) return;
                pendingFocus = { index: newIndex, action: 'edit' };
                renderBuilder();
            };

            const btnMoveDown = document.createElement('button');
            btnMoveDown.innerText = 'Move Down';
            btnMoveDown.id = `btn-move-down-${i}`;
            btnMoveDown.dataset.fieldAction = 'move-edit';
            btnMoveDown.dataset.fieldIndex = String(i + 1 < appState.fields.length ? i + 1 : i);
            btnMoveDown.setAttribute('aria-label', `Move ${f.label} Down`);
            btnMoveDown.disabled = i === appState.fields.length - 1;
            btnMoveDown.onclick = () => {
                const newIndex = moveField(i, 1);
                if (newIndex === undefined) return;
                pendingFocus = { index: newIndex, action: 'edit' };
                renderBuilder();
            };
            
            const btnDelete = document.createElement('button');
            btnDelete.innerText = 'Delete';
            btnDelete.id = `btn-delete-${i}`;
            btnDelete.dataset.fieldAction = 'delete';
            btnDelete.dataset.fieldIndex = String(i);
            btnDelete.setAttribute('aria-label', `Delete ${f.label}`);
            btnDelete.onclick = () => { showDeleteDialog(i); };

            document.getElementById(`actions-${i}`).append(btnMoveUp, btnMoveDown, btnEdit, btnDelete);
        });
    }

    const didApplyPendingFocus = focusAfterRender();
    if (!didApplyPendingFocus && preserveFocusId) {
        const focusTarget = document.getElementById(preserveFocusId);
        if (focusTarget) focusTarget.focus();
    }
}
