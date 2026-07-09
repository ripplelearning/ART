let appState = { 
    id: null, reportTitle: "Untitled", reportType: 'audit-log', templateId: 'basic', 
    fields: {}, editorContent: "", lastModified: Date.now() 
};

const templates = {
    basic: [{ id: 'auditor', label: 'Auditor', type: 'text' }],
    full: [{ id: 'auditor', label: 'Auditor', type: 'text' }, { id: 'scope', label: 'Scope', type: 'textarea' }]
};

// --- Helpers ---
function saveState() { 
    appState.lastModified = Date.now(); 
    localStorage.setItem('art-state', JSON.stringify(appState)); 
    updateRecentReports();
}

function switchToTab(tabId) {
    const tab = document.getElementById(tabId);
    if (tab) tab.click();
}

async function exportReport(format) {
    const zip = new JSZip();
    zip.file("report-backup.json", JSON.stringify({_meta: "DO NOT MODIFY", ...appState}, null, 2));
    const content = format === 'html' ? `<html><body><h1>${appState.reportTitle}</h1><p>${appState.editorContent.replace(/\n/g, '<br>')}</p></body></html>` : appState.editorContent;
    zip.file(`report.${format}`, content);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "report-bundle.zip"; a.click();
}

// --- Dashboard Logic ---
function updateRecentReports() {
    const container = document.getElementById('recent-reports-container');
    const select = document.getElementById('recent-reports-select');
    const recent = JSON.parse(localStorage.getItem('art-recent-reports') || '[]');

    if (recent.length > 0) {
        container.hidden = false;
        select.innerHTML = recent.map(r => `<option value="${r.id}">${r.title}</option>`).join('');
    } else {
        container.hidden = true;
    }
}

function loadReport(id) {
    const recent = JSON.parse(localStorage.getItem('art-recent-reports') || '[]');
    const report = recent.find(r => r.id === id);
    if (report) appState = { ...report };
}

// --- Renderers ---
const renderBuilder = () => {
    const mainInner = document.getElementById('main-inner');
    mainInner.innerHTML = `<h1>Builder</h1><p><small>Last Sync: ${new Date(appState.lastModified).toLocaleString()}</small></p>
        <label>Type: <select id="type-select"><option value="audit-log" ${appState.reportType==='audit-log'?'selected':''}>Audit Log</option><option value="exec-summary" ${appState.reportType==='exec-summary'?'selected':''}>Exec Summary</option></select></label>
        <label>Template: <select id="template-select"><option value="basic" ${appState.templateId==='basic'?'selected':''}>Basic</option><option value="full" ${appState.templateId==='full'?'selected':''}>Full</option></select></label>
        <div id="fields"></div>`;
    document.getElementById('type-select').onchange = (e) => { appState.reportType = e.target.value; saveState(); renderBuilder(); };
    document.getElementById('template-select').onchange = (e) => { appState.templateId = e.target.value; appState.fields = {}; saveState(); renderBuilder(); };
    templates[appState.templateId].forEach(f => {
        const el = f.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
        el.placeholder = f.label; el.value = appState.fields[f.id] || '';
        el.oninput = (e) => { appState.fields[f.id] = e.target.value; saveState(); };
        document.getElementById('fields').appendChild(el);
    });
};

const renderEditor = () => {
    const mainInner = document.getElementById('main-inner');
    mainInner.innerHTML = `<h1>Editor</h1><textarea id="editor" style="height:300px; width:100%">${appState.editorContent}</textarea>`;
    document.getElementById('editor').oninput = (e) => { appState.editorContent = e.target.value; saveState(); };
};

const renderView = () => {
    const mainInner = document.getElementById('main-inner');
    mainInner.innerHTML = `<h1>View/Export</h1>
        <p><strong>Title:</strong> ${appState.reportTitle}</p>
        <button onclick="exportReport('txt')">Export TXT Bundle</button>
        <button onclick="exportReport('html')">Export HTML Bundle</button>
        <label>Import JSON: <input type="file" id="import-input" accept=".json"></label>`;
    document.getElementById('import-input').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => { appState = JSON.parse(ev.target.result); saveState(); renderView(); };
        reader.readAsText(e.target.files[0]);
    };
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateRecentReports();

    // Dashboard: New Report Toggle
    document.getElementById('btn-new-report').onclick = () => {
        const opts = document.getElementById('new-report-options');
        opts.hidden = !opts.hidden;
    };

    // Dashboard: Build Report Action
    document.getElementById('btn-build-report').onclick = () => {
        const template = document.getElementById('template-dropdown').value;
        appState = { 
            id: Date.now().toString(), 
            reportTitle: "New Report", 
            templateId: template === 'none' ? 'basic' : template,
            fields: {}, editorContent: "", lastModified: Date.now() 
        };
        saveState();
        renderBuilder();
        switchToTab('tab-builder');
    };

    // Dashboard: Manage/Edit/View Actions
    document.getElementById('btn-manage-recent').onclick = () => {
        loadReport(document.getElementById('recent-reports-select').value);
        renderBuilder();
        switchToTab('tab-builder');
    };
    document.getElementById('btn-edit-recent').onclick = () => {
        loadReport(document.getElementById('recent-reports-select').value);
        renderEditor();
        switchToTab('tab-editor');
    };
    document.getElementById('btn-view-recent').onclick = () => {
        loadReport(document.getElementById('recent-reports-select').value);
        renderView();
        switchToTab('tab-view');
    };

    // Tab Navigation Logic
    const tablist = document.querySelector('[role="tablist"]');
    tablist.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('[role="tab"]');
        if (!clickedTab) return;
        tablist.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', t === clickedTab ? 'true' : 'false'));
        if (clickedTab.id === 'tab-builder') renderBuilder();
        else if (clickedTab.id === 'tab-editor') renderEditor();
        else if (clickedTab.id === 'tab-view') renderView();
    });

    // Global Keyboard Navigation
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'F6') {
            e.preventDefault();
            const regions = [document.querySelector('nav'), document.getElementById('dashboard'), document.querySelector('main'), document.querySelector('aside')].filter(r => r !== null);
            let activeIndex = regions.findIndex(r => r.contains(document.activeElement));
            let nextIndex = (activeIndex === -1 || activeIndex >= regions.length - 1) ? 0 : activeIndex + 1;
            const nextRegion = regions[nextIndex];
            let target = nextRegion.tagName === 'NAV' ? nextRegion.querySelector('[role="tab"]') : nextRegion.querySelector('button, input, select, textarea, [tabindex]');
            target = target || nextRegion;
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus();
        }
    });
});
