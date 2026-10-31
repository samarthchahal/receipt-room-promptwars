import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Transaction, Category, SessionProgress } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';
import {
  reviewTransaction as apiReview,
  getProgress as apiProgress,
  getTransactions as apiGetTransactions,
  getDuplicates,
  getRecurring,
  flagTransaction as apiFlag,
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
  const [totalReviewed, setTotalReviewed] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'streak' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Unreviewed transactions
  const unreviewed = useMemo(
    () => transactions.filter(t => !t.reviewed),
    [transactions]
  );

  const reviewed = useMemo(
    () => transactions.filter(t => t.reviewed),
    [transactions]
  );

  const currentTx = unreviewed[currentIndex] || null;
  const percentComplete = transactions.length > 0
    ? Math.round((reviewed.length / transactions.length) * 100)
    : 0;

  // Refresh progress from backend
  const refreshProgress = useCallback(async () => {
    try {
      const p = await apiProgress();
      setProgress(p);
      setTotalReviewed(p.reviewedCount);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  // Timer
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

  // Handle category selection
  const handleCategorize = useCallback(async (category: Category) => {
    if (!currentTx || isReviewing) return;
    setIsReviewing(true);

    try {
      const updated = await apiReview(currentTx.id, category);

      // Update local state
      setTransactions(prev =>
        prev.map(t => t.id === updated.id ? updated : t)
      );

      setStreak(s => s + 1);
      setLastAction(`${currentTx.description} → ${category}`);
      setFeedbackType(streak >= 2 ? 'streak' : 'success');

      // Move to next unreviewed
      // Since we're filtering unreviewed, after state update the list shrinks
      // Keep currentIndex the same (next unreviewed fills the slot) or wrap
      setCurrentIndex(prev => {
        const remaining = unreviewed.length - 1;
        if (remaining <= 0) return 0;
        return prev >= remaining ? 0 : prev;
      });

      announce(`Categorized ${currentTx.description} as ${category}. ${streak + 1} in a row.`);

      // Clear feedback after delay
      setTimeout(() => setFeedbackType(null), 800);

      // Refresh backend progress
      refreshProgress();
    } catch (err) {
      setLastAction(`Error: ${(err as Error).message}`);
      setStreak(0);
    } finally {
      setIsReviewing(false);
    }
  }, [currentTx, isReviewing, streak, unreviewed.length, refreshProgress]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isPaused) return;

      // Number keys for categories
      const cat = CATEGORY_KEYS[e.key];
      if (cat) {
        e.preventDefault();
        handleCategorize(cat);
        return;
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault();
        setCurrentIndex(i => (i + 1) % Math.max(unreviewed.length, 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault();
        setCurrentIndex(i => (i - 1 + Math.max(unreviewed.length, 1)) % Math.max(unreviewed.length, 1));
      }

      // Enter to accept suggestion
      if (e.key === 'Enter' && currentTx) {
        e.preventDefault();
        handleCategorize(currentTx.suggestedCategory);
      }

      // Space to pause
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        setIsPaused(p => !p);
      }

      // ? for keyboard help
      if (e.key === '?') {
        setShowKeyboardHelp(h => !h);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCategorize, isPaused, currentTx, unreviewed.length]);

  // All reviewed → show case closed option
  const allDone = unreviewed.length === 0 && transactions.length > 0;

  return (
    <main className="investigation" role="main" aria-label="Investigation Room">
      <div className="container">
        {/* Header Bar */}
        <header className="inv-header">
          <div className="inv-header-left">
            <button className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back to evidence desk">
              ← Back
            </button>
            <h1 className="inv-title">Investigation Room</h1>
          </div>
          <div className="inv-header-right">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowKeyboardHelp(h => !h)}
              aria-label="Toggle keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              ⌨️ <span className="hide-mobile">Shortcuts</span>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setTimerEnabled(t => !t)}
              aria-label={timerEnabled ? 'Disable timer' : 'Enable timer'}
            >
              ⏱️ {timerEnabled ? formatTime(timerSeconds) : 'Timer'}
            </button>
            <button
              className={`btn btn-sm ${isPaused ? 'btn-terracotta' : 'btn-ghost'}`}
              onClick={() => setIsPaused(p => !p)}
              aria-label={isPaused ? 'Resume investigation' : 'Pause investigation'}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
          </div>
        </header>

        {/* Keyboard Help Modal */}
        {showKeyboardHelp && (
          <div className="kbd-help card animate-fade-in" role="dialog" aria-label="Keyboard shortcuts">
            <button className="btn btn-ghost btn-sm kbd-close" onClick={() => setShowKeyboardHelp(false)} aria-label="Close">✕</button>
            <h3>Keyboard Shortcuts</h3>
            <div className="kbd-grid">
              <div><span className="kbd">1</span>–<span className="kbd">8</span></div><div>Assign category</div>
              <div><span className="kbd">Enter</span></div><div>Accept suggestion</div>
              <div><span className="kbd">←</span> <span className="kbd">→</span></div><div>Navigate cards</div>
              <div><span className="kbd">Space</span></div><div>Pause / Resume</div>
              <div><span className="kbd">?</span></div><div>Toggle this help</div>
            </div>
          </div>
        )}

        {/* Progress Section */}
        <section className="inv-progress" aria-label="Investigation progress">
          <div className="inv-progress-stats">
            <div className="inv-stat">
              <span className="inv-stat-value">{reviewed.length}</span>
              <span className="inv-stat-label">Reviewed</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-value">{unreviewed.length}</span>
              <span className="inv-stat-label">Remaining</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-value">{percentComplete}%</span>
              <span className="inv-stat-label">Complete</span>
            </div>
            {streak >= 2 && (
              <div className="inv-stat inv-streak animate-stamp">
                <span className="inv-stat-value">🔥 {streak}</span>
                <span className="inv-stat-label">Streak!</span>
              </div>
            )}
          </div>
          <div className="progress-bar" role="progressbar" aria-valuenow={percentComplete} aria-valuemin={0} aria-valuemax={100} aria-label={`${percentComplete}% reviewed`}>
            <div className="progress-bar-fill" style={{ width: `${percentComplete}%` }}></div>
          </div>
        </section>

        {/* Office Scene — visual clutter that decreases as progress increases */}
        <div className="office-scene" aria-hidden="true">
          <div className="office-desk">
            {percentComplete < 25 && <span className="office-item office-papers">📋📋📋</span>}
            {percentComplete < 50 && <span className="office-item office-folders">📁📁</span>}
            {percentComplete < 75 && <span className="office-item office-receipts">🧾🧾</span>}
            {percentComplete >= 75 && <span className="office-item office-tidy">✨📂</span>}
            {percentComplete >= 100 && <span className="office-item office-done">🏆</span>}
          </div>
        </div>

        {/* Paused Overlay */}
        {isPaused && (
          <div className="inv-paused animate-fade-in" role="alert">
            <div className="inv-paused-card card">
              <h2>Investigation Paused</h2>
              <p>Press <span className="kbd">Space</span> or click Resume to continue.</p>
              <button className="btn btn-primary" onClick={() => setIsPaused(false)}>
                ▶️ Resume Investigation
              </button>
            </div>
          </div>
        )}

        {/* Main Game Area */}
        {!isPaused && !allDone && currentTx && (
          <div className="inv-game animate-fade-in">
            {/* Evidence Card */}
            <div className="evidence-card card-evidence animate-slide-in" ref={cardRef} key={currentTx.id}>
              <div className="ev-header">
                <span className="ev-badge">Evidence #{currentIndex + 1} of {unreviewed.length}</span>
                {currentTx.reviewed && <span className="stamp stamp-reviewed animate-stamp">Reviewed</span>}
              </div>

              <div className="ev-body">
                <h2 className="ev-merchant">{currentTx.description}</h2>
                <div className="ev-details">
                  <span className="ev-date">📅 {currentTx.date}</span>
                  <span className="ev-amount" data-negative={currentTx.amount < 0}>
                    {formatAmount(currentTx.amount)}
                  </span>
                </div>

                <div className="ev-suggestion">
                  <span className="ev-suggestion-label">AI Suggestion:</span>
                  <button
                    className={`category-pill active`}
                    data-category={currentTx.suggestedCategory}
                    onClick={() => handleCategorize(currentTx.suggestedCategory)}
                    disabled={isReviewing}
                    aria-label={`Accept suggestion: ${currentTx.suggestedCategory}`}
                  >
                    {CATEGORY_ICONS[currentTx.suggestedCategory]} {currentTx.suggestedCategory}
                  </button>
                  <span className="ev-enter-hint">
                    Press <span className="kbd">Enter</span> to accept
                  </span>
                </div>
              </div>

              {/* Category Selection */}
              <div className="ev-categories" role="group" aria-label="Choose a category">
                <p className="ev-categories-label">Or assign a category:</p>
                <div className="ev-category-grid">
                  {CATEGORIES.map((cat, i) => (
                    <button
                      key={cat}
                      className={`category-pill ${currentTx.confirmedCategory === cat ? 'active' : ''}`}
                      data-category={cat}
                      onClick={() => handleCategorize(cat)}
                      disabled={isReviewing}
                      aria-label={`Categorize as ${cat} (press ${i + 1})`}
                    >
                      <span className="kbd">{i + 1}</span>
                      {CATEGORY_ICONS[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="ev-nav">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrentIndex(i => (i - 1 + unreviewed.length) % unreviewed.length)}
                  disabled={unreviewed.length <= 1}
                  aria-label="Previous transaction"
                >
                  ← Previous
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrentIndex(i => (i + 1) % unreviewed.length)}
                  disabled={unreviewed.length <= 1}
                  aria-label="Next transaction"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Last Action Feedback */}
            {lastAction && (
              <div className={`inv-feedback ${feedbackType === 'streak' ? 'inv-feedback-streak' : ''} animate-slide-in`} role="status">
                ✅ {lastAction}
                {feedbackType === 'streak' && <span className="inv-combo"> 🔥 {streak}x combo!</span>}
              </div>
            )}
          </div>
        )}

        {/* All Done */}
        {allDone && (
          <div className="inv-complete animate-fade-in">
            <div className="card inv-complete-card">
              <div className="stamp stamp-reviewed animate-stamp" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-lg)' }}>CASE COMPLETE</div>
              <h2>All Evidence Reviewed!</h2>
              <p>{transactions.length} transactions categorized and filed.</p>
              <button className="btn btn-primary btn-lg" onClick={onCaseClosed} id="close-case-btn">
                📋 Close the Case
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats Bar */}
        {reviewed.length > 0 && !allDone && (
          <aside className="inv-sidebar" aria-label="Category breakdown">
            <h3>Filed Evidence</h3>
            <div className="inv-sidebar-cats">
              {CATEGORIES.map(cat => {
                const count = reviewed.filter(t => t.confirmedCategory === cat).length;
                if (count === 0) return null;
                return (
                  <div key={cat} className="inv-sidebar-cat">
                    <span className="category-pill active btn-sm" data-category={cat}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </span>
                    <span className="inv-sidebar-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
