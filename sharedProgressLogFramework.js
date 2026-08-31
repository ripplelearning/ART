import {
    addSharedProgressComment,
    addSharedProgressTask,
    announce,
    createSharedProgressLog,
    getRecentReports,
    getSharedProgressLog,
    getSharedProgressLogs,
    setSharedProgressLogReportAssociations,
    updateSharedProgressTask
} from './state.js';

let dialogState = null;
let pendingFocusSelector = '';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getStatusLabel(log, statusId) {
    return log.statuses.find((status) => status.id === statusId)?.label || 'Not Started';
}

function ensureDialog() {
    if (dialogState?.dialog instanceof HTMLElement) return dialogState;

    let dialog = document.getElementById('shared-progress-log-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'shared-progress-log-dialog';
        dialog.className = 'command-palette-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'shared-progress-log-heading');
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="command-palette-header">
                <button id="btn-shared-progress-log-close" type="button">Close</button>
                <h2 id="shared-progress-log-heading">Shared Progress Logs</h2>
            </div>
            <p id="shared-progress-log-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <label for="shared-progress-log-select">Progress Log</label>
            <select id="shared-progress-log-select"></select>
            <div class="viewer-dialog-actions" role="group" aria-label="Shared Progress Log actions">
                <button id="btn-shared-progress-log-create" type="button">Create Progress Log</button>
                <button id="btn-shared-progress-task-add" type="button">Add Task</button>
            </div>
            <div id="shared-progress-log-content"></div>
        `;
        document.body.appendChild(dialog);
    }

    dialogState = { dialog, lastTrigger: null };
    bindDialog(dialog);
    return dialogState;
}

function renderDialog() {
    const state = ensureDialog();
    const { dialog } = state;
    const focusId = dialog.contains(document.activeElement) ? String(document.activeElement.id || '') : '';
    const logs = getSharedProgressLogs();
    const select = dialog.querySelector('#shared-progress-log-select');
    const priorId = select?.value || '';
    if (select instanceof HTMLSelectElement) {
        select.innerHTML = logs.length
            ? logs.map((log) => `<option value="${escapeHtml(log.id)}">${escapeHtml(log.name)}</option>`).join('')
            : '<option value="">No shared Progress Logs</option>';
        select.value = logs.some((log) => log.id === priorId) ? priorId : (logs[0]?.id || '');
    }

    const log = getSharedProgressLog(select?.value) || logs[0] || null;
    const content = dialog.querySelector('#shared-progress-log-content');
    const status = dialog.querySelector('#shared-progress-log-status');
    if (!log || !content) {
        if (content) content.innerHTML = '<p>Create a local Shared Progress Log to track tasks across one or more reports.</p>';
        if (status) status.textContent = 'Local/file-based Progress Logs are available. Server synchronization requires a future authenticated collaboration service.';
        return;
    }

    const reports = getRecentReports();

    const selector = pendingFocusSelector || (focusId ? `#${CSS.escape(focusId)}` : '');
    pendingFocusSelector = '';
    if (selector) {
        window.setTimeout(() => dialog.querySelector(selector)?.focus(), 0);
    }
    content.innerHTML = `
        <section aria-labelledby="shared-progress-log-details-heading">
            <h3 id="shared-progress-log-details-heading">${escapeHtml(log.name)}</h3>
            <p>Owner: ${escapeHtml(log.owner)}. Local/file-based collaboration data is included in ART state; server synchronization is not configured.</p>
            <fieldset>
                <legend>Associated Reports</legend>
                ${reports.length ? reports.map((report) => `
                    <label><input type="checkbox" data-shared-progress-report-id="${escapeHtml(report.id)}" ${log.associatedReportIds.includes(report.id) ? 'checked' : ''}> ${escapeHtml(report.name)}</label>
                `).join('') : '<p>No reports are available to associate.</p>'}
            </fieldset>
            <table class="organization-metrics-table">
                <caption class="sr-only">Tasks for ${escapeHtml(log.name)}</caption>
                <thead><tr><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Comments</th></tr></thead>
                <tbody>
                    ${log.tasks.length ? log.tasks.map((task) => `
                        <tr data-shared-progress-task-id="${escapeHtml(task.id)}">
                            <th scope="row">${escapeHtml(task.name)}${task.description ? `<div>${escapeHtml(task.description)}</div>` : ''}</th>
                            <td><label class="sr-only" for="shared-progress-status-${escapeHtml(task.id)}">Status for ${escapeHtml(task.name)}</label><select id="shared-progress-status-${escapeHtml(task.id)}" data-shared-progress-status>${log.statuses.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === task.statusId ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></td>
                            <td>
                                <ul>${task.comments.map((comment) => `<li><strong>${escapeHtml(comment.author)}:</strong> ${escapeHtml(comment.content)}</li>`).join('')}</ul>
                                <label class="sr-only" for="shared-progress-comment-${escapeHtml(task.id)}">Add comment to ${escapeHtml(task.name)}</label>
                                <textarea id="shared-progress-comment-${escapeHtml(task.id)}" data-shared-progress-comment placeholder="Add comment"></textarea>
                                <button type="button" data-shared-progress-add-comment>Add Comment</button>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="3">No tasks have been added.</td></tr>'}
                </tbody>
            </table>
        </section>
    `;
    if (status) status.textContent = `${log.tasks.length} task${log.tasks.length === 1 ? '' : 's'} in ${log.name}.`;
}

function bindDialog(dialog) {
    if (dialog.dataset.sharedProgressBound) return;
    dialog.dataset.sharedProgressBound = 'true';

    dialog.querySelector('#btn-shared-progress-log-close')?.addEventListener('click', () => closeSharedProgressLogs(true));
    dialog.querySelector('#shared-progress-log-select')?.addEventListener('change', () => renderDialog());
    dialog.querySelector('#btn-shared-progress-log-create')?.addEventListener('click', () => {
        const log = createSharedProgressLog({ name: `Shared Progress Log ${getSharedProgressLogs().length + 1}` });
        renderDialog();
        dialog.querySelector('#shared-progress-log-select').value = log.id;
        renderDialog();
        announce(`Created ${log.name}.`);
    });
    dialog.querySelector('#btn-shared-progress-task-add')?.addEventListener('click', () => {
        const logId = dialog.querySelector('#shared-progress-log-select')?.value;
        const log = getSharedProgressLog(logId);
        if (!log) {
            announce('Create or select a Shared Progress Log first.');
            return;
        }
        const task = addSharedProgressTask(log.id, { name: `Task ${log.tasks.length + 1}` });
        pendingFocusSelector = `[data-shared-progress-task-id="${task.id}"] [data-shared-progress-status]`;
        renderDialog();
        announce(`Added ${task.name}.`);
    });
    dialog.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        const logId = dialog.querySelector('#shared-progress-log-select')?.value;
        const log = getSharedProgressLog(logId);
        if (!log) return;
        if (target.matches('[data-shared-progress-report-id]')) {
            const reportIds = [...dialog.querySelectorAll('[data-shared-progress-report-id]:checked')].map((input) => input.getAttribute('data-shared-progress-report-id'));
            setSharedProgressLogReportAssociations(log.id, reportIds);
            announce('Associated reports updated.');
        }
        if (target.matches('[data-shared-progress-status]')) {
            const taskId = target.closest('[data-shared-progress-task-id]')?.getAttribute('data-shared-progress-task-id');
            const task = updateSharedProgressTask(log.id, taskId, { statusId: target.value });
            pendingFocusSelector = `#${CSS.escape(target.id)}`;
            announce(`${task?.name || 'Task'} status updated to ${getStatusLabel(log, target.value)}.`);
            renderDialog();
        }
    });
    dialog.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-shared-progress-add-comment]') : null;
        if (!button) return;
        const row = button.closest('[data-shared-progress-task-id]');
        const taskId = row?.getAttribute('data-shared-progress-task-id');
        const text = row?.querySelector('[data-shared-progress-comment]')?.value.trim();
        const logId = dialog.querySelector('#shared-progress-log-select')?.value;
        if (!text) {
            announce('Enter a comment before adding it.');
            return;
        }
        addSharedProgressComment(logId, taskId, { content: text });
        pendingFocusSelector = `#${CSS.escape(row?.querySelector('[data-shared-progress-comment]')?.id || '')}`;
        renderDialog();
        announce('Comment added.');
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSharedProgressLogs(true);
        }
    });
}

export function openSharedProgressLogs(trigger = null) {
    const state = ensureDialog();
    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    renderDialog();
    state.dialog.querySelector('#shared-progress-log-select')?.focus();
    announce('Shared Progress Logs opened.');
    return true;
}

export function closeSharedProgressLogs(restoreFocus = true) {
    const state = dialogState;
    if (!state) return false;
    state.dialog.hidden = true;
    if (restoreFocus && state.lastTrigger?.focus) state.lastTrigger.focus();
    return true;
}
