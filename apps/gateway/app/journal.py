"""Source du journal d'événements du projet.

Le PoC lit un journal en mémoire (miroir du seed Supabase). En production, un
adaptateur implémentant `JournalSource` lira Supabase via la couche d'accès
(`packages/core`) — le reste de la passerelle ne change pas.

L'IA n'écrit jamais ici : elle ne fait que LIRE (ADR-001 §3).
"""

from __future__ import annotations

from typing import Any, Protocol

Event = dict[str, Any]

SEED_PROJECT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

# Miroir du seed (supabase/seed/seed.sql). Clés camelCase = modèle core.
_EVENTS: list[Event] = [
    {
        "id": "e1111111-1111-1111-1111-111111111111",
        "project_id": SEED_PROJECT,
        "type": "compte_rendu",
        "author_role": "compagnon",
        "visibility": "client",
        "state": "publie",
        "created_at": "2026-06-22T09:00:00Z",
        "content": {
            "texte": "Dalle coulée, séchage en cours. Démarrage cloisons la semaine prochaine.",
            "etapeProposee": "gros_oeuvre",
            "etapeConfirmee": "gros_oeuvre",
        },
    },
    {
        "id": "e2222222-2222-2222-2222-222222222222",
        "project_id": SEED_PROJECT,
        "type": "photo",
        "author_role": "compagnon",
        "visibility": "client",
        "state": "publie",
        "created_at": "2026-06-22T09:05:00Z",
        "content": {"legende": "Dalle terminée", "categorie": "gros_oeuvre", "piece": "Séjour"},
    },
    {
        "id": "e3333333-3333-3333-3333-333333333333",
        "project_id": SEED_PROJECT,
        "type": "demande",
        "author_role": "compagnon",
        "visibility": "client",
        "state": "ouverte",
        "created_at": "2026-06-26T09:00:00Z",
        "content": {
            "question": "Quel carrelage pour la salle de bain ? (2 options proposées)",
            "destinataire": "client",
        },
    },
    {
        "id": "e4444444-4444-4444-4444-444444444444",
        "project_id": SEED_PROJECT,
        "type": "compte_rendu",
        "author_role": "compagnon",
        "visibility": "interne",
        "state": "brouillon",
        "created_at": "2026-06-27T09:00:00Z",
        "content": {"texte": "Note interne : prévoir reprise enduit angle nord."},
    },
]


class JournalSource(Protocol):
    def events_for_project(self, project_id: str) -> list[Event]: ...


class InMemoryJournal:
    """Journal de démo. Remplaçable par un adaptateur Supabase (même protocole)."""

    def __init__(self, events: list[Event] | None = None) -> None:
        self._events = events if events is not None else _EVENTS

    def events_for_project(self, project_id: str) -> list[Event]:
        return [e for e in self._events if e["project_id"] == project_id]
