import Docker from 'dockerode';
import { spawn } from 'child_process';

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
    composeProject: (c.Labels || {})['com.docker.compose.project'] || null,
  }));
}

export async function getContainer(id) {
  const container = docker.getContainer(id);
  return container.inspect();
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
    memUsage, memLimit,
    memPercent: Math.round(memPercent * 100) / 100,
    networkRx: rxBytes, networkTx: txBytes,
  };
}

export async function getContainerLogs(id, tail = 100) {
  const container = docker.getContainer(id);
  const logs = await container.logs({ stdout: true, stderr: true, tail, timestamps: false });
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

// ── Terminal ──

export async function createExec(id, cols = 80, rows = 24) {
  const container = docker.getContainer(id);
  const exec = await container.exec({
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ['/bin/sh'],
  });
  const stream = await exec.start({ Tty: true, stdin: true, hijack: true });
  return { exec, stream };
}

// ── Images ──

export async function listImages() {
  const images = await docker.listImages({ all: false });
  return images.map((i) => ({
    id: i.Id.slice(7, 19),
    tags: i.RepoTags || [],
    dangling: !i.RepoTags || i.RepoTags.every((t) => t === '<none>:<none>'),
    size: i.Size,
    created: i.Created,
  })).sort((a, b) => b.created - a.created);
}

export async function pullImage(name) {
  return new Promise((resolve, reject) => {
    docker.pull(name, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err2, res) => {
        if (err2) return reject(err2);
        resolve(res);
      });
    });
  });
}

export async function removeImage(id) {
  const image = docker.getImage(id);
  await image.remove({ force: true });
}

export async function pruneImages() {
  const result = await docker.pruneImages();
  return result;
}

// ── Volumes ──

export async function listVolumes() {
  const { Volumes } = await docker.listVolumes();
  return (Volumes || []).map((v) => ({
    name: v.Name,
    driver: v.Driver,
    mountpoint: v.Mountpoint,
    size: v.UsageData?.Size || 0,
    created: v.CreatedAt,
  }));
}

export async function removeVolume(name) {
  const volume = docker.getVolume(name);
  await volume.remove({ force: true });
}

export async function pruneVolumes() {
  const result = await docker.pruneVolumes();
  return result;
}

// ── Networks ──

export async function listNetworks() {
  const networks = await docker.listNetworks();
  return networks.map((n) => ({
    id: n.Id.slice(0, 12),
    name: n.Name,
    driver: n.Driver,
    scope: n.Scope,
    containers: Object.keys(n.Containers || {}).length,
    created: n.Created,
  }));
}

export async function removeNetwork(id) {
  const network = docker.getNetwork(id);
  await network.remove();
}

export async function pruneNetworks() {
  const result = await docker.pruneNetworks();
  return result;
}

// ── System Prune ──

export async function systemPrune() {
  const result = await docker.prune({ filters: '{"all": ["true"]}' });
  return result;
}

// ── Stacks ──

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
  const fs = await import('fs');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.writeFile(`${tmpDir}/docker-compose.yml`, composeYaml);
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} -f ${tmpDir}/docker-compose.yml up -d`, { cwd: tmpDir, stdio: 'pipe' });
  return { success: true, name };
}

export async function destroyStack(name) {
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} down --volumes --remove-orphans`, { stdio: 'pipe' });
  return { success: true, name };
}

export async function getStackCompose(name) {
  const fs = await import('fs');
  const tmpPath = `/tmp/stacks/${name}/docker-compose.yml`;
  try {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      const labels = c.Labels || {};
      if (labels['com.docker.compose.project'] === name) {
        const configFiles = labels['com.docker.compose.project.config_files'];
        if (configFiles) {
          const firstPath = configFiles.split(',')[0].trim();
          const content = await fs.promises.readFile(firstPath, 'utf8');
          return { content };
        }
      }
    }
    const content = await fs.promises.readFile(tmpPath, 'utf8');
    return { content };
  } catch (err) {
    throw new Error(`Cannot read compose config for stack "${name}": ${err.message}`);
  }
}

export async function updateStackCompose(name, yaml) {
  const fs = await import('fs');
  const dir = `/tmp/stacks/${name}`;
  const path = `${dir}/docker-compose.yml`;
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path, yaml);
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} -f ${path} up -d`, { cwd: dir, stdio: 'pipe' });
  return { success: true, name };
}
