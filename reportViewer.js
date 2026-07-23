import { appState, announce, getCurrentReportMetrics, getProgressItems, isProgressLogAppendixEnabled, isProgressLogEnabled, recordSecurityAudit, saveState, serializeArtJsonPayload, serializeArtProjectPayload, setNetworkActivity, upsertCurrentReport } from './state.js';
import { formatWcagCriterionDisplay, getWcagCriterionByIdentifier, isWcagCriterionFieldType } from './wcagCatalog.js';
import { openProgressLogDialog } from './progressLog.js';

let openExportDialogOnRender = false;
let openPrintPreviewOnRender = false;

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

function getAccessibilityLinkAriaLabel(rawValue, fallbackText = '') {
    const visibleText = normalizeAccessibilityLinkText(rawValue, fallbackText);
    if (!visibleText) {
        return 'Open official W3C Understanding documentation in a new browser tab';
    }
    return `Open official W3C Understanding documentation for ${visibleText} in a new browser tab`;
}

function getBrandingState() {
    return {
        enabled: Boolean(appState.branding?.enabled),
        headerText: String(appState.branding?.headerText || ''),
        primaryColor: String(appState.branding?.primaryColor || '#005a9c'),
        logoDataUrl: String(appState.branding?.logoDataUrl || ''),
        logoAltText: String(appState.branding?.logoAltText || ''),
        logoDecorative: Boolean(appState.branding?.logoDecorative)
    };
}

function getBrandingTextLines() {
    const branding = getBrandingState();
    if (!branding.enabled) return [];

    const lines = [];
    if (branding.headerText.trim()) lines.push(`Brand Header: ${branding.headerText.trim()}`);
    if (branding.logoDataUrl) {
        lines.push(`Logo: ${branding.logoDecorative ? 'Decorative' : (branding.logoAltText.trim() || 'Brand logo')}`);
    }
    if (branding.primaryColor.trim()) lines.push(`Brand Color: ${branding.primaryColor.trim()}`);
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
    return getResolvedFieldEntries(false).map((entry) => [entry.label, entry.exportText]);
}

function getAuditEntriesList() {
    if (Array.isArray(appState.auditEntries) && appState.auditEntries.length > 0) {
        return appState.auditEntries;
    }
    return [{ id: 'entry-1', fieldValues: appState.editorFieldValues || {} }];
}

function getResolvedFieldEntriesForValues(fieldValues, hideEmpty = true) {
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

        return {
            index,
            field,
            label,
            type,
            rawValue,
            displayText: String(rawValue || ''),
            exportText: String(rawValue || ''),
            url: '',
            isEmpty: String(rawValue || '').trim() === ''
        };
    }).filter((entry) => !hideEmpty || !entry.isEmpty);
}

function getAuditEntryGroups(hideEmpty = true) {
    return getAuditEntriesList().map((auditEntry, entryIndex) => ({
        entryIndex,
        title: String(auditEntry?.fieldValues?.[0] || '').trim() || `Entry ${entryIndex + 1}`,
        entries: getResolvedFieldEntriesForValues(auditEntry?.fieldValues || {}, hideEmpty)
    }));
}

function getResolvedFieldEntries(hideEmpty = true) {
    return getResolvedFieldEntriesForValues(appState.editorFieldValues || {}, hideEmpty);
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

function buildTextSummary() {
    const metadataRows = getMetadataRows();
    const brandingText = getBrandingTextLines().join('\n');

    const brandingSection = brandingText ? `${brandingText}\n\n` : '';
    const metadataText = metadataRows.map(([label, value]) => `${label}: ${value}`).join('\n');
    const fieldsText = appState.reportType === 'Audit Log'
        ? getAuditEntryGroups(false).map((group) => {
            const content = group.entries.map((entry) => {
                if (entry.url) return `${entry.label}: ${entry.displayText} (${entry.url})`;
                return `${entry.label}: ${entry.exportText}`;
            }).join('\n');
            return `${group.title}\n${content}`;
        }).join('\n\n')
        : getResolvedFieldEntries(false).map((entry) => {
            if (entry.url) {
                return `${entry.label}: ${entry.displayText} (${entry.url})`;
            }
            return `${entry.label}: ${entry.exportText}`;
        }).join('\n');

    const appendix = buildProgressAppendixText();
    return `${brandingSection}${metadataText}\n\nFields\n${fieldsText}${appendix ? `\n\n${appendix}` : ''}`.trim();
}

function buildMarkdownSummary() {
    const metadataRows = getMetadataRows();
    const brandingLines = getBrandingTextLines();

    const brandingMd = brandingLines.length > 0
        ? `## Branding\n${brandingLines.map((line) => `- ${line}`).join('\n')}\n\n`
        : '';
    const metadataMd = metadataRows.map(([label, value]) => `- **${label}:** ${String(value)}`).join('\n');
    const fieldsMd = appState.reportType === 'Audit Log'
        ? getAuditEntryGroups(false).map((group) => `### ${group.title}\n${group.entries.map((entry) => {
            if (entry.url) return `- **${entry.label}:** [${entry.displayText}](${entry.url})`;
            return `- **${entry.label}:** ${entry.exportText}`;
        }).join('\n')}`).join('\n\n')
        : getResolvedFieldEntries(false).map((entry) => {
            if (entry.url) {
                return `- **${entry.label}:** [${entry.displayText}](${entry.url})`;
            }
            return `- **${entry.label}:** ${entry.exportText}`;
        }).join('\n');

    const appendix = buildProgressAppendixMarkdown();
    return `# ${appState.reportTitle || 'Report'}\n\n${brandingMd}## Metadata\n${metadataMd}\n\n## Fields\n${fieldsMd}${appendix ? `\n\n${appendix}` : ''}`;
}

function buildHtmlSummary() {
    const metadataRows = getMetadataRows();
        const branding = getBrandingState();
        const brandingLines = getBrandingTextLines();

    const metadataItems = metadataRows
        .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
        .join('');
    const fieldItems = appState.reportType === 'Audit Log'
        ? getAuditEntryGroups(false).map((group) => `<li><strong>${escapeHtml(group.title)}</strong><ul>${group.entries.map((entry) => {
            if (entry.url) {
                return `<li><strong>${escapeHtml(entry.label)}:</strong> <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(getAccessibilityLinkAriaLabel(entry.rawValue, entry.displayText))}">${escapeHtml(normalizeAccessibilityLinkText(entry.rawValue, entry.displayText))}</a></li>`;
            }
            return `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.exportText)}</li>`;
        }).join('')}</ul></li>`).join('')
        : getResolvedFieldEntries(false)
            .map((entry) => {
                if (entry.url) {
                    return `<li><strong>${escapeHtml(entry.label)}:</strong> <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(getAccessibilityLinkAriaLabel(entry.rawValue, entry.displayText))}">${escapeHtml(normalizeAccessibilityLinkText(entry.rawValue, entry.displayText))}</a></li>`;
                }
                return `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.exportText)}</li>`;
            })
            .join('');
        const brandingBlock = branding.enabled ? `
    <section aria-label="Branding">
        <h2>Branding</h2>
        ${branding.logoDataUrl ? `<img src="${escapeHtml(branding.logoDataUrl)}" ${branding.logoDecorative ? 'alt=""' : `alt="${escapeHtml(branding.logoAltText || 'Brand logo')}"`} style="max-height:80px; width:auto;"/>` : ''}
        ${brandingLines.length > 0 ? `<ul>${brandingLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
    </section>` : '';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(appState.reportTitle || 'Report')}</title>
</head>
<body>
  <h1>${escapeHtml(appState.reportTitle || 'Report')}</h1>
    ${brandingBlock}
  <h2>Metadata</h2>
  <ul>${metadataItems}</ul>
    <h2>Fields</h2>
    <ul>${fieldItems}</ul>
    ${renderProgressAppendixHtmlSection()}
</body>
</html>`;
}

function buildRtfSummary() {
    const escapeRtf = (value) => String(value)
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/\r\n|\r|\n/g, '\\line ');

    const title = escapeRtf(appState.reportTitle || 'Report');
    const branding = getBrandingTextLines().map((line) => escapeRtf(line)).join('\\line ');
    const brandingBlock = branding ? `Branding\\line ${branding}\\line\\line ` : '';
    const metadata = getMetadataRows().map(([label, value]) => `${escapeRtf(label)}: ${escapeRtf(value)}`).join('\\line ');
    const fields = appState.reportType === 'Audit Log'
        ? getAuditEntryGroups(false).map((group) => {
            const fieldText = group.entries.map((entry) => {
                if (entry.url) {
                    return `${escapeRtf(entry.label)}: {\\field{\\*\\fldinst HYPERLINK "${escapeRtf(entry.url)}"}{\\fldrslt ${escapeRtf(entry.displayText)}}}`;
                }
                return `${escapeRtf(entry.label)}: ${escapeRtf(entry.exportText)}`;
            }).join('\\line ');
            return `${escapeRtf(group.title)}\\line ${fieldText}`;
        }).join('\\line \\line ')
        : getResolvedFieldEntries(false).map((entry) => {
            if (entry.url) {
                return `${escapeRtf(entry.label)}: {\\field{\\*\\fldinst HYPERLINK "${escapeRtf(entry.url)}"}{\\fldrslt ${escapeRtf(entry.displayText)}}}`;
            }
            return `${escapeRtf(entry.label)}: ${escapeRtf(entry.exportText)}`;
        }).join('\\line ');

    const appendix = buildProgressAppendixText();
    const appendixBlock = appendix ? `\\line\\line ${escapeRtf(appendix)}` : '';
    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22\\b ${title}\\b0\\line\\line ${brandingBlock}Metadata\\line ${metadata}\\line\\line Fields\\line ${fields}${appendixBlock}}`;
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
            const resolvedEntries = getResolvedFieldEntriesForValues(auditEntry?.fieldValues || {}, false);
            const entryName = String(auditEntry?.fieldValues?.[0] || '').trim() || `Entry ${entryIndex + 1}`;
            const row = [
                entryName,
                ...resolvedEntries.map((entry) => toXlsxCellValue(entry))
            ];
            auditRows.push(row);

            resolvedEntries.forEach((entry) => {
                overviewRows.push(['Accessibility Audit', entryName, entry.label, entry.exportText, entry.url || '']);
            });
        });
    } else {
        const resolvedEntries = getResolvedFieldEntries(false);
        const row = ['Primary', ...resolvedEntries.map((entry) => toXlsxCellValue(entry))];
        auditRows.push(row);
        resolvedEntries.forEach((entry) => {
            overviewRows.push(['Accessibility Audit', 'Primary', entry.label, entry.exportText, entry.url || '']);
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

    const metadataRows = getMetadataRows();
    const brandingLines = getBrandingTextLines();
    const metadataTableRows = metadataRows.map(([label, value]) => `
        <w:tr>
            <w:tc>
                <w:tcPr><w:tcW w:w="4200" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="7800" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    `).join('');

    const metadataTable = metadataRows.length > 0
        ? `
        <w:tbl>
            <w:tblPr>
                <w:tblW w:w="0" w:type="auto"/>
                <w:tblBorders>
                    <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                </w:tblBorders>
            </w:tblPr>
            <w:tblGrid>
                <w:gridCol w:w="4200"/>
                <w:gridCol w:w="7800"/>
            </w:tblGrid>
            ${metadataTableRows}
        </w:tbl>
    `
        : makeParagraph('No metadata is currently set for this report.', 'Normal');

    const paragraphs = [];
    paragraphs.push(makeParagraph(appState.reportTitle || 'Report', 'Title'));
    paragraphs.push(makeParagraph('', 'Normal'));
    if (brandingLines.length > 0) {
        paragraphs.push(makeParagraph('Branding', 'Heading1'));
        brandingLines.forEach((line) => paragraphs.push(makeParagraph(line, 'Normal')));
        paragraphs.push(makeParagraph('', 'Normal'));
    }
    paragraphs.push(makeParagraph('Metadata', 'Heading1'));
    paragraphs.push(metadataTable);
    paragraphs.push(makeParagraph('', 'Normal'));
    paragraphs.push(makeParagraph('Fields', 'Heading1'));
    if (appState.reportType === 'Audit Log') {
        getAuditEntryGroups(false).forEach((group) => {
            paragraphs.push(makeParagraph(group.title, 'Heading2'));
            group.entries.forEach((entry) => {
                if (entry.url) {
                    paragraphs.push(makeHyperlinkParagraph(entry.label, entry.displayText, entry.url, 'Normal'));
                } else {
                    paragraphs.push(makeParagraph(`${entry.label}: ${entry.exportText || 'No value entered'}`, 'Normal'));
                }
            });
        });
    } else {
        getResolvedFieldEntries(false).forEach((entry) => {
            if (entry.url) {
                paragraphs.push(makeHyperlinkParagraph(entry.label, entry.displayText, entry.url, 'Normal'));
            } else {
                paragraphs.push(makeParagraph(entry.label, 'Heading2'));
                paragraphs.push(makeParagraph(entry.exportText || 'No value entered', 'Normal'));
            }
        });
    }

    const progressItems = getProgressAppendixItems();
    if (progressItems.length > 0) {
        paragraphs.push(makeParagraph('', 'Normal'));
        paragraphs.push(makeParagraph('Progress Log Appendix', 'Heading1'));
        if (String(appState.testingInstructions || '').trim()) {
            paragraphs.push(makeParagraph(`Testing Instructions: ${appState.testingInstructions}`, 'Normal'));
        }
        progressItems.forEach((item) => {
            const name = String(item.name || 'Untitled Evaluation Item').trim() || 'Untitled Evaluation Item';
            const location = String(item.location || '').trim();
            paragraphs.push(makeParagraph(location ? `${name}: ${location}` : name, 'Normal'));
        });
    }

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

                return `
                    <article class="viewer-field-card">
                        <h4>${escapeHtml(entry.label)}</h4>
                        <p><strong>Type:</strong> ${escapeHtml(entry.type)}</p>
                        <p><strong>Value:</strong> ${entry.url ? renderWcagViewerLink(entry, displayValue) : escapeHtml(displayValue)}</p>
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
        rawValue: entry.rawValue
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
                    ${group.entries.map((entry) => `<p><strong>${escapeHtml(entry.label)}:</strong> ${entry.url ? renderWcagViewerLink(entry, entry.displayText) : escapeHtml(entry.displayText)}</p>`).join('')}
                </article>
            `).join('')}
        </section>
    `;
}

function renderExecutiveParagraphLayout() {
    const entries = getVisibleFieldEntries();
    if (entries.length === 0) return '<p>No populated fields are available for this report.</p>';

    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">Executive Summary Content</h3>
            ${entries.map((entry) => `
                <section class="viewer-paragraph-item" aria-labelledby="field-heading-${entry.index}">
                    <h4 id="field-heading-${entry.index}">${escapeHtml(entry.label)}</h4>
                    <p>${entry.url ? renderWcagViewerLink(entry, entry.value) : escapeHtml(entry.value)}</p>
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
                        ${groups.map((group) => `<tr>${(group.entries.length > 0 ? group.entries : getResolvedFieldEntriesForValues({}, false)).map((entry, index) => `<td headers="field-col-${index}">${entry.url ? renderWcagViewerLink(entry, entry.displayText) : escapeHtml(entry.displayText || '')}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderExecutiveBulletsLayout() {
    const entries = getVisibleFieldEntries();
    if (entries.length === 0) return '<p>No populated fields are available for this report.</p>';

    return `
        <section aria-labelledby="viewer-content-heading">
            <h3 id="viewer-content-heading">Executive Summary Highlights</h3>
            <ul class="viewer-bullet-list">
                ${entries.map((entry) => {
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
    if (type === 'Executive Summary' && layout === 'Bullets') {
        return renderExecutiveBulletsLayout();
    }
    if (type === 'Executive Summary' && layout === 'Paragraphs') {
        return renderExecutiveParagraphLayout();
    }

    return renderAuditParagraphLayout();
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
    const hasLogo = Boolean(branding.logoDataUrl);
    const hasHeader = branding.headerText.trim() !== '';
    if (!hasLogo && !hasHeader) return '';

    const logoMarkup = hasLogo
        ? `<img class="viewer-brand-logo" src="${escapeHtml(branding.logoDataUrl)}" ${branding.logoDecorative ? 'alt=""' : `alt="${escapeHtml(branding.logoAltText || 'Brand logo')}"`} />`
        : '';

    const headerStyle = `style="color:${escapeHtml(branding.primaryColor)};"`;
    const headerMarkup = hasHeader ? `<p class="viewer-brand-header" ${headerStyle}>${escapeHtml(branding.headerText)}</p>` : '';

    return `
        <section class="viewer-branding" aria-label="Report branding">
            ${logoMarkup}
            ${headerMarkup}
        </section>
    `;
}

function renderWcagViewerLink(entry, text) {
    const visibleText = normalizeAccessibilityLinkText(entry.rawValue, text);
    const ariaLabel = getAccessibilityLinkAriaLabel(entry.rawValue, text);
    return `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" class="wcag-viewer-link" aria-label="${escapeHtml(ariaLabel)}" data-wcag-index="${entry.index}" data-wcag-identifier="${escapeHtml(entry.rawValue?.identifier || '')}" data-wcag-url="${escapeHtml(entry.url)}">${escapeHtml(visibleText)}</a>`;
}

function getFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

export function renderViewer() {
    const container = document.getElementById('main-inner');
    if (!container) return;

    const reportHeading = appState.reportTitle?.trim() || 'Untitled Report';

    container.innerHTML = `
        <section id="viewer-view" aria-labelledby="viewer-heading">
            <h2 id="viewer-heading" tabindex="-1">${escapeHtml(reportHeading)}</h2>

            <section aria-labelledby="viewer-metadata-heading">
                <h3 id="viewer-metadata-heading">Report Metadata</h3>
                ${renderMetadata()}
            </section>

            ${renderBrandingBlock()}

            ${renderReportBody()}

            ${renderProgressAppendixViewer()}

            <div class="viewer-actions" role="group" aria-label="Report viewer actions">
                <button id="btn-export-options" type="button">Export Options...</button>
                ${isProgressLogEnabled() ? '<button id="btn-viewer-progress-log" type="button">Open Progress Log</button>' : ''}
                <button id="btn-change-config" type="button">Change Report Configuration</button>
                <button id="btn-edit-report" type="button">Edit Report</button>
                <button id="btn-viewer-close-report" type="button">Close Report</button>
            </div>

            <div id="wcag-doc-dialog" role="dialog" aria-modal="true" aria-labelledby="wcag-doc-heading" aria-describedby="wcag-doc-description" hidden>
                <button id="btn-close-wcag-doc" type="button">Close</button>
                <h3 id="wcag-doc-heading">WCAG Documentation</h3>
                <p id="wcag-doc-description">Official W3C Understanding documentation for the selected WCAG Success Criterion.</p>
                <iframe id="wcag-doc-frame" title="Official WCAG Understanding documentation"></iframe>
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
        </section>
    `;

    const exportButton = document.getElementById('btn-export-options');
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
    const wcagDocDialog = document.getElementById('wcag-doc-dialog');
    const wcagDocFrame = document.getElementById('wcag-doc-frame');
    const wcagDocClose = document.getElementById('btn-close-wcag-doc');

    if (
        !exportButton || !changeConfigButton || !editReportButton || !closeReportButton || !exportDialog || !exportFileName
        || !exportFormat || !exportSave || !exportCancel || !exportStatus || !wcagDocDialog || !wcagDocFrame || !wcagDocClose
    ) return;

    let isExportDialogOpen = false;
    let activeWcagLink = null;
    let wcagDialogTimer = null;

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

    const trapDialogFocus = (dialog, event, closeHandler) => {
        if (dialog.hidden) return;

        if (event.type === 'focusin') {
            if (!dialog.contains(event.target)) {
                const focusables = getFocusableElements(dialog);
                if (focusables[0]) focusables[0].focus();
            }
            return;
        }

        if (event.key !== 'Tab' && event.key !== 'Escape') return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeHandler();
            return;
        }

        const focusables = getFocusableElements(dialog);
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

    const wcagDialogFocusHandler = (event) => trapDialogFocus(wcagDocDialog, event, () => closeWcagDialog(true));

    function closeWcagDialog(restoreFocus) {
        wcagDocDialog.hidden = true;
        wcagDocFrame.removeAttribute('src');
        document.removeEventListener('keydown', wcagDialogFocusHandler);
        document.removeEventListener('focusin', wcagDialogFocusHandler);
        if (wcagDialogTimer) {
            window.clearTimeout(wcagDialogTimer);
            wcagDialogTimer = null;
        }
        if (restoreFocus && activeWcagLink) {
            activeWcagLink.focus();
        }
    }

    const openWcagDialog = async (triggerLink) => {
        activeWcagLink = triggerLink;
        const identifier = triggerLink.getAttribute('data-wcag-identifier');
        const fallbackUrl = triggerLink.getAttribute('data-wcag-url') || '';
        const criterion = identifier ? await getWcagCriterionByIdentifier(identifier) : null;
        const targetUrl = criterion?.understandingUrl || fallbackUrl;
        if (!targetUrl) return;

        let loaded = false;
        wcagDocDialog.hidden = false;
        wcagDocFrame.onload = () => {
            loaded = true;
            if (wcagDialogTimer) {
                window.clearTimeout(wcagDialogTimer);
                wcagDialogTimer = null;
            }
        };
        wcagDocFrame.src = targetUrl;
        document.addEventListener('keydown', wcagDialogFocusHandler);
        document.addEventListener('focusin', wcagDialogFocusHandler);
        wcagDocClose.focus();

        wcagDialogTimer = window.setTimeout(() => {
            if (loaded) return;
            window.open(targetUrl, '_blank', 'noopener');
            closeWcagDialog(true);
        }, 1500);
    };

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

    progressLogButton?.addEventListener('click', () => {
        openProgressLogDialog(progressLogButton);
    });

    exportCancel.addEventListener('click', () => {
        closeExportDialog(true);
    });

    exportSave.addEventListener('click', saveExport);

    wcagDocClose.addEventListener('click', () => closeWcagDialog(true));

    container.querySelectorAll('.wcag-viewer-link').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
            }
            event.preventDefault();
            openWcagDialog(link);
        });
    });

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
}