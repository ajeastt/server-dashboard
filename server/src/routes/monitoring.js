import { Router } from 'express';

export const monitoringRouter = Router();

monitoringRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
