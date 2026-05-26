"""
ORION — Node 1: Filing Extractor Agent
Sanjay Sarella — Corporate Distress Intelligence

Responsibility:
  Pulls the last 8 quarters of 10-K and 10-Q filings from SEC EDGAR.
  Extracts all raw financial inputs needed to compute the 12 parameters.
  Writes a typed list[RawFinancials] into PipelineState.
"""

import logging
from models.schemas import PipelineState
from data.sec_edgar import build_raw_financials

logger = logging.getLogger(__name__)


async def filing_extractor_node(state: PipelineState) -> PipelineState:
    """
    Node 1 in the LangGraph pipeline.
    Receives: PipelineState with company identity resolved.
    Returns:  PipelineState with financials list populated.
    """
    logger.info(f"[Node 1] Filing Extractor — {state.company.ticker} (CIK: {state.company.cik})")

    try:
        financials = await build_raw_financials(
            cik=state.company.cik,
            quarters=8,
        )

        if not financials:
            raise ValueError(f"No financial data found for CIK {state.company.cik}")

        logger.info(f"[Node 1] Extracted {len(financials)} quarters of financials")
        state.financials = financials

    except Exception as e:
        logger.error(f"[Node 1] Error: {e}")
        state.error = f"Filing extraction failed: {str(e)}"

    return state
