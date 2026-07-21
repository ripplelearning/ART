import {
    addProgressItem,
    announce,
    getDefaultProgressItemTypes,
    getProgressItems,
    getProgressStatuses,
    isProgressLogEnabled,
    removeProgressItem,
    updateProgressItem,
    updateProgressItemStatus
} from './state.js';

let dialogBound = false;
let dialogOpen = false;
let editMode = false;
let lastTrigger = null;
let pendingFocusSelector = '';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isExternalHttpUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function formatDateTime(value, fallback) {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleString();
}

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function buildProgressNameMarkup(item) {
    const name = escapeHtml(item.name || 'Untitled Evaluation Item');
    const location = String(item.location || '').trim();
    if (!isExternalHttpUrl(location)) {
        return name;
    }

    return `<a href="${escapeHtml(location)}" target="_blank" rel="noopener noreferrer" aria-label="${name} opens in new tab">${name}</a> <span class="progress-log-link-note">(opens in new tab)</span>`;
}

function ensureDialog() {
    let dialog = document.getElementById('progress-log-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'progress-log-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'progress-log-heading');
        dialog.setAttribute('aria-describedby', 'progress-log-description');
        dialog.hidden = true;
        document.body.appendChild(dialog);
    }
    return dialog;
}

function renderDialog() {
    const dialog = ensureDialog();
    const items = getProgressItems();
    const typeSuggestions = getDefaultProgressItemTypes();
    const statuses = getProgressStatuses();

    dialog.innerHTML = `
        <div class="progress-log-header">
            <h3 id="progress-log-heading">Accessibility Evaluation Progress Log</h3>
            <button id="btn-progress-log-close" type="button">Close</button>
        </div>
        <p id="progress-log-description">Manage evaluation items, update internal accessibility testing progress, and keep workflow information separate from report findings.</p>
        <div class="progress-log-actions" role="group" aria-label="Progress log actions">
            <button id="btn-progress-log-toggle-edit" type="button">${editMode ? 'Done Editing' : 'Enable Edit Mode'}</button>
            <button id="btn-progress-log-add" type="button">Add Evaluation Item</button>
        </div>
        ${!isProgressLogEnabled() ? '<p>Progress Log is not enabled for this report.</p>' : ''}
        ${isProgressLogEnabled() ? `
            <div class="progress-log-table-wrapper">
                <table class="progress-log-table">
                    <caption class="sr-only">Progress Log evaluation items</caption>
                    <thead>
                        <tr>
                            <th scope="col">Evaluation Item Name</th>
                            <th scope="col">Type</th>
                            <th scope="col">URL/Location</th>
                            <th scope="col">Status</th>
                            <th scope="col">Notes</th>
                            <th scope="col">Findings Count</th>
                            <th scope="col">Assigned Tester</th>
                            <th scope="col">Date Started</th>
                            <th scope="col">Date Completed</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.length === 0 ? `
                            <tr>
                                <td colspan="10">No evaluation items have been added yet.</td>
                            </tr>
                        ` : items.map((item) => `
                            <tr data-progress-item-id="${escapeHtml(item.id)}">
                                <td>${editMode
                                    ? `<input type="text" data-progress-field="name" value="${escapeHtml(item.name)}">`
                                    : buildProgressNameMarkup(item)}</td>
                                <td>${editMode
                                    ? `<input type="text" data-progress-field="type" list="progress-log-type-list" value="${escapeHtml(item.type)}">`
                                    : escapeHtml(item.type)}</td>
                                <td>${editMode
                                    ? `<input type="text" data-progress-field="location" value="${escapeHtml(item.location)}">`
                                    : (isExternalHttpUrl(item.location)
                                        ? `<a href="${escapeHtml(item.location)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(item.location)} in new tab">${escapeHtml(item.location)}</a>`
                                        : escapeHtml(item.location || ''))}</td>
                                <td>${editMode
                                    ? `<span>${escapeHtml(item.status)}</span>`
                                    : `<select data-progress-status aria-label="Status for ${escapeHtml(item.name || 'evaluation item')}">${statuses.map((status) => `<option value="${escapeHtml(status)}" ${item.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select>`}</td>
                                <td>${editMode
                                    ? `<textarea data-progress-field="notes">${escapeHtml(item.notes)}</textarea>`
                                    : `<div class="progress-log-notes">${escapeHtml(item.notes)}</div>`}</td>
                                <td>${editMode
                                    ? `<input type="number" min="0" step="1" data-progress-field="findingsCount" value="${escapeHtml(item.findingsCount)}">`
                                    : escapeHtml(item.findingsCount)}</td>
                                <td>${editMode
                                    ? `<input type="text" data-progress-field="assignedTester" value="${escapeHtml(item.assignedTester)}">`
                                    : escapeHtml(item.assignedTester)}</td>
                                <td>${escapeHtml(formatDateTime(item.dateStarted, 'Not started'))}</td>
                                <td>${escapeHtml(formatDateTime(item.dateCompleted, 'Not completed'))}</td>
                                <td><button type="button" data-progress-action="remove">Remove</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <datalist id="progress-log-type-list">
                ${typeSuggestions.map((type) => `<option value="${escapeHtml(type)}"></option>`).join('')}
            </datalist>
        ` : ''}
    `;

    bindDialogEvents(dialog);

    if (pendingFocusSelector) {
        const target = dialog.querySelector(pendingFocusSelector);
        pendingFocusSelector = '';
        target?.focus();
    }
}

function closeDialog(restoreFocus = true) {
    const dialog = ensureDialog();
    dialog.hidden = true;
    dialogOpen = false;
    editMode = false;
    pendingFocusSelector = '';
    if (restoreFocus && lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
    }
}

function trapDialogFocus(event) {
    if (!dialogOpen) return;
    const dialog = ensureDialog();
    if (dialog.hidden) return;

    if (event.type === 'focusin') {
        if (!dialog.contains(event.target)) {
            getFocusableElements(dialog)[0]?.focus();
        }
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(true);
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

function bindDialogEvents(dialog) {
    dialog.querySelector('#btn-progress-log-close')?.addEventListener('click', () => closeDialog(true));
    dialog.querySelector('#btn-progress-log-toggle-edit')?.addEventListener('click', () => {
        editMode = !editMode;
        announce(editMode
            ? 'Edit mode enabled. Evaluation item information can now be modified.'
            : 'Editing complete. Evaluation statuses are available.');
        pendingFocusSelector = '#btn-progress-log-toggle-edit';
        renderDialog();
    });

    dialog.querySelector('#btn-progress-log-add')?.addEventListener('click', () => {
        const nextIndex = getProgressItems().length + 1;
        const created = addProgressItem({ name: `Evaluation Item ${nextIndex}`, type: getDefaultProgressItemTypes()[0] });
        editMode = true;
        pendingFocusSelector = `[data-progress-item-id="${created.id}"] [data-progress-field="name"]`;
        announce(`Added evaluation item ${nextIndex}.`);
        renderDialog();
    });

    dialog.querySelectorAll('[data-progress-item-id]').forEach((row) => {
        const itemId = row.getAttribute('data-progress-item-id');
        if (!itemId) return;

        row.querySelectorAll('[data-progress-field]').forEach((field) => {
            const key = field.getAttribute('data-progress-field');
            const eventName = field.tagName.toLowerCase() === 'textarea' ? 'input' : 'change';
            field.addEventListener(eventName, (event) => {
                const value = event.target.type === 'number' ? Number(event.target.value || 0) : event.target.value;
                updateProgressItem(itemId, { [key]: value });
            });
        });

        row.querySelector('[data-progress-status]')?.addEventListener('change', (event) => {
            updateProgressItemStatus(itemId, event.target.value);
            pendingFocusSelector = `[data-progress-item-id="${itemId}"] [data-progress-status]`;
            renderDialog();
        });

        row.querySelector('[data-progress-action="remove"]')?.addEventListener('click', () => {
            const removed = removeProgressItem(itemId);
            if (!removed) return;
            announce(`Removed evaluation item ${removed.name || removed.id}.`);
            pendingFocusSelector = '#btn-progress-log-add';
            renderDialog();
        });
    });

    if (!dialogBound) {
        document.addEventListener('keydown', trapDialogFocus);
        document.addEventListener('focusin', trapDialogFocus);
        dialogBound = true;
    }
}

export function openProgressLogDialog(trigger) {
    lastTrigger = trigger || document.activeElement;
    const dialog = ensureDialog();
    dialog.hidden = false;
    dialogOpen = true;
    renderDialog();
    window.setTimeout(() => {
        dialog.querySelector('#btn-progress-log-close')?.focus();
    }, 0);
    announce('Progress Log available.');
}

export function isProgressLogDialogOpen() {
    return dialogOpen;
}