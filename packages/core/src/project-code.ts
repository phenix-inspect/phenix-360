/**
 * PHÉNIX 360 — Code chantier `AA-VV-NNN`
 * ---------------------------------------------------------------------------
 * Identifiant unique, définitif et lisible d'un chantier, généré AUTOMATIQUEMENT
 * à sa création (aucune saisie manuelle). Il devient la référence commune à tout
 * l'écosystème (fiche, listes, PDF, Drive, Tiime, e-mails…).
 *
 *   AA = année de création sur 2 chiffres (ex. « 26 »)
 *   VV = code ville sur 2 lettres, dérivé de la ville du chantier
 *   NNN = compteur ANNUEL et GLOBAL (toutes villes), 3 chiffres, repart à 001
 *         chaque nouvelle année
 *
 * Ex. 26-LY-001, 26-PA-002, 26-LY-003…
 *
 * Le code est DÉFINITIF : une fois attribué, il ne change jamais, même si le
 * chantier change de nom, d'adresse ou de ville (aucun `ProjectPatch` ne le
 * touche). Volontairement simple et robuste — aucune usine à gaz.
 */

/** Forme d'un code chantier valide. */
export const PROJECT_CODE_RE = /^(\d{2})-([A-Z]{2})-(\d{3})$/;

/** Retire les accents/diacritiques (É → E) pour un code ASCII stable. */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Ville d'une adresse française : le texte APRÈS le code postal (5 chiffres).
 * « 8 rue Vauban, 69006 Lyon » → « Lyon ». À défaut de code postal, on prend le
 * dernier segment séparé par une virgule ; à défaut, la chaîne entière.
 */
export function cityFromAddress(address: string | null | undefined): string {
  const a = (address ?? '').trim();
  if (!a) return '';
  const cp = a.match(/\b\d{5}\b\s*(.+)$/);
  if (cp && cp[1]) return cp[1].trim();
  const parts = a.split(',');
  return (parts[parts.length - 1] ?? '').trim();
}

/**
 * Code ville VV : 2 lettres MAJUSCULES à partir du nom de la ville.
 * -------------------------------------------------------------------------
 * RÈGLE (unique et prévisible) : les 2 PREMIÈRES LETTRES, accents retirés,
 * caractères non alphabétiques ignorés. Ex. Lyon → LY, Paris → PA, Nancy → NA,
 * Metz → ME. Ville vide ou sans lettre → « XX ».
 *
 * Le VV n'est qu'un REPÈRE lisible : l'unicité du code vient du compteur NNN,
 * donc deux villes peuvent partager un VV sans conséquence. Pour changer la
 * convention (ex. « 1re + dernière lettre »), il suffit de modifier CETTE
 * fonction — rien d'autre dans l'application n'en dépend.
 */
export function cityCode(city: string | null | undefined): string {
  const letters = stripDiacritics((city ?? '').toUpperCase()).replace(/[^A-Z]/g, '');
  if (letters.length === 0) return 'XX';
  return (letters + 'X').slice(0, 2);
}

/** Année sur 2 chiffres d'une date ISO (« 2026-… » → « 26 »). */
export function codeYear(createdAtIso: string): string {
  return createdAtIso.slice(2, 4);
}

/**
 * Prochain numéro de séquence (NNN, en nombre) pour une année donnée, à partir
 * des codes DÉJÀ attribués. Compteur GLOBAL : on ignore la ville, on ne regarde
 * que l'année. On prend `max(NNN de l'année) + 1` (jamais de doublon tant qu'un
 * code existe), et 1 si l'année n'a encore aucun chantier.
 */
export function nextProjectCodeSeq(existingCodes: readonly string[], year2: string): number {
  let max = 0;
  for (const code of existingCodes) {
    const m = PROJECT_CODE_RE.exec(code ?? '');
    if (m && m[1] === year2) {
      const n = Number(m[3]);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

/**
 * Génère le code chantier définitif `AA-VV-NNN`. `existingCodes` = les codes des
 * chantiers déjà créés (pour le compteur annuel global). Pure et déterministe.
 */
export function generateProjectCode(input: {
  address?: string | null;
  createdAt: string;
  existingCodes: readonly string[];
}): string {
  const yy = codeYear(input.createdAt);
  const vv = cityCode(cityFromAddress(input.address));
  const seq = nextProjectCodeSeq(input.existingCodes, yy);
  return `${yy}-${vv}-${String(seq).padStart(3, '0')}`;
}

/** Un code est-il présent et conforme ? (Sinon, il faut l'attribuer.) */
export function hasValidProjectCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && PROJECT_CODE_RE.test(code);
}

/**
 * BACKFILL déterministe : attribue un code à tout chantier qui n'en a pas encore
 * (données antérieures à la fonctionnalité, ou seed), dans l'ordre chronologique
 * de création — les codes DÉJÀ valides sont préservés tels quels (définitifs).
 * Idempotent : rappelée sur une liste déjà codée, elle ne change rien. Renvoie
 * une NOUVELLE liste (mêmes objets si déjà codés).
 */
export function ensureProjectCodes<
  T extends { code?: string; address?: string; createdAt: string },
>(projects: readonly T[]): T[] {
  const existing = projects.map((p) => p.code ?? '').filter(hasValidProjectCode);
  if (existing.length === projects.length) return [...projects];
  const codes = [...existing];
  // On code les manquants du plus ancien au plus récent (compteur chronologique).
  const order = projects
    .map((p, i) => ({ i, createdAt: p.createdAt }))
    .filter((x) => !hasValidProjectCode(projects[x.i]?.code))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const assigned = new Map<number, string>();
  for (const { i } of order) {
    const p = projects[i]!;
    const code = generateProjectCode({
      address: p.address ?? null,
      createdAt: p.createdAt,
      existingCodes: codes,
    });
    codes.push(code);
    assigned.set(i, code);
  }
  return projects.map((p, i) => (assigned.has(i) ? { ...p, code: assigned.get(i)! } : p));
}
