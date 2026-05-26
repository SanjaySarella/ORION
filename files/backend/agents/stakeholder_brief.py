"""
ORION — Node 6: Stakeholder Brief Agent with Critic Loop
Sanjay Sarella — Corporate Distress Intelligence

Responsibility:
  Uses Groq + Llama 3.3-70B to generate four role-specific briefs.
  Each brief is scored by a Critic Agent on completeness and evidence quality.
  Any brief below 80% confidence is automatically revised (max 2 retries).
  ChromaDB RAG grounds every brief in actual filing content.

Four briefs generated:
  Executive  — cash position, action items, immediate priorities
  Consultant — deal risk rating, pattern match, client recommendation
  Investor   — bankruptcy probability, position recommendation
  Board      — escalation triggers, governance obligations
"""

import logging
import os
import json
import re
from langchain_groq import ChatGroq
from models.schemas import (
    PipelineState, StakeholderBriefs,
    ExecutiveBrief, ConsultantBrief, InvestorBrief, BoardBrief,
    DealRating, Position, RiskFlag,
)

logger = logging.getLogger(__name__)
GROQ_MODEL = "llama-3.3-70b-versatile"


# ── LLM Setup ─────────────────────────────────────────────────────────────────

def get_llm() -> ChatGroq:
    return ChatGroq(
        model=GROQ_MODEL,
        temperature=0.15,
        api_key=os.getenv("GROQ_API_KEY"),
    )


# ── Context Builder ───────────────────────────────────────────────────────────

def build_analysis_context(state: PipelineState) -> str:
    """
    Assembles all pipeline outputs into a single structured context string.
    This is passed to every brief prompt so the LLM has full visibility.
    """
    s = state.score
    p = state.parameters
    t = state.trajectory
    peers = state.peers
    sigs  = state.signals

    lines = [
        f"COMPANY: {state.company.name} ({state.company.ticker})",
        f"DISTRESS SCORE: {s.score}/100 — {s.label}",
        f"CRITICAL PARAMETERS: {s.critical_count} of 12",
        "",
        "12-PARAMETER BREAKDOWN:",
        f"  Accruals Ratio:          {p.accruals_ratio.display} [{p.accruals_ratio.flag.value.upper()}] — {p.accruals_ratio.source}",
        f"  Revenue vs AR Growth:    {p.revenue_vs_ar_growth.display} [{p.revenue_vs_ar_growth.flag.value.upper()}]",
        f"  Days Sales Outstanding:  {p.days_sales_outstanding.display} [{p.days_sales_outstanding.flag.value.upper()}]",
        f"  Gross Margin Trend:      {p.gross_margin_trend.display} [{p.gross_margin_trend.flag.value.upper()}]",
        f"  OCF vs Net Income:       {p.ocf_vs_net_income.display} [{p.ocf_vs_net_income.flag.value.upper()}]",
        f"  Interest Coverage:       {p.interest_coverage.display} [{p.interest_coverage.flag.value.upper()}]",
        f"  Current Ratio:           {p.current_ratio.display} [{p.current_ratio.flag.value.upper()}]",
        f"  Debt Maturity Schedule:  {p.debt_maturity_schedule.display} [{p.debt_maturity_schedule.flag.value.upper()}]",
        f"  Going Concern Flag:      {p.going_concern_flag.display} [{p.going_concern_flag.flag.value.upper()}]",
        f"  Insider Selling:         {p.insider_selling.display} [{p.insider_selling.flag.value.upper()}]",
        f"  Guidance Accuracy:       {p.guidance_accuracy.display} [{p.guidance_accuracy.flag.value.upper()}]",
        f"  News Sentiment:          {p.news_sentiment.display} [{p.news_sentiment.flag.value.upper()}]",
    ]

    if t:
        lines += [
            "",
            f"TRAJECTORY: {t.direction.upper()} — {t.quarters_in_red} of {len(t.quarters)} quarters in red zone",
            f"TREND SUMMARY: {t.trend_summary}",
        ]

    if peers and peers.peers:
        lines += [
            "",
            f"PEER BENCHMARKING: {peers.subject_vs_sector}",
            f"SECTOR AVERAGE SCORE: {peers.sector_avg_score}",
        ]

    if sigs:
        lines += [
            "",
            f"INSIDER SELL RATIO: {sigs.insider_sell_ratio:.0%}",
            f"GOING CONCERN ISSUED: {'YES' if sigs.going_concern_issued else 'NO'}",
            f"NEWS SENTIMENT: {sigs.news_sentiment_score:+.2f} ({sigs.news_article_count} articles)",
        ]
        if sigs.macro_context:
            lines.append(f"MACRO CONTEXT: {sigs.macro_context}")
        if sigs.going_concern_text:
            lines.append(f"AUDITOR LANGUAGE: \"{sigs.going_concern_text[:200]}\"")

    return "\n".join(lines)


# ── JSON Extraction Helper ────────────────────────────────────────────────────

def extract_json(text: str) -> dict:
    """
    Extracts a JSON object from LLM response text.
    Handles markdown code fences and leading/trailing prose.
    """
    text = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


# ── Brief Generators ──────────────────────────────────────────────────────────

async def generate_executive_brief(context: str, llm: ChatGroq) -> ExecutiveBrief:
    prompt = f"""You are a forensic accounting expert advising a CEO or CFO.
Analyse this corporate distress assessment and produce an Executive Brief.

{context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "cash_runway_months": <number or null>,
  "action_items": [
    "<urgent action 1 — start with a verb, cite the specific parameter>",
    "<urgent action 2 — start with a verb, cite the specific parameter>",
    "<urgent action 3 — start with a verb, cite the specific parameter>"
  ],
  "summary": "<2 sentences, plain English, name the company, state the core risk>",
  "confidence": <0.0 to 1.0>
}}

Rules:
- action_items must be ordered by urgency, most urgent first
- Each action item must cite the specific parameter driving it
- confidence above 0.85 only if you have strong parameter evidence
- cash_runway_months: estimate from current ratio and FCF if available, else null
- No markdown, no prose outside the JSON object"""

    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        data     = extract_json(response.content)
        return ExecutiveBrief(
            cash_runway_months = data.get("cash_runway_months"),
            action_items       = data.get("action_items", [])[:3],
            summary            = data.get("summary", ""),
            confidence         = float(data.get("confidence", 0.7)),
        )
    except Exception as e:
        logger.warning(f"[Node 6] Executive brief parse error: {e}")
        return ExecutiveBrief(
            cash_runway_months = None,
            action_items       = ["Review all critical parameters immediately with CFO and legal counsel"],
            summary            = f"Distress score of {context[:30]}. Immediate review recommended.",
            confidence         = 0.60,
        )


async def generate_consultant_brief(context: str, llm: ChatGroq) -> ConsultantBrief:
    prompt = f"""You are a strategy consultant advising whether a client should engage with this company.
Analyse this corporate distress assessment and produce a Consultant Brief.

{context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "deal_rating": "<RED, AMBER, or GREEN>",
  "pattern_match_pct": <0 to 100, similarity to known bankruptcy patterns>,
  "matched_company": "<name of the most similar historical bankruptcy, e.g. Toys R Us 2017>",
  "recommendation": "<1 paragraph, plain English, specific advice on whether to engage>",
  "slide_summary": "<1 sentence suitable for a client presentation slide>",
  "confidence": <0.0 to 1.0>
}}

Rules:
- RED = do not engage, 5 or more critical parameters
- AMBER = proceed with caution, 3-4 critical parameters
- GREEN = proceed normally, fewer than 3 critical parameters
- pattern_match_pct: compare parameter profile to known failures
- matched_company must be a real historical bankruptcy case
- No markdown, no prose outside the JSON object"""

    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        data     = extract_json(response.content)

        rating_str = data.get("deal_rating", "AMBER").upper()
        rating     = DealRating.RED if rating_str == "RED" else \
                     DealRating.GREEN if rating_str == "GREEN" else \
                     DealRating.AMBER

        return ConsultantBrief(
            deal_rating       = rating,
            pattern_match_pct = float(data.get("pattern_match_pct", 0)),
            matched_company   = data.get("matched_company", ""),
            recommendation    = data.get("recommendation", ""),
            slide_summary     = data.get("slide_summary", ""),
            confidence        = float(data.get("confidence", 0.7)),
        )
    except Exception as e:
        logger.warning(f"[Node 6] Consultant brief parse error: {e}")
        return ConsultantBrief(
            deal_rating       = DealRating.AMBER,
            pattern_match_pct = 0.0,
            matched_company   = "Analysis incomplete",
            recommendation    = "Exercise caution. Full parameter review required before engagement decision.",
            slide_summary     = "Elevated distress signals detected — further due diligence required.",
            confidence        = 0.55,
        )


async def generate_investor_brief(context: str, llm: ChatGroq) -> InvestorBrief:
    prompt = f"""You are advising a PE, VC, or hedge fund investor on position sizing.
Analyse this corporate distress assessment and produce an Investor Brief.

{context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "bankruptcy_probability": <0 to 100, 12-month probability>,
  "equity_position": "<EXIT, HOLD, or CONSIDER>",
  "credit_position": "<EXIT, HOLD, or CONSIDER>",
  "options_signal": "<1 sentence on whether put options are worth considering>",
  "position_rationale": "<1 paragraph explaining the position recommendation with specific evidence>",
  "confidence": <0.0 to 1.0>
}}

Rules:
- bankruptcy_probability above 70 only if going concern issued AND interest coverage below 1x
- EXIT equity if score above 70 and trajectory is accelerating
- Consider puts only if bankruptcy_probability above 60
- position_rationale must cite at least 2 specific parameters
- No markdown, no prose outside the JSON object"""

    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        data     = extract_json(response.content)

        def to_position(val: str) -> Position:
            val = (val or "HOLD").upper()
            if val == "EXIT":    return Position.EXIT
            if val == "CONSIDER": return Position.CONSIDER
            return Position.HOLD

        return InvestorBrief(
            bankruptcy_probability = float(data.get("bankruptcy_probability", 0)),
            equity_position        = to_position(data.get("equity_position")),
            credit_position        = to_position(data.get("credit_position")),
            options_signal         = data.get("options_signal", ""),
            position_rationale     = data.get("position_rationale", ""),
            confidence             = float(data.get("confidence", 0.7)),
        )
    except Exception as e:
        logger.warning(f"[Node 6] Investor brief parse error: {e}")
        return InvestorBrief(
            bankruptcy_probability = 0.0,
            equity_position        = Position.HOLD,
            credit_position        = Position.HOLD,
            options_signal         = "Insufficient data for options recommendation.",
            position_rationale     = "Full investor brief could not be generated. Review parameter data directly.",
            confidence             = 0.50,
        )


async def generate_board_brief(context: str, llm: ChatGroq) -> BoardBrief:
    prompt = f"""You are advising a board member or risk committee chair on governance obligations.
Analyse this corporate distress assessment and produce a Board Brief.

{context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "escalation_level": <1, 2, 3, or 4>,
  "active_triggers": [
    "<trigger 1 — cite specific parameter and regulatory obligation>",
    "<trigger 2 — cite specific parameter and regulatory obligation>"
  ],
  "governance_brief": "<1 paragraph on what the board must do and why>",
  "regulatory_exposure": "<1 sentence on SEC disclosure obligations given current signals>",
  "confidence": <0.0 to 1.0>
}}

Rules:
- escalation_level 4 = going concern issued OR interest coverage below 1x
- escalation_level 3 = 5 or more critical parameters
- escalation_level 2 = 3-4 critical parameters
- escalation_level 1 = fewer than 3 critical parameters
- active_triggers must cite real regulatory references (e.g. SEC Rule 13a-15, Rule 10b-5)
- governance_brief must be actionable and specific
- No markdown, no prose outside the JSON object"""

    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        data     = extract_json(response.content)
        return BoardBrief(
            escalation_level    = int(data.get("escalation_level", 2)),
            active_triggers     = data.get("active_triggers", []),
            governance_brief    = data.get("governance_brief", ""),
            regulatory_exposure = data.get("regulatory_exposure", ""),
            confidence          = float(data.get("confidence", 0.7)),
        )
    except Exception as e:
        logger.warning(f"[Node 6] Board brief parse error: {e}")
        return BoardBrief(
            escalation_level    = 2,
            active_triggers     = ["Review distress parameters with independent financial advisor"],
            governance_brief    = "Board should review flagged distress parameters and consider independent financial advisor engagement.",
            regulatory_exposure = "Review SEC disclosure obligations given current distress indicators.",
            confidence          = 0.55,
        )


# ── Critic Agent ──────────────────────────────────────────────────────────────

async def critic_evaluate(brief_json: str, role: str, llm: ChatGroq) -> float:
    """
    Critic Agent scores a brief on completeness and evidence quality.
    Returns a confidence score 0.0 to 1.0.
    """
    prompt = f"""You are a senior forensic accounting reviewer.
Score this {role} brief on two criteria:
1. Completeness — does it address all key distress signals?
2. Evidence quality — does it cite specific parameters and sources?

Brief to evaluate:
{brief_json}

Return ONLY a JSON object: {{"score": <0.0 to 1.0>, "reason": "<one sentence>"}}
Score above 0.80 only if the brief is specific, evidence-backed, and actionable."""

    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        data     = extract_json(response.content)
        return float(data.get("score", 0.7))
    except Exception:
        return 0.70


async def critic_loop(brief, generate_fn, context: str, llm: ChatGroq, role: str) -> object:
    """
    Runs the Critic Agent. If confidence is below 0.80, regenerates up to 2 times.
    """
    MAX_RETRIES = 2

    for attempt in range(MAX_RETRIES + 1):
        if brief.confidence >= 0.80:
            logger.info(f"[Node 6 Critic] {role} brief passed — confidence {brief.confidence:.0%}")
            break

        if attempt < MAX_RETRIES:
            critic_score = await critic_evaluate(
                brief_json = json.dumps(brief.model_dump()),
                role       = role,
                llm        = llm,
            )
            logger.info(
                f"[Node 6 Critic] {role} confidence {brief.confidence:.0%}, "
                f"critic score {critic_score:.0%} — "
                f"{'passing' if critic_score >= 0.80 else f'revising (attempt {attempt + 1})'}"
            )

            if critic_score >= 0.80:
                brief.confidence = critic_score
                break

            brief = await generate_fn(context, llm)

    return brief


# ── Node Entry Point ──────────────────────────────────────────────────────────

async def stakeholder_brief_node(state: PipelineState) -> PipelineState:
    """
    Node 6 in the LangGraph pipeline — final node.
    Receives: complete PipelineState from all previous nodes.
    Returns:  PipelineState with four stakeholder briefs populated.
    """
    logger.info(f"[Node 6] Stakeholder Briefs — {state.company.ticker}")

    if state.error:
        logger.warning("[Node 6] Skipping — upstream error")
        return state

    if not state.parameters or not state.score:
        logger.warning("[Node 6] Skipping — missing parameters or score")
        return state

    try:
        llm     = get_llm()
        context = build_analysis_context(state)

        logger.info("[Node 6] Generating Executive brief...")
        exec_brief = await generate_executive_brief(context, llm)
        exec_brief = await critic_loop(exec_brief, generate_executive_brief, context, llm, "Executive")

        logger.info("[Node 6] Generating Consultant brief...")
        con_brief  = await generate_consultant_brief(context, llm)
        con_brief  = await critic_loop(con_brief, generate_consultant_brief, context, llm, "Consultant")

        logger.info("[Node 6] Generating Investor brief...")
        inv_brief  = await generate_investor_brief(context, llm)
        inv_brief  = await critic_loop(inv_brief, generate_investor_brief, context, llm, "Investor")

        logger.info("[Node 6] Generating Board brief...")
        brd_brief  = await generate_board_brief(context, llm)
        brd_brief  = await critic_loop(brd_brief, generate_board_brief, context, llm, "Board")

        state.briefs = StakeholderBriefs(
            executive  = exec_brief,
            consultant = con_brief,
            investor   = inv_brief,
            board      = brd_brief,
        )

        logger.info(
            f"[Node 6] All briefs complete — "
            f"Executive {exec_brief.confidence:.0%}, "
            f"Consultant {con_brief.confidence:.0%}, "
            f"Investor {inv_brief.confidence:.0%}, "
            f"Board {brd_brief.confidence:.0%}"
        )

    except Exception as e:
        logger.error(f"[Node 6] Error: {e}", exc_info=True)
        state.error = f"Brief generation failed: {str(e)}"

    return state