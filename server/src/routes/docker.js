import { Router } from 'express';
import {
  listContainers,
  getContainer,
  getContainerStats,
  getContainerLogs,
  executeAction,
  listStacks,
  deployStack,
  destroyStack,
} from '../services/docker.js';

export const dockerRouter = Router();

dockerRouter.get('/containers', async (req, res) => {
  try {
    const containers = await listContainers();
    res.json(containers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.get('/containers/:id', async (req, res) => {
  try {
    const container = await getContainer(req.params.id);
    res.json(container);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.get('/containers/:id/stats', async (req, res) => {
  try {
    const stats = await getContainerStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.get('/containers/:id/logs', async (req, res) => {
  try {
    const logs = await getContainerLogs(req.params.id, parseInt(req.query.tail) || 100);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.post('/containers/:id/:action', async (req, res) => {
  try {
    await executeAction(req.params.id, req.params.action);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.get('/stacks', async (req, res) => {
  try {
    const stacks = await listStacks();
    res.json(stacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.post('/stacks', async (req, res) => {
  try {
    const { name, compose } = req.body;
    const result = await deployStack(name, compose);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dockerRouter.delete('/stacks/:name', async (req, res) => {
  try {
    const result = await destroyStack(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
