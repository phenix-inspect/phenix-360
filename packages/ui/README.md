# @phenix360/ui — Design System

Socle visuel partagé par les deux apps (client & compagnon). **Thème clair,
noir & or, premium.** Pas de mascotte, pas de glassmorphism — l'UX prime
(ADR-004 §0/§2.2).

> **Étape 3 du Sprint 0 — faite : tokens + fontes.** Les primitives shadcn/ui
> re-skinnées viendront ensuite (réexportées depuis `src/index.ts`).

## Contenu

```
packages/ui/
├── tailwind-preset.ts        Preset Tailwind (mappe les tokens sur le thème)
└── src/
    ├── index.ts              Barrel du package
    └── tokens/
        ├── tokens.css        ⭐ Source de vérité runtime (variables CSS)
        ├── tokens.ts         Tokens typés (accès JS + alimente le preset)
        ├── fonts.css         Chargement des 3 fontes (auto-hébergées)
        └── index.ts          Barrel des tokens
```

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
