# apps/gateway — Passerelle IA (FastAPI)

Service mince et **séparé** : l'IA n'est **jamais** appelée depuis le navigateur
(ADR-004 §2.4). La clé et le modèle restent côté serveur et **ne sont jamais
renvoyés au client**.

> **PoC Sprint 0 — risque IA.** Endpoint assistant minimal : récupération
> structurée dans le journal du projet → synthèse à partir du **seul** contexte
> → sinon **intention de demande**. Hors workspace pnpm (Python 3.11).

## Principe non négociable

L'IA **lit, synthétise, oriente, ou déclenche une demande**. Elle n'est **jamais
source de vérité ni auteur** (ADR-001 §3) :

- c'est la **récupération** qui décide si une réponse est possible ; sans
  contexte pertinent, l'IA n'est pas sollicitée ;
- la synthèse se fait à partir du **seul** journal du projet (aucune
  connaissance externe) et la réponse est **sourcée** ;
- quand l'information manque (ou sur demande explicite), la passerelle renvoie
  une **intention de création de demande** — elle ne l'écrit pas : un humain
  prend le relais (garde-fou « jamais bloqué », ADR-001 §6).

## Fournisseur IA interchangeable

`AIProvider` (interface) → `MockProvider` (défaut, hors-ligne) ou
`MistralProvider`. **Mock par défaut ; Mistral uniquement si `MISTRAL_API_KEY`
est présente.** Le fournisseur ne fait que reformuler le contexte ; `mode` est
générique (`mock` | `live`), jamais le nom du modèle.

## Endpoints

- `GET /health` → `{ "status": "ok", "ai": "mock" | "live" }`
- `POST /assistant/ask`
  ```json
  { "project_id": "…", "question": "…", "force_demande": false }
  ```
  Réponse : `kind = "answer"` (avec `answer` + `sources`) **ou**
  `kind = "demande_intent"` (avec `demande = { question, destinataire }`).
  Champ `assistant` toujours `"PHÉNIX 360"`.

## Lancer / tester

```bash
cd apps/gateway
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

uvicorn app.main:app --reload          # http://localhost:8000/docs
pytest                                 # invariants produit

# Activer Mistral (réel) :
MISTRAL_API_KEY=sk-... uvicorn app.main:app
```

## Limites assumées (PoC, hors périmètre)

- **Journal en mémoire** (miroir du seed) ; pas encore branché sur Supabase. Un
  adaptateur implémentant `JournalSource` lira le journal réel via
  `packages/core` — le reste ne change pas.
- **Récupération naïve** (mots-clés + intention « avancement »), pas de base
  vectorielle (V1 sans vecteurs, ADR-004 §2.4). Suffit à éprouver le risque.
- **Pas d'auth** ni de revalidation RLS ici : en production la passerelle, en
  rôle de service, **revalide** les permissions avant de lire/écrire.
- **Pas d'écriture** : la demande proposée n'est pas créée (l'IA n'est pas
  auteur) ; la création passe par le flux validé côté produit.
- **Pas de streaming, pas de mémoire conversationnelle.** On teste le risque IA
  (récupération + masquage du modèle + repli demande), pas l'assistant final.

Porte aussi (à venir, hors PoC) : publication validée, notifications e-mail, OCR.
