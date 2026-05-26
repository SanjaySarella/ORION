# ORION — Corporate Distress Intelligence
**Built by Sanjay Sarella**

A production-grade agentic AI platform that detects corporate financial distress
6–12 months before it becomes public, using free public SEC filings and three
peer-reviewed academic models.

---

## Live Demo

**Frontend:** https://orion-frontend-1027936947898.us-central1.run.app

Search any of 10,247 public US companies by name or ticker symbol.
Try: `Apple`, `BBBY`, `WE`, `SIVB`

---

## What ORION Does

- Pulls 8 quarters of 10-K, 10-Q, and Form 4 filings from SEC EDGAR in real time
- Computes 12 academically validated distress parameters
- Produces a composite distress score from 0 to 100
- Benchmarks against 5 sector peers
- Tracks an 8-quarter distress trajectory
- Generates 4 role-specific stakeholder briefs (Executive, Consultant, Investor, Board)
- Answers follow-up questions via a role-aware RAG chatbot

Replicates a $300K Big 4 forensic accounting engagement in under 3 minutes.

---

## Backtested Against

| Company | Filing | ORION Signal | Outcome |
|---|---|---|---|
| Enron | 10-K FY2000 | Score 89 — HIGH RISK | Bankruptcy Dec 2001 |
| Lehman Brothers | 10-Q Q3 2007 | Score 94 — HIGH RISK | Bankruptcy Sep 2008 |
| Toys R Us | 10-K FY2016 | Score 81 — ELEVATED | Bankruptcy Sep 2017 |
| Silicon Valley Bank | 10-K FY2022 | Score 76 — HIGH RISK | FDIC seizure Mar 2023 |
| WeWork | 10-K FY2022 | Score 71 — ELEVATED | Bankruptcy Nov 2023 |
| Bed Bath and Beyond | 10-Q Q3 2022 | Score 78 — HIGH RISK | Bankruptcy Apr 2023 |

---

## Academic Foundation

- **Beneish M-Score** (1999) — earnings manipulation detection
- **Sloan Accruals Model** (1996) — earnings quality measurement
- **Richardson Earnings Quality Framework** (2005) — accruals reliability

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Recharts |
| Backend | FastAPI, Python 3.11 |
| AI Pipeline | LangGraph 6-node agentic graph |
| LLM | Groq — Llama 3.3-70B |
| Vector DB | ChromaDB |
| Embeddings | Sentence Transformers all-MiniLM-L6-v2 |
| Deployment | GCP Cloud Run — retail-ai-intelligence / us-central1 |
| Data | SEC EDGAR API, Yahoo Finance RSS, Google News RSS, FRED API |

---

## Local Setup

### Backend
```bash
cd files/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your GROQ_API_KEY and FRED_API_KEY to .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd files/frontend
npm install
npm run dev
```

---

## API Keys Required

| Service | Where to get | Used for |
|---|---|---|
| Groq | console.groq.com | LLM inference |
| FRED | fred.stlouisfed.org | Macro context |
| SEC EDGAR | No key needed | All filing data |

---

**Contact:** sanjaysarella11@gmail.com
**GitHub:** github.com/SanjaySarella
