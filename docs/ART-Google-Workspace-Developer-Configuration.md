# ART Google Workspace Developer Configuration

## Purpose
This document is for developers building custom ART distributions. It describes Google Workspace OAuth configuration that is intentionally excluded from the user-facing Application Settings UI.

## User-Facing Rule
End users must not be asked to configure:
- OAuth client IDs
- OAuth client secrets
- API keys
- Redirect URIs
- OAuth scopes
- Google Cloud project metadata

## Build-Time Configuration
ART reads Google OAuth client ID from one of the following developer-controlled sources:

1. `window.ART_GOOGLE_OAUTH_CLIENT_ID`
2. `OFFICIAL_ART_GOOGLE_OAUTH_CLIENT_ID` constant in `googleWorkspace.js`

For official ART builds, configure this value in the release pipeline or build process.

## Security Guidance
- Do not expose secrets in client-side code.
- Use least-privilege OAuth scopes.
- Keep scopes aligned with implemented features only.
- Ensure Privacy Mode can block all external communication paths.

## Current Scope Baseline
Initial connection requests:
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/userinfo.email`

Additional scopes are requested incrementally when the user selects features that require them.

Current incremental scope usage:
- `https://www.googleapis.com/auth/spreadsheets.readonly` only when importing standards from Google Sheets.

## Validation Checklist
- Confirm users can connect and disconnect from Settings -> Integrations.
- Confirm connected account email is displayed after authorization.
- Confirm external transfer requires explicit user approval.
- Confirm Privacy Mode blocks integration operations.
- Confirm no developer OAuth fields appear in user-facing settings.
