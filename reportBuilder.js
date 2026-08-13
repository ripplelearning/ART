// reportBuilder.js
import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { announce, appState, createUserTemplate, getActiveProjectWorkspace, getBuiltInTemplates, getUserTemplates, setActiveWorkspaceDefaultBranding, updateHeader, addOrUpdateField, setEditMode, deleteField, moveField, saveCurrentReportToUserTemplate, saveState, upsertCurrentReport, addProgressItem, getDefaultProgressItemTypes, getProgressItemNames, getProgressItems, getProgressStatuses, removeProgressItem, updateProgressItem, updateProgressLogSettings } from './state.js';
import { formatWcagCriterionDisplay, getAvailableWcagStandards, getWcagCriteriaForStandard, isWcagCriterionFieldType } from './wcagCatalog.js';
import { restoreFocus } from './focusManagement.js';
import {
    applyPresentationPublishingProfile,
    buildPresentationPreviewModel,
    clearPresentationPublishingProfile,
    deletePresentationResource,
    duplicatePresentationResource,
    getPresentationResourceLibrary,
    getPresentationResourceUsage,
    getPresentationScopeOptions,
    getPresentationSelections,
    getPresentationUiState,
    getPresentationValidation,
    getResolvedReportPresentation,
    renamePresentationResource,
    saveBrandingAsWorkspaceDefault,
    savePresentationResource,
    setPresentationBrandingFromLegacyState,
    updatePresentationOverride,
    updatePresentationPreviewMode,
    updatePresentationSelection,
    updatePresentationUiSection
} from './reportPresentationFramework.js';

let pendingFocus = null;
let pendingDelete = null;
let applyWorkspaceBrandingDefault = false;
let publishingPresentationExpanded = false;
let reportBrandingExpanded = false;
let lastFieldConfigurationActivationAt = 0;

function requestBuilderFocus(action, index = null, itemId = '') {
    pendingFocus = { index, action, itemId };
}

function resolveBuilderFocusTarget(request) {
    const { index, action, itemId } = request || {};

    if (
        action === 'template-name-input'
        || action === 'choose-template-select'
        || action === 'template-file-input'
        || action === 'template-option-select'
        || action === 'report-type-select'
        || action === 'btn-toggle-config'
        || action === 'report-layout-select'
        || action === 'branding-enabled'
        || action === 'field-label-input'
        || action === 'btn-add-field'
        || action === 'btn-progress-item-add'
    ) {
        const targetById = document.getElementById(action);
        return targetById instanceof HTMLElement ? targetById : null;
    }

    if (action === 'progress-item-name' && itemId) {
        const target = document.querySelector(`[data-progress-item-id="${itemId}"] [data-progress-field="name"]`);
        return target instanceof HTMLElement ? target : null;
    }

    const selector = `[data-field-action="${action}"][data-field-index="${index}"]`;
    const button = document.querySelector(selector);
    return button instanceof HTMLElement ? button : null;
}

function applyBuilderFocusRequest(request, attemptsRemaining = 6) {
    const target = resolveBuilderFocusTarget(request);
    if (target instanceof HTMLElement) {
        restoreFocus(target, { retries: 1 });
        return true;
    }

    if (attemptsRemaining <= 0) return false;
    window.setTimeout(() => {
        applyBuilderFocusRequest(request, attemptsRemaining - 1);
    }, 25);
    return true;
}

async function executeBuilderAction(action, context = {}) {
    const command = commandRegistry.findCommands({ action })[0] || null;
    if (!command?.id) return null;
    return commandExecutionService.executeCommand(command.id, {
        source: 'builder',
        action,
        ...context
    });
}

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function getFieldTypeLabel(type) {
    const normalizedType = normalizeFieldType(type);
    if (normalizedType === 'textarea') return 'Textarea';
    if (normalizedType === 'dropdown') return 'Dropdown';
    if (normalizedType === 'attachment') return 'Attachment';
    if (normalizedType === 'evaluation-item-selection') return 'Evaluation Item Selection Box';
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
    const headerImages = Array.isArray(appState.branding?.headerImages) ? appState.branding.headerImages : [];
    const footerImages = Array.isArray(appState.branding?.footerImages) ? appState.branding.footerImages : [];
    const legacyLogoDataUrl = String(appState.branding?.logoDataUrl || '').trim();
    const nextHeaderImages = headerImages.length > 0
        ? headerImages
        : (legacyLogoDataUrl
            ? [{
                id: 'branding-legacy-logo',
                dataUrl: legacyLogoDataUrl,
                fileName: String(appState.branding?.logoFileName || '').trim(),
                altText: String(appState.branding?.logoDecorative ? '' : (appState.branding?.logoAltText || '')).trim(),
                alignment: 'left',
                spacing: 8,
                maxDisplayWidth: 160,
                maxDisplayHeight: 80
            }]
            : []);

    return {
        enabled: Boolean(appState.branding?.enabled),
        headerText: String(appState.branding?.headerText || ''),
        headerHtml: String(appState.branding?.headerHtml || ''),
        footerHtml: String(appState.branding?.footerHtml || ''),
        headerImages: nextHeaderImages,
        footerImages,
        pageMargins: {
            top: Number(appState.branding?.pageMargins?.top || 48),
            right: Number(appState.branding?.pageMargins?.right || 48),
            bottom: Number(appState.branding?.pageMargins?.bottom || 48),
            left: Number(appState.branding?.pageMargins?.left || 48)
        },
        showPageNumbers: appState.branding?.showPageNumbers !== false,
        primaryColor: String(appState.branding?.primaryColor || '#005a9c'),
        logoDataUrl: String(appState.branding?.logoDataUrl || ''),
        logoAltText: String(appState.branding?.logoAltText || ''),
        logoDecorative: Boolean(appState.branding?.logoDecorative),
        logoFileName: String(appState.branding?.logoFileName || '')
    };
}

function htmlToPlainText(html) {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    return String(container.textContent || '').replace(/\s+/g, ' ').trim();
}

function sanitizeBrandingHtml(html) {
    const source = String(html || '').trim();
    if (!source) return '';

    const allowedTags = new Set([
        'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A', 'SPAN', 'DIV',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
        'BLOCKQUOTE', 'IMG'
    ]);
    const template = document.createElement('template');
    template.innerHTML = source;

    const nodes = Array.from(template.content.querySelectorAll('*'));
    nodes.forEach((node) => {
        if (!allowedTags.has(node.tagName)) {
            node.replaceWith(...Array.from(node.childNodes));
            return;
        }

        const attributes = Array.from(node.attributes);
        attributes.forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = String(attribute.value || '');

            if (name.startsWith('on')) {
                node.removeAttribute(attribute.name);
                return;
            }

            if (name === 'style') {
                const unsafeStyle = /(expression\s*\(|url\s*\(\s*['\"]?javascript:|behavior\s*:)/i.test(value);
                if (unsafeStyle) {
                    node.removeAttribute(attribute.name);
                    return;
                }

                const safeDeclarations = value
                    .split(';')
                    .map((segment) => segment.trim())
                    .filter(Boolean)
                    .filter((segment) => {
                        const key = String(segment.split(':')[0] || '').trim().toLowerCase();
                        return [
                            'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration',
                            'color', 'background-color', 'text-align', 'margin', 'margin-left', 'margin-right',
                            'margin-top', 'margin-bottom', 'padding', 'padding-left', 'padding-right',
                            'padding-top', 'padding-bottom', 'border', 'border-collapse', 'border-spacing',
                            'width', 'max-width', 'height', 'max-height', 'display', 'vertical-align'
                        ].includes(key);
                    });
                if (safeDeclarations.length === 0) {
                    node.removeAttribute(attribute.name);
                } else {
                    node.setAttribute('style', safeDeclarations.join('; '));
                }
                return;
            }

            if (name === 'lang' || name === 'dir' || name === 'scope' || name === 'colspan' || name === 'rowspan' || name === 'aria-label') {
                return;
            }

            if (node.tagName === 'IMG') {
                if (name === 'src') {
                    const safeSrc = /^(https?:|data:image\/|blob:|\/)/i.test(value);
                    if (!safeSrc) node.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'alt' || name === 'width' || name === 'height' || name === 'data-branding-image-id' || name === 'data-branding-section') return;
            }

            if (node.tagName === 'A') {
                if (name === 'href') {
                    const safeHref = /^(https?:|mailto:|tel:|#|\/)/i.test(value);
                    if (!safeHref) node.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'target') return;
                if (name === 'rel') return;
            }

            node.removeAttribute(attribute.name);
        });

        if (node.tagName === 'A') {
            if (node.getAttribute('target') === '_blank' && !node.getAttribute('rel')) {
                node.setAttribute('rel', 'noopener noreferrer');
            }
        }
    });

    return template.innerHTML.trim();
}

function getBrandingEditorInitialHtml(richHtml, fallbackText = '') {
    const sanitized = sanitizeBrandingHtml(richHtml);
    if (sanitized) return sanitized;
    const fallback = String(fallbackText || '').trim();
    return fallback ? `<p>${escapeHtml(fallback)}</p>` : '';
}

function applyBrandingFormatCommand(editorId, command) {
    const editor = document.getElementById(editorId);
    if (!(editor instanceof HTMLElement)) return;
    editor.focus();

    if (command === 'createLink') {
        const url = window.prompt('Enter link URL (https://example.com)');
        if (!url) return;
        document.execCommand('createLink', false, url);
        return;
    }

    document.execCommand(command, false, null);
}

function getBrandingSectionFromEditorId(editorId) {
    return editorId === 'branding-footer-editor' ? 'footer' : 'header';
}

function normalizeBrandingImageEntry(image, index = 0) {
    const source = image && typeof image === 'object' ? image : {};
    const maxDisplayWidth = Number(source.maxDisplayWidth ?? source.maxWidth);
    const maxDisplayHeight = Number(source.maxDisplayHeight ?? source.maxHeight);
    const spacing = Number(source.spacing);
    const alignment = String(source.alignment || 'inline').trim().toLowerCase();
    return {
        id: String(source.id || `branding-image-${Date.now()}-${index}`).trim() || `branding-image-${Date.now()}-${index}`,
        dataUrl: String(source.dataUrl || source.src || '').trim(),
        fileName: String(source.fileName || '').trim(),
        altText: String(source.altText || source.alt || '').trim(),
        alignment: ['inline', 'left', 'center', 'right'].includes(alignment) ? alignment : 'inline',
        spacing: Number.isFinite(spacing) ? Math.max(0, Math.min(64, Math.round(spacing))) : 8,
        maxDisplayWidth: Number.isFinite(maxDisplayWidth) ? Math.max(24, Math.min(2000, Math.round(maxDisplayWidth))) : 160,
        maxDisplayHeight: Number.isFinite(maxDisplayHeight) ? Math.max(24, Math.min(2000, Math.round(maxDisplayHeight))) : 80
    };
}

function normalizeBrandingImageList(list = []) {
    return (Array.isArray(list) ? list : [])
        .map((item, index) => normalizeBrandingImageEntry(item, index))
        .filter((item) => String(item.dataUrl || '').trim());
}

function getBrandingImageStyle(image) {
    const normalized = normalizeBrandingImageEntry(image, 0);
    const spacing = `${normalized.spacing}px`;
    const maxWidth = `${normalized.maxDisplayWidth}px`;
    const maxHeight = `${normalized.maxDisplayHeight}px`;
    const base = [
        'width:auto',
        'height:auto',
        `max-width:${maxWidth}`,
        `max-height:${maxHeight}`,
        `margin-top:${spacing}`,
        `margin-bottom:${spacing}`
    ];

    if (normalized.alignment === 'inline') {
        base.push('display:inline-block', `margin-left:${spacing}`, `margin-right:${spacing}`, 'vertical-align:middle');
    } else if (normalized.alignment === 'left') {
        base.push('display:block', 'margin-left:0', 'margin-right:auto');
    } else if (normalized.alignment === 'right') {
        base.push('display:block', 'margin-left:auto', 'margin-right:0');
    } else {
        base.push('display:block', 'margin-left:auto', 'margin-right:auto');
    }

    return base.join('; ');
}

function applyBrandingImageToNode(img, image, section) {
    const normalized = normalizeBrandingImageEntry(image, 0);
    img.setAttribute('src', normalized.dataUrl);
    img.setAttribute('alt', normalized.altText);
    img.setAttribute('data-branding-image-id', normalized.id);
    img.setAttribute('data-branding-section', section);
    img.setAttribute('style', getBrandingImageStyle(normalized));
}

function syncBrandingImagesFromEditor(editorId) {
    const editor = document.getElementById(editorId);
    if (!(editor instanceof HTMLElement)) return;

    const section = getBrandingSectionFromEditorId(editorId);
    const state = getBrandingState();
    const current = normalizeBrandingImageList(section === 'header' ? state.headerImages : state.footerImages);
    const byId = new Map(current.map((image) => [image.id, image]));

    const nextImages = [];
    editor.querySelectorAll('img').forEach((img, index) => {
        const existingId = String(img.getAttribute('data-branding-image-id') || '').trim();
        const imageId = existingId || `branding-image-${Date.now()}-${index}`;
        const merged = normalizeBrandingImageEntry({
            ...(byId.get(imageId) || {}),
            id: imageId,
            dataUrl: String(img.getAttribute('src') || '').trim(),
            altText: String(img.getAttribute('alt') || '').trim(),
            alignment: byId.get(imageId)?.alignment || 'inline',
            spacing: byId.get(imageId)?.spacing,
            maxDisplayWidth: byId.get(imageId)?.maxDisplayWidth,
            maxDisplayHeight: byId.get(imageId)?.maxDisplayHeight
        }, index);

        applyBrandingImageToNode(img, merged, section);
        nextImages.push(merged);
    });

    const nextBranding = {
        ...state,
        headerImages: section === 'header' ? nextImages : normalizeBrandingImageList(state.headerImages),
        footerImages: section === 'footer' ? nextImages : normalizeBrandingImageList(state.footerImages)
    };

    if (nextBranding.headerImages.length > 0) {
        const firstHeaderImage = nextBranding.headerImages[0];
        nextBranding.logoDataUrl = firstHeaderImage.dataUrl;
        nextBranding.logoAltText = firstHeaderImage.altText;
        nextBranding.logoDecorative = false;
        nextBranding.logoFileName = firstHeaderImage.fileName || nextBranding.logoFileName;
    } else {
        nextBranding.logoDataUrl = '';
        nextBranding.logoAltText = '';
        nextBranding.logoDecorative = false;
        nextBranding.logoFileName = '';
    }

    appState.branding = nextBranding;
}

function buildBrandingPreviewMarkup(branding) {
    const headerHtml = sanitizeBrandingHtml(branding.headerHtml) || (String(branding.headerText || '').trim() ? `<p>${escapeHtml(branding.headerText)}</p>` : '<p>Header preview</p>');
    const footerHtml = sanitizeBrandingHtml(branding.footerHtml) || '<p>Footer preview</p>';
    const margins = branding.pageMargins || { top: 48, right: 48, bottom: 48, left: 48 };

    return `
        <div class="branding-preview-page" style="--preview-margin-top:${Number(margins.top || 48)}px; --preview-margin-right:${Number(margins.right || 48)}px; --preview-margin-bottom:${Number(margins.bottom || 48)}px; --preview-margin-left:${Number(margins.left || 48)}px;">
            <div class="branding-preview-page__header" style="color:${escapeHtml(String(branding.primaryColor || '#005a9c'))};">${headerHtml}</div>
            <div class="branding-preview-page__body">
                <p>Report content preview area</p>
                <p>This preview reflects branding margins, rich header/footer content, and images.</p>
            </div>
            <div class="branding-preview-page__footer">${footerHtml}</div>
            ${branding.showPageNumbers !== false ? '<p class="branding-preview-page__number" aria-hidden="true">Page 1</p>' : ''}
        </div>
    `;
}

function refreshBrandingPreview() {
    const previewHost = document.getElementById('branding-live-preview');
    if (!(previewHost instanceof HTMLElement)) return;
    previewHost.innerHTML = buildBrandingPreviewMarkup(getBrandingState());
}

function renderPresentationResourceOptions(resources, selectedId) {
    return resources.map((resource) => {
        const scopeLabel = resource.scope === 'application'
            ? 'Application'
            : resource.scope === 'workspace'
                ? 'Workspace'
                : resource.scope === 'shared'
                    ? 'Shared'
                    : 'Personal';
        return `<option value="${escapeHtml(resource.id)}" ${resource.id === selectedId ? 'selected' : ''}>${escapeHtml(resource.name)} (${scopeLabel}${resource.readOnly ? ', read-only' : ''})</option>`;
    }).join('');
}

function buildPresentationValidationMarkup(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return '<p>No presentation validation issues were detected.</p>';
    }

    return `
        <ul class="presentation-validation-list">
            ${messages.map((message) => `<li class="presentation-validation-list__item presentation-validation-list__item--${escapeHtml(message.severity || 'info')}"><strong>${escapeHtml((message.severity || 'info').toUpperCase())}:</strong> ${escapeHtml(message.target || 'Presentation')} - ${escapeHtml(message.message || '')}${Number.isFinite(Number(message.ratio)) ? ` (Contrast: ${escapeHtml(Number(message.ratio).toFixed(2))}:1)` : ''}</li>`).join('')}
        </ul>
    `;
}

function buildLayoutSectionEditor(layout) {
    return `
        <div class="presentation-layout-sections" role="list" aria-label="Report layout sections">
            ${layout.sections.map((section, index) => `
                <div class="presentation-layout-section" role="listitem">
                    <label>
                        <input type="checkbox" data-presentation-layout-section-enabled="${escapeHtml(section.id)}" ${section.enabled ? 'checked' : ''}>
                        ${escapeHtml(section.id === 'workspace-report-summary' ? 'Workspace/Report Summary' : section.id.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))}
                    </label>
                    <div class="presentation-layout-section__actions" role="group" aria-label="${escapeHtml(section.id)} order actions">
                        <button type="button" data-presentation-layout-move-earlier="${escapeHtml(section.id)}" ${index === 0 ? 'disabled' : ''}>Move Earlier</button>
                        <button type="button" data-presentation-layout-move-later="${escapeHtml(section.id)}" ${index === layout.sections.length - 1 ? 'disabled' : ''}>Move Later</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function buildPresentationPreviewMarkup() {
    const preview = buildPresentationPreviewModel();
    const cssVariables = Object.entries(preview.cssVariables || {})
        .map(([key, value]) => `${key}:${value}`)
        .join('; ');

    return `
        <section class="presentation-preview-page" aria-label="Publishing preview" data-preview-mode="${escapeHtml(preview.previewMode)}" style="${escapeHtml(cssVariables)}">
            <header class="presentation-preview-page__masthead">
                <p class="presentation-preview-page__mode">${escapeHtml(preview.previewMode.toUpperCase())} preview</p>
                <h4>${escapeHtml(preview.title)}</h4>
                ${preview.organization ? `<p>${escapeHtml(preview.organization)}</p>` : ''}
                ${preview.projectName ? `<p>${escapeHtml(preview.projectName)}</p>` : ''}
            </header>
            <div class="presentation-preview-page__body">
                ${preview.visibleSections.map((section) => `
                    <section class="presentation-preview-page__section" aria-labelledby="preview-section-${escapeHtml(section.id)}">
                        <h5 id="preview-section-${escapeHtml(section.id)}">${escapeHtml(section.label)}</h5>
                        <p>${section.available ? 'Included in preview and export order.' : 'Configured, but current report data does not fully support this section.'}</p>
                    </section>
                `).join('')}
                <section class="presentation-preview-page__section" aria-labelledby="preview-severity-heading">
                    <h5 id="preview-severity-heading">Severity and Status Presentation</h5>
                    <ul class="presentation-preview-page__legend">
                        <li><span class="presentation-chip presentation-chip--critical">Critical</span> Text label remains visible.</li>
                        <li><span class="presentation-chip presentation-chip--failed">Failed</span> Status is not color-only.</li>
                    </ul>
                </section>
            </div>
        </section>
    `;
}

function buildPresentationSummary(resolvedPresentation, validationMessages) {
    const issueCount = Array.isArray(validationMessages) ? validationMessages.length : 0;
    return `Profile ${resolvedPresentation.publishingProfile?.name || 'Custom'}. Layout ${resolvedPresentation.layout.name}. Theme ${resolvedPresentation.theme.name}. Branding ${resolvedPresentation.branding.name || 'Current Report Branding'}. ${issueCount === 0 ? 'No validation issues.' : `${issueCount} validation issue${issueCount === 1 ? '' : 's'} detected.`}`;
}

function cloneCurrentLayoutDraft(resolvedPresentation) {
    return JSON.parse(JSON.stringify(appState.presentation?.reportPresentation?.layoutOverride || resolvedPresentation.layout));
}

function cloneCurrentThemeDraft(resolvedPresentation) {
    return JSON.parse(JSON.stringify(appState.presentation?.reportPresentation?.themeOverride || resolvedPresentation.theme));
}

function canApplyBrandingToActiveWorkspace() {
    const activeWorkspace = getActiveProjectWorkspace();
    if (!activeWorkspace) return false;

    const selectedReportId = String(appState.selectedReportId || '').trim();
    if (!selectedReportId) return true;

    const reportIds = new Set([
        ...(activeWorkspace.associatedReportIds || []),
        ...((activeWorkspace.resources && Array.isArray(activeWorkspace.resources.reports)) ? activeWorkspace.resources.reports : [])
    ]);
    return reportIds.has(selectedReportId);
}

function getBrandingImagesForSection(section) {
    const branding = getBrandingState();
    return normalizeBrandingImageList(section === 'footer' ? branding.footerImages : branding.headerImages);
}

function updateBrandingImagesForSection(section, nextImages, announceMessage = '') {
    const branding = getBrandingState();
    const normalized = normalizeBrandingImageList(nextImages);
    const nextBranding = {
        ...branding,
        headerImages: section === 'header' ? normalized : normalizeBrandingImageList(branding.headerImages),
        footerImages: section === 'footer' ? normalized : normalizeBrandingImageList(branding.footerImages)
    };

    if (nextBranding.headerImages.length > 0) {
        nextBranding.logoDataUrl = nextBranding.headerImages[0].dataUrl;
        nextBranding.logoAltText = nextBranding.headerImages[0].altText;
        nextBranding.logoDecorative = false;
        nextBranding.logoFileName = nextBranding.headerImages[0].fileName || '';
    } else {
        nextBranding.logoDataUrl = '';
        nextBranding.logoAltText = '';
        nextBranding.logoDecorative = false;
        nextBranding.logoFileName = '';
    }

    appState.branding = nextBranding;
    saveState();
    setPresentationBrandingFromLegacyState();
    if (announceMessage) announce(announceMessage);
}

function getBrandingEditor(section) {
    const id = section === 'footer' ? 'branding-footer-editor' : 'branding-header-editor';
    const editor = document.getElementById(id);
    return editor instanceof HTMLElement ? editor : null;
}

function getBrandingStatusElement() {
    const status = document.getElementById('branding-image-manager-status');
    return status instanceof HTMLElement ? status : null;
}

function setBrandingStatus(message) {
    const status = getBrandingStatusElement();
    if (!status) return;
    status.textContent = message;
}

function findEditorImageNode(section, imageId) {
    const editor = getBrandingEditor(section);
    if (!editor) return null;
    return editor.querySelector(`img[data-branding-image-id="${CSS.escape(String(imageId || '').trim())}"]`);
}

function insertBrandingImageAtCursor(section, image) {
    const editor = getBrandingEditor(section);
    if (!editor) return false;

    editor.focus();
    const img = document.createElement('img');
    applyBrandingImageToNode(img, image, section);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        editor.appendChild(img);
        return true;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);
    range.setStartAfter(img);
    range.setEndAfter(img);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

function moveBrandingImageNode(section, imageId, direction) {
    const editor = getBrandingEditor(section);
    if (!editor) return false;
    const images = Array.from(editor.querySelectorAll('img[data-branding-image-id]'));
    const index = images.findIndex((img) => String(img.getAttribute('data-branding-image-id') || '') === String(imageId || ''));
    if (index < 0) return false;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return false;

    const current = images[index];
    const reference = images[nextIndex];
    if (direction < 0) {
        reference.parentNode?.insertBefore(current, reference);
    } else {
        reference.parentNode?.insertBefore(reference, current);
    }
    return true;
}

function renderBrandingImageManagers() {
    ['header', 'footer'].forEach((section) => {
        const host = document.getElementById(section === 'header' ? 'branding-header-images-manager' : 'branding-footer-images-manager');
        if (!(host instanceof HTMLElement)) return;

        const images = getBrandingImagesForSection(section);
        if (images.length === 0) {
            host.innerHTML = '<p>No images inserted yet.</p>';
            return;
        }

        host.innerHTML = `
            <h4>${section === 'header' ? 'Header' : 'Footer'} Images</h4>
            <ul class="branding-image-list" data-branding-section="${section}">
                ${images.map((image, index) => `
                    <li class="branding-image-list__item" draggable="true" data-branding-image-id="${escapeHtml(image.id)}" data-branding-section="${section}">
                        <img src="${escapeHtml(image.dataUrl)}" alt="" class="branding-image-list__thumb" />
                        <div class="branding-image-list__meta">
                            <p>${escapeHtml(image.fileName || `Image ${index + 1}`)}</p>
                            <label>Alternative Text (required)
                                <input type="text" data-branding-image-alt="${escapeHtml(image.id)}" data-branding-section="${section}" value="${escapeHtml(image.altText)}" required>
                            </label>
                            <div class="branding-image-list__row">
                                <label>Alignment
                                    <select data-branding-image-alignment="${escapeHtml(image.id)}" data-branding-section="${section}">
                                        <option value="inline" ${image.alignment === 'inline' ? 'selected' : ''}>Inline</option>
                                        <option value="left" ${image.alignment === 'left' ? 'selected' : ''}>Left</option>
                                        <option value="center" ${image.alignment === 'center' ? 'selected' : ''}>Center</option>
                                        <option value="right" ${image.alignment === 'right' ? 'selected' : ''}>Right</option>
                                    </select>
                                </label>
                                <label>Spacing
                                    <input type="number" min="0" max="64" step="1" data-branding-image-spacing="${escapeHtml(image.id)}" data-branding-section="${section}" value="${Number(image.spacing || 8)}">
                                </label>
                            </div>
                            <div class="branding-image-list__row">
                                <label>Max Width
                                    <input type="number" min="24" max="2000" step="1" data-branding-image-width="${escapeHtml(image.id)}" data-branding-section="${section}" value="${Number(image.maxDisplayWidth || 160)}">
                                </label>
                                <label>Max Height
                                    <input type="number" min="24" max="2000" step="1" data-branding-image-height="${escapeHtml(image.id)}" data-branding-section="${section}" value="${Number(image.maxDisplayHeight || 80)}">
                                </label>
                            </div>
                            <div class="branding-image-list__actions" role="group" aria-label="Image actions">
                                <button type="button" data-branding-image-move-earlier="${escapeHtml(image.id)}" data-branding-section="${section}" ${index === 0 ? 'disabled' : ''}>Move Earlier</button>
                                <button type="button" data-branding-image-move-later="${escapeHtml(image.id)}" data-branding-section="${section}" ${index === images.length - 1 ? 'disabled' : ''}>Move Later</button>
                                <button type="button" data-branding-image-replace="${escapeHtml(image.id)}" data-branding-section="${section}">Replace</button>
                                <button type="button" data-branding-image-remove="${escapeHtml(image.id)}" data-branding-section="${section}">Remove</button>
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    });
}

function attachBrandingRichEditor(editorId, stateKey, fallbackKey = '') {
    const editor = document.getElementById(editorId);
    if (!(editor instanceof HTMLElement)) return;

    const persist = () => {
        const sanitized = sanitizeBrandingHtml(editor.innerHTML);
        editor.innerHTML = sanitized;
        const nextBranding = {
            ...getBrandingState(),
            [stateKey]: sanitized
        };
        if (fallbackKey) nextBranding[fallbackKey] = htmlToPlainText(sanitized);
        appState.branding = nextBranding;
        syncBrandingImagesFromEditor(editorId);
        saveState();
        setPresentationBrandingFromLegacyState();
        refreshBrandingPreview();
    };

    editor.addEventListener('input', persist);
    editor.addEventListener('blur', () => {
        editor.innerHTML = sanitizeBrandingHtml(editor.innerHTML);
        persist();
    });
}

function validateBrandingInputs(shouldAnnounce = true) {
    const branding = getBrandingState();
    const errorEl = document.getElementById('branding-logo-alt-error');

    const allImages = [
        ...(Array.isArray(branding.headerImages) ? branding.headerImages : []),
        ...(Array.isArray(branding.footerImages) ? branding.footerImages : [])
    ];
    const missingImageAlt = allImages.find((image) => String(image.dataUrl || '').trim() && !String(image.altText || '').trim());
    const hasError = Boolean(missingImageAlt);
    if (!hasError) {
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    const msg = 'Alternative text is required for every branding image.';
    if (errorEl) errorEl.textContent = msg;
    if (shouldAnnounce) {
        announce(msg);
        if (missingImageAlt) {
            const missingInput = document.querySelector(`[data-branding-image-alt="${CSS.escape(String(missingImageAlt.id || ''))}"]`);
            if (missingInput instanceof HTMLElement) {
                missingInput.focus();
                return false;
            }
        }
    }
    return false;
}

function focusAfterRender() {
    if (!pendingFocus) return false;

    const request = pendingFocus;
    pendingFocus = null;
    return applyBuilderFocusRequest(request);
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

function buildProgressItemRows(typeSuggestions, statusOptions) {
    const items = getProgressItems();
    if (items.length === 0) {
        return '<p>No evaluation items have been added yet.</p>';
    }

    return `
        <div class="progress-log-config-list" role="list" aria-label="Progress log evaluation items">
            ${items.map((item, index) => `
                <fieldset class="progress-log-config-item" data-progress-item-id="${escapeHtml(item.id)}">
                    <legend>Evaluation Item ${index + 1}</legend>
                    <label>Evaluation Item Name
                        <input type="text" data-progress-field="name" value="${escapeHtml(item.name)}">
                    </label>
                    <label>Type
                        <input type="text" data-progress-field="type" list="progress-item-type-options" value="${escapeHtml(item.type)}">
                    </label>
                    <label>URL/Location
                        <input type="text" data-progress-field="location" value="${escapeHtml(item.location)}">
                    </label>
                    <label>Status
                        <select data-progress-field="status" aria-describedby="builder-select-help">
                            ${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${item.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
                        </select>
                    </label>
                    <label>Assigned Tester
                        <input type="text" data-progress-field="assignedTester" value="${escapeHtml(item.assignedTester)}">
                    </label>
                    <label>Findings Count
                        <input type="number" min="0" step="1" data-progress-field="findingsCount" value="${escapeHtml(item.findingsCount)}">
                    </label>
                    <label>Notes
                        <textarea data-progress-field="notes">${escapeHtml(item.notes)}</textarea>
                    </label>
                    <p>Started: ${escapeHtml(item.dateStarted || 'Not started')}</p>
                    <p>Completed: ${escapeHtml(item.dateCompleted || 'Not completed')}</p>
                    <button type="button" data-progress-action="remove">Remove Evaluation Item</button>
                </fieldset>
            `).join('')}
        </div>
        <datalist id="progress-item-type-options">
            ${typeSuggestions.map((type) => `<option value="${escapeHtml(type)}"></option>`).join('')}
        </datalist>
    `;
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

export function executeAddFieldFromCommand() {
    const isAdding = appState.editingIndex === -1;
    const previousCount = appState.fields.length;
    addOrUpdateField();

    if (isAdding && appState.fields.length > previousCount) {
        appState.fieldsExpanded = true;
        requestBuilderFocus('field-label-input');
    } else if (isAdding) {
        appState.fieldsExpanded = true;
        requestBuilderFocus('field-label-input');
    }

    renderBuilder();
    return true;
}

export function executeDoneFromCommand() {
    if (!validateBrandingInputs(true)) return false;

    if (applyWorkspaceBrandingDefault && canApplyBrandingToActiveWorkspace()) {
        saveBrandingAsWorkspaceDefault();
    }

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

    const focusEditorStartField = (attempt = 0) => {
        if (editorTab && editorTab.getAttribute('aria-selected') !== 'true') {
            editorTab.click();
        }

        const firstField = document.getElementById('editor-field-0-0')
            || document.querySelector('.editor-audit-table [data-entry-index="0"][data-field-index="0"]')
            || document.querySelector('.editor-audit-table .wcag-combobox-input')
            || document.querySelector('.editor-audit-table .btn-attach-file')
            || document.querySelector('.editor-fields-grid [data-entry-index="0"][data-field-index="0"]')
            || document.querySelector('.editor-fields-grid .wcag-combobox-input')
            || document.querySelector('.editor-fields-grid .btn-attach-file');

        if (firstField instanceof HTMLElement) {
            firstField.focus();
            return;
        }

        if (attempt < 50) {
            window.setTimeout(() => focusEditorStartField(attempt + 1), 25);
            return;
        }

        const editorHeading = document.getElementById('editor-heading');
        if (editorHeading) editorHeading.focus();
    };

    window.setTimeout(() => focusEditorStartField(0), 30);
    return true;
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
    const brandingHeaderHtml = getBrandingEditorInitialHtml(branding.headerHtml, branding.headerText);
    const brandingFooterHtml = getBrandingEditorInitialHtml(branding.footerHtml, '');
    const progressTypeSuggestions = getDefaultProgressItemTypes();
    const progressItemNames = getProgressItemNames();
    const progressStatusOptions = getProgressStatuses();
    const showProgressLogConfig = appState.reportType === 'Audit Log' && appState.progressLogEnabled;
    const presentationLibrary = getPresentationResourceLibrary();
    const presentationSelections = getPresentationSelections();
    const presentationUi = getPresentationUiState();
    const resolvedPresentation = getResolvedReportPresentation();
    const presentationValidation = getPresentationValidation();
    const activePublishingProfileId = String(presentationSelections.publishingProfileId || '').trim();
    const activeLayoutDraft = cloneCurrentLayoutDraft(resolvedPresentation);
    const activeThemeDraft = cloneCurrentThemeDraft(resolvedPresentation);
    const presentationScopeOptions = getPresentationScopeOptions();

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

            <details id="presentation-config-region" class="presentation-config" ${publishingPresentationExpanded ? 'open' : ''}>
                <summary id="presentation-config-summary">Publishing Presentation</summary>
                <div id="presentation-config-content" aria-labelledby="presentation-config-summary">
                <p id="presentation-summary" role="status" aria-live="polite">${escapeHtml(buildPresentationSummary(resolvedPresentation, presentationValidation))}</p>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.advanced ? 'open' : ''}>
                    <summary id="presentation-advanced-summary">Advanced</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-advanced-summary">
                        <label for="presentation-profile-select">Publishing Profile</label>
                        <select id="presentation-profile-select">
                            <option value="">Custom (no profile)</option>
                            ${renderPresentationResourceOptions(presentationLibrary.publishingProfiles, activePublishingProfileId)}
                        </select>
                        <label for="presentation-preview-mode">Preview Output Context</label>
                        <select id="presentation-preview-mode">
                            ${['screen', 'print', 'pdf', 'word', 'html'].map((mode) => `<option value="${mode}" ${resolvedPresentation.previewMode === mode ? 'selected' : ''}>${escapeHtml(mode.toUpperCase())}</option>`).join('')}
                        </select>
                        <label class="branding-toggle">
                            <input type="checkbox" id="presentation-allow-overrides" ${appState.presentation?.reportPresentation?.allowOverrides !== false ? 'checked' : ''}>
                            Allow report-level presentation overrides when permissions permit.
                        </label>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.layout ? 'open' : ''}>
                    <summary id="presentation-layout-summary">Layout</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-layout-summary">
                        <label for="presentation-layout-select">Reusable Report Layout</label>
                        <select id="presentation-layout-select">
                            ${renderPresentationResourceOptions(presentationLibrary.layouts, resolvedPresentation.layout.id)}
                        </select>
                        <label for="presentation-layout-name">Layout Resource Name</label>
                        <input id="presentation-layout-name" type="text" value="${escapeHtml(activeLayoutDraft.name || resolvedPresentation.layout.name)}">
                        <label for="presentation-layout-scope">Layout Scope</label>
                        <select id="presentation-layout-scope">
                            ${presentationScopeOptions.map((scope) => `<option value="${scope}" ${activeLayoutDraft.scope === scope ? 'selected' : ''}>${escapeHtml(scope)}</option>`).join('')}
                        </select>
                        <label for="presentation-layout-finding-style">Finding Presentation</label>
                        <select id="presentation-layout-finding-style">
                            ${['grouped-cards', 'summary-list', 'tabular', 'narrative', 'remediation-queue'].map((value) => `<option value="${value}" ${activeLayoutDraft.findingPresentation === value ? 'selected' : ''}>${escapeHtml(value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))}</option>`).join('')}
                        </select>
                        ${buildLayoutSectionEditor(activeLayoutDraft)}
                        <div class="branding-image-list__actions" role="group" aria-label="Layout resource actions">
                            <button id="btn-presentation-layout-save" type="button">Save Layout</button>
                            <button id="btn-presentation-layout-duplicate" type="button">Duplicate Layout</button>
                            <button id="btn-presentation-layout-rename" type="button">Rename Layout</button>
                            <button id="btn-presentation-layout-delete" type="button">Delete Layout</button>
                        </div>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.theme ? 'open' : ''}>
                    <summary id="presentation-theme-summary">Theme</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-theme-summary">
                        <label for="presentation-theme-select">Reusable Report Theme</label>
                        <select id="presentation-theme-select">
                            ${renderPresentationResourceOptions(presentationLibrary.themes, resolvedPresentation.theme.id)}
                        </select>
                        <label for="presentation-theme-name">Theme Resource Name</label>
                        <input id="presentation-theme-name" type="text" value="${escapeHtml(activeThemeDraft.name || resolvedPresentation.theme.name)}">
                        <label for="presentation-theme-scope">Theme Scope</label>
                        <select id="presentation-theme-scope">
                            ${presentationScopeOptions.map((scope) => `<option value="${scope}" ${activeThemeDraft.scope === scope ? 'selected' : ''}>${escapeHtml(scope)}</option>`).join('')}
                        </select>
                        <div class="presentation-theme-grid">
                            <label>Primary Color <input id="presentation-theme-primary" type="color" value="${escapeHtml(activeThemeDraft.colors.primary)}"></label>
                            <label>Background Color <input id="presentation-theme-background" type="color" value="${escapeHtml(activeThemeDraft.colors.background)}"></label>
                            <label>Text Color <input id="presentation-theme-text" type="color" value="${escapeHtml(activeThemeDraft.colors.text)}"></label>
                            <label>Heading Color <input id="presentation-theme-heading" type="color" value="${escapeHtml(activeThemeDraft.colors.heading)}"></label>
                            <label>Link Color <input id="presentation-theme-link" type="color" value="${escapeHtml(activeThemeDraft.colors.link)}"></label>
                            <label>Focus Indicator Color <input id="presentation-theme-focus" type="color" value="${escapeHtml(activeThemeDraft.colors.focusIndicator)}"></label>
                            <label>Font Family <input id="presentation-theme-font-family" type="text" value="${escapeHtml(activeThemeDraft.typography.fontFamily)}"></label>
                            <label>Heading Font Family <input id="presentation-theme-heading-font-family" type="text" value="${escapeHtml(activeThemeDraft.typography.headingFontFamily)}"></label>
                            <label>Base Font Size <input id="presentation-theme-font-size" type="number" min="12" max="24" step="1" value="${Number(activeThemeDraft.typography.fontSize || 16)}"></label>
                            <label>Line Height <input id="presentation-theme-line-height" type="number" min="1.2" max="2.4" step="0.05" value="${Number(activeThemeDraft.typography.lineHeight || 1.6)}"></label>
                        </div>
                        <label class="branding-toggle">
                            <input id="presentation-theme-link-underline" type="checkbox" ${activeThemeDraft.links.underline ? 'checked' : ''}>
                            Underline links so they are not identified by color alone.
                        </label>
                        <div class="branding-image-list__actions" role="group" aria-label="Theme resource actions">
                            <button id="btn-presentation-theme-save" type="button">Save Theme</button>
                            <button id="btn-presentation-theme-duplicate" type="button">Duplicate Theme</button>
                            <button id="btn-presentation-theme-rename" type="button">Rename Theme</button>
                            <button id="btn-presentation-theme-delete" type="button">Delete Theme</button>
                        </div>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.coverPage ? 'open' : ''}>
                    <summary id="presentation-cover-summary">Cover Page</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-cover-summary">
                        <label class="branding-toggle"><input type="checkbox" id="presentation-cover-enabled" ${activeLayoutDraft.coverPage?.enabled ? 'checked' : ''}> Include a cover page in published output.</label>
                        <label class="branding-toggle"><input type="checkbox" id="presentation-cover-logo" ${activeLayoutDraft.coverPage?.includeLogo !== false ? 'checked' : ''}> Include branding logo on the cover page.</label>
                        <label class="branding-toggle"><input type="checkbox" id="presentation-cover-author" ${activeLayoutDraft.coverPage?.includeAuthor !== false ? 'checked' : ''}> Include author information on the cover page.</label>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.tableOfContents ? 'open' : ''}>
                    <summary id="presentation-toc-summary">Table of Contents</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-toc-summary">
                        <label class="branding-toggle"><input type="checkbox" id="presentation-toc-enabled" ${activeLayoutDraft.tableOfContents?.enabled ? 'checked' : ''}> Include a Table of Contents that matches actual published headings.</label>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.pageNumbering ? 'open' : ''}>
                    <summary id="presentation-page-summary">Page Numbering</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-page-summary">
                        <label class="branding-toggle"><input type="checkbox" id="presentation-page-numbering-enabled" ${activeLayoutDraft.pageNumbering?.enabled !== false ? 'checked' : ''}> Enable native page numbering where supported.</label>
                        <label for="presentation-page-numbering-position">Page Number Position</label>
                        <select id="presentation-page-numbering-position">
                            ${['footer-left', 'footer-center', 'footer-right'].map((value) => `<option value="${value}" ${activeLayoutDraft.pageNumbering?.position === value ? 'selected' : ''}>${escapeHtml(value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))}</option>`).join('')}
                        </select>
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.accessibility ? 'open' : ''}>
                    <summary id="presentation-accessibility-summary">Accessibility</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-accessibility-summary">
                        <p>Theme contrast, link differentiation, heading readability, focus visibility, layout compatibility, and branding alternative text are validated here.</p>
                        ${buildPresentationValidationMarkup(presentationValidation)}
                    </div>
                </details>

                <details class="presentation-config__panel" ${presentationUi.expandedSections.advanced ? 'open' : ''}>
                    <summary id="presentation-preview-summary">Preview</summary>
                    <div class="presentation-config__body" aria-labelledby="presentation-preview-summary">
                        <div id="presentation-preview-host">${buildPresentationPreviewMarkup()}</div>
                    </div>
                </details>
                </div>
            </details>

            <section class="branding-config" aria-labelledby="branding-config-toggle-label">
                <label id="branding-config-toggle-label" class="branding-toggle">
                    <input type="checkbox" id="branding-enabled" ${branding.enabled ? 'checked' : ''}>
                    Include Report Branding
                </label>
            <details id="branding-config-region" class="branding-config" ${reportBrandingExpanded ? 'open' : ''} ${branding.enabled ? '' : 'hidden'}>
                <summary id="branding-config-summary">Report Branding Options</summary>
                <div id="branding-config-content" aria-labelledby="branding-config-summary">
                <h3 id="branding-config-heading" class="sr-only">Report Branding Options</h3>
                <p>Branding remains a reusable resource. Changes here act as the current report override unless you save them for reuse.</p>
                <label for="presentation-branding-select">Reusable Branding</label>
                <select id="presentation-branding-select">
                    <option value="">Current Report Branding Override</option>
                    ${renderPresentationResourceOptions(presentationLibrary.brandings, presentationSelections.brandingId)}
                </select>
                <label for="presentation-branding-name">Branding Resource Name</label>
                <input id="presentation-branding-name" type="text" value="${escapeHtml(resolvedPresentation.branding.name || 'Current Report Branding Override')}">
                <label for="presentation-branding-scope">Branding Scope</label>
                <select id="presentation-branding-scope">
                    ${presentationScopeOptions.map((scope) => `<option value="${scope}" ${resolvedPresentation.branding.scope === scope ? 'selected' : ''}>${escapeHtml(scope)}</option>`).join('')}
                </select>

                <div id="branding-controls" ${branding.enabled ? '' : 'hidden'}>
                    <div>
                        <label for="branding-header-editor">Brand Header Content</label>
                        <p id="branding-header-help">Paste rich text from Word, Docs, or web content. Formatting is preserved where supported.</p>
                        <div class="branding-rich-toolbar" role="group" aria-label="Brand header formatting tools">
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="bold">Bold</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="italic">Italic</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="underline">Underline</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="insertUnorderedList">Bullets</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="insertOrderedList">Numbering</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="createLink">Link</button>
                            <button type="button" data-branding-editor="branding-header-editor" data-branding-command="removeFormat">Clear Format</button>
                            <button type="button" data-branding-add-image="header">Insert Image</button>
                        </div>
                        <input id="branding-header-image-file" type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden>
                        <div id="branding-header-editor" class="branding-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-describedby="branding-header-help">${brandingHeaderHtml}</div>
                        <div id="branding-header-images-manager" class="branding-image-manager" aria-label="Header image management"></div>
                    </div>
                    <div>
                        <label for="branding-footer-editor">Brand Footer Content</label>
                        <p id="branding-footer-help">Use the footer for legal text, privacy notices, or publication details.</p>
                        <div class="branding-rich-toolbar" role="group" aria-label="Brand footer formatting tools">
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="bold">Bold</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="italic">Italic</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="underline">Underline</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="insertUnorderedList">Bullets</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="insertOrderedList">Numbering</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="createLink">Link</button>
                            <button type="button" data-branding-editor="branding-footer-editor" data-branding-command="removeFormat">Clear Format</button>
                            <button type="button" data-branding-add-image="footer">Insert Image</button>
                        </div>
                        <input id="branding-footer-image-file" type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden>
                        <div id="branding-footer-editor" class="branding-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-describedby="branding-footer-help">${brandingFooterHtml}</div>
                        <div id="branding-footer-images-manager" class="branding-image-manager" aria-label="Footer image management"></div>
                    </div>
                    <label>Primary Brand Color: <input type="color" id="branding-primary-color" value="${escapeHtml(branding.primaryColor)}"></label>
                    <fieldset>
                        <legend>Preview Page Margins</legend>
                        <label>Top <input type="number" id="branding-margin-top" min="0" max="200" step="1" value="${Number(branding.pageMargins?.top || 48)}"></label>
                        <label>Right <input type="number" id="branding-margin-right" min="0" max="200" step="1" value="${Number(branding.pageMargins?.right || 48)}"></label>
                        <label>Bottom <input type="number" id="branding-margin-bottom" min="0" max="200" step="1" value="${Number(branding.pageMargins?.bottom || 48)}"></label>
                        <label>Left <input type="number" id="branding-margin-left" min="0" max="200" step="1" value="${Number(branding.pageMargins?.left || 48)}"></label>
                    </fieldset>
                    <label class="branding-toggle">
                        <input type="checkbox" id="branding-show-page-numbers" ${branding.showPageNumbers !== false ? 'checked' : ''}>
                        Show page numbers in branding preview
                    </label>
                    <p id="branding-logo-alt-error" class="branding-error" role="status" aria-live="polite"></p>
                    <p id="branding-image-manager-status" class="open-report-status" role="status" aria-live="polite"></p>
                    ${canApplyBrandingToActiveWorkspace() ? `
                        <label class="branding-toggle">
                            <input type="checkbox" id="branding-apply-workspace-default" ${applyWorkspaceBrandingDefault ? 'checked' : ''}>
                            Make this the default branding for new reports in this Project Workspace.
                        </label>
                    ` : ''}
                    <div class="branding-image-list__actions" role="group" aria-label="Branding resource actions">
                        <button id="btn-presentation-branding-save" type="button">Save Branding</button>
                        <button id="btn-presentation-branding-duplicate" type="button">Duplicate Branding</button>
                        <button id="btn-presentation-branding-rename" type="button">Rename Branding</button>
                        <button id="btn-presentation-branding-delete" type="button">Delete Branding</button>
                    </div>
                    <section class="branding-live-preview" aria-labelledby="branding-live-preview-heading">
                        <h4 id="branding-live-preview-heading">Branding Preview</h4>
                        <div id="branding-live-preview">${buildBrandingPreviewMarkup(branding)}</div>
                    </section>
                </div>
                </div>
            </details>
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
                    <option value="attachment" ${editType === 'attachment' ? 'selected' : ''}>Attachment</option>
                    <option value="evaluation-item-selection" ${editType === 'evaluation-item-selection' ? 'selected' : ''}>Evaluation Item Selection Box</option>
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
                        ${wcagCriteria.map((criterion) => `<option>${escapeHtml(formatWcagCriterionDisplay(criterion))}</option>`).join('')}
                    </select>
                </div>
                <div id="progress-item-options-container" ${editType === 'evaluation-item-selection' ? '' : 'hidden'}>
                    <label for="progress-item-options-preview">Evaluation Item Preview</label>
                    <p id="progress-item-options-help">The Report Editor will populate this field from current Progress Log evaluation item names only.</p>
                    <select id="progress-item-options-preview" size="6" aria-describedby="progress-item-options-help" disabled>
                        ${progressItemNames.length > 0
                            ? progressItemNames.map((name) => `<option>${escapeHtml(name)}</option>`).join('')
                            : '<option>No evaluation items available</option>'}
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
            ${appState.reportType === 'Audit Log' ? `
                <section id="progress-log-builder-region" aria-labelledby="progress-log-builder-heading">
                    <h3 id="progress-log-builder-heading">Progress Log Configuration</h3>
                    <label class="branding-toggle">
                        <input type="checkbox" id="progress-log-enabled" ${appState.progressLogEnabled ? 'checked' : ''}>
                        Enable Progress Log
                    </label>
                    ${showProgressLogConfig ? `
                        <label class="branding-toggle">
                            <input type="checkbox" id="progress-log-appendix-enabled" ${appState.progressLogAppendixEnabled ? 'checked' : ''}>
                            Include Progress Log Appendix
                        </label>
                        <p>Evaluation item workflow data remains separate from audit findings and can be included as an appendix in Report Viewer and exports.</p>
                        ${buildProgressItemRows(progressTypeSuggestions, progressStatusOptions)}
                        <button id="btn-progress-item-add" type="button">Add Evaluation Item</button>
                    ` : '<p>Progress Log is optional. Enable it to manage evaluation items for this Audit Log.</p>'}
                </section>
            ` : ''}
            ${appState.templateEditingId ? '<button id="btn-save-template-changes" type="button">Apply Template Changes</button>' : ''}
            <button id="btn-done" type="button">Done</button>
        </section>
    `;

    // --- Listeners ---
    const toggleConfigButton = document.getElementById('btn-toggle-config');
    const toggleFieldConfiguration = () => {
        appState.fieldsExpanded = !appState.fieldsExpanded;
        saveState();
        renderBuilder();
    };

    const activateFieldConfigurationToggle = () => {
        const now = Date.now();
        if (now - lastFieldConfigurationActivationAt < 200) return;
        lastFieldConfigurationActivationAt = now;
        toggleFieldConfiguration();
    };

    if (toggleConfigButton) {
        toggleConfigButton.addEventListener('click', (event) => {
            event.preventDefault();
            activateFieldConfigurationToggle();
        });
        toggleConfigButton.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== 'NumpadEnter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            activateFieldConfigurationToggle();
        });
    }

    const presentationConfigRegion = document.getElementById('presentation-config-region');
    if (presentationConfigRegion instanceof HTMLDetailsElement) {
        presentationConfigRegion.addEventListener('toggle', () => {
            publishingPresentationExpanded = presentationConfigRegion.open;
        });
    }

    const brandingConfigRegion = document.getElementById('branding-config-region');
    if (brandingConfigRegion instanceof HTMLDetailsElement) {
        brandingConfigRegion.addEventListener('toggle', () => {
            reportBrandingExpanded = brandingConfigRegion.open;
        });
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

    const refreshPresentationRegion = () => {
        const summary = document.getElementById('presentation-summary');
        if (summary) {
            const nextResolved = getResolvedReportPresentation();
            const nextValidation = getPresentationValidation();
            summary.textContent = buildPresentationSummary(nextResolved, nextValidation);
        }
        const previewHost = document.getElementById('presentation-preview-host');
        if (previewHost) previewHost.innerHTML = buildPresentationPreviewMarkup();
    };

    const commitLayoutDraft = (mutate) => {
        const draft = cloneCurrentLayoutDraft(getResolvedReportPresentation());
        mutate(draft);
        updatePresentationOverride('layout', draft, { action: 'Updated report layout override' });
        renderBuilder();
    };

    const commitThemeDraft = (mutate) => {
        const draft = cloneCurrentThemeDraft(getResolvedReportPresentation());
        mutate(draft);
        updatePresentationOverride('theme', draft, { action: 'Updated report theme override' });
        renderBuilder();
    };

    container.querySelectorAll('.presentation-config__panel').forEach((panel) => {
        panel.addEventListener('toggle', () => {
            const summaryId = panel.querySelector('summary')?.id || '';
            const sectionKey = summaryId
                .replace('presentation-', '')
                .replace('-summary', '')
                .replace('toc', 'tableOfContents')
                .replace('page', 'pageNumbering')
                .replace('cover', 'coverPage')
                .replace('preview', 'advanced');
            updatePresentationUiSection(sectionKey, panel.open, { action: `Updated presentation section ${sectionKey}` });
        });
    });

    const presentationProfileSelect = document.getElementById('presentation-profile-select');
    if (presentationProfileSelect) {
        presentationProfileSelect.addEventListener('change', () => {
            const profileId = String(presentationProfileSelect.value || '').trim();
            if (profileId) {
                applyPresentationPublishingProfile(profileId);
            } else {
                clearPresentationPublishingProfile();
            }
            renderBuilder();
        });
    }

    const presentationPreviewMode = document.getElementById('presentation-preview-mode');
    if (presentationPreviewMode) {
        presentationPreviewMode.addEventListener('change', () => {
            updatePresentationPreviewMode(presentationPreviewMode.value);
            refreshPresentationRegion();
        });
    }

    const presentationAllowOverrides = document.getElementById('presentation-allow-overrides');
    if (presentationAllowOverrides instanceof HTMLInputElement) {
        presentationAllowOverrides.addEventListener('change', () => {
            appState.presentation.reportPresentation.allowOverrides = presentationAllowOverrides.checked;
            saveState({ action: 'Updated presentation override permission' });
            refreshPresentationRegion();
        });
    }

    const presentationLayoutSelect = document.getElementById('presentation-layout-select');
    if (presentationLayoutSelect) {
        presentationLayoutSelect.addEventListener('change', () => {
            updatePresentationSelection({ layoutId: presentationLayoutSelect.value, publishingProfileId: '' }, { action: 'Selected reusable report layout' });
            renderBuilder();
        });
    }

    const presentationLayoutFindingStyle = document.getElementById('presentation-layout-finding-style');
    if (presentationLayoutFindingStyle) {
        presentationLayoutFindingStyle.addEventListener('change', () => {
            commitLayoutDraft((draft) => {
                draft.name = String(document.getElementById('presentation-layout-name')?.value || draft.name || 'Custom Layout').trim() || 'Custom Layout';
                draft.scope = String(document.getElementById('presentation-layout-scope')?.value || draft.scope || 'personal').trim() || 'personal';
                draft.findingPresentation = presentationLayoutFindingStyle.value;
            });
        });
    }

    const presentationThemeSelect = document.getElementById('presentation-theme-select');
    if (presentationThemeSelect) {
        presentationThemeSelect.addEventListener('change', () => {
            updatePresentationSelection({ themeId: presentationThemeSelect.value, publishingProfileId: '' }, { action: 'Selected reusable report theme' });
            renderBuilder();
        });
    }

    [
        ['presentation-theme-primary', 'primary'],
        ['presentation-theme-background', 'background'],
        ['presentation-theme-text', 'text'],
        ['presentation-theme-heading', 'heading'],
        ['presentation-theme-link', 'link'],
        ['presentation-theme-focus', 'focusIndicator']
    ].forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) return;
        input.addEventListener('input', () => {
            commitThemeDraft((draft) => {
                draft.name = String(document.getElementById('presentation-theme-name')?.value || draft.name || 'Custom Theme').trim() || 'Custom Theme';
                draft.scope = String(document.getElementById('presentation-theme-scope')?.value || draft.scope || 'personal').trim() || 'personal';
                draft.colors[key] = input.value;
            });
        });
    });

    [
        ['presentation-theme-font-family', 'fontFamily'],
        ['presentation-theme-heading-font-family', 'headingFontFamily'],
        ['presentation-theme-font-size', 'fontSize'],
        ['presentation-theme-line-height', 'lineHeight']
    ].forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) return;
        input.addEventListener('input', () => {
            commitThemeDraft((draft) => {
                draft.name = String(document.getElementById('presentation-theme-name')?.value || draft.name || 'Custom Theme').trim() || 'Custom Theme';
                draft.scope = String(document.getElementById('presentation-theme-scope')?.value || draft.scope || 'personal').trim() || 'personal';
                draft.typography[key] = input.type === 'number' ? Number(input.value || 0) : input.value;
            });
        });
    });

    const presentationThemeUnderline = document.getElementById('presentation-theme-link-underline');
    if (presentationThemeUnderline instanceof HTMLInputElement) {
        presentationThemeUnderline.addEventListener('change', () => {
            commitThemeDraft((draft) => {
                draft.links.underline = presentationThemeUnderline.checked;
            });
        });
    }

    const presentationBrandingSelect = document.getElementById('presentation-branding-select');
    if (presentationBrandingSelect) {
        presentationBrandingSelect.addEventListener('change', () => {
            updatePresentationSelection({ brandingId: presentationBrandingSelect.value, publishingProfileId: '' }, { action: 'Selected reusable report branding' });
            renderBuilder();
        });
    }

    const saveResourceFromInputs = (type) => {
        if (type === 'layout') {
            const name = String(document.getElementById('presentation-layout-name')?.value || '').trim();
            const scope = String(document.getElementById('presentation-layout-scope')?.value || 'personal').trim() || 'personal';
            const draft = cloneCurrentLayoutDraft(getResolvedReportPresentation());
            draft.name = name || draft.name || 'Custom Layout';
            draft.scope = scope;
            return savePresentationResource('layout', draft, { action: `Saved reusable layout ${draft.name}` });
        }
        if (type === 'theme') {
            const name = String(document.getElementById('presentation-theme-name')?.value || '').trim();
            const scope = String(document.getElementById('presentation-theme-scope')?.value || 'personal').trim() || 'personal';
            const draft = cloneCurrentThemeDraft(getResolvedReportPresentation());
            draft.name = name || draft.name || 'Custom Theme';
            draft.scope = scope;
            return savePresentationResource('theme', draft, { action: `Saved reusable theme ${draft.name}` });
        }
        const name = String(document.getElementById('presentation-branding-name')?.value || '').trim();
        const scope = String(document.getElementById('presentation-branding-scope')?.value || 'personal').trim() || 'personal';
        const draft = {
            ...getResolvedReportPresentation().branding,
            name: name || getResolvedReportPresentation().branding.name || 'Custom Branding',
            scope,
            enabled: getBrandingState().enabled,
            headerText: getBrandingState().headerText,
            headerHtml: getBrandingState().headerHtml,
            footerHtml: getBrandingState().footerHtml,
            headerImages: getBrandingState().headerImages,
            footerImages: getBrandingState().footerImages,
            primaryColor: getBrandingState().primaryColor,
            pageMargins: getBrandingState().pageMargins,
            showPageNumbers: getBrandingState().showPageNumbers
        };
        return savePresentationResource('branding', draft, { action: `Saved reusable branding ${draft.name}` });
    };

    [
        ['btn-presentation-layout-save', 'layout'],
        ['btn-presentation-theme-save', 'theme'],
        ['btn-presentation-branding-save', 'branding']
    ].forEach(([id, type]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            const saved = saveResourceFromInputs(type);
            if (!saved) return;
            if (type === 'layout') updatePresentationSelection({ layoutId: saved.id, publishingProfileId: '' });
            if (type === 'theme') updatePresentationSelection({ themeId: saved.id, publishingProfileId: '' });
            if (type === 'branding') updatePresentationSelection({ brandingId: saved.id, publishingProfileId: '' });
            renderBuilder();
        });
    });

    [
        ['btn-presentation-layout-duplicate', 'layout', resolvedPresentation.layout.id],
        ['btn-presentation-theme-duplicate', 'theme', resolvedPresentation.theme.id],
        ['btn-presentation-branding-duplicate', 'branding', resolvedPresentation.branding.id]
    ].forEach(([id, type, resourceId]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            const duplicated = duplicatePresentationResource(type, resourceId);
            if (!duplicated) return;
            if (type === 'layout') updatePresentationSelection({ layoutId: duplicated.id, publishingProfileId: '' });
            if (type === 'theme') updatePresentationSelection({ themeId: duplicated.id, publishingProfileId: '' });
            if (type === 'branding') updatePresentationSelection({ brandingId: duplicated.id, publishingProfileId: '' });
            renderBuilder();
        });
    });

    [
        ['btn-presentation-layout-rename', 'layout', resolvedPresentation.layout.id, 'presentation-layout-name'],
        ['btn-presentation-theme-rename', 'theme', resolvedPresentation.theme.id, 'presentation-theme-name'],
        ['btn-presentation-branding-rename', 'branding', resolvedPresentation.branding.id, 'presentation-branding-name']
    ].forEach(([id, type, resourceId, inputId]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            const resource = getPresentationResourceLibrary()[type === 'branding' ? 'brandings' : `${type}s`].find((item) => item.id === resourceId);
            if (!resource || resource.readOnly) {
                announce('Built-in presentation resources cannot be renamed. Save a personal or workspace copy first.');
                return;
            }
            const renamed = renamePresentationResource(type, resourceId, String(document.getElementById(inputId)?.value || '').trim());
            if (!renamed) return;
            renderBuilder();
        });
    });

    [
        ['btn-presentation-layout-delete', 'layout', resolvedPresentation.layout.id],
        ['btn-presentation-theme-delete', 'theme', resolvedPresentation.theme.id],
        ['btn-presentation-branding-delete', 'branding', resolvedPresentation.branding.id]
    ].forEach(([id, type, resourceId]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            const usage = getPresentationResourceUsage(type, resourceId);
            if (usage.length > 0) {
                announce(`Cannot delete this ${type}. It is still referenced by ${usage.length} resource${usage.length === 1 ? '' : 's'}.`);
                return;
            }
            const result = deletePresentationResource(type, resourceId);
            if (!result?.ok) return;
            if (type === 'layout') updatePresentationSelection({ layoutId: 'layout-detailed-accessibility-audit', publishingProfileId: '' });
            if (type === 'theme') updatePresentationSelection({ themeId: 'theme-art-accessible-default', publishingProfileId: '' });
            if (type === 'branding') updatePresentationSelection({ brandingId: '', publishingProfileId: '' });
            renderBuilder();
        });
    });

    container.querySelectorAll('[data-presentation-layout-section-enabled]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const sectionId = checkbox.getAttribute('data-presentation-layout-section-enabled');
            if (!sectionId) return;
            commitLayoutDraft((draft) => {
                draft.sections = draft.sections.map((section) => section.id === sectionId
                    ? { ...section, enabled: checkbox.checked }
                    : section);
            });
        });
    });

    container.querySelectorAll('[data-presentation-layout-move-earlier], [data-presentation-layout-move-later]').forEach((button) => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-presentation-layout-move-earlier') || button.getAttribute('data-presentation-layout-move-later');
            const direction = button.hasAttribute('data-presentation-layout-move-earlier') ? -1 : 1;
            if (!sectionId) return;
            commitLayoutDraft((draft) => {
                const index = draft.sections.findIndex((section) => section.id === sectionId);
                const nextIndex = index + direction;
                if (index < 0 || nextIndex < 0 || nextIndex >= draft.sections.length) return;
                const reordered = [...draft.sections];
                const [moved] = reordered.splice(index, 1);
                reordered.splice(nextIndex, 0, moved);
                draft.sections = reordered;
            });
        });
    });

    [
        ['presentation-cover-enabled', 'enabled'],
        ['presentation-cover-logo', 'includeLogo'],
        ['presentation-cover-author', 'includeAuthor']
    ].forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) return;
        input.addEventListener('change', () => {
            commitLayoutDraft((draft) => {
                draft.coverPage = {
                    ...draft.coverPage,
                    [key]: input.checked
                };
            });
        });
    });

    const presentationTocEnabled = document.getElementById('presentation-toc-enabled');
    if (presentationTocEnabled instanceof HTMLInputElement) {
        presentationTocEnabled.addEventListener('change', () => {
            commitLayoutDraft((draft) => {
                draft.tableOfContents = {
                    ...draft.tableOfContents,
                    enabled: presentationTocEnabled.checked
                };
            });
        });
    }

    const presentationPageNumberingEnabled = document.getElementById('presentation-page-numbering-enabled');
    if (presentationPageNumberingEnabled instanceof HTMLInputElement) {
        presentationPageNumberingEnabled.addEventListener('change', () => {
            commitLayoutDraft((draft) => {
                draft.pageNumbering = {
                    ...draft.pageNumbering,
                    enabled: presentationPageNumberingEnabled.checked
                };
            });
        });
    }

    const presentationPageNumberingPosition = document.getElementById('presentation-page-numbering-position');
    if (presentationPageNumberingPosition) {
        presentationPageNumberingPosition.addEventListener('change', () => {
            commitLayoutDraft((draft) => {
                draft.pageNumbering = {
                    ...draft.pageNumbering,
                    position: presentationPageNumberingPosition.value
                };
            });
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
            setPresentationBrandingFromLegacyState();
            renderBuilder();
        });
    }

    attachBrandingRichEditor('branding-header-editor', 'headerHtml', 'headerText');
    attachBrandingRichEditor('branding-footer-editor', 'footerHtml');

    const brandingToolbarButtons = document.querySelectorAll('button[data-branding-editor][data-branding-command]');
    brandingToolbarButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const editorId = String(button.getAttribute('data-branding-editor') || '').trim();
            const command = String(button.getAttribute('data-branding-command') || '').trim();
            if (!editorId || !command) return;
            applyBrandingFormatCommand(editorId, command);
            const editor = document.getElementById(editorId);
            if (!(editor instanceof HTMLElement)) return;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    const brandingPrimaryColor = document.getElementById('branding-primary-color');
    if (brandingPrimaryColor) {
        brandingPrimaryColor.addEventListener('input', (e) => {
            appState.branding = {
                ...getBrandingState(),
                primaryColor: e.target.value
            };
            saveState();
            setPresentationBrandingFromLegacyState();
            refreshBrandingPreview();
        });
    }

    ['top', 'right', 'bottom', 'left'].forEach((edge) => {
        const marginInput = document.getElementById(`branding-margin-${edge}`);
        if (!(marginInput instanceof HTMLInputElement)) return;
        marginInput.addEventListener('input', () => {
            const current = getBrandingState();
            appState.branding = {
                ...current,
                pageMargins: {
                    ...current.pageMargins,
                    [edge]: Number(marginInput.value || 0)
                }
            };
            saveState();
            setPresentationBrandingFromLegacyState();
            refreshBrandingPreview();
        });
    });

    const showPageNumbers = document.getElementById('branding-show-page-numbers');
    if (showPageNumbers instanceof HTMLInputElement) {
        showPageNumbers.addEventListener('change', () => {
            appState.branding = {
                ...getBrandingState(),
                showPageNumbers: showPageNumbers.checked
            };
            saveState();
            setPresentationBrandingFromLegacyState();
            refreshBrandingPreview();
        });
    }

    const applyWorkspaceDefault = document.getElementById('branding-apply-workspace-default');
    if (applyWorkspaceDefault instanceof HTMLInputElement) {
        applyWorkspaceDefault.addEventListener('change', () => {
            applyWorkspaceBrandingDefault = applyWorkspaceDefault.checked;
        });
    }

    const readImageFileAsDataUrl = async (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read-failed'));
        reader.readAsDataURL(file);
    });

    const persistSectionEditor = (section) => {
        const editorId = section === 'footer' ? 'branding-footer-editor' : 'branding-header-editor';
        const stateKey = section === 'footer' ? 'footerHtml' : 'headerHtml';
        const fallbackKey = section === 'header' ? 'headerText' : '';
        const editor = document.getElementById(editorId);
        if (!(editor instanceof HTMLElement)) return;
        const sanitized = sanitizeBrandingHtml(editor.innerHTML);
        editor.innerHTML = sanitized;
        appState.branding = {
            ...getBrandingState(),
            [stateKey]: sanitized,
            ...(fallbackKey ? { [fallbackKey]: htmlToPlainText(sanitized) } : {})
        };
        syncBrandingImagesFromEditor(editorId);
        saveState();
        setPresentationBrandingFromLegacyState();
        refreshBrandingPreview();
    };

    const insertImageFromFile = async (section, file) => {
        if (!file) return;
        const isSupported = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(String(file.type || '').toLowerCase());
        if (!isSupported) {
            announce('Only PNG, JPG, and SVG images are supported for branding.');
            return;
        }

        try {
            const dataUrl = await readImageFileAsDataUrl(file);
            const image = normalizeBrandingImageEntry({
                id: `branding-image-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                dataUrl,
                fileName: String(file.name || '').trim(),
                altText: '',
                alignment: 'inline',
                spacing: 8,
                maxDisplayWidth: 160,
                maxDisplayHeight: 80
            });

            if (!insertBrandingImageAtCursor(section, image)) return;
            persistSectionEditor(section);
            renderBrandingImageManagers();
            setBrandingStatus('Image inserted. Add alternative text before saving.');
            const altInput = document.querySelector(`[data-branding-image-alt="${CSS.escape(image.id)}"]`);
            if (altInput instanceof HTMLElement) altInput.focus();
        } catch (error) {
            announce('Could not read image file.');
        }
    };

    ['header', 'footer'].forEach((section) => {
        const addImageButton = document.querySelector(`[data-branding-add-image="${section}"]`);
        const fileInput = document.getElementById(section === 'header' ? 'branding-header-image-file' : 'branding-footer-image-file');
        if (addImageButton instanceof HTMLButtonElement && fileInput instanceof HTMLInputElement) {
            addImageButton.addEventListener('click', () => {
                fileInput.click();
            });
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                await insertImageFromFile(section, file);
                fileInput.value = '';
            });
        }
    });

    renderBrandingImageManagers();

    const getImageContext = (target, attr) => {
        if (!(target instanceof HTMLElement)) return null;
        const imageId = String(target.getAttribute(attr) || '').trim();
        const section = String(target.getAttribute('data-branding-section') || 'header').trim();
        if (!imageId) return null;
        return { imageId, section };
    };

    container.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.matches('[data-branding-image-alt]')) {
            const context = getImageContext(target, 'data-branding-image-alt');
            if (!context) return;
            const images = getBrandingImagesForSection(context.section).map((image) => {
                if (image.id !== context.imageId) return image;
                return { ...image, altText: target.value };
            });
            updateBrandingImagesForSection(context.section, images);
            const node = findEditorImageNode(context.section, context.imageId);
            if (node instanceof HTMLImageElement) {
                const current = images.find((item) => item.id === context.imageId);
                if (current) applyBrandingImageToNode(node, current, context.section);
                persistSectionEditor(context.section);
            }
            validateBrandingInputs(false);
            return;
        }

        const propertyMap = [
            ['data-branding-image-spacing', (image, value) => ({ ...image, spacing: Number(value || 0) })],
            ['data-branding-image-width', (image, value) => ({ ...image, maxDisplayWidth: Number(value || 160) })],
            ['data-branding-image-height', (image, value) => ({ ...image, maxDisplayHeight: Number(value || 80) })]
        ];

        propertyMap.forEach(([attr, apply]) => {
            if (!target.matches(`[${attr}]`)) return;
            const context = getImageContext(target, attr);
            if (!context) return;
            const images = getBrandingImagesForSection(context.section).map((image) => image.id === context.imageId
                ? apply(image, target.value)
                : image);
            updateBrandingImagesForSection(context.section, images);
            const node = findEditorImageNode(context.section, context.imageId);
            const current = images.find((item) => item.id === context.imageId);
            if (node instanceof HTMLImageElement && current) {
                applyBrandingImageToNode(node, current, context.section);
                persistSectionEditor(context.section);
            }
        });
    });

    container.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches('[data-branding-image-alignment]')) return;
        const context = getImageContext(target, 'data-branding-image-alignment');
        if (!context) return;
        const images = getBrandingImagesForSection(context.section).map((image) => image.id === context.imageId
            ? { ...image, alignment: target.value }
            : image);
        updateBrandingImagesForSection(context.section, images);
        const node = findEditorImageNode(context.section, context.imageId);
        const current = images.find((item) => item.id === context.imageId);
        if (node instanceof HTMLImageElement && current) {
            applyBrandingImageToNode(node, current, context.section);
            persistSectionEditor(context.section);
        }
    });

    container.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.matches('[data-branding-image-remove]')) {
            const context = getImageContext(target, 'data-branding-image-remove');
            if (!context) return;
            const images = getBrandingImagesForSection(context.section).filter((image) => image.id !== context.imageId);
            updateBrandingImagesForSection(context.section, images, 'Branding image removed.');
            const node = findEditorImageNode(context.section, context.imageId);
            node?.remove();
            persistSectionEditor(context.section);
            renderBrandingImageManagers();
            validateBrandingInputs(false);
            return;
        }

        if (target.matches('[data-branding-image-move-earlier], [data-branding-image-move-later]')) {
            const isEarlier = target.matches('[data-branding-image-move-earlier]');
            const context = getImageContext(target, isEarlier ? 'data-branding-image-move-earlier' : 'data-branding-image-move-later');
            if (!context) return;
            const images = getBrandingImagesForSection(context.section);
            const index = images.findIndex((image) => image.id === context.imageId);
            if (index < 0) return;
            const nextIndex = isEarlier ? index - 1 : index + 1;
            if (nextIndex < 0 || nextIndex >= images.length) return;
            const reordered = [...images];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(nextIndex, 0, moved);
            updateBrandingImagesForSection(context.section, reordered, `Image moved ${isEarlier ? 'earlier' : 'later'}.`);
            moveBrandingImageNode(context.section, context.imageId, isEarlier ? -1 : 1);
            persistSectionEditor(context.section);
            renderBrandingImageManagers();
            return;
        }

        if (target.matches('[data-branding-image-replace]')) {
            const context = getImageContext(target, 'data-branding-image-replace');
            if (!context) return;
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'file';
            hiddenInput.accept = 'image/png,image/jpeg,image/jpg,image/svg+xml';
            hiddenInput.style.display = 'none';
            document.body.appendChild(hiddenInput);
            hiddenInput.click();
            hiddenInput.addEventListener('change', async () => {
                const file = hiddenInput.files && hiddenInput.files[0];
                if (!file) {
                    document.body.removeChild(hiddenInput);
                    return;
                }
                try {
                    const dataUrl = await readImageFileAsDataUrl(file);
                    const images = getBrandingImagesForSection(context.section).map((image) => image.id === context.imageId
                        ? { ...image, dataUrl, fileName: String(file.name || '').trim() }
                        : image);
                    updateBrandingImagesForSection(context.section, images, 'Branding image replaced.');
                    const node = findEditorImageNode(context.section, context.imageId);
                    const current = images.find((image) => image.id === context.imageId);
                    if (node instanceof HTMLImageElement && current) {
                        applyBrandingImageToNode(node, current, context.section);
                        persistSectionEditor(context.section);
                    }
                    renderBrandingImageManagers();
                } catch (error) {
                    announce('Could not replace image.');
                } finally {
                    document.body.removeChild(hiddenInput);
                }
            }, { once: true });
        }
    });

    container.addEventListener('dragstart', (event) => {
        const item = event.target instanceof HTMLElement ? event.target.closest('.branding-image-list__item[draggable="true"]') : null;
        if (!(item instanceof HTMLElement)) return;
        event.dataTransfer?.setData('text/plain', String(item.getAttribute('data-branding-image-id') || ''));
        event.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', (event) => {
        const item = event.target instanceof HTMLElement ? event.target.closest('.branding-image-list__item[draggable="true"]') : null;
        if (!item) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', (event) => {
        const item = event.target instanceof HTMLElement ? event.target.closest('.branding-image-list__item[draggable="true"]') : null;
        if (!(item instanceof HTMLElement)) return;
        event.preventDefault();
        const sourceId = String(event.dataTransfer?.getData('text/plain') || '').trim();
        const targetId = String(item.getAttribute('data-branding-image-id') || '').trim();
        const section = String(item.getAttribute('data-branding-section') || 'header').trim();
        if (!sourceId || !targetId || sourceId === targetId) return;
        const images = getBrandingImagesForSection(section);
        const from = images.findIndex((image) => image.id === sourceId);
        const to = images.findIndex((image) => image.id === targetId);
        if (from < 0 || to < 0) return;
        const reordered = [...images];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        updateBrandingImagesForSection(section, reordered, 'Branding image moved.');

        const editor = getBrandingEditor(section);
        if (editor) {
            const sourceNode = findEditorImageNode(section, sourceId);
            const targetNode = findEditorImageNode(section, targetId);
            if (sourceNode && targetNode && sourceNode !== targetNode) {
                targetNode.parentNode?.insertBefore(sourceNode, targetNode);
                persistSectionEditor(section);
            }
        }
        renderBrandingImageManagers();
    });

    validateBrandingInputs(false);
    refreshBrandingPreview();

    const reportTypeSelect = document.getElementById('report-type-select');
    if (reportTypeSelect) {
        setupSelectAnnouncement(reportTypeSelect, 'Report Type');
        reportTypeSelect.addEventListener('change', (e) => {
            const nextReportType = e.target.value;
            appState.reportType = e.target.value;
            appState.reportLayout = '';
            appState.templateOption = '';
            appState.templateName = '';
            appState.templateDescription = '';
            if (nextReportType === 'Audit Log') {
                appState.progressLogEnabled = true;
                appState.progressLogAppendixEnabled = true;
            } else {
                appState.progressLogEnabled = false;
                appState.progressLogAppendixEnabled = false;
            }
            saveState();
            pendingFocus = { index: null, action: 'report-type-select' };
            renderBuilder();
        });
    }

    const progressLogEnabled = document.getElementById('progress-log-enabled');
    if (progressLogEnabled) {
        progressLogEnabled.addEventListener('change', (event) => {
            updateProgressLogSettings({ progressLogEnabled: event.target.checked }, { action: 'Updated progress log enabled setting' });
            pendingFocus = { index: null, action: 'progress-log-enabled' };
            renderBuilder();
        });
    }

    const progressLogAppendixEnabled = document.getElementById('progress-log-appendix-enabled');
    if (progressLogAppendixEnabled) {
        progressLogAppendixEnabled.addEventListener('change', (event) => {
            updateProgressLogSettings({ progressLogAppendixEnabled: event.target.checked }, { action: 'Updated progress log appendix setting' });
        });
    }

    const addProgressItemButton = document.getElementById('btn-progress-item-add');
    if (addProgressItemButton) {
        addProgressItemButton.addEventListener('click', () => {
            const created = addProgressItem({ type: progressTypeSuggestions[0], status: progressStatusOptions[0] });
            announce(`Added evaluation item ${getProgressItems().length}.`);
            pendingFocus = { index: null, action: 'progress-item-name', itemId: created.id };
            renderBuilder();
        });
    }

    container.querySelectorAll('[data-progress-item-id]').forEach((fieldset) => {
        const itemId = fieldset.getAttribute('data-progress-item-id');
        if (!itemId) return;

        fieldset.querySelectorAll('[data-progress-field]').forEach((input) => {
            const fieldName = input.getAttribute('data-progress-field');
            const eventName = input.tagName.toLowerCase() === 'select' ? 'change' : 'input';
            input.addEventListener(eventName, (event) => {
                const nextValue = event.target.type === 'number' ? Number(event.target.value || 0) : event.target.value;
                updateProgressItem(itemId, { [fieldName]: nextValue });
            });
        });

        fieldset.querySelector('[data-progress-action="remove"]')?.addEventListener('click', () => {
            const itemsBeforeRemove = getProgressItems();
            const removedIndex = itemsBeforeRemove.findIndex((item) => item.id === itemId);
            const nextFocusItem = removedIndex >= 0
                ? (itemsBeforeRemove[removedIndex + 1] || itemsBeforeRemove[removedIndex - 1] || null)
                : null;
            const removed = removeProgressItem(itemId);
            if (!removed) return;
            announce(`Removed evaluation item ${removed.name || ''}`.trim());
            pendingFocus = nextFocusItem
                ? { index: null, action: 'progress-item-name', itemId: nextFocusItem.id }
                : { index: null, action: 'btn-progress-item-add' };
            renderBuilder();
        });
    });

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
    const progressItemOptionsContainer = document.getElementById('progress-item-options-container');
    if (fieldTypeInput && dropdownOptionsContainer && wcagOptionsContainer && progressItemOptionsContainer) {
        setupSelectAnnouncement(fieldTypeInput, 'Field Type');
        const commitFieldType = () => {
            dropdownOptionsContainer.hidden = fieldTypeInput.value !== 'dropdown';
            wcagOptionsContainer.hidden = !isWcagCriterionFieldType(fieldTypeInput.value);
            progressItemOptionsContainer.hidden = fieldTypeInput.value !== 'evaluation-item-selection';
        };
        fieldTypeInput.addEventListener('change', (e) => {
            appState.fieldsExpanded = true;
            saveState();
            commitFieldType();
        });
        fieldTypeInput.addEventListener('blur', commitFieldType);
        commitFieldType();
    }

    document.getElementById('btn-add-field').addEventListener('click', async () => {
        const result = await executeBuilderAction('addField');
        if (!result?.ok) {
            executeAddFieldFromCommand();
        }
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
                requestBuilderFocus('delete', nextIndex);
            } else {
                requestBuilderFocus('btn-add-field');
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
        doneButton.addEventListener('click', async () => {
            const result = await executeBuilderAction('done');
            if (!result?.ok) {
                executeDoneFromCommand();
            }
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
            btnEdit.onclick = () => { setEditMode(i); requestBuilderFocus('field-label-input'); renderBuilder(); };

            const btnMoveUp = document.createElement('button');
            btnMoveUp.innerText = 'Move Up';
            btnMoveUp.id = `btn-move-up-${i}`;
            btnMoveUp.dataset.fieldAction = 'move-up';
            btnMoveUp.dataset.fieldIndex = String(i);
            btnMoveUp.setAttribute('aria-label', `Move ${f.label} Up`);
            btnMoveUp.disabled = i === 0;
            btnMoveUp.onclick = () => {
                const newIndex = moveField(i, -1);
                if (newIndex === undefined) return;
                requestBuilderFocus('move-up', newIndex);
                renderBuilder();
            };

            const btnMoveDown = document.createElement('button');
            btnMoveDown.innerText = 'Move Down';
            btnMoveDown.id = `btn-move-down-${i}`;
            btnMoveDown.dataset.fieldAction = 'move-down';
            btnMoveDown.dataset.fieldIndex = String(i);
            btnMoveDown.setAttribute('aria-label', `Move ${f.label} Down`);
            btnMoveDown.disabled = i === appState.fields.length - 1;
            btnMoveDown.onclick = () => {
                const newIndex = moveField(i, 1);
                if (newIndex === undefined) return;
                requestBuilderFocus('move-down', newIndex);
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
