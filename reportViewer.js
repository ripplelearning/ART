import { appState, announce, getCurrentReportMetrics, getProgressItems, isProgressLogAppendixEnabled, isProgressLogEnabled, recordSecurityAudit, saveState, serializeArtJsonPayload, serializeArtProjectPayload, setNetworkActivity, upsertCurrentReport } from './state.js';
import { formatWcagCriterionDisplay, isWcagCriterionFieldType } from './wcagCatalog.js';
import { openProgressLogDialog } from './progressLog.js';
import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { buildPresentationCssVariables, getResolvedReportPresentation } from './reportPresentationFramework.js';

let openExportDialogOnRender = false;
let openPrintPreviewOnRender = false;
let viewerAttachmentRegistry = new Map();
let viewerAttachmentObjectUrls = new Map();
let viewerAttachmentSequence = 0;

async function executeViewerAction(action, context = {}) {
    const command = commandRegistry.findCommands({ action })[0] || null;
    if (!command?.id) return null;
    return commandExecutionService.executeCommand(command.id, {
        source: 'viewer',
        action,
        ...context
    });
}

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => script.src === src);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function ensureExportLibraries(format) {
    if (!window.JSZip) {
        await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }
    if (format === 'xlsx' && !window.XLSX) {
        await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }
}

export function requestViewerExportDialog() {
    openExportDialogOnRender = true;
}

export function requestViewerPrintPreview() {
    openPrintPreviewOnRender = true;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function isAttachmentFieldType(type) {
    return normalizeFieldType(type) === 'attachment';
}

function normalizeAttachmentList(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const name = String(item.name || '').trim();
            const dataBase64 = String(item.dataBase64 || '').trim();
            if (!name || !dataBase64) return null;

            const size = Number(item.size);
            const lastModified = Number(item.lastModified);
            return {
                id: String(item.id || `attachment-${Date.now()}-${index}`),
                name,
                type: String(item.type || 'application/octet-stream'),
                size: Number.isFinite(size) && size >= 0 ? size : 0,
                lastModified: Number.isFinite(lastModified) && lastModified >= 0 ? lastModified : 0,
                dataBase64
            };
        })
        .filter(Boolean);
}

function base64ToUint8Array(base64Text) {
    const binary = atob(String(base64Text || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function createAttachmentBlob(attachment) {
    return new Blob([base64ToUint8Array(attachment.dataBase64)], {
        type: attachment.type || 'application/octet-stream'
    });
}

function isPreviewableAttachment(attachment) {
    const mime = String(attachment?.type || '').toLowerCase();
    return mime.startsWith('text/')
        || mime.startsWith('image/')
        || mime.startsWith('audio/')
        || mime.startsWith('video/')
        || mime === 'application/pdf'
        || mime.includes('json')
        || mime.includes('xml');
}

function sanitizeAttachmentFileName(fileName) {
    const base = String(fileName || 'attachment').trim() || 'attachment';
    return base.replace(/[\\/:*?"<>|]+/g, '_');
}

function buildAttachmentExportPath(entryIndex, fieldIndex, fileName) {
    const entrySegment = entryIndex === null ? 'primary' : `entry-${entryIndex + 1}`;
    const fieldSegment = `field-${fieldIndex + 1}`;
    return `attachments/${entrySegment}/${fieldSegment}/${sanitizeAttachmentFileName(fileName)}`;
}

function cleanupViewerAttachmentUrls() {
    viewerAttachmentObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    viewerAttachmentObjectUrls.clear();
    viewerAttachmentRegistry.clear();
    viewerAttachmentSequence = 0;
}

function registerViewerAttachment(attachment) {
    const key = `viewer-attachment-${viewerAttachmentSequence + 1}`;
    viewerAttachmentSequence += 1;
    viewerAttachmentRegistry.set(key, attachment);
    return key;
}

function getViewerAttachmentObjectUrl(attachmentKey) {
    const existing = viewerAttachmentObjectUrls.get(attachmentKey);
    if (existing) return existing;

    const attachment = viewerAttachmentRegistry.get(attachmentKey);
    if (!attachment) return '';

    const objectUrl = URL.createObjectURL(createAttachmentBlob(attachment));
    viewerAttachmentObjectUrls.set(attachmentKey, objectUrl);
    return objectUrl;
}

function normalizeAccessibilityLinkText(rawValue, fallbackText = '') {
    const structured = rawValue && typeof rawValue === 'object' ? rawValue : null;
    if (structured) {
        const formatted = formatWcagCriterionDisplay(structured).trim();
        if (formatted) return formatted;
    }

    return String(fallbackText || '')
        .replace(/^Open official W3C Understanding documentation for\s+/i, '')
        .trim();
}

function normalizeBrandingImageEntry(input, index = 0, section = 'header') {
    const source = input && typeof input === 'object' ? input : {};
    const dataUrl = String(source.dataUrl || '').trim();
    if (!dataUrl) return null;

    const alignment = String(source.alignment || 'inline').toLowerCase();
    const safeAlignment = ['left', 'center', 'right', 'inline'].includes(alignment) ? alignment : 'inline';
    const spacing = Number.isFinite(Number(source.spacing)) ? Number(source.spacing) : 8;
    const maxDisplayWidth = Number.isFinite(Number(source.maxDisplayWidth)) ? Number(source.maxDisplayWidth) : 160;
    const maxDisplayHeight = Number.isFinite(Number(source.maxDisplayHeight)) ? Number(source.maxDisplayHeight) : 80;

    return {
        id: String(source.id || `${section}-image-${index + 1}`),
        dataUrl,
        altText: String(source.altText || '').trim(),
        fileName: String(source.fileName || '').trim(),
        alignment: safeAlignment,
        spacing: Math.max(0, Math.min(64, spacing)),
        maxDisplayWidth: Math.max(24, Math.min(2000, maxDisplayWidth)),
        maxDisplayHeight: Math.max(24, Math.min(2000, maxDisplayHeight))
    };
}

function normalizeBrandingImageList(images, section = 'header') {
    if (!Array.isArray(images)) return [];
    return images
        .map((entry, index) => normalizeBrandingImageEntry(entry, index, section))
        .filter(Boolean);
}

function normalizeBrandingMargins(input) {
    const source = input && typeof input === 'object' ? input : {};
    const normalizeEdge = (key) => {
        const value = Number(source[key]);
        if (!Number.isFinite(value)) return 48;
        return Math.max(0, Math.min(200, value));
    };

    return {
        top: normalizeEdge('top'),
        right: normalizeEdge('right'),
        bottom: normalizeEdge('bottom'),
        left: normalizeEdge('left')
    };
}

function getBrandingImageStyle(image) {
    const spacing = Number.isFinite(Number(image?.spacing)) ? Number(image.spacing) : 8;
    const maxWidth = Number.isFinite(Number(image?.maxDisplayWidth)) ? Number(image.maxDisplayWidth) : 160;
    const maxHeight = Number.isFinite(Number(image?.maxDisplayHeight)) ? Number(image.maxDisplayHeight) : 80;
    const alignment = String(image?.alignment || 'inline');
    const style = [`max-width:${Math.max(24, maxWidth)}px`, `max-height:${Math.max(24, maxHeight)}px`, 'width:auto', 'height:auto'];

    if (alignment === 'left') {
        style.push('display:block', `margin:${Math.max(0, spacing)}px auto ${Math.max(0, spacing)}px 0`);
    } else if (alignment === 'center') {
        style.push('display:block', `margin:${Math.max(0, spacing)}px auto`);
    } else if (alignment === 'right') {
        style.push('display:block', `margin:${Math.max(0, spacing)}px 0 ${Math.max(0, spacing)}px auto`);
    } else {
        style.push('display:inline-block', `margin:${Math.max(0, spacing)}px`, 'vertical-align:middle');
    }

    return style.join('; ');
}

function renderBrandingImageCollection(images) {
    return normalizeBrandingImageList(images)
        .map((image) => `<img class="viewer-brand-image" src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.altText || 'Brand image')}" style="${escapeHtml(getBrandingImageStyle(image))}" data-branding-image-id="${escapeHtml(image.id)}" />`)
        .join('');
}

function getBrandingState() {
    const headerImages = normalizeBrandingImageList(appState.branding?.headerImages, 'header');
    const footerImages = normalizeBrandingImageList(appState.branding?.footerImages, 'footer');

    if (headerImages.length === 0 && String(appState.branding?.logoDataUrl || '').trim()) {
        headerImages.push(normalizeBrandingImageEntry({
            id: 'legacy-logo',
            dataUrl: String(appState.branding.logoDataUrl || ''),
            altText: String(appState.branding.logoAltText || '').trim() || 'Brand logo',
            fileName: String(appState.branding.logoFileName || '').trim(),
            alignment: 'inline',
            spacing: 8,
            maxDisplayWidth: 160,
            maxDisplayHeight: 80
        }, 0, 'header'));
    }

    return {
        enabled: Boolean(appState.branding?.enabled),
        headerText: String(appState.branding?.headerText || ''),
        headerHtml: String(appState.branding?.headerHtml || ''),
        footerHtml: String(appState.branding?.footerHtml || ''),
        headerImages,
        footerImages,
        pageMargins: normalizeBrandingMargins(appState.branding?.pageMargins),
        showPageNumbers: appState.branding?.showPageNumbers !== false,
        primaryColor: String(appState.branding?.primaryColor || '#005a9c'),
        logoDataUrl: String(appState.branding?.logoDataUrl || ''),
        logoAltText: String(appState.branding?.logoAltText || ''),
        logoDecorative: Boolean(appState.branding?.logoDecorative)
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

function getBrandingTextLines() {
    const branding = getBrandingState();
    if (!branding.enabled) return [];

    const headerHtml = sanitizeBrandingHtml(branding.headerHtml);
    const footerHtml = sanitizeBrandingHtml(branding.footerHtml);
    const headerText = htmlToPlainText(headerHtml) || branding.headerText.trim();
    const footerText = htmlToPlainText(footerHtml);

    const lines = [];
    if (headerText) lines.push(`Brand Header: ${headerText}`);
    if (footerText) lines.push(`Brand Footer: ${footerText}`);
    branding.headerImages.forEach((image, index) => {
        lines.push(`Header Image ${index + 1}: ${image.altText || image.fileName || 'Brand image'}`);
    });
    branding.footerImages.forEach((image, index) => {
        lines.push(`Footer Image ${index + 1}: ${image.altText || image.fileName || 'Brand image'}`);
    });
    if (branding.primaryColor.trim()) lines.push(`Brand Color: ${branding.primaryColor.trim()}`);
    if (branding.showPageNumbers) lines.push('Page Numbers: Enabled');
    lines.push(`Page Margins (px): top ${branding.pageMargins.top}, right ${branding.pageMargins.right}, bottom ${branding.pageMargins.bottom}, left ${branding.pageMargins.left}`);
    return lines;
}

function getMetadataRows() {
    return [
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
    ].filter(([, value]) => String(value || '').trim() !== '');
}

function getFieldRows() {
    return getResolvedFieldEntries(false).map((entry) => [entry.label, entry.type === 'attachment' ? renderAttachmentExportText(entry) : entry.exportText]);
}

function getAuditEntriesList() {
    if (Array.isArray(appState.auditEntries) && appState.auditEntries.length > 0) {
        return appState.auditEntries;
    }
    return [{ id: 'entry-1', fieldValues: appState.editorFieldValues || {} }];
}

function getResolvedFieldEntriesForValues(fieldValues, hideEmpty = true, context = {}) {
    const entryIndex = Number.isInteger(context?.entryIndex) ? context.entryIndex : null;
    return (appState.fields || []).map((field, index) => {
        const type = normalizeFieldType(field.type);
        const rawValue = fieldValues?.[index] ?? '';
        const label = String(field.label || `Field ${index + 1}`);

        if (isWcagCriterionFieldType(type)) {
            const structured = rawValue && typeof rawValue === 'object' ? rawValue : null;
            const displaySource = structured ? formatWcagCriterionDisplay(structured) : String(rawValue || '');
            const displayText = normalizeAccessibilityLinkText(rawValue, displaySource);
            const understandingUrl = structured ? String(structured.understandingUrl || '') : '';
            return {
                index,
                field,
                label,
                type,
                rawValue,
                displayText,
                exportText: displayText,
                url: understandingUrl,
                isEmpty: displayText.trim() === ''
            };
        }

        if (isAttachmentFieldType(type)) {
            const attachments = normalizeAttachmentList(rawValue).map((attachment) => ({
                ...attachment,
                exportPath: buildAttachmentExportPath(entryIndex, index, attachment.name)
            }));

            return {
                index,
                field,
                label,
                type,
                rawValue,
                displayText: attachments.map((attachment) => attachment.name).join(', '),
                exportText: attachments.map((attachment) => attachment.name).join(', '),
                url: '',
                attachments,
                isEmpty: attachments.length === 0
            };
        }

        if (type === 'usability-heuristics') {
            const list = Array.isArray(rawValue)
                ? rawValue.map((v) => String(v).trim()).filter(Boolean)
                : String(rawValue || '').split(/[\r\n,;]+/).map((v) => v.trim()).filter(Boolean);
            const displayText = list.join(', ');
            return {
                index,
                field,
                label,
                type,
                rawValue,
                displayText,
                exportText: displayText,
                url: '',
                attachments: [],
                isEmpty: displayText.trim() === ''
            };
        }

        return {
            index,
            field,
            label,
            type,
            rawValue,
            displayText: String(rawValue || ''),
            exportText: String(rawValue || ''),
            url: '',
            attachments: [],
            isEmpty: String(rawValue || '').trim() === ''
        };
    }).filter((entry) => !hideEmpty || !entry.isEmpty);
}

function getAuditEntryGroups(hideEmpty = true) {
    return getAuditEntriesList().map((auditEntry, entryIndex) => ({
        entryIndex,
        title: String(auditEntry?.fieldValues?.[0] || '').trim() || `Entry ${entryIndex + 1}`,
        entries: getResolvedFieldEntriesForValues(auditEntry?.fieldValues || {}, hideEmpty, { entryIndex })
    }));
}

function getResolvedFieldEntries(hideEmpty = true) {
    return getResolvedFieldEntriesForValues(appState.editorFieldValues || {}, hideEmpty, { entryIndex: null });
}

function getProgressAppendixItems() {
    return isProgressLogAppendixEnabled() ? getProgressItems() : [];
}

function buildProgressAppendixText() {
    const items = getProgressAppendixItems();
    if (items.length === 0) return '';

    const lines = ['Progress Log Appendix'];
    const instructions = String(appState.testingInstructions || '').trim();
    if (instructions) {
        lines.push(`Testing Instructions: ${instructions}`);
    }
    items.forEach((item) => {
        const name = String(item.name || 'Untitled Evaluation Item').trim() || 'Untitled Evaluation Item';
        const location = String(item.location || '').trim();
        lines.push(location ? `${name}: ${location}` : name);
    });
    return lines.join('\n');
}

function buildProgressAppendixMarkdown() {
    const items = getProgressAppendixItems();
    if (items.length === 0) return '';

    const lines = ['## Progress Log Appendix'];
    const instructions = String(appState.testingInstructions || '').trim();
    if (instructions) {
        lines.push(`- **Testing Instructions:** ${instructions}`);
    }
    items.forEach((item) => {
        const name = String(item.name || 'Untitled Evaluation Item').trim() || 'Untitled Evaluation Item';
        const location = String(item.location || '').trim();
        lines.push(location ? `- **${name}:** ${location}` : `- **${name}**`);
    });
    return lines.join('\n');
}

function renderProgressAppendixHtmlSection() {
    const items = getProgressAppendixItems();
    if (items.length === 0) return '';

    return `
        <section aria-labelledby="viewer-progress-appendix-heading">
            <h2 id="viewer-progress-appendix-heading">Progress Log Appendix</h2>
            ${String(appState.testingInstructions || '').trim() ? `<p><strong>Testing Instructions:</strong> ${escapeHtml(appState.testingInstructions)}</p>` : ''}
            <ul>
                ${items.map((item) => {
                    const name = escapeHtml(item.name || 'Untitled Evaluation Item');
                    const location = String(item.location || '').trim();
                    if (/^https?:/i.test(location)) {
                        return `<li><a href="${escapeHtml(location)}" target="_blank" rel="noopener noreferrer">${name}</a> <span>(opens in new tab)</span></li>`;
                    }
                    if (location) return `<li><strong>${name}:</strong> ${escapeHtml(location)}</li>`;
                    return `<li>${name}</li>`;
                }).join('')}
            </ul>
        </section>
    `;
}

function getPresentationContext() {
    return getResolvedReportPresentation();
}

function getRecommendationEntries() {
    const recommendationIndexes = (appState.fields || [])
        .map((field, index) => ({ field, index }))
        .filter(({ field }) => /recommend|remediation|fix/i.test(String(field?.label || '')));

    if (recommendationIndexes.length === 0) return [];

    return recommendationIndexes.map(({ field, index }) => {
        const entry = getResolvedFieldEntries(false).find((item) => item.index === index);
        return entry
            ? {
                label: String(field.label || `Field ${index + 1}`),
                text: String(entry.exportText || entry.displayText || '').trim()
            }
            : null;
    }).filter((item) => item && item.text);
}

function getReferenceEntries() {
    const entries = [];
    if (/^https?:/i.test(String(appState.scopeUrl || '').trim())) {
        entries.push({ label: 'Scope URL', text: String(appState.scopeUrl).trim(), url: String(appState.scopeUrl).trim() });
    }

    getResolvedFieldEntries(false).forEach((entry) => {
        if (!entry.url) return;
        entries.push({
            label: entry.label,
            text: entry.displayText,
            url: entry.url
        });
    });

    return entries;
}

function getEvidenceEntries() {
    const evidence = [];
    getResolvedFieldEntries(false).forEach((entry) => {
        if (!Array.isArray(entry.attachments) || entry.attachments.length === 0) return;
        entry.attachments.forEach((attachment) => {
            evidence.push({
                label: entry.label,
                text: attachment.name,
                exportPath: attachment.exportPath
            });
        });
    });
    return evidence;
}

function getAnalyticsRowsForPresentation() {
    const metrics = getCurrentReportMetrics();
    return [
        ['Total Audit Entries', String(metrics.totalAuditEntries || 0)],
        ['Total Issues', String(metrics.totalIssues || 0)],
        ['Issues by Severity', String(metrics.issuesBySeverity || 'None')],
        ['Unique Pages Tested', String(metrics.pagesTested || 0)],
        ['WCAG Success Criteria Referenced', String(metrics.wcagCriteria || 0)]
    ];
}

function buildPresentationSectionModels() {
    const presentation = getPresentationContext();
    const metadataRows = getMetadataRows();
    const recommendationEntries = getRecommendationEntries();
    const referenceEntries = getReferenceEntries();
    const evidenceEntries = getEvidenceEntries();
    const analyticsRows = getAnalyticsRowsForPresentation();
    const tocSections = presentation.visibleSections
        .filter((section) => !['cover-page', 'table-of-contents'].includes(section.id))
        .map((section) => section.label);
    const models = [];

    const pushModel = (model) => {
        if (!model) return;
        models.push(model);
    };

    presentation.visibleSections.forEach((section) => {
        const title = section.label;
        switch (section.id) {
            case 'cover-page': {
                const lines = [appState.reportTitle || 'Untitled Report'];
                if (appState.orgClient) lines.push(appState.orgClient);
                if (appState.projectName) lines.push(appState.projectName);
                if (appState.auditDateEnd || appState.auditDateStart) lines.push(`Report Date: ${appState.auditDateEnd || appState.auditDateStart}`);
                if (appState.auditors) lines.push(`Author: ${appState.auditors}`);
                if (appState.testingInstructions) lines.push(`Description: ${appState.testingInstructions}`);
                pushModel({
                    id: section.id,
                    title,
                    textLines: lines,
                    markdown: `# ${appState.reportTitle || 'Untitled Report'}\n\n${lines.slice(1).map((line) => `- ${line}`).join('\n')}`,
                    html: `<section class="viewer-presentation-cover" aria-labelledby="viewer-cover-heading"><h1 id="viewer-cover-heading">${escapeHtml(appState.reportTitle || 'Untitled Report')}</h1>${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section>`,
                    paragraphs: [{ style: 'Title', text: appState.reportTitle || 'Untitled Report' }, ...lines.slice(1).map((line) => ({ style: 'Normal', text: line }))]
                });
                break;
            }
            case 'table-of-contents': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: tocSections,
                    markdown: `## ${title}\n${tocSections.map((line) => `- ${line}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-toc-heading"><h2 id="viewer-toc-heading">${escapeHtml(title)}</h2><ol>${tocSections.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...tocSections.map((line) => ({ style: 'Normal', text: line }))]
                });
                break;
            }
            case 'executive-summary': {
                const entries = getVisibleFieldEntries().slice(0, 5);
                pushModel({
                    id: section.id,
                    title,
                    textLines: entries.map((entry) => `${entry.label}: ${entry.value}`),
                    markdown: `## ${title}\n${entries.map((entry) => `- **${entry.label}:** ${entry.value}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-executive-summary-heading"><h2 id="viewer-executive-summary-heading">${escapeHtml(title)}</h2><ul>${entries.map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${entry.url ? renderWcagViewerLink(entry, entry.value) : escapeHtml(entry.value)}</li>`).join('')}</ul></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...entries.map((entry) => ({ style: 'Normal', text: `${entry.label}: ${entry.value}` }))]
                });
                break;
            }
            case 'workspace-report-summary': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: metadataRows.map(([label, value]) => `${label}: ${value}`),
                    markdown: `## ${title}\n${metadataRows.map(([label, value]) => `- **${label}:** ${value}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-report-summary-heading"><h2 id="viewer-report-summary-heading">${escapeHtml(title)}</h2><dl class="viewer-metadata-list">${metadataRows.map(([label, value]) => `<div class="viewer-metadata-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...metadataRows.map(([label, value]) => ({ style: 'Normal', text: `${label}: ${value}` }))]
                });
                break;
            }
            case 'analytics': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: analyticsRows.map(([label, value]) => `${label}: ${value}`),
                    markdown: `## ${title}\n${analyticsRows.map(([label, value]) => `- **${label}:** ${value}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-analytics-heading"><h2 id="viewer-analytics-heading">${escapeHtml(title)}</h2><ul>${analyticsRows.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...analyticsRows.map(([label, value]) => ({ style: 'Normal', text: `${label}: ${value}` }))]
                });
                break;
            }
            case 'findings': {
                const html = appState.reportLayout === 'Template'
                    ? renderTemplateLayoutFields()
                    : renderNonTemplateLayout();
                const textLines = appState.reportType === 'Audit Log'
                    ? getAuditEntryGroups(false).flatMap((group) => {
                        const lines = [group.title];
                        group.entries.forEach((entry) => {
                            if (entry.type === 'attachment') {
                                lines.push(`${entry.label}: ${renderAttachmentExportText(entry)}`);
                            } else if (entry.url) {
                                lines.push(`${entry.label}: ${entry.displayText} (${entry.url})`);
                            } else {
                                lines.push(`${entry.label}: ${entry.exportText}`);
                            }
                        });
                        return lines;
                    })
                    : getResolvedFieldEntries(false).map((entry) => {
                        if (entry.type === 'attachment') return `${entry.label}: ${renderAttachmentExportText(entry)}`;
                        if (entry.url) return `${entry.label}: ${entry.displayText} (${entry.url})`;
                        return `${entry.label}: ${entry.exportText}`;
                    });
                pushModel({
                    id: section.id,
                    title,
                    textLines,
                    markdown: `## ${title}\n${textLines.map((line) => `- ${line}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-findings-heading"><h2 id="viewer-findings-heading">${escapeHtml(title)}</h2>${html}</section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...textLines.map((line) => ({ style: 'Normal', text: line }))]
                });
                break;
            }
            case 'recommendations': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: recommendationEntries.map((entry) => `${entry.label}: ${entry.text}`),
                    markdown: `## ${title}\n${recommendationEntries.map((entry) => `- **${entry.label}:** ${entry.text}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-recommendations-heading"><h2 id="viewer-recommendations-heading">${escapeHtml(title)}</h2><ul>${recommendationEntries.map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.text)}</li>`).join('')}</ul></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...recommendationEntries.map((entry) => ({ style: 'Normal', text: `${entry.label}: ${entry.text}` }))]
                });
                break;
            }
            case 'appendices': {
                const appendixText = buildProgressAppendixText();
                pushModel({
                    id: section.id,
                    title,
                    textLines: appendixText ? appendixText.split(/\r\n|\r|\n/).filter(Boolean) : [],
                    markdown: buildProgressAppendixMarkdown(),
                    html: renderProgressAppendixHtmlSection(),
                    paragraphs: appendixText ? appendixText.split(/\r\n|\r|\n/).filter(Boolean).map((line, index) => ({ style: index === 0 ? 'Heading1' : 'Normal', text: line })) : []
                });
                break;
            }
            case 'references': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: referenceEntries.map((entry) => `${entry.label}: ${entry.text}`),
                    markdown: `## ${title}\n${referenceEntries.map((entry) => `- [${entry.label}](${entry.url})`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-references-heading"><h2 id="viewer-references-heading">${escapeHtml(title)}</h2><ul>${referenceEntries.map((entry) => `<li><a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.label)}</a></li>`).join('')}</ul></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...referenceEntries.map((entry) => ({ style: 'Normal', text: `${entry.label}: ${entry.text}`, url: entry.url }))]
                });
                break;
            }
            case 'evidence': {
                pushModel({
                    id: section.id,
                    title,
                    textLines: evidenceEntries.map((entry) => `${entry.label}: ${entry.text}`),
                    markdown: `## ${title}\n${evidenceEntries.map((entry) => `- **${entry.label}:** ${entry.text}`).join('\n')}`,
                    html: `<section aria-labelledby="viewer-evidence-heading"><h2 id="viewer-evidence-heading">${escapeHtml(title)}</h2><ul>${evidenceEntries.map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.text)}</li>`).join('')}</ul></section>`,
                    paragraphs: [{ style: 'Heading1', text: title }, ...evidenceEntries.map((entry) => ({ style: 'Normal', text: `${entry.label}: ${entry.text}` }))]
                });
                break;
            }
            default:
                break;
        }
    });

    return models.filter((model) => Array.isArray(model.textLines) ? model.textLines.length > 0 || ['cover-page', 'table-of-contents'].includes(model.id) : Boolean(model.html));
}

function buildPresentationStyleAttribute() {
    const resolved = getPresentationContext();
    const cssVariables = buildPresentationCssVariables(resolved.theme, resolved.branding);
    return Object.entries(cssVariables).map(([key, value]) => `${key}:${value}`).join('; ');
}

function renderPresentationDocumentHtml() {
    const presentation = getPresentationContext();
    const sections = buildPresentationSectionModels();
    const brandingBlock = renderBrandingBlock();
    const validationMessages = presentation.validationMessages || [];

    return `
        <section class="viewer-presentation-document" aria-label="Published report preview" data-preview-mode="${escapeHtml(presentation.previewMode)}" style="${escapeHtml(buildPresentationStyleAttribute())}">
            ${brandingBlock}
            ${validationMessages.length > 0 ? `<section class="viewer-presentation-validation" aria-labelledby="viewer-presentation-validation-heading"><h3 id="viewer-presentation-validation-heading">Presentation Validation</h3><ul>${validationMessages.map((message) => `<li><strong>${escapeHtml((message.severity || 'info').toUpperCase())}:</strong> ${escapeHtml(message.message || '')}</li>`).join('')}</ul></section>` : ''}
            ${sections.map((section) => section.html).join('')}
        </section>
    `;
}

function buildTextSummary() {
    return buildPresentationSectionModels()
        .map((section) => `${section.title}\n${(section.textLines || []).join('\n')}`.trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

function buildMarkdownSummary() {
    return buildPresentationSectionModels()
        .map((section) => section.markdown)
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

function buildHtmlSummary() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(appState.reportTitle || 'Report')}</title>
</head>
<body>
    ${renderPresentationDocumentHtml()}
</body>
</html>`;
}

function buildRtfSummary() {
    const escapeRtf = (value) => String(value)
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/\r\n|\r|\n/g, '\\line ');

    const text = escapeRtf(buildTextSummary());
    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22 ${text}}`;
}

function buildXlsxBlob() {
    if (!window.XLSX) {
        throw new Error('SheetJS is not available for XLSX export.');
    }

    const workbook = window.XLSX.utils.book_new();

    const metrics = getCurrentReportMetrics();
    const overviewRows = [['Section', 'Entry', 'Field', 'Value', 'References']];
    getMetadataRows().forEach(([label, value]) => {
        overviewRows.push(['Metadata', '', String(label), String(value || ''), '']);
    });

    getBrandingTextLines().forEach((line) => {
        const parts = String(line).split(':');
        const key = parts.shift() || 'Branding';
        overviewRows.push(['Metadata', '', key.trim(), parts.join(':').trim(), '']);
    });

    overviewRows.push(['Metrics', '', 'Total Audit Entries', String(metrics.totalAuditEntries || 0), '']);
    overviewRows.push(['Metrics', '', 'Total Issues', String(metrics.totalIssues || 0), '']);
    overviewRows.push(['Metrics', '', 'Issues by Severity', String(metrics.issuesBySeverity || 'None'), '']);
    overviewRows.push(['Metrics', '', 'Unique Pages Tested', String(metrics.pagesTested || 0), '']);
    overviewRows.push(['Metrics', '', 'WCAG Success Criteria Referenced', String(metrics.wcagCriteria || 0), '']);

    const configuredFieldLabels = (appState.fields || []).map((field, index) => String(field?.label || `Field ${index + 1}`));
    const auditRows = [['Entry', ...configuredFieldLabels]];

    const toXlsxCellValue = (entry) => {
        const text = String(entry?.displayText || entry?.exportText || '');
        const url = String(entry?.url || '').trim();
        if (!url) return text;
        return {
            t: 's',
            v: text,
            l: {
                Target: url,
                Tooltip: `Open ${text}`
            }
        };
    };

    if (appState.reportType === 'Audit Log') {
        getAuditEntriesList().forEach((auditEntry, entryIndex) => {
            const resolvedEntries = getResolvedFieldEntriesForValues(auditEntry?.fieldValues || {}, false, { entryIndex });
            const entryName = String(auditEntry?.fieldValues?.[0] || '').trim() || `Entry ${entryIndex + 1}`;
            const row = [
                entryName,
                ...resolvedEntries.map((entry) => toXlsxCellValue(entry))
            ];
            auditRows.push(row);

            resolvedEntries.forEach((entry) => {
                if (entry.type === 'attachment') {
                    overviewRows.push(['Accessibility Audit', entryName, entry.label, renderAttachmentExportText(entry), '']);
                } else {
                    overviewRows.push(['Accessibility Audit', entryName, entry.label, entry.exportText, entry.url || '']);
                }
            });
        });
    } else {
        const resolvedEntries = getResolvedFieldEntries(false);
        const row = ['Primary', ...resolvedEntries.map((entry) => toXlsxCellValue(entry))];
        auditRows.push(row);
        resolvedEntries.forEach((entry) => {
            if (entry.type === 'attachment') {
                overviewRows.push(['Accessibility Audit', 'Primary', entry.label, renderAttachmentExportText(entry), '']);
            } else {
                overviewRows.push(['Accessibility Audit', 'Primary', entry.label, entry.exportText, entry.url || '']);
            }
        });
    }

    const progressItems = getProgressAppendixItems();
    if (progressItems.length > 0) {
        const instructions = String(appState.testingInstructions || '').trim();
        if (instructions) {
            overviewRows.push(['Progress Log Appendix', '', 'Testing Instructions', instructions, '']);
        }
        progressItems.forEach((item) => {
            overviewRows.push(['Progress Log Appendix', String(item.name || 'Untitled Evaluation Item'), 'Location', String(item.location || ''), '']);
        });
    }

    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(overviewRows), 'Overview');
    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(auditRows), 'Accessibility Audit');

    const arrayBuffer = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildDocxDocumentXml() {
    const makeParagraph = (text, style = 'Normal') => {
        const paragraphText = String(text || '');
        return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(paragraphText)}</w:t></w:r></w:p>`;
    };

    const makeHyperlinkParagraph = (label, text, url, style = 'Normal') => {
        const safeLabel = String(label || '');
        const safeText = String(text || '');
        const safeUrl = String(url || '');
        return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(safeLabel)}: </w:t></w:r><w:fldSimple w:instr="HYPERLINK &quot;${escapeXml(safeUrl)}&quot;"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0563C1"/></w:rPr><w:t xml:space="preserve">${escapeXml(safeText)}</w:t></w:r></w:fldSimple></w:p>`;
    };

    const paragraphs = [];
    buildPresentationSectionModels().forEach((section) => {
        (section.paragraphs || []).forEach((paragraph) => {
            if (paragraph.url) {
                paragraphs.push(makeHyperlinkParagraph(paragraph.text.split(':')[0] || section.title, paragraph.text.split(':').slice(1).join(':').trim() || paragraph.text, paragraph.url, paragraph.style || 'Normal'));
                return;
            }
            paragraphs.push(makeParagraph(paragraph.text, paragraph.style || 'Normal'));
        });
        paragraphs.push(makeParagraph('', 'Normal'));
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${paragraphs.join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

async function buildDocxBlob() {
    if (!window.JSZip) {
        throw new Error('JSZip is not available for DOCX export.');
    }

    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

    zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

    zip.folder('docProps')?.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(appState.reportTitle || 'Report')}</dc:title>
</cp:coreProperties>`);

    zip.folder('docProps')?.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ART</Application>
</Properties>`);

        zip.folder('word')?.file('document.xml', buildDocxDocumentXml());
        zip.folder('word')?.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:name w:val="Normal"/>
        <w:qFormat/>
        <w:rPr><w:sz w:val="22"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Title">
        <w:name w:val="Title"/>
        <w:basedOn w:val="Normal"/>
        <w:qFormat/>
        <w:rPr><w:b/><w:sz w:val="40"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:basedOn w:val="Normal"/>
        <w:qFormat/>
        <w:rPr><w:b/><w:sz w:val="30"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading2">
        <w:name w:val="heading 2"/>
        <w:basedOn w:val="Normal"/>
        <w:qFormat/>
        <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
    </w:style>
</w:styles>`);

        zip.folder('word')?.folder('_rels')?.file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

function toPdfSafeText(value) {
    return String(value)
        .replace(/[^\x20-\x7E]/g, '?')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function wrapLine(text, maxChars) {
    const raw = String(text || '');
    if (!raw) return [''];

    const words = raw.split(/\s+/);
    const wrapped = [];
    let current = '';

    words.forEach((word) => {
        if (!word) return;
        if (!current) {
            if (word.length <= maxChars) {
                current = word;
                return;
            }
            for (let i = 0; i < word.length; i += maxChars) {
                wrapped.push(word.slice(i, i + maxChars));
            }
            current = '';
            return;
        }

        const candidate = `${current} ${word}`;
        if (candidate.length <= maxChars) {
            current = candidate;
            return;
        }

        wrapped.push(current);
        if (word.length <= maxChars) {
            current = word;
        } else {
            for (let i = 0; i < word.length; i += maxChars) {
                wrapped.push(word.slice(i, i + maxChars));
            }
            current = '';
        }
    });

    if (current) wrapped.push(current);
    return wrapped.length > 0 ? wrapped : [''];
}

function paginatePdfLines(lines, linesPerPage) {
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
        pages.push(lines.slice(i, i + linesPerPage));
    }
    return pages.length > 0 ? pages : [['']];
}

function buildSimplePdfBlob() {
    const reportTitle = String(appState.reportTitle || 'Report');
    const sourceLines = buildTextSummary().split(/\r\n|\r|\n/);
    const wrappedLines = [];
    sourceLines.forEach((line) => {
        wrapLine(line, 95).forEach((wrapped) => wrappedLines.push(wrapped));
    });

    const pages = paginatePdfLines(wrappedLines, 48);
    const pageCount = pages.length;

    const pageObjectNumbers = [];
    const contentObjectNumbers = [];
    for (let i = 0; i < pageCount; i += 1) {
        const pageObj = 3 + (i * 2);
        pageObjectNumbers.push(pageObj);
        contentObjectNumbers.push(pageObj + 1);
    }
    const fontObjectNumber = 3 + (pageCount * 2);

    const objects = [];
    objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
    objects.push(`2 0 obj<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageCount} >>endobj`);

    pages.forEach((pageLines, idx) => {
        const pageObjNum = pageObjectNumbers[idx];
        const contentObjNum = contentObjectNumbers[idx];

        objects.push(`${pageObjNum} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjNum} 0 R >>endobj`);

        const streamLines = ['BT', '/F1 9 Tf', '50 780 Td', `(${toPdfSafeText(reportTitle)}) Tj`, '/F1 11 Tf', '0 -22 Td', '14 TL'];
        pageLines.forEach((line, lineIndex) => {
            if (lineIndex === 0) {
                streamLines.push(`(${toPdfSafeText(line)}) Tj`);
            } else {
                streamLines.push('T*');
                streamLines.push(`(${toPdfSafeText(line)}) Tj`);
            }
        });
        streamLines.push('ET');
        streamLines.push('BT');
        streamLines.push('/F1 9 Tf');
        streamLines.push('250 30 Td');
        streamLines.push(`(${toPdfSafeText(`Page ${idx + 1} of ${pageCount}`)}) Tj`);
        streamLines.push('ET');
        const stream = streamLines.join('\n');

        objects.push(`${contentObjNum} 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj`);
    });

    objects.push(`${fontObjectNumber} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`);

    const header = '%PDF-1.4\n';
    const body = [];
    const offsets = [0];
    let position = header.length;

    objects.forEach((obj) => {
        offsets.push(position);
        body.push(`${obj}\n`);
        position += obj.length + 1;
    });

    const xrefPos = position;
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    const trailer = `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    const pdfContent = `${header}${body.join('')}${xref}${trailer}`;
    return new Blob([pdfContent], { type: 'application/pdf' });
}

async function getExportConfig(format) {
    const fallback = {
        extension: 'txt',
        mimeType: 'text/plain',
        blob: new Blob([buildTextSummary()], { type: 'text/plain' })
    };

    switch (format) {
        case 'docx':
            return {
                extension: 'docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                blob: await buildDocxBlob()
            };
        case 'pdf':
            return { extension: 'pdf', mimeType: 'application/pdf', blob: buildSimplePdfBlob() };
        case 'html':
            return { extension: 'html', mimeType: 'text/html', blob: new Blob([buildHtmlSummary()], { type: 'text/html' }) };
        case 'markdown':
            return { extension: 'md', mimeType: 'text/markdown', blob: new Blob([buildMarkdownSummary()], { type: 'text/markdown' }) };
        case 'txt':
            return { extension: 'txt', mimeType: 'text/plain', blob: new Blob([buildTextSummary()], { type: 'text/plain' }) };
        case 'rtf':
            return { extension: 'rtf', mimeType: 'application/rtf', blob: new Blob([buildRtfSummary()], { type: 'application/rtf' }) };
        case 'xlsx':
            return {
                extension: 'xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                blob: buildXlsxBlob()
            };
        default:
            return fallback;
    }
}

function getAttachmentFilesForExport() {
    const fields = appState.fields || [];
    const files = [];

    if (appState.reportType === 'Audit Log') {
        getAuditEntriesList().forEach((auditEntry, entryIndex) => {
            fields.forEach((field, fieldIndex) => {
                if (!isAttachmentFieldType(field?.type)) return;
                const attachments = normalizeAttachmentList(auditEntry?.fieldValues?.[fieldIndex]);
                attachments.forEach((attachment) => {
                    files.push({
                        exportPath: buildAttachmentExportPath(entryIndex, fieldIndex, attachment.name),
                        attachment
                    });
                });
            });
        });
        return files;
    }

    fields.forEach((field, fieldIndex) => {
        if (!isAttachmentFieldType(field?.type)) return;
        const attachments = normalizeAttachmentList(appState.editorFieldValues?.[fieldIndex]);
        attachments.forEach((attachment) => {
            files.push({
                exportPath: buildAttachmentExportPath(null, fieldIndex, attachment.name),
                attachment
            });
        });
    });

    return files;
}

async function buildZipExportBlob(baseFileName, reportExportConfig) {
    if (!window.JSZip) {
        throw new Error('JSZip is not available for ZIP export.');
    }

    const zip = new window.JSZip();
    const reportFileName = `${baseFileName}.${reportExportConfig.extension}`;
    const artJsonFileName = `${baseFileName}_ART.json`;
    const artProjectFileName = `${baseFileName}.art`;

    const reportArrayBuffer = await reportExportConfig.blob.arrayBuffer();
    zip.file(reportFileName, reportArrayBuffer);
    zip.file(artJsonFileName, serializeArtJsonPayload());
    zip.file(artProjectFileName, serializeArtProjectPayload());
    getAttachmentFilesForExport().forEach(({ exportPath, attachment }) => {
        zip.file(exportPath, base64ToUint8Array(attachment.dataBase64));
    });

    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip'
    });
}

function renderMetadata() {
    const rows = getMetadataRows();

    if (rows.length === 0) return '<p>No metadata is currently set for this report.</p>';

    return `
        <dl class="viewer-metadata-list" aria-label="Report metadata values">
            ${rows.map(([label, value]) => `
                <div class="viewer-metadata-item">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${escapeHtml(value)}</dd>
                </div>
            `).join('')}
        </dl>
    `;
}

function renderTemplateLayoutFields() {
    if (!Array.isArray(appState.fields) || appState.fields.length === 0) {
        return '<p>No fields are configured for this report.</p>';
    }

    return `
        <div class="viewer-fields-list" aria-label="Report field values">
            ${getResolvedFieldEntries(false).map((entry) => {
                let displayValue = entry.displayText;
                if (entry.type === 'dropdown' && String(entry.rawValue).trim() === '') {
                    displayValue = 'No option selected';
                }
                if (entry.isEmpty) {
                    displayValue = 'No value entered';
                }

                const valueMarkup = entry.type === 'attachment'
                    ? renderAttachmentViewerLinks(entry)
                    : (entry.url ? renderWcagViewerLink(entry, displayValue) : escapeHtml(displayValue));

                return `
                    <article class="viewer-field-card">
                        <h4>${escapeHtml(entry.label)}</h4>
                        <p><strong>Type:</strong> ${escapeHtml(entry.type)}</p>
                        <div><strong>Value:</strong> ${valueMarkup}</div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function getVisibleFieldEntries() {
    return getResolvedFieldEntries(true).map((entry) => ({
        index: entry.index,
        label: entry.label,
        type: entry.type,
        value: entry.displayText,
        url: entry.url,
        rawValue: entry.rawValue,
        attachments: entry.attachments || []
    }));
}

function renderAuditParagraphLayout() {
    const groups = getAuditEntryGroups(true);
    if (groups.every((group) => group.entries.length === 0)) return '<p>No populated fields are available for this report.</p>';

    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">Audit Findings</h3>
            ${groups.map((group) => `
                <article class="viewer-paragraph-item">
                    <h4>${escapeHtml(group.title)}</h4>
                    ${group.entries.map((entry) => {
                        if (entry.type === 'attachment') {
                            return `<div><strong>${escapeHtml(entry.label)}:</strong> ${renderAttachmentViewerLinks(entry)}</div>`;
                        }
                        return `<p><strong>${escapeHtml(entry.label)}:</strong> ${entry.url ? renderWcagViewerLink(entry, entry.displayText) : escapeHtml(entry.displayText)}</p>`;
                    }).join('')}
                </article>
            `).join('')}
        </section>
    `;
}

function renderExecutiveParagraphLayout() {
    const entries = getVisibleFieldEntries();
    if (entries.length === 0) return '<p>No populated fields are available for this report.</p>';

    const headingText = appState.reportType === 'Usability Report' ? 'Usability Report Content' : 'Executive Summary Content';
    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">${escapeHtml(headingText)}</h3>
            ${entries.map((entry) => `
                <section class="viewer-paragraph-item" aria-labelledby="field-heading-${entry.index}">
                    <h4 id="field-heading-${entry.index}">${escapeHtml(entry.label)}</h4>
                    ${entry.type === 'attachment'
                        ? `<div>${renderAttachmentViewerLinks(entry)}</div>`
                        : `<p>${entry.url ? renderWcagViewerLink(entry, entry.value) : escapeHtml(entry.value)}</p>`}
                </section>
            `).join('')}
        </section>
    `;
}

function renderAuditTabularLayout() {
    const fields = appState.fields || [];
    const groups = getAuditEntryGroups(false);
    if (fields.length === 0 || groups.length === 0) return '<p>No populated fields are available for this report.</p>';

    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">Audit Log Table</h3>
            <div class="viewer-table-wrapper" tabindex="0" aria-label="Audit log data table container">
                <table class="viewer-layout-table">
                    <caption class="sr-only">Audit log report values</caption>
                    <thead>
                        <tr>
                            ${fields.map((field, index) => `<th id="field-col-${index}" scope="col">${escapeHtml(field.label)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${groups.map((group) => `<tr>${(group.entries.length > 0 ? group.entries : getResolvedFieldEntriesForValues({}, false, { entryIndex: group.entryIndex })).map((entry, index) => {
                            if (entry.type === 'attachment') {
                                return `<td headers="field-col-${index}">${renderAttachmentViewerLinks(entry)}</td>`;
                            }
                            return `<td headers="field-col-${index}">${entry.url ? renderWcagViewerLink(entry, entry.displayText) : escapeHtml(entry.displayText || '')}</td>`;
                        }).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderExecutiveBulletsLayout() {
    const entries = getVisibleFieldEntries();
    if (entries.length === 0) return '<p>No populated fields are available for this report.</p>';

    const headingText = appState.reportType === 'Usability Report' ? 'Usability Report Highlights' : 'Executive Summary Highlights';
    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">${escapeHtml(headingText)}</h3>
            <ul class="viewer-bullet-list">
                ${entries.map((entry) => {
                    if (entry.type === 'attachment') {
                        return `<li><strong>${escapeHtml(entry.label)}:</strong> ${renderAttachmentViewerLinks(entry)}</li>`;
                    }
                    const lines = entry.value.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
                    if (lines.length <= 1) {
                        return `<li><strong>${escapeHtml(entry.label)}:</strong> ${entry.url ? renderWcagViewerLink(entry, entry.value) : escapeHtml(entry.value)}</li>`;
                    }

                    return `
                        <li>
                            <strong>${escapeHtml(entry.label)}</strong>
                            <ul>
                                ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
                            </ul>
                        </li>
                    `;
                }).join('')}
            </ul>
        </section>
    `;
}

function renderNonTemplateLayout() {
    const type = String(appState.reportType || '');
    const layout = String(appState.reportLayout || '');

    if (type === 'Audit Log' && layout === 'Tabular') {
        return renderAuditTabularLayout();
    }
    if (type === 'Audit Log' && layout === 'Paragraphs') {
        return renderAuditParagraphLayout();
    }
    if ((type === 'Executive Summary' || type === 'Usability Report') && layout === 'Bullets') {
        return renderExecutiveBulletsLayout();
    }
    if ((type === 'Executive Summary' || type === 'Usability Report') && layout === 'Paragraphs') {
        return renderExecutiveParagraphLayout();
    }

    return type === 'Audit Log'
        ? renderAuditParagraphLayout()
        : renderExecutiveParagraphLayout();
}

function renderReportBody() {
    if (appState.reportLayout === 'Template') {
        return `
            <section aria-labelledby="viewer-content-heading">
                <h3 id="viewer-content-heading">Report Content</h3>
                ${renderTemplateLayoutFields()}
            </section>
        `;
    }

    return renderNonTemplateLayout();
}

function renderProgressAppendixViewer() {
    const items = getProgressAppendixItems();
    if (items.length === 0) return '';

    return `
        <section aria-labelledby="viewer-progress-log-appendix-heading">
            <h3 id="viewer-progress-log-appendix-heading">Progress Log Appendix</h3>
            ${String(appState.testingInstructions || '').trim() ? `<p><strong>Testing Instructions:</strong> ${escapeHtml(appState.testingInstructions)}</p>` : ''}
            <ul class="viewer-bullet-list">
                ${items.map((item) => {
                    const name = escapeHtml(item.name || 'Untitled Evaluation Item');
                    const location = String(item.location || '').trim();
                    if (/^https?:/i.test(location)) {
                        return `<li><a href="${escapeHtml(location)}" target="_blank" rel="noopener noreferrer">${name}</a> <span>(opens in new tab)</span></li>`;
                    }
                    if (location) return `<li><strong>${name}:</strong> ${escapeHtml(location)}</li>`;
                    return `<li>${name}</li>`;
                }).join('')}
            </ul>
        </section>
    `;
}

function renderBrandingBlock() {
    const branding = getBrandingState();
    if (!branding.enabled) return '';
    const headerHtml = sanitizeBrandingHtml(branding.headerHtml) || (branding.headerText.trim() ? `<p>${escapeHtml(branding.headerText.trim())}</p>` : '');
    const footerHtml = sanitizeBrandingHtml(branding.footerHtml);
    const headerImagesMarkup = renderBrandingImageCollection(branding.headerImages);
    const footerImagesMarkup = renderBrandingImageCollection(branding.footerImages);
    const hasHeader = headerHtml !== '';
    const hasFooter = footerHtml !== '';
    const hasHeaderImages = headerImagesMarkup !== '';
    const hasFooterImages = footerImagesMarkup !== '';
    if (!hasHeaderImages && !hasFooterImages && !hasHeader && !hasFooter) return '';

    const headerStyle = `style="color:${escapeHtml(branding.primaryColor)};"`;
    const headerMarkup = hasHeader ? `<div class="viewer-brand-header" ${headerStyle}>${headerHtml}</div>` : '';
    const footerMarkup = hasFooter ? `<div class="viewer-brand-footer">${footerHtml}</div>` : '';

    return `
        <section class="viewer-branding" aria-label="Report branding" style="--viewer-brand-margin-top:${Number(branding.pageMargins.top)}px; --viewer-brand-margin-right:${Number(branding.pageMargins.right)}px; --viewer-brand-margin-bottom:${Number(branding.pageMargins.bottom)}px; --viewer-brand-margin-left:${Number(branding.pageMargins.left)}px;">
            <div class="viewer-brand-copy">
                ${hasHeaderImages ? `<div class="viewer-brand-images viewer-brand-images--header">${headerImagesMarkup}</div>` : ''}
                ${headerMarkup}
                ${hasFooterImages ? `<div class="viewer-brand-images viewer-brand-images--footer">${footerImagesMarkup}</div>` : ''}
                ${footerMarkup}
                ${branding.showPageNumbers ? '<p class="viewer-brand-page-number" aria-label="Page number preview">Page 1</p>' : ''}
            </div>
        </section>
    `;
}

function renderWcagViewerLink(entry, text) {
    const visibleText = normalizeAccessibilityLinkText(entry.rawValue, text);
    return `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" class="wcag-viewer-link">${escapeHtml(visibleText)}</a>`;
}

function renderAttachmentViewerLinks(entry) {
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (attachments.length === 0) return 'No files attached';

    const items = attachments.map((attachment) => {
        const attachmentKey = registerViewerAttachment(attachment);
        return `
            <li>
                <a href="#" class="viewer-attachment-link" data-attachment-key="${escapeHtml(attachmentKey)}">${escapeHtml(attachment.name)}</a>
                <button type="button" class="btn-preview-attachment" data-attachment-key="${escapeHtml(attachmentKey)}">Preview</button>
            </li>
        `;
    }).join('');

    return `<ul class="viewer-attachment-list">${items}</ul>`;
}

function renderAttachmentExportText(entry) {
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (attachments.length === 0) return 'No files attached';
    return attachments.map((attachment) => `${attachment.name} (${attachment.exportPath})`).join('; ');
}

function renderAttachmentExportMarkdown(entry) {
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (attachments.length === 0) return 'No files attached';
    return attachments.map((attachment) => `[${attachment.name}](${attachment.exportPath})`).join(', ');
}

function renderAttachmentExportHtml(entry) {
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (attachments.length === 0) return 'No files attached';
    return attachments.map((attachment) => `<a href="${escapeHtml(attachment.exportPath)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.name)}</a>`).join(', ');
}

function renderAttachmentExportRtf(entry, escapeRtf) {
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (attachments.length === 0) return 'No files attached';
    return attachments
        .map((attachment) => `{\\field{\\*\\fldinst HYPERLINK "${escapeRtf(attachment.exportPath)}"}{\\fldrslt ${escapeRtf(attachment.name)}}}`)
        .join(', ');
}

function showAttachmentOpenDialog(attachmentKey) {
    const dialog = document.getElementById('viewer-attachment-open-dialog');
    const title = document.getElementById('viewer-attachment-open-title');
    const previewButton = document.getElementById('btn-viewer-attachment-preview');
    const downloadButton = document.getElementById('btn-viewer-attachment-download');
    const closeButton = document.getElementById('btn-viewer-attachment-close');
    if (!dialog || !title || !previewButton || !downloadButton || !closeButton) return;

    const attachment = viewerAttachmentRegistry.get(attachmentKey);
    if (!attachment) return;

    title.textContent = `Open ${attachment.name}`;
    previewButton.setAttribute('data-attachment-key', attachmentKey);
    downloadButton.setAttribute('data-attachment-key', attachmentKey);
    dialog.hidden = false;
    closeButton.focus();
}

function hideAttachmentOpenDialog() {
    const dialog = document.getElementById('viewer-attachment-open-dialog');
    if (dialog) dialog.hidden = true;
}

function showAttachmentPreviewDialog(attachmentKey) {
    const dialog = document.getElementById('viewer-attachment-preview-dialog');
    const title = document.getElementById('viewer-attachment-preview-title');
    const frame = document.getElementById('viewer-attachment-preview-frame');
    const fallback = document.getElementById('viewer-attachment-preview-fallback');
    const closeButton = document.getElementById('btn-viewer-attachment-preview-close');
    if (!dialog || !title || !frame || !fallback || !closeButton) return;

    const attachment = viewerAttachmentRegistry.get(attachmentKey);
    if (!attachment) return;

    const objectUrl = getViewerAttachmentObjectUrl(attachmentKey);
    if (!objectUrl) return;

    title.textContent = `Preview ${attachment.name}`;
    frame.src = objectUrl;
    const previewable = isPreviewableAttachment(attachment);
    frame.hidden = !previewable;
    fallback.hidden = previewable;
    fallback.textContent = previewable
        ? ''
        : 'Preview is not available for this file type. Use Open or Download to launch it in a compatible application on your device.';
    dialog.hidden = false;
    closeButton.focus();
}

function hideAttachmentPreviewDialog() {
    const dialog = document.getElementById('viewer-attachment-preview-dialog');
    const frame = document.getElementById('viewer-attachment-preview-frame');
    if (frame) frame.src = 'about:blank';
    if (dialog) dialog.hidden = true;
}

function openAttachmentInDeviceApp(attachmentKey) {
    const attachment = viewerAttachmentRegistry.get(attachmentKey);
    if (!attachment) return;
    const objectUrl = getViewerAttachmentObjectUrl(attachmentKey);
    if (!objectUrl) return;

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

export function renderViewer() {
    const container = document.getElementById('main-inner');
    if (!container) return;

    cleanupViewerAttachmentUrls();

    const reportHeading = appState.reportTitle?.trim() || 'Untitled Report';

    container.innerHTML = `
        <section id="viewer-view" aria-labelledby="viewer-heading">
            <h2 id="viewer-heading" tabindex="-1">${escapeHtml(reportHeading)}</h2>

            ${renderPresentationDocumentHtml()}

            <div class="viewer-actions" role="group" aria-label="Report viewer actions">
                <button id="btn-open-working-view" type="button">Open Working View</button>
                <button id="btn-export-options" type="button">Export Options...</button>
                ${isProgressLogEnabled() ? '<button id="btn-viewer-progress-log" type="button">Open Progress Log</button>' : ''}
                <button id="btn-change-config" type="button">Change Report Configuration</button>
                <button id="btn-edit-report" type="button">Edit Report</button>
                <button id="btn-viewer-close-report" type="button">Close Report</button>
            </div>

            <div id="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-heading" hidden>
                <h3 id="export-dialog-heading">Export Options</h3>
                <label for="export-file-name">File Name</label>
                <input id="export-file-name" type="text">

                <label for="export-format">Format</label>
                <select id="export-format" aria-label="Export format">
                    <option value="docx">Microsoft Word (.docx)</option>
                    <option value="xlsx">Microsoft Excel (.xlsx)</option>
                    <option value="pdf">PDF</option>
                    <option value="html">HTML</option>
                    <option value="markdown">Markdown</option>
                    <option value="txt">Plain Text</option>
                    <option value="rtf">RTF</option>
                </select>

                <div class="viewer-dialog-actions">
                    <button id="btn-export-save" type="button">Save</button>
                    <button id="btn-export-cancel" type="button">Cancel</button>
                </div>
                <p id="export-status" class="open-report-status" role="status" aria-live="polite" aria-atomic="true"></p>
            </div>

            <div id="viewer-attachment-open-dialog" role="dialog" aria-modal="true" aria-labelledby="viewer-attachment-open-title" hidden>
                <h3 id="viewer-attachment-open-title">Open Attachment</h3>
                <p>If your device does not have a compatible application installed, choose Preview to attempt an in-app preview.</p>
                <div class="viewer-dialog-actions">
                    <button id="btn-viewer-attachment-preview" type="button">Preview</button>
                    <button id="btn-viewer-attachment-download" type="button">Open or Download</button>
                    <button id="btn-viewer-attachment-close" type="button">Close</button>
                </div>
            </div>

            <div id="viewer-attachment-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="viewer-attachment-preview-title" hidden>
                <h3 id="viewer-attachment-preview-title">Attachment Preview</h3>
                <iframe id="viewer-attachment-preview-frame" title="Attachment preview" class="viewer-attachment-preview-frame"></iframe>
                <p id="viewer-attachment-preview-fallback" hidden></p>
                <div class="viewer-dialog-actions">
                    <button id="btn-viewer-attachment-preview-close" type="button">Close</button>
                </div>
            </div>
        </section>
    `;

    const exportButton = document.getElementById('btn-export-options');
    const openWorkingViewButton = document.getElementById('btn-open-working-view');
    const progressLogButton = document.getElementById('btn-viewer-progress-log');
    const changeConfigButton = document.getElementById('btn-change-config');
    const editReportButton = document.getElementById('btn-edit-report');
    const closeReportButton = document.getElementById('btn-viewer-close-report');
    const exportDialog = document.getElementById('export-dialog');
    const exportFileName = document.getElementById('export-file-name');
    const exportFormat = document.getElementById('export-format');
    const exportSave = document.getElementById('btn-export-save');
    const exportCancel = document.getElementById('btn-export-cancel');
    const exportStatus = document.getElementById('export-status');
    const attachmentOpenDialog = document.getElementById('viewer-attachment-open-dialog');
    const attachmentPreviewDialog = document.getElementById('viewer-attachment-preview-dialog');
    const attachmentPreviewButton = document.getElementById('btn-viewer-attachment-preview');
    const attachmentDownloadButton = document.getElementById('btn-viewer-attachment-download');
    const attachmentOpenCloseButton = document.getElementById('btn-viewer-attachment-close');
    const attachmentPreviewCloseButton = document.getElementById('btn-viewer-attachment-preview-close');

    if (
        !exportButton || !openWorkingViewButton || !changeConfigButton || !editReportButton || !closeReportButton || !exportDialog || !exportFileName
        || !exportFormat || !exportSave || !exportCancel || !exportStatus
    ) return;

    openWorkingViewButton.addEventListener('click', async () => {
        const result = await executeViewerAction('openWorkingView');
        if (!result?.ok) {
            announce('Open Working View command is unavailable.');
        }
    });

    let isExportDialogOpen = false;

    const trapExportDialogFocus = (event) => {
        if (!isExportDialogOpen || exportDialog.hidden) return;

        if (event.type === 'focusin') {
            if (!exportDialog.contains(event.target)) {
                const focusables = getFocusableElements(exportDialog);
                if (focusables[0]) focusables[0].focus();
            }
            return;
        }

        if (event.key !== 'Tab' && event.key !== 'Escape') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeExportDialog(true);
            return;
        }

        const focusables = getFocusableElements(exportDialog);
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

    const openExportDialog = () => {
        isExportDialogOpen = true;
        exportDialog.hidden = false;
        exportStatus.textContent = '';
        exportFileName.value = (appState.reportTitle || 'Report').trim() || 'Report';
        window.setTimeout(() => {
            exportFileName.focus();
            exportFileName.select();
        }, 0);
        document.addEventListener('keydown', trapExportDialogFocus);
        document.addEventListener('focusin', trapExportDialogFocus);
    };

    function closeExportDialog(returnFocusToButton) {
        isExportDialogOpen = false;
        exportDialog.hidden = true;
        document.removeEventListener('keydown', trapExportDialogFocus);
        document.removeEventListener('focusin', trapExportDialogFocus);
        if (returnFocusToButton) exportButton.focus();
    }

    const saveExport = async () => {
        const format = exportFormat.value;
        const fileNameInput = exportFileName.value.trim() || (appState.reportTitle || 'Report');
        const safeFileName = String(fileNameInput).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Report';

        try {
            await ensureExportLibraries(format);
            const exportConfig = await getExportConfig(format);
            const zipBlob = await buildZipExportBlob(safeFileName, exportConfig);
            const zipFileName = `${safeFileName}_Export.zip`;

            const objectUrl = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = zipFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
            exportStatus.textContent = `Saved ${zipFileName}.`;
            announce(`Saved ${zipFileName}`);
            setNetworkActivity('Offline', 'Local export completed with no external transfer.');
            recordSecurityAudit('Local export completed', `File: ${zipFileName}`);
            closeExportDialog(true);
        } catch (error) {
            const message = String(error?.message || 'Export failed.');
            exportStatus.textContent = message;
            announce(message);
            setNetworkActivity('Connection Failed', message);
            recordSecurityAudit('Export failed', message);
        }
    };

    exportButton.addEventListener('click', openExportDialog);

    container.querySelectorAll('.viewer-attachment-link').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const attachmentKey = link.getAttribute('data-attachment-key');
            if (!attachmentKey) return;
            showAttachmentOpenDialog(attachmentKey);
        });
    });

    container.querySelectorAll('.btn-preview-attachment').forEach((button) => {
        button.addEventListener('click', () => {
            const attachmentKey = button.getAttribute('data-attachment-key');
            if (!attachmentKey) return;
            showAttachmentPreviewDialog(attachmentKey);
        });
    });

    attachmentOpenCloseButton?.addEventListener('click', () => {
        hideAttachmentOpenDialog();
    });

    attachmentPreviewButton?.addEventListener('click', () => {
        const attachmentKey = attachmentPreviewButton.getAttribute('data-attachment-key');
        if (!attachmentKey) return;
        hideAttachmentOpenDialog();
        showAttachmentPreviewDialog(attachmentKey);
    });

    attachmentDownloadButton?.addEventListener('click', () => {
        const attachmentKey = attachmentDownloadButton.getAttribute('data-attachment-key');
        if (!attachmentKey) return;
        openAttachmentInDeviceApp(attachmentKey);
        hideAttachmentOpenDialog();
    });

    attachmentPreviewCloseButton?.addEventListener('click', () => {
        hideAttachmentPreviewDialog();
    });

    container.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (attachmentPreviewDialog && !attachmentPreviewDialog.hidden) {
            event.preventDefault();
            hideAttachmentPreviewDialog();
            return;
        }
        if (attachmentOpenDialog && !attachmentOpenDialog.hidden) {
            event.preventDefault();
            hideAttachmentOpenDialog();
        }
    });

    progressLogButton?.addEventListener('click', () => {
        openProgressLogDialog(progressLogButton);
    });

    exportCancel.addEventListener('click', () => {
        closeExportDialog(true);
    });

    exportSave.addEventListener('click', saveExport);

    changeConfigButton.addEventListener('click', () => {
        const builderTab = document.getElementById('tab-builder');
        if (!builderTab) return;
        builderTab.click();
        window.setTimeout(() => {
            const builderHeading = document.getElementById('builder-heading');
            if (builderHeading) builderHeading.focus();
        }, 0);
    });

    editReportButton.addEventListener('click', () => {
        appState.editorReadOnly = false;
        appState.editorUsesReportTitle = true;
        saveState();
        const editorTab = document.getElementById('tab-editor');
        if (!editorTab) return;
        editorTab.click();
        window.setTimeout(() => {
            const editorHeading = document.getElementById('editor-heading');
            if (editorHeading) editorHeading.focus();
        }, 0);
    });

    closeReportButton.addEventListener('click', () => {
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

    if (openExportDialogOnRender) {
        openExportDialogOnRender = false;
        openExportDialog();
    }

    if (openPrintPreviewOnRender) {
        openPrintPreviewOnRender = false;
        window.setTimeout(() => window.print(), 0);
    }

    window.dispatchEvent(new CustomEvent('art-viewer-rendered', {
        detail: {
            reportTitle: String(appState.reportTitle || ''),
            reportType: String(appState.reportType || '')
        }
    }));
}