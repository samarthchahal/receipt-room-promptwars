import { parse } from 'csv-parse/sync';
import { RawTransaction, ColumnMapping } from '../../shared/types';

/** Maximum number of transactions we allow */
export const MAX_TRANSACTIONS = 5000;
/** Maximum CSV file size in bytes (5 MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Common column name aliases */
const DATE_ALIASES = ['date', 'transaction date', 'trans date', 'txn date', 'posted date', 'post date', 'transaction_date', 'txn_date'];
const DESC_ALIASES = ['description', 'merchant', 'name', 'payee', 'memo', 'details', 'transaction description', 'narration', 'particulars', 'transaction_description'];
const AMOUNT_ALIASES = ['amount', 'value', 'total', 'sum', 'debit', 'withdrawal', 'transaction amount', 'txn amount', 'transaction_amount'];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

function findColumn(headers: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const found = headers.find(h => normalizeHeader(h) === alias);
    if (found) return found;
  }
  // partial match fallback
  for (const alias of aliases) {
    const found = headers.find(h => normalizeHeader(h).includes(alias));
    if (found) return found;
  }
  return null;
}

export function autoDetectMapping(headers: string[]): ColumnMapping | null {
  const date = findColumn(headers, DATE_ALIASES);
  const description = findColumn(headers, DESC_ALIASES);
  const amount = findColumn(headers, AMOUNT_ALIASES);

  if (date && description && amount) {
    return { date, description, amount };
  }
  return null;
}

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  // Remove currency symbols, commas, spaces
  let cleaned = raw.replace(/[₹$€£¥,\s]/g, '').trim();
  // Handle parentheses as negative: (100) -> -100
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const trimmed = raw.trim();
  // Try native Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  // Return as-is if unparseable
  return trimmed;
}

export interface ParseResult {
  transactions: RawTransaction[];
  headers: string[];
  errors: string[];
  detectedMapping: ColumnMapping | null;
}

export function parseCSV(
  content: string,
  mapping?: ColumnMapping
): ParseResult {
  const errors: string[] = [];

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true,
    });
  } catch (e) {
    return {
      transactions: [],
      headers: [],
      errors: [`CSV parsing failed: ${(e as Error).message}`],
      detectedMapping: null,
    };
  }

  if (records.length === 0) {
    return {
      transactions: [],
      headers: [],
      errors: ['CSV file contains no data rows'],
      detectedMapping: null,
    };
  }

  const headers = Object.keys(records[0]);
  const detectedMapping = mapping || autoDetectMapping(headers);

  if (!detectedMapping) {
    return {
      transactions: [],
      headers,
      errors: ['Could not auto-detect columns. Please provide mapping for: date, description, amount'],
      detectedMapping: null,
    };
  }

  // Validate mapping columns exist
  for (const [field, col] of Object.entries(detectedMapping)) {
    if (!headers.includes(col)) {
      errors.push(`Mapped column "${col}" for ${field} not found in headers`);
    }
  }
  if (errors.length > 0) {
    return { transactions: [], headers, errors, detectedMapping };
  }

  if (records.length > MAX_TRANSACTIONS) {
    return {
      transactions: [],
      headers,
      errors: [`Too many transactions: ${records.length}. Maximum is ${MAX_TRANSACTIONS}`],
      detectedMapping,
    };
  }

  const transactions: RawTransaction[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const desc = (row[detectedMapping.description] || '').trim();
    const rawAmount = row[detectedMapping.amount] || '';
    const rawDate = row[detectedMapping.date] || '';

    if (!desc && !rawAmount) {
      errors.push(`Row ${i + 2}: skipped (empty description and amount)`);
      continue;
    }

    transactions.push({
      date: parseDate(rawDate),
      description: desc || 'Unknown',
      amount: parseAmount(rawAmount),
      originalRow: { ...row },
    });
  }

  return { transactions, headers, errors, detectedMapping };
}
