import type {
  Transaction, SessionProgress, ApiResponse, DuplicateCandidate,
  RecurringCandidate, CaseSummary, Category, ReviewAction
} from '../../shared/types';

const BASE = '/api';

let sessionId: string | null = null;

export function setSessionId(id: string) {
  sessionId = id;
}

export function getSessionId(): string | null {
  return sessionId;
}

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (sessionId) h['X-Session-Id'] = sessionId;
  return h;
}

function sessionHeaders(): HeadersInit {
  const h: HeadersInit = {};
  if (sessionId) h['X-Session-Id'] = sessionId;
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data: ApiResponse<T> = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  return data.data as T;
}

export async function uploadCSV(file: File): Promise<{ sessionId: string; transactionCount: number; warnings: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: formData });
  const result = await handleResponse<{ sessionId: string; transactionCount: number; warnings: string[] }>(res);
  setSessionId(result.sessionId);
  return result;
}

export async function startDemo(): Promise<{ sessionId: string; transactionCount: number }> {
  const res = await fetch(`${BASE}/demo`, { method: 'POST' });
  const result = await handleResponse<{ sessionId: string; transactionCount: number }>(res);
  setSessionId(result.sessionId);
  return result;
}

export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${BASE}/transactions`, { headers: sessionHeaders() });
  return handleResponse<Transaction[]>(res);
}

export async function reviewTransaction(transactionId: string, category: Category): Promise<Transaction> {
  const res = await fetch(`${BASE}/review`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ transactionId, category }),
  });
  return handleResponse<Transaction>(res);
}

export async function batchReview(reviews: ReviewAction[]): Promise<{ updated: number; errors: string[] }> {
  const res = await fetch(`${BASE}/review/batch`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ reviews }),
  });
  return handleResponse<{ updated: number; errors: string[] }>(res);
}

export async function flagTransaction(
  transactionId: string,
  flagType: 'duplicate' | 'recurring',
  flagged: boolean
): Promise<Transaction> {
  const res = await fetch(`${BASE}/flag`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ transactionId, flagType, flagged }),
  });
  return handleResponse<Transaction>(res);
}

export async function getProgress(): Promise<SessionProgress> {
  const res = await fetch(`${BASE}/progress`, { headers: sessionHeaders() });
  return handleResponse<SessionProgress>(res);
}

export async function getDuplicates(): Promise<DuplicateCandidate[]> {
  const res = await fetch(`${BASE}/duplicates`, { headers: sessionHeaders() });
  return handleResponse<DuplicateCandidate[]>(res);
}

export async function getRecurring(): Promise<RecurringCandidate[]> {
  const res = await fetch(`${BASE}/recurring`, { headers: sessionHeaders() });
  return handleResponse<RecurringCandidate[]>(res);
}

export async function getSummary(): Promise<CaseSummary> {
  const res = await fetch(`${BASE}/summary`, { headers: sessionHeaders() });
  return handleResponse<CaseSummary>(res);
}

export function getExportCSVUrl(): string {
  return `${BASE}/export/csv`;
}

export function getExportSummaryUrl(): string {
  return `${BASE}/export/summary`;
}

export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { headers: sessionHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || 'Download failed. Please try again.');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
