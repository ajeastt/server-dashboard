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
    const all = await si.fsSize();
    const physical = all.filter((d) =>
      d.fs.startsWith('/dev/') && !d.fs.startsWith('/dev/loop')
    );
    const seen = {};
    for (const d of physical) {
      if (!seen[d.fs] || d.mount.length < seen[d.fs].mount.length) {
        seen[d.fs] = { fs: d.fs, mount: d.mount, size: d.size, used: d.used, free: d.free, percent: d.use };
      }
    }
    res.json(Object.values(seen));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
