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
        document.getElementById('s').dispatchEvent(new Event('input'));
    };

    try {
        const data = await fetchJsonWithFallback(dataUrlCandidates);
        container.innerHTML = `
            <input id="s" type="search" placeholder="Search..." style="width:90%; padding:10px;">
            <div><select id="ver-f">...</select><select id="lvl-f">...</select><select id="cat-f">...</select>
            <button id="reset-btn">Reset</button></div>
            <h2 id="count">Found 0 results</h2><div id="list-container"></div>
        `;

        // Render logic and event listeners...
        document.getElementById('s').oninput = applyFilters;
        document.getElementById('reset-btn').onclick = resetTool;
        render(data);
    } catch (e) { container.innerHTML = 'Error loading data: ' + e.message; }
}
initTool();
