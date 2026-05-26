# ORION — Corporate Distress Intelligence
**Built by Sanjay Sarella**

Agentic AI platform that detects corporate financial distress 6–12 months
before it becomes public, using free public SEC filings and three
peer-reviewed academic models.

---

## Quick Start (VSCode)

### 1. Clone and open
```bash
git clone https://github.com/SanjaySarella/orion.git
cd orion
code .
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in your API keys
uvicorn main:app --reload --port 8000
```
API docs available at: http://localhost:8000/docs

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
App available at: http://localhost:5173

---

## API Keys Required (all free tier)
| Service   | Where to get                     | Used for                  |
|-----------|----------------------------------|---------------------------|
| Groq      | console.groq.com                 | LLM inference             |
| NewsAPI   | newsapi.org/register             | News sentiment            |
| FRED      | fred.stlouisfed.org/docs/api     | Macro context             |
| SEC EDGAR | No key needed                    | All filing data           |

---

## Project Structure
```
orion/
├── backend/
│   ├── agents/          # 6 LangGraph nodes
│   ├── pipeline/        # Graph wiring
│   ├── models/          # Pydantic schemas
│   ├── data/            # SEC EDGAR + NewsAPI + FRED
│   ├── chatbot/         # RAG chatbot
│   └── main.py          # FastAPI entry point
└── frontend/
    └── src/
        ├── components/  # Dashboard, Landing, About
        ├── pages/
        └── hooks/
```

---

## GCP Deployment
```bash
cd backend
gcloud run deploy orion-backend \
  --source . \
  --project retail-ai-intelligence \
  --region us-central1 \
  --allow-unauthenticated
```

---

**Contact:** sanjaysarella11@gmail.com
**GitHub:** github.com/SanjaySarella
