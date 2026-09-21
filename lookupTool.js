// lookupTool.js
import { commandExecutionService } from './commandExecutionService.js';
import { commandRegistry } from './commandRegistry.js';
import { appState, getShortcutForAction } from './state.js';
import { getAvailableWcagStandards, getSection508LookupCriteria, loadWcagCatalog } from './wcagCatalog.js';
import { getSection508Wcag20Criteria } from './section508TemplateCatalog.js';

let runLookupResetWorkflow = null;

async function executeLookupAction(action, context = {}) {
    const command = commandRegistry.findCommands({ action })[0] || null;
    if (!command?.id) return null;
    return commandExecutionService.executeCommand(command.id, {
        source: 'lookup-tool',
        action,
        ...context
    });
}

export function resetLookupFromCommand() {
    if (typeof runLookupResetWorkflow !== 'function') return false;
    return runLookupResetWorkflow();
}

export async function executeLookupCopyActionFromCommand(action) {
    const button = document.querySelector(`[data-copy-action="${action}"]`);
    if (!(button instanceof HTMLElement)) return false;

    const text = String(button.getAttribute('data-text') || '');
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied!';
    window.setTimeout(() => {
        button.textContent = original;
    }, 2000);
    return true;
}

export async function initLookupTool() {
    const container = document.getElementById('container');
    const lookupRegion = document.getElementById('lookup-tool');
    const notifyLookupPanel = () => {
        window.dispatchEvent(new CustomEvent('art-panel-changed', {
            detail: { panel: 'Accessibility Lookup Tool' }
        }));
    };
    if (!container) return;
    container.innerHTML = 'Loading criteria...';

    // UI Styles
    const style = document.createElement('style');
    style.innerHTML = `details ul { list-style-type: none; padding-left: 0; margin: 0; } details ul li { margin-bottom: 5px; } details p { margin: 0 0 10px 0; } details dt { font-weight: bold; margin-top: 10px; }`;
    document.head.appendChild(style);

    const announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.style.cssText = "position:absolute; left:-9999px;";
    document.body.appendChild(announcer);

    const syncLookupLiveAnnouncements = () => {
        const isLookupInteraction = Boolean(lookupRegion && lookupRegion.contains(document.activeElement));
        const liveMode = isLookupInteraction ? 'polite' : 'off';
        announcer.setAttribute('aria-live', liveMode);
        const countEl = document.getElementById('count');
        if (countEl) countEl.setAttribute('aria-live', liveMode);
    };

    const enableLookupAnnouncements = () => {
        announcer.setAttribute('aria-live', 'polite');
        const countEl = document.getElementById('count');
        if (countEl) countEl.setAttribute('aria-live', 'polite');
    };

    let resultsAnnouncementTimer = null;

    const categoryMap = {
        "ARIA & Live Regions": "ARIA|Live|Region|Role|State",
        "Audio & Video": "Multimedia|Audio|Video|Captions|Transcripts|Media",
        "Buttons & Navigation": "Navigation|Link|Skip|Bypass|Button|Menu|Interaction",
        "Color & Contrast": "Color|Contrast|Luminance|Foreground|Background",
        "Focus & Keyboard": "Keyboard|Focus|Tabindex|Modal|Operable",
        "Forms & Inputs": "Forms|Input|Autocomplete|Authentication|Labels",
        "Images & Graphics": "Images|Graphic|Icons|Charts|Alt Text",
        "Interactions": "Interactions|Pointer|Dragging|Input Modalities|Gestures",
        "Language & Text": "Text|Language|Jargon|Acronym|Pronunciation|Readability",
        "Layout & Structure": "Layout|Structure|Semantics|Reading Order|Reflow|CSS|Grouping",
        "Mobile & Touch": "Mobile|Orientation|Tap Targets|Touch|Sensors",
        "Motion & Animation": "Animation|Reduced Motion|Seizure|Flash|Blinking",
        "Notifications & Errors": "Error|Notifications|Alert|Status|Validation",
        "Time & Timeouts": "Timeouts|Refresh|Expiration|Interruptions",
        "Tooltips & Overlays": "Tooltips|Overlays|Popups|Dialog|Hover|Focus"
    };

    const formatAsList = (val) => {
        const text = (val || '').toString();
        return text ? `<ul>${text.split('|').map(i => `<li>${i.trim()}</li>`).join('')}</ul>` : '<ul><li>N/A</li></ul>';
    };
    const formatAsCommaList = (val) => (val || '').toString().replace(/\|/g, ', ') || 'N/A';
    const formatParagraphs = (val) => (val || '').toString().split('|').map(p => `<p>${p.trim()}</p>`).join('');
    const cleanForCopy = (val) => (val || '').toString().replace(/\|/g, '\n');

    const resetTool = () => {
        notifyLookupPanel();
        document.getElementById('s').value = '';
        document.getElementById('ver-f').value = '';
        document.getElementById('lvl-f').value = '';
        document.getElementById('cat-f').value = '';
        document.getElementById('s').dispatchEvent(new Event('input'));
    };

    runLookupResetWorkflow = () => {
        resetTool();
        return true;
    };

    try {
        let data = await loadWcagCatalog();
        const section508LookupCriteria = await getSection508LookupCriteria().catch(() => []);
        const bundledWcag20 = await getSection508Wcag20Criteria().catch(() => data.filter((item) => item.standard === 'WCAG 2.0'));
        const section508Wcag20Criteria = bundledWcag20
            .map((item) => ({ ...item, standard: 'Section 508', section508Type: 'WCAG 2.0 Criteria', categories: '', requirement: item.desc, testProcedure: item.desc, understandingUrl: item.understandingUrl }));
        data = [...data, ...section508LookupCriteria, ...section508Wcag20Criteria];
        const standards = await getAvailableWcagStandards();

        const resetLookupShortcut = getShortcutForAction('resetLookup') || 'Alt+Shift+D';

        container.innerHTML = `
            <fieldset style="margin:0; padding:0; border:0;">
                <legend>Search and filter criteria</legend>
                <label for="s">Search For Accessibility Standard</label>
                <input id="s" type="text" aria-label="Search and filter criteria" placeholder="Search... e.g. 1.1.1, buttons, tables" style="width:90%; padding:10px;" autocomplete="off">
                <div style="margin:15px 0; display:grid; gap:10px;">
                    <label for="ver-f">Standard</label>
                    <select id="ver-f"><option value="">Version: All</option>${standards.map((standard) => `<option value="${standard}">${standard}</option>`).join('')}</select>
                    <label for="lvl-f">Level</label>
                    <select id="lvl-f"><option value="">Level: All</option><option value="A">A</option><option value="AA">AA</option><option value="AAA">AAA</option></select>
                    <label for="cat-f">Category</label>
                    <select id="cat-f"><option value="">Category: All</option>${Object.keys(categoryMap).sort().map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select>
                    <button id="reset-btn">Reset (${resetLookupShortcut})</button>
                </div>
            </fieldset>
            <h2 id="count" aria-live="polite">Found 0 results</h2>
            <div id="list-container"></div>
            <footer style="margin-top:40px; border-top:1px solid #ccc; padding-top:10px;">
                <details>
                    <summary style="font-weight:bold; cursor:pointer;">How to use the Accessibility Lookup Tool</summary>
                    <fieldset style="border:none; padding:0; margin:0;">
                        <dl><dt>Instructions:</dt><dd>Use the search box to find specific criteria. Filters for standard, level, and category will narrow down results.</dd>
                        <dt>Keyboard Shortcut:</dt><dd><strong>Reset Tool:</strong> ${resetLookupShortcut}</dd></dl>
                        <p><a href="https://github.com/ripplelearning/wcag-database" target="_blank" rel="noopener noreferrer">View Source on GitHub</a></p>
                    </fieldset>
                </details>
            </footer>
        `;

        const render = (list, options = {}) => {
            const deferAnnouncement = options.deferAnnouncement === true;
            const listContainer = document.getElementById('list-container');
            const countEl = document.getElementById('count');
            listContainer.innerHTML = '';
            const presentStandards = [...new Set(list.map((item) => item.standard))];
            presentStandards.forEach((standardName) => {
                const isSection508 = String(standardName).toLowerCase().includes('section 508');
                const section508Groups = ['Functional Performance Criteria', 'WCAG 2.0 Criteria', 'Technical Requirements', 'Support Requirements', 'Software Requirements', 'Hardware Requirements'];
                const filteredStandard = list.filter((item) => item.standard === standardName).sort((left, right) => {
                    if (!isSection508) return String(left.categories || left.category || '').localeCompare(String(right.categories || right.category || '')) || String(left.number || '').localeCompare(String(right.number || ''));
                    const leftGroup = section508Groups.indexOf(left.section508Type || (String(left.number || '').startsWith('302.') ? 'Functional Performance Criteria' : 'Technical Requirements'));
                    const rightGroup = section508Groups.indexOf(right.section508Type || (String(right.number || '').startsWith('302.') ? 'Functional Performance Criteria' : 'Technical Requirements'));
                    return leftGroup - rightGroup || String(left.number || '').localeCompare(String(right.number || ''));
                });
                if (filteredStandard.length === 0) return;
                const h3 = document.createElement('h3');
                h3.textContent = `${standardName} Success Criteria`;
                listContainer.appendChild(h3);

                let currentGroup = '';
                filteredStandard.forEach((item) => {
                    const groupName = isSection508 ? (item.section508Type || (String(item.number || '').startsWith('302.') ? 'Functional Performance Criteria' : 'Technical Requirements')) : (item.categories || item.category || '');
                    if (groupName && groupName !== currentGroup) {
                        currentGroup = groupName;
                        const groupHeading = document.createElement('h4');
                        groupHeading.textContent = groupName;
                        listContainer.appendChild(groupHeading);
                    }
                    const displayName = `${item.number} ${item.title}`;
                    const div = document.createElement('div');
                    const relatedWcag = Array.isArray(item.relatedWcag) ? item.relatedWcag.join(', ') : '';
                    const detailMarkup = [`<dt>Requirement:</dt><dd>${formatParagraphs(item.requirement || item.desc)}</dd>`, `<dt>Scope:</dt><dd>${formatParagraphs(item.scope || 'Section 508 scope is determined by the applicable ICT type and evaluation boundary.')}</dd>`, `<dt>Applicability:</dt><dd>${formatParagraphs(item.productType || item.applicability || 'Covered ICT subject to applicable Section 508 scope and exceptions.')}</dd>`, `<dt>Testing Requirements:</dt><dd>${formatParagraphs(item.testingRequirements || item.testProcedure || item.desc)}</dd>`, `<dt>How to test:</dt><dd>${formatParagraphs(item.testProcedure || item.testingGuidance || item.desc)}</dd>`, `<dt>Expected Result:</dt><dd>${formatParagraphs(item.expectedResult || item.resultGuidance)}</dd>`, `<dt>Failures:</dt><dd>${formatAsList(item.failures)}</dd>`, `<dt>Result guidance:</dt><dd>${formatParagraphs(item.resultGuidance || 'Record the applicable Section 508 result and rationale.')}</dd>`, `<dt>How to document results:</dt><dd>${formatParagraphs(item.documentationGuidance || item.fixes)}</dd>`, relatedWcag ? `<dt>Related WCAG Success Criteria:</dt><dd>${escapeHtml(relatedWcag)}</dd>` : '', `<dt>Disabilities:</dt><dd>${formatAsCommaList(item.disabilitie)}</dd>`, `<dt>Official documentation:</dt><dd><a href="${item.understandingUrl || '#'}" target="_blank" rel="noopener noreferrer">Open official documentation</a></dd>`].join('');
                    const levelLabel = isSection508 && groupName !== 'WCAG 2.0 Criteria' ? '' : ` (Level ${item.level})`;
                    div.innerHTML = `<details style="margin-bottom:10px; border:1px solid #eee;"><summary style="font-weight:bold; cursor:pointer; padding:10px;">${displayName}${levelLabel}</summary><fieldset style="border:none; padding:10px; margin:0;"><dl>${detailMarkup}</dl></fieldset></details>`;
                    listContainer.appendChild(div);
                });
            });
            const msg = `Found ${list.length} results`;
            if (resultsAnnouncementTimer) {
                window.clearTimeout(resultsAnnouncementTimer);
                resultsAnnouncementTimer = null;
            }

            if (countEl && deferAnnouncement) {
                countEl.setAttribute('aria-live', 'off');
            }
            if (countEl) {
                countEl.textContent = msg;
            }

            if (deferAnnouncement) {
                announcer.textContent = '';
                resultsAnnouncementTimer = window.setTimeout(() => {
                    resultsAnnouncementTimer = null;
                    syncLookupLiveAnnouncements();
                    announcer.textContent = msg;
                }, 160);
                return;
            }

            announcer.textContent = msg;
        };

        const applyFilters = (options = {}) => {
            const q = document.getElementById('s').value.toLowerCase();
            const v = document.getElementById('ver-f').value;
            const l = document.getElementById('lvl-f').value;
            const c = document.getElementById('cat-f').value;
            const regex = c ? new RegExp(categoryMap[c], 'i') : null;
            render(
                data.filter(i => (String(i.searchText || `${i.number || ''} ${i.title || ''} ${i.desc || ''}`).toLowerCase().includes(q) || (i.desc && i.desc.toLowerCase().includes(q))) && (v === "" || i.standard === v) && (l === "" || i.level === l) && (!c || ((Array.isArray(i.tags) ? i.tags : String(i.tags || '').split('|')).some(t => regex.test(t))) || (regex && (regex.test(i.title) || (i.desc && regex.test(i.desc)))))),
                options
            );
        };

        const updateCategoryOptions = (standard) => {
            const categoryFilter = document.getElementById('cat-f');
            if (!categoryFilter) return;
            const categories = String(standard || '').toLowerCase().includes('section 508')
                ? []
                : Object.keys(categoryMap).sort();
            categoryFilter.innerHTML = `<option value="">Category: All</option>${categories.map((category) => `<option value="${category}">${category}</option>`).join('')}`;
        };

        const searchInput = document.getElementById('s');
        searchInput?.removeAttribute('aria-haspopup');
        if (searchInput) {
            searchInput.onchange = () => applyFilters();
            searchInput.oninput = () => applyFilters();
            searchInput.addEventListener('focus', notifyLookupPanel);
        }
        ['ver-f', 'lvl-f', 'cat-f'].forEach((id) => {
            document.getElementById(id).onchange = () => {
                if (id === 'ver-f') updateCategoryOptions(document.getElementById(id).value);
                applyFilters({ deferAnnouncement: true });
            };
        });
        document.getElementById('reset-btn').onclick = async () => {
            const result = await executeLookupAction('resetLookup');
            if (!result?.ok) {
                resetTool();
            }
        };
        lookupRegion?.addEventListener('focusin', notifyLookupPanel);
        lookupRegion?.addEventListener('click', notifyLookupPanel);

        const syncLookupStandard = (standard) => {
            const standardFilter = document.getElementById('ver-f');
            if (!standardFilter) return;
            if ([...standardFilter.options].some((option) => option.value === standard)) {
                standardFilter.value = standard;
                applyFilters();
            }
        };

        window.addEventListener('art-standard-changed', (event) => {
            syncLookupStandard(event.detail?.standard || '');
        });

        window.addEventListener('art-accessibility-standards-updated', async () => {
            data = await loadWcagCatalog().catch(() => data);
            const refreshedWcag20 = await getSection508Wcag20Criteria().catch(() => data.filter((item) => item.standard === 'WCAG 2.0'));
            data = [...data, ...(await getSection508LookupCriteria().catch(() => [])), ...refreshedWcag20.map((item) => ({ ...item, standard: 'Section 508', section508Type: 'WCAG 2.0 Criteria', categories: '', requirement: item.desc, testProcedure: item.desc, understandingUrl: item.understandingUrl }))];
            const refreshed = await getAvailableWcagStandards().catch(() => []);
            const standardFilter = document.getElementById('ver-f');
            if (!standardFilter) return;
            const selected = standardFilter.value;
            standardFilter.innerHTML = `<option value="">Version: All</option>${refreshed.map((standard) => `<option value="${standard}">${standard}</option>`).join('')}`;
            if ([...standardFilter.options].some((option) => option.value === selected)) {
                standardFilter.value = selected;
            }
            applyFilters();
        });

        document.addEventListener('focusin', syncLookupLiveAnnouncements);
        lookupRegion?.addEventListener('focusin', enableLookupAnnouncements);
        lookupRegion?.addEventListener('focusout', () => window.setTimeout(syncLookupLiveAnnouncements, 0));

        render(data);
        syncLookupStandard(appState.standard);
        syncLookupLiveAnnouncements();
    } catch (e) { container.innerHTML = 'Error loading data: ' + e.message; }
}
