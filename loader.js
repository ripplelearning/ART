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

// RESTORED: The core rendering logic
function render(data) {
    const listContainer = document.getElementById('list-container');
    const filtered = data.filter(item => {
        const s = document.getElementById('s').value.toLowerCase();
        const ver = document.getElementById('ver-f').value;
        const lvl = document.getElementById('lvl-f').value;
        const cat = document.getElementById('cat-f').value;
        
        return (item.title.toLowerCase().includes(s) || item.id.includes(s)) &&
               (ver === '' || item.version === ver) &&
               (lvl === '' || item.level === lvl) &&
               (cat === '' || item.category === cat);
    });

    listContainer.innerHTML = filtered.map(item => `
        <div style="padding: 8px; border-bottom: 1px solid #eee;">
            <strong>${item.id}</strong>: ${item.title} (${item.level})
        </div>
    `).join('');
    
    document.getElementById('count').innerText = `Found ${filtered.length} results`;
}

// RESTORED: The core filtering logic
function applyFilters() {
    // We re-fetch or re-render based on current state
    // For now, we assume the data is available in the global scope 
    // or passed through the render function
    render(window.loadedWcagData); 
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
        window.loadedWcagData = data; // Store globally for filters to access
        
        container.innerHTML = `
            <input id="s" type="search" placeholder="Search..." style="width:90%; padding:10px;">
            <div>
                <select id="ver-f"><option value="">Version</option></select>
                <select id="lvl-f"><option value="">Level</option></select>
                <select id="cat-f"><option value="">Category</option></select>
                <button id="reset-btn">Reset</button>
            </div>
            <h2 id="count">Found 0 results</h2><div id="list-container"></div>
        `;

        document.getElementById('s').oninput = applyFilters;
        document.getElementById('ver-f').onchange = applyFilters;
        document.getElementById('lvl-f').onchange = applyFilters;
        document.getElementById('cat-f').onchange = applyFilters;
        document.getElementById('reset-btn').onclick = resetTool;
        
        render(data);
    } catch (e) { container.innerHTML = 'Error loading data: ' + e.message; }
}
initTool();
