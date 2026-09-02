import { announce } from './state.js';
import {
    openSettingsAccountSectionFromCommand,
    openSettingsAccessibilitySectionFromCommand,
    openSettingsCollaborationSectionFromCommand,
    openSettingsExternalIntegrationsSectionFromCommand,
    openSettingsOrganizationSectionFromCommand,
    openSettingsStorageSectionFromCommand
} from './settings.js';

const WIZARD_STEPS = [
    { id: 'identity', title: 'Account and Identity', description: 'Add your name, display name, job title, and permission-based ART Role in Application Settings.', open: openSettingsAccountSectionFromCommand },
    { id: 'storage', title: 'Storage Providers', description: 'Choose local storage or connect an optional Google Drive, OneDrive, or Dropbox provider.', open: openSettingsStorageSectionFromCommand },
    { id: 'integrations', title: 'External Integrations', description: 'Review optional Jira, GitHub Issues, Azure DevOps, and Google Workspace connections.', open: openSettingsExternalIntegrationsSectionFromCommand },
    { id: 'accessibility', title: 'Accessibility and Appearance', description: 'Adjust theme, zoom, font size, focus indicators, reduced motion, and border visibility.', open: openSettingsAccessibilitySectionFromCommand },
    { id: 'organization', title: 'Organization and Metrics', description: 'Set organization roles and enable Organization Statistics when your reports use Organization/Client metadata.', open: openSettingsOrganizationSectionFromCommand },
    { id: 'collaboration', title: 'Collaboration', description: 'Review local-first, shared-folder, synchronization, and optional live collaboration settings.', open: openSettingsCollaborationSectionFromCommand }
];

let wizardState = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderWizard() {
    const state = wizardState;
    if (!state) return;
    const step = WIZARD_STEPS[state.stepIndex];
    state.dialog.innerHTML = `
        <div class="command-palette-header">
            <button type="button" data-wizard-close>Close</button>
            <h2 id="onboarding-wizard-heading">ART Setup Wizard</h2>
        </div>
        <p id="onboarding-wizard-description">Optional setup guidance. You can close this wizard at any time and return to these settings later.</p>
        <p aria-live="polite">Step ${state.stepIndex + 1} of ${WIZARD_STEPS.length}: ${escapeHtml(step.title)}</p>
        <nav aria-label="ART setup steps">
            <ol>${WIZARD_STEPS.map((entry, index) => `<li><button type="button" data-wizard-step="${index}" aria-current="${index === state.stepIndex ? 'step' : 'false'}">${escapeHtml(entry.title)}</button></li>`).join('')}</ol>
        </nav>
        <section aria-labelledby="onboarding-wizard-step-heading">
            <h3 id="onboarding-wizard-step-heading">${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.description)}</p>
            <button type="button" data-wizard-open>Open ${escapeHtml(step.title)} Settings</button>
        </section>
        <div class="viewer-dialog-actions" role="group" aria-label="Wizard navigation">
            <button type="button" data-wizard-previous ${state.stepIndex === 0 ? 'disabled' : ''}>Previous</button>
            <button type="button" data-wizard-next ${state.stepIndex === WIZARD_STEPS.length - 1 ? 'disabled' : ''}>Next</button>
            <button type="button" data-wizard-done>Done</button>
        </div>
    `;
    state.dialog.querySelector('[data-wizard-close]')?.addEventListener('click', () => closeOnboardingWizard(true));
    state.dialog.querySelector('[data-wizard-done]')?.addEventListener('click', () => closeOnboardingWizard(true));
    state.dialog.querySelector('[data-wizard-previous]')?.addEventListener('click', () => {
        state.stepIndex -= 1;
        renderWizard();
        state.dialog.querySelector('[data-wizard-step][aria-current="step"]')?.focus();
    });
    state.dialog.querySelector('[data-wizard-next]')?.addEventListener('click', () => {
        state.stepIndex += 1;
        renderWizard();
        state.dialog.querySelector('[data-wizard-step][aria-current="step"]')?.focus();
    });
    state.dialog.querySelectorAll('[data-wizard-step]').forEach((button) => button.addEventListener('click', () => {
        state.stepIndex = Number(button.dataset.wizardStep);
        renderWizard();
        state.dialog.querySelector('[data-wizard-step][aria-current="step"]')?.focus();
    }));
    state.dialog.querySelector('[data-wizard-open]')?.addEventListener('click', () => {
        step.open();
        announce(`${step.title} settings opened.`);
    });
}

function ensureWizard() {
    if (wizardState?.dialog instanceof HTMLElement) return wizardState;
    const dialog = document.createElement('div');
    dialog.id = 'onboarding-wizard-dialog';
    dialog.className = 'command-palette-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'onboarding-wizard-heading');
    dialog.setAttribute('aria-describedby', 'onboarding-wizard-description');
    dialog.hidden = true;
    document.body.appendChild(dialog);
    wizardState = { dialog, stepIndex: 0, lastTrigger: null };
    dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeOnboardingWizard(true);
    });
    return wizardState;
}

export function openOnboardingWizard(trigger = null) {
    const state = ensureWizard();
    if (trigger) state.lastTrigger = trigger;
    state.dialog.hidden = false;
    renderWizard();
    state.dialog.querySelector('[data-wizard-step][aria-current="step"]')?.focus();
    announce('ART Setup Wizard opened.');
    return true;
}

export function closeOnboardingWizard(restoreFocus = true) {
    if (!wizardState) return false;
    wizardState.dialog.hidden = true;
    if (restoreFocus && wizardState.lastTrigger?.focus) wizardState.lastTrigger.focus();
    return true;
}
