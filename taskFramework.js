import {
    announce,
    createTask,
    getTaskManagerConfig,
    getTasks,
    setTaskCompleted,
    updateTask,
    updateTaskManagerConfig
} from './state.js';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Deferred', 'Not Applicable', 'Needs Review', 'Need Assistance', 'Complete'];
const PRIORITY_OPTIONS = ['Critical', 'High', 'Normal', 'Low'];
const PRIORITY_ORDER = { Critical: 0, High: 1, Normal: 2, Low: 3 };
let dialogState = null;
let newTaskDialogState = null;

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDateTime(value, fallback = 'Not set') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function getVisibleTabs() {
    const tasks = getTasks();
    return [
        { id: 'assigned', label: 'Assigned Tasks' },
        ...(tasks.some((task) => task.sourceLogId) ? [{ id: 'shared', label: 'Shared Tasks' }] : []),
        { id: 'personal', label: 'Personal To-Do List' },
        { id: 'completed', label: 'Completed Tasks' }
    ];
}

function getTasksForTab(tabId) {
    const tasks = getTasks();
    if (tabId === 'completed') return tasks.filter((task) => task.status === 'Complete');
    if (tabId === 'shared') return tasks.filter((task) => task.sourceLogId && task.status !== 'Complete');
    if (tabId === 'assigned') return tasks.filter((task) => task.status !== 'Complete');
    return tasks.filter((task) => task.personal && task.status !== 'Complete');
}

function sortTasks(tasks, sortBy) {
    return [...tasks].sort((left, right) => {
        if (sortBy === 'due-asc') return String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999')) || String(left.createdAt).localeCompare(String(right.createdAt));
        if (sortBy === 'created-desc') return String(right.createdAt).localeCompare(String(left.createdAt));
        if (sortBy === 'created-asc') return String(left.createdAt).localeCompare(String(right.createdAt));
        return (PRIORITY_ORDER[left.priority] ?? 9) - (PRIORITY_ORDER[right.priority] ?? 9) || String(left.dueAt || '9999').localeCompare(String(right.dueAt || '9999')) || String(left.createdAt).localeCompare(String(right.createdAt));
    });
}

function ensureDialog() {
    if (dialogState?.dialog instanceof HTMLElement) return dialogState;
    let dialog = document.getElementById('tasks-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'tasks-dialog';
        dialog.className = 'command-palette-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'tasks-heading');
        dialog.hidden = true;
        document.body.appendChild(dialog);
    }
    dialogState = { dialog, lastTrigger: null };
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeTasksDialog(true);
        }
    });
    return dialogState;
}

function renderTaskRow(task, tabId) {
    const completed = task.status === 'Complete';
    return `
        <article class="viewer-field-card" data-task-id="${escapeHtml(task.id)}">
            <h4>${escapeHtml(task.name)}</h4>
            <label><input type="checkbox" data-task-complete ${completed ? 'checked' : ''}> Complete</label>
            <label>Status <select data-task-status>${STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}" ${task.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
            <label>Priority <select data-task-priority>${PRIORITY_OPTIONS.map((priority) => `<option value="${escapeHtml(priority)}" ${task.priority === priority ? 'selected' : ''}>${escapeHtml(priority)}</option>`).join('')}</select></label>
            <label>Due date and time <input type="datetime-local" data-task-due value="${escapeHtml(task.dueAt ? task.dueAt.slice(0, 16) : '')}"></label>
            ${task.status === 'Deferred' ? `<label>Resume date and time <input type="datetime-local" data-task-deferred value="${escapeHtml(task.deferredUntil ? task.deferredUntil.slice(0, 16) : '')}"></label>` : ''}
            <label>Comments <textarea data-task-comments>${escapeHtml(task.comments)}</textarea></label>
            <p>Priority: ${escapeHtml(task.priority)}. Due: ${escapeHtml(formatDateTime(task.dueAt))}. Created: ${escapeHtml(formatDateTime(task.createdAt))}.</p>
            ${tabId === 'completed' ? `<p>Completed: ${escapeHtml(formatDateTime(task.completedAt))}.</p>` : ''}
        </article>`;
}

function renderDialog() {
    const state = ensureDialog();
    const config = getTaskManagerConfig();
    const tabs = getVisibleTabs();
    const activeTab = tabs.some((tab) => tab.id === config.activeTab) ? config.activeTab : 'personal';
    const tasks = sortTasks(getTasksForTab(activeTab), config.sortBy);
    state.dialog.innerHTML = `
        <div class="command-palette-header"><button id="btn-tasks-close" type="button">Close</button><h2 id="tasks-heading">Tasks &amp; To-Do</h2></div>
        <p id="tasks-status" role="status" aria-live="polite" aria-atomic="true">${tasks.length} ${activeTab === 'completed' ? 'completed' : 'active'} task${tasks.length === 1 ? '' : 's'}.</p>
        <div role="tablist" aria-label="Task views">${tabs.map((tab) => `<button type="button" role="tab" id="tasks-tab-${tab.id}" aria-controls="tasks-panel-${tab.id}" aria-selected="${tab.id === activeTab}" tabindex="${tab.id === activeTab ? '0' : '-1'}">${escapeHtml(tab.label)}</button>`).join('')}</div>
        <div class="viewer-dialog-actions" role="group" aria-label="Task actions"><button id="btn-task-create" type="button">Create Task</button><label for="tasks-sort">Sort</label><select id="tasks-sort"><option value="priority">Priority: highest first</option><option value="due-asc">Due date: earliest first</option><option value="created-asc">Date added: oldest first</option><option value="created-desc">Date added: newest first</option></select></div>
        <div role="tabpanel" id="tasks-panel-${activeTab}" aria-labelledby="tasks-tab-${activeTab}" tabindex="0">${tasks.length ? tasks.map((task) => renderTaskRow(task, activeTab)).join('') : '<p>No tasks in this view.</p>'}</div>
    `;
    state.dialog.querySelector('#tasks-sort').value = config.sortBy;
    bindRenderedEvents(state.dialog);
}

function ensureNewTaskDialog() {
    if (newTaskDialogState?.dialog instanceof HTMLElement) return newTaskDialogState;
    let dialog = document.getElementById('new-task-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'new-task-dialog';
        dialog.className = 'command-palette-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'new-task-dialog-heading');
        dialog.hidden = true;
        document.body.appendChild(dialog);
    }
    newTaskDialogState = { dialog, lastTrigger: null };
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeNewTaskDialog(true);
        }
    });
    return newTaskDialogState;
}

function renderNewTaskDialog() {
    const state = ensureNewTaskDialog();
    state.dialog.innerHTML = `
        <div class="command-palette-header"><h2 id="new-task-dialog-heading">Create New Task</h2></div>
        <div class="viewer-field-card">
            <label>Task name <input id="new-task-name-input" type="text" placeholder="Enter task name"></label>
        </div>
        <div class="viewer-dialog-actions" role="group" aria-label="Dialog actions">
            <button id="btn-new-task-save" type="button">Save</button>
            <button id="btn-new-task-cancel" type="button">Cancel</button>
        </div>
    `;
    bindNewTaskDialogEvents(state.dialog);
}

function bindNewTaskDialogEvents(dialog) {
    const nameInput = dialog.querySelector('#new-task-name-input');
    const saveBtn = dialog.querySelector('#btn-new-task-save');
    const cancelBtn = dialog.querySelector('#btn-new-task-cancel');

    nameInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveBtn?.click();
        }
    });

    saveBtn?.addEventListener('click', () => {
        const taskName = (nameInput?.value ?? '').trim();
        if (!taskName) {
            announce('Task name is required.');
            nameInput?.focus();
            return;
        }
        const task = createTask({ name: taskName });
        updateTaskManagerConfig({ activeTab: 'personal' });
        closeNewTaskDialog(true);
        renderDialog();
        announce(`Created ${task.name}.`);
    });

    cancelBtn?.addEventListener('click', () => closeNewTaskDialog(true));
    nameInput?.focus();
}

function openNewTaskDialog(trigger = null) {
    const state = ensureNewTaskDialog();
    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    renderNewTaskDialog();
    announce('Create new task dialog opened. Enter a task name and click Save.');
}

function closeNewTaskDialog(restoreFocus = true) {
    if (!newTaskDialogState) return false;
    newTaskDialogState.dialog.hidden = true;
    if (restoreFocus && newTaskDialogState.lastTrigger?.focus) newTaskDialogState.lastTrigger.focus();
    return true;
}

function bindRenderedEvents(dialog) {
    dialog.querySelector('#btn-tasks-close')?.addEventListener('click', () => closeTasksDialog(true));
    dialog.querySelector('#btn-task-create')?.addEventListener('click', (event) => {
        openNewTaskDialog(event.target);
    });
    dialog.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
        updateTaskManagerConfig({ activeTab: tab.id.replace('tasks-tab-', '') });
        renderDialog();
        document.getElementById(tab.id)?.focus();
    }));
    dialog.querySelector('#tasks-sort')?.addEventListener('change', (event) => {
        updateTaskManagerConfig({ sortBy: event.target.value });
        renderDialog();
    });
    dialog.querySelectorAll('[data-task-id]').forEach((card) => {
        const taskId = card.getAttribute('data-task-id');
        card.querySelector('[data-task-complete]')?.addEventListener('change', (event) => {
            setTaskCompleted(taskId, event.target.checked);
            renderDialog();
            announce(event.target.checked ? 'Task completed and moved to Completed Tasks.' : 'Task reopened.');
        });
        card.querySelector('[data-task-status]')?.addEventListener('change', (event) => { updateTask(taskId, { status: event.target.value }); renderDialog(); announce(`Task status updated to ${event.target.value}.`); });
        card.querySelector('[data-task-priority]')?.addEventListener('change', (event) => { updateTask(taskId, { priority: event.target.value }); renderDialog(); announce(`Task priority updated to ${event.target.value}.`); });
        card.querySelector('[data-task-due]')?.addEventListener('change', (event) => updateTask(taskId, { dueAt: event.target.value ? new Date(event.target.value).toISOString() : '' }));
        card.querySelector('[data-task-deferred]')?.addEventListener('change', (event) => updateTask(taskId, { deferredUntil: event.target.value ? new Date(event.target.value).toISOString() : '' }));
        card.querySelector('[data-task-comments]')?.addEventListener('change', (event) => updateTask(taskId, { comments: event.target.value }));
    });
}

export function openTasksDialog(trigger = null) {
    const state = ensureDialog();
    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    renderDialog();
    state.dialog.querySelector('#btn-tasks-close')?.focus();
    announce('Tasks and To-Do opened.');
    return true;
}

export function closeTasksDialog(restoreFocus = true) {
    if (!dialogState) return false;
    dialogState.dialog.hidden = true;
    if (restoreFocus && dialogState.lastTrigger?.focus) dialogState.lastTrigger.focus();
    return true;
}
