"""
ORION — Node 3: Signal Intelligence Agent
Sanjay Sarella — Corporate Distress Intelligence

News sentiment now uses Yahoo Finance RSS + Google News RSS.
Both are free, require no API key, and have no daily request limits.
FRED API still used for macro context (free, generous limits).
"""

import httpx
import asyncio
import logging
import os
import re
from datetime import datetime, timedelta
from xml.etree import ElementTree as ET

from models.schemas import (
    PipelineState, SignalIntelligence, InsiderTransaction,
    ParameterResult, RiskFlag,
)

logger = logging.getLogger(__name__)

EDGAR_HEADERS = {
    "User-Agent": os.getenv(
        "SEC_EDGAR_USER_AGENT",
        "Sanjay Sarella sanjaysarella11@gmail.com"
    ),
    "Accept-Encoding": "gzip, deflate",
}

RSS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ORION/1.0; research tool)",
    "Accept": "application/rss+xml, application/xml, text/xml",
}


# ── Form 4 — Insider Transactions ─────────────────────────────────────────────

async def fetch_form4_list(cik: str, count: int = 30) -> list[dict]:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    async with httpx.AsyncClient(timeout=20, headers=EDGAR_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    filings      = data.get("filings", {}).get("recent", {})
    forms        = filings.get("form", [])
    dates        = filings.get("filingDate", [])
    accessions   = filings.get("accessionNumber", [])
    primary_docs = filings.get("primaryDocument", [])

    results = []
    for i, form in enumerate(forms):
        if form == "4":
            results.append({
                "filing_date":      dates[i] if i < len(dates) else None,
                "accession_number": accessions[i].replace("-", "") if i < len(accessions) else None,
                "primary_document": primary_docs[i] if i < len(primary_docs) else None,
            })
        if len(results) >= count:
            break
    return results


async def parse_form4(cik: str, accession: str, primary_doc: str) -> list[dict]:
    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{primary_doc}"
    try:
        async with httpx.AsyncClient(timeout=15, headers=EDGAR_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.text
    except Exception as e:
        logger.warning(f"[Node 3] Form 4 fetch failed: {e}")
        return []

    transactions = []
    try:
        root        = ET.fromstring(content)
        owner_name  = ""
        owner_title = ""

        for owner in root.iter("reportingOwner"):
            n = owner.find(".//rptOwnerName")
            t = owner.find(".//officerTitle")
            if n is not None: owner_name  = n.text or ""
            if t is not None: owner_title = t.text or ""

        for txn in root.iter("nonDerivativeTransaction"):
            code_el   = txn.find(".//transactionCode")
            shares_el = txn.find(".//transactionShares/value")
            price_el  = txn.find(".//transactionPricePerShare/value")
            date_el   = txn.find(".//transactionDate/value")

            if code_el is None or shares_el is None:
                continue

            code   = code_el.text or ""
            shares = float(shares_el.text or 0)
            price  = float(price_el.text or 0) if price_el is not None else 0.0
            date   = date_el.text if date_el is not None else ""

            if code in ("S", "P"):
                transactions.append({
                    "type":   "sell" if code == "S" else "buy",
                    "shares": int(shares),
                    "price":  price,
                    "value":  shares * price,
                    "date":   date,
                    "name":   owner_name,
                    "title":  owner_title,
                })
    except ET.ParseError as e:
        logger.warning(f"[Node 3] Form 4 XML parse error: {e}")

    return transactions


async def get_insider_transactions(
    cik: str, months_back: int = 6,
) -> tuple[list[InsiderTransaction], float, float, float]:
    all_filings = await fetch_form4_list(cik, count=40)
    cutoff      = datetime.now() - timedelta(days=months_back * 30)

    recent = [
        f for f in all_filings
        if f["filing_date"]
        and datetime.strptime(f["filing_date"], "%Y-%m-%d") >= cutoff
        and f["accession_number"]
        and f["primary_document"]
    ][:15]

    transactions = []
    total_sold   = 0.0
    total_bought = 0.0

    for filing in recent:
        raw = await parse_form4(cik, filing["accession_number"], filing["primary_document"])
        for t in raw:
            transactions.append(InsiderTransaction(
                date             = t["date"],
                insider_name     = t["name"],
                title            = t["title"],
                transaction_type = t["type"],
                shares           = t["shares"],
                value_usd        = t["value"],
                form4_url        = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=4",
            ))
            if t["type"] == "sell": total_sold   += t["value"]
            else:                   total_bought += t["value"]
        await asyncio.sleep(0.12)

    volume     = total_sold + total_bought
    sell_ratio = total_sold / volume if volume > 0 else 0.0
    return transactions, round(sell_ratio, 3), total_sold, total_bought


# ── Going Concern — 10-K Audit Opinion ───────────────────────────────────────

GOING_CONCERN_PHRASES = [
    "going concern",
    "substantial doubt",
    "ability to continue as a going concern",
    "raise substantial doubt about",
    "conditions raise substantial doubt",
    "management's plans do not alleviate",
]


async def detect_going_concern(cik: str) -> tuple[bool, str | None]:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    async with httpx.AsyncClient(timeout=20, headers=EDGAR_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    filings      = data.get("filings", {}).get("recent", {})
    forms        = filings.get("form", [])
    accessions   = filings.get("accessionNumber", [])
    primary_docs = filings.get("primaryDocument", [])

    ten_k_idx = next((i for i, f in enumerate(forms) if f == "10-K"), None)
    if ten_k_idx is None:
        return False, None

    accession = accessions[ten_k_idx].replace("-", "")
    primary   = primary_docs[ten_k_idx]

    doc_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{primary}"
    try:
        async with httpx.AsyncClient(timeout=30, headers=EDGAR_HEADERS) as client:
            resp = await client.get(doc_url)
            resp.raise_for_status()
            text = resp.text.lower()
    except Exception as e:
        logger.warning(f"[Node 3] 10-K fetch failed for going concern scan: {e}")
        return False, None

    for phrase in GOING_CONCERN_PHRASES:
        if phrase in text:
            idx     = text.find(phrase)
            snippet = text[max(0, idx - 40): idx + 220]
            snippet = re.sub(r"\s+", " ", snippet).strip()
            return True, snippet[:300]

    return False, None


# ── News Sentiment — Yahoo Finance RSS + Google News RSS ─────────────────────
# Free, no API key, no daily limits.

NEGATIVE_WORDS = {
    "bankruptcy", "bankrupt", "default", "fraud", "lawsuit", "investigation",
    "loss", "decline", "falling", "missed", "disappointing", "concern",
    "warning", "downgrade", "debt", "restructuring", "layoffs", "closure",
    "shutdown", "collapse", "crisis", "trouble", "struggling", "plunges",
    "drops", "slumps", "cuts", "charges", "writedown", "impairment",
    "recall", "fine", "penalty", "probe", "subpoena", "deficit", "breach",
    "violation", "complaint", "recall", "suspended", "halted",
}

POSITIVE_WORDS = {
    "growth", "profit", "record", "beat", "exceeded", "strong", "gains",
    "upgrade", "acquisition", "partnership", "expansion", "raised",
    "success", "profitable", "recovery", "momentum", "outperform",
    "guidance", "dividend", "buyback", "innovation", "breakthrough",
    "surge", "rally", "climbs", "rises", "soars", "wins",
}


def score_headline(text: str) -> float:
    words = set(re.findall(r"\b\w+\b", text.lower()))
    neg   = len(words & NEGATIVE_WORDS)
    pos   = len(words & POSITIVE_WORDS)
    total = neg + pos
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 3)


def parse_rss_headlines(xml_text: str) -> list[str]:
    """Extracts headline + description text from an RSS feed."""
    headlines = []
    try:
        root = ET.fromstring(xml_text)
        for item in root.iter("item"):
            title_el = item.find("title")
            desc_el  = item.find("description")
            title    = title_el.text or "" if title_el is not None else ""
            desc     = desc_el.text  or "" if desc_el  is not None else ""
            # Strip HTML tags from description
            desc_clean = re.sub(r"<[^>]+>", " ", desc)
            combined   = f"{title} {desc_clean}".strip()
            if combined:
                headlines.append(combined)
    except ET.ParseError:
        # Some feeds have encoding issues — try extracting title text directly
        titles = re.findall(r"<title>(.*?)</title>", xml_text, re.DOTALL)
        headlines = [re.sub(r"<[^>]+>", "", t).strip() for t in titles[1:]]  # skip feed title
    return headlines


async def fetch_rss_feed(url: str, client: httpx.AsyncClient) -> list[str]:
    try:
        resp = await client.get(url, timeout=12)
        resp.raise_for_status()
        return parse_rss_headlines(resp.text)
    except Exception as e:
        logger.warning(f"[Node 3] RSS fetch failed for {url}: {e}")
        return []


async def get_news_sentiment(name: str, ticker: str) -> tuple[float, int]:
    """
    Fetches news from Yahoo Finance RSS and Google News RSS.
    Returns (average_sentiment, article_count).
    Both sources are free with no rate limits or API keys.
    """
    # Clean company name for URL encoding
    name_encoded    = name.replace(" Inc.", "").replace(" Corp.", "").replace(" Ltd.", "").strip()
    name_url        = name_encoded.replace(" ", "+")
    ticker_url      = ticker.upper()

    # Yahoo Finance RSS — ticker-specific, highly relevant
    yahoo_url  = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker_url}&region=US&lang=en-US"

    # Google News RSS — broader coverage
    google_url = (
        f"https://news.google.com/rss/search"
        f"?q={name_url}+stock+earnings&hl=en-US&gl=US&ceid=US:en"
    )

    async with httpx.AsyncClient(headers=RSS_HEADERS, follow_redirects=True) as client:
        yahoo_headlines, google_headlines = await asyncio.gather(
            fetch_rss_feed(yahoo_url,  client),
            fetch_rss_feed(google_url, client),
        )

    all_headlines = yahoo_headlines + google_headlines

    if not all_headlines:
        logger.warning(f"[Node 3] No RSS news found for {ticker}")
        return 0.0, 0

    scores    = [score_headline(h) for h in all_headlines]
    avg_score = round(sum(scores) / len(scores), 3)

    logger.info(
        f"[Node 3] News: {len(yahoo_headlines)} Yahoo + {len(google_headlines)} Google = "
        f"{len(all_headlines)} articles, sentiment {avg_score:+.3f}"
    )
    return avg_score, len(all_headlines)


# ── FRED — Macro Context ──────────────────────────────────────────────────────

async def get_macro_context() -> str | None:
    api_key = os.getenv("FRED_API_KEY", "")
    if not api_key:
        logger.warning("[Node 3] FRED_API_KEY not set")
        return None

    base_params = {"api_key": api_key, "file_type": "json", "limit": 1, "sort_order": "desc"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            ffr_r, hy_r = await asyncio.gather(
                client.get("https://api.stlouisfed.org/fred/series/observations",
                           params={**base_params, "series_id": "DFF"}),
                client.get("https://api.stlouisfed.org/fred/series/observations",
                           params={**base_params, "series_id": "BAMLH0A0HYM2"}),
            )

        ffr       = float(ffr_r.json()["observations"][0]["value"])
        hy_spread = float(hy_r.json()["observations"][0]["value"])
        context   = f"Fed Funds Rate: {ffr:.2f}%. HY Credit Spread: {hy_spread:.0f}bps."

        if ffr > 4.0:
            context += " High rate environment increases refinancing risk."
        if hy_spread > 500:
            context += " Elevated HY spreads signal broad market stress."
        elif hy_spread < 300:
            context += " Compressed credit spreads indicate benign credit conditions."

        return context
    except Exception as e:
        logger.warning(f"[Node 3] FRED error: {e}")
        return None


# ── Parameter Builders ────────────────────────────────────────────────────────

def build_insider_parameter(sell_ratio, total_sold, total_bought, tx_count) -> ParameterResult:
    if sell_ratio >= 0.80:   f = RiskFlag.CRITICAL
    elif sell_ratio >= 0.60: f = RiskFlag.WATCH
    else:                    f = RiskFlag.CLEAR

    sold_m   = total_sold   / 1_000_000
    bought_m = total_bought / 1_000_000
    display  = (f"${sold_m:.1f}M sold / ${bought_m:.1f}M bought"
                if tx_count > 0 else "No transactions in period")

    return ParameterResult(
        name        = "Insider Selling Pattern",
        value       = sell_ratio,
        display     = display,
        flag        = f,
        source      = f"SEC Form 4 — last 6 months ({tx_count} transactions)",
        explanation = (f"Insider sell ratio {sell_ratio:.0%} — "
                       f"{'significant executive selling' if f == RiskFlag.CRITICAL else 'within normal range'}"),
    )


def build_going_concern_parameter(issued: bool, snippet: str | None) -> ParameterResult:
    return ParameterResult(
        name        = "Auditor Going Concern Flag",
        value       = 1.0 if issued else 0.0,
        display     = "ISSUED" if issued else "Not flagged",
        flag        = RiskFlag.CRITICAL if issued else RiskFlag.CLEAR,
        source      = "10-K Audit Opinion (text scan)",
        explanation = ("Going concern opinion issued — auditor flagged doubt about ability to continue"
                       if issued else
                       "No going concern language in most recent 10-K audit opinion"),
    )


def build_news_sentiment_parameter(score: float, count: int) -> ParameterResult:
    if score <= -0.5:   f = RiskFlag.CRITICAL
    elif score <= -0.2: f = RiskFlag.WATCH
    else:               f = RiskFlag.CLEAR

    return ParameterResult(
        name        = "News Sentiment Trend",
        value       = score,
        display     = f"{score:+.2f}  ({count} articles, Yahoo Finance + Google News)",
        flag        = f,
        source      = "Yahoo Finance RSS + Google News RSS — last 90 days",
        explanation = (f"Sentiment {score:+.2f} across {count} articles — "
                       f"{'predominantly negative' if f == RiskFlag.CRITICAL else 'neutral to positive'}"),
    )


# ── Node Entry Point ──────────────────────────────────────────────────────────

async def signal_intelligence_node(state: PipelineState) -> PipelineState:
    logger.info(f"[Node 3] Signal Intelligence — {state.company.ticker}")

    if state.error:
        return state

    try:
        (transactions, sell_ratio, total_sold, total_bought), \
        (gc_issued, gc_text), \
        (sentiment, article_count), \
        macro = await asyncio.gather(
            get_insider_transactions(state.company.cik),
            detect_going_concern(state.company.cik),
            get_news_sentiment(state.company.name, state.company.ticker),
            get_macro_context(),
        )

        logger.info(
            f"[Node 3] Insider: {len(transactions)} txns, {sell_ratio:.0%} sell | "
            f"Going concern: {'ISSUED' if gc_issued else 'clear'} | "
            f"News: {sentiment:+.2f} ({article_count} articles)"
        )

        state.signals = SignalIntelligence(
            insider_sell_ratio       = sell_ratio,
            total_insider_sold_usd   = total_sold,
            total_insider_bought_usd = total_bought,
            transactions             = transactions[:20],
            going_concern_text       = gc_text,
            going_concern_issued     = gc_issued,
            news_sentiment_score     = sentiment,
            news_article_count       = article_count,
            macro_context            = macro,
        )

        if state.parameters:
            state.parameters.insider_selling    = build_insider_parameter(
                sell_ratio, total_sold, total_bought, len(transactions))
            state.parameters.going_concern_flag = build_going_concern_parameter(gc_issued, gc_text)
            state.parameters.news_sentiment     = build_news_sentiment_parameter(sentiment, article_count)

            from agents.distress_scorer import compute_composite_score
            state.score = compute_composite_score(state.parameters)
            logger.info(f"[Node 3] Updated score: {state.score.score} ({state.score.label})")

        logger.info("[Node 3] Complete")

    except Exception as e:
        logger.error(f"[Node 3] Error: {e}", exc_info=True)
        state.error = f"Signal intelligence failed: {str(e)}"

    return state