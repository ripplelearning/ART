// Central identity/session boundary. Authentication providers are expected to validate
// credentials remotely; this module never receives, stores, or exposes their tokens.
export const AUTHENTICATION_STATES = Object.freeze({
    ANONYMOUS: 'anonymous',
    AUTHENTICATING: 'authenticating',
    AUTHENTICATED: 'authenticated',
    EXPIRED: 'expired',
    SIGNED_OUT: 'signed-out',
    UNAVAILABLE: 'unavailable'
});

const PROFILE_KEY = 'art-local-user-profile-v1';
const DEVICE_KEY = 'art-device-identity-v1';
const SESSION_KEY = 'art-authenticated-session-v1';
const providers = new Map();

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
        return value && typeof value === 'object' ? value : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeProfile(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    return {
        localUserId: normalizeText(source.localUserId) || createId('art-user'),
        name: normalizeText(source.name),
        displayName: normalizeText(source.displayName),
        email: normalizeText(source.email),
        jobTitle: normalizeText(source.jobTitle),
        artRole: normalizeText(source.artRole),
        updatedAt: normalizeText(source.updatedAt) || new Date().toISOString()
    };
}

function normalizeSession(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const state = Object.values(AUTHENTICATION_STATES).includes(source.state)
        ? source.state
        : AUTHENTICATION_STATES.ANONYMOUS;
    const expiresAt = normalizeText(source.expiresAt);
    const isExpired = expiresAt && new Date(expiresAt).getTime() <= Date.now();
    return {
        state: isExpired && state === AUTHENTICATION_STATES.AUTHENTICATED ? AUTHENTICATION_STATES.EXPIRED : state,
        user: source.user && typeof source.user === 'object'
            ? {
                id: normalizeText(source.user.id),
                provider: normalizeText(source.user.provider),
                providerSubject: normalizeText(source.user.providerSubject),
                displayName: normalizeText(source.user.displayName),
                email: normalizeText(source.user.email)
            }
            : null,
        issuedAt: normalizeText(source.issuedAt),
        expiresAt,
        deviceId: normalizeText(source.deviceId),
        message: normalizeText(source.message)
    };
}

function getStoredSession() {
    try {
        return normalizeSession(JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'));
    } catch {
        return normalizeSession();
    }
}

function saveSession(session) {
    const normalized = normalizeSession(session);
    // The session stores only non-secret identity metadata. Credential and token storage
    // must be supplied by a server/provider integration, never browser storage.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('art-authentication-state-changed', { detail: normalized }));
    return normalized;
}

export function getLocalUserProfile() {
    const stored = readJson(PROFILE_KEY, {});
    const profile = normalizeProfile(stored);
    if (!normalizeText(stored.localUserId)) writeJson(PROFILE_KEY, profile);
    return profile;
}

export function updateLocalUserProfile(updates = {}) {
    const profile = normalizeProfile({ ...getLocalUserProfile(), ...(updates || {}) });
    writeJson(PROFILE_KEY, profile);
    window.dispatchEvent(new CustomEvent('art-local-user-profile-updated', { detail: profile }));
    return profile;
}

export function getDeviceIdentity() {
    const stored = readJson(DEVICE_KEY, {});
    if (normalizeText(stored.id)) return { id: normalizeText(stored.id), createdAt: normalizeText(stored.createdAt) };
    const device = { id: createId('art-device'), createdAt: new Date().toISOString() };
    writeJson(DEVICE_KEY, device);
    return device;
}

export function getAuthenticationSession() {
    return getStoredSession();
}

export function getCurrentAuthenticatedUser() {
    const session = getStoredSession();
    return session.state === AUTHENTICATION_STATES.AUTHENTICATED && session.user?.id
        ? { ...session.user, deviceId: session.deviceId }
        : null;
}

export function isAuthenticated() {
    return Boolean(getCurrentAuthenticatedUser());
}

export function setAuthenticationUnavailable(message = 'Authentication service is unavailable.') {
    return saveSession({ state: AUTHENTICATION_STATES.UNAVAILABLE, message, deviceId: getDeviceIdentity().id });
}

export function beginAuthentication(providerId) {
    const provider = providers.get(normalizeText(providerId));
    if (!provider) return setAuthenticationUnavailable('The selected authentication provider is not configured.');
    return saveSession({ state: AUTHENTICATION_STATES.AUTHENTICATING, message: `Authenticating with ${provider.name}.`, deviceId: getDeviceIdentity().id });
}

// Providers call this only after server-side validation. It accepts no token or credential.
export function establishAuthenticatedSession(identity, options = {}) {
    const source = identity && typeof identity === 'object' ? identity : {};
    const userId = normalizeText(source.id);
    const providerId = normalizeText(source.provider);
    if (!userId || !providerId || !providers.has(providerId)) {
        return setAuthenticationUnavailable('A validated provider identity is required to establish a session.');
    }
    return saveSession({
        state: AUTHENTICATION_STATES.AUTHENTICATED,
        user: {
            id: userId,
            provider: providerId,
            providerSubject: normalizeText(source.providerSubject),
            displayName: normalizeText(source.displayName),
            email: normalizeText(source.email)
        },
        issuedAt: new Date().toISOString(),
        expiresAt: normalizeText(options.expiresAt),
        deviceId: getDeviceIdentity().id
    });
}

export function signOutAuthenticatedSession() {
    return saveSession({ state: AUTHENTICATION_STATES.SIGNED_OUT, deviceId: getDeviceIdentity().id, message: 'Signed out. Local ART data remains available.' });
}

export function registerAuthenticationProvider(definition) {
    const source = definition && typeof definition === 'object' ? definition : {};
    const id = normalizeText(source.id);
    if (!id) throw new Error('Authentication providers require an id.');
    const provider = {
        id,
        name: normalizeText(source.name) || id,
        begin: typeof source.begin === 'function' ? source.begin : null,
        version: normalizeText(source.version) || 'v1'
    };
    providers.set(id, provider);
    return { ...provider, begin: undefined };
}

export function getAuthenticationProviders() {
    return [...providers.values()].map(({ begin, ...provider }) => ({ ...provider }));
}

export function initializeIdentityFramework() {
    getLocalUserProfile();
    getDeviceIdentity();
    getStoredSession();
    return true;
}
