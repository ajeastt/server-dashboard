import Docker from 'dockerode';
import { spawn } from 'child_process';
import path from 'path';

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
  const logStream = await container.logs({ stdout: true, stderr: true, tail, timestamps: false });
  return stripDockerHeaders(logStream);
}

function stripDockerHeaders(buf) {
  const lines = [];
  let offset = 0;
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  while (offset < data.length) {
    if (offset + 8 > data.length) break;
    const payloadLen = data.readUInt32BE(4 + offset);
    if (offset + 8 + payloadLen > data.length) break;
    lines.push(data.slice(offset + 8, offset + 8 + payloadLen).toString('utf8'));
    offset += 8 + payloadLen;
  }
  return lines.join('');
}

export async function streamContainerLogs(id, tail = 50) {
  const container = docker.getContainer(id);
  const logStream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail,
    timestamps: false,
  });
  const { PassThrough } = await import('stream');
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  container.modem.demuxStream(logStream, stdout, stderr);
  return { logStream, stdout, stderr };
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
  const [images, containers] = await Promise.all([
    docker.listImages({ all: false }),
    docker.listContainers({ all: true }),
  ]);
  const imgById = {};
  for (const c of containers) {
    const imageId = c.ImageID || '';
    if (!imgById[imageId]) imgById[imageId] = [];
    imgById[imageId].push(c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12));
  }
  return images.map((i) => ({
    id: i.Id.slice(7, 19),
    tags: i.RepoTags || [],
    digests: i.RepoDigests || [],
    dangling: !i.RepoTags || i.RepoTags.every((t) => t === '<none>:<none>'),
    size: i.Size,
    created: i.Created,
    usedBy: imgById[i.Id] || [],
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

export async function pullImageStream(name, onProgress) {
  return new Promise((resolve, reject) => {
    docker.pull(name, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (chunk) => {
        const lines = chunk.toString().trim().split('\n');
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            onProgress(obj);
          } catch {}
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  });
}

export async function checkImageUpdate(name) {
  let tag = 'latest';
  let imageRepo = name;
  if (name.includes(':')) {
    imageRepo = name.split(':')[0];
    tag = name.split(':')[1];
  }

  let registryRepo = imageRepo;
  if (!imageRepo.includes('/')) {
    registryRepo = 'library/' + imageRepo;
  }

  try {
    const authRes = await fetch(`https://auth.docker.io/token?service=registry.docker.io&scope=repository:${registryRepo}:pull`);
    if (!authRes.ok) return { name, error: 'auth_failed' };
    const { token } = await authRes.json();

    const manifestRes = await fetch(`https://registry-1.docker.io/v2/${registryRepo}/manifests/${tag}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      },
    });
    if (!manifestRes.ok) return { name, error: 'manifest_fetch_failed' };

    const remoteDigest = manifestRes.headers.get('docker-content-digest');

    const images = await docker.listImages();
    const local = images.find((i) => (i.RepoTags || []).some((t) => t === `${imageRepo}:${tag}`));
    const localDigest = local ? (local.RepoDigests || []).find((d) => d.includes(imageRepo)) : null;
    const localDigestVal = localDigest ? localDigest.split('@')[1] : null;

    const updateAvailable = localDigestVal ? localDigestVal !== remoteDigest : true;

    return { name, tag, remoteDigest, localDigest: localDigestVal, updateAvailable };
  } catch {
    return { name, error: 'registry_unreachable' };
  }
}

export async function removeImage(id) {
  const image = docker.getImage(id);
  try {
    await image.remove({ force: true });
  } catch (err) {
    if (err.statusCode === 409) {
      const containers = await docker.listContainers({ all: true });
      const using = containers.filter((c) => c.ImageID && c.ImageID.includes(id) || (c.Image && c.Image.includes(id)));
      const names = using.map((c) => c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12));
      if (names.length > 0) {
        throw new Error(`Image is in use by container(s): ${names.join(', ')}. Stop them first.`);
      }
    }
    throw err;
  }
}

export async function pruneImages() {
  try {
    const result = await docker.pruneImages();
    return result;
  } catch (err) {
    throw new Error(`Failed to prune images: ${err.message}`);
  }
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

// ── Validation ──

export async function validateCompose(yaml) {
  const fs = await import('fs');
  const tmpDir = `/tmp/stacks/_validate_${Date.now()}`;
  const tmpPath = `${tmpDir}/docker-compose.yml`;
  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.writeFile(tmpPath, yaml);
  const { execSync } = await import('child_process');
  try {
    execSync(`docker compose -f "${tmpPath}" config --quiet`, { stdio: 'pipe', timeout: 15000 });
    return { valid: true };
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().trim();
    return { valid: false, error: msg || 'Invalid compose file' };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
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

export async function restartStack(name) {
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} restart`, { stdio: 'pipe' });
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
  const filePath = `${dir}/docker-compose.yml`;
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, yaml);
  const { execSync } = await import('child_process');
  execSync(`docker compose -p ${name} -f ${filePath} up -d`, { cwd: dir, stdio: 'pipe' });
  return { success: true, name };
}

async function getStackComposeDir(name) {
  const containers = await docker.listContainers({ all: true });
  for (const c of containers) {
    const labels = c.Labels || {};
    if (labels['com.docker.compose.project'] === name) {
      const configFiles = labels['com.docker.compose.project.config_files'];
      if (configFiles) {
        return path.dirname(configFiles.split(',')[0].trim());
      }
    }
  }
  return `/tmp/stacks/${name}`;
}

export async function updateStackImages(name) {
  const { execSync } = await import('child_process');
  const dir = await getStackComposeDir(name);
  try {
    execSync(`docker compose -p ${name} pull 2>&1`, { cwd: dir, stdio: 'pipe', timeout: 300000 });
    execSync(`docker compose -p ${name} up -d 2>&1`, { cwd: dir, stdio: 'pipe', timeout: 120000 });
    return { success: true, name };
  } catch (err) {
    throw new Error(`Failed to update stack "${name}": ${err.message}`);
  }
}

export async function updateStackImagesStream(name, onEvent) {
  const { spawn } = await import('child_process');
  const dir = await getStackComposeDir(name);

  const run = (args) => new Promise((resolve, reject) => {
    const proc = spawn('docker', ['compose', '-p', name, ...args], { cwd: dir });
    proc.stdout.on('data', (chunk) => onEvent({ type: 'output', data: chunk.toString() }));
    proc.stderr.on('data', (chunk) => onEvent({ type: 'output', data: chunk.toString() }));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose ${args.join(' ')} exited with code ${code}`));
    });
    proc.on('error', reject);
  });

  await run(['pull']);
  onEvent({ type: 'phase', phase: 'up' });
  await run(['up', '-d']);
}
