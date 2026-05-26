"""
ORION — Node 4: Peer Benchmarking Agent
Sanjay Sarella — Corporate Distress Intelligence

Peer discovery uses the EDGAR company browse endpoint with SIC filter.
This returns the actual registered companies in a given SIC category.
"""

import httpx
import asyncio
import logging
import os
from xml.etree import ElementTree as ET

from models.schemas import PipelineState, PeerBenchmark, PeerData

logger = logging.getLogger(__name__)

EDGAR_HEADERS = {
    "User-Agent": os.getenv(
        "SEC_EDGAR_USER_AGENT",
        "Sanjay Sarella sanjaysarella11@gmail.com"
    ),
    "Accept-Encoding": "gzip, deflate",
}


# ── SIC Lookup ────────────────────────────────────────────────────────────────

async def get_sic_for_cik(cik: str) -> str | None:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    try:
        async with httpx.AsyncClient(timeout=15, headers=EDGAR_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        sic = data.get("sic")
        return str(sic) if sic else None
    except Exception as e:
        logger.warning(f"[Node 4] SIC fetch failed: {e}")
        return None


# ── Peer Discovery via EDGAR Browse ──────────────────────────────────────────

async def find_peers_by_sic(sic: str, exclude_cik: str, count: int = 8) -> list[dict]:
    """
    Uses the EDGAR company browse-edgar endpoint filtered by SIC code.
    Returns Atom XML with companies registered under that SIC.
    """
    url = (
        f"https://www.sec.gov/cgi-bin/browse-edgar"
        f"?action=getcompany&SIC={sic}&dateb=&owner=include"
        f"&count=40&search_text=&output=atom"
    )

    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": EDGAR_HEADERS["User-Agent"]}) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = resp.text
    except Exception as e:
        logger.warning(f"[Node 4] EDGAR SIC browse failed for SIC {sic}: {e}")
        return []

    peers = []
    try:
        root = ET.fromstring(raw)
        ns   = {"atom": "http://www.w3.org/2005/Atom"}

        for entry in root.findall("atom:entry", ns):
            # CIK is in the <id> tag as a URL ending in ?action=getcompany&CIK=...
            id_el = entry.find("atom:id", ns)
            if id_el is None:
                continue

            id_text = id_el.text or ""
            cik_raw = ""

            # Extract CIK from URL param
            if "CIK=" in id_text:
                cik_raw = id_text.split("CIK=")[-1].split("&")[0].strip().zfill(10)

            if not cik_raw or cik_raw == exclude_cik or cik_raw == "0000000000":
                continue

            # Company name from <title>
            title_el = entry.find("atom:title", ns)
            name     = title_el.text.strip() if title_el is not None else "Unknown"

            peers.append({"cik": cik_raw, "name": name})

            if len(peers) >= count:
                break

    except ET.ParseError as e:
        logger.warning(f"[Node 4] Atom XML parse error: {e}")

    logger.info(f"[Node 4] Found {len(peers)} peers for SIC {sic} via EDGAR browse")
    return peers


# ── Peer Financials ───────────────────────────────────────────────────────────

async def get_peer_financials(cik: str) -> dict | None:
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        async with httpx.AsyncClient(timeout=20, headers=EDGAR_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"[Node 4] Facts failed for peer CIK {cik}: {e}")
        return None

    us_gaap = data.get("facts", {}).get("us-gaap", {})

    def latest_annual(concept: str) -> float | None:
        entries = us_gaap.get(concept, {}).get("units", {}).get("USD", [])
        annual  = sorted(
            [e for e in entries if e.get("form") == "10-K"],
            key=lambda x: x.get("end", ""), reverse=True
        )
        return annual[0].get("val") if annual else None

    return {
        "ebit":                latest_annual("OperatingIncomeLoss"),
        "interest_expense":    latest_annual("InterestExpense"),
        "current_assets":      latest_annual("AssetsCurrent"),
        "current_liabilities": latest_annual("LiabilitiesCurrent"),
        "revenue":             (latest_annual("Revenues") or
                                latest_annual("RevenueFromContractWithCustomerExcludingAssessedTax")),
        "gross_profit":        latest_annual("GrossProfit"),
    }


def compute_peer_score(m: dict) -> float:
    score = 0.0
    ebit, intr = m.get("ebit"), m.get("interest_expense")
    ca,   cl   = m.get("current_assets"), m.get("current_liabilities")
    rev,  gp   = m.get("revenue"), m.get("gross_profit")

    if ebit is not None and intr and intr != 0:
        cov = ebit / intr
        if cov < 1.0:   score += 40
        elif cov < 1.5: score += 20

    if ca is not None and cl and cl != 0:
        rat = ca / cl
        if rat < 1.0:   score += 40
        elif rat < 1.2: score += 20

    if gp is not None and rev and rev != 0:
        gm = gp / rev
        if 0.0 <= gm <= 1.0:
            if gm < 0.15:   score += 20
            elif gm < 0.25: score += 10

    return round(min(score, 100), 1)


def safe_ratio(a, b) -> float | None:
    if a is None or b is None or b == 0: return None
    return round(a / b, 3)


def build_context_summary(subject_score: float, name: str,
                          sector_avg: float, peers: list[PeerData]) -> str:
    diff = subject_score - sector_avg
    if diff >= 25:    comp = "significantly worse than"
    elif diff >= 10:  comp = "moderately worse than"
    elif diff <= -25: comp = "significantly better than"
    elif diff <= -10: comp = "moderately better than"
    else:             comp = "broadly in line with"

    peer_names = ", ".join(p.name for p in peers[:3]) if peers else "none found"
    return (
        f"{name} scores {subject_score:.0f} vs sector average {sector_avg:.0f} "
        f"— {comp} its peers. Benchmarked against: {peer_names}."
    )


# ── Node Entry Point ──────────────────────────────────────────────────────────

async def peer_benchmarking_node(state: PipelineState) -> PipelineState:
    logger.info(f"[Node 4] Peer Benchmarking — {state.company.ticker}")

    if state.error:
        return state

    try:
        sic = await get_sic_for_cik(state.company.cik)
        logger.info(f"[Node 4] SIC: {sic}")

        if not sic:
            state.peers = PeerBenchmark(
                peers=[], sector_avg_score=0.0,
                subject_vs_sector="SIC code not found — peer benchmarking unavailable.",
            )
            return state

        peer_candidates = await find_peers_by_sic(sic, state.company.cik, count=8)

        if not peer_candidates:
            state.peers = PeerBenchmark(
                peers=[], sector_avg_score=0.0,
                subject_vs_sector=f"No peers found for SIC {sic}.",
            )
            return state

        facts_results = await asyncio.gather(
            *[get_peer_financials(p["cik"]) for p in peer_candidates],
            return_exceptions=True,
        )

        peer_list: list[PeerData] = []
        for candidate, facts in zip(peer_candidates, facts_results):
            if isinstance(facts, Exception) or facts is None:
                continue
            peer_list.append(PeerData(
                ticker            = candidate["cik"],
                name              = candidate["name"],
                distress_score    = compute_peer_score(facts),
                interest_coverage = safe_ratio(facts.get("ebit"), facts.get("interest_expense")),
                current_ratio     = safe_ratio(facts.get("current_assets"), facts.get("current_liabilities")),
                gross_margin      = safe_ratio(facts.get("gross_profit"), facts.get("revenue")),
            ))

        peer_list.sort(key=lambda p: p.distress_score, reverse=True)
        peer_list = peer_list[:5]

        subject_score = state.score.score if state.score else 0.0
        sector_avg    = round(sum(p.distress_score for p in peer_list) / len(peer_list), 1) if peer_list else 0.0
        context       = build_context_summary(subject_score, state.company.name, sector_avg, peer_list)

        state.peers = PeerBenchmark(
            peers=peer_list, sector_avg_score=sector_avg,
            subject_vs_sector=context,
        )
        logger.info(f"[Node 4] Complete — {len(peer_list)} peers, sector avg {sector_avg}")

    except Exception as e:
        logger.error(f"[Node 4] Error: {e}", exc_info=True)
        state.peers = PeerBenchmark(
            peers=[], sector_avg_score=0.0,
            subject_vs_sector=f"Peer benchmarking failed: {str(e)}",
        )

    return state