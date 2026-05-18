import si from 'systeminformation';

let subscribers = [];
let intervalId = null;

async function collectMetrics() {
  const [cpu, mem, disk, net, containers] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.dockerContainers('all'),
  ]);

  const networkStats = net.reduce(
    (acc, iface) => {
      acc.rx += iface.rx_sec || 0;
      acc.tx += iface.tx_sec || 0;
      return acc;
    },
    { rx: 0, tx: 0 }
  );

  return {
    cpu: {
      usage: Math.round(cpu.currentLoad * 100) / 100,
      cores: cpu.cpus.length,
    },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      percent: Math.round((mem.used / mem.total) * 100 * 100) / 100,
    },
    disk: disk.map((d) => ({
      fs: d.fs,
      size: d.size,
      used: d.used,
      free: d.free,
      percent: d.use,
      mount: d.mount,
    })),
    network: {
      rx: Math.round(networkStats.rx),
      tx: Math.round(networkStats.tx),
    },
    containers: {
      total: containers.length,
      running: containers.filter((c) => c.state === 'running').length,
      stopped: containers.filter((c) => c.state === 'exited').length,
    },
    timestamp: Date.now(),
  };
}

export function startMetricsStream(callback, interval = 2000) {
  subscribers.push(callback);
  if (!intervalId) {
    intervalId = setInterval(async () => {
      try {
        const metrics = await collectMetrics();
        subscribers.forEach((cb) => cb(metrics));
      } catch (err) {
        console.error('Metrics collection error:', err.message);
      }
    }, interval);
    collectMetrics().then((m) => subscribers.forEach((cb) => cb(m)));
  }
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
    if (subscribers.length === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export async function getSystemInfo() {
  const [osInfo, cpuInfo, memInfo, diskInfo, netInfo, timeInfo] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.time(),
  ]);

  return {
    hostname: osInfo.hostname,
    platform: osInfo.platform,
    distro: osInfo.distro,
    release: osInfo.release,
    kernel: osInfo.kernel,
    arch: osInfo.arch,
    cpu: `${cpuInfo.manufacturer} ${cpuInfo.brand} (${cpuInfo.cores} cores)`,
    uptime: timeInfo.uptime,
  };
}
