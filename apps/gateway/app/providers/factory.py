"""Sélection du fournisseur : Mistral si clé présente, sinon mock."""

from __future__ import annotations

from ..config import Settings
from .base import AIProvider
from .mistral import MistralProvider
from .mock import MockProvider


def get_provider(settings: Settings) -> AIProvider:
    if settings.mistral_api_key:
        return MistralProvider(
            settings.mistral_api_key, settings.mistral_model, settings.mistral_base_url
        )
    return MockProvider()
