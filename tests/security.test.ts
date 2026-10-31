import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import app from '../server/index';
import { MAX_FILE_SIZE, MAX_TRANSACTIONS, parseCSV } from '../server/engine/csvParser';
import { CATEGORIES, Transaction } from '../shared/types';

let server: Server;
let base: string;
let sessionA: string;
let sessionB: string;
let transactionsA: Transaction[];

async function request(path: string, session?: string, body?: unknown) {
  return fetch(base + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(session ? { 'X-Session-Id': session } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function upload(content: string, mapping: Record<string, string | string[]> = {}) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/csv' }), 'evidence.csv');
  for (const [key, values] of Object.entries(mapping)) {
    for (const value of Array.isArray(values) ? values : [values]) form.append(key, value);
  }
  return fetch(base + '/api/upload', { method: 'POST', body: form });
}

async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = await response.json();
  expect(body).toEqual({ success: false, error: expect.any(String) });
  expect(body.error).not.toMatch(/stack|node_modules|SyntaxError|TypeError/);
}

beforeAll(async () => {
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const a = await (await request('/demo', undefined, {})).json();
  const b = await (await request('/demo', undefined, {})).json();
  sessionA = a.data.sessionId;
  sessionB = b.data.sessionId;
  transactionsA = (await (await request('/transactions', sessionA)).json()).data;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('HTTP session boundary', () => {
  it.each(['/transactions', '/progress', '/duplicates', '/recurring', '/summary', '/export/csv', '/export/summary'])(
    'rejects missing, malformed and unknown sessions on %s', async path => {
      await expectError(await request(path), 401);
      await expectError(await request(path, 'invalid-session'), 404);
      await expectError(await request(path, randomBytes(32).toString('hex')), 404);
    },
  );

  it('rejects cross-session review, batch review and flagging without mutating the victim', async () => {
    const transactionId = transactionsA[0].id;
    await expectError(await request('/review', sessionB, { transactionId, category: 'Health' }), 404);
    await expectError(await request('/flag', sessionB, { transactionId, flagType: 'duplicate', flagged: true }), 404);
    const batch = await (await request('/review/batch', sessionB, { reviews: [{ transactionId, category: 'Health' }] })).json();
    expect(batch).toEqual({ success: true, data: { updated: 0, errors: [`Transaction not found: ${transactionId}`] } });
    const victim = (await (await request('/transactions', sessionA)).json()).data[0];
    expect(victim.reviewed).toBe(false);
    expect(victim.duplicateFlag).toBe(false);
  });

  it('uses only the header session for CSV and summary exports, ignoring another session in query parameters', async () => {
    const a = await (await upload('Date,Description,Amount\n2026-01-01,SESSION_A_SECRET,10')).json();
    const b = await (await upload('Date,Description,Amount\n2026-01-02,SESSION_B_ONLY,20')).json();
    const csv = await (await request(`/export/csv?sessionId=${a.data.sessionId}`, b.data.sessionId)).text();
    expect(csv).toContain('SESSION_B_ONLY');
    expect(csv).not.toContain('SESSION_A_SECRET');
    const summary = await (await request(`/export/summary?sessionId=${a.data.sessionId}`, b.data.sessionId)).text();
    expect(summary).toContain(b.data.sessionId.slice(0, 8));
    expect(summary).not.toContain(a.data.sessionId.slice(0, 8));
  });

  it('rejects missing sessions on mutation endpoints', async () => {
    for (const path of ['/review', '/review/batch', '/flag']) await expectError(await request(path, undefined, {}), 401);
  });
});

describe('HTTP payload validation', () => {
  it.each([null, [], {}, 123, true, 'other', 'constructor', '__proto__', 'Food'])(
    'rejects invalid category %j', async category => {
      await expectError(await request('/review', sessionA, { transactionId: transactionsA[1].id, category }), 400);
    },
  );

  it.each([null, [], {}, 123, '', 'not-a-uuid', 'a'.repeat(1000)])('rejects invalid transaction ID %j', async transactionId => {
    await expectError(await request('/review', sessionA, { transactionId, category: 'Other' }), 400);
    await expectError(await request('/flag', sessionA, { transactionId, flagType: 'duplicate', flagged: true }), 400);
  });

  it('returns 404 for a well-formed unknown transaction ID', async () => {
    await expectError(await request('/review', sessionA, { transactionId: randomUUID(), category: 'Other' }), 404);
  });

  it('rejects non-object bodies and malformed JSON without reflecting input', async () => {
    for (const path of ['/review', '/review/batch', '/flag']) {
      await expectError(await request(path, sessionA, []), 400);
      await expectError(await request(path, sessionA, null), 400);
    }
    const response = await fetch(base + '/api/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionA }, body: '{"SECRET_INPUT":',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'Invalid JSON request body' });
  });

  it('handles null and primitive batch entries and preserves partial-success response shape', async () => {
    const response = await request('/review/batch', sessionA, { reviews: [null, 1, [], {},
      { transactionId: transactionsA[2].id, category: 'Other' }] });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.updated).toBe(1);
    expect(result.data.errors).toHaveLength(4);
  });

  it('rejects oversized batches before applying entries', async () => {
    await expectError(await request('/review/batch', sessionA, { reviews: Array(MAX_TRANSACTIONS + 1).fill(null) }), 400);
  });

  it('validates flag types and boolean values', async () => {
    await expectError(await request('/flag', sessionA, { transactionId: transactionsA[1].id, flagType: 'arbitrary', flagged: true }), 400);
    await expectError(await request('/flag', sessionA, { transactionId: transactionsA[1].id, flagType: 'duplicate', flagged: 'true' }), 400);
  });

  it('enforces the existing JSON body size limit with a safe error', async () => {
    await expectError(await request('/review', sessionA, { padding: 'x'.repeat(1024 * 1024) }), 413);
  });

  it('still reviews and exports all 50 demo transactions with exact submitted decisions', async () => {
    const demo = await (await request('/demo', undefined, {})).json();
    const session = demo.data.sessionId;
    const transactions: Transaction[] = (await (await request('/transactions', session)).json()).data;
    expect(transactions).toHaveLength(50);
    for (const [i, transaction] of transactions.entries()) {
      const category = CATEGORIES[i % CATEGORIES.length];
      const response = await request('/review', session, { transactionId: transaction.id, category });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: transaction.id, reviewed: true, confirmedCategory: category });
    }
    expect((await (await request('/progress', session)).json()).data).toMatchObject({ reviewedCount: 50, percentComplete: 100 });
    const exported = await request('/export/csv', session);
    expect(exported.headers.get('content-type')).toContain('text/csv');
    expect(exported.headers.get('content-disposition')).toBe('attachment; filename="receipt-room-reviewed.csv"');
    const rows = parse(await exported.text(), { columns: true });
    expect(rows).toHaveLength(50);
    rows.forEach((row: Record<string, string>, i: number) => {
      expect(row.Reviewed_Category).toBe(CATEGORIES[i % CATEGORIES.length]);
      expect(row.Review_Status).toBe('Reviewed');
      expect(row.Description).toBe(transactions[i].originalRow.Description);
      expect(row.Amount).toBe(transactions[i].originalRow.Amount);
    });
  });
});

describe('CSV and HTTP hardening', () => {
  it('neutralizes formula headers and cells across the actual upload/export boundary', async () => {
    const payloads = ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '\t=1+1', '\r=1+1', '\n=1+1', '  =1+1'];
    const csv = stringify([['Date', 'Description', 'Amount', '=HYPERLINK("https://example.com")'],
      ...payloads.map(value => ['2026-01-01', value, '10', value])]);
    const uploaded = await upload(csv);
    expect(uploaded.status).toBe(200);
    const session = (await uploaded.json()).data.sessionId;
    const exported = await request('/export/csv', session);
    const rows: string[][] = parse(await exported.text());
    expect(rows[0][3]).toBe('\'=HYPERLINK("https://example.com")');
    rows.slice(1).forEach((row, i) => {
      expect(row[1]).toBe("'" + payloads[i].trim());
      expect(row[3]).toBe("'" + payloads[i].trim());
      expect(row[2]).toBe('10');
    });
  });

  it('rejects malformed CSV safely without echoing uploaded cell contents', async () => {
    const response = await upload('Date,Description,Amount\n2026-01-01,"SECRET_UNCLOSED,10');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('CSV parsing failed');
    expect(JSON.stringify(body)).not.toContain('SECRET_UNCLOSED');
  });

  it('enforces file size at both the HTTP and parser boundaries', async () => {
    const csv = 'x'.repeat(MAX_FILE_SIZE + 1);
    await expectError(await upload(csv), 413);
    expect(parseCSV(csv)).toMatchObject({ transactions: [], errors: ['CSV file exceeds the 5 MB limit'] });
    expect(parseCSV('\u20ac'.repeat(Math.floor(MAX_FILE_SIZE / 3) + 1)).transactions).toEqual([]);
  });

  it('accepts the existing 5,000-row limit and rejects excess rows', async () => {
    const header = 'Date,Description,Amount\n';
    const row = '2026-01-01,Test,10\n';
    expect(parseCSV(header + row.repeat(MAX_TRANSACTIONS)).transactions).toHaveLength(MAX_TRANSACTIONS);
    const response = await upload(header + row.repeat(MAX_TRANSACTIONS + 1));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(`Maximum is ${MAX_TRANSACTIONS}`);
  });

  it('rejects duplicate or incomplete mapping fields and accepts valid mappings', async () => {
    const csv = 'dt,merchant,value\n2026-01-01,Test,10';
    await expectError(await upload(csv, { dateColumn: 'dt' }), 400);
    await expectError(await upload(csv, { dateColumn: ['dt', 'dt'], descriptionColumn: 'merchant' }), 400);
    const response = await upload(csv, { dateColumn: 'dt', descriptionColumn: 'merchant', amountColumn: 'value' });
    expect(response.status).toBe(200);
    expect((await response.json()).data.transactionCount).toBe(1);
  });

  it('rejects invalid upload types and excessive multipart fields', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'text/plain' }), 'bad.txt');
    await expectError(await fetch(base + '/api/upload', { method: 'POST', body: form }), 400);
    await expectError(await upload('Date,Description,Amount\n2026-01-01,Test,10', { a: '1', b: '2', c: '3', d: '4' }), 400);
  });

  it('rejects hostile sparse-array and nested multipart fields before append-field expands them', async () => {
    await expectError(await upload('Date,Description,Amount\n2026-01-01,Test,10', {
      'items[4294967294]': 'x', 'items[key]': 'y',
    }), 400);
    expect((await request('/health')).status).toBe(200);
  });

  it('rejects malformed file parts without terminating the server', async () => {
    for (const disposition of ['form-data; filename="evidence.csv"', 'form-data; name="file"; filename="evidence.csv"']) {
      const response = await fetch(base + '/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=receipt' },
        body: `--receipt\r\nContent-Disposition: ${disposition}\r\nContent-Type: text/csv\r\n\r\nDate,Description,Amount`,
      });
      await expectError(response, 400);
    }
    expect((await request('/health')).status).toBe(200);
  });

  it.each([
    ['multipart/form-data', 'invalid'],
    ['multipart/form-data; boundary=receipt', '--receipt\r\nContent-Disposition: form-data; name="dateColumn"\r\n\r\nDate'],
  ])('rejects malformed multipart requests with content type %s', async (contentType, body) => {
    await expectError(await fetch(base + '/api/upload', {
      method: 'POST', headers: { 'Content-Type': contentType }, body,
    }), 400);
  });

  it('does not group hostile duplicate headers or replace record prototypes', () => {
    const result = parseCSV('Date,Description,Amount,__proto__,__proto__,constructor\n2026-01-01,Test,10,one,two,own-value');
    expect(result.transactions).toHaveLength(1);
    const row = result.transactions[0].originalRow;
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(row, 'constructor')).toBe(true);
    expect(row.constructor).toBe('own-value');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('prevents non-finite amounts from turning into null in JSON', async () => {
    const result = parseCSV('Date,Description,Amount\n2026-01-01,Test,1e999');
    expect(result.transactions[0].amount).toBe(0);
  });

  it('retains security headers and prevents API response caching', async () => {
    const response = await request('/transactions', sessionA);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });
});
