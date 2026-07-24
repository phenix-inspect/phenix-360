# PHÉNIX 360 — Runbook de production

> Ce document est le **guide d'exploitation** de PHÉNIX 360. Il décrit ce qui est
> déployé aujourd'hui, comment le mettre en ligne, comment diagnostiquer un
> incident, et ce qu'il reste à mettre en place **avant d'accueillir de vrais
> clients payants**. Il est écrit pour être lu par un exploitant, pas par un
> développeur.

---

## 1. Ce qui est déployé aujourd'hui (état réel)

L'application mise en ligne est **`apps/demo`** — une **SPA React 100 % côté
navigateur**. Point capital pour l'exploitation :

- **Aucun serveur applicatif, aucune base de données connectée.** Les données
  (chantiers, missions, photos, documents) vivent dans le **`localStorage` du
  navigateur** de chaque utilisateur.
- **Conséquences directes :**
  - Les données **ne sont pas partagées** entre appareils ni entre utilisateurs.
    Deux conducteurs sur deux téléphones ne voient pas les mêmes données. Un
    client sur son mobile ne voit rien de ce que le conducteur a saisi sur son
    portable.
  - Les données **ne sont pas sauvegardables côté serveur.** Vider le cache du
    navigateur, changer d'appareil ou passer en navigation privée = perte totale.
  - Le `PasswordGate` (variable `VITE_DEMO_PASSWORD`) est un **écran dissuasif**,
    **pas une authentification** : le mot de passe est présent dans le bundle.

C'est un **excellent produit de démonstration / pilote mono-utilisateur**, mais
**pas** encore un système multi-utilisateur de production (cf. §7 et le verdict).

Le socle serveur **existe dans le dépôt mais n'est pas branché** à la démo :

- `supabase/` — migrations SQL, politiques **RLS**, storage, seed (testés en CI).
- `apps/gateway/` — passerelle IA Python (FastAPI), non déployée.
- `apps/compagnon/` — PoC PWA (service worker + offline), non déployée.

---

## 2. Déploiement

### 2.1 Cibles

| Cible            | Config                               | Domaine                                | Rôle recommandé                                                  |
| ---------------- | ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| **Vercel**       | `vercel.json`                        | domaine racine                         | **Cible de production** (supporte les en-têtes HTTP de sécurité) |
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` | `phenix-inspect.github.io/phenix-360/` | Démo publique (⚠️ ne pose **pas** d'en-têtes HTTP)               |

> **Recommandation :** choisir **une seule** cible de production pour lever
> l'ambiguïté de version. Vercel est préférable (en-têtes de sécurité, rollback
> en un clic, domaine propre). GitHub Pages reste utile pour une démo publique.

### 2.2 Build

- Commande : `pnpm --filter @phenix360/demo build` → sortie `apps/demo/dist`.
- Installe en **`--frozen-lockfile`** : **builds reproductibles** (même commit +
  même `pnpm-lock.yaml` = même sortie). Node **22** (cf. `engines`).
- Le **commit** est injecté dans le bundle comme identité de version
  (`__APP_VERSION__`, via `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA`).

### 2.3 Variables d'environnement

Voir `.env.example`. Pour la **démo déployée**, une seule est utile :

| Variable             | Où                                        | Rôle                              |
| -------------------- | ----------------------------------------- | --------------------------------- |
| `VITE_DEMO_PASSWORD` | build Vercel / var. dépôt `DEMO_PASSWORD` | mot de passe de l'écran dissuasif |

Les variables Supabase / gateway / SMTP ne concernent que le **futur** back-end
(non branché à la démo). **Ne jamais** committer de `.env` (déjà couvert par
`.gitignore`). `SUPABASE_SERVICE_ROLE_KEY` et `MISTRAL_API_KEY` restent
**serveur uniquement**, jamais exposés au navigateur.

### 2.4 Rollback

- **Vercel :** chaque déploiement est immuable → _Promote to Production_ sur un
  déploiement précédent = rollback immédiat.
- **GitHub Pages :** `git revert` du commit fautif puis push (le workflow
  redéploie), ou relancer un run Pages antérieur.

### 2.5 Cache / compression / CDN / assets

- Assets **hashés** (`/assets/*.[hash].js`) → `Cache-Control: immutable` 1 an
  (posé par `vercel.json`). `index.html` non mis en cache (toujours frais).
- Compression Brotli/gzip et CDN : **fournis par Vercel** automatiquement.
- Vendors lourds **isolés en chunks** (`react`, `pdfjs`) → mis en cache et non
  réinvalidés à chaque déploiement applicatif.

---

## 3. Sécurité

| Contrôle                    | État                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **CSP**                     | ✅ `script-src 'self'` (aucun script inline), `object-src 'none'`, pas d'`unsafe-eval`. Meta (les 2 hôtes) + en-tête `vercel.json`. |
| **En-têtes HTTP**           | ✅ `vercel.json` : HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.                |
| **Secrets dans le code**    | ✅ Aucun (démo sans clé API ; aucun secret dans le bundle).                                                                         |
| **XSS**                     | ✅ Aucun `dangerouslySetInnerHTML` / `eval` / `innerHTML` ; React échappe par défaut ; CSP en filet.                                |
| **Injections**              | ✅ Pas de SQL côté client (pas de back-end branché). RLS testée en CI pour le futur back-end.                                       |
| **CSRF**                    | ➖ Sans objet (aucun cookie de session, aucune mutation serveur).                                                                   |
| **CORS**                    | ➖ Sans objet (aucun appel réseau externe).                                                                                         |
| **Fontes tierces**          | ✅ Auto-hébergées (@fontsource) → aucun appel Google Fonts (RGPD).                                                                  |
| **Dépendances vulnérables** | ⚠️ À industrialiser : brancher `pnpm audit` / Dependabot en CI (cf. §7).                                                            |

> ⚠️ **GitHub Pages ne pose pas d'en-têtes HTTP** : sur cette cible, `HSTS` et
> `X-Frame-Options` sont absents (la meta CSP reste, elle, active). Raison de
> plus pour faire de **Vercel** la production.

---

## 4. Robustesse (dégradation propre)

| Scénario                            | Comportement                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Erreur de rendu                     | `ErrorBoundary` : **jamais d'écran blanc**, message rassurant + « Recharger » + n° de version.                 |
| Erreur script / promesse non gérée  | Capturée par le collecteur (`diagnostics.ts`), consultable via `__PHENIX_DIAG__()`.                            |
| Rafraîchissement / onglet fermé     | Données en `localStorage` → **restaurées** au rechargement.                                                    |
| `localStorage` saturé               | Écriture protégée (`safeSetItem`) → bandeau d'avertissement, **rien n'est perdu pour la session**.             |
| Plus de réseau après chargement     | L'app fonctionne (100 % local). ⚠️ **Premier** chargement : réseau requis (pas de service worker sur la démo). |
| Perte du navigateur / de l'appareil | ❌ **Perte de données** (pas de sauvegarde serveur — cf. §5).                                                  |

---

## 5. Sauvegardes & reprise (DR)

### 5.1 Aujourd'hui (démo localStorage)

- **Aucune sauvegarde serveur possible.** Le seul filet est l'**export/import
  JSON** manuel présent dans l'app (App.tsx) : à faire faire régulièrement à
  l'utilisateur pilote, fichier stocké hors de l'appareil (Drive/iCloud).
- **Reconstruire le code** est immédiat : le dépôt Git est la source de vérité,
  `pnpm install --frozen-lockfile && pnpm build` redéploie à l'identique.

### 5.2 Cible (avec Supabase branché)

- **PITR (Point-in-Time Recovery)** Supabase activé + **exports `pg_dump`
  quotidiens** chiffrés vers un stockage tiers (autre région / autre fournisseur).
- Storage (photos/PDF) : réplication ou export périodique du bucket.
- **Tester la restauration** au moins une fois avant l'ouverture (une sauvegarde
  jamais restaurée n'est pas une sauvegarde).
- Migrations versionnées (`supabase/migrations`) → toute base se reconstruit.

---

## 6. Observabilité — « ça ne marche pas »

Sans demander de capture d'écran, demander à l'utilisateur d'ouvrir la console
du navigateur et de taper **`__PHENIX_DIAG__()`**, ou de copier
`localStorage['phenix-diag:last']`. On obtient :

- **version** (commit) + **date de build** ;
- **navigateur** (`userAgent`), **langue**, **en ligne ou non** ;
- **écran** (taille du viewport), **URL** ;
- **horodatage** + les **dernières erreurs** capturées (message, source, pile).

La version figure aussi **sur l'écran d'erreur** de l'ErrorBoundary et dans la
**bannière de démarrage** de la console.

> **Limite actuelle :** ces diagnostics sont **locaux** (pas de collecte
> centralisée). Pour « chaque bug remonté peut être compris et reproduit »
> côté exploitant, brancher **Sentry** (cf. §7) : `diagnostics.ts` en est déjà
> le point d'accroche (un seul `Sentry.captureException` à ajouter dans
> `recordError`).

---

## 7. À mettre en place avant les premiers clients (checklist exploitant)

Éléments **indispensables** — la plupart ne demandent pas de code :

1. **Back-end réel branché** (Supabase) : auth par utilisateur (conducteur /
   client / artisan), persistance partagée, RLS active. _C'est le bloquant n°1
   pour un usage multi-utilisateur — cf. verdict._
2. **DNS + domaine** : domaine PHÉNIX pointant sur Vercel, HTTPS auto (Let's
   Encrypt via Vercel). Choisir **une** cible de production.
3. **Monitoring d'erreurs** : Sentry (front) branché sur `diagnostics.ts`.
4. **Sauvegardes** : PITR Supabase + export quotidien chiffré hors-région, avec
   **restauration testée**.
5. **Supervision de disponibilité** : sonde uptime (UptimeRobot / Better Stack)
   - alerte.
6. **CI complète** : ajouter le **gate e2e Playwright** au workflow (aujourd'hui
   absent — cf. §8) + `pnpm audit` / Dependabot.
7. **Analytics respectueux** (optionnel, RGPD) : Plausible/Umami.
8. **Procédures** : rollback (§2.4), restauration (§5), contact d'astreinte,
   registre RGPD (données de chantier = données personnelles).

---

## 8. Outils recommandés (exploitation quotidienne)

| Besoin                | Outil recommandé                                  | Pourquoi                                                                |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Hébergement front     | **Vercel**                                        | Déjà configuré ; en-têtes, rollback immuable, CDN, HTTPS.               |
| Base + auth + storage | **Supabase**                                      | Déjà modélisé (migrations + RLS) ; Postgres managé + PITR.              |
| Monitoring d'erreurs  | **Sentry**                                        | Release = commit déjà injecté ; point d'accroche `diagnostics.ts` prêt. |
| Uptime / alertes      | **Better Stack** ou **UptimeRobot**               | Sonde + alerte e-mail/SMS simples.                                      |
| Analytics RGPD        | **Plausible** / **Umami**                         | Sans cookie, hébergeable en UE.                                         |
| CI/CD                 | **GitHub Actions** (déjà en place)                | Étendre au gate e2e + audit de dépendances.                             |
| Sauvegardes           | **PITR Supabase** + `pg_dump` chiffré hors-région | Reprise après suppression/erreur humaine.                               |

### Écart CI connu (à industrialiser)

Le **gate e2e Playwright** (93 suites) **n'est pas exécuté en CI** : la CI couvre
format/lint/types + migrations/RLS + tests gateway, mais pas les tests navigateur.
Cause : dans cet environnement, Playwright est résolu via un **chemin absolu**
(`/opt/node22/...`) et **n'est pas une dépendance du projet**. Pour l'exécuter en
CI, en faire une `devDependency` (`apps/demo`), résoudre le navigateur via
`npx playwright install --with-deps chromium`, et ajouter un job qui lance
`pnpm --filter @phenix360/demo test:e2e`.
