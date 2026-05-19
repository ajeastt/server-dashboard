import { Router } from 'express';
import { execSync } from 'child_process';
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
    const hostRoot = '/host';
    const mountsFile = `${hostRoot}/proc/mounts`;
    const hasHost = await import('fs').then((fs) => fs.promises.access(mountsFile).then(() => true).catch(() => false));

    if (!hasHost) {
      const all = await si.fsSize();
      const physical = all.filter((d) => d.fs.startsWith('/dev/') && !d.fs.startsWith('/dev/loop'));
      const seen = {};
      for (const d of physical) {
        if (!seen[d.fs] || d.mount.length < seen[d.fs].mount.length) {
          seen[d.fs] = { fs: d.fs, mount: d.mount, size: d.size, used: d.used, free: d.free, percent: d.use };
        }
      }
      return res.json(Object.values(seen));
    }

    const mounts = await import('fs').then((fs) => fs.promises.readFile(mountsFile, 'utf8'));
    const seen = {};

    for (const line of mounts.split('\n')) {
      const parts = line.split(/\s+/);
      const device = parts[0];
      const mountPoint = parts[1]?.replace(/\\040/g, ' ');
      if (!device || !mountPoint || !device.startsWith('/dev/') || device.startsWith('/dev/loop')) continue;
      if (mountPoint.startsWith('/host')) continue;

      if (!seen[device] || mountPoint.length < seen[device].mount.length) {
        const hostPath = mountPoint === '/' ? hostRoot : `${hostRoot}${mountPoint}`;
        try {
          const df = execSync(`df -B1 "${hostPath}" 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 5000 });
          const cols = df.trim().split(/\s+/);
          if (cols.length >= 5) {
            seen[device] = {
              fs: device,
              mount: mountPoint,
              size: parseInt(cols[1]) || 0,
              used: parseInt(cols[2]) || 0,
              free: parseInt(cols[3]) || 0,
              percent: parseFloat(cols[4]) || 0,
            };
          }
        } catch {}
      }
    }

    res.json(Object.values(seen));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
