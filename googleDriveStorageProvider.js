// Epic 53 foundation: a real Google Drive storage provider plugged into the Epic 52
// provider-independent Storage Provider Interface. Uses Google Identity Services (GIS) for OAuth
// (a public client-side token flow; no client secret, since ART has no server to protect one) and
// the Drive v3 REST API with the least-privilege 'drive.file' scope (only files ART creates or the
// user explicitly opens with the picker, never the user's whole Drive).
//
// IMPORTANT: This module has not been exercised against a live Google account. Using it requires a
// Google Cloud project with an OAuth 2.0 Client ID (configured by an ART deployer/administrator in
// Application Settings), which is outside what this session can provision or verify. Treat this as
// groundwork, not a tested end-to-end integration.
const CLIENT_ID_KEY = 'art-google-drive-client-id-v1';
const SESSION_TOKEN_KEY = 'art-google-drive-session-v1';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let gisScriptLoadPromise = null;
let tokenClient = null;

function normalizeText(value) {
    return String(value ?? '').trim();
}

export function getGoogleDriveClientId() {
    return normalizeText(localStorage.getItem(CLIENT_ID_KEY));
}

export function setGoogleDriveClientId(clientId) {
    const id = normalizeText(clientId);
    if (id) localStorage.setItem(CLIENT_ID_KEY, id);
    else localStorage.removeItem(CLIENT_ID_KEY);
    tokenClient = null;
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

export function getGoogleDriveConnectionStatus() {
    const token = readSessionToken();
    if (!token || !token.accessToken) return { connected: false };
    const isExpired = !token.expiresAt || new Date(token.expiresAt).getTime() <= Date.now();
    return isExpired ? { connected: false, expired: true } : { connected: true, expiresAt: token.expiresAt };
}

function loadGoogleIdentityServicesScript() {
    if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
    if (gisScriptLoadPromise) return gisScriptLoadPromise;
    gisScriptLoadPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            gisScriptLoadPromise = null;
            reject(new Error('Google Drive could not be reached. Check your network connection and try again.'));
        }, 8000);
        const script = document.createElement('script');
        script.src = GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };
        script.onerror = () => {
            clearTimeout(timeoutId);
            gisScriptLoadPromise = null;
            reject(new Error('Could not load the Google Identity Services script.'));
        };
        document.head.appendChild(script);
    });
    return gisScriptLoadPromise;
}

function ensureTokenClient(clientId, onToken) {
    if (tokenClient) return tokenClient;
    tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: onToken
    });
    return tokenClient;
}

export async function connectGoogleDrive() {
    const clientId = getGoogleDriveClientId();
    if (!clientId) {
        return { ok: false, message: 'Configure a Google Drive OAuth Client ID in Application Settings before connecting.' };
    }
    try {
        await loadGoogleIdentityServicesScript();
    } catch (error) {
        return { ok: false, message: error.message || 'Google Drive could not be reached.' };
    }
    return new Promise((resolve) => {
        let settled = false;
        // The browser may silently block the authorization popup (or the user may close it) without
        // ever invoking the token callback; without a timeout the caller would wait forever.
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ ok: false, message: 'Google Drive authorization did not complete. If a popup was blocked, allow popups for this site and try again.' });
        }, 60000);
        const client = ensureTokenClient(clientId, (response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (response?.error) {
                resolve({ ok: false, message: `Google Drive authorization was not completed: ${response.error}.` });
                return;
            }
            writeSessionToken({
                accessToken: response.access_token,
                expiresAt: new Date(Date.now() + (Number(response.expires_in) || 3600) * 1000).toISOString()
            });
            resolve({ ok: true, message: 'Google Drive connected for this session.' });
        });
        client.requestAccessToken({ prompt: '' });
    });
}

export function disconnectGoogleDrive() {
    const token = readSessionToken();
    if (token?.accessToken && globalThis.google?.accounts?.oauth2?.revoke) {
        globalThis.google.accounts.oauth2.revoke(token.accessToken, () => {});
    }
    writeSessionToken(null);
    return { ok: true, message: 'Google Drive disconnected. Local files were not affected.' };
}

function requireAccessToken() {
    const status = getGoogleDriveConnectionStatus();
    if (!status.connected) throw new Error('Google Drive is not connected.');
    return readSessionToken().accessToken;
}

async function driveFetch(path, options = {}) {
    const accessToken = requireAccessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Google Drive request failed (${response.status}).`);
    return response;
}

export async function listArtFiles(folderId = 'root') {
    const query = encodeURIComponent(`'${folderId}' in parents and name contains '.art' and trashed = false`);
    const response = await driveFetch(`files?q=${query}&fields=files(id,name,modifiedTime)`);
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
}

export async function downloadArtFileContent(fileId) {
    const response = await driveFetch(`files/${encodeURIComponent(fileId)}?alt=media`);
    return response.text();
}

export async function createArtFile(name, folderId, content) {
    const metadata = { name: normalizeText(name), parents: folderId ? [folderId] : undefined };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));
    const accessToken = requireAccessToken();
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });
    if (!response.ok) throw new Error(`Could not create the file in Google Drive (${response.status}).`);
    return response.json();
}

export async function updateArtFile(fileId, content) {
    const accessToken = requireAccessToken();
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: content
    });
    if (!response.ok) throw new Error(`Could not save the file to Google Drive (${response.status}).`);
    return response.json();
}
