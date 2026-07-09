let appState = { 
    id: null, 
    reportType: 'audit-log',
    reportTitle: "",
    projectName: "",
    environment: "Production",
    scopeUrl: "",
    auditDate: new Date().toISOString().split('T')[0],
    auditors: "",
    standard: "WCAG 2.2",
    fields: [], 
    editorContent: "", 
    lastModified: Date.now() 
};

// --- Helpers ---
function saveState() { 
    appState.lastModified = Date.now(); 
    localStorage.setItem('art-state', JSON.stringify(appState)); 
    updateRecentReports();
}

function updateHeader(key, val) {
    appState[key] = val;
    saveState();
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

// --- Builder Structural Functions ---
function addField() {
    appState.fields.push({ id: Date.now().toString(), label: 'New Field', type: 'text' });
    saveState();
    renderBuilder();
}

function removeField(index) {
    appState.fields.splice(index, 1);
    saveState();
    renderBuilder();
}

function moveField(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= appState.fields.length) return;
    const temp = appState.fields[index];
    appState.fields[index] = appState.fields[newIndex];
    appState.fields[newIndex] = temp;
    saveState();
    renderBuilder();
}

function updateFieldLabel(index, val) { appState.fields[index].label = val; saveState(); }
function updateFieldType(index, val) { appState.fields[index].type = val; saveState(); }

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
    mainInner.innerHTML = `
        <h1>Manage Report Structure</h1>
        <section id="header-config" aria-labelledby="header-heading">
            <h2 id="header-heading">Report Metadata</h2>
            <label>Report Type:
                <select onchange="updateHeader('reportType', this.value)">
                    <option value="audit-log" ${appState.reportType === 'audit-log' ? 'selected' : ''}>Audit Log</option>
                    <option value="exec-summary" ${appState.reportType === 'exec-summary' ? 'selected' : ''}>Executive Summary</option>
                </select>
            </label>
            <label>Report Title: <input type="text" value="${appState.reportTitle}" oninput="updateHeader('reportTitle', this.value)"></label>
            <label>Project / Application Name: <input type="text" value="${appState.projectName}" oninput="updateHeader('projectName', this.value)"></label>
            <label>Environment:
                <select onchange="updateHeader('environment', this.value)">
                    ${['Production', 'Staging', 'QA', 'Development'].map(env => `<option value="${env}" ${appState.environment === env ? 'selected' : ''}>${env}</option>`).join('')}
                </select>
            </label>
            <label>URL / Scope: <input type="text" value="${appState.scopeUrl}" oninput="updateHeader('scopeUrl', this.value)"></label>
            <label>Audit Date(s): <input type="date" value="${appState.auditDate}" oninput="updateHeader('auditDate', this.value)"></label>
            <label>Auditor(s): <input type="text" value="${appState.auditors}" oninput="updateHeader('auditors', this.value)"></label>
            <label>Accessibility Standard:
                <select onchange="updateHeader('standard', this.value)">
                    <option value="WCAG 2.2" ${appState.standard === 'WCAG 2.2' ? 'selected' : ''}>WCAG 2.2</option>
                    <option value="WCAG 2.1" ${appState.standard === 'WCAG 2.1' ? 'selected' : ''}>WCAG 2.1</option>
                </select>
            </label>
        </section>
        <section id="fields-config" aria-labelledby="fields-heading">
            <h2 id="fields-heading">Report Fields</h2>
            <div id="fields-list"></div>
            <button id="add-field-btn">Add New Field</button>
        </section>`;

    const fieldsList = document.getElementById('fields-list');
    appState.fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="text" value="${field.label}" onchange="updateFieldLabel(${index}, this.value)">
            <select onchange="updateFieldType(${index}, this.value)">
                <option value="text" ${field.type==='text'?'selected':''}>Text</option>
                <option value="textarea" ${field.type==='textarea'?'selected':''}>Textarea</option>
                <option value="select" ${field.type==='select'?'selected':''}>Select (Dropdown)</option>
                <option value="link" ${field.type==='link'?'selected':''}>Link/URL</option>
            </select>
            <button onclick="moveField(${index}, -1)">↑</button>
            <button onclick="moveField(${index}, 1)">↓</button>
            <button onclick="removeField(${index})">Delete</button>
        `;
        fieldsList.appendChild(div);
    });
    document.getElementById('add-field-btn').onclick = addField;
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
        <button onclick="exportReport('txt')" id="btn-export-txt">Export TXT Bundle</button>
        <button onclick="exportReport('html')" id="btn-export-html">Export HTML Bundle</button>
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
    document.getElementById('btn-new-report').onclick = () => document.getElementById('new-report-options').hidden = !document.getElementById('new-report-options').hidden;
    document.getElementById('btn-open-report').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => { appState = JSON.parse(ev.target.result); saveState(); renderBuilder(); switchToTab('tab-builder'); };
            reader.readAsText(e.target.files[0]);
        };
        input.click();
    };

    document.getElementById('btn-build-report').onclick = () => {
        appState = { id: Date.now().toString(), reportTitle: "New Report", auditorName: "", reportType: 'audit-log', templateId: 'basic', fields: [], editorContent: "", lastModified: Date.now() };
        saveState(); renderBuilder(); switchToTab('tab-builder');
    };

    document.getElementById('btn-manage-recent').onclick = () => { loadReport(document.getElementById('recent-reports-select').value); renderBuilder(); switchToTab('tab-builder'); };
    document.getElementById('btn-edit-recent').onclick = () => { loadReport(document.getElementById('recent-reports-select').value); renderEditor(); switchToTab('tab-editor'); };
    document.getElementById('btn-view-recent').onclick = () => { loadReport(document.getElementById('recent-reports-select').value); renderView(); switchToTab('tab-view'); };

    const tablist = document.querySelector('[role="tablist"]');
    tablist.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('[role="tab"]');
        if (!clickedTab) return;
        tablist.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', t === clickedTab ? 'true' : 'false'));
        if (clickedTab.id === 'tab-builder') renderBuilder();
        else if (clickedTab.id === 'tab-editor') renderEditor();
        else if (clickedTab.id === 'tab-view') renderView();
    });

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
        if (e.ctrlKey && e.key === 'o') { e.preventDefault(); document.getElementById('btn-open-report').click(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); (document.getElementById('btn-export-txt') || document.getElementById('btn-export-html'))?.click(); }
    });
});
