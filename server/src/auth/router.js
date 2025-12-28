import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { connectDB, UserModel, useMongo } from '../db.js';
import { signToken } from './middleware.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    console.log('Register request body:', req.body)
    if (!email || !password || !username) {
      console.error('Missing fields:', { email: !!email, password: !!password, username: !!username })
      return res.status(400).json({ error: 'Email, password, and username required' });
    }
    if (!useMongo()) return res.status(503).json({ error: 'MongoDB required for registration' });
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'MongoDB unreachable' });
    const existing = await UserModel.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email) return res.status(409).json({ error: 'Email already exists' });
      if (existing.username === username) return res.status(409).json({ error: 'Username already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({ email, passwordHash, username });
    const token = signToken({ sub: user._id.toString(), email, username });
    return res.json({ token });
  } catch (e) {
    console.error('Register error:', e)
    return res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('Login attempt for email:', email);
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (!useMongo()) {
      console.log('MongoDB not configured');
      return res.status(503).json({ error: 'MongoDB required for login' });
    }
    const connected = await connectDB();
    if (!connected) {
      console.log('MongoDB connection failed');
      return res.status(503).json({ error: 'MongoDB unreachable' });
    }
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      console.log('Password mismatch for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ sub: user._id.toString(), email, username: user.username });
    console.log('Login successful for email:', email);
    return res.json({ token });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
