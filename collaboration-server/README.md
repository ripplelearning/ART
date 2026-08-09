# ART Collaboration Server

This server provides the shared network coordination layer required for:

- live multi-user collaboration sessions
- asynchronous collaboration through shared network storage (for example a shared drive folder)

## Features

- WebSocket live collaboration endpoint (default: `ws://localhost:8787/art-live`)
- Optional token-gated handshake
- Snapshot publish/pull protocol for asynchronous collaboration
- Shared-folder persistence for snapshots (`ART_COLLAB_SHARED_FOLDER`)
- Health and snapshot HTTP APIs

## Quick Start

1. Open a terminal in `collaboration-server`.
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. In ART Settings > Collaboration > Live Collaboration Quick Start:
- set `Live collaboration server URL` to `ws://localhost:8787/art-live`
- click `Quick Start Live Collaboration`

Windows one-command launcher:

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-collaboration-server.ps1
```

To launch and automatically open a browser tab for server health:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-collaboration-server-and-open-health.ps1
```

With shared-folder persistence:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-collaboration-server.ps1 -SharedFolder "\\server\share\art-collab"
```

With shared token protection:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-collaboration-server.ps1 -Token "replace-with-shared-secret"
```

## Environment Variables

- `ART_COLLAB_HOST` (default: `0.0.0.0`)
- `ART_COLLAB_PORT` (default: `8787`)
- `ART_COLLAB_WS_PATH` (default: `/art-live`)
- `ART_COLLAB_TOKEN` (optional shared token required at handshake)
- `ART_COLLAB_SHARED_FOLDER` (optional folder path for async snapshot persistence)

## Asynchronous Shared-Folder Workflow

1. Configure `ART_COLLAB_SHARED_FOLDER` to a shared network location accessible by the collaboration server process.
2. User A connects and uses `Publish Async Snapshot`.
3. User B connects and uses `Pull Async Snapshot`.
4. ART applies the pulled collaboration metadata snapshot.

This enables asynchronous collaboration even when users are not editing simultaneously.

## Disconnect and Session End

- Users can end active networking by selecting `Disconnect Server` in ART.
- To remove transient presence records, use `Clear Collaboration Sessions` in ART.
- On Windows, stop the local coordination process with:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-collaboration-server.ps1
```

## HTTP Endpoints

- `GET /health`
- `GET /api/snapshots/:workspaceId`
- `POST /api/snapshots/:workspaceId`

`POST` body can be:

```json
{
  "source": "automation",
  "snapshot": {
    "workspaceId": "workspace-one",
    "workspaceName": "Workspace One",
    "generatedAt": "2026-01-01T00:00:00.000Z",
    "collaborationMode": "asynchronous",
    "collaborationResources": {}
  }
}
```
