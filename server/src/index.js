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

wss.on('connection', (ws) => {
  const unsub = startMetricsStream((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
  ws.on('close', () => unsub());
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server dashboard running on http://0.0.0.0:${PORT}`);
});
