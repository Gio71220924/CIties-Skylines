import express from 'express';
import cors from 'cors';
import { tilesRouter } from './routes/tiles.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tiles', tilesRouter);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`backend listening on :${PORT}`);
});
