// Epic 51 foundation: local-first organization membership, roles, and an Authorization
// Policy Service. This module does not perform server-side enforcement; it establishes the
// client-side data model and policy checks that a future authenticated/server-backed
// implementation (Epics 49 and 52+) can build on without breaking local-only usage.
import { getDeviceIdentity, getCurrentAuthenticatedUser, getLocalUserProfile } from './identityFramework.js';

export const ORGANIZATION_ROLES = Object.freeze(['Owner', 'Admin', 'Editor', 'Contributor', 'Viewer']);

const ROLE_PERMISSIONS = Object.freeze({
    Owner: Object.freeze(['manageOrganization', 'manageMembers', 'manageRoles', 'manageProjects', 'editReports', 'deleteReports', 'manageTasks', 'manageProgressLogs', 'viewOnly']),
    Admin: Object.freeze(['manageMembers', 'manageRoles', 'manageProjects', 'editReports', 'deleteReports', 'manageTasks', 'manageProgressLogs', 'viewOnly']),
    Editor: Object.freeze(['manageProjects', 'editReports', 'manageTasks', 'manageProgressLogs', 'viewOnly']),
    Contributor: Object.freeze(['editReports', 'manageTasks', 'viewOnly']),
    Viewer: Object.freeze(['viewOnly'])
});

const MEMBERSHIP_KEY = 'art-organization-memberships-v1';
const IDENTITY_CODE_KEY = 'art-personal-identity-code-v1';
const LINKED_DEVICES_KEY = 'art-linked-devices-v1';

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '');
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeRole(role) {
    return ORGANIZATION_ROLES.includes(role) ? role : 'Viewer';
}

function normalizeMembership(input = {}, index = 0) {
    const source = input && typeof input === 'object' ? input : {};
    return {
        id: normalizeText(source.id) || createId(`org-membership-${index}`),
        organizationId: normalizeText(source.organizationId) || createId('organization'),
        organizationName: normalizeText(source.organizationName) || 'Untitled Organization',
        userId: normalizeText(source.userId) || getEffectiveUserId(),
        role: normalizeRole(source.role),
        addedAt: normalizeText(source.addedAt) || new Date().toISOString()
    };
}

function getEffectiveUserId() {
    return getCurrentAuthenticatedUser()?.id || getLocalUserProfile().localUserId;
}

export function getOrganizationMemberships() {
    const stored = readJson(MEMBERSHIP_KEY, []);
    return Array.isArray(stored) ? stored.map((entry, index) => normalizeMembership(entry, index)) : [];
}

function saveMemberships(memberships) {
    writeJson(MEMBERSHIP_KEY, memberships);
    window.dispatchEvent(new CustomEvent('art-organization-memberships-updated', { detail: memberships }));
    return memberships;
}

export function addOrganizationMembership(input = {}) {
    const memberships = getOrganizationMemberships();
    const membership = normalizeMembership({ ...input, userId: input.userId || getEffectiveUserId() }, memberships.length);
    saveMemberships([...memberships, membership]);
    return membership;
}

export function updateOrganizationMembershipRole(membershipId, role) {
    const id = normalizeText(membershipId);
    let updated = null;
    const memberships = getOrganizationMemberships().map((membership) => {
        if (membership.id !== id) return membership;
        updated = { ...membership, role: normalizeRole(role) };
        return updated;
    });
    saveMemberships(memberships);
    return updated;
}

export function removeOrganizationMembership(membershipId) {
    const id = normalizeText(membershipId);
    const memberships = getOrganizationMemberships();
    const membership = memberships.find((entry) => entry.id === id) || null;
    saveMemberships(memberships.filter((entry) => entry.id !== id));
    return membership;
}

export function getRolePermissions(role) {
    return ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS.Viewer;
}

// Central Authorization Policy Service: the single place ART should ask "may this user do this?"
export function canPerformAction(organizationId, action) {
    const orgId = normalizeText(organizationId);
    const userId = getEffectiveUserId();
    const membership = getOrganizationMemberships().find((entry) => entry.organizationId === orgId && entry.userId === userId);
    if (!membership) return false;
    return getRolePermissions(membership.role).includes(normalizeText(action));
}

export function getMembershipForOrganization(organizationId) {
    const orgId = normalizeText(organizationId);
    const userId = getEffectiveUserId();
    return getOrganizationMemberships().find((entry) => entry.organizationId === orgId && entry.userId === userId) || null;
}

// Personal ART Identity Code: a client-only linking passphrase placeholder. Verifying a code
// from another installation requires a server or peer channel, which is out of scope until
// Epic 49's authentication service exists. Today this only supports viewing/regenerating the
// current device's code and recognizing this device's own code (a trivial self-check).
function generateIdentityCode() {
    const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ART-${segment()}-${segment()}-${segment()}`;
}

export function getPersonalIdentityCode() {
    const stored = readJson(IDENTITY_CODE_KEY, null);
    if (stored && typeof stored === 'object' && normalizeText(stored.code)) return stored;
    const record = { code: generateIdentityCode(), createdAt: new Date().toISOString() };
    writeJson(IDENTITY_CODE_KEY, record);
    return record;
}

export function regeneratePersonalIdentityCode() {
    const record = { code: generateIdentityCode(), createdAt: new Date().toISOString() };
    writeJson(IDENTITY_CODE_KEY, record);
    window.dispatchEvent(new CustomEvent('art-personal-identity-code-updated', { detail: record }));
    return record;
}

export function getLinkedDevices() {
    const stored = readJson(LINKED_DEVICES_KEY, []);
    const devices = Array.isArray(stored) ? stored : [];
    const current = getDeviceIdentity();
    if (devices.some((device) => device.id === current.id)) return devices;
    const withCurrent = [...devices, { id: current.id, addedAt: current.createdAt, isCurrentDevice: true }];
    writeJson(LINKED_DEVICES_KEY, withCurrent);
    return withCurrent;
}

export function unlinkDevice(deviceId) {
    const id = normalizeText(deviceId);
    const current = getDeviceIdentity();
    if (id === current.id) return { ok: false, message: 'The current device cannot unlink itself.' };
    const devices = getLinkedDevices().filter((device) => device.id !== id);
    writeJson(LINKED_DEVICES_KEY, devices);
    return { ok: true, devices };
}

// Cross-device verification requires a server or peer channel (deferred to Epic 49+).
export function linkDeviceWithCode(code) {
    const submitted = normalizeText(code);
    const own = getPersonalIdentityCode();
    if (!submitted) return { ok: false, message: 'Enter a personal ART identity code.' };
    if (submitted === own.code) return { ok: true, message: 'This code already matches the current device.' };
    return { ok: false, message: 'Linking a different ART installation requires ART\u2019s server-based identity service, which is not yet available. This device\u2019s code can be shared once that service is ready.' };
}

export function initializeAuthorizationFramework() {
    getOrganizationMemberships();
    getPersonalIdentityCode();
    getLinkedDevices();
    return true;
}
