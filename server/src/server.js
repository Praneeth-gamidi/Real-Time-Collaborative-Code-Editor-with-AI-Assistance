import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB, DocumentModel, useMongo } from './db.js';
import aiRouter from './ai/router.js';
import authRouter from './auth/router.js';
import docsRouter from './docs/router.js';
import { verifyToken } from './auth/middleware.js';
import { WebSocketServer } from 'ws';
import yWsUtils from 'y-websocket/bin/utils';

// Prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();
app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/ai', aiRouter);
app.use('/auth', authRouter);
app.use('/docs', docsRouter);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Yjs WebSocket endpoint mounted at /yjs
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const { url } = request;
  if (url && url.startsWith('/yjs')) {
    try {
      if (process.env.JWT_REQUIRED === 'true') {
        const u = new URL(url, 'http://localhost');
        const token = u.searchParams.get('token');
        if (!token) throw new Error('Missing token');
        verifyToken(token);
      }
    } catch (e) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      yWsUtils.setupWSConnection(ws, request);
    });
  }
});

// In-memory fallback store when MongoDB is not configured
const memoryDocs = new Map(); // docId -> { content, version, cursors: Map<socketId, pos> }

function getDoc(docId) {
  return memoryDocs.get(docId) || { content: '', version: 0, cursors: new Map() };
}

io.on('connection', (socket) => {
  socket.on('join', async ({ docId, userId, username, token }) => {
    // Require valid JWT to join
    socket.join(docId);
    // Verify token and extract username
    let authUsername = username;
    if (token) {
      try {
        const decoded = verifyToken(token);
        authUsername = decoded.username || username;
      } catch (e) {
        console.warn('Invalid token during join:', e?.message);
      }
    }
    socket.data = { docId, userId, username: authUsername };

    // Load doc content
    let content = '';
    let version = 0;

    if (useMongo()) {
      const ok = await connectDB();
      if (ok) {
        try {
          let doc = await DocumentModel.findOne({ docId });
          if (!doc) {
            // Create new document with owner
            const decoded = verifyToken(token);
            // If this is a language docId (roomId::lang), also ensure base room meta doc exists
            const baseRoomId = typeof docId === 'string' && docId.includes('::') ? docId.split('::')[0] : null
            if (baseRoomId) {
              const meta = await DocumentModel.findOne({ docId: baseRoomId })
              if (!meta) {
                await DocumentModel.create({ docId: baseRoomId, content: '', version: 0, ownerEmail: decoded?.email || null, collaborators: [] })
              }
            }
            doc = await DocumentModel.create({ 
              docId, 
              content: '', 
              version: 0,
              ownerEmail: decoded?.email || null
            });
          }
          content = doc.content;
          version = doc.version;
        } catch (e) {
          console.error('MongoDB query failed, falling back to memory:', e?.message || e);
          const d = getDoc(docId);
          memoryDocs.set(docId, d);
          content = d.content;
          version = d.version;
        }
      } else {
        const d = getDoc(docId);
        memoryDocs.set(docId, d);
        content = d.content;
        version = d.version;
      }
    } else {
      const d = getDoc(docId);
      memoryDocs.set(docId, d);
      content = d.content;
      version = d.version;
    }

    io.to(socket.id).emit('init', { content, version, users: getUsersInRoom(docId) });
    socket.to(docId).emit('user-join', { userId, username });
  });

  socket.on('cursor', ({ position, selection }) => {
    const { docId, userId, username } = socket.data || {};
    if (!docId) return;
    socket.to(docId).emit('cursor', { userId, username, position, selection });
  });

  socket.on('op', async ({ docId, version, delta, source }) => {
    // Very basic conflict handling: only accept if client's version matches server version
    if (!docId) return;

    if (useMongo()) {
      const ok = await connectDB();
      if (ok) {
        try {
          const doc = await DocumentModel.findOne({ docId });
          if (!doc) return;
          if (version !== doc.version) {
            io.to(socket.id).emit('resync', { content: doc.content, version: doc.version });
            return;
          }
          const newContent = applyDelta(doc.content, delta);
          doc.content = newContent;
          doc.version += 1;
          await doc.save();
          io.to(docId).emit('op', { delta, version: doc.version, source });
        } catch (e) {
          console.error('MongoDB query failed, falling back to memory:', e?.message || e);
          const d = getDoc(docId);
          if (version !== d.version) {
            io.to(socket.id).emit('resync', { content: d.content, version: d.version });
            return;
          }
          d.content = applyDelta(d.content, delta);
          d.version += 1;
          memoryDocs.set(docId, d);
          io.to(docId).emit('op', { delta, version: d.version, source });
        }
      } else {
        const d = getDoc(docId);
        if (version !== d.version) {
          io.to(socket.id).emit('resync', { content: d.content, version: d.version });
          return;
        }
        d.content = applyDelta(d.content, delta);
        d.version += 1;
        memoryDocs.set(docId, d);
        io.to(docId).emit('op', { delta, version: d.version, source });
      }
    } else {
      const d = getDoc(docId);
      if (version !== d.version) {
        io.to(socket.id).emit('resync', { content: d.content, version: d.version });
        return;
      }
      d.content = applyDelta(d.content, delta);
      d.version += 1;
      memoryDocs.set(docId, d);
      io.to(docId).emit('op', { delta, version: d.version, source });
    }
  });

  socket.on('disconnect', () => {
    const { docId, userId, username } = socket.data || {};
    if (docId) socket.to(docId).emit('user-leave', { userId, username });
  });
});

function getUsersInRoom(room) {
  const clients = io.sockets.adapter.rooms.get(room);
  if (!clients) return [];
  const uniqueUsers = new Map();
  [...clients].forEach((sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s?.data?.userId && s?.data?.username) {
      uniqueUsers.set(s.data.userId, { userId: s.data.userId, username: s.data.username });
    }
  });
  return Array.from(uniqueUsers.values());
}

// Delta format: { type: 'replace', range: [start, end], text: '...' }
function applyDelta(content, delta) {
  if (!delta || delta.type !== 'replace') return content;
  const [start, end] = delta.range;
  return content.slice(0, start) + delta.text + content.slice(end);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
