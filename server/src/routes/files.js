import { Router } from 'express';
import { listDirectory, readFileContent } from '../services/fileExplorer.js';

export const filesRouter = Router();

filesRouter.get('/list', async (req, res) => {
  try {
    const dirPath = decodeURIComponent(req.query.path || '/');
    const result = await listDirectory(dirPath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

filesRouter.get('/read', async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.query.path || '');
    if (!filePath) throw new Error('path is required');
    const result = await readFileContent(filePath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
