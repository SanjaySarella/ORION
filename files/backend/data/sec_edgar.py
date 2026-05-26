"""
ORION — SEC EDGAR Data Layer
Sanjay Sarella — Corporate Distress Intelligence

Company resolution uses sec.gov/files/company_tickers.json.
Name matching is scored so "Apple" reliably resolves to Apple Inc. (AAPL)
rather than Apple Hospitality REIT (APLE).
"""

import httpx
import logging
from typing import Optional
from models.schemas import CompanyIdentity, RawFinancials

logger = logging.getLogger(__name__)

BASE_URL        = "https://data.sec.gov"
SUBMISSIONS_URL = f"{BASE_URL}/submissions"
FACTS_URL       = f"{BASE_URL}/api/xbrl/companyfacts"

HEADERS = {
    "User-Agent": "Sanjay Sarella sanjaysarella11@gmail.com",
    "Accept-Encoding": "gzip, deflate",
}

_tickers_cache: dict = {}


async def _load_tickers() -> dict:
    global _tickers_cache
    if _tickers_cache:
        return _tickers_cache
    url = "https://www.sec.gov/files/company_tickers.json"
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": HEADERS["User-Agent"]}) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _tickers_cache = resp.json()
    logger.info(f"Loaded {len(_tickers_cache)} companies from SEC tickers file")
    return _tickers_cache


def _score_match(company: dict, query_upper: str, query_lower: str) -> int:
    """
    Scores how well a company matches the search query.
    Higher score = better match. Used to handle queries like "Apple" -> Apple Inc.
    """
    ticker = company.get("ticker", "").upper()
    name   = company.get("title",  "").lower().strip()

    if ticker == query_upper:
        return 100   # Exact ticker match

    if name == query_lower:
        return 90    # Exact name match

    # Name starts with query (e.g. "apple" matches "apple inc.")
    if name.startswith(query_lower):
        # Shorter name = more precise match
        return max(70, 85 - len(name))

    # Query is a word in the name
    name_words = name.split()
    if query_lower in name_words:
        return 60

    # Name contains query as substring
    if query_lower in name:
        return 40

    return 0


async def search_company(query: str) -> list[dict]:
    """Typeahead search — returns up to 10 matching companies."""
    tickers     = await _load_tickers()
    query_upper = query.upper().strip()
    query_lower = query.lower().strip()

    if not query_lower:
        return []

    scored = []
    for company in tickers.values():
        score = _score_match(company, query_upper, query_lower)
        if score > 0:
            scored.append((score, company))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "name":   c.get("title", ""),
            "ticker": c.get("ticker", ""),
            "cik":    str(c.get("cik_str", "")).zfill(10),
        }
        for _, c in scored[:10]
    ]


async def resolve_company_identity(query: str) -> CompanyIdentity:
    """
    Resolves a company name or ticker to a full CompanyIdentity with CIK.
    Scoring ensures "Apple" reliably returns Apple Inc., not Apple Hospitality REIT.
    """
    tickers     = await _load_tickers()
    query_upper = query.upper().strip()
    query_lower = query.lower().strip()

    best_score   = 0
    best_company = None

    for company in tickers.values():
        score = _score_match(company, query_upper, query_lower)
        if score > best_score:
            best_score   = score
            best_company = company
        if best_score == 100:
            break  # Exact ticker match — stop searching

    if best_company is None:
        raise ValueError(
            f"Company '{query}' not found in SEC EDGAR. "
            f"Try the exact company name (e.g. Apple Inc.) or ticker (e.g. AAPL)."
        )

    cik = str(best_company.get("cik_str", "")).zfill(10)
    logger.info(
        f"Resolved '{query}' → {best_company.get('title')} "
        f"(ticker: {best_company.get('ticker')}, CIK: {cik}, score: {best_score})"
    )

    return CompanyIdentity(
        name    = best_company.get("title", query),
        ticker  = best_company.get("ticker", query.upper()),
        cik     = cik,
        sic     = None,
        sector  = None,
        exchange= None,
    )


async def get_submissions(cik: str) -> dict:
    url = f"{SUBMISSIONS_URL}/CIK{cik}.json"
    async with httpx.AsyncClient(timeout=20, headers=HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def get_company_facts(cik: str) -> dict:
    url = f"{FACTS_URL}/CIK{cik}.json"
    async with httpx.AsyncClient(timeout=30, headers=HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def _annual_values(facts: dict, concept: str, unit: str = "USD") -> list[dict]:
    us_gaap  = facts.get("facts", {}).get("us-gaap", {})
    entries  = us_gaap.get(concept, {}).get("units", {}).get(unit, [])
    annual   = [e for e in entries if e.get("form") == "10-K"]
    by_end: dict = {}
    for e in annual:
        end = e.get("end", "")
        if end not in by_end or e.get("filed","") > by_end[end].get("filed",""):
            by_end[end] = e
    return sorted(by_end.values(), key=lambda x: x.get("end",""), reverse=True)


def _latest_values(facts: dict, concept: str, unit: str = "USD") -> list[dict]:
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    entries = us_gaap.get(concept, {}).get("units", {}).get(unit, [])
    valid   = [e for e in entries if e.get("form") in ("10-K", "10-Q")]
    by_end: dict = {}
    for e in valid:
        end = e.get("end", "")
        if end not in by_end or e.get("filed","") > by_end[end].get("filed",""):
            by_end[end] = e
    return sorted(by_end.values(), key=lambda x: x.get("end",""), reverse=True)


async def build_raw_financials(cik: str, quarters: int = 8) -> list[RawFinancials]:
    facts = await get_company_facts(cik)

    revenue_data  = (_annual_values(facts, "Revenues") or
                     _annual_values(facts, "RevenueFromContractWithCustomerExcludingAssessedTax"))
    gross_data    = _annual_values(facts, "GrossProfit")
    ebit_data     = _annual_values(facts, "OperatingIncomeLoss")
    interest_data = _annual_values(facts, "InterestExpense")
    ni_data       = _annual_values(facts, "NetIncomeLoss")
    ocf_data      = _annual_values(facts, "NetCashProvidedByUsedInOperatingActivities")

    ar_data     = _latest_values(facts, "AccountsReceivableNetCurrent")
    assets_data = _latest_values(facts, "Assets")
    curr_assets = _latest_values(facts, "AssetsCurrent")
    curr_liab   = _latest_values(facts, "LiabilitiesCurrent")
    cash_data   = _latest_values(facts, "CashAndCashEquivalentsAtCarryingValue")
    debt_data   = _latest_values(facts, "LongTermDebt")

    def sv(dl: list, idx: int) -> Optional[float]:
        return dl[idx].get("val") if idx < len(dl) else None

    results = []
    for i in range(min(quarters, len(ni_data))):
        results.append(RawFinancials(
            fiscal_quarter         = ni_data[i].get("end", f"FY{i+1}"),
            total_revenue          = sv(revenue_data, i),
            accounts_receivable    = sv(ar_data,      i),
            total_assets           = sv(assets_data,  i),
            total_debt             = sv(debt_data,     i),
            current_assets         = sv(curr_assets,  i),
            current_liabilities    = sv(curr_liab,    i),
            operating_cash_flow    = sv(ocf_data,     i),
            net_income             = sv(ni_data,      i),
            gross_profit           = sv(gross_data,   i),
            ebit                   = sv(ebit_data,    i),
            interest_expense       = sv(interest_data,i),
            days_sales_outstanding = None,
            free_cash_flow         = None,
            cash_and_equivalents   = sv(cash_data,    i),
        ))

    logger.info(f"[EDGAR] Built {len(results)} annual periods for CIK {cik}")
    return results
