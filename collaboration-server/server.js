import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { WebSocketServer } from 'ws';

const HOST = process.env.ART_COLLAB_HOST || '0.0.0.0';
const PORT = Number(process.env.ART_COLLAB_PORT || 8787);
const WS_PATH = process.env.ART_COLLAB_WS_PATH || '/art-live';
const AUTH_TOKEN = String(process.env.ART_COLLAB_TOKEN || '').trim();
const SHARED_FOLDER = String(process.env.ART_COLLAB_SHARED_FOLDER || '').trim();
const SNAPSHOT_FILE_PREFIX = 'workspace-';
const SNAPSHOT_FILE_EXT = '.json';

const clients = new Set();
const snapshotStore = new Map();

function nowIso() {
  return new Date().toISOString();
}

function safeText(value) {
  return String(value || '').trim();
}

function safeWorkspaceId(value) {
  const raw = safeText(value) || 'workspace';
  return raw.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function workspaceFilePath(workspaceId) {
  return path.join(SHARED_FOLDER, `${SNAPSHOT_FILE_PREFIX}${safeWorkspaceId(workspaceId)}${SNAPSHOT_FILE_EXT}`);
}

async function ensureSharedFolder() {
  if (!SHARED_FOLDER) return;
  await fs.mkdir(SHARED_FOLDER, { recursive: true });
}

async function writeSnapshotToDisk(workspaceId, record) {
  if (!SHARED_FOLDER) return;
  await ensureSharedFolder();
  const filePath = workspaceFilePath(workspaceId);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
}

async function readSnapshotFromDisk(workspaceId) {
  if (!SHARED_FOLDER) return null;
  const filePath = workspaceFilePath(workspaceId);
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

function getSnapshotRecord(workspaceId) {
  const key = safeWorkspaceId(workspaceId);
  return snapshotStore.get(key) || null;
}

function setSnapshotRecord(workspaceId, record) {
  const key = safeWorkspaceId(workspaceId);
  snapshotStore.set(key, record);
  return record;
}

function sendJson(target, payload) {
  try {
    target.send(JSON.stringify(payload));
  } catch {
    // Ignore failed sends to disconnected sockets.
  }
}

function broadcast(payload, predicate = () => true) {
  clients.forEach((client) => {
    if (client.readyState !== client.OPEN) return;
    if (!predicate(client)) return;
    sendJson(client, payload);
  });
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

async function resolveSnapshot(workspaceId) {
  const fromMemory = getSnapshotRecord(workspaceId);
  if (fromMemory) return fromMemory;

  const fromDisk = await readSnapshotFromDisk(workspaceId);
  if (fromDisk) {
    setSnapshotRecord(workspaceId, fromDisk);
    return fromDisk;
  }

  return null;
}

function normalizeSnapshotPayload(snapshot = {}, workspaceId = '') {
  const normalizedWorkspaceId = safeWorkspaceId(snapshot.workspaceId || workspaceId);
  const generatedAt = safeText(snapshot.generatedAt) || nowIso();
  const collaborationResources = snapshot.collaborationResources && typeof snapshot.collaborationResources === 'object'
    ? snapshot.collaborationResources
    : {};

  return {
    workspaceId: normalizedWorkspaceId,
    workspaceName: safeText(snapshot.workspaceName || normalizedWorkspaceId) || normalizedWorkspaceId,
    generatedAt,
    collaborationMode: safeText(snapshot.collaborationMode) || 'asynchronous',
    collaborationResources,
    meta: snapshot.meta && typeof snapshot.meta === 'object' ? snapshot.meta : {}
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    const body = {
      ok: true,
      name: 'art-collaboration-server',
      now: nowIso(),
      wsPath: WS_PATH,
      sharedFolderEnabled: Boolean(SHARED_FOLDER),
      sharedFolder: SHARED_FOLDER || null,
      clients: clients.size,
      snapshots: snapshotStore.size
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/snapshots/')) {
    const workspaceId = safeWorkspaceId(url.pathname.split('/').pop());
    const record = await resolveSnapshot(workspaceId);
    if (!record) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, reason: 'not-found', workspaceId }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, workspaceId, record }));
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/snapshots/')) {
    const workspaceId = safeWorkspaceId(url.pathname.split('/').pop());
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const payload = parseJson(Buffer.concat(chunks).toString('utf8'));
      if (!payload || typeof payload !== 'object') {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, reason: 'invalid-json' }));
        return;
      }

      const snapshot = normalizeSnapshotPayload(payload.snapshot || payload, workspaceId);
      const previous = getSnapshotRecord(workspaceId);
      const version = Number(previous?.version || 0) + 1;
      const record = {
        workspaceId,
        version,
        updatedAt: nowIso(),
        source: safeText(payload.source || 'http'),
        snapshot
      };

      setSnapshotRecord(workspaceId, record);
      await writeSnapshotToDisk(workspaceId, record);

      broadcast({
        type: 'art-collaboration-snapshot-available',
        at: nowIso(),
        workspaceId,
        version,
        source: record.source
      });

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, workspaceId, version }));
    });
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, reason: 'not-found' }));
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
  if (url.pathname !== WS_PATH) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.meta = {
    id: `client-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    userId: '',
    workspaceId: '',
    connectedAt: nowIso(),
    authenticated: AUTH_TOKEN ? false : true
  };

  clients.add(ws);

  sendJson(ws, {
    type: 'art-collaboration-server-ready',
    at: nowIso(),
    wsPath: WS_PATH,
    requiresToken: Boolean(AUTH_TOKEN),
    sharedFolderEnabled: Boolean(SHARED_FOLDER)
  });

  ws.on('message', async (raw) => {
    const message = parseJson(raw);
    if (!message || typeof message !== 'object') {
      sendJson(ws, { type: 'art-collaboration-error', at: nowIso(), reason: 'invalid-json' });
      return;
    }

    const type = safeText(message.type);

    if (type === 'art-collaboration-handshake') {
      const token = safeText(message.token);
      if (AUTH_TOKEN && token !== AUTH_TOKEN) {
        sendJson(ws, { type: 'art-collaboration-error', at: nowIso(), reason: 'unauthorized' });
        ws.close(1008, 'Unauthorized');
        return;
      }

      ws.meta.authenticated = true;
      ws.meta.userId = safeText(message.userId) || ws.meta.userId;
      ws.meta.workspaceId = safeWorkspaceId(message.workspaceId || ws.meta.workspaceId || 'workspace');

      sendJson(ws, {
        type: 'art-collaboration-handshake-ack',
        at: nowIso(),
        clientId: ws.meta.id,
        workspaceId: ws.meta.workspaceId,
        userId: ws.meta.userId,
        sharedFolderEnabled: Boolean(SHARED_FOLDER)
      });
      return;
    }

    if (!ws.meta.authenticated) {
      sendJson(ws, { type: 'art-collaboration-error', at: nowIso(), reason: 'handshake-required' });
      return;
    }

    if (type === 'art-collaboration-session-start') {
      const workspaceId = safeWorkspaceId(message.workspaceId || ws.meta.workspaceId || 'workspace');
      ws.meta.workspaceId = workspaceId;
      ws.meta.userId = safeText(message.userId) || ws.meta.userId;

      broadcast({
        type: 'art-collaboration-session-started',
        at: nowIso(),
        workspaceId,
        sessionId: safeText(message.sessionId),
        sessionName: safeText(message.sessionName),
        userId: ws.meta.userId
      }, (client) => client !== ws);
      return;
    }

    if (type === 'art-collaboration-snapshot-publish') {
      const workspaceId = safeWorkspaceId(message.workspaceId || ws.meta.workspaceId || 'workspace');
      const snapshot = normalizeSnapshotPayload(message.snapshot, workspaceId);
      const previous = getSnapshotRecord(workspaceId);
      const version = Number(previous?.version || 0) + 1;
      const record = {
        workspaceId,
        version,
        updatedAt: nowIso(),
        source: safeText(ws.meta.userId || 'ws'),
        persistence: safeText(message.persistence || 'shared-folder') || 'shared-folder',
        snapshot
      };

      setSnapshotRecord(workspaceId, record);
      await writeSnapshotToDisk(workspaceId, record);

      sendJson(ws, {
        type: 'art-collaboration-snapshot-published',
        at: nowIso(),
        requestId: safeText(message.requestId),
        workspaceId,
        version
      });

      broadcast({
        type: 'art-collaboration-snapshot-available',
        at: nowIso(),
        workspaceId,
        version,
        source: record.source
      }, (client) => client !== ws);
      return;
    }

    if (type === 'art-collaboration-snapshot-request') {
      const workspaceId = safeWorkspaceId(message.workspaceId || ws.meta.workspaceId || 'workspace');
      const record = await resolveSnapshot(workspaceId);

      sendJson(ws, {
        type: 'art-collaboration-snapshot-response',
        at: nowIso(),
        requestId: safeText(message.requestId),
        workspaceId,
        snapshot: record?.snapshot || null,
        version: Number(record?.version || 0),
        found: Boolean(record)
      });
      return;
    }

    if (type === 'art-collaboration-ping') {
      sendJson(ws, {
        type: 'art-collaboration-pong',
        at: nowIso()
      });
      return;
    }

    sendJson(ws, {
      type: 'art-collaboration-error',
      at: nowIso(),
      reason: 'unsupported-message-type',
      messageType: type
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

await ensureSharedFolder();

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[ART Collaboration Server] Listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[ART Collaboration Server] WebSocket path: ${WS_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`[ART Collaboration Server] Shared-folder mode: ${SHARED_FOLDER ? `enabled (${SHARED_FOLDER})` : 'disabled'}`);
  // eslint-disable-next-line no-console
  console.log(`[ART Collaboration Server] Token required: ${AUTH_TOKEN ? 'yes' : 'no'}`);
});
