"""Contrats d'API (Pydantic). La réponse ne révèle JAMAIS le modèle ni la clé.

L'assistant se présente uniquement comme « PHÉNIX 360 » (le fournisseur IA est
un détail d'implémentation interchangeable — ADR-003 §5 / ADR-004 §2.4).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    project_id: str
    question: str = Field(min_length=1)
    # Garde-fou « jamais bloqué » : forcer la transmission à l'équipe (ADR-001 §6).
    force_demande: bool = False


class Source(BaseModel):
    """Provenance d'une réponse — un extrait du journal du projet."""

    type: str
    excerpt: str
    event_id: str | None = None
    created_at: str | None = None


class DemandeIntent(BaseModel):
    """Intention de création de demande — PROPOSÉE, jamais écrite par l'IA."""

    question: str
    destinataire: str  # 'equipe'


class AskResponse(BaseModel):
    # 'answer' = synthèse à partir du journal ; 'demande_intent' = à transmettre.
    kind: str
    assistant: str = "PHÉNIX 360"
    message: str
    answer: str | None = None
    sources: list[Source] = Field(default_factory=list)
    demande: DemandeIntent | None = None
