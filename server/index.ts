import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import apiRouter from './routes/api';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const isProduction = process.env.NODE_ENV === 'production';

// ─── Security ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  } : false,
}));

app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── API Routes ────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Static Files (Production) ─────────────────────────────
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Error Handler ─────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Don't expose stack traces
  const message = isProduction ? 'Internal server error' : (err.message || 'Unknown error');
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({ success: false, error: message });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔍 The Receipt Room server running on http://localhost:${PORT}`);
  if (isProduction) {
    console.log('   Serving frontend from /dist');
  }
});

export default app;
