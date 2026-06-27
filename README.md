# PHÉNIX 360

Plateforme de **suivi intelligent d'un projet de rénovation**. Un lieu unique,
mobile-first, où vit toute l'histoire d'un chantier — qui remplace les e-mails,
SMS, WhatsApp et appels.

> **Principe directeur :** si une décision technique entre en conflit avec
> l'expérience utilisateur, **l'UX gagne toujours.** PHÉNIX 360 n'est pas un
> logiciel de chantier, c'est une expérience premium.

## Architecture

L'architecture est figée par les **ADR** dans [`docs/adr/`](./docs/adr) —
référence officielle, à respecter pour tout développement.

- Colonne vertébrale : un **journal d'événements** unique par chantier (ADR-001/002).
- Cœur de données : **Supabase** (Postgres + Auth + Storage + Realtime + RLS),
  démarré sur le **Cloud UE**, conçu **portable** vers un hébergement souverain.
- IA derrière une **passerelle FastAPI** — le modèle (Mistral) n'est jamais
  appelé depuis le navigateur, ni révélé au client.
- Clients : deux **PWA** React mobile-first (équipe & client).

## Structure du dépôt

```
apps/
  client/      PWA Espace client (univers propriétaire)
  compagnon/   PWA Interface PHÉNIX (boucle terrain)
  gateway/     Passerelle FastAPI (IA, publication, notifications, OCR)
packages/
  ui/          Design System : tokens + composants partagés
  core/        Types du modèle d'événement + couche d'accès données (portable)
  config/      Configs partagées (TypeScript, Prettier)
supabase/
  migrations/  Schéma SQL versionné (le journal au centre)
  policies/    Politiques RLS
  seed/        Données de démonstration
docs/adr/      Décisions d'architecture (référence officielle)
legacy/        Ancien produit « Phénix Inspect » — archivé, NE PAS réutiliser
```

## Outillage

- **pnpm** (workspaces) + **Turborepo** — `pnpm install`, puis `pnpm dev` / `pnpm build` / `pnpm lint`.
- Node ≥ 22. La passerelle est en Python 3.11 (FastAPI), hors workspace pnpm.

## État

🚧 **Sprint 0 — Fondations.** Le socle se met en place ; pas encore de
fonctionnalité produit. Voir [`docs/adr/ADR-004`](./docs/adr/ADR-004-architecture-technique-et-depot.md).
