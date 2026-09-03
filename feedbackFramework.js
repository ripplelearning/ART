import { announce } from './state.js';
import { getLocalUserProfile } from './identityFramework.js';
import { getOrganizationMemberships } from './authorizationFramework.js';

const FEEDBACK_KEY = 'art-community-feedback-v1';
const FEEDBACK_CATEGORIES = ['Accessibility', 'Usability', 'Bug', 'Feature Request', 'Performance', 'Documentation', 'Security and Privacy'];
const ISSUE_STATUSES = ['Not Started', 'Deferred', 'New', 'Triaged', 'In Progress', 'Needs Review', 'Resolved', 'Closed'];
const ISSUES_KEY = 'art-community-feedback-issues-v1';
let feedbackDialog = null;
let lastTrigger = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readFeedback() {
    try {
        const value = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeFeedback(entries) {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries.slice(-100)));
}

function readIssues() {
    try {
        const value = JSON.parse(localStorage.getItem(ISSUES_KEY) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeIssues(issues) {
    localStorage.setItem(ISSUES_KEY, JSON.stringify(issues.slice(-500)));
}

function getCurrentUserId() {
    return getLocalUserProfile().localUserId;
}

function canUpdateIssues() {
    const profile = getLocalUserProfile();
    if (['Owner', 'Administrator'].includes(profile.artRole)) return true;
    return getOrganizationMemberships().some((membership) => ['Owner', 'Admin', 'Contributor'].includes(membership.role));
}

function canUpdateIssue(issue) {
    return canUpdateIssues() || issue?.reporterUserId === getCurrentUserId();
}

function createIssueFromFeedback(entry) {
    return {
        id: `feedback-issue-${Date.now()}`,
        feedbackId: entry.id,
        category: entry.category,
        summary: entry.summary,
        details: entry.details,
        contact: entry.contact,
        status: 'New',
        comments: [],
        reporterUserId: getCurrentUserId(),
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt
    };
}

function getIssuesNewestFirst() {
    return readIssues().sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
}

function formatIssueDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function exportIssuesFile() {
    const blob = new Blob([JSON.stringify({ artFeedbackIssuesVersion: '1.0', exportedAt: new Date().toISOString(), issues: getIssuesNewestFirst() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'art-feedback-issues.json';
    link.click();
    URL.revokeObjectURL(url);
    announce('Feedback issues exported to an ART feedback issues file.');
}

async function importIssuesFile(file) {
    const status = document.querySelector('#community-feedback-issues [data-issues-status]');
    try {
        const payload = JSON.parse(await file.text());
        const imported = Array.isArray(payload?.issues) ? payload.issues.filter((issue) => issue && issue.id && issue.summary) : [];
        if (!imported.length) throw new Error('No issues found.');
        const issuesById = new Map(readIssues().map((issue) => [issue.id, issue]));
        imported.forEach((issue) => issuesById.set(issue.id, {
            ...issue,
            status: ISSUE_STATUSES.includes(issue.status) ? issue.status : 'Deferred',
            comments: Array.isArray(issue.comments) ? issue.comments : [],
            updatedAt: issue.updatedAt || issue.createdAt || new Date().toISOString()
        }));
        writeIssues([...issuesById.values()]);
        renderIssueTracker();
        const message = `${imported.length} feedback issue${imported.length === 1 ? '' : 's'} imported and saved locally.`;
        if (status) status.textContent = message;
        announce(message);
    } catch {
        if (status) status.textContent = 'Feedback issue import failed. Choose a valid ART feedback issues JSON file.';
        announce('Feedback issue import failed.');
    }
}

function renderIssueTracker() {
    const tracker = document.getElementById('community-feedback-issues');
    if (!tracker) return;
    tracker.innerHTML = `
        <div class="command-palette-header"><h2 id="community-feedback-issues-heading">Feedback Issues</h2><button type="button" data-issues-close>Close</button></div>
        <p id="community-feedback-issues-description">Issues from the feedback form are separate from Tasks and To-Do. Most recent issues appear first.</p>
        <div class="viewer-dialog-actions" role="group" aria-label="Feedback issue file actions">
            <button type="button" data-issues-import>Import Feedback Issues File</button>
            <input type="file" data-issues-import-file accept=".json,application/json" hidden>
            <button type="button" data-issues-export>Export Feedback Issues File</button>
        </div>
        <div role="status" aria-live="polite" data-issues-status></div>
        <section aria-labelledby="community-feedback-issues-heading"><ol>${getIssuesNewestFirst().map((issue) => `
            <li data-issue-id="${escapeHtml(issue.id)}">
                <h3>${escapeHtml(issue.summary)}</h3>
                <dl class="feedback-issue-metadata">
                    <div><dt>Category</dt><dd>${escapeHtml(issue.category)}</dd></div>
                    <div><dt>Created</dt><dd>${escapeHtml(formatIssueDate(issue.createdAt))}</dd></div>
                    <div><dt>Last updated</dt><dd>${escapeHtml(formatIssueDate(issue.updatedAt))}</dd></div>
                </dl>
                ${issue.documentationUrl ? `<p><a href="${escapeHtml(issue.documentationUrl)}">Documented deferred work</a></p>` : ''}
                <p>${escapeHtml(issue.details)}</p>
                <label for="feedback-issue-status-${escapeHtml(issue.id)}">Status</label>
                <select id="feedback-issue-status-${escapeHtml(issue.id)}" data-issue-status ${canUpdateIssue(issue) ? '' : 'disabled'}>${ISSUE_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${issue.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select>
                <label for="feedback-issue-comment-${escapeHtml(issue.id)}">Notes</label>
                <textarea id="feedback-issue-comment-${escapeHtml(issue.id)}" data-issue-comment rows="3" ${canUpdateIssue(issue) ? '' : 'disabled'} placeholder="Add a note"></textarea>
                <button type="button" data-issue-save ${canUpdateIssue(issue) ? '' : 'disabled'}>Save Issue Update</button>
                <ul aria-label="Notes for ${escapeHtml(issue.summary)}">${(issue.comments || []).map((comment) => `<li>${escapeHtml(comment.text)} (${escapeHtml(new Date(comment.createdAt).toLocaleString())})</li>`).join('')}</ul>
            </li>`).join('') || '<li>No feedback issues have been submitted.</li>'}</ol></section>`;
    tracker.querySelector('[data-issues-close]')?.addEventListener('click', () => { tracker.hidden = true; });
    tracker.querySelector('[data-issues-export]')?.addEventListener('click', exportIssuesFile);
    const importInput = tracker.querySelector('[data-issues-import-file]');
    tracker.querySelector('[data-issues-import]')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
        const file = importInput.files?.[0];
        if (file) void importIssuesFile(file);
        importInput.value = '';
    });
    tracker.querySelectorAll('[data-issue-save]').forEach((button) => button.addEventListener('click', () => {
        const item = button.closest('[data-issue-id]');
        const issueId = item?.getAttribute('data-issue-id');
        if (!issueId) return;
        const issues = readIssues();
        const issue = issues.find((entry) => entry.id === issueId);
        if (!issue || !canUpdateIssue(issue)) return;
        const commentInput = item.querySelector('[data-issue-comment]');
        const text = commentInput.value.trim();
        issue.status = item.querySelector('[data-issue-status]').value;
        if (text) issue.comments = [...(issue.comments || []), { id: `comment-${Date.now()}`, text, createdAt: new Date().toISOString(), authorUserId: getCurrentUserId() }];
        issue.updatedAt = new Date().toISOString();
        writeIssues(issues);
        renderIssueTracker();
        announce(`Feedback issue ${issue.summary} updated.`);
    }));
}

export function openCommunityFeedbackIssues(trigger = null) {
    if (feedbackDialog) feedbackDialog.hidden = true;
    const tracker = document.getElementById('community-feedback-issues') || document.createElement('div');
    if (!tracker.id) {
        tracker.id = 'community-feedback-issues';
        tracker.className = 'command-palette-dialog';
        tracker.setAttribute('role', 'dialog');
        tracker.setAttribute('aria-modal', 'true');
        tracker.setAttribute('aria-labelledby', 'community-feedback-issues-heading');
        tracker.setAttribute('aria-describedby', 'community-feedback-issues-description');
        document.body.appendChild(tracker);
    }
    tracker.hidden = false;
    tracker.dataset.lastTriggerId = trigger?.id || '';
    renderIssueTracker();
    tracker.querySelector('[data-issue-status]')?.focus();
    announce('Feedback Issues opened.');
    return true;
}

function getFocusable(dialog) {
    return [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
}

function closeFeedback(restore = true) {
    if (!feedbackDialog) return;
    feedbackDialog.hidden = true;
    if (restore && lastTrigger?.focus) lastTrigger.focus();
}

function ensureFeedbackDialog() {
    if (feedbackDialog) return feedbackDialog;
    feedbackDialog = document.createElement('div');
    feedbackDialog.id = 'community-feedback-dialog';
    feedbackDialog.className = 'command-palette-dialog';
    feedbackDialog.setAttribute('role', 'dialog');
    feedbackDialog.setAttribute('aria-modal', 'true');
    feedbackDialog.setAttribute('aria-labelledby', 'community-feedback-heading');
    feedbackDialog.setAttribute('aria-describedby', 'community-feedback-description');
    feedbackDialog.hidden = true;
    feedbackDialog.innerHTML = `
        <div class="command-palette-header"><button type="button" data-feedback-close>Close</button><h2 id="community-feedback-heading">ART Community Feedback</h2></div>
        <p id="community-feedback-description">Share accessibility, usability, bug, feature, performance, documentation, or security and privacy feedback. Nothing is sent automatically.</p>
        <label for="community-feedback-category">Feedback category</label>
        <select id="community-feedback-category">${FEEDBACK_CATEGORIES.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select>
        <label for="community-feedback-summary">Summary</label>
        <input id="community-feedback-summary" type="text" maxlength="160" required>
        <label for="community-feedback-details">Details</label>
        <textarea id="community-feedback-details" rows="7" maxlength="5000" required aria-describedby="community-feedback-details-help"></textarea>
        <p id="community-feedback-details-help">Include the workflow, expected result, actual result, and steps to reproduce where relevant. Do not include passwords, tokens, private report content, or personal information you do not need to share.</p>
        <label for="community-feedback-contact">Optional contact information</label>
        <input id="community-feedback-contact" type="text" maxlength="200" autocomplete="off">
        <p id="community-feedback-security-note">Do not submit an undisclosed security vulnerability here. Use the private security reporting process described in SECURITY.md.</p>
        <div class="viewer-dialog-actions" role="group" aria-label="Feedback actions"><button type="button" data-feedback-submit>Save Feedback Locally</button><button type="button" data-feedback-cancel>Cancel</button></div>
        <p data-feedback-status role="status" aria-live="polite" aria-atomic="true"></p>
    `;
    document.body.appendChild(feedbackDialog);
    feedbackDialog.querySelector('[data-feedback-close]')?.addEventListener('click', () => closeFeedback(true));
    feedbackDialog.querySelector('[data-feedback-cancel]')?.addEventListener('click', () => closeFeedback(true));
    feedbackDialog.querySelector('[data-feedback-submit]')?.addEventListener('click', () => {
        const summary = feedbackDialog.querySelector('#community-feedback-summary').value.trim();
        const details = feedbackDialog.querySelector('#community-feedback-details').value.trim();
        const status = feedbackDialog.querySelector('[data-feedback-status]');
        if (!summary || !details) {
            status.textContent = 'Enter a summary and details before saving feedback.';
            (summary ? feedbackDialog.querySelector('#community-feedback-details') : feedbackDialog.querySelector('#community-feedback-summary'))?.focus();
            return;
        }
        const entry = {
            id: `feedback-${Date.now()}`,
            category: feedbackDialog.querySelector('#community-feedback-category').value,
            summary,
            details,
            contact: feedbackDialog.querySelector('#community-feedback-contact').value.trim(),
            createdAt: new Date().toISOString()
        };
        writeFeedback([...readFeedback(), entry]);
        const issue = createIssueFromFeedback(entry);
        writeIssues([...readIssues(), issue]);
        status.textContent = 'Feedback saved locally on this device. Nothing was transmitted.';
        announce(status.textContent);
        feedbackDialog.querySelector('#community-feedback-summary').value = '';
        feedbackDialog.querySelector('#community-feedback-details').value = '';
        feedbackDialog.querySelector('#community-feedback-contact').value = '';
        feedbackDialog.querySelector('#community-feedback-category').focus();
    });
    feedbackDialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeFeedback(true);
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = getFocusable(feedbackDialog);
        if (!focusable.length) return;
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index === 0) {
            event.preventDefault();
            focusable.at(-1).focus();
        } else if (!event.shiftKey && index === focusable.length - 1) {
            event.preventDefault();
            focusable[0].focus();
        }
    });
    return feedbackDialog;
}

export function openCommunityFeedback(trigger = null) {
    const dialog = ensureFeedbackDialog();
    lastTrigger = trigger || document.activeElement;
    dialog.hidden = false;
    dialog.querySelector('#community-feedback-category')?.focus();
    announce('ART Community Feedback opened.');
    return true;
}

export function getCommunityFeedbackCount() {
    return readFeedback().length;
}
