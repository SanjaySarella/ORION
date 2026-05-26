"""
ORION — FastAPI Entry Point
Sanjay Sarella — Corporate Distress Intelligence

Run locally:  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import logging
import os

from models.schemas import AnalysisRequest, AnalysisResponse, ChatRequest, ChatResponse

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ORION — Corporate Distress Intelligence",
    description="Sanjay Sarella's agentic AI platform for early detection of corporate financial distress",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ORION", "version": "1.0.0"}


# ── Company Search ────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search_companies(q: str):
    """
    Search SEC EDGAR for companies matching a name or ticker.
    Returns a list of matches for the frontend typeahead.
    """
    from data.sec_edgar import search_company
    try:
        results = await search_company(q)
        return {"results": results}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Full Analysis Pipeline ────────────────────────────────────────────────────

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_company(request: AnalysisRequest):
    """
    Run the full 6-node LangGraph pipeline for a given company.
    Accepts a company name or ticker symbol.
    Returns the complete analysis including all 12 parameters,
    distress score, peer benchmarks, trajectory, and 4 stakeholder briefs.
    """
    from pipeline.graph import run_pipeline
    try:
        logger.info(f"Starting analysis for: {request.query}")
        result = await run_pipeline(request.query)
        logger.info(f"Analysis complete for: {request.query} — score: {result.score.score}")
        return result
    except Exception as e:
        logger.error(f"Pipeline error for {request.query}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── RAG Chatbot ───────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Role-aware RAG chatbot.
    Knows the active company ticker and stakeholder role.
    Grounds answers in ChromaDB-indexed filing content.
    """
    from chatbot.rag import answer_question
    try:
        response = await answer_question(
            ticker=request.company_ticker,
            role=request.role,
            message=request.message,
            history=request.history,
        )
        return response
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
