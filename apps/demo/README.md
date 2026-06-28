# apps/demo — PHÉNIX 360, Mode Démo

Le **premier parcours produit complet**, jouable en moins de 5 minutes devant un
client. Une seule app qui présente les deux surfaces (Compagnon ↔ Espace Client)
en **côte à côte**, avec synchro instantanée.

```bash
pnpm --filter @phenix360/demo dev        # http://localhost:5173
pnpm --filter @phenix360/demo build
```

## Le script de démo (5 min)

1. **Créer un projet** (titre, client, compagnon, statut, étape initiale).
2. Vue **Compagnon** → rédiger un **compte rendu** + une étape → **Publier**.
3. Vue **Espace client** → l'événement **apparaît** dans le récit ; le **bandeau
   intelligent** se met à jour tout seul.
4. Créer une **demande** au client (Compagnon) → le bandeau passe à
   « **Une décision vous attend** ».
5. **Assistant** : « Où en est le chantier ? » → réponse **issue du journal**,
   sourcée (ou intention de demande si l'info manque).
6. Le client **répond par une décision** (ou crée une demande) → le bandeau
   repasse à « **Vous n'avez rien à faire** ».

> Astuce démo : ouvrir deux onglets (un sur **Compagnon**, un sur **Espace
> client**) — la publication dans l'un apparaît instantanément dans l'autre
> (BroadcastChannel). En vue « Côte à côte », les deux sont à l'écran.

## Architecture (Mode Démo, dette maîtrisée)

- **Toute la logique métier vit dans `@phenix360/core`** : modèle d'événement,
  `nextClientAction` (moteur du bandeau), `runAssistant` (workflow figé),
  `currentStep`, visibilité client. **Aucune logique métier dans l'UI** — les
  surfaces n'affichent que des résultats.
- **Données derrière les ports** `ProjectRepository` / `EventRepository`
  (`@phenix360/core`). Implémentation `InMemoryBackend` sur un `KeyValueStore`
  **localStorage** (persistance + multi-onglets). Le `store` ne fait
  qu'orchestrer ces ports et exposer un snapshot à React.
- **Passer en Supabase = remplacer l'implémentation des ports**, sans toucher au
  produit, à l'UI, ni à la logique métier.
- UI = `@phenix360/ui` (tokens + primitives) ; vocabulaire = `@phenix360/core`.

## Limites assumées (Mode Démo, hors périmètre)

- **Pas de backend / pas d'auth** : état local (localStorage) ; identités de démo
  (noms) hors modèle core. Reset via le bouton « Réinitialiser ».
- **Assistant** : synthèse **mock** (déterministe, hors-ligne) ; la récupération
  et le repli en demande sont réels. Aucun appel LLM. Le branchement Mistral
  (via la passerelle) et Supabase (Realtime) viendront ensuite.
- **Photos** : pas d'upload réel (vignette de substitution) ; la zone média
  d'`ActivityItem` reste prête.
- **Moments** : modèle préparé côté core, non activé (réactions/commentaires
  plus tard).
- Une app unifiée pour la démo ; en production, deux PWA (client / compagnon)
  partageant `core` + `ui`, sur Supabase.
