// Epic 54 foundation: a real Microsoft OneDrive storage provider plugged into the Epic 52
// provider-independent Storage Provider Interface. Uses MSAL.js (Microsoft's supported browser
// library, loaded dynamically) for OAuth 2.0 with PKCE (a public client; no client secret, since
// ART has no server to protect one) and the Microsoft Graph API restricted to the special "App
// Folder" (/me/drive/special/approot) via the least-privilege 'Files.ReadWrite.AppFolder' scope —
// OneDrive's equivalent of Google Drive's drive.file scope: ART only ever sees its own app folder,
// never the user's whole OneDrive.
//
// IMPORTANT: This module has not been exercised against a live Microsoft account. Using it requires
// an Azure AD app registration (a Client ID configured by an ART deployer/administrator in
// Application Settings), which is outside what this session can provision or verify. Treat this as
// groundwork, not a tested end-to-end integration.
const CLIENT_ID_KEY = 'art-onedrive-client-id-v1';
const SESSION_TOKEN_KEY = 'art-onedrive-session-v1';
const ONEDRIVE_SCOPES = ['Files.ReadWrite.AppFolder'];
const MSAL_SCRIPT_URL = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

let msalScriptLoadPromise = null;
let msalClient = null;

function normalizeText(value) {
    return String(value ?? '').trim();
}

export function getOneDriveClientId() {
    return normalizeText(localStorage.getItem(CLIENT_ID_KEY));
}

export function setOneDriveClientId(clientId) {
    const id = normalizeText(clientId);
    if (id) localStorage.setItem(CLIENT_ID_KEY, id);
    else localStorage.removeItem(CLIENT_ID_KEY);
    msalClient = null;
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

export function getOneDriveConnectionStatus() {
    const token = readSessionToken();
    if (!token || !token.accessToken) return { connected: false };
    const isExpired = !token.expiresAt || new Date(token.expiresAt).getTime() <= Date.now();
    return isExpired ? { connected: false, expired: true } : { connected: true, expiresAt: token.expiresAt };
}

function loadMsalScript() {
    if (globalThis.msal?.PublicClientApplication) return Promise.resolve();
    if (msalScriptLoadPromise) return msalScriptLoadPromise;
    msalScriptLoadPromise = new Promise((resolve, reject) => {
        // Mirrors the Google Drive provider's fix: never let a blocked/hanging network request
        // leave connect() pending forever with no user feedback.
        const timeoutId = setTimeout(() => {
            msalScriptLoadPromise = null;
            reject(new Error('Microsoft OneDrive could not be reached. Check your network connection and try again.'));
        }, 8000);
        const script = document.createElement('script');
        script.src = MSAL_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };
        script.onerror = () => {
            clearTimeout(timeoutId);
            msalScriptLoadPromise = null;
            reject(new Error('Could not load the Microsoft Authentication Library script.'));
        };
        document.head.appendChild(script);
    });
    return msalScriptLoadPromise;
}

function ensureMsalClient(clientId) {
    if (msalClient) return msalClient;
    msalClient = new globalThis.msal.PublicClientApplication({
        auth: { clientId, authority: 'https://login.microsoftonline.com/common' },
        cache: { cacheLocation: 'sessionStorage' }
    });
    return msalClient;
}

export async function connectOneDrive() {
    const clientId = getOneDriveClientId();
    if (!clientId) {
        return { ok: false, message: 'Configure a Microsoft OneDrive Application (Client) ID in Application Settings before connecting.' };
    }
    try {
        await loadMsalScript();
    } catch (error) {
        return { ok: false, message: error.message || 'Microsoft OneDrive could not be reached.' };
    }
    const client = ensureMsalClient(clientId);
    try {
        // The popup can be blocked or abandoned without ever rejecting; a timeout prevents an
        // indefinite hang, matching the fix already applied to the Google Drive provider.
        const result = await Promise.race([
            client.loginPopup({ scopes: ONEDRIVE_SCOPES }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Microsoft OneDrive authorization did not complete. If a popup was blocked, allow popups for this site and try again.')), 60000))
        ]);
        writeSessionToken({
            accessToken: result.accessToken,
            expiresAt: result.expiresOn ? new Date(result.expiresOn).toISOString() : new Date(Date.now() + 3600000).toISOString(),
            account: result.account || null
        });
        return { ok: true, message: 'Microsoft OneDrive connected for this session.' };
    } catch (error) {
        return { ok: false, message: error.message || 'Microsoft OneDrive authorization was not completed.' };
    }
}

export function disconnectOneDrive() {
    const token = readSessionToken();
    writeSessionToken(null);
    if (msalClient && token?.account) {
        const account = msalClient.getAccountByHomeId?.(token.account.homeAccountId) || token.account;
        msalClient.logoutPopup?.({ account }).catch(() => {});
    }
    return { ok: true, message: 'Microsoft OneDrive disconnected. Local files were not affected.' };
}

function requireAccessToken() {
    const status = getOneDriveConnectionStatus();
    if (!status.connected) throw new Error('Microsoft OneDrive is not connected.');
    return readSessionToken().accessToken;
}

async function graphFetch(path, options = {}) {
    const accessToken = requireAccessToken();
    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Microsoft OneDrive request failed (${response.status}).`);
    return response;
}

export async function listArtFiles() {
    const response = await graphFetch('/me/drive/special/approot/children?$select=id,name,lastModifiedDateTime');
    const data = await response.json();
    const items = Array.isArray(data.value) ? data.value : [];
    return items.filter((item) => normalizeText(item.name).toLowerCase().endsWith('.art'));
}

export async function downloadArtFileContent(itemId) {
    const response = await graphFetch(`/me/drive/items/${encodeURIComponent(itemId)}/content`);
    return response.text();
}

export async function createArtFile(name, content) {
    const response = await graphFetch(`/me/drive/special/approot:/${encodeURIComponent(normalizeText(name))}:/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: content
    });
    return response.json();
}

export async function updateArtFile(itemId, content) {
    const response = await graphFetch(`/me/drive/items/${encodeURIComponent(itemId)}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: content
    });
    return response.json();
}
