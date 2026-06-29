/**
 * PHÉNIX 360 — Calendrier métier (référence unique des échéances)
 * ===========================================================================
 * Tous les calculs de planning (étapes, livraisons, commandes, décisions
 * client, échéances) doivent reposer sur un VRAI calendrier métier, et non sur
 * des jours calendaires bruts. Ce module fournit cette référence :
 *   • jours travaillés (lundi → vendredi) ;
 *   • week-ends exclus ;
 *   • jours fériés français (fixes + mobiles, calés sur Pâques) ;
 *   • ponts, lorsque l'entreprise les pratique ;
 *   • périodes de fermeture de l'entreprise (congés).
 *
 * Les DURÉES MÉTIER sont exprimées en jours ouvrés. Les temps de SÉCHAGE, eux,
 * sont physiques et incompressibles : ils s'écoulent en jours calendaires
 * (le béton sèche aussi le week-end). Fonctions PURES, sans état partagé.
 */

/**
 * Réglages d'entreprise du calendrier. Ce ne sont PAS des hypothèses imposées :
 * chaque entreprise les configure (à terme via un écran de réglages).
 *   • bridges  : l'entreprise pratique-t-elle les ponts (jour isolé entre un
 *                férié et le week-end) ?
 *   • closures : fermetures exceptionnelles et périodes de congés (bornes ISO
 *                incluses).
 */
export interface BusinessCalendar {
  bridges: boolean;
  closures: { from: string; to: string }[];
}

/**
 * Par défaut : lundi → vendredi + jours fériés français. Les ponts ne sont PAS
 * activés par défaut (configuration entreprise) ; aucune fermeture supposée.
 */
export const DEFAULT_CALENDAR: BusinessCalendar = { bridges: false, closures: [] };

/* --------------------------- utilitaires de dates -------------------------- */

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00`);

const fromDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Décale une date ISO de `n` jours calendaires (n peut être négatif). */
export const addCalendarDays = (iso: string, n: number): string => {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return fromDate(d);
};

/* ------------------------------ jours fériés ------------------------------- */

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const holidayCache = new Map<number, Set<string>>();

/** Jours fériés français (fixes + mobiles) pour une année donnée. */
export function frenchHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const set = new Set<string>([
    `${year}-01-01`, // Jour de l'An
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ]);
  const easter = easterSunday(year);
  set.add(addCalendarDays(easter, 1)); // Lundi de Pâques
  set.add(addCalendarDays(easter, 39)); // Ascension
  set.add(addCalendarDays(easter, 50)); // Lundi de Pentecôte
  holidayCache.set(year, set);
  return set;
}

const isHoliday = (iso: string): boolean => frenchHolidays(toDate(iso).getFullYear()).has(iso);

/**
 * Pont « classique » : férié un mardi → le lundi est chômé ; férié un jeudi →
 * le vendredi est chômé. Activé seulement si l'entreprise pratique les ponts.
 */
function isBridge(iso: string, cal: BusinessCalendar): boolean {
  if (!cal.bridges) return false;
  const wd = toDate(iso).getDay();
  if (wd === 1) return isHoliday(addCalendarDays(iso, 1)); // lundi avant un mardi férié
  if (wd === 5) return isHoliday(addCalendarDays(iso, -1)); // vendredi après un jeudi férié
  return false;
}

const isClosed = (iso: string, cal: BusinessCalendar): boolean =>
  cal.closures.some((c) => iso >= c.from && iso <= c.to);

/* --------------------------- API jours ouvrés ------------------------------ */

/** Un jour ouvré : ni week-end, ni férié, ni pont, ni fermeture. */
export function isWorkingDay(iso: string, cal: BusinessCalendar = DEFAULT_CALENDAR): boolean {
  const wd = toDate(iso).getDay();
  if (wd === 0 || wd === 6) return false;
  return !isHoliday(iso) && !isBridge(iso, cal) && !isClosed(iso, cal);
}

/** Premier jour ouvré à partir de `iso` (inclus). */
export function nextWorkingDay(iso: string, cal: BusinessCalendar = DEFAULT_CALENDAR): string {
  let d = iso;
  while (!isWorkingDay(d, cal)) d = addCalendarDays(d, 1);
  return d;
}

/** Dernier jour ouvré jusqu'à `iso` (inclus) — pour caler une échéance « avant ». */
export function previousWorkingDay(iso: string, cal: BusinessCalendar = DEFAULT_CALENDAR): string {
  let d = iso;
  while (!isWorkingDay(d, cal)) d = addCalendarDays(d, -1);
  return d;
}

/**
 * Date du `workdays`-ième jour ouvré, en comptant le premier jour ouvré à
 * partir de `startIso` comme le jour 1. `workdays >= 1`.
 */
export function nthWorkingDay(
  startIso: string,
  workdays: number,
  cal: BusinessCalendar = DEFAULT_CALENDAR,
): string {
  let d = nextWorkingDay(startIso, cal);
  let count = 1;
  while (count < workdays) {
    d = nextWorkingDay(addCalendarDays(d, 1), cal);
    count += 1;
  }
  return d;
}

/** Conversion approximative jours ouvrés → jours calendaires (week-ends inclus). */
export const businessToCalendarDays = (workdays: number): number =>
  workdays + Math.floor(workdays / 5) * 2;
