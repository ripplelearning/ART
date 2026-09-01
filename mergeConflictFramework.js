import { announce, saveState } from './state.js';

export const MERGE_STATES = Object.freeze({ NONE: 'none', DETECTED: 'detected', RESOLUTION_REQUIRED: 'resolution-required', RESOLVED: 'resolved' });

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

export function threeWayMerge(base = {}, local = {}, incoming = {}) {
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(incoming || {})]);
    const merged = {};
    const conflicts = [];
    const automaticChanges = [];
    keys.forEach((key) => {
        const baseValue = base?.[key];
        const localValue = local?.[key];
        const incomingValue = incoming?.[key];
        if (equal(localValue, incomingValue)) { merged[key] = clone(localValue); return; }
        if (equal(localValue, baseValue)) { merged[key] = clone(incomingValue); automaticChanges.push(key); return; }
        if (equal(incomingValue, baseValue)) { merged[key] = clone(localValue); automaticChanges.push(key); return; }
        conflicts.push({ id: `merge-field-${key}`, field: key, base: clone(baseValue), local: clone(localValue), incoming: clone(incomingValue) });
        merged[key] = clone(baseValue);
    });
    return { state: conflicts.length ? MERGE_STATES.RESOLUTION_REQUIRED : MERGE_STATES.RESOLVED, merged, conflicts, automaticChanges };
}

export function mergeEntityCollections(base = [], local = [], incoming = [], idKey = 'id') {
    const index = (entries) => new Map((Array.isArray(entries) ? entries : []).filter(Boolean).map((entry) => [String(entry[idKey]), entry]));
    const baseMap = index(base); const localMap = index(local); const incomingMap = index(incoming);
    const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...incomingMap.keys()]);
    const merged = []; const conflicts = [];
    ids.forEach((id) => {
        const result = threeWayMerge(baseMap.get(id) || {}, localMap.get(id) || {}, incomingMap.get(id) || {});
        if (result.conflicts.length) conflicts.push(...result.conflicts.map((conflict) => ({ ...conflict, entityId: id })));
        if (Object.keys(result.merged).length) merged.push(result.merged);
    });
    return { state: conflicts.length ? MERGE_STATES.RESOLUTION_REQUIRED : MERGE_STATES.RESOLVED, merged, conflicts };
}

let dialogState = null;
function ensureDialog() {
    if (dialogState?.dialog instanceof HTMLElement) return dialogState;
    const dialog = document.createElement('div');
    dialog.id = 'merge-conflict-dialog'; dialog.className = 'command-palette-dialog'; dialog.hidden = true;
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'merge-conflict-heading');
    document.body.appendChild(dialog); dialogState = { dialog, opener: null, result: null }; return dialogState;
}

export function openMergeConflictDialog(result, onApply, opener = null) {
    const state = ensureDialog(); state.opener = opener; state.result = result;
    const conflicts = result?.conflicts || [];
    state.dialog.innerHTML = `<div class="command-palette-header"><button id="btn-merge-cancel" type="button">Cancel</button><h2 id="merge-conflict-heading">Merge Conflict Resolution</h2></div><p id="merge-conflict-status" role="status" aria-live="polite">${conflicts.length} field conflict${conflicts.length === 1 ? '' : 's'} require resolution. Non-conflicting changes were prepared automatically.</p><div role="tablist" aria-label="Merge conflict views"><button type="button" role="tab" aria-selected="true" tabindex="0">Conflict Summary</button></div><div role="tabpanel" tabindex="0">${conflicts.map((conflict) => `<fieldset data-merge-conflict-id="${escapeHtml(conflict.id)}"><legend>${escapeHtml(conflict.entityId ? `${conflict.entityId}: ${conflict.field}` : conflict.field)}</legend><p>Original: ${escapeHtml(JSON.stringify(conflict.base))}</p><label><input type="radio" name="${escapeHtml(conflict.id)}" value="local" checked> Keep my version: ${escapeHtml(JSON.stringify(conflict.local))}</label><label><input type="radio" name="${escapeHtml(conflict.id)}" value="incoming"> Keep other version: ${escapeHtml(JSON.stringify(conflict.incoming))}</label></fieldset>`).join('')}</div><div class="viewer-dialog-actions"><button id="btn-merge-apply" type="button">Apply Merge</button></div>`;
    state.dialog.hidden = false;
    state.dialog.querySelector('#btn-merge-cancel')?.addEventListener('click', () => closeMergeConflictDialog(true));
    state.dialog.querySelector('#btn-merge-apply')?.addEventListener('click', () => {
        const merged = clone(result.merged);
        conflicts.forEach((conflict) => { const choice = state.dialog.querySelector(`input[name="${CSS.escape(conflict.id)}"]:checked`)?.value; merged[conflict.field] = clone(choice === 'incoming' ? conflict.incoming : conflict.local); });
        onApply?.(merged); saveState({ action: 'Applied merge conflict resolution' }); announce('Merge conflict resolved. The merged result was applied.'); closeMergeConflictDialog(true);
    });
    state.dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeMergeConflictDialog(true); } }, { once: true });
    state.dialog.querySelector('#btn-merge-cancel')?.focus(); return true;
}
export function closeMergeConflictDialog(restoreFocus = true) { if (!dialogState) return false; dialogState.dialog.hidden = true; if (restoreFocus && dialogState.opener?.focus) dialogState.opener.focus(); return true; }
