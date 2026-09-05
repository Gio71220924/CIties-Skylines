import express from 'express';
import cors from 'cors';
import { tilesRouter } from './routes/tiles.js';

const app = express();

// Default matches the Vite dev server; override via CORS_ORIGIN (comma-separated) in other envs.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tiles', tilesRouter);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`backend listening on :${PORT}`);
});
