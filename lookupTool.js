// lookupTool.js
import { appState, getShortcutForAction } from './state.js';
import { getAvailableWcagStandards, loadWcagCatalog } from './wcagCatalog.js';

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

    try {
        const data = await loadWcagCatalog();
        const standards = await getAvailableWcagStandards();

        const resetLookupShortcut = getShortcutForAction('resetLookup') || 'Alt+Shift+D';

        container.innerHTML = `
            <fieldset style="margin:0; padding:0; border:0;">
                <legend>Search and filter criteria</legend>
                <label for="s">Search criteria</label>
                <input id="s" type="search" placeholder="Search... e.g. 1.1.1, buttons, tables" style="width:90%; padding:10px;">
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
                const filteredStandard = list.filter((item) => item.standard === standardName);
                if (filteredStandard.length === 0) return;
                const h3 = document.createElement('h3');
                h3.textContent = `${standardName} Success Criteria`;
                listContainer.appendChild(h3);
                
                filteredStandard.forEach(i => {
                    const displayName = `${i.number} ${i.title}`;
                    const div = document.createElement('div');
                    div.innerHTML = `<details style="margin-bottom:10px; border:1px solid #eee;"><summary style="font-weight:bold; cursor:pointer; padding:10px;">${displayName} (Level ${i.level})</summary><fieldset style="border:none; padding:10px; margin:0;"><dl><dt>Description:</dt><dd>${formatParagraphs(i.desc)}</dd><dt>Failures:</dt><dd>${formatAsList(i.failures)}</dd><dt>Fixes:</dt><dd>${formatAsList(i.fixes)}</dd><dt>Disabilities:</dt><dd>${formatAsCommaList(i.disabilitie)}</dd><dt>References:</dt><dd><a href="${i.understandingUrl || '#'}" target="_blank" rel="noopener noreferrer">Open official documentation</a></dd></dl><ul style="list-style-type:none; padding:0;"><li><button class="copy-btn" data-copy-action="copyEntry" data-text="${displayName}\n\nDescription:\n${(i.desc || '').replace(/\|/g, ' ')}\n\nFailures:\n${(i.failures || '').replace(/\|/g, '\n')}\n\nFixes:\n${(i.fixes || '').replace(/\|/g, '\n')}\n\nDisabilities: ${formatAsCommaList(i.disabilitie)}\n\nReferences: ${i.understandingUrl || 'N/A'}">Copy Full Entry</button></li><li><button class="copy-btn" data-copy-action="copyName" data-text="${cleanForCopy(displayName)}">Copy Name</button></li><li><button class="copy-btn" data-copy-action="copyDescription" data-text="${cleanForCopy(i.desc)}">Copy Description</button></li><li><button class="copy-btn" data-copy-action="copyFailures" data-text="${cleanForCopy(i.failures)}">Copy Failures</button></li><li><button class="copy-btn" data-copy-action="copyFixes" data-text="${cleanForCopy(i.fixes)}">Copy Fixes</button></li><li><button class="copy-btn" data-copy-action="copyLink" data-text="${i.understandingUrl || ''}">Copy References</button></li></ul></fieldset></details>`;
                    div.querySelectorAll('.copy-btn').forEach(b => {
                        b.onclick = () => {
                            navigator.clipboard.writeText(b.getAttribute('data-text'));
                            const original = b.textContent;
                            b.textContent = "Copied!";
                            setTimeout(() => b.textContent = original, 2000);
                        };
                    });
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
                data.filter(i => (i.searchText.includes(q) || (i.desc && i.desc.toLowerCase().includes(q))) && (v === "" || i.standard === v) && (l === "" || i.level === l) && (!c || ((Array.isArray(i.tags) ? i.tags : String(i.tags || '').split('|')).some(t => regex.test(t))) || (regex && (regex.test(i.title) || (i.desc && regex.test(i.desc)))))),
                options
            );
        };

        document.getElementById('s').onchange = () => applyFilters();
        document.getElementById('s').oninput = () => applyFilters();
        ['ver-f', 'lvl-f', 'cat-f'].forEach((id) => {
            document.getElementById(id).onchange = () => applyFilters({ deferAnnouncement: true });
        });
        document.getElementById('s').addEventListener('focus', notifyLookupPanel);
        document.getElementById('reset-btn').onclick = resetTool;
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
