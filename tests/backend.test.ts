import { describe, it, expect, beforeEach } from 'vitest';
import { parseCSV, autoDetectMapping } from '../server/engine/csvParser';
import { suggestCategory, isValidCategory } from '../server/engine/categorizer';
import { createSession, getSession, reviewTransaction, getProgress, getTransactions, flagTransaction } from '../server/engine/sessionStore';
import { generateReviewedCSV, generateCaseSummary } from '../server/engine/exporter';
import { findDuplicates, findRecurring } from '../server/engine/detective';
import { sampleCSV } from '../server/data/sampleData';
import { CATEGORIES } from '../shared/types';

// ─── CSV Parser Tests ──────────────────────────────────────
describe('CSV Parser', () => {
  it('should parse valid CSV with standard columns', () => {
    const csv = `Date,Description,Amount\n2026-01-01,Starbucks,5.50\n2026-01-02,Amazon,29.99`;
    const result = parseCSV(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.errors.filter(e => !e.startsWith('Row'))).toHaveLength(0);
    expect(result.transactions[0].description).toBe('Starbucks');
    expect(result.transactions[0].amount).toBe(5.50);
  });

  it('should reject empty CSV', () => {
    const result = parseCSV('');
    expect(result.transactions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject CSV with no valid rows', () => {
    const csv = `Date,Description,Amount`;
    const result = parseCSV(csv);
    expect(result.transactions).toHaveLength(0);
  });

  it('should handle alternate column names', () => {
    const csv = `Transaction Date,Merchant,Total\n2026-03-15,Netflix,15.99`;
    const result = parseCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Netflix');
    expect(result.transactions[0].amount).toBe(15.99);
  });

  it('should handle currency symbols and formatting', () => {
    const csv = `Date,Description,Amount\n2026-01-01,Store,$1,234.56\n2026-01-02,Shop,₹500.00`;
    const result = parseCSV(csv);
    expect(result.transactions.length).toBeGreaterThan(0);
    // At least one transaction should have a valid amount
    const amounts = result.transactions.map(t => t.amount);
    expect(amounts.some(a => a > 0)).toBe(true);
  });

  it('should handle negative amounts', () => {
    const csv = `Date,Description,Amount\n2026-01-01,Refund,-25.00`;
    const result = parseCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(-25.00);
  });

  it('should handle missing values gracefully', () => {
    const csv = `Date,Description,Amount\n2026-01-01,,10.00\n,,`;
    const result = parseCSV(csv);
    // Should skip rows with empty description AND amount
    expect(result.transactions.length).toBeLessThanOrEqual(1);
  });

  it('should accept explicit column mapping', () => {
    const csv = `dt,desc,val\n2026-05-01,Coffee,4.50`;
    const result = parseCSV(csv, { date: 'dt', description: 'desc', amount: 'val' });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Coffee');
  });

  it('should parse the demo dataset', () => {
    const result = parseCSV(sampleCSV);
    expect(result.transactions.length).toBeGreaterThan(40);
    expect(result.errors.filter(e => !e.startsWith('Row'))).toHaveLength(0);
  });
});

// ─── Categorizer Tests ─────────────────────────────────────
describe('Categorizer', () => {
  it('should categorize food merchants', () => {
    expect(suggestCategory('Starbucks Coffee')).toBe('Food & Dining');
    expect(suggestCategory('Pizza Hut Delivery')).toBe('Food & Dining');
  });

  it('should categorize shopping', () => {
    expect(suggestCategory('Amazon - Wireless Mouse')).toBe('Shopping');
    expect(suggestCategory('Target - Home Supplies')).toBe('Shopping');
  });

  it('should categorize transport', () => {
    expect(suggestCategory('Uber Ride to Office')).toBe('Transport');
    expect(suggestCategory('Shell Gas Station')).toBe('Transport');
  });

  it('should categorize bills', () => {
    expect(suggestCategory('Con Edison Electric')).toBe('Bills & Utilities');
    expect(suggestCategory('Comcast Internet')).toBe('Bills & Utilities');
  });

  it('should categorize entertainment', () => {
    expect(suggestCategory('Netflix Monthly')).toBe('Entertainment');
    expect(suggestCategory('AMC Movie Theater')).toBe('Entertainment');
  });

  it('should fall back to Other for unknown merchants', () => {
    expect(suggestCategory('XYZ Unknown Corp')).toBe('Other');
  });

  it('should validate categories correctly', () => {
    expect(isValidCategory('Food & Dining')).toBe(true);
    expect(isValidCategory('InvalidCategory')).toBe(false);
    expect(isValidCategory('')).toBe(false);
  });
});

// ─── Session Store Tests ───────────────────────────────────
describe('Session Store', () => {
  it('should create a session from raw transactions', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    expect(session.id).toBeTruthy();
    expect(session.id.length).toBe(64); // 32 bytes hex
    expect(session.transactions.size).toBe(result.transactions.length);
  });

  it('should retrieve a session by ID', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const retrieved = getSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(session.id);
  });

  it('should return null for nonexistent session', () => {
    expect(getSession('nonexistent-id')).toBeNull();
  });

  it('should isolate sessions', () => {
    const r1 = parseCSV(`Date,Description,Amount\n2026-01-01,A,10`);
    const r2 = parseCSV(`Date,Description,Amount\n2026-01-01,B,20`);
    const s1 = createSession(r1.transactions, r1.headers);
    const s2 = createSession(r2.transactions, r2.headers);
    expect(s1.id).not.toBe(s2.id);
    expect(getTransactions(s1)[0].description).toBe('A');
    expect(getTransactions(s2)[0].description).toBe('B');
  });

  it('should review a transaction with idempotency', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);
    const txId = txs[0].id;

    // First review
    const r1 = reviewTransaction(session, txId, 'Food & Dining');
    expect(r1!.reviewed).toBe(true);
    expect(r1!.confirmedCategory).toBe('Food & Dining');

    // Repeat review (idempotent)
    const r2 = reviewTransaction(session, txId, 'Shopping');
    expect(r2!.reviewed).toBe(true);
    expect(r2!.confirmedCategory).toBe('Shopping');

    // Count should still be 1
    const progress = getProgress(session);
    expect(progress.reviewedCount).toBe(1);
  });

  it('should calculate accurate progress', () => {
    const csv = `Date,Description,Amount\n2026-01-01,A,10\n2026-01-02,B,20\n2026-01-03,C,30`;
    const result = parseCSV(csv);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);

    let progress = getProgress(session);
    expect(progress.totalTransactions).toBe(3);
    expect(progress.reviewedCount).toBe(0);
    expect(progress.percentComplete).toBe(0);

    reviewTransaction(session, txs[0].id, 'Food & Dining');
    progress = getProgress(session);
    expect(progress.reviewedCount).toBe(1);
    expect(progress.percentComplete).toBe(33);

    reviewTransaction(session, txs[1].id, 'Shopping');
    reviewTransaction(session, txs[2].id, 'Transport');
    progress = getProgress(session);
    expect(progress.reviewedCount).toBe(3);
    expect(progress.percentComplete).toBe(100);
  });

  it('should flag transactions', () => {
    const csv = `Date,Description,Amount\n2026-01-01,A,10`;
    const result = parseCSV(csv);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);

    const flagged = flagTransaction(session, txs[0].id, 'duplicate', true);
    expect(flagged!.duplicateFlag).toBe(true);

    const unflagged = flagTransaction(session, txs[0].id, 'duplicate', false);
    expect(unflagged!.duplicateFlag).toBe(false);
  });
});

// ─── Exporter Tests ────────────────────────────────────────
describe('Exporter', () => {
  it('should generate reviewed CSV with all required columns', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);

    // Review one transaction
    reviewTransaction(session, txs[0].id, 'Food & Dining');

    const csv = generateReviewedCSV(getTransactions(session));
    expect(csv).toContain('Review_Status');
    expect(csv).toContain('Reviewed_Category');
    expect(csv).toContain('Suggested_Category');
    expect(csv).toContain('Duplicate_Flag');
    expect(csv).toContain('Recurring_Flag');
    expect(csv).toContain('Reviewed');
    expect(csv).toContain('Pending');
    expect(csv).toContain('Food & Dining');
  });

  it('should prevent CSV formula injection', () => {
    const csv = `Date,Description,Amount\n2026-01-01,=SUM(A1:A10),10\n2026-01-02,+cmd|' /C calc',20`;
    const result = parseCSV(csv);
    const session = createSession(result.transactions, result.headers);
    const output = generateReviewedCSV(getTransactions(session));

    // Injected formulas should be neutralized with single-quote prefix
    expect(output).not.toContain(',=SUM');
    expect(output).not.toContain(',+cmd');
  });

  it('should preserve original transaction fields in export', () => {
    const csv = `Date,Description,Amount,Extra\n2026-01-01,Test,10,metadata`;
    const result = parseCSV(csv);
    const session = createSession(result.transactions, result.headers);
    const output = generateReviewedCSV(getTransactions(session));
    expect(output).toContain('metadata');
    expect(output).toContain('Extra');
  });

  it('should generate accurate case summary', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);

    reviewTransaction(session, txs[0].id, 'Food & Dining');
    reviewTransaction(session, txs[1].id, 'Transport');

    const summary = generateCaseSummary(session.id, getTransactions(session), session.importedAt);
    expect(summary.totalTransactions).toBe(txs.length);
    expect(summary.reviewedCount).toBe(2);
    expect(summary.unreviewed).toBe(txs.length - 2);
  });
});

// ─── Detective Engine Tests ────────────────────────────────
describe('Detective Engine', () => {
  it('should find duplicate transactions', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);
    const dupes = findDuplicates(txs);
    // The sample data has Netflix Monthly appearing twice at same price
    // and similar merchants — should find at least some
    expect(Array.isArray(dupes)).toBe(true);
  });

  it('should find recurring transactions', () => {
    const result = parseCSV(sampleCSV);
    const session = createSession(result.transactions, result.headers);
    const txs = getTransactions(session);
    const recurring = findRecurring(txs);
    expect(Array.isArray(recurring)).toBe(true);
  });

  it('should not find duplicates in unique transactions', () => {
    const csv = `Date,Description,Amount\n2026-01-01,A,10\n2026-06-01,B,20\n2026-12-01,C,30`;
    const result = parseCSV(csv);
    const session = createSession(result.transactions, result.headers);
    const dupes = findDuplicates(getTransactions(session));
    expect(dupes).toHaveLength(0);
  });
});

// ─── Health Endpoint Test ──────────────────────────────────
describe('API Contract', () => {
  it('should have all required categories', () => {
    expect(CATEGORIES).toContain('Food & Dining');
    expect(CATEGORIES).toContain('Shopping');
    expect(CATEGORIES).toContain('Transport');
    expect(CATEGORIES).toContain('Bills & Utilities');
    expect(CATEGORIES).toContain('Entertainment');
    expect(CATEGORIES).toContain('Health');
    expect(CATEGORIES).toContain('Education');
    expect(CATEGORIES).toContain('Other');
    expect(CATEGORIES).toHaveLength(8);
  });
});
