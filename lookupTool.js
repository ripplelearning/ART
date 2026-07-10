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
    throw lastError || new Error('Unable to load JSON data.');
}

export async function initLookupTool() {
    const dataUrlCandidates = LOADER_SRC ? [new URL('wcag_data.js', LOADER_SRC).toString()] : [];
    dataUrlCandidates.push('wcag_data.js');

    const container = document.getElementById('container');
    if (!container) return;
    container.innerHTML = 'Loading criteria...';

    // Helper functions
    const formatAsList = (val) => {
        const text = (val || '').toString();
        return text ? `<ul>${text.split('|').map(i => `<li>${i.trim()}</li>`).join('')}</ul>` : '<ul><li>N/A</li></ul>';
    };
    const formatAsCommaList = (val) => (val || '').toString().replace(/\|/g, ', ') || 'N/A';
    const formatParagraphs = (val) => (val || '').toString().split('|').map(p => `<p>${p.trim()}</p>`).join('');
    const cleanForCopy = (val) => (val || '').toString().replace(/\|/g, '\n');

    try {
        const data = await fetchJsonWithFallback(dataUrlCandidates);
        
        container.innerHTML = `
            <input id="s" type="search" placeholder="Search..." style="width:90%; padding:10px;">
            <div style="margin:15px 0;">
                <select id="ver-f"><option value="">Version: All</option><option value="2.1">2.1</option><option value="2.2">2.2</option></select>
                <select id="lvl-f"><option value="">Level: All</option><option value="A">A</option><option value="AA">AA</option><option value="AAA">AAA</option></select>
                <button id="reset-btn">Reset</button>
            </div>
            <h2 id="count">Found 0 results</h2>
            <div id="list-container"></div>
        `;

        const render = (list) => {
            const listContainer = document.getElementById('list-container');
            listContainer.innerHTML = '';
            list.forEach(i => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <details style="margin-bottom:10px; border:1px solid #eee;">
                        <summary style="padding:10px;">${i.name} (${i.level})</summary>
                        <div style="padding:10px;">
                            <p><strong>Description:</strong> ${formatParagraphs(i.desc)}</p>
                            <p><strong>Failures:</strong> ${formatAsList(i.failures)}</p>
                            <button class="copy-btn" data-text="${i.name}">Copy Name</button>
                        </div>
                    </details>`;
                div.querySelector('.copy-btn').onclick = (e) => {
                    navigator.clipboard.writeText(e.target.dataset.text);
                    e.target.textContent = "Copied!";
                };
                listContainer.appendChild(div);
            });
            document.getElementById('count').textContent = `Found ${list.length} results`;
        };

        const applyFilters = () => {
            const q = document.getElementById('s').value.toLowerCase();
            render(data.filter(i => i.name.toLowerCase().includes(q)));
        };

        document.getElementById('s').oninput = applyFilters;
        document.getElementById('reset-btn').onclick = () => { document.getElementById('s').value = ''; applyFilters(); };
        render(data);
    } catch (e) { container.innerHTML = 'Error: ' + e.message; }
}
