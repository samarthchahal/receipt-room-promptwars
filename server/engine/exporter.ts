import { stringify } from 'csv-stringify/sync';
import { Transaction, CaseSummary, Category, CATEGORIES } from '../../shared/types';

/** Characters that could trigger formula injection in spreadsheets */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

/** Sanitize a cell value to prevent CSV formula injection */
function sanitizeCell(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (FORMULA_PREFIXES.some(p => trimmed.startsWith(p))) {
    // Prefix with single quote to neutralize formula
    return "'" + trimmed;
  }
  return trimmed;
}

/** Sanitize all values in a record */
function sanitizeRow(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    result[key] = sanitizeCell(String(val ?? ''));
  }
  return result;
}

export function generateReviewedCSV(transactions: Transaction[]): string {
  const rows = transactions.map(t => {
    const base = sanitizeRow(t.originalRow);
    return {
      ...base,
      'Review_Status': t.reviewed ? 'Reviewed' : 'Pending',
      'Reviewed_Category': t.confirmedCategory || '',
      'Suggested_Category': t.suggestedCategory,
      'Duplicate_Flag': t.duplicateFlag ? 'Flagged' : '',
      'Recurring_Flag': t.recurringFlag ? 'Flagged' : '',
    };
  });

  return stringify(rows, { header: true });
}

export function generateCaseSummary(
  sessionId: string,
  transactions: Transaction[],
  importedAt: string
): CaseSummary {
  const reviewed = transactions.filter(t => t.reviewed);
  const categoryCounts: Record<string, number> = {};

  for (const cat of CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  for (const t of reviewed) {
    if (t.confirmedCategory) {
      categoryCounts[t.confirmedCategory] = (categoryCounts[t.confirmedCategory] || 0) + 1;
    }
  }

  return {
    sessionId,
    importedAt,
    completedAt: new Date().toISOString(),
    totalTransactions: transactions.length,
    reviewedCount: reviewed.length,
    categoryCounts,
    duplicatesFlagged: transactions.filter(t => t.duplicateFlag).length,
    recurringFlagged: transactions.filter(t => t.recurringFlag).length,
    unreviewed: transactions.length - reviewed.length,
  };
}

export function generateCaseSummaryText(summary: CaseSummary): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    '         THE RECEIPT ROOM — CASE SUMMARY        ',
    '═══════════════════════════════════════════════',
    '',
    `Case ID:            ${summary.sessionId.slice(0, 8)}`,
    `Investigation Start: ${summary.importedAt}`,
    `Case Closed:        ${summary.completedAt}`,
    '',
    '── INVESTIGATION RESULTS ──────────────────────',
    '',
    `Total Evidence:     ${summary.totalTransactions} transactions`,
    `Cases Reviewed:     ${summary.reviewedCount}`,
    `Cases Pending:      ${summary.unreviewed}`,
    `Completion:         ${Math.round((summary.reviewedCount / summary.totalTransactions) * 100)}%`,
    '',
    '── CATEGORY BREAKDOWN ─────────────────────────',
    '',
  ];

  for (const [cat, count] of Object.entries(summary.categoryCounts)) {
    if (count > 0) {
      lines.push(`  ${cat.padEnd(20)} ${count}`);
    }
  }

  lines.push('');
  lines.push('── SPECIAL FLAGS ──────────────────────────────');
  lines.push('');
  lines.push(`Duplicate Suspects:  ${summary.duplicatesFlagged}`);
  lines.push(`Recurring Charges:   ${summary.recurringFlagged}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════');
  lines.push('  Every expense tells a story.                 ');
  lines.push('═══════════════════════════════════════════════');

  return lines.join('\n');
}
