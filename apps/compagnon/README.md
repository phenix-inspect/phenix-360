# apps/compagnon — Interface PHÉNIX (PWA)

La boucle de capture terrain : dense, rapide, efficace (écrans C0..C7, à venir).

> **PoC Sprint 0 — risque offline.** App hôte minimale pour prouver qu'une
> saisie créée **hors-ligne** est stockée localement puis **rejouée à la
> reconnexion**. Ce n'est pas l'app finale.

## Pile

Vite + React 19 + TS, Tailwind branché sur le **preset `@phenix360/ui`**
(tokens + fontes), service worker via `vite-plugin-pwa`. Vocabulaire métier
(`ProjectStep`…) importé de `@phenix360/core`.

```bash
pnpm --filter @phenix360/compagnon dev      # http://localhost:5173
pnpm --filter @phenix360/compagnon build    # génère le service worker (dist/)
```

## Ce que le PoC prouve

1. **App-shell offline** : le service worker précache l'app ; elle se charge
   sans réseau.
2. **File d'attente persistante** : chaque saisie va dans **IndexedDB**
   (`outbox`), survit au rechargement et à la coupure réseau.
3. **Rejeu à la reconnexion** : au retour en ligne, la file est drainée
   automatiquement (les saisies passent `pending → synced`).

### Tester

- Saisir un texte + une étape → **Enregistrer**.
- **Couper le réseau** (bouton intégré, ou DevTools → Offline) puis enregistrer :
  la saisie reste en **file d'attente**.
- **Rétablir le réseau** : la file se vide, les saisies apparaissent dans
  « Synchronisées » (rendu via `Timeline`/`ActivityItem` du Design System).

> Le bouton « Couper le réseau » est une commodité de démo : il force l'échec de
> l'envoi sans dépendre des DevTools.

## Limites assumées (PoC, hors périmètre)

- **Pas de vrai backend** : l'envoi est simulé (latence + succès). Aucune
  écriture Supabase, aucune passerelle.
- **Pas d'auth** : aucune identité réelle ; auteur « PoC ».
- **Pas de résolution de conflits**, pas de retris exponentiels, pas de
  Background Sync (l'API Workbox `BackgroundSyncPlugin` pourra remplacer le rejeu
  applicatif là où c'est supporté — fragile sur iOS, d'où le rejeu côté app).
- **Pas d'upload de photos** (le risque ciblé ici est la file texte ; les
  fichiers volumineux feront l'objet d'un PoC dédié).
- **UX non finale** : ni design abouti, ni navigation, ni gestion d'erreurs
  riche. On teste **le risque offline**, pas l'application.
