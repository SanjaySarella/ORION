"""
ORION — RAG Chatbot
Sanjay Sarella — Corporate Distress Intelligence

Role-aware chatbot grounded in ChromaDB-indexed filing content.
Knows which stakeholder tab is active and full conversation history.
"""
import logging
import os
from langchain_groq import ChatGroq
from models.schemas import ChatResponse, StakeholderRole

logger = logging.getLogger(__name__)

ROLE_PROMPTS = {
    StakeholderRole.EXECUTIVE:  "You are advising a CEO or CFO. Focus on liquidity, debt, and immediate operational actions.",
    StakeholderRole.CONSULTANT: "You are advising a strategy consultant. Focus on deal risk, client exposure, and engagement decisions.",
    StakeholderRole.INVESTOR:   "You are advising a PE or hedge fund investor. Focus on bankruptcy probability, position sizing, and exit timing.",
    StakeholderRole.BOARD:      "You are advising a board member. Focus on governance obligations, escalation triggers, and regulatory exposure.",
}


async def answer_question(
    ticker: str,
    role: StakeholderRole,
    message: str,
    history: list[dict],
) -> ChatResponse:
    """
    Answers a user question in the context of a specific company analysis and stakeholder role.
    Grounds the answer in ChromaDB-retrieved filing content via RAG.
    """
    logger.info(f"[Chatbot] {role.value} question about {ticker}: {message[:60]}")

    # TODO: Retrieve relevant filing chunks from ChromaDB
    # TODO: Build full message history for multi-turn context
    # TODO: Stream response back to frontend

    role_prompt = ROLE_PROMPTS.get(role, ROLE_PROMPTS[StakeholderRole.EXECUTIVE])

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        api_key=os.getenv("GROQ_API_KEY"),
    )

    system = f"""You are ORION, a corporate financial distress intelligence platform.
{role_prompt}
You are answering a question about {ticker}.
Ground all answers in SEC filing data. Cite specific filing types and periods.
Be concise, direct, and evidence-based. Answer in plain English."""

    messages = [{"role": "system", "content": system}]
    for h in history:
        messages.append(h)
    messages.append({"role": "user", "content": message})

    response = await llm.ainvoke(messages)
    answer = response.content if hasattr(response, "content") else str(response)

    return ChatResponse(
        answer=answer,
        sources=["SEC EDGAR filing context pending ChromaDB implementation"],
    )
