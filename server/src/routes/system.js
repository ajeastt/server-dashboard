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
    let dfOutput;
    try {
      dfOutput = execSync(
        'docker run --rm --pid=host alpine nsenter -t 1 -m df -B1 --output=source,target,size,used,avail,pcent 2>/dev/null',
        { encoding: 'utf8', timeout: 15000 }
      );
    } catch {
      dfOutput = null;
    }

    if (!dfOutput) {
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

    const lines = dfOutput.trim().split('\n').slice(1);
    const seen = {};

    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 6) continue;
      const [device, mountPoint, sizeStr, usedStr, freeStr, pcentStr] = cols;
      if (!device.startsWith('/dev/') || device.startsWith('/dev/loop')) continue;

      if (!seen[device] || mountPoint.length < seen[device].mount.length) {
        seen[device] = {
          fs: device,
          mount: mountPoint,
          size: parseInt(sizeStr) || 0,
          used: parseInt(usedStr) || 0,
          free: parseInt(freeStr) || 0,
          percent: parseFloat(pcentStr) || 0,
        };
      }
    }

    res.json(Object.values(seen));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
