import React, { useEffect, useState, useCallback } from 'react';
import type { CaseSummary, Category } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';
import { getSummary, downloadFile, getExportCSVUrl, getExportSummaryUrl, getSessionId } from '../api/client';
import './CaseClosed.css';

interface Props {
  onNewInvestigation: () => void;
}

const CATEGORY_ICONS: Record<Category, string> = {
  'Food & Dining': '🍽️',
  'Shopping': '🛍️',
  'Transport': '🚗',
  'Bills & Utilities': '📄',
  'Entertainment': '🎬',
  'Health': '💊',
  'Education': '📚',
  'Other': '📌',
};

export default function CaseClosed({ onNewInvestigation }: Props) {
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSummary();
        setSummary(s);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownloadCSV = useCallback(async () => {
    setDownloading('csv');
    try {
      await downloadFile(getExportCSVUrl(), 'receipt-room-reviewed.csv');
    } catch { /* ignore */ }
    setDownloading(null);
  }, []);

  const handleDownloadSummary = useCallback(async () => {
    setDownloading('summary');
    try {
      await downloadFile(getExportSummaryUrl(), 'receipt-room-case-summary.txt');
    } catch { /* ignore */ }
    setDownloading(null);
  }, []);

  if (loading) {
    return (
      <main className="case-closed" role="main">
        <div className="container cc-loading">
          <div className="desk-spinner" aria-hidden="true"></div>
          <p>Preparing case report...</p>
        </div>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="case-closed" role="main">
        <div className="container">
          <div className="card cc-error" role="alert">
            <h2>Error loading case summary</h2>
            <p>{error || 'Could not retrieve summary'}</p>
            <button className="btn btn-primary" onClick={onNewInvestigation}>Start New Investigation</button>
          </div>
        </div>
      </main>
    );
  }

  const percentComplete = summary.totalTransactions > 0
    ? Math.round((summary.reviewedCount / summary.totalTransactions) * 100)
    : 0;

  const categoryEntries = Object.entries(summary.categoryCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className="case-closed" role="main">
      <div className="container">
        <div className="cc-content animate-fade-in">
          {/* Case Closed Header */}
          <header className="cc-header">
            <div className="stamp stamp-reviewed animate-stamp cc-stamp">CASE CLOSED</div>
            <h1>Investigation Complete</h1>
            <p className="cc-tagline">Every expense tells a story. Here's yours.</p>
            <p className="cc-case-id">Case #{summary.sessionId.slice(0, 8).toUpperCase()}</p>
          </header>

          {/* Summary Stats */}
          <section className="cc-stats" aria-label="Investigation statistics">
            <div className="cc-stat-grid">
              <div className="card cc-stat-card">
                <span className="cc-stat-icon" aria-hidden="true">📋</span>
                <span className="cc-stat-value">{summary.totalTransactions}</span>
                <span className="cc-stat-label">Total Evidence</span>
              </div>
              <div className="card cc-stat-card">
                <span className="cc-stat-icon" aria-hidden="true">✅</span>
                <span className="cc-stat-value">{summary.reviewedCount}</span>
                <span className="cc-stat-label">Cases Reviewed</span>
              </div>
              <div className="card cc-stat-card">
                <span className="cc-stat-icon" aria-hidden="true">📊</span>
                <span className="cc-stat-value">{percentComplete}%</span>
                <span className="cc-stat-label">Completion</span>
              </div>
              <div className="card cc-stat-card">
                <span className="cc-stat-icon" aria-hidden="true">⏳</span>
                <span className="cc-stat-value">{summary.unreviewed}</span>
                <span className="cc-stat-label">Remaining</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="cc-progress">
              <div className="progress-bar" role="progressbar" aria-valuenow={percentComplete} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar-fill" style={{ width: `${percentComplete}%` }}></div>
              </div>
              <span className="cc-progress-text">{percentComplete}% of evidence reviewed</span>
            </div>
          </section>

          {/* Category Breakdown */}
          {categoryEntries.length > 0 && (
            <section className="cc-categories card" aria-label="Category breakdown">
              <h2>📂 Category Breakdown</h2>
              <div className="cc-cat-list">
                {categoryEntries.map(([cat, count]) => (
                  <div key={cat} className="cc-cat-row">
                    <span className="category-pill active btn-sm" data-category={cat}>
                      {CATEGORY_ICONS[cat as Category] || '📌'} {cat}
                    </span>
                    <div className="cc-cat-bar-wrap">
                      <div
                        className="cc-cat-bar"
                        style={{ width: `${(count / summary.reviewedCount) * 100}%` }}
                      ></div>
                    </div>
                    <span className="cc-cat-count">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Flags */}
          {(summary.duplicatesFlagged > 0 || summary.recurringFlagged > 0) && (
            <section className="cc-flags card" aria-label="Flagged items">
              <h2>🚩 Flagged Items</h2>
              <div className="cc-flag-grid">
                {summary.duplicatesFlagged > 0 && (
                  <div className="cc-flag-item">
                    <span className="cc-flag-icon">⚠️</span>
                    <span className="cc-flag-count">{summary.duplicatesFlagged}</span>
                    <span className="cc-flag-label">Duplicate Suspects</span>
                  </div>
                )}
                {summary.recurringFlagged > 0 && (
                  <div className="cc-flag-item">
                    <span className="cc-flag-icon">🔄</span>
                    <span className="cc-flag-count">{summary.recurringFlagged}</span>
                    <span className="cc-flag-label">Recurring Charges</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Download Actions */}
          <section className="cc-downloads" aria-label="Download reviewed files">
            <h2>📥 Export Your Investigation</h2>
            <p className="cc-downloads-desc">Download your reviewed expense ledger and case summary to verify the completed work.</p>
            <div className="cc-download-btns">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleDownloadCSV}
                disabled={downloading !== null}
                id="download-csv-btn"
              >
                {downloading === 'csv' ? '⏳ Preparing...' : '📄 Download Reviewed CSV'}
              </button>
              <button
                className="btn btn-secondary btn-lg"
                onClick={handleDownloadSummary}
                disabled={downloading !== null}
                id="download-summary-btn"
              >
                {downloading === 'summary' ? '⏳ Preparing...' : '📋 Download Case Summary'}
              </button>
            </div>
          </section>

          {/* New Investigation */}
          <section className="cc-new">
            <hr className="divider" />
            <button
              className="btn btn-terracotta btn-lg"
              onClick={onNewInvestigation}
              id="new-investigation-btn"
            >
              🔍 Start New Investigation
            </button>
          </section>

          {/* Footer */}
          <footer className="cc-footer">
            <p className="cc-disclaimer">
              Your reviewed data reflects decisions made during this investigation session.
              The original uploaded file was never modified.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
