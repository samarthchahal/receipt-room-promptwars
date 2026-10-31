# Architecture — The Receipt Room

## System Overview

Single-container full-stack TypeScript application serving both the React SPA frontend and Express REST API backend from the same origin.

```
┌──────────────────────────────────────────┐
│          Google Cloud Run                │
│  ┌────────────────────────────────────┐  │
│  │     Express Server (Node.js)      │  │
│  │                                    │  │
│  │  ┌──────────┐  ┌───────────────┐  │  │
│  │  │ Static   │  │  API Routes   │  │  │
│  │  │ /dist    │  │  /api/*       │  │  │
│  │  └──────────┘  └───────┬───────┘  │  │
│  │                        │          │  │
│  │              ┌─────────┴────────┐ │  │
│  │              │  Engine Layer    │ │  │
│  │              │  ├─ csvParser    │ │  │
│  │              │  ├─ categorizer  │ │  │
│  │              │  ├─ sessionStore │ │  │
│  │              │  ├─ detective    │ │  │
│  │              │  └─ exporter     │ │  │
│  │              └──────────────────┘ │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Design Decisions

### In-Memory Sessions
- No database dependency → zero-config deployment
- Cryptographically random session IDs (32 bytes hex)
- 2-hour TTL with automatic cleanup
- Bounded to 100 concurrent sessions
- Trade-off: sessions lost on container restart (acceptable for hackathon scope)

### Deterministic Categorization
- Keyword-matching engine with no AI dependency
- Works offline, consistently, instantly
- Optional Gemini integration as enhancement, not requirement

### CSV Safety
- Formula injection prevention (prefixed with single quote)
- Upload size limits (5MB, 5000 rows)
- Auto-detection of common column name patterns
- Preserves all original fields in export

### Single-Container Architecture
- Frontend built by Vite → served as static files
- API on same origin → no CORS issues in production
- Single PORT binding for Cloud Run compatibility
- Multi-stage Docker build for minimal image size

## Data Flow

```
User CSV → Upload API → csv-parse → Session Store
                                         │
                                    Transaction[]
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                   categorizer      detective         exporter
                   (suggestions)  (dupes/recurring)  (CSV/summary)
                        │                │                │
                        └────────────────┼────────────────┘
                                         │
                                   React Frontend
                                   (evidence cards)
                                         │
                                   Review API calls
                                         │
                                   Session updates
                                         │
                                   Export API
                                         │
                                   Reviewed CSV ✓
```
