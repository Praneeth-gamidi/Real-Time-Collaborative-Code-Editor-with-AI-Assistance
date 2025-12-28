import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { connectDB, DocumentModel, useMongo } from '../db.js';

const router = Router();

function baseRoomIdFromDocId(docId) {
  if (typeof docId !== 'string') return docId;
  return docId.includes('::') ? docId.split('::')[0] : docId;
}

// Save document content
router.post('/save', requireAuth, async (req, res) => {
  try {
    const { docId, content } = req.body || {};
    if (!docId || typeof content !== 'string') return res.status(400).json({ error: 'docId and content required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB not configured; persistence disabled' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });

    const email = req.user?.email;
    const baseRoomId = baseRoomIdFromDocId(docId);

    // Meta room doc stores owner/collaborators/join-requests
    let meta = await DocumentModel.findOne({ docId: baseRoomId });
    if (!meta) {
      // If missing, create it and make current user the owner (only for first-ever save)
      meta = await DocumentModel.create({ docId: baseRoomId, content: '', version: 0, ownerEmail: email || null, collaborators: [], history: [] });
    }

    const isOwner = !!email && meta.ownerEmail === email;
    const isCollaborator = !!email && (meta.collaborators || []).includes(email);
    if (meta.ownerEmail && !isOwner && !isCollaborator) return res.status(403).json({ error: 'Forbidden: not a collaborator' });

    // Language-specific doc stores content/history
    let doc = await DocumentModel.findOne({ docId });
    if (!doc) {
      doc = await DocumentModel.create({ docId, content, version: 1, ownerEmail: meta.ownerEmail || null, collaborators: meta.collaborators || [], history: [{ version: 1, content, email }] });
      return res.json({ ok: true, docId, version: doc.version, ownerEmail: doc.ownerEmail });
    }

    doc.version += 1;
    doc.content = content;
    doc.history.push({ version: doc.version, content, email });
    await doc.save();
    return res.json({ ok: true, docId, version: doc.version });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Invite collaborator by email
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { docId, email } = req.body || {};
    if (!docId || !email) return res.status(400).json({ error: 'docId and email required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB not configured' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const doc = await DocumentModel.findOne({ docId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const requester = req.user?.email;
    if (doc.ownerEmail !== requester) return res.status(403).json({ error: 'Only owner can invite' });
    if (!doc.collaborators.includes(email)) doc.collaborators.push(email);
    await doc.save();
    return res.json({ ok: true, collaborators: doc.collaborators });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/request-join', requireAuth, async (req, res) => {
  try {
    const { docId } = req.body || {};
    const requesterEmail = req.user.email;
    const requesterUsername = req.user.username || 'User';
    if (!docId) return res.status(400).json({ error: 'docId required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB required' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const doc = await DocumentModel.findOne({ docId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    // Store pending join request
    if (!doc.pendingJoinRequests) doc.pendingJoinRequests = [];
    // Avoid duplicate requests
    if (doc.pendingJoinRequests.some(req => req.email === requesterEmail)) {
      return res.status(409).json({ error: 'Join request already sent' });
    }
    doc.pendingJoinRequests.push({
      email: requesterEmail,
      username: requesterUsername,
      requestedAt: new Date()
    });
    await doc.save();
    // TODO: Notify room owner via socket or email
    return res.json({ ok: true, message: 'Join request sent to room owner' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/pending-requests', requireAuth, async (req, res) => {
  try {
    const { docId } = req.query || {};
    const email = req.user.email;
    if (!docId) return res.status(400).json({ error: 'docId required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB required' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const doc = await DocumentModel.findOne({ docId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.ownerEmail !== email) return res.status(403).json({ error: 'Only owner can view requests' });
    return res.json({ pendingRequests: doc.pendingJoinRequests || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/approve-request', requireAuth, async (req, res) => {
  try {
    const { docId, requesterEmail, approve } = req.body || {};
    const email = req.user.email;
    if (!docId || !requesterEmail) return res.status(400).json({ error: 'docId and requesterEmail required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB required' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const doc = await DocumentModel.findOne({ docId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.ownerEmail !== email) return res.status(403).json({ error: 'Only owner can approve requests' });
    
    // Remove from pending requests
    doc.pendingJoinRequests = doc.pendingJoinRequests.filter(req => req.email !== requesterEmail);
    
    if (approve) {
      // Add to collaborators if not already there
      if (!doc.collaborators.includes(requesterEmail)) {
        doc.collaborators.push(requesterEmail);
      }
    }
    
    await doc.save();
    return res.json({ ok: true, approved: approve });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/access-status', requireAuth, async (req, res) => {
  try {
    const { docId } = req.query || {};
    const email = req.user?.email;
    if (!docId) return res.status(400).json({ error: 'docId required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB required' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const doc = await DocumentModel.findOne({ docId }, { ownerEmail: 1, collaborators: 1, pendingJoinRequests: 1, _id: 0 });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const isOwner = !!email && doc.ownerEmail === email;
    const isCollaborator = !!email && (doc.collaborators || []).includes(email);
    if (isOwner || isCollaborator) return res.json({ status: 'approved' });

    const pending = (doc.pendingJoinRequests || []).some((r) => r.email === email);
    if (pending) return res.json({ status: 'pending' });

    return res.json({ status: 'none' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Get version history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { docId } = req.query || {};
    if (!docId) return res.status(400).json({ error: 'docId required' });
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB not configured' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });

    const email = req.user?.email;
    const baseRoomId = baseRoomIdFromDocId(docId);
    const meta = await DocumentModel.findOne({ docId: baseRoomId }, { ownerEmail: 1, collaborators: 1, _id: 0 });
    if (!meta) return res.status(404).json({ error: 'Room not found' });
    const isOwner = !!email && meta.ownerEmail === email;
    const isCollaborator = !!email && (meta.collaborators || []).includes(email);
    if (meta.ownerEmail && !isOwner && !isCollaborator) return res.status(403).json({ error: 'Forbidden: not a collaborator' });

    const doc = await DocumentModel.findOne({ docId }, { history: 1, version: 1, ownerEmail: 1, collaborators: 1, _id: 0 });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
