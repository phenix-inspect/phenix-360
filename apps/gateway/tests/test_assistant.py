"""Tests du PoC passerelle — invariants produit (sans clé : fournisseur mock)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def test_health_default_provider_is_mock() -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["ai"] == "mock"  # pas de MISTRAL_API_KEY


def test_answer_from_journal() -> None:
    r = client.post("/assistant/ask", json={"project_id": PID, "question": "Où en est le chantier ?"})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "answer"
    assert body["sources"]  # réponse sourcée dans le journal
    assert "œuvre" in body["answer"].lower() or "oeuvre" in body["answer"].lower()
    assert body["assistant"] == "PHÉNIX 360"


def test_unknown_returns_demande_intent() -> None:
    r = client.post(
        "/assistant/ask",
        json={"project_id": PID, "question": "Pouvez-vous m'envoyer la facture finale ?"},
    )
    body = r.json()
    assert body["kind"] == "demande_intent"
    assert body["answer"] is None
    assert body["demande"]["destinataire"] == "phenix"
    assert "facture" in body["demande"]["question"].lower()


def test_force_demande_is_never_blocked() -> None:
    r = client.post(
        "/assistant/ask",
        json={"project_id": PID, "question": "Où en est le chantier ?", "force_demande": True},
    )
    assert r.json()["kind"] == "demande_intent"


def test_never_leaks_model_or_key() -> None:
    r = client.post("/assistant/ask", json={"project_id": PID, "question": "Où en est le chantier ?"})
    body = r.text.lower()
    assert "mistral" not in body
    assert "api_key" not in body and "authorization" not in body and "bearer" not in body


def test_internal_draft_is_not_used() -> None:
    # La note interne en brouillon ne doit jamais alimenter une réponse client.
    r = client.post(
        "/assistant/ask",
        json={"project_id": PID, "question": "Y a-t-il une reprise d'enduit prévue ?"},
    )
    body = r.json()
    assert body["kind"] == "demande_intent"  # invisible au client → pas de contexte
