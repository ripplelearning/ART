import {
    applyMetadataDraft,
    addAuditEntry,
    announce,
    appState,
    canPerformExternalCommunication,
    buildMetadataDraftFromValues,
    clearReportContentOnly,
    clearReportEverythingInSession,
    currentReportSupportsAuditEntries,
    deleteAuditEntry,
    ensureAuditEntries,
    getAuditEntries,
    getAuditEntryDisplayName,
    getCurrentReportMetrics,
    getShortcutForAction,
    getSpellUserDictionary,
    addSpellUserDictionaryWord,
    getMetadataDescriptors,
    moveAuditEntry,
    upsertCurrentReport,
    validateCurrentReport,
    validateMetadataDraft,
    updateAuditEntryFieldValue,
    updateEditorFieldValue
} from './state.js';
import { formatWcagCriterionDisplay, getWcagCriteriaForStandard, isWcagCriterionFieldType } from './wcagCatalog.js';
import { requestViewerExportDialog, requestViewerPrintPreview } from './reportViewer.js';

let pendingEntryFocus = null;
let pendingDeleteEntry = null;
let activeModalDialog = null;
let areModalListenersBound = false;
let pendingEditorFocusTargetId = '';
let spellSession = null;

function editorEventToShortcut(event) {
    const key = String(event.key || '');
    if (!key || ['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    let normalized = key;
    if (/^f\d+$/i.test(key)) {
        normalized = key.toUpperCase();
    } else if (key.length === 1) {
        normalized = key.toUpperCase();
    } else if (key === ' ') {
        normalized = 'Space';
    } else {
        normalized = key[0].toUpperCase() + key.slice(1).toLowerCase();
    }

    parts.push(normalized);
    return parts.join('+');
}

function levenshteinDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= left.length; i += 1) {
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[left.length][right.length];
}

const fallbackSpellDictionary = new Set([
    'a','able','about','above','access','accessibility','accessible','action','actions','add','added','additional','all','allow','already','an','and','announcement','app','application','are','aria','as','assign','assigned','audit','available','bar','be','because','been','before','below','between','both','browser','build','builder','button','buttons','by','can','cancel','change','changed','checking','clear','close','code','color','command','commands','complete','configurable','configure','conflict','content','controls','copy','correction','criteria','current','custom','dashboard','data','default','delete','description','dialog','does','done','down','editor','entry','error','errors','escape','existing','export','field','fields','filter','find','focus','for','found','from','function','functions','have','help','highlight','if','ignore','import','in','include','information','input','is','issue','issues','it','item','items','keyboard','keys','label','labels','link','list','lookup','manual','manager','metadata','modal','move','name','navigation','new','no','not','now','of','on','open','option','or','panel','paragraph','print','project','report','replace','required','reset','result','review','role','save','screen','search','section','select','selection','settings','shortcut','shortcuts','should','show','single','spell','spelling','standard','start','status','stop','suggestion','suggestions','table','tab','template','text','that','the','there','this','to','tool','undo','update','up','use','user','value','version','view','viewer','wcag','when','with','word','words','workflow'
]);

let spellDictionaryEngine = null;
let spellDictionaryLoadPromise = null;

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => script.src === src);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function ensureSpellDictionaryEngine() {
    if (spellDictionaryEngine) return spellDictionaryEngine;
    if (spellDictionaryLoadPromise) return spellDictionaryLoadPromise;

    if (!canPerformExternalCommunication()) {
        return null;
    }

    spellDictionaryLoadPromise = (async () => {
        try {
            if (typeof window.Typo !== 'function') {
                await loadExternalScript('https://cdn.jsdelivr.net/npm/typo-js@1.2.4/typo.js');
            }

            const [affResponse, dicResponse] = await Promise.all([
                fetch('https://cdn.jsdelivr.net/npm/dictionary-en-us/index.aff'),
                fetch('https://cdn.jsdelivr.net/npm/dictionary-en-us/index.dic')
            ]);

            if (!affResponse.ok || !dicResponse.ok || typeof window.Typo !== 'function') {
                throw new Error('Dictionary files unavailable');
            }

            const [affData, dicData] = await Promise.all([affResponse.text(), dicResponse.text()]);
            spellDictionaryEngine = new window.Typo('en_US', affData, dicData, { platform: 'any' });
        } catch (error) {
            spellDictionaryEngine = null;
        }
        return spellDictionaryEngine;
    })();

    return spellDictionaryLoadPromise;
}

function getSpellSuggestions(word) {
    const source = String(word || '').toLowerCase();
    if (!source) return [];
    if (spellDictionaryEngine && typeof spellDictionaryEngine.suggest === 'function') {
        return spellDictionaryEngine.suggest(source).slice(0, 6);
    }
    return [...fallbackSpellDictionary]
        .filter((entry) => entry[0] === source[0])
        .map((entry) => ({ entry, score: levenshteinDistance(source, entry) }))
        .filter((item) => item.score <= 3)
        .sort((a, b) => a.score - b.score)
        .slice(0, 6)
        .map((item) => item.entry);
}

function getSpellContext(text, start, end) {
    const full = String(text || '');
    const leftBound = Math.max(0, full.lastIndexOf('.', start - 1) + 1, full.lastIndexOf('\n', start - 1) + 1);
    let rightBound = full.indexOf('.', end);
    if (rightBound < 0) rightBound = full.length;
    const sentence = full.slice(leftBound, rightBound + 1).trim();
    return sentence || full.slice(Math.max(0, start - 40), Math.min(full.length, end + 40));
}

function isWordMisspelled(word, ignoreSet) {
    const raw = String(word || '');
    const lower = raw.toLowerCase();
    if (!lower || lower.length < 2) return false;
    if (ignoreSet.has(raw) || ignoreSet.has(lower)) return false;
    if (/^[A-Z]{2,}$/.test(raw)) return false;
    if (/\d/.test(raw)) return false;
    if (raw[0] === raw[0].toUpperCase() && raw.slice(1) !== raw.slice(1).toLowerCase()) return false;
    if (spellDictionaryEngine && typeof spellDictionaryEngine.check === 'function') {
        return !spellDictionaryEngine.check(lower);
    }
    return !fallbackSpellDictionary.has(lower);
}

function getSpellcheckControls() {
    const editor = document.getElementById('editor-view');
    if (!editor) return [];
    return Array.from(editor.querySelectorAll('textarea, input[type="text"]'))
        .filter((control) => !control.readOnly && !control.disabled && control.id && control.id.startsWith('editor-field-'));
}

function collectSpellIssues(ignoreSet = new Set()) {
    const issues = [];
    const controls = getSpellcheckControls();
    controls.forEach((control) => {
        const text = String(control.value || '');
        const matcher = /\b[A-Za-z][A-Za-z'’-]*\b/g;
        let match;
        while ((match = matcher.exec(text)) !== null) {
            const word = match[0];
            const start = match.index;
            const end = start + word.length;
            if (!isWordMisspelled(word, ignoreSet)) continue;
            issues.push({
                controlId: control.id,
                word,
                start,
                end,
                context: getSpellContext(text, start, end),
                suggestions: getSpellSuggestions(word)
            });
        }
    });
    return issues;
}

function buildSpellIgnoreSet(sessionIgnoreSet) {
    const merged = new Set();
    (getSpellUserDictionary() || []).forEach((word) => {
        const value = String(word || '').trim();
        if (!value) return;
        merged.add(value);
        merged.add(value.toLowerCase());
    });
    (sessionIgnoreSet || new Set()).forEach((word) => {
        merged.add(word);
        merged.add(String(word || '').toLowerCase());
    });
    return merged;
}

function getSpellActionLabel(action, fallback) {
    const shortcut = getShortcutForAction(action);
    return shortcut ? `${fallback} (${shortcut})` : fallback;
}

function renderSpellDialog(session) {
    const issue = session.issues[session.index];
    const suggestionOptions = issue.suggestions.length
        ? issue.suggestions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')
        : '<option value="">No suggestion available</option>';
    const labelText = `Issue ${session.index + 1} of ${session.issues.length}`;
    return `
        <h3 id="spellcheck-title">Spell Check</h3>
        <p id="spellcheck-status" class="spellcheck-status">${escapeHtml(labelText)}: <strong>${escapeHtml(issue.word)}</strong></p>
        <p class="spellcheck-context" id="spellcheck-context">${escapeHtml(issue.context)}</p>
        <label for="spellcheck-replacement">Replacement</label>
        <input id="spellcheck-replacement" type="text" value="${escapeHtml(issue.suggestions[0] || issue.word)}" autocomplete="off" />
        <label for="spellcheck-suggestion-list">Suggestions</label>
        <select id="spellcheck-suggestion-list">${suggestionOptions}</select>
        <div class="modal-actions" role="group" aria-label="Spell check actions">
            <button id="spellcheck-replace" type="button">${escapeHtml(getSpellActionLabel('spellReplace', 'Replace'))}</button>
            <button id="spellcheck-replace-all" type="button">${escapeHtml(getSpellActionLabel('spellReplaceAll', 'Replace All'))}</button>
            <button id="spellcheck-ignore" type="button">${escapeHtml(getSpellActionLabel('spellIgnore', 'Ignore'))}</button>
            <button id="spellcheck-ignore-all" type="button">${escapeHtml(getSpellActionLabel('spellIgnoreAll', 'Ignore All'))}</button>
            <button id="spellcheck-add-dictionary" type="button">${escapeHtml(getSpellActionLabel('spellAddToDictionary', 'Add to Dictionary'))}</button>
            <button id="spellcheck-undo" type="button" ${session.history.length ? '' : 'disabled aria-disabled="true"'}>${escapeHtml(getSpellActionLabel('spellUndoLastCorrection', 'Undo Last Correction'))}</button>
            <button id="spellcheck-cancel" type="button">${escapeHtml(getSpellActionLabel('spellCancel', 'Cancel'))}</button>
        </div>
        <p id="spellcheck-live" class="sr-only" aria-live="polite"></p>
    `;
}

function focusSpellIssue(issue) {
    const control = document.getElementById(issue.controlId);
    if (!control) return;
    control.focus();
    if (typeof control.setSelectionRange === 'function') {
        control.setSelectionRange(issue.start, issue.end);
    }
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    control.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
}

function applySpellReplacement(issue, replacement) {
    const control = document.getElementById(issue.controlId);
    if (!control) return null;
    const text = String(control.value || '');
    const updated = `${text.slice(0, issue.start)}${replacement}${text.slice(issue.end)}`;
    control.value = updated;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    return {
        controlId: issue.controlId,
        start: issue.start,
        before: issue.word,
        after: replacement
    };
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applySpellReplaceAll(session, sourceWord, replacement) {
    const source = String(sourceWord || '').trim();
    const target = String(replacement || '').trim();
    if (!source || !target || source === target) return 0;
    const matcher = new RegExp(`\\b${escapeRegex(source)}\\b`, 'g');
    let count = 0;
    getSpellcheckControls().forEach((control) => {
        const before = String(control.value || '');
        const after = before.replace(matcher, () => {
            count += 1;
            return target;
        });
        if (after !== before) {
            control.value = after;
            control.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    if (count > 0) {
        session.history.push({ type: 'replaceAll', source, target, count });
    }
    return count;
}

function rebuildSpellSessionIssues(session) {
    session.issues = collectSpellIssues(buildSpellIgnoreSet(session.ignoreAllWords));
    if (session.index >= session.issues.length) {
        session.index = Math.max(0, session.issues.length - 1);
    }
}

function announceSpellMessage(message) {
    const live = document.getElementById('spellcheck-live');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(() => {
        live.textContent = message;
    }, 10);
}

function announceEditorStatus(message) {
    announce(String(message || ''));
}

function closeSpellDialog(restoreFocus = true) {
    const dialog = document.getElementById('editor-spellcheck-dialog');
    if (dialog) {
        dialog.hidden = true;
        dialog.innerHTML = '';
    }
    closeModalDialog(false);
    const trigger = document.getElementById('btn-editor-spell-check');
    const shouldRestore = restoreFocus && trigger;
    spellSession = null;
    if (shouldRestore) {
        window.setTimeout(() => trigger.focus(), 0);
    }
}

function rerenderSpellDialog() {
    if (!spellSession) return;
    const dialog = document.getElementById('editor-spellcheck-dialog');
    if (!dialog) return;
    if (!spellSession.issues.length) {
        closeSpellDialog(false);
        announceEditorStatus('Spell checking is complete.');
        return;
    }
    dialog.innerHTML = renderSpellDialog(spellSession);
    openModalDialog(dialog, null, document.getElementById('btn-editor-spell-check'));

    const issue = spellSession.issues[spellSession.index];
    focusSpellIssue(issue);

    const replacementInput = document.getElementById('spellcheck-replacement');
    const suggestionList = document.getElementById('spellcheck-suggestion-list');
    const onSuggestionChange = () => {
        if (!replacementInput || !suggestionList) return;
        replacementInput.value = suggestionList.value;
    };
    if (suggestionList) {
        suggestionList.addEventListener('change', onSuggestionChange);
    }

    const command = (name) => {
        if (!spellSession) return;
        const currentIssue = spellSession.issues[spellSession.index];
        const replacement = String(replacementInput?.value || '').trim();
        if (name === 'replace') {
            const mutation = applySpellReplacement(currentIssue, replacement || currentIssue.word);
            if (mutation) {
                spellSession.history.push({ type: 'replace', mutation });
                announceSpellMessage(`Replaced ${currentIssue.word} with ${replacement || currentIssue.word}.`);
            }
            rebuildSpellSessionIssues(spellSession);
            rerenderSpellDialog();
            return;
        }
        if (name === 'replaceAll') {
            const changed = applySpellReplaceAll(spellSession, currentIssue.word, replacement || currentIssue.word);
            announceSpellMessage(changed ? `Replaced ${changed} occurrences of ${currentIssue.word}.` : `No additional occurrences of ${currentIssue.word} were found.`);
            rebuildSpellSessionIssues(spellSession);
            rerenderSpellDialog();
            return;
        }
        if (name === 'ignore') {
            spellSession.issues.splice(spellSession.index, 1);
            if (!spellSession.issues.length) {
                closeSpellDialog(false);
                announceEditorStatus('Spell checking is complete.');
                return;
            }
            if (spellSession.index >= spellSession.issues.length) {
                spellSession.index = spellSession.issues.length - 1;
            }
            rerenderSpellDialog();
            return;
        }
        if (name === 'ignoreAll') {
            spellSession.ignoreAllWords.add(String(currentIssue.word || '').toLowerCase());
            rebuildSpellSessionIssues(spellSession);
            announceSpellMessage(`Ignoring all occurrences of ${currentIssue.word}.`);
            rerenderSpellDialog();
            return;
        }
        if (name === 'addDictionary') {
            const added = addSpellUserDictionaryWord(currentIssue.word);
            const spoken = added.alreadyExists
                ? `${currentIssue.word} is already in your dictionary.`
                : `Added ${currentIssue.word} to your dictionary.`;
            announceSpellMessage(spoken);
            rebuildSpellSessionIssues(spellSession);
            rerenderSpellDialog();
            return;
        }
        if (name === 'undo') {
            const last = spellSession.history.pop();
            if (!last) return;
            if (last.type === 'replace' && last.mutation) {
                const control = document.getElementById(last.mutation.controlId);
                if (control) {
                    const current = String(control.value || '');
                    const start = last.mutation.start;
                    const end = start + String(last.mutation.after || '').length;
                    control.value = `${current.slice(0, start)}${last.mutation.before}${current.slice(end)}`;
                    control.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (last.type === 'replaceAll') {
                const matcher = new RegExp(`\\b${escapeRegex(last.target)}\\b`, 'g');
                getSpellcheckControls().forEach((control) => {
                    const text = String(control.value || '');
                    control.value = text.replace(matcher, last.source);
                    control.dispatchEvent(new Event('input', { bubbles: true }));
                });
            }
            announceSpellMessage('Undo completed.');
            rebuildSpellSessionIssues(spellSession);
            rerenderSpellDialog();
            return;
        }
        closeSpellDialog();
        announceEditorStatus('Spell check canceled.');
    };

    const buttonMap = [
        ['spellcheck-replace', 'replace'],
        ['spellcheck-replace-all', 'replaceAll'],
        ['spellcheck-ignore', 'ignore'],
        ['spellcheck-ignore-all', 'ignoreAll'],
        ['spellcheck-add-dictionary', 'addDictionary'],
        ['spellcheck-undo', 'undo'],
        ['spellcheck-cancel', 'cancel']
    ];
    buttonMap.forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button) {
            button.onclick = () => command(action);
        }
    });

    dialog.onkeydown = (event) => {
        if (!spellSession) return;
        const shortcut = editorEventToShortcut(event);
        const match = (action) => {
            const expected = getShortcutForAction(action);
            return expected && shortcut === expected;
        };
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'z') {
            event.preventDefault();
            command('undo');
            return;
        }
        if (match('spellReplace')) {
            event.preventDefault();
            command('replace');
            return;
        }
        if (match('spellReplaceAll')) {
            event.preventDefault();
            command('replaceAll');
            return;
        }
        if (match('spellIgnore')) {
            event.preventDefault();
            command('ignore');
            return;
        }
        if (match('spellIgnoreAll')) {
            event.preventDefault();
            command('ignoreAll');
            return;
        }
        if (match('spellAddToDictionary')) {
            event.preventDefault();
            command('addDictionary');
            return;
        }
        if (match('spellUndoLastCorrection')) {
            event.preventDefault();
            command('undo');
            return;
        }
        if (match('spellCancel') || event.key === 'Escape') {
            event.preventDefault();
            command('cancel');
        }
    };

    window.setTimeout(() => {
        replacementInput?.focus();
        replacementInput?.select();
    }, 0);
}

async function startSpellCheck() {
    announceEditorStatus('Loading spell check dictionary.');
    const engine = await ensureSpellDictionaryEngine();
    if (!engine) {
        announceEditorStatus('Using fallback spell check dictionary.');
    }

    const issues = collectSpellIssues(buildSpellIgnoreSet(new Set()));
    if (!issues.length) {
        announceEditorStatus('No spelling issues were found.');
        return;
    }
    spellSession = {
        issues,
        index: 0,
        ignoreAllWords: new Set(),
        history: []
    };
    rerenderSpellDialog();
}
export function activateAddEntryWorkflow() {
    if (!currentReportSupportsAuditEntries()) {
        announce('Add Entry is unavailable for the current report type.');
        return false;
    }

    const newIndex = addAuditEntry();
    pendingEntryFocus = { entryIndex: newIndex, fieldIndex: 0 };
    announce(`Added audit entry ${getAuditEntries().length}.`);
    return true;
}

function normalizeFieldType(type) {
    return type === 'select' ? 'dropdown' : type || 'text';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getEditorHeadingText() {
    if (!appState.editorUsesReportTitle) return 'Report Editor';
    return appState.reportTitle?.trim() || 'Report Editor';
}

function renderMetadataPlainText() {
    const metadata = [
        ['Report Title', appState.reportTitle],
        ['Organization/Client', appState.orgClient],
        ['Project Name', appState.projectName],
        ['URL / Scope', appState.scopeUrl],
        ['Audit Start', appState.auditDateStart],
        ['Audit End', appState.auditDateEnd],
        ['Auditor(s)', appState.auditors],
        ['Accessibility Standard', appState.standard],
        ['Testing Instructions', appState.testingInstructions],
        ['Report Type', appState.reportType],
        ['Report Layout', appState.reportLayout],
        ['Template Option', appState.templateOption],
        ['Template Name', appState.templateName],
        ['Template Description', appState.templateDescription]
    ];

    const visibleRows = metadata.filter(([, value]) => String(value || '').trim() !== '');
    if (visibleRows.length === 0) return '';

    return `
        <dl class="editor-metadata-list" aria-label="Report metadata values">
            ${visibleRows.map(([label, value]) => `
                <div class="editor-metadata-item">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${escapeHtml(value)}</dd>
                </div>
            `).join('')}
        </dl>
    `;
}

function getEntryFieldValue(entry, fieldIndex) {
    return entry?.fieldValues?.[fieldIndex] ?? '';
}

function renderWcagControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy) {
    const displayValue = typeof storedValue === 'object' ? formatWcagCriterionDisplay(storedValue) : String(storedValue || '');
    const inputId = `editor-field-${entryIndex}-${fieldIndex}`;
    if (readOnly) {
        return `<input type="text" id="${inputId}" value="${escapeHtml(displayValue)}" aria-labelledby="${escapeHtml(labelledBy)}" readonly aria-readonly="true">`;
    }

    return `
        <div class="wcag-combobox" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}">
            <input
                type="text"
                id="${inputId}"
                class="wcag-combobox-input"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-haspopup="listbox"
                aria-controls="${inputId}-listbox"
                aria-labelledby="${escapeHtml(labelledBy)}"
                aria-describedby="editor-select-help"
                autocomplete="off"
                value="${escapeHtml(displayValue)}"
            >
            <button type="button" class="wcag-combobox-toggle" aria-label="Show WCAG Success Criterion options for ${escapeHtml(field.label)}">Show options</button>
            <ul id="${inputId}-listbox" class="wcag-combobox-listbox" role="listbox" hidden></ul>
        </div>
    `;
}

function renderFieldControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy) {
    const type = normalizeFieldType(field.type);

    if (isWcagCriterionFieldType(type)) {
        return renderWcagControl(field, entryIndex, fieldIndex, storedValue, readOnly, labelledBy);
    }

    if (type === 'textarea') {
        return `<textarea id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}"${readOnly ? ' readonly aria-readonly="true"' : ''}>${escapeHtml(storedValue)}</textarea>`;
    }

    if (type === 'dropdown') {
        const options = Array.isArray(field.dropdownOptions) ? field.dropdownOptions : [];
        return `
            <select id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}" aria-describedby="editor-select-help" ${readOnly ? 'disabled aria-disabled="true"' : ''}>
                <option value="">Select an option</option>
                ${options.map((option) => {
                    const selected = String(storedValue) === String(option) ? 'selected' : '';
                    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
                }).join('')}
            </select>
        `;
    }

    return `<input type="text" id="editor-field-${entryIndex}-${fieldIndex}" data-entry-index="${entryIndex}" data-field-index="${fieldIndex}" aria-labelledby="${escapeHtml(labelledBy)}" value="${escapeHtml(storedValue)}"${readOnly ? ' readonly aria-readonly="true"' : ''}>`;
}

function updateEntryActionLabels(entryIndex) {
    const entryName = getAuditEntryDisplayName(entryIndex);
    const toggle = document.querySelector(`.btn-entry-toggle[data-entry-index="${entryIndex}"]`);
    const moveUp = document.querySelector(`.btn-entry-up[data-entry-index="${entryIndex}"]`);
    const moveDown = document.querySelector(`.btn-entry-down[data-entry-index="${entryIndex}"]`);
    const remove = document.querySelector(`.btn-entry-delete[data-entry-index="${entryIndex}"]`);

    if (toggle) {
        toggle.textContent = `Edit ${entryName}`;
        toggle.setAttribute('aria-label', `Edit ${entryName}`);
    }
    if (moveUp) moveUp.setAttribute('aria-label', `Move ${entryName} Up`);
    if (moveDown) moveDown.setAttribute('aria-label', `Move ${entryName} Down`);
    if (remove) remove.setAttribute('aria-label', `Delete ${entryName}`);
}

function attachWcagCombobox(control, criteria, entryIndex, fieldIndex) {
    const input = control.querySelector('.wcag-combobox-input');
    const toggle = control.querySelector('.wcag-combobox-toggle');
    const listbox = control.querySelector('.wcag-combobox-listbox');
    if (!input || !toggle || !listbox) return;

    let filtered = [...criteria];
    let activeIndex = -1;

    const commitSelection = (criterion) => {
        const structuredValue = {
            standard: criterion.standard,
            identifier: criterion.identifier,
            number: criterion.number,
            title: criterion.title,
            level: criterion.level,
            understandingUrl: criterion.understandingUrl,
            recommendationUrl: criterion.recommendationUrl
        };
        input.value = `${criterion.number} ${criterion.title}`;
        if (appState.reportType === 'Audit Log') {
            updateAuditEntryFieldValue(entryIndex, fieldIndex, structuredValue);
            if (fieldIndex === 0) updateEntryActionLabels(entryIndex);
        } else {
            updateEditorFieldValue(fieldIndex, structuredValue);
        }
        closeListbox();
    };

    const renderOptions = () => {
        listbox.innerHTML = filtered.map((criterion, optionIndex) => `
            <li
                id="${listbox.id}-option-${optionIndex}"
                role="option"
                aria-selected="${optionIndex === activeIndex ? 'true' : 'false'}"
                data-option-index="${optionIndex}"
            >${escapeHtml(`${criterion.number} ${criterion.title}`)}</li>
        `).join('');
    };

    const openListbox = () => {
        listbox.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        renderOptions();
    };

    function closeListbox() {
        listbox.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        activeIndex = -1;
    }

    const updateFilter = () => {
        const q = input.value.trim().toLowerCase();
        filtered = criteria.filter((criterion) => criterion.searchText.includes(q));
        activeIndex = filtered.length > 0 ? 0 : -1;
        renderOptions();
        if (filtered.length > 0) {
            openListbox();
            input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
        } else {
            closeListbox();
        }
    };

    const moveActive = (delta) => {
        if (filtered.length === 0) return;
        if (listbox.hidden) openListbox();
        activeIndex = activeIndex < 0 ? 0 : (activeIndex + delta + filtered.length) % filtered.length;
        renderOptions();
        input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
    };

    input.addEventListener('input', updateFilter);
    input.addEventListener('focus', () => {
        filtered = [...criteria];
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActive(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActive(-1);
            return;
        }
        if (event.key === 'Enter' && !listbox.hidden && activeIndex >= 0 && filtered[activeIndex]) {
            event.preventDefault();
            commitSelection(filtered[activeIndex]);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeListbox();
        }
    });

    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (!control.contains(document.activeElement)) closeListbox();
        }, 0);
    });

    toggle.addEventListener('click', () => {
        if (listbox.hidden) {
            filtered = [...criteria];
            activeIndex = filtered.length > 0 ? 0 : -1;
            openListbox();
            if (activeIndex >= 0) {
                input.setAttribute('aria-activedescendant', `${listbox.id}-option-${activeIndex}`);
            }
            input.focus();
            return;
        }
        closeListbox();
        input.focus();
    });

    listbox.addEventListener('mousedown', (event) => event.preventDefault());
    listbox.addEventListener('click', (event) => {
        const option = event.target.closest('[data-option-index]');
        if (!option) return;
        const optionIndex = Number(option.getAttribute('data-option-index'));
        if (filtered[optionIndex]) {
            commitSelection(filtered[optionIndex]);
            input.focus();
        }
    });
}

function getFocusableElements(dialog) {
    return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function closeModalDialog(restoreFocus = true) {
    if (!activeModalDialog) return;
    const { dialog, trigger } = activeModalDialog;
    dialog.hidden = true;
    activeModalDialog = null;
    if (restoreFocus && trigger) trigger.focus();
}

function openModalDialog(dialog, focusTarget, trigger) {
    activeModalDialog = { dialog, trigger };
    dialog.hidden = false;
    window.setTimeout(() => {
        if (focusTarget) {
            focusTarget.focus();
            return;
        }
        getFocusableElements(dialog)[0]?.focus();
    }, 0);
}

function trapModalFocus(event) {
    if (!activeModalDialog || activeModalDialog.dialog.hidden) return;
    const dialog = activeModalDialog.dialog;

    if (event.type === 'focusin') {
        if (!dialog.contains(event.target)) {
            getFocusableElements(dialog)[0]?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeModalDialog(true);
        return;
    }

    if (event.key !== 'Tab') return;
    const focusables = getFocusableElements(dialog);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first.focus();
    }
}

function renderMetadataEditDialog() {
    const descriptors = getMetadataDescriptors();
    const isBrandingEnabled = Boolean(appState.branding?.enabled);
    const groups = descriptors.reduce((acc, descriptor) => {
        const group = descriptor.groupLabel || 'Report Metadata';
        if (!acc[group]) acc[group] = [];
        acc[group].push(descriptor);
        return acc;
    }, {});

    const renderField = (descriptor) => {
        const id = `metadata-field-${descriptor.keyPath.replace(/\./g, '-')}`;
        const isBrandingExtra = descriptor.keyPath.startsWith('branding.') && descriptor.keyPath !== 'branding.enabled';
        const containerAttrs = isBrandingExtra
            ? ` data-branding-extra="true" ${isBrandingEnabled ? '' : 'hidden'}`
            : '';
        if (descriptor.inputType === 'textarea') {
            return `
                <div${containerAttrs}>
                    <label for="${id}">${escapeHtml(descriptor.label)}</label>
                    <textarea id="${id}" data-metadata-key="${descriptor.keyPath}">${escapeHtml(descriptor.value || '')}</textarea>
                </div>
            `;
        }
        if (descriptor.inputType === 'select') {
            return `
                <div${containerAttrs}>
                    <label for="${id}">${escapeHtml(descriptor.label)}</label>
                    <select id="${id}" data-metadata-key="${descriptor.keyPath}">
                        ${(descriptor.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(option) === String(descriptor.value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        if (descriptor.inputType === 'checkbox') {
            return `
                <div${containerAttrs}>
                    <label>
                        <input type="checkbox" id="${id}" data-metadata-key="${descriptor.keyPath}" ${descriptor.value ? 'checked' : ''}>
                        ${escapeHtml(descriptor.label)}
                    </label>
                </div>
            `;
        }
        return `
            <div${containerAttrs}>
                <label for="${id}">${escapeHtml(descriptor.label)}</label>
                <input type="${descriptor.inputType}" id="${id}" data-metadata-key="${descriptor.keyPath}" value="${escapeHtml(descriptor.value || '')}">
            </div>
        `;
    };

    return `
        <div id="editor-metadata-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-metadata-dialog-heading" aria-describedby="editor-metadata-dialog-desc" hidden>
            <h3 id="editor-metadata-dialog-heading">Edit Metadata</h3>
            <p id="editor-metadata-dialog-desc">Update report metadata values. Report fields, report type, layout, and templates are not changed here.</p>
            <div class="editor-metadata-dialog-grid">
                ${Object.entries(groups).map(([groupName, items]) => `
                    <fieldset>
                        <legend>${escapeHtml(groupName)}</legend>
                        ${items.map(renderField).join('')}
                    </fieldset>
                `).join('')}
            </div>
            <p id="editor-metadata-dialog-error" class="branding-error" role="status" aria-live="polite"></p>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-metadata-confirm" type="button">Confirm</button>
                <button id="btn-editor-metadata-cancel" type="button">Cancel</button>
            </div>
        </div>
    `;
}

function renderClearDialog() {
    return `
        <div id="editor-clear-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-clear-dialog-heading" aria-describedby="editor-clear-dialog-desc" hidden>
            <h3 id="editor-clear-dialog-heading">Clear Report</h3>
            <p id="editor-clear-dialog-desc">What would you like to clear?</p>

            <fieldset>
                <legend class="sr-only">Clear options</legend>
                <label>
                    <input type="radio" name="editor-clear-option" value="content" checked>
                    Clear report content only (recommended)
                </label>
                <p class="editor-clear-help">Removes all audit entries and entered field values while preserving report metadata, fields, report type, report layout, and template configuration.</p>

                <label>
                    <input type="radio" name="editor-clear-option" value="everything">
                    Clear everything
                </label>
                <p class="editor-clear-help">Removes report metadata, configured fields, report content, report type, and report layout, then returns to a blank configuration state.</p>
            </fieldset>

            <div class="viewer-dialog-actions">
                <button id="btn-editor-clear-confirm" type="button">Clear</button>
                <button id="btn-editor-clear-cancel" type="button">Cancel</button>
            </div>
        </div>
    `;
}

function renderValidationDialog() {
    return `
        <div id="editor-validation-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-validation-heading" aria-describedby="editor-validation-desc" hidden>
            <h3 id="editor-validation-heading">Validate Report</h3>
            <p id="editor-validation-desc">Review validation issues and activate an item to move to the related field.</p>
            <div id="editor-validation-results"></div>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-validation-close" type="button">Close</button>
            </div>
        </div>
    `;
}

function renderStatisticsDialog(metrics) {
    return `
        <div id="editor-statistics-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-statistics-heading" aria-describedby="editor-statistics-desc" hidden>
            <h3 id="editor-statistics-heading">Report Statistics</h3>
            <p id="editor-statistics-desc">Summary statistics for the current report.</p>
            <ul class="editor-statistics-list">
                <li>Total Audit Entries: ${metrics.totalAuditEntries}</li>
                <li>Total Issues: ${metrics.totalIssues}</li>
                <li>Issues by Severity: ${escapeHtml(metrics.issuesBySeverity)}</li>
                <li>Unique Pages Tested: ${metrics.pagesTested}</li>
                <li>WCAG Success Criteria Referenced: ${metrics.wcagCriteria}</li>
            </ul>
            <div class="viewer-dialog-actions">
                <button id="btn-editor-statistics-close" type="button">Close</button>
            </div>
        </div>
    `;
}

function renderEditorActionBar() {
    const addEntryDisabled = !currentReportSupportsAuditEntries();
    const spellCheckLabel = getSpellActionLabel('spellCheck', 'Spell Check');
    return `
        <div class="editor-action-bar" role="group" aria-label="Report editor actions">
            <button id="btn-add-entry" type="button" ${addEntryDisabled ? 'disabled aria-disabled="true"' : ''}>Add Entry</button>
            <button id="btn-editor-spell-check" type="button">${escapeHtml(spellCheckLabel)}</button>
            <button id="btn-editor-configure-report" type="button">Configure Report</button>
            <button id="btn-editor-validate-report" type="button">Validate Report</button>
            <button id="btn-editor-report-statistics" type="button">Report Statistics</button>
            <button id="btn-editor-view-report" type="button">View Report</button>
            <button id="btn-editor-print-preview" type="button">Print Preview</button>
            <button id="btn-editor-export-report" type="button">Export Report...</button>
            <button id="btn-editor-close-report" type="button">Close Report</button>
        </div>
    `;
}

function renderValidationResults(issues) {
    const results = document.getElementById('editor-validation-results');
    if (!results) return;
    if (!issues.length) {
        results.innerHTML = '<p>No validation issues found.</p>';
        return;
    }

    results.innerHTML = `
        <ul class="editor-validation-list">
            ${issues.map((issue, index) => `
                <li>
                    <button type="button" class="btn-validation-issue" data-issue-index="${index}">${escapeHtml(issue.message)}</button>
                </li>
            `).join('')}
        </ul>
    `;
}

function focusValidationTarget(issue) {
    if (!issue) return;
    if (issue.targetType === 'metadata') {
        const editMetadataButton = document.getElementById('btn-edit-metadata');
        editMetadataButton?.click();
        window.setTimeout(() => {
            const target = document.querySelector(`[data-metadata-key="${issue.target}"]`);
            target?.focus();
        }, 0);
        return;
    }

    if (issue.targetType === 'builder') {
        const builderTab = document.getElementById('tab-builder');
        builderTab?.click();
        window.setTimeout(() => {
            const target = document.getElementById(issue.target || 'builder-heading');
            target?.focus();
        }, 0);
        return;
    }

    const target = document.getElementById(issue.target);
    if (target) {
        target.focus();
    }
}

function renderAuditTable(criteria) {
    ensureAuditEntries();
    const entries = getAuditEntries();
    const fields = appState.fields || [];

    return `
        <section aria-labelledby="audit-table-heading">
            <h3 id="audit-table-heading">Audit Entries</h3>
            <div class="editor-table-wrapper">
                <table class="editor-audit-table">
                    <thead>
                        <tr>
                            ${fields.map((field, fieldIndex) => `<th scope="col" id="audit-col-${fieldIndex}">${escapeHtml(field.label)}</th>`).join('')}
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.map((entry, entryIndex) => {
                            const entryName = getAuditEntryDisplayName(entryIndex);
                            const actionsPanelId = `entry-actions-${entryIndex}`;
                            return `
                                <tr>
                                    ${fields.map((field, fieldIndex) => `
                                        <td headers="audit-col-${fieldIndex}">
                                            ${renderFieldControl(field, entryIndex, fieldIndex, getEntryFieldValue(entry, fieldIndex), appState.editorReadOnly, `audit-col-${fieldIndex}`)}
                                        </td>
                                    `).join('')}
                                    <td>
                                        <button
                                            type="button"
                                            class="btn-entry-toggle"
                                            data-entry-index="${entryIndex}"
                                            aria-label="Edit ${escapeHtml(entryName)}"
                                            aria-expanded="false"
                                            aria-controls="${actionsPanelId}"
                                        >Edit ${escapeHtml(entryName)}</button>
                                        <div id="${actionsPanelId}" class="entry-actions-menu" hidden>
                                            <button type="button" class="btn-entry-up" data-entry-index="${entryIndex}" aria-label="Move ${escapeHtml(entryName)} Up" ${entryIndex === 0 ? 'disabled' : ''}>Move Up</button>
                                            <button type="button" class="btn-entry-down" data-entry-index="${entryIndex}" aria-label="Move ${escapeHtml(entryName)} Down" ${entryIndex === entries.length - 1 ? 'disabled' : ''}>Move Down</button>
                                            <button type="button" class="btn-entry-delete" data-entry-index="${entryIndex}" aria-label="Delete ${escapeHtml(entryName)}">Delete Entry</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div id="entry-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="entry-delete-heading" aria-describedby="entry-delete-message" hidden>
                <h3 id="entry-delete-heading">Delete Entry?</h3>
                <p id="entry-delete-message"></p>
                <button id="btn-entry-delete-confirm" type="button">Confirm</button>
                <button id="btn-entry-delete-cancel" type="button">Cancel</button>
            </div>
        </section>
    `;
}

function renderSingleEntryEditor() {
    return `
        <div class="editor-fields-grid">
            ${appState.fields.map((field, index) => {
                const labelId = `editor-field-label-${index}`;
                const labelAttrs = isWcagCriterionFieldType(field.type)
                    ? `id="${labelId}"`
                    : `id="${labelId}" for="editor-field-0-${index}"`;
                return `
                    <label ${labelAttrs}>${escapeHtml(field.label)}</label>
                    ${renderFieldControl(field, 0, index, appState.editorFieldValues[index] ?? '', appState.editorReadOnly, labelId)}
                `;
            }).join('')}
        </div>
    `;
}

function focusPendingEntryControl() {
    if (!pendingEntryFocus) return false;
    const { entryIndex, fieldIndex } = pendingEntryFocus;
    let target = document.getElementById(`editor-field-${entryIndex}-${fieldIndex}`);
    if (!target) {
        target = document.querySelector('.editor-audit-table tbody tr:last-child [data-field-index="0"]')
            || document.querySelector('.editor-audit-table tbody tr:last-child .wcag-combobox-input')
            || document.querySelector('.editor-audit-table tbody tr:last-child .btn-entry-toggle');
    }
    pendingEntryFocus = null;
    if (target) {
        window.setTimeout(() => {
            target.focus();
        }, 0);
        return true;
    }
    return false;
}

function bindAuditTableEvents(criteria) {
    const container = document.getElementById('main-inner');
    if (!container) return;

    const addEntryButton = document.getElementById('btn-add-entry');
    if (addEntryButton) {
        addEntryButton.addEventListener('click', () => {
            if (!activateAddEntryWorkflow()) return;
            renderEditor();
        });
    }

    container.querySelectorAll('.btn-entry-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const entryIndex = button.getAttribute('data-entry-index');
            const panel = document.getElementById(button.getAttribute('aria-controls'));
            if (!panel) return;
            const expanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            panel.hidden = expanded;
            if (!expanded) {
                panel.querySelector('button:not([disabled])')?.focus();
            }
        });
    });

    container.querySelectorAll('.btn-entry-up').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            const movedTo = moveAuditEntry(index, -1);
            if (movedTo === null) return;
            const movedLabel = getAuditEntryDisplayName(movedTo);
            pendingEntryFocus = { entryIndex: movedTo, fieldIndex: 0 };
            renderEditor();
            const announcer = document.getElementById('announcer');
            if (announcer) announcer.textContent = `Moved before ${movedLabel}`;
        });
    });

    container.querySelectorAll('.btn-entry-down').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            const movedTo = moveAuditEntry(index, 1);
            if (movedTo === null) return;
            const movedLabel = getAuditEntryDisplayName(movedTo);
            pendingEntryFocus = { entryIndex: movedTo, fieldIndex: 0 };
            renderEditor();
            const announcer = document.getElementById('announcer');
            if (announcer) announcer.textContent = `Moved after ${movedLabel}`;
        });
    });

    const deleteDialog = document.getElementById('entry-delete-dialog');
    const deleteMessage = document.getElementById('entry-delete-message');
    const deleteConfirm = document.getElementById('btn-entry-delete-confirm');
    const deleteCancel = document.getElementById('btn-entry-delete-cancel');

    container.querySelectorAll('.btn-entry-delete').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-entry-index'));
            pendingDeleteEntry = { index, triggerId: `entry-delete-trigger-${index}` };
            button.id = pendingDeleteEntry.triggerId;
            if (deleteMessage) {
                deleteMessage.innerHTML = `Are you sure you want to delete the <strong>${escapeHtml(getAuditEntryDisplayName(index))}</strong> entry?<br>This action cannot be undone.`;
            }
            if (deleteDialog) {
                openModalDialog(deleteDialog, deleteConfirm, button);
            }
        });
    });

    const closeDeleteDialog = (restoreFocus) => {
        closeModalDialog(restoreFocus);
        pendingDeleteEntry = null;
    };

    deleteCancel?.addEventListener('click', () => closeDeleteDialog(true));

    deleteConfirm?.addEventListener('click', () => {
        if (!pendingDeleteEntry) return;
        const deletedIndex = pendingDeleteEntry.index;
        deleteAuditEntry(deletedIndex);
        closeDeleteDialog(false);
        renderEditor();
        const nextIndex = Math.min(deletedIndex, Math.max(0, getAuditEntries().length - 1));
        window.setTimeout(() => {
            const nextDeleteButton = document.querySelector(`.btn-entry-delete[data-entry-index="${nextIndex}"]`);
            if (nextDeleteButton) nextDeleteButton.focus();
        }, 0);
    });

    container.querySelectorAll('[data-entry-index][data-field-index]').forEach((control) => {
        if (control.classList.contains('wcag-combobox')) {
            const entryIndex = Number(control.getAttribute('data-entry-index'));
            const fieldIndex = Number(control.getAttribute('data-field-index'));
            attachWcagCombobox(control, criteria, entryIndex, fieldIndex);
            return;
        }
        const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
        control.addEventListener(eventName, (event) => {
            const entryIndex = Number(event.target.getAttribute('data-entry-index'));
            const fieldIndex = Number(event.target.getAttribute('data-field-index'));
            updateAuditEntryFieldValue(entryIndex, fieldIndex, event.target.value);
            if (fieldIndex === 0) updateEntryActionLabels(entryIndex);
        });
    });
}

function bindEditorDialogEvents() {
    const editMetadataButton = document.getElementById('btn-edit-metadata');
    const clearReportButton = document.getElementById('btn-clear-report-data');
    const configureReportButton = document.getElementById('btn-editor-configure-report');
    const spellCheckButton = document.getElementById('btn-editor-spell-check');
    const validateReportButton = document.getElementById('btn-editor-validate-report');
    const reportStatisticsButton = document.getElementById('btn-editor-report-statistics');
    const viewReportButton = document.getElementById('btn-editor-view-report');
    const printPreviewButton = document.getElementById('btn-editor-print-preview');
    const exportReportButton = document.getElementById('btn-editor-export-report');
    const closeReportButton = document.getElementById('btn-editor-close-report');
    const metadataDialog = document.getElementById('editor-metadata-dialog');
    const clearDialog = document.getElementById('editor-clear-dialog');
    const validationDialog = document.getElementById('editor-validation-dialog');
    const statisticsDialog = document.getElementById('editor-statistics-dialog');
    const metadataConfirm = document.getElementById('btn-editor-metadata-confirm');
    const metadataCancel = document.getElementById('btn-editor-metadata-cancel');
    const clearConfirm = document.getElementById('btn-editor-clear-confirm');
    const clearCancel = document.getElementById('btn-editor-clear-cancel');
    const validationClose = document.getElementById('btn-editor-validation-close');
    const statisticsClose = document.getElementById('btn-editor-statistics-close');
    const metadataError = document.getElementById('editor-metadata-dialog-error');
    const brandingEnabledField = document.getElementById('metadata-field-branding-enabled');

    if (!editMetadataButton || !clearReportButton || !metadataDialog || !clearDialog || !metadataConfirm || !metadataCancel || !clearConfirm || !clearCancel || !validationDialog || !statisticsDialog || !validationClose || !statisticsClose) return;

    const syncMetadataBrandingVisibility = () => {
        const enabled = Boolean(brandingEnabledField?.checked);
        metadataDialog.querySelectorAll('[data-branding-extra="true"]').forEach((section) => {
            section.hidden = !enabled;
            section.querySelectorAll('input, select, textarea, button').forEach((input) => {
                input.disabled = !enabled;
            });
        });
    };

    brandingEnabledField?.addEventListener('change', syncMetadataBrandingVisibility);
    syncMetadataBrandingVisibility();

    editMetadataButton.addEventListener('click', () => {
        const firstField = metadataDialog.querySelector('[data-metadata-key]');
        openModalDialog(metadataDialog, firstField, editMetadataButton);
    });

    clearReportButton.addEventListener('click', () => {
        const firstRadio = clearDialog.querySelector('input[name="editor-clear-option"]');
        openModalDialog(clearDialog, firstRadio, clearReportButton);
    });

    configureReportButton?.addEventListener('click', () => {
        upsertCurrentReport({ name: appState.reportTitle || appState.templateName || 'Untitled Report' });
        const builderTab = document.getElementById('tab-builder');
        builderTab?.click();
        window.setTimeout(() => {
            document.getElementById('builder-heading')?.focus();
        }, 0);
    });

    spellCheckButton?.addEventListener('click', () => {
        startSpellCheck();
    });

    validateReportButton?.addEventListener('click', () => {
        const issues = validateCurrentReport();
        renderValidationResults(issues);
        validationDialog.querySelectorAll('.btn-validation-issue').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.getAttribute('data-issue-index'));
                const issue = issues[index];
                closeModalDialog(false);
                window.setTimeout(() => focusValidationTarget(issue), 0);
            });
        });
        openModalDialog(validationDialog, validationClose, validateReportButton);
    });

    reportStatisticsButton?.addEventListener('click', () => {
        openModalDialog(statisticsDialog, statisticsClose, reportStatisticsButton);
    });

    viewReportButton?.addEventListener('click', () => {
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
        window.setTimeout(() => document.getElementById('viewer-heading')?.focus(), 0);
    });

    printPreviewButton?.addEventListener('click', () => {
        requestViewerPrintPreview();
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
    });

    exportReportButton?.addEventListener('click', () => {
        requestViewerExportDialog();
        const viewerTab = document.getElementById('tab-view');
        viewerTab?.click();
    });

    closeReportButton?.addEventListener('click', () => {
        upsertCurrentReport({ name: appState.reportTitle || appState.templateName || 'Untitled Report' });
        const welcomeTab = document.getElementById('tab-welcome');
        welcomeTab?.click();
        window.setTimeout(() => {
            const heading = document.getElementById('dash-heading');
            if (!heading) return;
            if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
            heading.focus();
        }, 0);
    });

    metadataCancel.addEventListener('click', () => closeModalDialog(true));
    clearCancel.addEventListener('click', () => closeModalDialog(true));
    validationClose.addEventListener('click', () => closeModalDialog(true));
    statisticsClose.addEventListener('click', () => closeModalDialog(true));

    metadataConfirm.addEventListener('click', () => {
        const values = {};
        metadataDialog.querySelectorAll('[data-metadata-key]').forEach((field) => {
            const key = field.getAttribute('data-metadata-key');
            if (!key) return;
            if (field.type === 'checkbox') {
                values[key] = field.checked;
                return;
            }
            values[key] = field.value;
        });
        const draft = buildMetadataDraftFromValues(values);
        const validation = validateMetadataDraft(draft);
        if (!validation.isValid) {
            if (metadataError) metadataError.textContent = validation.message;
            const altField = metadataDialog.querySelector('[data-metadata-key="branding.logoAltText"]');
            altField?.focus();
            return;
        }
        applyMetadataDraft(draft);
        closeModalDialog(false);
        pendingEditorFocusTargetId = 'btn-edit-metadata';
        renderEditor();
    });

    clearConfirm.addEventListener('click', () => {
        const selected = clearDialog.querySelector('input[name="editor-clear-option"]:checked')?.value || 'content';
        if (selected === 'everything') {
            clearReportEverythingInSession();
            closeModalDialog(false);
            const builderTab = document.getElementById('tab-builder');
            if (builderTab) builderTab.click();
            window.setTimeout(() => {
                document.getElementById('builder-heading')?.focus();
            }, 0);
            return;
        }

        clearReportContentOnly();
        closeModalDialog(false);
        pendingEntryFocus = { entryIndex: 0, fieldIndex: 0 };
        renderEditor();
    });

    if (!areModalListenersBound) {
        document.addEventListener('keydown', trapModalFocus);
        document.addEventListener('focusin', trapModalFocus);
        areModalListenersBound = true;
    }
}

export async function renderEditor() {
    const container = document.getElementById('main-inner');
    const activeElementBeforeRender = document.activeElement;
    const preserveFocusId = activeElementBeforeRender && container?.contains(activeElementBeforeRender)
        ? String(activeElementBeforeRender.id || '')
        : '';
    const editorHeading = getEditorHeadingText();
    const wcagCriteria = await getWcagCriteriaForStandard(appState.standard).catch(() => []);

    const isAuditLog = appState.reportType === 'Audit Log';
    if (isAuditLog) ensureAuditEntries();

    container.innerHTML = `
        <section id="editor-view" aria-labelledby="editor-heading">
            <h2 id="editor-heading" tabindex="-1">${escapeHtml(editorHeading)}</h2>
            <div id="editor-instructions" class="editor-instructions">
                <p>Fill in the audit report fields in the table.</p>
                <p>Use Add Entry to create another audit entry.</p>
                <p>Use Edit Entry to open options for moving or deleting entries.</p>
            </div>
            <p id="editor-select-help" class="sr-only">Use arrow keys to review select options.</p>
            ${renderMetadataPlainText()}
            <button id="btn-edit-metadata" type="button">Edit Metadata...</button>
            ${isAuditLog ? renderAuditTable(wcagCriteria) : renderSingleEntryEditor()}
            ${renderEditorActionBar()}
            <button id="btn-clear-report-data" type="button">Clear Report Data...</button>
            ${renderMetadataEditDialog()}
            ${renderClearDialog()}
            ${renderValidationDialog()}
            ${renderStatisticsDialog(getCurrentReportMetrics())}
            <div id="editor-spellcheck-dialog" role="dialog" aria-modal="true" aria-labelledby="spellcheck-title" hidden></div>
        </section>
    `;

    const headingAfterRender = document.getElementById('editor-heading');

    let didApplyPendingEntryFocus = false;

    if (isAuditLog) {
        bindAuditTableEvents(wcagCriteria);
        didApplyPendingEntryFocus = focusPendingEntryControl();
    } else {
        container.querySelectorAll('[data-entry-index][data-field-index]').forEach((control) => {
            if (control.classList.contains('wcag-combobox')) {
                const entryIndex = Number(control.getAttribute('data-entry-index'));
                const fieldIndex = Number(control.getAttribute('data-field-index'));
                const label = document.getElementById(`editor-field-label-${fieldIndex}`);
                const input = control.querySelector('.wcag-combobox-input');
                if (input && label) input.setAttribute('aria-labelledby', label.id);
                attachWcagCombobox(control, wcagCriteria, entryIndex, fieldIndex);
                return;
            }
            const eventName = control.tagName.toLowerCase() === 'select' ? 'change' : 'input';
            control.addEventListener(eventName, (event) => {
                const fieldIndex = Number(event.target.getAttribute('data-field-index'));
                updateEditorFieldValue(fieldIndex, event.target.value);
            });
        });
    }

    bindEditorDialogEvents();

    if (pendingEditorFocusTargetId) {
        const target = document.getElementById(pendingEditorFocusTargetId);
        pendingEditorFocusTargetId = '';
        if (target) {
            window.setTimeout(() => {
                target.focus();
            }, 0);
        }
    } else if (preserveFocusId && !didApplyPendingEntryFocus) {
        const preserved = document.getElementById(preserveFocusId);
        if (preserved) {
            window.setTimeout(() => {
                preserved.focus();
            }, 0);
            return;
        }
    }

    if (headingAfterRender && !pendingEntryFocus && !didApplyPendingEntryFocus) {
        window.setTimeout(() => {
            headingAfterRender.focus();
        }, 0);
    }

}
