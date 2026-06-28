"""Configuration de la passerelle — pilotée par variables d'environnement.

Portabilité (ADR-004 §2.5) : changer d'hôte/fournisseur = changer des variables,
jamais le code. La clé et le modèle restent **côté serveur** : jamais exposés.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mistral_api_key: str | None
    mistral_model: str
    mistral_base_url: str

    @property
    def has_live_provider(self) -> bool:
        return bool(self.mistral_api_key)


def load_settings() -> Settings:
    return Settings(
        mistral_api_key=os.getenv("MISTRAL_API_KEY") or None,
        mistral_model=os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
        mistral_base_url=os.getenv("MISTRAL_BASE_URL", "https://api.mistral.ai/v1"),
    )
