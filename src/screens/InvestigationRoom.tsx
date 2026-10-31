import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Transaction, Category, SessionProgress } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';
import {
  reviewTransaction as apiReview,
  getProgress as apiProgress,
} from '../api/client';
import './InvestigationRoom.css';

interface Props {
  initialTransactions: Transaction[];
  onCaseClosed: () => void;
  onBack: () => void;
}

const CATEGORY_KEYS: Record<string, Category> = {
  '1': 'Food & Dining',
  '2': 'Shopping',
  '3': 'Transport',
  '4': 'Bills & Utilities',
  '5': 'Entertainment',
  '6': 'Health',
  '7': 'Education',
  '8': 'Other',
};

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

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function announce(msg: string) {
  const el = document.getElementById('live-announcer');
  if (el) el.textContent = msg;
}

export default function InvestigationRoom({ initialTransactions, onCaseClosed, onBack }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [streak, setStreak] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [stampVisible, setStampVisible] = useState(false);
  const [stampCategory, setStampCategory] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'streak' | null>(null);

  const unreviewed = useMemo(() => transactions.filter(t => !t.reviewed), [transactions]);
  const reviewed = useMemo(() => transactions.filter(t => t.reviewed), [transactions]);

  const currentTx = unreviewed[currentIndex] || null;
  const percentComplete = transactions.length > 0
    ? Math.round((reviewed.length / transactions.length) * 100)
    : 0;

  const refreshProgress = useCallback(async () => {
    try {
      const p = await apiProgress();
      setProgress(p);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  useEffect(() => {
    if (!timerEnabled || isPaused) return;
    const iv = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [timerEnabled, isPaused]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleCategorize = useCallback(async (category: Category) => {
    if (!currentTx || isReviewing) return;
    setIsReviewing(true);

    try {
      const updated = await apiReview(currentTx.id, category);

      // Show stamp animation
      setStampCategory(category);
      setStampVisible(true);

      setTimeout(() => {
        setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        setStampVisible(false);
        setStreak(s => s + 1);
        setLastAction(`${currentTx.description} → ${category}`);
        setFeedbackType(streak >= 2 ? 'streak' : 'success');

        setCurrentIndex(prev => {
          const remaining = unreviewed.length - 1;
          if (remaining <= 0) return 0;
          return prev >= remaining ? 0 : prev;
        });

        announce(`Categorized ${currentTx.description} as ${category}. ${streak + 1} in a row.`);
        setTimeout(() => setFeedbackType(null), 1200);
        refreshProgress();
      }, 450);
    } catch (err) {
      setLastAction(`Error: ${(err as Error).message}`);
      setStreak(0);
      setStampVisible(false);
    } finally {
      setIsReviewing(false);
    }
  }, [currentTx, isReviewing, streak, unreviewed.length, refreshProgress]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isPaused) return;
      const cat = CATEGORY_KEYS[e.key];
      if (cat) { e.preventDefault(); handleCategorize(cat); return; }
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault();
        setCurrentIndex(i => (i + 1) % Math.max(unreviewed.length, 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault();
        setCurrentIndex(i => (i - 1 + Math.max(unreviewed.length, 1)) % Math.max(unreviewed.length, 1));
      }
      if (e.key === 'Enter' && currentTx) { e.preventDefault(); handleCategorize(currentTx.suggestedCategory); }
      if (e.key === ' ' && e.target === document.body) { e.preventDefault(); setIsPaused(p => !p); }
      if (e.key === '?') { setShowKeyboardHelp(h => !h); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCategorize, isPaused, currentTx, unreviewed.length]);

  const allDone = unreviewed.length === 0 && transactions.length > 0;

  // Office clutter level
  const clutterLevel = percentComplete < 25 ? 'messy' : percentComplete < 50 ? 'cluttered' : percentComplete < 75 ? 'tidying' : percentComplete < 100 ? 'neat' : 'pristine';

  return (
    <main className="investigation" role="main" aria-label="Investigation Room">
      <div className="container">
        {/* Top Bar */}
        <header className="inv-topbar">
          <button className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back to evidence desk">← Back</button>
          <div className="inv-topbar-center">
            <h1 className="inv-logo">🔍 The Receipt Room</h1>
          </div>
          <div className="inv-topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKeyboardHelp(h => !h)} aria-label="Keyboard shortcuts" title="Shortcuts">
              ⌨️
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTimerEnabled(t => !t)} aria-label={timerEnabled ? 'Disable timer' : 'Enable timer'}>
              {timerEnabled ? `⏱️ ${formatTime(timerSeconds)}` : '⏱️'}
            </button>
            <button className={`btn btn-sm ${isPaused ? 'btn-terracotta' : 'btn-ghost'}`} onClick={() => setIsPaused(p => !p)} aria-label={isPaused ? 'Resume' : 'Pause'}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>
        </header>

        {/* Keyboard Help */}
        {showKeyboardHelp && (
          <div className="kbd-modal card animate-fade-in" role="dialog" aria-label="Keyboard shortcuts">
            <button className="kbd-close btn btn-ghost btn-sm" onClick={() => setShowKeyboardHelp(false)} aria-label="Close">✕</button>
            <h3>⌨️ Keyboard Shortcuts</h3>
            <div className="kbd-grid">
              <div><span className="kbd">1</span>–<span className="kbd">8</span></div><div>Assign category</div>
              <div><span className="kbd">Enter</span></div><div>Accept suggestion</div>
              <div><span className="kbd">←</span> <span className="kbd">→</span></div><div>Navigate evidence</div>
              <div><span className="kbd">Space</span></div><div>Pause / Resume</div>
              <div><span className="kbd">?</span></div><div>Toggle shortcuts</div>
            </div>
          </div>
        )}

        {/* Paused */}
        {isPaused && (
          <div className="inv-overlay animate-fade-in" role="alert">
            <div className="inv-overlay-card card">
              <h2>⏸ Investigation Paused</h2>
              <p>Press <span className="kbd">Space</span> or click Resume.</p>
              <button className="btn btn-primary" onClick={() => setIsPaused(false)}>▶ Resume</button>
            </div>
          </div>
        )}

        {/* Progress Strip */}
        <section className="inv-progress-strip" aria-label="Progress">
          <div className="inv-progress-stats">
            <span className="inv-pstat"><strong>{reviewed.length}</strong> reviewed</span>
            <span className="inv-pstat-sep">·</span>
            <span className="inv-pstat"><strong>{unreviewed.length}</strong> remaining</span>
            <span className="inv-pstat-sep">·</span>
            <span className="inv-pstat"><strong>{percentComplete}%</strong> complete</span>
            {streak >= 3 && <span className="inv-streak-badge animate-stamp">🔥 {streak}x streak!</span>}
          </div>
          <div className="progress-bar" role="progressbar" aria-valuenow={percentComplete} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${percentComplete}%` }}></div>
          </div>
        </section>

        {/* Detective Desk Scene */}
        <div className="inv-desk-scene" aria-hidden="true" data-clutter={clutterLevel}>
          <div className="desk-clutter">
            {percentComplete < 30 && <span className="clutter-item c1">📋</span>}
            {percentComplete < 50 && <span className="clutter-item c2">📑</span>}
            {percentComplete < 20 && <span className="clutter-item c3">🧾</span>}
            {percentComplete < 40 && <span className="clutter-item c4">📝</span>}
            {percentComplete >= 50 && <span className="clutter-item c5">📂</span>}
            {percentComplete >= 75 && <span className="clutter-item c6">✨</span>}
            {percentComplete >= 100 && <span className="clutter-item c7">🏆</span>}
          </div>
        </div>

        {/* Main Game — 3-Column Desktop */}
        {!isPaused && !allDone && currentTx && (
          <div className="inv-desktop">
            {/* LEFT — Casebook */}
            <aside className="inv-casebook" aria-label="Case details">
              <div className="casebook-inner">
                <div className="casebook-header">
                  <span className="casebook-label">CASE FILE</span>
                  <h3 className="casebook-title">Expense Investigation</h3>
                </div>
                <div className="casebook-stat">
                  <span className="casebook-stat-num">{reviewed.length}/{transactions.length}</span>
                  <span className="casebook-stat-label">Evidence Reviewed</span>
                </div>
                <hr className="divider" style={{ margin: '12px 0' }}/>
                <p className="casebook-note">
                  <em>"{currentTx.description}"</em> — Transaction dated {currentTx.date}. Amount: {formatAmount(currentTx.amount)}.
                  Suggested filing: <strong>{currentTx.suggestedCategory}</strong>.
                </p>
                <hr className="divider" style={{ margin: '12px 0' }}/>
                {/* Category counts */}
                <div className="casebook-categories">
                  <span className="casebook-label">FILED EVIDENCE</span>
                  {CATEGORIES.map(cat => {
                    const count = reviewed.filter(t => t.confirmedCategory === cat).length;
                    if (count === 0) return null;
                    return (
                      <div key={cat} className="casebook-cat-row">
                        <span>{CATEGORY_ICONS[cat]} {cat}</span>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                  {reviewed.length === 0 && <p className="casebook-empty">No evidence filed yet.</p>}
                </div>
              </div>
            </aside>

            {/* CENTER — Evidence Desk */}
            <section className="inv-evidence-area" aria-label="Current evidence">
              {/* Receipt stack indicator */}
              <div className="receipt-stack" aria-hidden="true">
                <div className="stack-paper s3"></div>
                <div className="stack-paper s2"></div>
                <div className="stack-paper s1"></div>
              </div>

              {/* Main receipt card */}
              <div className={`receipt-card ${stampVisible ? 'receipt-stamped' : ''}`} key={currentTx.id}>
                <div className="receipt-card-inner animate-slide-in">
                  {/* Receipt header */}
                  <div className="receipt-top">
                    <span className="receipt-badge">Evidence #{currentIndex + 1} of {unreviewed.length}</span>
                    <div className="receipt-nav-mini">
                      <button className="btn btn-ghost btn-sm" onClick={() => setCurrentIndex(i => (i - 1 + unreviewed.length) % unreviewed.length)} disabled={unreviewed.length <= 1} aria-label="Previous">‹</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setCurrentIndex(i => (i + 1) % unreviewed.length)} disabled={unreviewed.length <= 1} aria-label="Next">›</button>
                    </div>
                  </div>

                  {/* Receipt body */}
                  <div className="receipt-body">
                    <div className="receipt-dotted-line"></div>
                    <h2 className="receipt-merchant">{currentTx.description}</h2>
                    <div className="receipt-meta">
                      <span className="receipt-date">📅 {currentTx.date}</span>
                    </div>
                    <div className="receipt-amount-box">
                      <span className="receipt-amount-label">TOTAL</span>
                      <span className="receipt-amount-value" data-negative={currentTx.amount < 0}>
                        {formatAmount(currentTx.amount)}
                      </span>
                    </div>
                    <div className="receipt-dotted-line"></div>
                  </div>

                  {/* Suggestion */}
                  <div className="receipt-suggestion">
                    <span className="receipt-sugg-label">Suggested filing:</span>
                    <button
                      className="category-pill active"
                      data-category={currentTx.suggestedCategory}
                      onClick={() => handleCategorize(currentTx.suggestedCategory)}
                      disabled={isReviewing}
                      aria-label={`Accept: ${currentTx.suggestedCategory}`}
                    >
                      {CATEGORY_ICONS[currentTx.suggestedCategory]} {currentTx.suggestedCategory}
                    </button>
                    <span className="receipt-sugg-hint">Press <span className="kbd">Enter</span></span>
                  </div>

                  {/* Stamp overlay */}
                  {stampVisible && (
                    <div className="receipt-stamp-overlay animate-stamp" aria-hidden="true">
                      <div className="stamp stamp-reviewed" style={{ fontSize: '0.9rem', transform: 'rotate(-6deg)' }}>
                        ✓ REVIEWED
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--olive)', marginTop: '4px', fontWeight: 600 }}>
                        {stampCategory}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback */}
              {lastAction && feedbackType && (
                <div className={`inv-feedback ${feedbackType === 'streak' ? 'inv-feedback-streak' : ''} animate-fade-in`} role="status">
                  ✅ {lastAction}
                  {feedbackType === 'streak' && <span className="inv-combo"> 🔥 {streak}x combo!</span>}
                </div>
              )}
            </section>

            {/* RIGHT — Filing Cabinet */}
            <aside className="inv-filing" aria-label="Filing cabinet">
              <div className="filing-inner">
                <span className="filing-label">📂 FILE INTO CATEGORY</span>
                <div className="filing-folders" role="group" aria-label="Choose a category">
                  {CATEGORIES.map((cat, i) => (
                    <button
                      key={cat}
                      className="filing-folder"
                      data-category={cat}
                      onClick={() => handleCategorize(cat)}
                      disabled={isReviewing}
                      aria-label={`File as ${cat} (press ${i + 1})`}
                    >
                      <span className="folder-tab-visual">
                        <span className="kbd">{i + 1}</span>
                      </span>
                      <span className="folder-icon">{CATEGORY_ICONS[cat]}</span>
                      <span className="folder-name">{cat}</span>
                      <span className="folder-count">
                        {reviewed.filter(t => t.confirmedCategory === cat).length || ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* All Done */}
        {allDone && (
          <div className="inv-complete animate-fade-in">
            <div className="card inv-complete-card">
              <div className="stamp stamp-reviewed animate-stamp" style={{ fontSize: '1.1rem', marginBottom: '20px' }}>CASE COMPLETE</div>
              <h2>All Evidence Reviewed!</h2>
              <p>{transactions.length} transactions categorized and filed.</p>
              <button className="btn btn-primary btn-lg" onClick={onCaseClosed} id="close-case-btn">
                📋 Close the Case
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
