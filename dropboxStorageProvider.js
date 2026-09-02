// Epic 55 foundation: a real Dropbox storage provider plugged into the Epic 52 provider-independent
// Storage Provider Interface. Uses Dropbox's OAuth 2.0 Authorization Code flow with PKCE (a public
// client; no client secret, since ART has no server to protect one). Least privilege is achieved at
// the Dropbox app-registration level: an app registered with the "App folder" access type is
// automatically restricted to its own dedicated folder under Apps/<AppName> in the user's Dropbox,
// the same protection Google Drive's drive.file scope and OneDrive's Files.ReadWrite.AppFolder scope
// provide — ART never sees the rest of the user's Dropbox regardless of the scopes requested here.
//
// IMPORTANT: This module has not been exercised against a live Dropbox account. Using it requires a
// Dropbox app registered with "App folder" access (an App Key configured by an ART deployer/
// administrator in Application Settings), which is outside what this session can provision or
// verify. Treat this as groundwork, not a tested end-to-end integration.
const CLIENT_ID_KEY = 'art-dropbox-client-id-v1';
const SESSION_TOKEN_KEY = 'art-dropbox-session-v1';
const PKCE_VERIFIER_KEY = 'art-dropbox-pkce-verifier-v1';
const DROPBOX_SCOPES = 'files.content.write files.content.read';
const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API_BASE_URL = 'https://api.dropboxapi.com/2';
const CONTENT_BASE_URL = 'https://content.dropboxapi.com/2';

function normalizeText(value) {
    return String(value ?? '').trim();
}

export function getDropboxClientId() {
    return normalizeText(localStorage.getItem(CLIENT_ID_KEY));
}

export function setDropboxClientId(clientId) {
    const id = normalizeText(clientId);
    if (id) localStorage.setItem(CLIENT_ID_KEY, id);
    else localStorage.removeItem(CLIENT_ID_KEY);
    return id;
}

function readSessionToken() {
    try {
        const value = JSON.parse(sessionStorage.getItem(SESSION_TOKEN_KEY) || '');
        return value && typeof value === 'object' ? value : null;
    } catch {
        return null;
    }
}

function writeSessionToken(token) {
    if (!token) {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        return;
    }
    // Access tokens are session credentials: sessionStorage only, never localStorage, appState, or exports.
    sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(token));
}

export function getDropboxConnectionStatus() {
    const token = readSessionToken();
    if (!token || !token.accessToken) return { connected: false };
    const isExpired = !token.expiresAt || new Date(token.expiresAt).getTime() <= Date.now();
    return isExpired ? { connected: false, expired: true } : { connected: true, expiresAt: token.expiresAt };
}

function base64UrlEncode(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkcePair() {
    const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = base64UrlEncode(verifierBytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64UrlEncode(new Uint8Array(digest));
    return { verifier, challenge };
}

function waitForAuthorizationCode(authUrl, redirectOrigin) {
    return new Promise((resolve, reject) => {
        const popup = window.open(authUrl, 'dropbox-oauth', 'width=500,height=650');
        if (!popup) {
            reject(new Error('The Dropbox sign-in popup was blocked. Allow popups for this site and try again.'));
            return;
        }
        let settled = false;
        const cleanup = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
        // Neither a blocked/abandoned popup nor one stuck on Dropbox's domain (cross-origin, so its
        // URL cannot be read) would otherwise ever resolve or reject this promise.
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            if (!popup.closed) popup.close();
            reject(new Error('Dropbox authorization did not complete. If a popup was blocked, allow popups for this site and try again.'));
        }, 60000);
        const intervalId = setInterval(() => {
            if (settled) return;
            if (popup.closed) {
                settled = true;
                cleanup();
                reject(new Error('The Dropbox sign-in popup was closed before authorization completed.'));
                return;
            }
            let href = '';
            try {
                href = popup.location.href;
            } catch {
                return; // Still on Dropbox's cross-origin domain; check again on the next interval.
            }
            if (!href || !href.startsWith(redirectOrigin)) return;
            settled = true;
            cleanup();
            const url = new URL(href);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error_description') || url.searchParams.get('error');
            popup.close();
            if (error) reject(new Error(error));
            else if (code) resolve(code);
            else reject(new Error('Dropbox did not return an authorization code.'));
        }, 500);
    });
}

export async function connectDropbox() {
    const clientId = getDropboxClientId();
    if (!clientId) {
        return { ok: false, message: 'Configure a Dropbox App Key in Application Settings before connecting.' };
    }
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const { verifier, challenge } = await createPkcePair();
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

    const authUrl = `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=online&scope=${encodeURIComponent(DROPBOX_SCOPES)}`;

    let code;
    try {
        code = await waitForAuthorizationCode(authUrl, redirectUri);
    } catch (error) {
        return { ok: false, message: error.message || 'Dropbox authorization was not completed.' };
    }

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: clientId,
                redirect_uri: redirectUri,
                code_verifier: sessionStorage.getItem(PKCE_VERIFIER_KEY) || ''
            })
        });
        if (!response.ok) throw new Error(`Dropbox token exchange failed (${response.status}).`);
        const data = await response.json();
        writeSessionToken({
            accessToken: data.access_token,
            expiresAt: new Date(Date.now() + (Number(data.expires_in) || 14400) * 1000).toISOString()
        });
        return { ok: true, message: 'Dropbox connected for this session.' };
    } catch (error) {
        return { ok: false, message: error.message || 'Could not complete the Dropbox token exchange.' };
    } finally {
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    }
}

export function disconnectDropbox() {
    writeSessionToken(null);
    return { ok: true, message: 'Dropbox disconnected. Local files were not affected.' };
}

function requireAccessToken() {
    const status = getDropboxConnectionStatus();
    if (!status.connected) throw new Error('Dropbox is not connected.');
    return readSessionToken().accessToken;
}

export async function listArtFiles() {
    const accessToken = requireAccessToken();
    const response = await fetch(`${API_BASE_URL}/files/list_folder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '' })
    });
    if (!response.ok) throw new Error(`Dropbox request failed (${response.status}).`);
    const data = await response.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    return entries
        .filter((entry) => entry['.tag'] === 'file' && normalizeText(entry.name).toLowerCase().endsWith('.art'))
        .map((entry) => ({ id: entry.path_lower, name: entry.name, modifiedTime: entry.server_modified }));
}

export async function downloadArtFileContent(path) {
    const accessToken = requireAccessToken();
    const response = await fetch(`${CONTENT_BASE_URL}/files/download`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path })
        }
    });
    if (!response.ok) throw new Error(`Could not download the Dropbox file (${response.status}).`);
    return response.text();
}

async function uploadArtFile(path, content, mode) {
    const accessToken = requireAccessToken();
    const response = await fetch(`${CONTENT_BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({ path, mode, mute: true })
        },
        body: content
    });
    if (!response.ok) throw new Error(`Could not save the file to Dropbox (${response.status}).`);
    const data = await response.json();
    return { id: data.path_lower, name: data.name, modifiedTime: data.server_modified };
}

export function createArtFile(name, content) {
    return uploadArtFile(`/${normalizeText(name)}`, content, 'add');
}

export function updateArtFile(path, content) {
    return uploadArtFile(path, content, 'overwrite');
}
