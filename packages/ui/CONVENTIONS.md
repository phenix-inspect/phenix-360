# Conventions @phenix360/ui — les tokens font foi

> **Règle n°1 (non négociable).** Aucun composant n'embarque de **couleur,
> ombre, rayon ou espacement** en dur. **Tout** passe par les tokens du Design
> System (via les classes Tailwind du preset) ou par les classes sémantiques.

Les tokens (`src/tokens/tokens.css` + `tokens.ts`) sont la **source de vérité
absolue**. Un composant ne décrit jamais une valeur premium ; il _référence_ un
rôle. Caler la marque = modifier les tokens, **jamais** les composants.

## Interdit dans `src/components/**`

| ✗ Interdit                                           | ✓ À la place                                    |
| ---------------------------------------------------- | ----------------------------------------------- |
| `#1c1915`, `rgb(…)`, `hsl(…)`                        | un token : `text-foreground`, `bg-primary`, …   |
| `bg-[#b5893c]`, `shadow-[0_1px_…]`, `rounded-[10px]` | `bg-primary`, `shadow-md`, `rounded-lg`         |
| `p-[13px]`, `h-[42px]`, `gap-[7px]`                  | l'échelle d'espacement : `p-3`, `h-10`, `gap-2` |
| `style={{ color: '…' }}` (valeurs en dur)            | classes utilitaires adossées aux tokens         |

> Les couleurs de marque ne sont accessibles **que** via les tokens : le preset
> remplace la palette Tailwind par défaut (`text-gray-500` n'existe pas). Les
> seules primitives non-marque tolérées sont `transparent`, `current`,
> `inherit` et le token `overlay`.

## Recommandé

- **Rôles sémantiques d'abord** : `bg-surface`, `text-muted-foreground`,
  `border-border`, `ring-ring`. Les échelles brutes (`gold-600`, `ink-200`) sont
  réservées aux nuances (états `hover`, accents) — toujours via token, jamais en
  dur.
- **Variantes via `cva`** + fusion via `cn()` (`src/lib/cn.ts`).
- **Sobriété premium** : pas de glassmorphism, pas d'effet gratuit. Le mouvement
  reste discret et passe par les tokens (`duration-base`, `ease-out`).

## Application automatique

`pnpm --filter @phenix360/ui lint` exécute `scripts/check-tokens.mjs`, qui
échoue la CI si un composant enfreint la règle n°1 (hex/rgb/hsl, valeurs
arbitraires `…-[…]`, styles inline). Le garde-fou ne scanne que
`src/components/**` ; les fichiers de tokens en sont, par nature, exclus.
