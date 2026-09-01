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

function formatDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function renderTaskRow(task, tabId) {
    const completed = task.status === 'Complete';
    const summaryLines = [
        `Priority: ${escapeHtml(task.priority)}`,
        `Due: ${escapeHtml(formatDateTime(task.dueAt))}`,
        `Created: ${escapeHtml(formatDateTime(task.createdAt))}`
    ];
    if (task.status === 'Deferred' && task.deferredUntil) {
        summaryLines.push(`Resume: ${escapeHtml(formatDateTime(task.deferredUntil))}`);
    }
    if (tabId === 'completed' && task.completedAt) {
        summaryLines.push(`Completed: ${escapeHtml(formatDateTime(task.completedAt))}`);
    }
    if (task.comments) {
        summaryLines.push(`Comments: ${escapeHtml(task.comments)}`);
    }

    return `
        <article class="viewer-field-card" data-task-id="${escapeHtml(task.id)}">
            <div class="viewer-dialog-actions" role="group" aria-label="Task row actions">
                <label class="task-row-check">
                    <input type="checkbox" data-task-complete ${completed ? 'checked' : ''}>
                </label>
                <span>${escapeHtml(task.name)}</span>
                <label>Status <select data-task-status>${STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}" ${task.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
                <button type="button" data-task-edit="${escapeHtml(task.id)}">Edit ${escapeHtml(task.name)}</button>
            </div>
            <p>${summaryLines.join(' • ')}</p>
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

function buildTaskForm(task = {}, prefix = 'new-task') {
    const taskName = task.name || '';
    const priority = task.priority || 'Normal';
    const dueAtValue = task.dueAt ? formatDateTimeInput(task.dueAt) : '';
    const commentsValue = task.comments || '';
    const deferredValue = task.deferredUntil ? formatDateTimeInput(task.deferredUntil) : '';
    return `
        <div class="viewer-field-card">
            <label>Task name <input id="${prefix}-name-input" type="text" value="${escapeHtml(taskName)}" placeholder="Enter task name"></label>
            <label>Priority <select id="${prefix}-priority-input">${PRIORITY_OPTIONS.map((option) => `<option value="${escapeHtml(option)}" ${priority === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>
            <label>Due date and time <input id="${prefix}-due-input" type="datetime-local" value="${escapeHtml(dueAtValue)}"></label>
            ${task.status === 'Deferred' ? `<label>Resume date and time <input id="${prefix}-deferred-input" type="datetime-local" value="${escapeHtml(deferredValue)}"></label>` : ''}
            <label>Comments <textarea id="${prefix}-comments-input" rows="3">${escapeHtml(commentsValue)}</textarea></label>
        </div>
    `;
}

function saveTaskForm(dialog, taskId = null, mode = 'new') {
    const nameInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-name-input`);
    const priorityInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-priority-input`);
    const dueInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-due-input`);
    const commentsInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-comments-input`);
    const deferredInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-deferred-input`);
    const taskName = (nameInput?.value ?? '').trim();
    if (!taskName) {
        announce('Task name is required.');
        nameInput?.focus();
        return;
    }

    const payload = {
        name: taskName,
        priority: priorityInput?.value || 'Normal',
        dueAt: dueInput?.value ? parseDateTimeInput(dueInput.value) : '',
        comments: commentsInput?.value ?? ''
    };
    if (deferredInput) {
        payload.deferredUntil = deferredInput.value ? parseDateTimeInput(deferredInput.value) : '';
    }

    if (taskId) {
        updateTask(taskId, payload);
        announce(`Updated ${taskName}.`);
    } else {
        const task = createTask(payload);
        announce(`Created ${task.name}.`);
    }

    updateTaskManagerConfig({ activeTab: 'personal' });
    if (mode === 'new') {
        closeNewTaskDialog(true);
    } else {
        closeEditTaskDialog(true);
    }
    renderDialog();
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

let editTaskDialogState = null;

function ensureEditTaskDialog() {
    if (editTaskDialogState?.dialog instanceof HTMLElement) return editTaskDialogState;
    let dialog = document.getElementById('edit-task-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'edit-task-dialog';
        dialog.className = 'command-palette-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'edit-task-dialog-heading');
        dialog.hidden = true;
        document.body.appendChild(dialog);
    }
    editTaskDialogState = { dialog, lastTrigger: null, taskId: null };
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeEditTaskDialog(true);
        }
    });
    return editTaskDialogState;
}

function renderNewTaskDialog() {
    const state = ensureNewTaskDialog();
    state.dialog.innerHTML = `
        <div class="command-palette-header"><h2 id="new-task-dialog-heading">Create New Task</h2></div>
        ${buildTaskForm({}, 'new-task')}
        <div class="viewer-dialog-actions" role="group" aria-label="Dialog actions">
            <button id="btn-new-task-save" type="button">Save</button>
            <button id="btn-new-task-cancel" type="button">Cancel</button>
        </div>
    `;
    bindTaskFormEvents(state.dialog, { mode: 'new' });
}

function renderEditTaskDialog(taskId) {
    const task = getTasks().find((entry) => entry.id === taskId);
    if (!task) return;
    const state = ensureEditTaskDialog();
    state.taskId = taskId;
    state.dialog.innerHTML = `
        <div class="command-palette-header"><h2 id="edit-task-dialog-heading">Edit Task</h2></div>
        ${buildTaskForm(task, 'edit-task')}
        <div class="viewer-dialog-actions" role="group" aria-label="Dialog actions">
            <button id="btn-edit-task-save" type="button">Save</button>
            <button id="btn-edit-task-cancel" type="button">Cancel</button>
        </div>
    `;
    bindTaskFormEvents(state.dialog, { mode: 'edit', taskId });
}

function bindTaskFormEvents(dialog, { mode = 'new', taskId = null } = {}) {
    const nameInput = dialog.querySelector(`#${mode === 'new' ? 'new-task' : 'edit-task'}-name-input`);
    const saveBtn = dialog.querySelector(`#${mode === 'new' ? 'btn-new-task-save' : 'btn-edit-task-save'}`);
    const cancelBtn = dialog.querySelector(`#${mode === 'new' ? 'btn-new-task-cancel' : 'btn-edit-task-cancel'}`);

    nameInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveBtn?.click();
        }
    });

    saveBtn?.addEventListener('click', () => saveTaskForm(dialog, taskId, mode));
    cancelBtn?.addEventListener('click', () => {
        if (mode === 'new') {
            closeNewTaskDialog(true);
        } else {
            closeEditTaskDialog(true);
        }
    });
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

function openEditTaskDialog(taskId, trigger = null) {
    const state = ensureEditTaskDialog();
    state.taskId = String(taskId || '').trim();
    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    renderEditTaskDialog(state.taskId);
    announce('Edit task dialog opened.');
}

function closeEditTaskDialog(restoreFocus = true) {
    if (!editTaskDialogState) return false;
    editTaskDialogState.dialog.hidden = true;
    if (restoreFocus && editTaskDialogState.lastTrigger?.focus) editTaskDialogState.lastTrigger.focus();
    return true;
}

function bindRenderedEvents(dialog) {
    dialog.querySelector('#btn-tasks-close')?.addEventListener('click', () => closeTasksDialog(true));
    dialog.querySelector('#btn-task-create')?.addEventListener('click', (event) => {
        openNewTaskDialog(event.currentTarget);
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
        card.querySelector('[data-task-edit]')?.addEventListener('click', (event) => {
            openEditTaskDialog(taskId, event.currentTarget);
        });
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
