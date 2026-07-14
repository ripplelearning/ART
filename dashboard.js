// dashboard.js

import {
    announce,
    appState,
    createUserTemplateFromSelection,
    deleteUserTemplate,
    getBuiltInTemplates,
    getTemplateById,
    getUserTemplates,
    importArtJsonPayload,
    loadTemplate,
    resetReportToBlank,
    saveState,
    validateArtJsonPayload
} from './state.js';

function moveFocusToBuilderMetadataHeading() {
    const metadataHeading = document.getElementById('builder-metadata-heading');
    if (metadataHeading) metadataHeading.focus();
}

function moveFocusToBuilderHeading() {
    const builderHeading = document.getElementById('builder-heading');
    if (builderHeading) builderHeading.focus();
}

function moveFocusToEditorHeading() {
    const editorHeading = document.getElementById('editor-heading');
    if (editorHeading) editorHeading.focus();
}

function buildTemplateOptions(selectEl) {
    const builtIns = getBuiltInTemplates();
    const users = getUserTemplates();
    const current = selectEl.value;

    const optionSections = [`<option value="scratch">Start from Scratch</option>`];

    if (builtIns.length > 0) {
        optionSections.push(`
            <optgroup label="Built-in templates">
                ${builtIns.map((template) => `<option value="${template.id}">${template.name}</option>`).join('')}
            </optgroup>
        `);
    }

    if (users.length > 0) {
        optionSections.push(`
            <optgroup label="User templates">
                ${users.map((template) => `<option value="${template.id}">${template.name}</option>`).join('')}
            </optgroup>
        `);
    }

    selectEl.innerHTML = optionSections.join('');
    const validValue = [...selectEl.options].some((option) => option.value === current);
    selectEl.value = validValue ? current : 'scratch';
}

function updateTemplateButtons(selectEl, buttons) {
    const isScratch = selectEl.value === 'scratch';
    const isUserTemplate = !!selectEl.value && selectEl.value.startsWith('user-');

    buttons.create.hidden = !isScratch;
    buttons.use.hidden = isScratch;
    buttons.open.hidden = isScratch;
    buttons.edit.hidden = isScratch;
    buttons.delete.hidden = !isUserTemplate;
}

function getDialogFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

/**
 * Initializes the dashboard buttons.
 * This is called by loader.js once the DOM is ready.
 */
export function renderDashboard() {
    const btnNew = document.getElementById('btn-new-report');
    const btnOpenReport = document.getElementById('btn-open-report');
    const builderTab = document.getElementById('tab-builder');
    const editorTab = document.getElementById('tab-editor');
    const viewerTab = document.getElementById('tab-view');
    const templateSelect = document.getElementById('template-selection');
    const btnCreate = document.getElementById('btn-template-create');
    const btnUse = document.getElementById('btn-template-use');
    const btnOpen = document.getElementById('btn-template-open');
    const btnEdit = document.getElementById('btn-template-edit');
    const btnDelete = document.getElementById('btn-template-delete');
    const deleteDialog = document.getElementById('template-delete-dialog');
    const deleteMessage = document.getElementById('template-delete-message');
    const btnDeleteYes = document.getElementById('btn-template-delete-yes');
    const btnDeleteNo = document.getElementById('btn-template-delete-no');
    const createDialog = document.getElementById('template-create-dialog');
    const createNameInput = document.getElementById('template-create-name');
    const btnCreateSave = document.getElementById('btn-template-create-save');
    const btnCreateCancel = document.getElementById('btn-template-create-cancel');
    const editConfirmDialog = document.getElementById('template-edit-confirm-dialog');
    const editConfirmMessage = document.getElementById('template-edit-confirm-message');
    const btnEditYes = document.getElementById('btn-template-edit-yes');
    const btnEditNo = document.getElementById('btn-template-edit-no');

    if (
        !btnNew || !btnOpenReport || !builderTab || !editorTab || !templateSelect || !btnCreate || !btnUse || !btnOpen || !btnEdit || !btnDelete
        || !deleteDialog || !deleteMessage || !btnDeleteYes || !btnDeleteNo
        || !createDialog || !createNameInput || !btnCreateSave || !btnCreateCancel
        || !editConfirmDialog || !editConfirmMessage || !btnEditYes || !btnEditNo
    ) return;

    const openReportInput = document.createElement('input');
    openReportInput.type = 'file';
    openReportInput.accept = '.json,application/json';
    openReportInput.hidden = true;
    openReportInput.tabIndex = -1;
    openReportInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(openReportInput);

    const openStatus = document.createElement('p');
    openStatus.id = 'open-report-status';
    openStatus.className = 'open-report-status';
    openStatus.setAttribute('role', 'status');
    openStatus.setAttribute('aria-live', 'polite');
    const actionGroup = btnOpenReport.parentElement;
    if (actionGroup && actionGroup.parentElement) {
        actionGroup.parentElement.insertBefore(openStatus, actionGroup.nextSibling);
    }

    const reasonMap = {
        'invalid-json': 'File is not valid JSON.',
        'invalid-payload': 'JSON payload is not in ART format.',
        'missing-required-header': 'ART header is missing or invalid.',
        'missing-integrity': 'ART integrity metadata is missing.',
        'missing-report-state': 'ART report data is missing.',
        'checksum-mismatch': 'ART file appears modified or corrupted.',
        'ok': 'ART JSON precheck passed.'
    };

    const reportPrecheckStatus = (text) => {
        openStatus.textContent = text;
        announce(text);
    };

    btnOpenReport.addEventListener('click', () => {
        openReportInput.value = '';
        openReportInput.click();
    });

    openReportInput.addEventListener('change', async () => {
        const selectedFile = openReportInput.files && openReportInput.files[0];
        if (!selectedFile) return;

        try {
            const fileText = await selectedFile.text();
            const precheck = validateArtJsonPayload(fileText);
            if (!precheck.isValid) {
                const detail = reasonMap[precheck.reason] || 'Unknown validation error.';
                reportPrecheckStatus(`Precheck failed for ${selectedFile.name}. ${detail}`);
                return;
            }

            const importResult = importArtJsonPayload(fileText);
            if (importResult.isValid) {
                window.dispatchEvent(new Event('art-templates-updated'));
                reportPrecheckStatus(`Imported ${selectedFile.name} successfully.`);
                if (viewerTab) {
                    viewerTab.click();
                    window.setTimeout(() => {
                        const viewerHeading = document.getElementById('viewer-heading');
                        if (viewerHeading) viewerHeading.focus();
                    }, 0);
                }
            } else {
                const detail = reasonMap[importResult.reason] || 'Unknown import validation error.';
                reportPrecheckStatus(`Import failed for ${selectedFile.name}. ${detail}`);
            }
        } catch (error) {
            reportPrecheckStatus(`Precheck failed for ${selectedFile.name}. Could not read file.`);
        }
    });

    const buttons = {
        create: btnCreate,
        use: btnUse,
        open: btnOpen,
        edit: btnEdit,
        delete: btnDelete
    };
    let pendingDeleteTemplateId = null;
    let pendingCreateSourceTemplateId = null;
    let pendingEditTemplateId = null;
    let activeDialog = null;

    const focusEditorHeadingSoon = () => {
        // Render is triggered by tab click; defer focus until DOM is updated.
        window.setTimeout(() => {
            moveFocusToEditorHeading();
        }, 0);
    };

    const closeEditConfirmDialog = (restoreFocus = true) => {
        editConfirmDialog.hidden = true;
        pendingEditTemplateId = null;
        activeDialog = null;
        if (restoreFocus) btnEdit.focus();
    };

    const openDialog = (dialog, focusTarget, triggerButton) => {
        activeDialog = { dialog, triggerButton };
        dialog.hidden = false;
        window.setTimeout(() => {
            if (focusTarget) {
                focusTarget.focus();
                return;
            }

            const focusables = getDialogFocusableElements(dialog);
            if (focusables[0]) focusables[0].focus();
        }, 0);
    };

    const closeDialog = (dialog, restoreFocus = true) => {
        dialog.hidden = true;
        if (activeDialog?.dialog === dialog) {
            const trigger = activeDialog.triggerButton;
            activeDialog = null;
            if (restoreFocus && trigger) trigger.focus();
        }
    };

    const trapActiveDialogFocus = (event) => {
        if (!activeDialog || activeDialog.dialog.hidden) return;
        if (event.type === 'focusin') {
            if (!activeDialog.dialog.contains(event.target)) {
                const focusables = getDialogFocusableElements(activeDialog.dialog);
                if (focusables[0]) focusables[0].focus();
            }
            return;
        }

        if (event.key !== 'Tab' && event.key !== 'Escape') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            if (activeDialog.dialog.id === 'template-create-dialog') {
                pendingCreateSourceTemplateId = null;
                closeDialog(activeDialog.dialog, true);
                btnCreate.focus();
                return;
            }
            if (activeDialog.dialog.id === 'template-delete-dialog') {
                pendingDeleteTemplateId = null;
                closeDialog(activeDialog.dialog, true);
                btnDelete.focus();
                return;
            }
            if (activeDialog.dialog.id === 'template-edit-confirm-dialog') {
                closeEditConfirmDialog(true);
            }
            return;
        }

        const focusables = getDialogFocusableElements(activeDialog.dialog);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = event.target;

        if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    };

    document.addEventListener('keydown', trapActiveDialogFocus);
    document.addEventListener('focusin', trapActiveDialogFocus);

    const continueEditTemplate = (templateId) => {
        const loaded = loadTemplate(templateId);
        if (!loaded) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        appState.templateCreateMode = false;
        appState.templateEditingId = templateId;
        saveState();
        builderTab.click();
        moveFocusToBuilderHeading();
    };

    const continueCreateFromTemplate = (templateId, templateName) => {
        const loaded = loadTemplate(templateId);
        if (!loaded) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        appState.templateCreateMode = true;
        appState.templateEditingId = null;
        appState.templateName = templateName;
        saveState();
        builderTab.click();
        moveFocusToBuilderHeading();
    };

    buildTemplateOptions(templateSelect);
    if (appState.lastCreatedTemplateId && [...templateSelect.options].some((option) => option.value === appState.lastCreatedTemplateId)) {
        templateSelect.value = appState.lastCreatedTemplateId;
    }
    updateTemplateButtons(templateSelect, buttons);

    window.addEventListener('art-templates-updated', () => {
        const current = templateSelect.value;
        buildTemplateOptions(templateSelect);
        if (appState.lastCreatedTemplateId && [...templateSelect.options].some((option) => option.value === appState.lastCreatedTemplateId)) {
            templateSelect.value = appState.lastCreatedTemplateId;
        } else if ([...templateSelect.options].some((option) => option.value === current)) {
            templateSelect.value = current;
        }
        updateTemplateButtons(templateSelect, buttons);
    });

    const announceCurrentTemplateSelection = () => {
        const currentOption = templateSelect.options[templateSelect.selectedIndex];
        if (currentOption) {
            announce(`Template selection ${currentOption.text}`);
        }
    };

    btnNew.addEventListener('click', () => {
        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        saveState();
        builderTab.click();
        moveFocusToBuilderMetadataHeading();
    });

    templateSelect.addEventListener('change', () => {
        updateTemplateButtons(templateSelect, buttons);
        announceCurrentTemplateSelection();
    });

    templateSelect.addEventListener('input', () => {
        announceCurrentTemplateSelection();
    });

    templateSelect.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
        window.setTimeout(() => announceCurrentTemplateSelection(), 20);
    });

    templateSelect.addEventListener('focus', () => {
        announceCurrentTemplateSelection();
    });

    btnCreate.addEventListener('click', () => {
        if (templateSelect.value === 'scratch') {
            resetReportToBlank();
            appState.editorUsesReportTitle = false;
            appState.editorReadOnly = false;
            appState.templateCreateMode = true;
            appState.templateEditingId = null;
            saveState();
            builderTab.click();
            moveFocusToBuilderHeading();
            return;
        }

        const sourceTemplate = getTemplateById(templateSelect.value);
        if (!sourceTemplate) return;

        pendingCreateSourceTemplateId = sourceTemplate.id;
        createNameInput.value = `${sourceTemplate.name} Copy`;
        openDialog(createDialog, createNameInput, btnCreate);
    });

    btnCreateSave.addEventListener('click', () => {
        if (!pendingCreateSourceTemplateId) return;
        const templateName = createNameInput.value.trim();
        if (!templateName) {
            createNameInput.focus();
            return;
        }

        closeDialog(createDialog, false);
        const sourceTemplateId = pendingCreateSourceTemplateId;
        pendingCreateSourceTemplateId = null;
        continueCreateFromTemplate(sourceTemplateId, templateName);
    });

    btnCreateCancel.addEventListener('click', () => {
        closeDialog(createDialog, true);
        pendingCreateSourceTemplateId = null;
        btnCreate.focus();
    });

    btnOpen.addEventListener('click', () => {
        const selected = loadTemplate(templateSelect.value);
        if (!selected) return;

        appState.editorUsesReportTitle = true;
        appState.editorReadOnly = true;
        appState.templateCreateMode = false;
        appState.templateEditingId = null;
        saveState();
        editorTab.click();
        focusEditorHeadingSoon();
    });

    btnUse.addEventListener('click', () => {
        const selected = loadTemplate(templateSelect.value);
        if (!selected) return;

        appState.editorUsesReportTitle = false;
        appState.editorReadOnly = false;
        // Using a template is the "create from existing" workflow.
        appState.templateCreateMode = true;
        appState.templateEditingId = null;
        saveState();
        builderTab.click();
        moveFocusToBuilderMetadataHeading();
    });

    btnEdit.addEventListener('click', () => {
        let selectedTemplateId = templateSelect.value;
        const selected = getTemplateById(selectedTemplateId);
        if (!selected) return;

        if (!selected.id.startsWith('user-')) {
            pendingEditTemplateId = selected.id;
            editConfirmMessage.textContent = `Editing ${selected.name} creates an editable user copy. Continue?`;
            openDialog(editConfirmDialog, btnEditYes, btnEdit);
            return;
        }

        continueEditTemplate(selectedTemplateId);
    });

    btnEditYes.addEventListener('click', () => {
        if (!pendingEditTemplateId) return;
        const sourceTemplate = getTemplateById(pendingEditTemplateId);
        if (!sourceTemplate) {
            closeEditConfirmDialog(true);
            return;
        }

        const editableCopy = createUserTemplateFromSelection(sourceTemplate.id, `${sourceTemplate.name} Editable Copy`);
        if (!editableCopy) {
            closeEditConfirmDialog(true);
            return;
        }

        buildTemplateOptions(templateSelect);
        templateSelect.value = editableCopy.id;
        updateTemplateButtons(templateSelect, buttons);
        closeEditConfirmDialog(false);
        announce(`${editableCopy.name} created for editing`);
        continueEditTemplate(editableCopy.id);
    });

    btnEditNo.addEventListener('click', () => {
        closeEditConfirmDialog(true);
    });

    btnDelete.addEventListener('click', () => {
        const selected = getTemplateById(templateSelect.value);
        if (!selected || !selected.id.startsWith('user-')) return;

        pendingDeleteTemplateId = selected.id;
        deleteMessage.textContent = `Deleting ${selected.name} cannot be undone.`;
        openDialog(deleteDialog, btnDeleteYes, btnDelete);
    });

    btnDeleteNo.addEventListener('click', () => {
        closeDialog(deleteDialog, true);
        pendingDeleteTemplateId = null;
        btnDelete.focus();
    });

    btnDeleteYes.addEventListener('click', () => {
        if (!pendingDeleteTemplateId) return;

        const deleted = deleteUserTemplate(pendingDeleteTemplateId);
        closeDialog(deleteDialog, false);
        pendingDeleteTemplateId = null;
        if (!deleted) return;

        buildTemplateOptions(templateSelect);
        templateSelect.value = 'scratch';
        updateTemplateButtons(templateSelect, buttons);
        templateSelect.focus();
        announce(`${deleted.name} template deleted`);
    });

    deleteDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialog(deleteDialog, true);
        pendingDeleteTemplateId = null;
        btnDelete.focus();
    });

    createDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeDialog(createDialog, true);
        pendingCreateSourceTemplateId = null;
        btnCreate.focus();
    });

    editConfirmDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeEditConfirmDialog(true);
    });
}
