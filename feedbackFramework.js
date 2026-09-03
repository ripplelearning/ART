import { announce } from './state.js';

const FEEDBACK_KEY = 'art-community-feedback-v1';
const FEEDBACK_CATEGORIES = ['Accessibility', 'Usability', 'Bug', 'Feature Request', 'Performance', 'Documentation', 'Security and Privacy'];
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
