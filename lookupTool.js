// lookupTool.js
const LOADER_SRC = document.currentScript && document.currentScript.src;

async function fetchJsonWithFallback(urls) {
    let lastError = null;
    for (const url of urls) {
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
            return await response.json();
        } catch (err) { lastError = err; }
    }
    throw lastError || new Error('Unable to load JSON data from all sources.');
}

export async function initLookupTool() {
    const dataUrlCandidates = LOADER_SRC ? [new URL('wcag_data.js', LOADER_SRC).toString()] : [];
    dataUrlCandidates.push('wcag_data.js');

    const container = document.getElementById('container');
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
        document.getElementById('s').value = '';
        document.getElementById('ver-f').value = '';
        document.getElementById('lvl-f').value = '';
        document.getElementById('cat-f').value = '';
        document.getElementById('s').dispatchEvent(new Event('input'));
    };

    try {
        const data = await fetchJsonWithFallback(dataUrlCandidates);

        container.innerHTML = `
            <input id="s" type="search" placeholder="Search... e.g. 1.1.1, buttons, tables" style="width:90%; padding:10px;">
            <div style="margin:15px 0;">
                <select id="ver-f"><option value="">Version: All</option><option value="2.1">2.1</option><option value="2.2">2.2</option></select>
                <select id="lvl-f"><option value="">Level: All</option><option value="A">A</option><option value="AA">AA</option><option value="AAA">AAA</option></select>
                <select id="cat-f"><option value="">Category: All</option>${Object.keys(categoryMap).sort().map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select>
                <button id="reset-btn">Reset (Alt+Shift+D)</button>
            </div>
            <h2 id="count" aria-live="polite">Found 0 results</h2>
            <div id="list-container"></div>
            <footer style="margin-top:40px; border-top:1px solid #ccc; padding-top:10px;">
                <details>
                    <summary style="font-weight:bold; cursor:pointer;">How to use this tool</summary>
                    <fieldset style="border:none; padding:0; margin:0;">
                        <dl><dt>Instructions:</dt><dd>Use the search box to find specific criteria. Filters for version, level, and category will narrow down results.</dd>
                        <dt>Keyboard Shortcut:</dt><dd><strong>Reset Tool:</strong> Alt+Shift+D</dd></dl>
                        <p><a href="https://github.com/ripplelearning/wcag-database" target="_blank">View Source on GitHub</a></p>
                    </fieldset>
                </details>
            </footer>
        `;

        const render = (list) => {
            const listContainer = document.getElementById('list-container');
            listContainer.innerHTML = '';
            // Restored Version Headings:
            ['2.2', '2.1'].forEach(ver => {
                const filteredVer = list.filter(i => i.ver == ver);
                if (filteredVer.length === 0) return;
                const h3 = document.createElement('h3');
                h3.textContent = `WCAG ${ver} Success Criteria`;
                listContainer.appendChild(h3);
                
                filteredVer.forEach(i => {
                    const div = document.createElement('div');
                    div.innerHTML = `<details style="margin-bottom:10px; border:1px solid #eee;"><summary style="font-weight:bold; cursor:pointer; padding:10px;">${i.name} (Level ${i.level})</summary><fieldset style="border:none; padding:10px; margin:0;"><dl><dt>Description:</dt><dd>${formatParagraphs(i.desc)}</dd><dt>Failures:</dt><dd>${formatAsList(i.failures)}</dd><dt>Fixes:</dt><dd>${formatAsList(i.fixes)}</dd><dt>Disabilities:</dt><dd>${formatAsCommaList(i.disabilitie)}</dd><dt>Link:</dt><dd><a href="${i.Link || '#'}" target="_blank">Open W3C documentation</a></dd></dl><ul style="list-style-type:none; padding:0;"><li><button class="copy-btn" data-text="${i.name}\n\nDescription:\n${(i.desc || '').replace(/\|/g, ' ')}\n\nFailures:\n${(i.failures || '').replace(/\|/g, '\n')}\n\nFixes:\n${(i.fixes || '').replace(/\|/g, '\n')}\n\nDisabilities: ${formatAsCommaList(i.disabilitie)}\n\nLink: ${i.Link || 'N/A'}">Copy Full Entry</button></li><li><button class="copy-btn" data-text="${cleanForCopy(i.name)}">Copy Name</button></li><li><button class="copy-btn" data-text="${cleanForCopy(i.desc)}">Copy Desc</button></li><li><button class="copy-btn" data-text="${cleanForCopy(i.failures)}">Copy Failures</button></li><li><button class="copy-btn" data-text="${cleanForCopy(i.fixes)}">Copy Fixes</button></li><li><button class="copy-btn" data-text="${i.Link || ''}">Copy Link</button></li></ul></fieldset></details>`;
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
            document.getElementById('count').textContent = msg;
            announcer.textContent = msg;
        };

        const applyFilters = () => {
            const q = document.getElementById('s').value.toLowerCase();
            const v = document.getElementById('ver-f').value;
            const l = document.getElementById('lvl-f').value;
            const c = document.getElementById('cat-f').value;
            const regex = c ? new RegExp(categoryMap[c], 'i') : null;
            render(data.filter(i => (i.name.toLowerCase().includes(q) || (i.desc && i.desc.toLowerCase().includes(q))) && (v === "" || i.ver == v) && (l === "" || i.level === l) && (!c || ((Array.isArray(i.tags) ? i.tags : String(i.tags || '').split('|')).some(t => regex.test(t))) || (regex && (regex.test(i.name) || (i.desc && regex.test(i.desc)))))));
        };

        ['s', 'ver-f', 'lvl-f', 'cat-f'].forEach(id => document.getElementById(id).onchange = applyFilters);
        document.getElementById('s').oninput = applyFilters;
        document.getElementById('reset-btn').onclick = resetTool;

        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.shiftKey && e.key === 'A') { window.resizeTo(800, 600); window.focus(); document.getElementById('s').focus(); }
            if (e.altKey && e.shiftKey && e.key === 'D') { resetTool(); }
            if (e.key === 'Escape') { window.resizeTo(0, 0); }
        });
        render(data);
    } catch (e) { container.innerHTML = 'Error loading data: ' + e.message; }
}
