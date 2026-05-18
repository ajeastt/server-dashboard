import Docker from 'dockerode';

const docker = new Docker();

export async function listContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((c) => ({
    id: c.Id.slice(0, 12),
    name: c.Names[0]?.replace(/^\//, '') || 'unknown',
    image: c.Image,
    state: c.State,
    status: c.Status,
    ports: c.Ports,
    created: c.Created,
  }));
}

export async function getContainer(id) {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  return info;
}

export async function getContainerStats(id) {
  const container = docker.getContainer(id);
  const stats = await container.stats({ stream: false });
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;
  const memPercent = (memUsage / memLimit) * 100;

  const rxBytes = stats.networks ? Object.values(stats.networks).reduce((a, n) => a + n.rx_bytes, 0) : 0;
  const txBytes = stats.networks ? Object.values(stats.networks).reduce((a, n) => a + n.tx_bytes, 0) : 0;

  return {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memUsage,
    memLimit,
    memPercent: Math.round(memPercent * 100) / 100,
    networkRx: rxBytes,
    networkTx: txBytes,
  };
}

export async function getContainerLogs(id, tail = 100) {
  const container = docker.getContainer(id);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: false,
  });
  return logs.toString('utf8');
}

export async function executeAction(id, action) {
  const container = docker.getContainer(id);
  switch (action) {
    case 'start': return container.start();
    case 'stop': return container.stop();
    case 'restart': return container.restart();
    case 'pause': return container.pause();
    case 'unpause': return container.unpause();
    case 'kill': return container.kill();
    default: throw new Error(`Unknown action: ${action}`);
  }
}

export async function listStacks() {
  const containers = await docker.listContainers({ all: true });
  const stacks = {};
  for (const c of containers) {
    const info = await docker.getContainer(c.Id).inspect();
    const labels = info.Config.Labels || {};
    const stackName = labels['com.docker.compose.project'];
    if (stackName) {
      if (!stacks[stackName]) {
        stacks[stackName] = { name: stackName, services: [], status: 'running' };
      }
      stacks[stackName].services.push({
        id: c.Id.slice(0, 12),
        name: labels['com.docker.compose.service'] || c.Names[0]?.replace(/^\//, ''),
        state: c.State,
      });
    }
  }
  for (const stack of Object.values(stacks)) {
    stack.status = stack.services.some((s) => s.state === 'running') ? 'running' : 'stopped';
  }
  return Object.values(stacks).sort((a, b) => a.name.localeCompare(b.name));
}

export async function deployStack(name, composeYaml) {
  const tmpDir = `/tmp/stacks/${name}`;
  await import('fs').then((fs) => fs.promises.mkdir(tmpDir, { recursive: true }));
  await import('fs').then((fs) =>
    fs.promises.writeFile(`${tmpDir}/docker-compose.yml`, composeYaml)
  );
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} -f ${tmpDir}/docker-compose.yml up -d`, {
    cwd: tmpDir,
    stdio: 'pipe',
  });
  return { success: true, name };
}

export async function destroyStack(name) {
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} down --volumes --remove-orphans`, {
    stdio: 'pipe',
  });
  return { success: true, name };
}
