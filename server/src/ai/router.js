import { Router } from 'express';
import { requestSuggestions } from './batcher.js';

const router = Router();

router.post('/suggest', async (req, res) => {
  const { language = 'javascript', code = '', cursor = 0 } = req.body || {};
  const result = await requestSuggestions({ language, code, cursor });
  if (result?.error) return res.status(500).json({ error: result.error });
  return res.json(result);
});

export default router;
