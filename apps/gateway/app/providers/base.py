"""Interface de fournisseur IA — interchangeable (anti-lock-in, ADR-003 §5).

Un fournisseur ne fait que **synthétiser** un contexte déjà récupéré dans le
journal. Il ne décide pas de la vérité et n'a accès à aucune autre donnée.
`mode` est générique ('mock' | 'live') : le nom du modèle n'est jamais exposé.
"""

from __future__ import annotations

from typing import Protocol

from ..models import Source


class AIProvider(Protocol):
    mode: str

    async def synthesize(self, question: str, sources: list[Source]) -> str: ...
