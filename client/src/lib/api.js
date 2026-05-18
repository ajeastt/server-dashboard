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
      fetchJson('/docker/stacks', {
        method: 'POST',
        body: JSON.stringify({ name, compose }),
      }),
    destroyStack: (name) =>
      fetchJson(`/docker/stacks/${name}`, { method: 'DELETE' }),
  },
};

export function connectMetrics(callback) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onmessage = (event) => {
    try {
      callback(JSON.parse(event.data));
    } catch {}
  };
  ws.onerror = () => {};
  return () => ws.close();
}
