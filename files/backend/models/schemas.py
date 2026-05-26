"""
ORION — Pydantic Schemas
Sanjay Sarella — Corporate Distress Intelligence

All pipeline state is typed through these models.
Every agent receives and returns one of these schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class RiskFlag(str, Enum):
    CRITICAL = "critical"
    WATCH    = "watch"
    CLEAR    = "clear"

class StakeholderRole(str, Enum):
    EXECUTIVE  = "executive"
    CONSULTANT = "consultant"
    INVESTOR   = "investor"
    BOARD      = "board"

class DealRating(str, Enum):
    RED   = "red"
    AMBER = "amber"
    GREEN = "green"

class Position(str, Enum):
    EXIT    = "exit"
    HOLD    = "hold"
    CONSIDER = "consider"


# ── Core Company Identity ─────────────────────────────────────────────────────

class CompanyIdentity(BaseModel):
    name:       str
    ticker:     str
    cik:        str             # SEC Central Index Key
    sic:        Optional[str]   # Standard Industrial Classification
    sector:     Optional[str]
    exchange:   Optional[str]


# ── Raw Financial Metrics (from filings) ─────────────────────────────────────

class RawFinancials(BaseModel):
    """
    Extracted directly from 10-K and 10-Q filings.
    All values in USD millions unless noted.
    """
    fiscal_quarter:         str             # e.g. "Q4 2022"
    total_revenue:          Optional[float]
    accounts_receivable:    Optional[float]
    total_assets:           Optional[float]
    total_debt:             Optional[float]
    current_assets:         Optional[float]
    current_liabilities:    Optional[float]
    operating_cash_flow:    Optional[float]
    net_income:             Optional[float]
    gross_profit:           Optional[float]
    ebit:                   Optional[float]
    interest_expense:       Optional[float]
    days_sales_outstanding: Optional[float]
    free_cash_flow:         Optional[float]
    cash_and_equivalents:   Optional[float]


# ── 12 Distress Parameters ───────────────────────────────────────────────────

class ParameterResult(BaseModel):
    name:        str
    value:       float
    display:     str            # human-readable e.g. "0.8x" or "$145M"
    flag:        RiskFlag
    source:      str            # e.g. "10-K FY2022 Cash Flow Statement"
    explanation: str            # one-sentence plain English explanation

class DistressParameters(BaseModel):
    accruals_ratio:          ParameterResult
    revenue_vs_ar_growth:    ParameterResult
    days_sales_outstanding:  ParameterResult
    gross_margin_trend:      ParameterResult
    ocf_vs_net_income:       ParameterResult
    interest_coverage:       ParameterResult
    current_ratio:           ParameterResult
    debt_maturity_schedule:  ParameterResult
    going_concern_flag:      ParameterResult
    insider_selling:         ParameterResult
    guidance_accuracy:       ParameterResult
    news_sentiment:          ParameterResult


# ── Composite Score ───────────────────────────────────────────────────────────

class DistressScore(BaseModel):
    score:           float       # 0-100
    label:           str         # "HIGH DISTRESS" | "ELEVATED" | "MODERATE" | "LOW"
    critical_count:  int
    watch_count:     int
    clear_count:     int
    beneish_m_score: Optional[float]
    sloan_accruals:  Optional[float]


# ── Signal Intelligence (Node 3) ─────────────────────────────────────────────

class InsiderTransaction(BaseModel):
    date:            str
    insider_name:    str
    title:           str
    transaction_type: str       # "buy" | "sell"
    shares:          int
    value_usd:       float
    form4_url:       Optional[str]

class SignalIntelligence(BaseModel):
    insider_sell_ratio:     float           # 0-1, proportion that are sells
    total_insider_sold_usd: float
    total_insider_bought_usd: float
    transactions:           list[InsiderTransaction]
    going_concern_text:     Optional[str]   # verbatim auditor language
    going_concern_issued:   bool
    news_sentiment_score:   float           # -1 to +1
    news_article_count:     int
    macro_context:          Optional[str]


# ── Peer Benchmark (Node 4) ──────────────────────────────────────────────────

class PeerData(BaseModel):
    ticker:                  str
    name:                    str
    distress_score:          float
    interest_coverage:       Optional[float]
    current_ratio:           Optional[float]
    gross_margin:            Optional[float]

class PeerBenchmark(BaseModel):
    peers:                   list[PeerData]
    sector_avg_score:        float
    subject_vs_sector:       str     # "78 vs sector avg 42 — significantly worse"


# ── Trajectory (Node 5) ──────────────────────────────────────────────────────

class QuarterScore(BaseModel):
    quarter: str
    score:   float
    label:   str

class Trajectory(BaseModel):
    quarters:          list[QuarterScore]    # 8 quarters
    direction:         str     # "accelerating" | "stabilising" | "recovering"
    quarters_in_red:   int
    trend_summary:     str


# ── Stakeholder Briefs (Node 6) ──────────────────────────────────────────────

class ExecutiveBrief(BaseModel):
    cash_runway_months:   Optional[float]
    action_items:         list[str]           # ordered by urgency
    summary:              str
    confidence:           float               # 0-1

class ConsultantBrief(BaseModel):
    deal_rating:          DealRating
    pattern_match_pct:    float
    matched_company:      str
    recommendation:       str
    slide_summary:        str
    confidence:           float

class InvestorBrief(BaseModel):
    bankruptcy_probability: float
    equity_position:        Position
    credit_position:        Position
    options_signal:         str
    position_rationale:     str
    confidence:             float

class BoardBrief(BaseModel):
    escalation_level:     int                # 1-4
    active_triggers:      list[str]
    governance_brief:     str
    regulatory_exposure:  str
    confidence:           float

class StakeholderBriefs(BaseModel):
    executive:  ExecutiveBrief
    consultant: ConsultantBrief
    investor:   InvestorBrief
    board:      BoardBrief


# ── Full Pipeline State ───────────────────────────────────────────────────────

class PipelineState(BaseModel):
    """
    The single state object that flows through all 6 nodes.
    Each agent reads from it and writes back to it.
    """
    company:      CompanyIdentity
    financials:   list[RawFinancials]     = Field(default_factory=list)
    parameters:   Optional[DistressParameters] = None
    score:        Optional[DistressScore]      = None
    signals:      Optional[SignalIntelligence] = None
    peers:        Optional[PeerBenchmark]      = None
    trajectory:   Optional[Trajectory]         = None
    briefs:       Optional[StakeholderBriefs]  = None
    error:        Optional[str]                = None


# ── API Request / Response ────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    query: str      # company name or ticker e.g. "Apple" or "AAPL"

class AnalysisResponse(BaseModel):
    company:    CompanyIdentity
    score:      DistressScore
    parameters: DistressParameters
    signals:    SignalIntelligence
    peers:      PeerBenchmark
    trajectory: Trajectory
    briefs:     StakeholderBriefs

class ChatRequest(BaseModel):
    company_ticker: str
    role:           StakeholderRole
    message:        str
    history:        list[dict] = Field(default_factory=list)

class ChatResponse(BaseModel):
    answer:   str
    sources:  list[str] = Field(default_factory=list)
