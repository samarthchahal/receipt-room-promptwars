import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import multer from 'multer';
import apiRouter from './routes/api';
import { isRecord } from './validation';

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
// Session tokens and financial data must not be stored by shared HTTP caches.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── API Routes ────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Static Files (Production) ─────────────────────────────
if (isProduction) {
  // After tsc compilation: __dirname = dist-server/server/
  // Project root is two levels up, frontend build is in ./dist
  const distPath = path.join(__dirname, '..', '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for non-API, non-file routes
  app.get('*', (req, res, next) => {
    // Don't intercept API routes — let them 404 normally
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Error Handler ─────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let message = 'Internal server error';
  const type = isRecord(err) ? err.type : undefined;
  if (type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON request body';
  } else if (type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  } else if (type === 'invalid.csv.type') {
    status = 400;
    message = 'Only CSV files are allowed';
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'CSV file exceeds the 5 MB limit' : 'Invalid multipart upload';
  } else if (err instanceof Error && [
    'Multipart: Boundary not found', 'Malformed part header',
    'Unexpected end of form', 'Unexpected end of file',
  ].includes(err.message)) {
    status = 400;
    message = 'Invalid multipart upload';
  } else if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    status = 415;
    message = 'Unsupported request encoding';
  } else if (isRecord(err) && err.status === 400) {
    status = 400;
    message = 'Malformed request';
  }
  if (status === 500) console.error('[Server Error]', err instanceof Error ? err.message : 'Unknown error');
  res.status(status).json({ success: false, error: message });
});

// ─── Start ─────────────────────────────────────────────────
if (require.main === module) app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔍 The Receipt Room server running on http://localhost:${PORT}`);
  if (isProduction) {
    console.log('   Serving frontend from /dist');
  }
});

export default app;
