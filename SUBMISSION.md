# Submission — The Receipt Room

## Product

**Name:** The Receipt Room

**Tagline:** Every expense tells a story.

**Category:** Narrative-driven productivity game & interactive expense-review tool

## Problem

We all procrastinate on painful digital chores. Reviewing expenses is one of the worst — rows of transactions in spreadsheets, manually categorizing each one, spotting duplicates, tracking subscriptions.

**The Receipt Room** transforms this tedious chore into a detective investigation. Upload your expenses, investigate evidence cards, categorize spending through fast-paced gameplay, and download a genuinely reviewed ledger.

## Target Users

- Freelancers tracking business expenses
- Anyone preparing for tax season
- Small business owners reviewing monthly charges
- People who've been avoiding that expense spreadsheet

## Innovation

**The living detective office.** Unlike ordinary financial dashboards, The Receipt Room wraps real administrative work inside narrative gameplay. The detective's office starts cluttered with papers and folders — as you review more transactions, the office progressively tidies up. Every visual change is driven by actual backend-confirmed progress.

**Real work, not simulation.** Every category assignment, duplicate flag, and review action corresponds to a real server-side operation. The exported CSV contains only genuine user decisions, never fabricated data.

## User Journey

1. **Enter the Detective Office** — Premium editorial landing page
2. **Open the Case File** — Upload expense CSV or try demo investigation
3. **Investigate Evidence** — Interactive cards with merchant, date, amount
4. **Categorize & File** — Keyboard shortcuts (1-8) or click to categorize
5. **Track Progress** — Live progress bar, streak combos, office transformation
6. **Close the Case** — Real statistics, category breakdown, download reviewed CSV

## Real-World Chore Execution

The application genuinely completes expense review work:

- Parses real CSV transaction data
- Stores review decisions server-side
- Computes progress from actual saved records
- Exports reviewed CSV with original data preserved
- A judge can diff the input and output to verify completed work

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Processing:** csv-parse, csv-stringify
- **Security:** Helmet, rate limiting, input validation
- **Testing:** Vitest (31 tests, 100% pass)
- **Deployment:** Docker, Google Cloud Run

## Google Services

- **Google Cloud Run** — Production container deployment
- Dockerfile with multi-stage build
- Same-origin frontend + API serving

## Technical Differentiation

- **Zero-config deployment:** No database, no Redis, no external services
- **Deterministic categorization:** Keyword engine works offline, instantly
- **CSV safety:** Formula injection prevention in all exports
- **Crypto sessions:** 32-byte random session IDs, 2-hour TTL
- **Accessible:** Full keyboard navigation, screen reader support, reduced-motion

## Business Model

1. **Freemium SaaS** — Free for personal use, premium for businesses (bank integrations, team reviews, audit trails)
2. **Enterprise** — White-label expense review gamification for accounting software
3. **API** — Categorization and duplicate detection as a service

## 60-Second Pitch

> Raise your hand if you've ever procrastinated on reviewing expenses. Yeah, us too.
>
> The Receipt Room turns that dreaded spreadsheet into a detective investigation. Upload your expenses, and each transaction becomes an evidence card on a detective's desk. Categorize with keyboard shortcuts, spot duplicates, track recurring charges — all through fast-paced gameplay.
>
> But here's what matters: this isn't a simulation. Every action you take is a real backend operation. When you download the reviewed CSV, it contains your actual decisions. A judge can verify the work.
>
> Built with React, Express, TypeScript. Deployed on Google Cloud Run. 31 tests passing. Zero external dependencies.
>
> Every expense tells a story. The Receipt Room helps you finally read it.

## Live Demo Steps

1. Open the deployed URL
2. Click "Open Demo Investigation" (50 fictional transactions)
3. Use number keys 1-8 to categorize transactions
4. Watch the progress bar and streak counter
5. Review all 50 → "Close the Case"
6. Download the reviewed CSV
7. Open the CSV — verify `Review_Status` and `Reviewed_Category` columns

## Current Limitations

- In-memory sessions (lost on container restart)
- No persistent database
- No bank account integration (by design — security)
- Keyword-based categorization (deterministic, not AI-powered)
- Single-instance Cloud Run (no session sharing across instances)

## Repository

- Public GitHub repository with complete source code
- No secrets or credentials committed
- MIT-style license for hackathon purposes
