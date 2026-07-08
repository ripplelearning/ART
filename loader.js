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

// Ensure this matches your original rendering logic
function render(data) {
    const s = document.getElementById('s').value.toLowerCase();
    const ver = document.getElementById('ver-f').value;
    const lvl = document.getElementById('lvl-f').value;
    const cat = document.getElementById('cat-f').value;

    const filtered = data.filter(item => {
        // Safe access to properties
        const title = (item.title || "").toLowerCase();
        const id = (item.id || "").toLowerCase();
        
        return (title.includes(s) || id.includes(s)) &&
               (ver === '' || item.version === ver) &&
               (lvl === '' || item.level === lvl) &&
               (cat === '' || item.category === cat);
    });

    const listContainer = document.getElementById('list-container');
    listContainer.innerHTML = filtered.map(item => `
        <div style="padding: 8px; border-bottom: 1px solid #eee;">
            <strong>${item.id}</strong>: ${item.title} (${item.level})
        </div>
    `).join('');
    
    document.getElementById('count').innerText = `Found ${filtered.length} results`;
}

function applyFilters() {
    // This assumes data is accessible globally or re-fetched. 
    // If your original code relied on a global variable, keep it here.
    if (window.loadedWcagData) render(window.loadedWcagData);
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
        document.getElementById('s').dispatchEvent(new Event('input'));
    };

    try {
        const data = await fetchJsonWithFallback(dataUrlCandidates);
        window.loadedWcagData = data; // Keep data globally for filters
        
        container.innerHTML = `
            <input id="s" type="search" placeholder="Search..." style="width:90%; padding:10px;">
            <div><select id="ver-f">...</select><select id="lvl-f">...</select><select id="cat-f">...</select>
            <button id="reset-btn">Reset</button></div>
            <h2 id="count">Found 0 results</h2><div id="list-container"></div>
        `;

        document.getElementById('s').oninput = applyFilters;
        document.getElementById('reset-btn').onclick = resetTool;
        render(data);
    } catch (e) { container.innerHTML = 'Error loading data: ' + e.message; }
}
initTool();
