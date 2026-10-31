import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseCSV, MAX_FILE_SIZE } from '../engine/csvParser';
import {
  createSession, getSession, getTransactions, reviewTransaction,
  flagTransaction, getProgress, deleteSession
} from '../engine/sessionStore';
import { generateReviewedCSV, generateCaseSummary, generateCaseSummaryText } from '../engine/exporter';
import { findDuplicates, findRecurring } from '../engine/detective';
import { isValidCategory } from '../engine/categorizer';
import { CATEGORIES, ColumnMapping, ApiResponse } from '../../shared/types';
import { sampleCSV } from '../data/sampleData';

const router = Router();

// Multer for CSV upload — memory storage, size limited
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/** Middleware to extract and validate session */
function requireSession(req: Request, res: Response, next: Function) {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return res.status(401).json({ success: false, error: 'Missing session ID' });
  }
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }
  (req as any).session = session;
  next();
}

// ─── Health ────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

// ─── Upload CSV ────────────────────────────────────────────
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    let mapping: ColumnMapping | undefined;

    // Check for explicit mapping in body
    if (req.body.dateColumn && req.body.descriptionColumn && req.body.amountColumn) {
      mapping = {
        date: req.body.dateColumn,
        description: req.body.descriptionColumn,
        amount: req.body.amountColumn,
      };
    }

    const result = parseCSV(content, mapping);

    if (result.transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: result.errors.length > 0 ? result.errors[0] : 'No valid transactions found',
        data: { headers: result.headers, errors: result.errors },
      });
    }

    const session = createSession(result.transactions, result.headers);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        transactionCount: result.transactions.length,
        detectedMapping: result.detectedMapping,
        warnings: result.errors,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ success: false, error: msg });
  }
});

// ─── Demo Investigation ────────────────────────────────────
router.post('/demo', (_req: Request, res: Response) => {
  const result = parseCSV(sampleCSV);

  if (result.transactions.length === 0) {
    return res.status(500).json({ success: false, error: 'Failed to load demo data' });
  }

  const session = createSession(result.transactions, result.headers);

  res.json({
    success: true,
    data: {
      sessionId: session.id,
      transactionCount: result.transactions.length,
      detectedMapping: result.detectedMapping,
    },
  });
});

// ─── Get Transactions ──────────────────────────────────────
router.get('/transactions', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  res.json({ success: true, data: txs });
});

// ─── Review Transaction ────────────────────────────────────
router.post('/review', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const { transactionId, category } = req.body;

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid transactionId' });
  }

  if (!category || !isValidCategory(category)) {
    return res.status(400).json({
      success: false,
      error: `Invalid category. Must be one of: ${CATEGORIES.join(', ')}`,
    });
  }

  const tx = reviewTransaction(session, transactionId, category);
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Transaction not found' });
  }

  res.json({ success: true, data: tx });
});

// ─── Batch Review ──────────────────────────────────────────
router.post('/review/batch', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const { reviews } = req.body;

  if (!Array.isArray(reviews)) {
    return res.status(400).json({ success: false, error: 'reviews must be an array' });
  }

  const results = [];
  const errors = [];

  for (const r of reviews) {
    if (!r.transactionId || !r.category || !isValidCategory(r.category)) {
      errors.push(`Invalid review entry: ${JSON.stringify(r)}`);
      continue;
    }
    const tx = reviewTransaction(session, r.transactionId, r.category);
    if (tx) {
      results.push(tx);
    } else {
      errors.push(`Transaction not found: ${r.transactionId}`);
    }
  }

  res.json({ success: true, data: { updated: results.length, errors } });
});

// ─── Flag Transaction ──────────────────────────────────────
router.post('/flag', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const { transactionId, flagType, flagged } = req.body;

  if (!transactionId || typeof transactionId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing transactionId' });
  }

  if (flagType !== 'duplicate' && flagType !== 'recurring') {
    return res.status(400).json({ success: false, error: 'flagType must be "duplicate" or "recurring"' });
  }

  if (typeof flagged !== 'boolean') {
    return res.status(400).json({ success: false, error: 'flagged must be a boolean' });
  }

  const tx = flagTransaction(session, transactionId, flagType, flagged);
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Transaction not found' });
  }

  res.json({ success: true, data: tx });
});

// ─── Progress ──────────────────────────────────────────────
router.get('/progress', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  res.json({ success: true, data: getProgress(session) });
});

// ─── Duplicates ────────────────────────────────────────────
router.get('/duplicates', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  const candidates = findDuplicates(txs);
  res.json({ success: true, data: candidates });
});

// ─── Recurring ─────────────────────────────────────────────
router.get('/recurring', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  const candidates = findRecurring(txs);
  res.json({ success: true, data: candidates });
});

// ─── Export CSV ────────────────────────────────────────────
router.get('/export/csv', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  const csv = generateReviewedCSV(txs);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="receipt-room-reviewed.csv"');
  res.send(csv);
});

// ─── Export Summary ────────────────────────────────────────
router.get('/export/summary', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  const summary = generateCaseSummary(session.id, txs, session.importedAt);
  const text = generateCaseSummaryText(summary);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="receipt-room-case-summary.txt"');
  res.send(text);
});

// ─── Summary JSON ──────────────────────────────────────────
router.get('/summary', requireSession, (req: Request, res: Response) => {
  const session = (req as any).session;
  const txs = getTransactions(session);
  const summary = generateCaseSummary(session.id, txs, session.importedAt);
  res.json({ success: true, data: summary });
});

// ─── Categories List ───────────────────────────────────────
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ success: true, data: CATEGORIES });
});

export default router;
