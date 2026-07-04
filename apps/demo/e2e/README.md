# Suites e2e (Playwright)

Parcours bout-en-bout du Mode Démo, en non-régression **durable** (dans le dépôt,
pour survivre aux réinitialisations d'environnement).

## Lancer

```bash
pnpm --filter @phenix360/demo test:e2e
```

Le script `test:e2e` fait `vite build` puis `node e2e/run.mjs` : le runner démarre
le serveur de preview sur `:4173`, exécute chaque `*.test.mjs`, agrège les
résultats et arrête le serveur. Code de sortie non nul si une suite échoue.

## Écrire une suite

Importer le harness partagé (`harness.mjs`) :

```js
import { launch, session, harness, openDemo } from './harness.mjs';
const browser = await launch();
const { page, consoleErrors } = await session(browser, { guardDeepLinks: true });
const { assert, summary } = harness();
await openDemo(page); // ouvre la démo seedée, attend « Bonjour Mickaël »
```

- `openDemo(page)` gère l'écran d'accueil (choix « Découvrir la démo »).
- `guardDeepLinks: true` neutralise la navigation vers `tel:` / `sms:` / `wa.me` /
  Maps tout en laissant le `onClick` (journalisation) s'exécuter.
- Terminer par `summary(consoleErrors)` puis `process.exit`.

Environnement : Chromium est résolu depuis `/opt/pw-browsers/chromium-*`
(surchargeable via `PW_EXECUTABLE`), Playwright depuis l'installation node globale.
