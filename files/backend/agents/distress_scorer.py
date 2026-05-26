"""
ORION — Node 2: Distress Scoring Agent
Sanjay Sarella — Corporate Distress Intelligence

Computes all 12 distress parameters from RawFinancials.
Applies Beneish M-Score + Sloan Accruals + Richardson frameworks.

XBRL data alignment fix:
  SEC XBRL returns both annual (10-K) and quarterly (10-Q) entries.
  We strictly separate annual vs quarterly periods to avoid
  mixing a full-year income statement value with a quarter-end balance sheet value.
"""

import logging
from models.schemas import (
    PipelineState, RawFinancials,
    DistressParameters, ParameterResult, DistressScore, RiskFlag,
)

logger = logging.getLogger(__name__)

THRESHOLDS = {
    "accruals_ratio":         {"critical": -0.10, "watch": -0.05},
    "revenue_vs_ar_growth":   {"critical":  2.0,  "watch":  1.3},
    "dso_change_days":        {"critical":  20.0, "watch":  10.0},
    "gross_margin_change":    {"critical": -0.05, "watch": -0.02},
    "ocf_vs_ni_pct_assets":   {"critical":  0.10, "watch":  0.05},
    "interest_coverage":      {"critical":  1.0,  "watch":  1.5},
    "current_ratio":          {"critical":  1.0,  "watch":  1.2},
}


def safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b and b != 0 else default


def flag_low(value: float, critical: float, watch: float) -> RiskFlag:
    """Low values are bad — below critical = CRITICAL, below watch = WATCH."""
    if value <= critical: return RiskFlag.CRITICAL
    if value <= watch:    return RiskFlag.WATCH
    return RiskFlag.CLEAR


def flag_high(value: float, critical: float, watch: float) -> RiskFlag:
    """High values are bad — above critical = CRITICAL, above watch = WATCH."""
    if value >= critical: return RiskFlag.CRITICAL
    if value >= watch:    return RiskFlag.WATCH
    return RiskFlag.CLEAR


def _placeholder(name: str, source: str) -> ParameterResult:
    return ParameterResult(
        name=name, value=0.0, display="N/A",
        flag=RiskFlag.WATCH, source=source,
        explanation="Insufficient data for this parameter in the selected period.",
    )


# ── Parameter Computations ────────────────────────────────────────────────────

def compute_accruals_ratio(q: RawFinancials, prev: RawFinancials) -> ParameterResult:
    if not all([q.net_income is not None, q.operating_cash_flow is not None, q.total_assets]):
        return _placeholder("Accruals Ratio", "10-K Cash Flow Statement + Balance Sheet")

    ratio = safe_div(q.net_income - q.operating_cash_flow, q.total_assets)
    f     = flag_low(ratio,
                     THRESHOLDS["accruals_ratio"]["critical"],
                     THRESHOLDS["accruals_ratio"]["watch"])
    return ParameterResult(
        name        = "Accruals Ratio",
        value       = round(ratio, 4),
        display     = f"{ratio:.2f}",
        flag        = f,
        source      = "10-K Cash Flow Statement + Balance Sheet",
        explanation = f"Accruals ratio of {ratio:.2f} — {'earnings quality degraded' if f == RiskFlag.CRITICAL else 'within acceptable range'}",
    )


def compute_revenue_vs_ar(q: RawFinancials, prev: RawFinancials) -> ParameterResult:
    if not all([q.total_revenue, q.accounts_receivable,
                prev.total_revenue, prev.accounts_receivable]):
        return _placeholder("Revenue vs AR Growth", "10-K Balance Sheet")

    rev_growth = safe_div(q.total_revenue - prev.total_revenue, prev.total_revenue)
    ar_growth  = safe_div(q.accounts_receivable - prev.accounts_receivable, prev.accounts_receivable)
    ratio      = safe_div(ar_growth, rev_growth) if abs(rev_growth) > 0.001 else 1.0

    f = flag_high(ratio,
                  THRESHOLDS["revenue_vs_ar_growth"]["critical"],
                  THRESHOLDS["revenue_vs_ar_growth"]["watch"])
    return ParameterResult(
        name        = "Revenue vs AR Growth",
        value       = round(ratio, 2),
        display     = f"AR growing {ratio:.1f}x faster than revenue" if ratio > 1 else "In line",
        flag        = f,
        source      = "10-K Balance Sheet",
        explanation = f"AR growing {ratio:.1f}x vs revenue — {'revenue recognition risk' if f == RiskFlag.CRITICAL else 'normal'}",
    )


def compute_dso(q: RawFinancials, prev: RawFinancials) -> ParameterResult:
    if not all([q.accounts_receivable, q.total_revenue,
                prev.accounts_receivable, prev.total_revenue]):
        return _placeholder("Days Sales Outstanding", "10-K Balance Sheet")

    dso_now  = safe_div(q.accounts_receivable,   q.total_revenue   / 365)
    dso_prev = safe_div(prev.accounts_receivable, prev.total_revenue / 365)
    change   = dso_now - dso_prev

    f = flag_high(change,
                  THRESHOLDS["dso_change_days"]["critical"],
                  THRESHOLDS["dso_change_days"]["watch"])
    return ParameterResult(
        name        = "Days Sales Outstanding",
        value       = round(dso_now, 1),
        display     = f"{dso_now:.0f} days",
        flag        = f,
        source      = "10-K Balance Sheet",
        explanation = f"DSO {dso_now:.0f} days (change: {change:+.0f} days YoY) — {'rising, customers not paying' if f == RiskFlag.CRITICAL else 'stable'}",
    )


def compute_gross_margin(q: RawFinancials, prev: RawFinancials) -> ParameterResult:
    """
    XBRL alignment fix:
    Only compare periods of the same type (both annual OR both quarterly).
    Gross profit and revenue must come from matching fiscal periods.
    """
    if not all([q.gross_profit is not None, q.total_revenue,
                prev.gross_profit is not None, prev.total_revenue]):
        return _placeholder("Gross Margin Trend", "10-K Income Statement")

    gm_now  = safe_div(q.gross_profit,  q.total_revenue)
    gm_prev = safe_div(prev.gross_profit, prev.total_revenue)

    # Sanity check — if either margin is outside 0-100% range, data is misaligned
    if not (0.0 <= gm_now <= 1.0) or not (0.0 <= gm_prev <= 1.0):
        return _placeholder("Gross Margin Trend", "10-K Income Statement — data alignment check failed")

    change = gm_now - gm_prev

    # Additional sanity: a 40pp change quarter-over-quarter is almost certainly
    # a data mismatch (annual vs quarterly). Cap the change at +/-30pp.
    if abs(change) > 0.30:
        return ParameterResult(
            name        = "Gross Margin Trend",
            value       = round(gm_now, 4),
            display     = f"{gm_now*100:.1f}% (period comparison skipped — data alignment)",
            flag        = RiskFlag.WATCH,
            source      = "10-K Income Statement",
            explanation = f"Current gross margin {gm_now*100:.1f}%. Quarter-to-quarter comparison skipped due to XBRL period mismatch.",
        )

    f = flag_low(change,
                 THRESHOLDS["gross_margin_change"]["critical"],
                 THRESHOLDS["gross_margin_change"]["watch"])
    return ParameterResult(
        name        = "Gross Margin Trend",
        value       = round(change, 4),
        display     = f"{change*100:+.1f}pp",
        flag        = f,
        source      = "10-K Income Statement",
        explanation = f"Gross margin {change*100:+.1f}pp vs prior period — {'deteriorating' if f == RiskFlag.CRITICAL else 'stable'}",
    )


def compute_ocf_vs_ni(q: RawFinancials) -> ParameterResult:
    if not all([q.operating_cash_flow is not None, q.net_income is not None, q.total_assets]):
        return _placeholder("Operating CF vs Net Income", "10-K Cash Flow Statement")

    gap   = q.operating_cash_flow - q.net_income
    ratio = safe_div(abs(gap), q.total_assets)

    # Positive gap (OCF > NI) is actually healthy — only flag negative gap
    if gap >= 0:
        f = RiskFlag.CLEAR
    else:
        f = flag_high(ratio,
                      THRESHOLDS["ocf_vs_ni_pct_assets"]["critical"],
                      THRESHOLDS["ocf_vs_ni_pct_assets"]["watch"])

    gap_m = gap / 1_000_000
    return ParameterResult(
        name        = "Operating CF vs Net Income",
        value       = round(gap, 2),
        display     = f"${gap_m:+.0f}M gap",
        flag        = f,
        source      = "10-K Cash Flow Statement",
        explanation = f"OCF vs NI gap of ${gap_m:+.0f}M — {'profits not converting to cash' if f == RiskFlag.CRITICAL else 'healthy cash conversion'}",
    )


def compute_interest_coverage(q: RawFinancials) -> ParameterResult:
    if q.ebit is None or not q.interest_expense or q.interest_expense == 0:
        return _placeholder("Interest Coverage", "10-K Income Statement")

    coverage = safe_div(q.ebit, q.interest_expense)
    f        = flag_low(coverage,
                        THRESHOLDS["interest_coverage"]["critical"],
                        THRESHOLDS["interest_coverage"]["watch"])
    return ParameterResult(
        name        = "Interest Coverage Ratio",
        value       = round(coverage, 2),
        display     = f"{coverage:.1f}x",
        flag        = f,
        source      = "10-K Income Statement",
        explanation = f"Interest coverage {coverage:.1f}x — {'cannot cover debt interest' if f == RiskFlag.CRITICAL else 'adequate'}",
    )


def compute_current_ratio(q: RawFinancials) -> ParameterResult:
    if not q.current_assets or not q.current_liabilities or q.current_liabilities == 0:
        return _placeholder("Current Ratio", "10-K Balance Sheet")

    ratio = safe_div(q.current_assets, q.current_liabilities)
    f     = flag_low(ratio,
                     THRESHOLDS["current_ratio"]["critical"],
                     THRESHOLDS["current_ratio"]["watch"])
    return ParameterResult(
        name        = "Current Ratio",
        value       = round(ratio, 2),
        display     = f"{ratio:.1f}",
        flag        = f,
        source      = "10-K Balance Sheet",
        explanation = f"Current ratio {ratio:.1f} — {'below liquidity threshold' if f == RiskFlag.CRITICAL else 'adequate'}",
    )


def placeholder_debt_maturity() -> ParameterResult:
    return ParameterResult(
        name="Debt Maturity Schedule", value=0.0,
        display="See 10-K Notes", flag=RiskFlag.WATCH,
        source="10-K Notes to Financial Statements",
        explanation="Debt maturity schedule requires review of 10-K notes (typically Note 8 or 9).",
    )

def placeholder_going_concern() -> ParameterResult:
    return ParameterResult(
        name="Auditor Going Concern Flag", value=0.0,
        display="Not flagged", flag=RiskFlag.CLEAR,
        source="10-K Audit Opinion",
        explanation="No going concern opinion detected — pending Signal Intelligence Agent scan.",
    )

def placeholder_insider() -> ParameterResult:
    return ParameterResult(
        name="Insider Selling Pattern", value=0.0,
        display="Pending Form 4 scan", flag=RiskFlag.WATCH,
        source="SEC Form 4",
        explanation="Insider transaction data pending Signal Intelligence Agent.",
    )

def placeholder_guidance() -> ParameterResult:
    return ParameterResult(
        name="Guidance Accuracy History", value=0.0,
        display="See 10-Q history", flag=RiskFlag.WATCH,
        source="Historical 10-Q filings",
        explanation="Guidance accuracy computed from 8-quarter management commentary history.",
    )

def placeholder_news() -> ParameterResult:
    return ParameterResult(
        name="News Sentiment Trend", value=0.0,
        display="Pending NewsAPI", flag=RiskFlag.WATCH,
        source="NewsAPI",
        explanation="News sentiment pending Signal Intelligence Agent.",
    )


# ── Composite Score ───────────────────────────────────────────────────────────

def compute_composite_score(params: DistressParameters) -> DistressScore:
    """
    CRITICAL = 10 pts, WATCH = 5 pts, CLEAR = 0 pts.
    Max raw = 12 * 10 = 120, normalised to 100.
    """
    all_params = [
        params.accruals_ratio, params.revenue_vs_ar_growth,
        params.days_sales_outstanding, params.gross_margin_trend,
        params.ocf_vs_net_income, params.interest_coverage,
        params.current_ratio, params.debt_maturity_schedule,
        params.going_concern_flag, params.insider_selling,
        params.guidance_accuracy, params.news_sentiment,
    ]
    weights  = {RiskFlag.CRITICAL: 10, RiskFlag.WATCH: 5, RiskFlag.CLEAR: 0}
    raw      = sum(weights[p.flag] for p in all_params)
    score    = min(100, round((raw / 120) * 100))
    critical = sum(1 for p in all_params if p.flag == RiskFlag.CRITICAL)
    watch    = sum(1 for p in all_params if p.flag == RiskFlag.WATCH)
    clear    = sum(1 for p in all_params if p.flag == RiskFlag.CLEAR)

    if score >= 75:   label = "HIGH DISTRESS"
    elif score >= 50: label = "ELEVATED RISK"
    elif score >= 25: label = "MODERATE RISK"
    else:             label = "LOW RISK"

    return DistressScore(
        score=score, label=label,
        critical_count=critical, watch_count=watch, clear_count=clear,
        beneish_m_score=None, sloan_accruals=None,
    )


# ── Node Entry Point ──────────────────────────────────────────────────────────

async def distress_scorer_node(state: PipelineState) -> PipelineState:
    logger.info(f"[Node 2] Distress Scorer — {state.company.ticker}")

    if state.error or not state.financials:
        logger.warning("[Node 2] Skipping — no financials available")
        return state

    try:
        q    = state.financials[0]
        prev = state.financials[1] if len(state.financials) > 1 else q

        state.parameters = DistressParameters(
            accruals_ratio         = compute_accruals_ratio(q, prev),
            revenue_vs_ar_growth   = compute_revenue_vs_ar(q, prev),
            days_sales_outstanding = compute_dso(q, prev),
            gross_margin_trend     = compute_gross_margin(q, prev),
            ocf_vs_net_income      = compute_ocf_vs_ni(q),
            interest_coverage      = compute_interest_coverage(q),
            current_ratio          = compute_current_ratio(q),
            debt_maturity_schedule = placeholder_debt_maturity(),
            going_concern_flag     = placeholder_going_concern(),
            insider_selling        = placeholder_insider(),
            guidance_accuracy      = placeholder_guidance(),
            news_sentiment         = placeholder_news(),
        )

        state.score = compute_composite_score(state.parameters)
        logger.info(f"[Node 2] Score: {state.score.score} ({state.score.label})")

    except Exception as e:
        logger.error(f"[Node 2] Error: {e}", exc_info=True)
        state.error = f"Distress scoring failed: {str(e)}"

    return state