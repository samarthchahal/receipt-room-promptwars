import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Transaction, Category, SessionProgress, CATEGORIES } from '../../shared/types';
import { RawTransaction } from '../../shared/types';
import { suggestCategory } from './categorizer';

/** Session expiry: 2 hours */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
/** Cleanup interval: 10 minutes */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
/** Maximum concurrent sessions */
const MAX_SESSIONS = 100;

export interface Session {
  id: string;
  transactions: Map<string, Transaction>;
  importedAt: string;
  lastAccessed: number;
  originalHeaders: string[];
}

const sessions = new Map<string, Session>();

/** Cleanup expired sessions periodically */
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

/** Generate cryptographically secure session ID */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(rawTransactions: RawTransaction[], headers: string[]): Session {
  // Enforce max sessions
  if (sessions.size >= MAX_SESSIONS) {
    // Evict oldest session
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [id, s] of sessions) {
      if (s.lastAccessed < oldestTime) {
        oldestTime = s.lastAccessed;
        oldest = id;
      }
    }
    if (oldest) sessions.delete(oldest);
  }

  const sessionId = generateSessionId();
  const txMap = new Map<string, Transaction>();

  for (const raw of rawTransactions) {
    const id = uuidv4();
    const tx: Transaction = {
      id,
      date: raw.date,
      description: raw.description,
      amount: raw.amount,
      suggestedCategory: suggestCategory(raw.description),
      confirmedCategory: null,
      reviewed: false,
      duplicateFlag: false,
      recurringFlag: false,
      originalRow: raw.originalRow,
    };
    txMap.set(id, tx);
  }

  const session: Session = {
    id: sessionId,
    transactions: txMap,
    importedAt: new Date().toISOString(),
    lastAccessed: Date.now(),
    originalHeaders: headers,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check expiry
  if (Date.now() - session.lastAccessed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }

  session.lastAccessed = Date.now();
  return session;
}

export function getTransactions(session: Session): Transaction[] {
  return Array.from(session.transactions.values());
}

export function getTransaction(session: Session, txId: string): Transaction | null {
  return session.transactions.get(txId) || null;
}

export function reviewTransaction(
  session: Session,
  txId: string,
  category: Category
): Transaction | null {
  const tx = session.transactions.get(txId);
  if (!tx) return null;

  tx.confirmedCategory = category;
  tx.reviewed = true;
  session.lastAccessed = Date.now();
  return tx;
}

export function flagTransaction(
  session: Session,
  txId: string,
  flagType: 'duplicate' | 'recurring',
  flagged: boolean
): Transaction | null {
  const tx = session.transactions.get(txId);
  if (!tx) return null;

  if (flagType === 'duplicate') {
    tx.duplicateFlag = flagged;
  } else {
    tx.recurringFlag = flagged;
  }

  session.lastAccessed = Date.now();
  return tx;
}

export function getProgress(session: Session): SessionProgress {
  const txs = getTransactions(session);
  const reviewed = txs.filter(t => t.reviewed);

  const categoryCounts = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    categoryCounts[cat] = 0;
  }
  for (const t of reviewed) {
    if (t.confirmedCategory) {
      categoryCounts[t.confirmedCategory]++;
    }
  }

  return {
    sessionId: session.id,
    totalTransactions: txs.length,
    reviewedCount: reviewed.length,
    categoryCounts,
    duplicatesFlagged: txs.filter(t => t.duplicateFlag).length,
    recurringFlagged: txs.filter(t => t.recurringFlag).length,
    percentComplete: txs.length > 0 ? Math.round((reviewed.length / txs.length) * 100) : 0,
  };
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}
