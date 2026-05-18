import { Router } from 'express';
import {
  listContainers, getContainer, getContainerStats, getContainerLogs, executeAction,
  listStacks, deployStack, destroyStack,
  listImages, pullImage, removeImage, pruneImages,
  listVolumes, removeVolume, pruneVolumes,
  listNetworks, removeNetwork, pruneNetworks,
  systemPrune,
} from '../services/docker.js';

export const dockerRouter = Router();

// ── Containers ──

dockerRouter.get('/containers', async (req, res) => {
  try { res.json(await listContainers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.get('/containers/:id', async (req, res) => {
  try { res.json(await getContainer(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.get('/containers/:id/stats', async (req, res) => {
  try { res.json(await getContainerStats(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.get('/containers/:id/logs', async (req, res) => {
  try { res.json({ logs: await getContainerLogs(req.params.id, parseInt(req.query.tail) || 100) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/containers/:id/:action', async (req, res) => {
  try { await executeAction(req.params.id, req.params.action); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Images ──

dockerRouter.get('/images', async (req, res) => {
  try { res.json(await listImages()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/images/pull', async (req, res) => {
  try { await pullImage(req.body.name); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.delete('/images/:id', async (req, res) => {
  try { await removeImage(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/images/prune', async (req, res) => {
  try { res.json(await pruneImages()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Volumes ──

dockerRouter.get('/volumes', async (req, res) => {
  try { res.json(await listVolumes()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.delete('/volumes/:name', async (req, res) => {
  try { await removeVolume(req.params.name); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/volumes/prune', async (req, res) => {
  try { res.json(await pruneVolumes()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Networks ──

dockerRouter.get('/networks', async (req, res) => {
  try { res.json(await listNetworks()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.delete('/networks/:id', async (req, res) => {
  try { await removeNetwork(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/networks/prune', async (req, res) => {
  try { res.json(await pruneNetworks()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── System Prune ──

dockerRouter.post('/prune', async (req, res) => {
  try { res.json(await systemPrune()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stacks ──

dockerRouter.get('/stacks', async (req, res) => {
  try { res.json(await listStacks()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.post('/stacks', async (req, res) => {
  try { const { name, compose } = req.body; res.json(await deployStack(name, compose)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

dockerRouter.delete('/stacks/:name', async (req, res) => {
  try { res.json(await destroyStack(req.params.name)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
