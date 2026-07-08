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

async function initTool() {
    const dataUrlCandidates = [];
    if (LOADER_SRC) dataUrlCandidates.push(new URL('wcag_data.js', LOADER_SRC).toString());
    dataUrlCandidates.push('wcag_data.js');

    const container = document.getElementById('container');
    container.innerHTML = 'Loading criteria...';

    const resetTool = () => {
        document.getElementById('s').value = '';
        document.getElementById('ver-f').value = '';
        document.getElementById('lvl-f').value = '';
        document.getElementById('cat-f').value = '';
        applyFilters();
    };

    try {
        const data = await fetchJsonWithFallback(dataUrlCandidates);
        
        container.innerHTML = `
            <input id="s" type="search" placeholder="Search..." style="width:100%; padding:10px; box-sizing:border-box;">
            <div style="display:flex; gap:5px; margin:10px 0;">
                <select id="ver-f"><option value="">Ver</option><option value="2.1">2.1</option><option value="2.2">2.2</option></select>
                <select id="lvl-f"><option value="">Level</option><option value="A">A</option><option value="AA">AA</option></select>
                <select id="cat-f"><option value="">Category</option></select>
                <button id="reset-btn">Reset</button>
            </div>
            <h2 id="count" style="font-size:14px;">Found 0 results</h2>
            <div id="list-container" style="height: 400px; overflow-y: auto;"></div>
        `;

        // Render Logic
        const applyFilters = () => {
            const s = document.getElementById('s').value.toLowerCase();
            const ver = document.getElementById('ver-f').value;
            const lvl = document.getElementById('lvl-f').value;
            
            const filtered = data.filter(item => 
                (item.title.toLowerCase().includes(s) || item.id.includes(s)) &&
                (ver === '' || item.version === ver) &&
                (lvl === '' || item.level === lvl)
            );

            const list = document.getElementById('list-container');
            list.innerHTML = filtered.map(item => `
                <div style="padding:8px; border-bottom:1px solid #eee; font-size:13px;">
                    <strong>${item.id}</strong> ${item.title} (${item.level})
                </div>
            `).join('');
            document.getElementById('count').innerText = `Found ${filtered.length} results`;
        };

        // Event Listeners
        document.getElementById('s').oninput = applyFilters;
        document.getElementById('ver-f').onchange = applyFilters;
        document.getElementById('lvl-f').onchange = applyFilters;
        document.getElementById('reset-btn').onclick = resetTool;
        
        applyFilters(); // Initial render
    } catch (e) { 
        container.innerHTML = 'Error loading data: ' + e.message; 
    }
}
initTool();
