import React from 'react';
import './Landing.css';

interface Props {
  onBegin: () => void;
  onDemo: () => void;
}

export default function Landing({ onBegin, onDemo }: Props) {
  return (
    <main className="landing" role="main">
      <div className="landing-content container">
        {/* Hero Section */}
        <header className="landing-hero">
          <div className="landing-brand">
            <span className="landing-icon" aria-hidden="true">🔍</span>
            <h1 className="landing-title">The Receipt Room</h1>
            <p className="landing-tagline">Every expense tells a story.</p>
          </div>

          <p className="landing-headline">
            Your finances have a story.<br />
            <em>It's time to investigate.</em>
          </p>

          <p className="landing-description">
            Turn the tedious task of reviewing expenses into an engaging detective investigation.
            Upload your transaction history, and uncover the story behind every charge.
          </p>

          <div className="landing-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={onBegin}
              id="begin-investigation"
            >
              <span aria-hidden="true">📁</span>
              Begin Investigation
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={onDemo}
              id="try-demo"
            >
              <span aria-hidden="true">🗂️</span>
              Try Demo Case
            </button>
          </div>
        </header>

        {/* How It Works */}
        <section className="landing-steps" aria-label="How it works">
          <h2 className="steps-title">How the Investigation Works</h2>
          <div className="steps-grid">
            <article className="step-card card">
              <div className="step-number" aria-hidden="true">01</div>
              <h3>Open the Case File</h3>
              <p>Upload your expense CSV or start with our demo investigation. Your data stays private and temporary.</p>
            </article>
            <article className="step-card card">
              <div className="step-number" aria-hidden="true">02</div>
              <h3>Investigate the Evidence</h3>
              <p>Each transaction becomes an evidence card. Review, categorize, and flag suspicious charges through interactive gameplay.</p>
            </article>
            <article className="step-card card">
              <div className="step-number" aria-hidden="true">03</div>
              <h3>Close the Case</h3>
              <p>Download your reviewed expense ledger with categories, flags, and a complete case summary.</p>
            </article>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>
            <span className="stamp" aria-hidden="true">CONFIDENTIAL</span>
          </p>
          <p className="landing-disclaimer">
            Your financial data is processed locally and never stored permanently.
            Sessions expire after 2 hours.
          </p>
        </footer>
      </div>
    </main>
  );
}
