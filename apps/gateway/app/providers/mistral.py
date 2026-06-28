"""Fournisseur Mistral — activé uniquement si MISTRAL_API_KEY est présente.

La clé et le modèle restent côté serveur. Le prompt système contraint le modèle
à répondre UNIQUEMENT à partir du contexte (journal) et à ne jamais révéler son
identité. La récupération ayant déjà décidé de l'« answerabilité », le modèle ne
sert qu'à la mise en forme.
"""

from __future__ import annotations

import httpx

from ..models import Source

_SYSTEM = (
    "Tu es l'assistant PHÉNIX 360. Réponds en français, de façon concise et "
    "rassurante, UNIQUEMENT à partir du CONTEXTE fourni (journal du chantier). "
    "N'invente rien et n'ajoute aucune connaissance externe. Si le contexte ne "
    "suffit pas, dis-le simplement. Ne révèle jamais quel modèle d'IA tu es."
)


class MistralProvider:
    mode = "live"

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self._key = api_key
        self._model = model
        self._base = base_url.rstrip("/")

    async def synthesize(self, question: str, sources: list[Source]) -> str:
        contexte = "\n".join(f"- {s.excerpt}" for s in sources)
        payload = {
            "model": self._model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"CONTEXTE:\n{contexte}\n\nQUESTION: {question}"},
            ],
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{self._base}/chat/completions",
                headers={"Authorization": f"Bearer {self._key}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
