# 🔍 THE RECEIPT ROOM

**Every expense tells a story.**

A narrative detective game that transforms the tedious task of reviewing expenses into an engaging investigation. Built for PromptWars × OUTLIER 2026.

## 🎮 What It Does

Upload your expense CSV → Become a detective → Investigate transaction evidence cards → Categorize spending through interactive gameplay → Download a genuinely reviewed expense ledger.

**This is not a simulation.** Every category assignment, duplicate flag, and review action corresponds to a real backend operation. The exported CSV proves it.

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| CSV Processing | csv-parse, csv-stringify |
| Security | Helmet, rate limiting, CSRF-safe sessions |
| Deployment | Docker, Google Cloud Run |
| Testing | Vitest (31 tests) |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development mode (frontend + backend)
npm run dev

# Run tests
npm test

# Production build
npm run build

# Start production server
npm start
```

The application runs at `http://localhost:8080` in production mode, or `http://localhost:5173` (frontend) with API proxy to `http://localhost:8080` in dev mode.

## 📋 Features

### Core Game — The Missing Labels
- Interactive evidence cards for each transaction
- 8 expense categories with keyboard shortcuts (1-8)
- Accept/override AI-suggested categories
- Streak combos and progress tracking
- Pause/resume and optional timer
- Untimed accessible mode
- Living office scene that tidies as progress increases

### Detective Analysis
- Duplicate transaction detection (same merchant + amount + nearby dates)
- Recurring charge identification (3+ similar charges at regular intervals)
- Flag/dismiss controls for all findings

### Real Backend Operations
- CSV parsing with auto-column detection
- Server-side session storage with crypto-secure IDs
- Idempotent review operations
- Accurate progress computed from actual saved records
- CSV formula injection protection in exports

## 🔒 Security

- No bank credentials required
- Files processed in-memory only
- Sessions expire after 2 hours
- Cryptographically random session IDs
- Upload size limits (5 MB, 5000 transactions)
- Rate limiting on all API endpoints
- No stack traces exposed to clients
- CSV formula injection prevention

## 🐳 Deployment

### Google Cloud Run

```bash
gcloud run deploy receipt-room \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --max-instances 1
```

### Docker

```bash
docker build -t receipt-room .
docker run -p 8080:8080 receipt-room
```

## 📁 Project Structure

```
├── server/              # Express backend
│   ├── engine/          # Business logic
│   │   ├── categorizer.ts   # Keyword-based category suggestions
│   │   ├── csvParser.ts     # CSV import with auto-detection
│   │   ├── detective.ts     # Duplicate & recurring detection
│   │   ├── exporter.ts      # Reviewed CSV & summary generation
│   │   └── sessionStore.ts  # In-memory session management
│   ├── routes/api.ts    # REST API endpoints
│   ├── data/sampleData.ts   # Demo dataset
│   └── index.ts         # Express server entry
├── src/                 # React frontend
│   ├── screens/         # Page components
│   │   ├── Landing      # Hero & introduction
│   │   ├── EvidenceDesk # CSV upload & demo
│   │   ├── InvestigationRoom  # Main game
│   │   └── CaseClosed   # Results & export
│   ├── api/client.ts    # API client
│   └── App.tsx          # Router
├── shared/types.ts      # Shared TypeScript types
├── tests/               # Vitest test suite
└── Dockerfile           # Cloud Run deployment
```

## 📄 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/upload | Upload CSV file |
| POST | /api/demo | Start demo investigation |
| GET | /api/transactions | List all transactions |
| POST | /api/review | Review single transaction |
| POST | /api/review/batch | Batch review |
| POST | /api/flag | Flag duplicate/recurring |
| GET | /api/progress | Get session progress |
| GET | /api/duplicates | Get duplicate candidates |
| GET | /api/recurring | Get recurring candidates |
| GET | /api/export/csv | Download reviewed CSV |
| GET | /api/export/summary | Download case summary |
| GET | /api/summary | Get summary JSON |
| GET | /api/categories | List valid categories |

## 📝 License

Built for PromptWars × OUTLIER 2026 Hackathon.
