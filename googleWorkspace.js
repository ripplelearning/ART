const GOOGLE_WORKSPACE_REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets'
];

let activeAccessToken = '';

function getGoogleOAuthClient() {
    return window.google?.accounts?.oauth2 || null;
}

function mapTokenResponseToConnectionState(response) {
    const now = Date.now();
    const expiresInSeconds = Number(response?.expires_in || 0);
    activeAccessToken = String(response?.access_token || '').trim();
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
        accountEmail: '',
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

export function connectGoogleWorkspace(config = {}) {
    const clientId = String(config.clientId || '').trim();
    if (!clientId) {
        return Promise.resolve({
            ok: false,
            status: 'error',
            lastError: 'Google Client ID is required before connecting.'
        });
    }

    const oauth2 = getGoogleOAuthClient();
    if (!oauth2) {
        return Promise.resolve({
            ok: false,
            status: 'error',
            lastError: 'Google OAuth client is not available. Add Google Identity Services before connecting.'
        });
    }

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
                    resolve(mapTokenResponseToConnectionState(response));
                }
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (error) {
            resolve(mapOAuthError(error));
        }
    });
}

export function reconnectGoogleWorkspace(config = {}) {
    return connectGoogleWorkspace(config);
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

export async function uploadBlobToGoogleDrive({ blob, fileName, mimeType = '', parentFolderId = '' } = {}) {
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
