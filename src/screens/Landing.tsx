import React from 'react';
import './Landing.css';

export default function Landing({ onBegin, onDemo }: { onBegin: () => void; onDemo: () => void }) {
  return (
    <main className="landing" role="main">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-desk" aria-hidden="true">
          {/* Detective desk scene built with CSS */}
          <div className="desk-items">
            <div className="desk-magnifier">🔍</div>
            <div className="desk-notebook">
              <div className="notebook-lines"></div>
              <span className="notebook-text">Case Notes</span>
            </div>
            <div className="desk-envelope">
              <div className="envelope-flap"></div>
              <span className="envelope-label">CONFIDENTIAL</span>
            </div>
            <div className="desk-receipt desk-receipt-1">
              <div className="receipt-line"></div>
              <div className="receipt-line short"></div>
              <div className="receipt-amount">$42.50</div>
            </div>
            <div className="desk-receipt desk-receipt-2">
              <div className="receipt-line"></div>
              <div className="receipt-line short"></div>
              <div className="receipt-amount">$127.00</div>
            </div>
            <div className="desk-folder">
              <div className="folder-tab">EXPENSES</div>
            </div>
            <div className="desk-stamp-pad"></div>
            <div className="desk-coffee">☕</div>
          </div>
        </div>

        <div className="hero-content container">
          <div className="hero-badge">
            <span className="stamp">CLASSIFIED INVESTIGATION</span>
          </div>
          <h1 className="hero-title">
            The Receipt Room
          </h1>
          <p className="hero-tagline">Every expense tells a story. Follow the clues.</p>
          <p className="hero-headline">
            Your finances have a story.<br/>
            <em>It's time to investigate.</em>
          </p>
          <p className="hero-desc">
            Turn the tedious chore of reviewing expenses into an engaging detective investigation.
            Upload your transactions, investigate each charge, and close the case.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onBegin} id="begin-investigation">
              📁 Begin Investigation
            </button>
            <button className="btn btn-secondary btn-lg" onClick={onDemo} id="try-demo">
              🗂️ Try Demo Case
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="steps container" aria-label="How it works">
        <h2 className="steps-heading">How the Investigation Works</h2>
        <div className="steps-grid">
          <article className="step-card">
            <div className="step-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="4" width="28" height="32" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M12 12h16M12 18h16M12 24h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="18" y="2" width="10" height="6" rx="1" fill="var(--manila)" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="step-num">01</div>
            <h3>Open the Case File</h3>
            <p>Upload your expense CSV or start with our demo investigation. Your data stays private.</p>
          </article>
          <article className="step-card">
            <div className="step-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="22" cy="18" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="29" y1="25" x2="36" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M18 15h8M18 18h6M18 21h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </div>
            <div className="step-num">02</div>
            <h3>Investigate the Evidence</h3>
            <p>Each transaction becomes an evidence card. Review, categorize, and flag suspicious charges.</p>
          </article>
          <article className="step-card">
            <div className="step-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="8" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M4 14h32" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M14 20l4 4 8-8" stroke="var(--olive)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="step-num">03</div>
            <h3>Close the Case</h3>
            <p>Download your reviewed expense ledger with categories, flags, and a complete case summary.</p>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer container">
        <div className="footer-badge" aria-hidden="true">
          <span className="stamp stamp-reviewed">THE RECEIPT ROOM</span>
        </div>
        <p className="footer-note">
          Your financial data is processed in memory and never stored permanently. Sessions expire after 2 hours.
        </p>
      </footer>
    </main>
  );
}
