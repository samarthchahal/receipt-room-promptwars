import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction, Category } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';
import { reviewTransaction } from '../api/client';
import './InvestigationRoom.css';

interface Props { initialTransactions: Transaction[]; onCaseClosed: () => void; onBack: () => void; }
const notes = ['MEALS · CAFÉS · RESTAURANTS','RETAIL · GOODS · APPAREL','RIDES · RAIL · FUEL','POWER · PHONE · SERVICES','CINEMA · MUSIC · LEISURE','MEDICAL · PHARMACY · CARE','BOOKS · COURSES · LEARNING','MISCELLANEOUS · SUNDRIES'];
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function InvestigationRoom({ initialTransactions, onCaseClosed, onBack }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [streak, setStreak] = useState(0);
  const [notice, setNotice] = useState('');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const lock = useRef(false);
  const alive = useRef(true);
  const receiptRef = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!timerEnabled || paused) return;
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [timerEnabled, paused]);
  const pending = transactions.filter(t => !t.reviewed);
  const reviewed = transactions.filter(t => t.reviewed);
  const current = pending[index % Math.max(pending.length, 1)];
  const percent = transactions.length ? Math.round(reviewed.length / transactions.length * 100) : 0;
  const clues = transactions.filter(t => t.duplicateFlag || t.recurringFlag);
  const select = useCallback(async (category: Category) => {
    if (!current || lock.current || paused) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const updated = await reviewTransaction(current.id, category);
      if (!alive.current) return;
      setStamp(category);
      await new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650));
      if (!alive.current) return;
      setTransactions(txs => txs.map(t => t.id === updated.id ? updated : t));
      setIndex(i => i >= pending.length - 1 ? 0 : i);
      setStreak(s => s + 1);
      setNotice(updated.description + ' filed as ' + updated.confirmedCategory + '. Server confirmed.');
      setStamp(null);
      requestAnimationFrame(() => receiptRef.current?.focus());
    } catch (err) {
      if (alive.current) { setError((err as Error).message); setStreak(0); }
    } finally {
      lock.current = false;
      if (alive.current) { setBusy(false); setStamp(null); }
    }
  }, [current, paused, pending.length]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('button, input, select, textarea, a') || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      if (e.key === '?') { setHelp(h => !h); return; }
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); return; }
      if (busy || paused || help) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 8) { e.preventDefault(); void select(CATEGORIES[n - 1]); }
      if (e.key === 'Enter' && current) { e.preventDefault(); void select(current.suggestedCategory); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(i => (i + 1) % Math.max(pending.length, 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(i => (i - 1 + pending.length) % Math.max(pending.length, 1)); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [select, current, busy, paused, help, pending.length]);
  // App reloads transactions from the server before resuming this screen.
  useEffect(() => {
    if (!pending.length) document.getElementById('close-case-btn')?.focus();
  }, [pending.length]);

  return <main className="investigation" aria-label="Investigation Room">
    <section className="clue-rail" aria-label="Evidence pinboard"><article className="pinned-note"><p className="eyebrow">CURRENT DOCKET</p><strong>{transactions.length} expense records</strong><p>{reviewed.length} reviewed · {pending.length} pending</p></article><article className="pinned-note rail-memo"><p className="eyebrow">MEMORANDUM · CONFIDENTIAL</p><p>{clues.length ? clues.length + ' records carry duplicate or recurring flags. Examine the evidence before filing.' : 'Cross-examine every merchant. Suggestions are leads; the final classification is yours.'}</p></article>{clues.slice(0,1).map(t => <article className="pinned-note clue-record" key={t.id}><p className="eyebrow">{t.duplicateFlag ? 'DUPLICATE FLAG' : 'RECURRING FLAG'}</p><strong>{t.description}</strong><p>{money(t.amount)} · {t.date}</p></article>)}</section>
    <div className="inv-toolbar"><button className="btn btn-secondary btn-sm" onClick={onBack} disabled={busy}>← Evidence intake</button><span className="micro">WORKING DOSSIER · EXPENSE REVIEW</span><div><button className="btn btn-secondary btn-sm" aria-pressed={timerEnabled} onClick={() => setTimerEnabled(t => !t)}>{timerEnabled ? Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0') : 'Timer'}</button><button className="btn btn-secondary btn-sm" onClick={() => setHelp(h => !h)} aria-expanded={help}>[?] Shortcuts</button><button className="btn btn-secondary btn-sm" onClick={() => setPaused(p => !p)} disabled={busy}>{paused ? 'Resume' : 'Pause'}</button></div></div>
    {help && <section className="shortcut-sheet paper" aria-label="Keyboard shortcuts"><h2>Field keyboard manual</h2><p>1–8: file into a category · Enter: accept suggestion · Arrow keys: browse receipts · Space: pause · ?: show this guide.</p><button className="btn btn-secondary" onClick={() => setHelp(false)}>Close guide</button></section>}
    {error && <p className="review-error" role="alert">Unable to file: {error}. Your receipt remains on the desk. Please retry.</p>}
    <div className="sr-only" role="status" aria-live="polite">{notice}</div>
    {paused ? <section className="paper inv-paused"><h1>Investigation paused</h1><p>Your evidence is waiting on the desk.</p><button className="btn btn-primary" onClick={() => setPaused(false)}>Resume investigation</button></section> : pending.length === 0 ? <section className="paper inv-paused"><span className="stamp">ALL EVIDENCE REVIEWED</span><h1>Ready for the archives.</h1><p>{reviewed.length} of {transactions.length} records confirmed by the server.</p><button className="btn btn-primary" onClick={onCaseClosed} id="close-case-btn">Close the Case →</button></section> : current && <div className="investigation-grid">
      <aside className="casebook-paper" aria-label="Case details"><header className="document-heading"><p className="eyebrow">DOSSIER · ACTIVE INQUIRY</p><h1>The Expense<br/>Investigation</h1></header><section className="casebook-section"><p className="eyebrow">INVESTIGATION OBJECTIVE</p><p>Examine {transactions.length} expense records. Follow the merchant trail and classify every receipt.</p></section><section className="casebook-section"><div className="ledger-line"><strong>{reviewed.length} / {transactions.length} EVIDENCE AUDITED</strong><span>{percent}%</span></div><div className="progress-bar" role="progressbar" aria-label="Evidence reviewed" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar-fill" style={{width: percent + '%'}}/></div><p className="micro">{pending.length} REMAINING IN STACK</p></section><p className="eyebrow">FORENSIC CLUES & MARGINALIA</p><article className="field-note"><p className="eyebrow">NOTE 01 · CURRENT EVIDENCE</p><p>{current.description} · {current.date} · {money(current.amount)}</p></article><article className="field-note"><p className="eyebrow">NOTE 02 · ROUTING</p><p>Suggested filing: {current.suggestedCategory}. {current.duplicateFlag ? 'Duplicate flag recorded.' : ''} {current.recurringFlag ? 'Recurring flag recorded.' : ''}</p></article><section className="casebook-section"><p className="eyebrow">AUDIT CHECKLIST</p><p>☑ Evidence imported</p><p>{pending.length ? '□' : '☑'} Review all merchant receipts</p><p>□ Export reviewed ledger</p></section><div className="ledger-line"><span className="micro">CONSECUTIVE FILINGS</span><strong>{streak} CONFIRMED</strong></div></aside>
      <section className="receipt-workspace" aria-label="Current receipt" aria-busy={busy}><div className={'physical-receipt ' + (stamp ? 'is-filed' : '')} key={current.id} ref={receiptRef} tabIndex={-1}><div className="brass-clip" aria-hidden="true"/><div className="receipt-routing"><p className="eyebrow">SUGGESTED CLASSIFICATION</p><strong>{current.suggestedCategory}</strong><span className="micro">INSPECTOR CONFIRMATION REQUIRED</span></div><h2>{current.description}</h2><p className="receipt-ref">TRANS REF: {current.id.slice(0,8).toUpperCase()}</p><p className="eyebrow receipt-date">DATE: {current.date}</p><div className="receipt-rule"/><div className="ledger-line"><strong>TRANSACTION DESCRIPTION</strong><strong>AMOUNT</strong></div><div className="receipt-item"><strong>{current.description}</strong><span>{money(current.amount)}</span></div><p className="receipt-ref">Original imported expense record</p><div className="receipt-rule"/><div className="receipt-total"><span>TOTAL AMOUNT:</span><strong>{money(current.amount)}</strong></div><p className="receipt-ref">CLASSIFICATION: {current.suggestedCategory}</p><p className="receipt-ref">{current.duplicateFlag ? 'DUPLICATE FLAG RECORDED' : 'NO DUPLICATE FLAG'} · {current.recurringFlag ? 'RECURRING FLAG RECORDED' : 'NO RECURRING FLAG'}</p><p className="receipt-end">* * * END OF EXPENSE VOUCHER * * *</p>{stamp && <div className="confirmed-stamp"><strong>REVIEWED</strong><span>{stamp}</span><small>SERVER CONFIRMED</small></div>}</div><div className="receipt-navigation"><button className="btn btn-secondary btn-sm" disabled={busy || pending.length < 2} onClick={() => setIndex(i => (i - 1 + pending.length) % pending.length)}>← Previous</button><span className="micro">{index % pending.length + 1} / {pending.length} PENDING</span><button className="btn btn-secondary btn-sm" disabled={busy || pending.length < 2} onClick={() => setIndex(i => (i + 1) % pending.length)}>Next →</button></div><button className="verify-receipt" disabled={busy || help} onClick={() => select(current.suggestedCategory)}>{busy ? stamp ? 'REVIEW CONFIRMED · FILING…' : 'AWAITING SERVER CONFIRMATION…' : '[ENTER] VERIFY & CLASSIFY SLIP'}</button><p className="hotkey-strip">[1–8] FILE INTO FOLDER · [← →] BROWSE · [SPACE] PAUSE</p></section>
      <aside className="filing-cabinet" aria-label="Category filing cabinet"><header className="cabinet-heading"><strong>CABINET 04: LEDGERS</strong><span>8 SLOTS</span></header><p className="filing-instruction">SELECT A FOLDER TO FILE THIS RECEIPT</p><div className="folder-list">{CATEGORIES.map((cat,i) => <button className={'category-folder ' + (cat === current.suggestedCategory ? 'suggested' : '') + (stamp === cat ? 'folder-receiving' : '')} key={cat} disabled={busy || help} onClick={() => select(cat)} aria-label={'File as ' + cat + ' (press ' + (i+1) + ')'}><span className="folder-key">{i+1}</span><span><strong>{cat}</strong><small>{notes[i]}</small></span><span className="filed-count">{reviewed.filter(t => t.confirmedCategory === cat).length}</span></button>)}</div><div className="cabinet-footer"><span className="micro">CONFIRMED FILINGS</span><strong>{reviewed.length}</strong></div></aside>
    </div>}
  </main>;
}
