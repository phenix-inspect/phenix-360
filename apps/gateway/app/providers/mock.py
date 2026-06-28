"""Fournisseur mock — déterministe, hors-ligne, par défaut.

Reformule strictement le contexte fourni (aucune connaissance externe). Suffit
à prouver la chaîne « récupération → synthèse → réponse sourcée » sans clé.
"""

from __future__ import annotations

from ..models import Source


class MockProvider:
    mode = "mock"

    async def synthesize(self, question: str, sources: list[Source]) -> str:
        lignes = "\n".join(f"- {s.excerpt}" for s in sources)
        return (
            "D'après le suivi de votre chantier :\n"
            f"{lignes}\n\n"
            "(Réponse établie uniquement à partir du journal du projet.)"
        )
