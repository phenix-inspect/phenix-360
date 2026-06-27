# apps/gateway — Passerelle FastAPI

Service Python mince. Seul point d'accès à l'IA et aux écritures sensibles.

- L'IA n'est **jamais** appelée depuis le navigateur ; le modèle (Mistral) est
  invisible au client. PHÉNIX 360 répond d'abord par récupération structurée
  dans le journal, et n'interroge le modèle que pour la synthèse.
- Porte aussi : publication (validation humaine), notifications e-mail, OCR.
- Hors workspace pnpm (Python 3.11). Hébergé séparément (conteneur), portable.

> Scaffold FastAPI + PoC passerelle IA aux **étapes 5–6** du Sprint 0. Vide pour l'instant.
