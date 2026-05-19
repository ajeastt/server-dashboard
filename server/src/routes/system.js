import { Router } from 'express';
import si from 'systeminformation';
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

systemRouter.get('/disks', async (req, res) => {
  try {
    const disks = await si.fsSize();
    res.json(disks.map((d) => ({
      fs: d.fs,
      mount: d.mount,
      size: d.size,
      used: d.used,
      free: d.free,
      percent: d.use,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
