import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dockerRouter } from './routes/docker.js';
import { systemRouter } from './routes/system.js';
import { monitoringRouter } from './routes/monitoring.js';
import { startMetricsStream } from './services/monitoring.js';
import { createExec, getContainer } from './services/docker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

app.use('/api/docker', dockerRouter);
app.use('/api/system', systemRouter);
app.use('/api/monitoring', monitoringRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// ── WebSocket message dispatch ──

wss.on('connection', (ws) => {
  let metricsUnsub = null;
  let terminalStream = null;
  let logStream = null;

  const send = (data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
  };

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      // ── Metrics ──
      case 'subscribe': {
        if (msg.channel === 'metrics' && !metricsUnsub) {
          metricsUnsub = startMetricsStream((data) => send({ type: 'metrics', data }));
        }
        break;
      }
      case 'unsubscribe': {
        if (msg.channel === 'metrics' && metricsUnsub) {
          metricsUnsub();
          metricsUnsub = null;
        }
        break;
      }

      // ── Terminal ──
      case 'terminal': {
        try {
          const { container, cols = 80, rows = 24 } = msg;
          const { stream } = await createExec(container, cols, rows);
          terminalStream = stream;

          stream.on('data', (chunk) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            send({ type: 'terminal-output', data: buf.toString('base64') });
          });

          stream.on('end', () => {
            send({ type: 'terminal-end' });
          });
        } catch (err) {
          send({ type: 'terminal-error', error: err.message });
        }
        break;
      }
      case 'terminal-input': {
        if (terminalStream) {
          terminalStream.write(msg.data);
        }
        break;
      }
      case 'terminal-resize': {
        if (terminalStream) {
          terminalStream.resize
            ? terminalStream.resize(msg.cols, msg.rows)
            : null;
        }
        break;
      }
      case 'terminal-stop': {
        if (terminalStream) {
          try { terminalStream.end(); } catch {}
          terminalStream = null;
        }
        break;
      }

      // ── Logs ──
      case 'logs': {
        try {
          const container = await getContainer(msg.container);
          const logStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail: msg.tail || 50,
            timestamps: false,
          });
          logStream.on('data', (chunk) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            send({ type: 'log-data', data: buf.toString('utf8') });
          });
          logStream.on('end', () => send({ type: 'log-end' }));
        } catch (err) {
          send({ type: 'log-error', error: err.message });
        }
        break;
      }
      case 'logs-stop': {
        if (logStream) {
          try { logStream.destroy(); } catch {}
          logStream = null;
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (metricsUnsub) metricsUnsub();
    if (terminalStream) try { terminalStream.end(); } catch {}
    if (logStream) try { logStream.destroy(); } catch {}
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server dashboard running on http://0.0.0.0:${PORT}`);
});
