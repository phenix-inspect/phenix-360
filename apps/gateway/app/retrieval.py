"""Récupération structurée dans le journal du projet.

D'abord la donnée, ensuite (éventuellement) la synthèse. C'est la récupération
qui décide si une réponse est possible : si rien de pertinent n'est trouvé,
l'IA n'est pas sollicitée et une demande est proposée. L'IA n'est donc jamais
source de vérité — elle ne fait que reformuler un contexte issu du journal.

La visibilité client reflète `core.isVisibleToClient` (l'assistant sert le
client ; la passerelle applique la visibilité, ne la contourne pas).
"""

from __future__ import annotations

import re
import unicodedata

from .journal import Event
from .models import Source

STEP_LABEL = {
    "gros_oeuvre": "Gros œuvre",
    "second_oeuvre": "Second œuvre",
    "finitions": "Finitions",
    "reception": "Réception",
}

_STOPWORDS = {
    "les", "des", "une", "uns", "est", "vous", "avez", "quel", "quelle", "pour",
    "dans", "avec", "sur", "par", "que", "qui", "votre", "vos", "nos", "ses",
    "the", "and", "mon", "ma", "mes", "ete", "etre", "fait",
}


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _tokens(text: str) -> set[str]:
    words = re.split(r"[^a-z0-9]+", _strip_accents(text).lower())
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def is_visible_to_client(e: Event) -> bool:
    if e["visibility"] != "client":
        return False
    if e["type"] == "demande":
        if e["content"].get("destinataire") == "client":
            return e["state"] in ("ouverte", "traitee", "close")
        return e["state"] in ("traitee", "close")
    return e["state"] == "publie"


def current_step(events: list[Event]) -> str | None:
    crs = [
        e
        for e in events
        if e["type"] == "compte_rendu"
        and e["state"] == "publie"
        and e["content"].get("etapeConfirmee")
    ]
    crs.sort(key=lambda e: e["created_at"], reverse=True)
    return crs[0]["content"]["etapeConfirmee"] if crs else None


def _excerpt(e: Event) -> str:
    c = e["content"]
    return c.get("texte") or c.get("question") or c.get("legende") or c.get("libelle") or e["type"]


def retrieve(question: str, events: list[Event]) -> list[Source]:
    """Renvoie les extraits pertinents du journal (vide ⇒ réponse impossible)."""
    visible = [e for e in events if is_visible_to_client(e)]
    q_norm = _strip_accents(question).lower()
    q_tokens = _tokens(question)
    items: list[Source] = []

    # Intention « avancement » : lecture structurée de l'étape courante.
    if any(k in q_norm for k in ("avanc", "etape", "ou en est", "stade")):
        step = current_step(visible)
        if step:
            items.append(Source(type="avancement", excerpt=f"Étape en cours : {STEP_LABEL.get(step, step)}."))

    # Pertinence par recouvrement de mots-clés sur le contenu.
    scored: list[tuple[int, Event]] = []
    for e in visible:
        score = len(q_tokens & _tokens(_excerpt(e)))
        if score > 0:
            scored.append((score, e))
    scored.sort(key=lambda x: (-x[0], x[1]["created_at"]), reverse=False)

    for _, e in scored[:3]:
        items.append(
            Source(
                event_id=e["id"],
                type=e["type"],
                created_at=e["created_at"],
                excerpt=_excerpt(e),
            )
        )
    return items
