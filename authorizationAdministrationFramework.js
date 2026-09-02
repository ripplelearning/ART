// Epic 64: local-first organization administration records.
// The existing Epic 51 policy service remains the authorization decision point; this module
// provides local profile, membership/invitation, and administrative audit records until a server
// can provide authenticated multi-user enforcement.
import { canPerformAction, getOrganizationMemberships } from './authorizationFramework.js';
import { getLocalUserProfile } from './identityFramework.js';

const ADMINISTRATION_KEY = 'art-organization-administration-v1';

function normalizeText(value) {
    return String(value ?? '').trim();
}

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readState() {
    try {
        const value = JSON.parse(localStorage.getItem(ADMINISTRATION_KEY) || '');
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

function writeState(state) {
    localStorage.setItem(ADMINISTRATION_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('art-organization-administration-updated', { detail: state }));
}

function getOrganizationRecord(organizationId) {
    const state = readState();
    const source = state.organizations?.[organizationId] || {};
    return {
        organizationId,
        displayName: normalizeText(source.displayName),
        description: normalizeText(source.description),
        website: normalizeText(source.website),
        contact: normalizeText(source.contact),
        members: Array.isArray(source.members) ? source.members : [],
        invitations: Array.isArray(source.invitations) ? source.invitations : [],
        auditLog: Array.isArray(source.auditLog) ? source.auditLog.slice(-100) : []
    };
}

function saveOrganizationRecord(record) {
    const state = readState();
    state.organizations = { ...(state.organizations || {}), [record.organizationId]: record };
    writeState(state);
    return record;
}

function getOrganizationAdministration(organizationId) {
    const membership = getOrganizationMemberships().find((entry) => entry.organizationId === normalizeText(organizationId));
    if (!membership || !canPerformAction(membership.organizationId, 'manageOrganization')) return null;
    const record = getOrganizationRecord(membership.organizationId);
    return { membership, record: { ...record, displayName: record.displayName || membership.organizationName } };
}

function addAudit(record, action, detail = '') {
    const profile = getLocalUserProfile();
    return {
        ...record,
        auditLog: [...record.auditLog, {
            id: createId('organization-audit'),
            action,
            detail: normalizeText(detail),
            userId: profile.localUserId,
            displayName: profile.displayName || profile.name || 'Local ART user',
            at: new Date().toISOString()
        }].slice(-100)
    };
}

export function getAdministrableOrganizations() {
    return getOrganizationMemberships()
        .filter((membership) => canPerformAction(membership.organizationId, 'manageOrganization'))
        .map((membership) => ({ membership, record: getOrganizationRecord(membership.organizationId) }));
}

export function updateOrganizationProfile(organizationId, updates = {}) {
    const administration = getOrganizationAdministration(organizationId);
    if (!administration) return { ok: false, message: 'Your role does not permit organization administration.' };
    const record = addAudit({
        ...administration.record,
        displayName: normalizeText(updates.displayName) || administration.membership.organizationName,
        description: normalizeText(updates.description),
        website: normalizeText(updates.website),
        contact: normalizeText(updates.contact)
    }, 'Organization profile updated');
    saveOrganizationRecord(record);
    return { ok: true, record, message: 'Organization profile updated.' };
}

export function getOrganizationMembers(organizationId) {
    return getOrganizationAdministration(organizationId)?.record.members || [];
}

export function addOrganizationMember(organizationId, member = {}) {
    const administration = getOrganizationAdministration(organizationId);
    if (!administration || !canPerformAction(organizationId, 'manageMembers')) return { ok: false, message: 'Your role does not permit member management.' };
    const email = normalizeText(member.email).toLowerCase();
    if (!email) return { ok: false, message: 'Enter a member email address.' };
    if (administration.record.members.some((entry) => entry.email === email)) return { ok: false, message: 'That member is already recorded.' };
    const nextMember = { id: createId('organization-member'), email, displayName: normalizeText(member.displayName) || email, role: normalizeText(member.role) || 'Viewer', status: 'active', addedAt: new Date().toISOString() };
    const record = addAudit({ ...administration.record, members: [...administration.record.members, nextMember] }, 'Organization member added', email);
    saveOrganizationRecord(record);
    return { ok: true, member: nextMember, record, message: `Recorded ${email} as an organization member.` };
}

export function removeOrganizationMember(organizationId, memberId) {
    const administration = getOrganizationAdministration(organizationId);
    if (!administration || !canPerformAction(organizationId, 'manageMembers')) return { ok: false, message: 'Your role does not permit member management.' };
    const member = administration.record.members.find((entry) => entry.id === normalizeText(memberId));
    if (!member) return { ok: false, message: 'Organization member was not found.' };
    const record = addAudit({ ...administration.record, members: administration.record.members.filter((entry) => entry.id !== member.id) }, 'Organization member removed', member.email);
    saveOrganizationRecord(record);
    return { ok: true, record, message: `Removed ${member.email} from the organization record.` };
}

export function createOrganizationInvitation(organizationId, invitation = {}) {
    const administration = getOrganizationAdministration(organizationId);
    if (!administration || !canPerformAction(organizationId, 'manageMembers')) return { ok: false, message: 'Your role does not permit inviting members.' };
    const email = normalizeText(invitation.email).toLowerCase();
    if (!email) return { ok: false, message: 'Enter an invitee email address.' };
    const nextInvitation = { id: createId('organization-invitation'), email, state: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
    const record = addAudit({ ...administration.record, invitations: [...administration.record.invitations, nextInvitation] }, 'Organization invitation created', email);
    saveOrganizationRecord(record);
    return { ok: true, invitation: nextInvitation, record, message: `Created a local invitation record for ${email}.` };
}

export function revokeOrganizationInvitation(organizationId, invitationId) {
    const administration = getOrganizationAdministration(organizationId);
    if (!administration || !canPerformAction(organizationId, 'manageMembers')) return { ok: false, message: 'Your role does not permit revoking invitations.' };
    const invitation = administration.record.invitations.find((entry) => entry.id === normalizeText(invitationId));
    if (!invitation) return { ok: false, message: 'Organization invitation was not found.' };
    const invitations = administration.record.invitations.map((entry) => entry.id === invitation.id ? { ...entry, state: 'revoked', revokedAt: new Date().toISOString() } : entry);
    const record = addAudit({ ...administration.record, invitations }, 'Organization invitation revoked', invitation.email);
    saveOrganizationRecord(record);
    return { ok: true, record, message: `Revoked the invitation for ${invitation.email}.` };
}

export function getOrganizationAdministrationAuditLog(organizationId) {
    return getOrganizationAdministration(organizationId)?.record.auditLog || [];
}

export function initializeAuthorizationAdministrationFramework() {
    return true;
}
