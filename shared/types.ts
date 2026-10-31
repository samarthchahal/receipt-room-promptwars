/** Shared type definitions between server and client */

export const CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Transport',
  'Bills & Utilities',
  'Entertainment',
  'Health',
  'Education',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface RawTransaction {
  date: string;
  description: string;
  amount: number;
  originalRow: Record<string, string>;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  suggestedCategory: Category;
  confirmedCategory: Category | null;
  reviewed: boolean;
  duplicateFlag: boolean;
  recurringFlag: boolean;
  originalRow: Record<string, string>;
}

export interface SessionProgress {
  sessionId: string;
  totalTransactions: number;
  reviewedCount: number;
  categoryCounts: Record<Category, number>;
  duplicatesFlagged: number;
  recurringFlagged: number;
  percentComplete: number;
}

export interface ReviewAction {
  transactionId: string;
  category: Category;
}

export interface FlagAction {
  transactionId: string;
  flagType: 'duplicate' | 'recurring';
  flagged: boolean;
}

export interface DuplicateCandidate {
  transactionIds: string[];
  merchant: string;
  amount: number;
  dates: string[];
  confidence: 'high' | 'medium';
}

export interface RecurringCandidate {
  merchant: string;
  transactionIds: string[];
  amounts: number[];
  dates: string[];
  estimatedInterval: string;
}

export interface CaseSummary {
  sessionId: string;
  importedAt: string;
  completedAt: string;
  totalTransactions: number;
  reviewedCount: number;
  categoryCounts: Record<string, number>;
  duplicatesFlagged: number;
  recurringFlagged: number;
  unreviewed: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
}
