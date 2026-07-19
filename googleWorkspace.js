import { canPerformExternalCommunication } from './state.js';

const GOOGLE_WORKSPACE_REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
];

let activeAccessToken = '';

// Keep in-memory auth session aligned with profile reset operations.
if (typeof window !== 'undefined') {
    window.addEventListener('art-state-restored', () => {
        activeAccessToken = '';
    });
}

const OFFICIAL_ART_GOOGLE_OAUTH_CLIENT_ID = '44958493984-5n21mikbvrovhhs35bdj6kr6gsq12d4g.apps.googleusercontent.com';

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => script.src === src);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function ensureGoogleIdentityServicesLoaded() {
    if (getGoogleOAuthClient()) return true;
    await loadExternalScript('https://accounts.google.com/gsi/client');
    return Boolean(getGoogleOAuthClient());
}

function getGoogleOAuthClient() {
    return window.google?.accounts?.oauth2 || null;
}

function getConfiguredGoogleOAuthClientId() {
    const globalClientId = String(window.ART_GOOGLE_OAUTH_CLIENT_ID || '').trim();
    if (globalClientId) return globalClientId;
    return String(OFFICIAL_ART_GOOGLE_OAUTH_CLIENT_ID || '').trim();
}

async function getGoogleAccountEmail(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) return '';
        const payload = await response.json();
        return String(payload?.email || '').trim();
    } catch (error) {
        return '';
    }
}

async function mapTokenResponseToConnectionState(response) {
    const now = Date.now();
    const expiresInSeconds = Number(response?.expires_in || 0);
    activeAccessToken = String(response?.access_token || '').trim();
    const accountEmail = activeAccessToken ? await getGoogleAccountEmail(activeAccessToken) : '';
    const expiresAt = expiresInSeconds > 0
        ? new Date(now + (expiresInSeconds * 1000)).toISOString()
        : '';

    return {
        ok: true,
        status: 'connected',
        connectedAt: new Date(now).toISOString(),
        expiresAt,
        scopes: Array.isArray(response?.scope)
            ? response.scope
            : String(response?.scope || '').split(/\s+/).map((item) => item.trim()).filter(Boolean),
        accountEmail,
        accountName: '',
        lastError: ''
    };
}

function mapOAuthError(error) {
    const detail = typeof error === 'string' ? error : error?.message || error?.error || 'Unknown error';
    return {
        ok: false,
        status: 'error',
        lastError: String(detail || 'Google authentication failed.')
    };
}

async function parseErrorResponse(response) {
    try {
        const payload = await response.json();
        return String(payload?.error?.message || payload?.error_description || '').trim();
    } catch (error) {
        return '';
    }
}

function buildDriveMultipartBody(metadata, blob, boundary) {
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const fileHeader = `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;
    return new Blob([metadataPart, fileHeader, blob, closing], {
        type: `multipart/related; boundary=${boundary}`
    });
}

export function getRequiredGoogleWorkspaceScopes() {
    return [...GOOGLE_WORKSPACE_REQUIRED_SCOPES];
}

export function hasGoogleWorkspaceAccessToken() {
    return Boolean(activeAccessToken);
}

export function extractGoogleDriveFileId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const directId = raw.match(/^[a-zA-Z0-9_-]{20,}$/);
    if (directId) return directId[0];

    try {
        const url = new URL(raw);
        const fromQuery = url.searchParams.get('id');
        if (fromQuery) return fromQuery;

        const parts = url.pathname.split('/').filter(Boolean);
        const dIndex = parts.indexOf('d');
        if (dIndex >= 0 && parts[dIndex + 1]) return parts[dIndex + 1];
    } catch (error) {
        return '';
    }

    return '';
}

export async function connectGoogleWorkspace(config = {}) {
    if (!canPerformExternalCommunication()) {
        return Promise.resolve({
            ok: false,
            status: 'error',
            lastError: 'Privacy Mode is enabled. External integrations are blocked.'
        });
    }

    const clientId = getConfiguredGoogleOAuthClientId();
    if (!clientId) {
        return {
            ok: false,
            status: 'error',
            lastError: 'Google Workspace is not configured for this ART build. Contact your administrator or developer build maintainer.'
        };
    }

    try {
        const loaded = await ensureGoogleIdentityServicesLoaded();
        if (!loaded) {
            return {
                ok: false,
                status: 'error',
                lastError: 'Google OAuth client is not available. Add Google Identity Services before connecting.'
            };
        }
    } catch (error) {
        return {
            ok: false,
            status: 'error',
            lastError: String(error?.message || 'Could not load Google Identity Services.')
        };
    }

    const oauth2 = getGoogleOAuthClient();
    if (!oauth2) {
        return {
            ok: false,
            status: 'error',
            lastError: 'Google OAuth client is not available. Add Google Identity Services before connecting.'
        };
    }

    const loginHint = String(config?.loginHint || '').trim();

    return new Promise((resolve) => {
        try {
            const tokenClient = oauth2.initTokenClient({
                client_id: clientId,
                scope: GOOGLE_WORKSPACE_REQUIRED_SCOPES.join(' '),
                callback: (response) => {
                    if (response?.error) {
                        resolve(mapOAuthError(response));
                        return;
                    }
                    mapTokenResponseToConnectionState(response).then(resolve).catch((error) => {
                        resolve(mapOAuthError(error));
                    });
                }
            });
            tokenClient.requestAccessToken({
                prompt: 'consent',
                ...(loginHint ? { login_hint: loginHint } : {})
            });
        } catch (error) {
            resolve(mapOAuthError(error));
        }
    });
}

export function disconnectGoogleWorkspace() {
    activeAccessToken = '';
    return {
        ok: true,
        status: 'disconnected',
        accountEmail: '',
        accountName: '',
        connectedAt: '',
        expiresAt: '',
        scopes: [],
        lastError: ''
    };
}

export async function downloadGoogleDriveTextFile(fileId) {
    if (!canPerformExternalCommunication()) {
        return {
            ok: false,
            lastError: 'Privacy Mode is enabled. External integrations are blocked.'
        };
    }

    if (!hasGoogleWorkspaceAccessToken()) {
        return {
            ok: false,
            lastError: 'Google Workspace access token is not available. Connect Google Workspace first.'
        };
    }

    const resolvedId = extractGoogleDriveFileId(fileId);
    if (!resolvedId) {
        return {
            ok: false,
            lastError: 'Could not resolve Google Drive file ID. Provide a valid file ID or URL.'
        };
    }

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resolvedId)}?alt=media`, {
            headers: {
                Authorization: `Bearer ${activeAccessToken}`
            }
        });

        if (!response.ok) {
            const message = await parseErrorResponse(response);
            return {
                ok: false,
                lastError: message || `Google Drive download failed (${response.status}).`
            };
        }

        const text = await response.text();
        return {
            ok: true,
            fileId: resolvedId,
            text
        };
    } catch (error) {
        return {
            ok: false,
            lastError: String(error?.message || 'Google Drive download failed.')
        };
    }
}

export async function downloadGoogleSheetAsTsv(spreadsheetIdOrUrl, range = 'A1:ZZ2000') {
    if (!canPerformExternalCommunication()) {
        return {
            ok: false,
            lastError: 'Privacy Mode is enabled. External integrations are blocked.'
        };
    }

    if (!hasGoogleWorkspaceAccessToken()) {
        return {
            ok: false,
            lastError: 'Google Workspace access token is not available. Connect Google Workspace first.'
        };
    }

    const spreadsheetId = extractGoogleDriveFileId(spreadsheetIdOrUrl);
    if (!spreadsheetId) {
        return {
            ok: false,
            lastError: 'Could not resolve Google Sheets spreadsheet ID. Provide a valid file ID or URL.'
        };
    }

    const safeRange = String(range || 'A1:ZZ2000').trim() || 'A1:ZZ2000';

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(safeRange)}?majorDimension=ROWS`, {
            headers: {
                Authorization: `Bearer ${activeAccessToken}`
            }
        });

        if (!response.ok) {
            const message = await parseErrorResponse(response);
            return {
                ok: false,
                lastError: message || `Google Sheets download failed (${response.status}).`
            };
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.values) ? payload.values : [];
        if (rows.length === 0) {
            return {
                ok: false,
                lastError: 'No rows were returned from the selected Google Sheet range.'
            };
        }

        const tsv = rows.map((row) => (Array.isArray(row) ? row : [row]).map((cell) => String(cell || '').replace(/\t/g, ' ')).join('\t')).join('\n');
        return {
            ok: true,
            spreadsheetId,
            range: safeRange,
            tsv
        };
    } catch (error) {
        return {
            ok: false,
            lastError: String(error?.message || 'Google Sheets download failed.')
        };
    }
}

export async function uploadBlobToGoogleDrive({ blob, fileName, mimeType = '', parentFolderId = '' } = {}) {
    if (!canPerformExternalCommunication()) {
        return {
            ok: false,
            lastError: 'Privacy Mode is enabled. External integrations are blocked.'
        };
    }

    if (!hasGoogleWorkspaceAccessToken()) {
        return {
            ok: false,
            lastError: 'Google Workspace access token is not available. Reconnect in Application Settings.'
        };
    }

    if (!(blob instanceof Blob)) {
        return {
            ok: false,
            lastError: 'No export file is available to upload.'
        };
    }

    const safeName = String(fileName || 'ART Export').trim() || 'ART Export';
    const metadata = { name: safeName };
    if (String(parentFolderId || '').trim()) {
        metadata.parents = [String(parentFolderId).trim()];
    }
    if (String(mimeType || '').trim()) {
        metadata.mimeType = String(mimeType || '').trim();
    }

    const boundary = `art_boundary_${Date.now()}`;
    const body = buildDriveMultipartBody(metadata, blob, boundary);

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${activeAccessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        });

        if (!response.ok) {
            const message = await parseErrorResponse(response);
            return {
                ok: false,
                lastError: message || `Google Drive upload failed (${response.status}).`
            };
        }

        const payload = await response.json();
        return {
            ok: true,
            fileId: String(payload?.id || ''),
            fileName: String(payload?.name || safeName),
            webViewLink: String(payload?.webViewLink || '')
        };
    } catch (error) {
        return {
            ok: false,
            lastError: String(error?.message || 'Google Drive upload failed.')
        };
    }
}
