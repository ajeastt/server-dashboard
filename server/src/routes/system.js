import { Router } from 'express';
import { getSystemInfo } from '../services/monitoring.js';

export const systemRouter = Router();

systemRouter.get('/info', async (req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
