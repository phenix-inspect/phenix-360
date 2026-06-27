# packages/core — Modèle & accès données

- **Types du modèle d'événement** (ADR-002) : enveloppe + contenu typé, partagés
  entre apps et alignés sur le schéma SQL.
- **Couche d'accès Supabase abstraite** (règle de portabilité ADR-004 §2.5 n°3) :
  aucun appel Supabase éparpillé dans les écrans ; tout passe par ici, ce qui
  rend la migration vers un hébergement souverain mécanique.

> Rempli à l'**étape 4** du Sprint 0. Vide pour l'instant.
