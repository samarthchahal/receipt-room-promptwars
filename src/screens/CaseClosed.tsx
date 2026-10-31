import React, { useEffect, useState } from 'react';
import type { CaseSummary } from '../../shared/types';
import { getSummary, downloadFile, getExportCSVUrl, getExportSummaryUrl } from '../api/client';
import './CaseClosed.css';

export default function CaseClosed({ onNewInvestigation }: { onNewInvestigation: () => void }) {
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState('');
  useEffect(() => { let active = true; getSummary().then(s => { if (active) setSummary(s); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function download(kind: 'csv' | 'summary') {
    setDownloading(kind); setDownloadError('');
    try { await downloadFile(kind === 'csv' ? getExportCSVUrl() : getExportSummaryUrl(), kind === 'csv' ? 'receipt-room-reviewed.csv' : 'receipt-room-case-summary.txt'); }
    catch (e) { setDownloadError((e as Error).message); }
    finally { setDownloading(''); }
  }
  if (error) return <main className="archive-page"><section className="paper" role="alert"><h1>Unable to retrieve the dossier</h1><p>{error}</p><button className="btn btn-primary" onClick={onNewInvestigation}>New investigation</button></section></main>;
  if (!summary) return <main className="archive-page"><p className="paper" role="status">Preparing the case report…</p></main>;
  const complete = summary.unreviewed === 0 && summary.totalTransactions > 0;
  const percent = summary.totalTransactions ? Math.round(summary.reviewedCount / summary.totalTransactions * 100) : 0;
  const entries = Object.entries(summary.categoryCounts).filter(([,n]) => n > 0).sort((a,b) => b[1] - a[1]);
  return <main className="archive-page"><header className="paper archive-ribbon"><div><p className="eyebrow">OFFICIAL CASE RECORD · {new Date(summary.completedAt).toLocaleDateString()}</p><h1>{complete ? 'Case Cleared: The Expense Investigation' : 'Investigation Record: Review in Progress'}</h1></div><span className="stamp">{complete ? 'REVIEW COMPLETE' : 'OPEN INQUIRY'}</span></header>
    <div className="archive-grid"><div><section className="archive-folder" aria-label="Sealed case dossier"><p className="eyebrow">DOSSIER #{summary.sessionId.slice(0,8).toUpperCase()}</p><div className="folder-cover"><div className="closure-label"><strong>{complete ? 'CASE CLOSED' : 'CASE OPEN'}</strong><small>{percent}% OF EVIDENCE REVIEWED</small></div><div className="wax-seal">BUREAU REVIEW<br/>{complete ? 'FILED' : 'PENDING'}</div></div><div className="archive-metadata"><p className="eyebrow">PRINCIPAL RECORD</p><p>EXPENSE RECONCILIATION LEDGER</p><p>Imported: {new Date(summary.importedAt).toLocaleString()}</p><p>Session: {summary.sessionId.slice(0,8).toUpperCase()}</p></div></section>
    <section className="paper archive-controls" aria-label="Download reviewed files"><p className="eyebrow">BUREAU DISPATCH CONTROLS</p><button className="btn btn-primary" id="download-csv-btn" disabled={!!downloading} onClick={() => download('csv')}>{downloading === 'csv' ? 'Preparing ledger…' : 'Download Reviewed Ledger'} <span>.CSV</span></button><button className="btn btn-secondary" id="download-summary-btn" disabled={!!downloading} onClick={() => download('summary')}>{downloading === 'summary' ? 'Preparing summary…' : 'Download Case Summary'} <span>.TXT</span></button><button className="btn btn-secondary" id="new-investigation-btn" onClick={onNewInvestigation}>Open New Case Dossier <span>[ + ]</span></button>{downloadError && <p role="alert">{downloadError}</p>}</section></div>
    <div><article className="archive-report"><div className="brass-clip" aria-hidden="true"/><header><p className="eyebrow">FORM 1947-B · SESSION REVIEW RECORD</p><h2>Bureau Audit Summary &amp; Revelations</h2><p>{complete ? 'Every imported transaction has a recorded classification. The ledger preserves the decisions made during this investigation.' : 'This report reflects the current session. Some evidence still awaits review.'}</p></header>
    <section className="archive-metrics" aria-label="Investigation statistics"><div><span>Transactions reviewed</span><strong>{summary.reviewedCount} / {summary.totalTransactions}</strong><span>{percent}% EXAMINED</span></div><div><span>Evidence remaining</span><strong>{summary.unreviewed}</strong><span>AWAITING CLASSIFICATION</span></div><div><span>Duplicate flags</span><strong>{summary.duplicatesFlagged}</strong><span>RECORDS TO INSPECT</span></div><div><span>Recurring flags</span><strong>{summary.recurringFlagged}</strong><span>PATTERN NOTATIONS</span></div></section>
    <section aria-label="Review results"><h3>Before &amp; After Review</h3><div className="archive-finding"><p className="eyebrow">BEFORE · INTAKE</p><p>{summary.totalTransactions} imported expense records awaiting human review.</p></div><div className="archive-finding"><p className="eyebrow">AFTER · RECORDED DECISIONS</p><p>{summary.reviewedCount} records reviewed across {entries.length} categories. {summary.unreviewed} remain unreviewed.</p></div></section>
    <section aria-label="Flagged evidence"><h3>Anomalies &amp; Marginalia</h3><div className="archive-finding"><p className="eyebrow">DUPLICATE &amp; RECURRING NOTATIONS</p><p>{summary.duplicatesFlagged} duplicate flags and {summary.recurringFlagged} recurring flags are recorded in the ledger. Flags identify evidence for inspection; they do not confirm fraud or a refund.</p></div></section>
    <section aria-label="Category breakdown"><h3>Category Breakdown Archive</h3>{entries.length ? entries.map(([cat,count]) => <div className="archive-category" key={cat}><strong>{cat}</strong><span>{count} RECEIPTS FILED</span></div>) : <p>No classifications recorded yet.</p>}</section>
    <footer className="archive-signature"><p className="eyebrow">REVIEW RECORD</p><strong>The Investigator</strong><span className="micro">DECISIONS CONFIRMED BY THE RECEIPT ROOM SERVER</span></footer></article><p className="archive-disclaimer">The exported ledger contains this session’s actual decisions and flags. Your original uploaded file was never modified.</p></div></div>
  </main>;
}
