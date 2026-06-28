# @phenix360/ui — Design System

Socle visuel partagé par les deux apps (client & compagnon). **Thème clair,
noir & or, premium.** Pas de mascotte, pas de glassmorphism — l'UX prime
(ADR-004 §0/§2.2).

> **Sprint 0 — faits :** tokens + fontes (étape 3) puis primitives shadcn/ui
> re-skinnées, réexportées depuis `src/index.ts`.

## Règle absolue — les tokens font foi

Aucun composant n'embarque de **couleur, ombre, rayon ou espacement** en dur :
tout passe par les tokens (classes du preset) ou les classes sémantiques. La
règle complète et son garde-fou automatique (`pnpm --filter @phenix360/ui lint`)
sont décrits dans **[`CONVENTIONS.md`](./CONVENTIONS.md)**.

## Contenu

```
packages/ui/
├── tailwind-preset.ts        Preset Tailwind (mappe les tokens sur le thème)
├── CONVENTIONS.md            Règle « tokens = source de vérité » + garde-fou
├── scripts/check-tokens.mjs  Garde-fou lint (valeurs premium en dur interdites)
└── src/
    ├── index.ts              Barrel du package (tokens + cn + primitives)
    ├── lib/cn.ts             Fusion de classes (clsx + tailwind-merge)
    ├── components/           Primitives re-skinnées (sobres, premium)
    └── tokens/
        ├── tokens.css        ⭐ Source de vérité runtime (variables CSS)
        ├── tokens.ts         Tokens typés (accès JS + alimente le preset)
        ├── fonts.css         Chargement des 3 fontes (auto-hébergées)
        └── index.ts          Barrel des tokens
```

## Primitives

Construites sur Radix UI + `cva`, icônes `lucide-react`, mouvement discret via
`tailwindcss-animate`. Toutes adossées aux tokens (thème clair, noir & or).

| Primitive                                            | Rôle                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `Button`                                             | action ; l'or réservé à l'action principale (`asChild` supporté) |
| `Card` (+ `Header/Title/Description/Content/Footer`) | surface élevée sobre                                             |
| `Badge`                                              | étiquette d'état (cycle des demandes, statuts)                   |
| `Tabs`                                               | navigation segmentée                                             |
| `Dialog`                                             | modale (fondu + léger zoom, backdrop `overlay`)                  |
| `Input` / `Textarea`                                 | saisie                                                           |
| `Timeline` / `ActivityItem`                          | **brique du journal d'événements** (voir ci-dessous)             |

### `ActivityItem` — brique du journal

Pensé pour mapper 1:1 une ligne `event` (ADR-002/004 §4), pas un simple visuel.
Props : `type` (`compte_rendu`/`photo`/`document`/`demande` → icône par défaut),
`title`, `description`, `date` (`created_at`), `author` + `authorRole`,
`visibility` (`interne` affiche un repère « masqué au client »), `marker`
(override) et `media` (zone extensible pour vignettes photo / pièce jointe). Les
types sont locaux pour l'instant ; ils seront remplacés par ceux de
`@phenix360/core`.

## Les tokens

Un **fichier unique** de tokens (ADR-004 §2.2), en deux faces cohérentes :

- **`tokens.css`** — _source de vérité_. Variables CSS sur `:root` : palette
  brute (échelles `gold` / `ink` / `paper` + fonctionnel), rôles sémantiques
  (`--background`, `--primary`, … compatibles shadcn/ui), rayons, ombres,
  mouvement, fontes. **Pour caler sur le handoff Design System §4, on ne touche
  qu'ici.**
- **`tokens.ts`** — pendant typé. Les couleurs/rayons/ombres/durées y
  **référencent les variables CSS** (`var(--…)`) : aucun littéral dupliqué, donc
  aucune dérive. Les échelles statiques (typo, espacement, z-index, breakpoints)
  y vivent et alimentent Tailwind.

### Fontes (ADR-004 §2.2)

| Famille                   | Rôle                                    | Variable       |
| ------------------------- | --------------------------------------- | -------------- |
| **Newsreader** (serif)    | émotion, éditorial — univers client     | `--font-serif` |
| **Hanken Grotesk** (sans) | UI dense, corps — univers compagnon     | `--font-sans`  |
| **JetBrains Mono** (mono) | donnée technique (montants, références) | `--font-mono`  |

Auto-hébergées via `@fontsource` (fontes variables) — **pas de CDN Google
Fonts** : RGPD (aucun appel tiers) et portabilité (aucune dépendance réseau),
conformes ADR-003/004.

## Utilisation (dans une app)

```ts
// tailwind.config.ts
import preset from '@phenix360/ui/tailwind-preset';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
```

```ts
// point d'entrée de l'app (main.tsx), une seule fois
import '@phenix360/ui/fonts.css';
import '@phenix360/ui/tokens.css';
```

```tsx
// dans les composants : utilitaires Tailwind adossés aux tokens
<button className="bg-primary text-primary-foreground rounded-lg shadow-md font-sans">
  Publier
</button>;

// ou accès programmatique
import { tokens } from '@phenix360/ui/tokens';
```
