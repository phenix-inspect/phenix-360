"""Orchestration de l'assistant.

Règle non négociable : l'IA lit, synthétise, oriente, ou déclenche une demande.
Elle n'est jamais source de vérité ni auteur.

Flux :
  1. récupérer le contexte dans le journal du projet ;
  2. si rien de pertinent (ou `force_demande`) → INTENTION de demande (l'humain
     prend le relais — garde-fou « jamais bloqué », ADR-001 §6) ;
  3. sinon → synthèse via le fournisseur, à partir du SEUL contexte, sourcée ;
  4. toute erreur du fournisseur → repli sur l'intention de demande.
"""

from __future__ import annotations

from .journal import JournalSource
from .models import AskResponse, DemandeIntent
from .providers.base import AIProvider
from .retrieval import retrieve


def _demande_intent(question: str, message: str | None = None) -> AskResponse:
    return AskResponse(
        kind="demande_intent",
        message=message
        or (
            "Je n'ai pas cette information dans le suivi du chantier. "
            "Je propose de transmettre votre demande à l'équipe PHÉNIX."
        ),
        demande=DemandeIntent(question=question, destinataire="phenix"),
    )


async def answer_question(
    journal: JournalSource,
    provider: AIProvider,
    project_id: str,
    question: str,
    force_demande: bool = False,
) -> AskResponse:
    if force_demande:
        return _demande_intent(
            question, "Votre demande est transmise à l'équipe PHÉNIX."
        )

    events = journal.events_for_project(project_id)
    sources = retrieve(question, events)
    if not sources:
        return _demande_intent(question)

    try:
        answer = await provider.synthesize(question, sources)
    except Exception:
        # L'IA est faillible : on ne bloque jamais, on transmet à l'humain.
        return _demande_intent(
            question, "Je préfère transmettre votre demande à l'équipe PHÉNIX."
        )

    return AskResponse(
        kind="answer",
        message="Réponse établie à partir du journal du chantier.",
        answer=answer,
        sources=sources,
    )
