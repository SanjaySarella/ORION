"""
ORION — LangGraph 6-Node Pipeline
Sanjay Sarella — Corporate Distress Intelligence

Node names use node_ prefix to avoid clashing with PipelineState field names.
LangGraph returns AddableValuesDict — accessed via dict keys, not dot notation.
"""

from langgraph.graph import StateGraph, END
from models.schemas import PipelineState, AnalysisResponse
from data.sec_edgar import resolve_company_identity

from agents.filing_extractor    import filing_extractor_node
from agents.distress_scorer     import distress_scorer_node
from agents.signal_intelligence import signal_intelligence_node
from agents.peer_benchmarking   import peer_benchmarking_node
from agents.trajectory          import trajectory_node
from agents.stakeholder_brief   import stakeholder_brief_node


def build_graph() -> StateGraph:
    graph = StateGraph(PipelineState)

    graph.add_node("node_filing_extractor",    filing_extractor_node)
    graph.add_node("node_distress_scorer",     distress_scorer_node)
    graph.add_node("node_signal_intelligence", signal_intelligence_node)
    graph.add_node("node_peer_benchmarking",   peer_benchmarking_node)
    graph.add_node("node_trajectory",          trajectory_node)
    graph.add_node("node_stakeholder_briefs",  stakeholder_brief_node)

    graph.set_entry_point("node_filing_extractor")
    graph.add_edge("node_filing_extractor",    "node_distress_scorer")
    graph.add_edge("node_distress_scorer",     "node_signal_intelligence")
    graph.add_edge("node_signal_intelligence", "node_peer_benchmarking")
    graph.add_edge("node_peer_benchmarking",   "node_trajectory")
    graph.add_edge("node_trajectory",          "node_stakeholder_briefs")
    graph.add_edge("node_stakeholder_briefs",  END)

    return graph.compile()


_compiled_graph = None

def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


def _get(result, key):
    """
    Safe field accessor that works whether LangGraph returns
    an AddableValuesDict (dict-style) or a Pydantic model (attribute-style).
    """
    try:
        return result[key]
    except (TypeError, KeyError):
        return getattr(result, key, None)


async def run_pipeline(query: str) -> AnalysisResponse:
    """
    Resolves the company, builds initial state, runs all 6 nodes,
    and returns the typed AnalysisResponse.
    """
    company       = await resolve_company_identity(query)
    initial_state = PipelineState(company=company)

    graph  = get_graph()
    result = await graph.ainvoke(initial_state)

    # Check for pipeline errors
    error = _get(result, "error")
    if error:
        raise RuntimeError(error)

    # Build response — works regardless of whether result is dict or Pydantic
    return AnalysisResponse(
        company    = _get(result, "company"),
        score      = _get(result, "score"),
        parameters = _get(result, "parameters"),
        signals    = _get(result, "signals"),
        peers      = _get(result, "peers"),
        trajectory = _get(result, "trajectory"),
        briefs     = _get(result, "briefs"),
    )