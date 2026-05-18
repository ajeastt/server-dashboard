const API = '/api';

async function fetchJson(url, opts = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  system: {
    info: () => fetchJson('/system/info'),
  },
  docker: {
    containers: () => fetchJson('/docker/containers'),
    container: (id) => fetchJson(`/docker/containers/${id}`),
    stats: (id) => fetchJson(`/docker/containers/${id}/stats`),
    logs: (id, tail = 100) => fetchJson(`/docker/containers/${id}/logs?tail=${tail}`),
    action: (id, action) => fetchJson(`/docker/containers/${id}/${action}`, { method: 'POST' }),
    stacks: () => fetchJson('/docker/stacks'),
    deployStack: (name, compose) =>
      fetchJson('/docker/stacks', { method: 'POST', body: JSON.stringify({ name, compose }) }),
    destroyStack: (name) =>
      fetchJson(`/docker/stacks/${name}`, { method: 'DELETE' }),
    stackCompose: (name) => fetchJson(`/docker/stacks/${name}/compose`),
    updateStackCompose: (name, content) =>
      fetchJson(`/docker/stacks/${name}/compose`, { method: 'PUT', body: JSON.stringify({ content }) }),

    images: () => fetchJson('/docker/images'),
    pullImage: (name) => fetchJson('/docker/images/pull', { method: 'POST', body: JSON.stringify({ name }) }),
    checkImageUpdate: (name) => fetchJson('/docker/images/check-update', { method: 'POST', body: JSON.stringify({ name }) }),
    removeImage: (id) => fetchJson(`/docker/images/${id}`, { method: 'DELETE' }),
    pruneImages: () => fetchJson('/docker/images/prune', { method: 'POST' }),

    volumes: () => fetchJson('/docker/volumes'),
    removeVolume: (name) => fetchJson(`/docker/volumes/${name}`, { method: 'DELETE' }),
    pruneVolumes: () => fetchJson('/docker/volumes/prune', { method: 'POST' }),

    networks: () => fetchJson('/docker/networks'),
    removeNetwork: (id) => fetchJson(`/docker/networks/${id}`, { method: 'DELETE' }),
    pruneNetworks: () => fetchJson('/docker/networks/prune', { method: 'POST' }),

    prune: () => fetchJson('/docker/prune', { method: 'POST' }),
  },
};

// ── WebSocket connection with message dispatch ──

export function createWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  const handlers = {};
  const queue = [];

  ws.onopen = () => {
    queue.forEach((data) => ws.send(JSON.stringify(data)));
    queue.length = 0;
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const h = handlers[msg.type];
      if (h) h(msg);
    } catch {}
  };

  return {
    send: (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      } else {
        queue.push(data);
      }
    },
    on: (type, fn) => { handlers[type] = fn; },
    close: () => ws.close(),
    raw: ws,
  };
}

export function connectMetrics(callback) {
  const ws = createWS();
  ws.on('metrics', (msg) => callback(msg.data));
  ws.send({ type: 'subscribe', channel: 'metrics' });
  return () => { ws.send({ type: 'unsubscribe', channel: 'metrics' }); ws.close(); };
}
