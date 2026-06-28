"""Passerelle IA PHÉNIX 360 (FastAPI) — PoC Sprint 0.

L'IA n'est jamais appelée depuis le navigateur : tout passe ici. La clé et le
modèle restent côté serveur et ne sont jamais renvoyés au client.
"""

from __future__ import annotations

from fastapi import FastAPI

from .assistant import answer_question
from .config import load_settings
from .journal import InMemoryJournal
from .models import AskRequest, AskResponse
from .providers.factory import get_provider

settings = load_settings()
journal = InMemoryJournal()
provider = get_provider(settings)

app = FastAPI(title="PHÉNIX 360 — Passerelle IA (PoC)", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    # `ai` est générique ('mock' | 'live') — jamais le nom du modèle.
    return {"status": "ok", "ai": provider.mode}


@app.post("/assistant/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    return await answer_question(
        journal, provider, req.project_id, req.question, req.force_demande
    )
