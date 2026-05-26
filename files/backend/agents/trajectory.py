"""
ORION — Node 5: Trajectory Agent
Sanjay Sarella — Corporate Distress Intelligence

Responsibility:
  Runs the distress scorer across each of the 8 quarters independently.
  Produces a QuarterScore for each quarter showing how distress evolved.
  Identifies the directional trend — accelerating, stabilising, or recovering.
  Counts how many consecutive quarters have been in the red zone (score >= 60).

This node answers the question:
  "Is this company getting worse, holding steady, or recovering?"
"""

import logging
from models.schemas import (
    PipelineState, Trajectory, QuarterScore, RawFinancials,
    DistressParameters, RiskFlag, ParameterResult,
)

logger = logging.getLogger(__name__)


# ── Per-Quarter Scoring ───────────────────────────────────────────────────────

def safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b and b != 0 else default


def score_single_quarter(q: RawFinancials, prev: RawFinancials) -> float:
    """
    Computes a simplified distress score for one quarter.
    Uses the 6 parameters computable from a single quarter of data.
    Scaled to 0-100.
    """
    points = 0

    # 1. Accruals ratio
    if q.net_income is not None and q.operating_cash_flow is not None and q.total_assets:
        accruals = safe_div(q.net_income - q.operating_cash_flow, q.total_assets)
        if accruals < -0.10:
            points += 2
        elif accruals < -0.05:
            points += 1

    # 2. Interest coverage
    if q.ebit is not None and q.interest_expense:
        coverage = safe_div(q.ebit, q.interest_expense)
        if coverage < 1.0:
            points += 2
        elif coverage < 1.5:
            points += 1

    # 3. Current ratio
    if q.current_assets is not None and q.current_liabilities:
        ratio = safe_div(q.current_assets, q.current_liabilities)
        if ratio < 1.0:
            points += 2
        elif ratio < 1.2:
            points += 1

    # 4. OCF vs Net Income gap
    if q.operating_cash_flow is not None and q.net_income is not None and q.total_assets:
        gap_ratio = abs(safe_div(q.operating_cash_flow - q.net_income, q.total_assets))
        if gap_ratio > 0.10:
            points += 1

    # 5. Gross margin vs prior quarter
    if all([q.gross_profit, q.total_revenue, prev.gross_profit, prev.total_revenue]):
        gm_now  = safe_div(q.gross_profit, q.total_revenue)
        gm_prev = safe_div(prev.gross_profit, prev.total_revenue)
        if gm_now - gm_prev < -0.05:
            points += 2
        elif gm_now - gm_prev < -0.02:
            points += 1

    # 6. Revenue vs AR growth
    if all([q.total_revenue, q.accounts_receivable, prev.total_revenue, prev.accounts_receivable]):
        rev_growth = safe_div(q.total_revenue - prev.total_revenue, prev.total_revenue)
        ar_growth  = safe_div(q.accounts_receivable - prev.accounts_receivable, prev.accounts_receivable)
        ratio      = safe_div(ar_growth, rev_growth) if rev_growth != 0 else 1.0
        if ratio > 2.0:
            points += 2
        elif ratio > 1.3:
            points += 1

    # Max possible points = 11, scale to 100
    return round(min((points / 11) * 100, 100), 1)


def score_to_label(score: float) -> str:
    if score >= 75:   return "HIGH DISTRESS"
    if score >= 50:   return "ELEVATED RISK"
    if score >= 25:   return "MODERATE RISK"
    return "LOW RISK"


# ── Trend Analysis ────────────────────────────────────────────────────────────

def analyse_trend(scores: list[float]) -> tuple[str, int]:
    """
    Analyses the direction of distress across quarters.
    Returns (direction, quarters_in_red).

    Direction logic:
      - Compare the average of the most recent 2 quarters vs the oldest 2
      - If recent avg is 10+ points higher  → accelerating
      - If recent avg is 10+ points lower   → recovering
      - Otherwise                           → stabilising
    """
    if len(scores) < 2:
        return "stabilising", 0

    recent_avg = sum(scores[:2]) / 2
    older_avg  = sum(scores[-2:]) / 2
    diff       = recent_avg - older_avg

    if diff >= 10:
        direction = "accelerating"
    elif diff <= -10:
        direction = "recovering"
    else:
        direction = "stabilising"

    quarters_in_red = sum(1 for s in scores if s >= 60)

    return direction, quarters_in_red


def build_trend_summary(
    direction: str,
    quarters_in_red: int,
    scores: list[float],
    company_name: str,
) -> str:
    """
    Plain English summary of the trajectory.
    """
    most_recent  = scores[0]  if scores else 0
    oldest       = scores[-1] if scores else 0
    total_quarters = len(scores)

    summary = f"{company_name} distress trajectory: {direction.upper()}. "

    if direction == "accelerating":
        summary += (
            f"Score has risen from {oldest:.0f} to {most_recent:.0f} "
            f"over {total_quarters} quarters — structural deterioration is ongoing. "
        )
    elif direction == "recovering":
        summary += (
            f"Score has fallen from {oldest:.0f} to {most_recent:.0f} "
            f"over {total_quarters} quarters — conditions are improving. "
        )
    else:
        summary += (
            f"Score has remained between {min(scores):.0f} and {max(scores):.0f} "
            f"over {total_quarters} quarters — no clear directional movement. "
        )

    if quarters_in_red >= 4:
        summary += (
            f"{quarters_in_red} of {total_quarters} quarters in the red zone (score above 60) "
            f"— sustained elevated distress."
        )
    elif quarters_in_red > 0:
        summary += f"{quarters_in_red} quarter(s) exceeded the red zone threshold."
    else:
        summary += "No quarters have crossed the red zone threshold."

    return summary


# ── Node Entry Point ──────────────────────────────────────────────────────────

async def trajectory_node(state: PipelineState) -> PipelineState:
    """
    Node 5 in the LangGraph pipeline.
    Receives: PipelineState with financials list (up to 8 quarters).
    Returns:  PipelineState with trajectory data populated.
    """
    logger.info(f"[Node 5] Trajectory — {state.company.ticker}")

    if state.error:
        logger.warning("[Node 5] Skipping — upstream error")
        return state

    if not state.financials:
        logger.warning("[Node 5] No financials available for trajectory analysis")
        state.trajectory = Trajectory(
            quarters         = [],
            direction        = "stabilising",
            quarters_in_red  = 0,
            trend_summary    = "Insufficient financial history for trajectory analysis.",
        )
        return state

    try:
        quarter_scores: list[QuarterScore] = []
        raw_scores:     list[float]        = []

        financials = state.financials  # most recent first

        for i, q in enumerate(financials):
            # Use the next quarter as "previous" for trend calculations
            prev = financials[i + 1] if i + 1 < len(financials) else q

            score = score_single_quarter(q, prev)
            label = score_to_label(score)

            quarter_scores.append(QuarterScore(
                quarter = q.fiscal_quarter,
                score   = score,
                label   = label,
            ))
            raw_scores.append(score)

        direction, quarters_in_red = analyse_trend(raw_scores)

        trend_summary = build_trend_summary(
            direction        = direction,
            quarters_in_red  = quarters_in_red,
            scores           = raw_scores,
            company_name     = state.company.name,
        )

        state.trajectory = Trajectory(
            quarters         = quarter_scores,
            direction        = direction,
            quarters_in_red  = quarters_in_red,
            trend_summary    = trend_summary,
        )

        logger.info(
            f"[Node 5] Trajectory complete — "
            f"{direction}, {quarters_in_red} quarters in red zone"
        )

    except Exception as e:
        logger.error(f"[Node 5] Error: {e}", exc_info=True)
        state.trajectory = Trajectory(
            quarters         = [],
            direction        = "stabilising",
            quarters_in_red  = 0,
            trend_summary    = f"Trajectory analysis failed: {str(e)}",
        )

    return state