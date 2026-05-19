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
    const all = await si.fsSize();
    const physical = all.filter((d) => d.fs.startsWith('/dev/') && !d.fs.startsWith('/dev/loop'));
    const seen = {};
    for (const d of physical) {
      let mount = d.mount;
      if (mount === '/host') mount = '/';
      else if (mount.startsWith('/host/')) mount = mount.slice(5);
      const key = d.fs;
      if (!seen[key] || mount.length < seen[key].mount.length) {
        const hostPath = mount === '/' ? '/host' : `/host${mount}`;
        let size = d.size, used = d.used, free = d.available || 0, percent = d.use;
        try {
          const df = execSync(`df -B1 --output=source,target,size,used,avail,pcent "${hostPath}" 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 3000 });
          const cols = df.trim().split(/\s+/);
          if (cols.length >= 6) {
            size = parseInt(cols[2]) || size;
            used = parseInt(cols[3]) || used;
            free = parseInt(cols[4]) || free;
            percent = parseFloat(cols[5]) || percent;
          }
        } catch {}
        seen[key] = { fs: d.fs, mount, size, used, free, percent };
      }
    }
    res.json(Object.values(seen));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
