import { Transaction, DuplicateCandidate, RecurringCandidate } from '../../shared/types';

/** Normalize merchant name for comparison */
function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse date string to timestamp for comparison */
function toTimestamp(dateStr: string): number {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Days between two date strings */
function daysBetween(a: string, b: string): number {
  const ta = toTimestamp(a);
  const tb = toTimestamp(b);
  if (ta === 0 || tb === 0) return Infinity;
  return Math.abs(ta - tb) / (1000 * 60 * 60 * 24);
}

/**
 * Find potential duplicate transactions.
 * Criteria: same normalized merchant, same amount, within 3 days of each other.
 */
export function findDuplicates(transactions: Transaction[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];

      const normA = normalizeMerchant(a.description);
      const normB = normalizeMerchant(b.description);

      if (normA !== normB) continue;
      if (Math.abs(a.amount - b.amount) > 0.01) continue;

      const days = daysBetween(a.date, b.date);
      if (days > 3) continue;

      const key = [a.id, b.id].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        transactionIds: [a.id, b.id],
        merchant: a.description,
        amount: a.amount,
        dates: [a.date, b.date],
        confidence: days <= 1 ? 'high' : 'medium',
      });
    }
  }

  return candidates;
}

/**
 * Find potential recurring charges.
 * Criteria: same normalized merchant, similar amounts, appearing 3+ times
 * with roughly consistent intervals (within 20% tolerance).
 */
export function findRecurring(transactions: Transaction[]): RecurringCandidate[] {
  // Group by normalized merchant
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = normalizeMerchant(t.description);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(t);
    groups.set(key, group);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < 3) continue;

    // Sort by date
    const sorted = [...group].sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date));

    // Check if amounts are similar (within 10% of median)
    const amounts = sorted.map(t => Math.abs(t.amount));
    const median = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
    if (median === 0) continue;

    const similar = sorted.filter(t => Math.abs(Math.abs(t.amount) - median) / median < 0.1);
    if (similar.length < 3) continue;

    // Check for consistent intervals
    const intervals: number[] = [];
    for (let i = 1; i < similar.length; i++) {
      const days = daysBetween(similar[i - 1].date, similar[i].date);
      if (isFinite(days) && days > 0) {
        intervals.push(days);
      }
    }

    if (intervals.length < 2) continue;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // Check if intervals are somewhat consistent (within 40% tolerance for real-world billing)
    const consistent = intervals.every(iv => Math.abs(iv - avgInterval) / avgInterval < 0.4);
    if (!consistent) continue;

    let estimatedInterval = 'irregular';
    if (avgInterval >= 25 && avgInterval <= 35) estimatedInterval = 'monthly';
    else if (avgInterval >= 6 && avgInterval <= 8) estimatedInterval = 'weekly';
    else if (avgInterval >= 13 && avgInterval <= 16) estimatedInterval = 'bi-weekly';
    else if (avgInterval >= 85 && avgInterval <= 100) estimatedInterval = 'quarterly';
    else if (avgInterval >= 350 && avgInterval <= 380) estimatedInterval = 'yearly';

    candidates.push({
      merchant: similar[0].description,
      transactionIds: similar.map(t => t.id),
      amounts: similar.map(t => t.amount),
      dates: similar.map(t => t.date),
      estimatedInterval,
    });
  }

  return candidates;
}
