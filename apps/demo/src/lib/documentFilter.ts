import type { Event } from '@phenix360/core';

/**
 * Filtre par TYPE des documents (onglet Documents — conducteur ET espace client,
 * comportement identique). Aucune donnée n'est modifiée : on DÉRIVE une famille de
 * chaque document (catégorie + libellé, ou nature du compte rendu) et on filtre la
 * liste affichée. Pas de nouveau concept — juste une lecture.
 */
export type DocFamily =
  | 'devis'
  | 'avenant'
  | 'acompte'
  | 'facture'
  | 'plan'
  | 'compte_rendu'
  | 'visite'
  | 'pre_reception'
  | 'reception'
  | 'reserve'
  | 'garantie'
  | 'doe'
  | 'autre';

/** Valeur sentinelle du filtre « tout afficher ». */
export type DocFilter = 'tous' | DocFamily;

export const DOC_FAMILY_LABEL: Record<DocFamily, string> = {
  devis: 'Devis',
  avenant: 'Avenants',
  acompte: 'Acomptes',
  facture: 'Factures',
  plan: 'Plans',
  compte_rendu: 'Comptes rendus',
  visite: 'Visites chantier',
  pre_reception: 'Pré-réceptions',
  reception: 'Réceptions',
  reserve: 'Réserves',
  garantie: 'Garanties',
  doe: 'DOE',
  autre: 'Autres',
};

/** Ordre d'affichage des puces de filtre (chronologie d'un chantier). */
export const DOC_FAMILY_ORDER: DocFamily[] = [
  'devis',
  'avenant',
  'acompte',
  'facture',
  'plan',
  'compte_rendu',
  'visite',
  'pre_reception',
  'reception',
  'reserve',
  'garantie',
  'doe',
  'autre',
];

/** Famille d'un compte rendu — sa NATURE structurée prime (jamais le texte libre). */
function compteRenduFamily(event: Extract<Event, { type: 'compte_rendu' }>): DocFamily {
  const hay = `${event.content.missionKind ?? ''} ${event.content.docTitre ?? ''}`.toLowerCase();
  if (/pr[ée]-?r[ée]ception/.test(hay)) return 'pre_reception';
  if (/r[ée]ception/.test(hay)) return 'reception';
  if (/visite/.test(hay)) return 'visite';
  return 'compte_rendu';
}

/**
 * Famille d'un document — déduite de sa catégorie ET de son libellé (robuste aux
 * documents ajoutés sans catégorie via « Nouvelle mission »). L'ordre des tests
 * compte : la pré-réception avant la réception, la facture avant l'acompte, etc.
 */
export function documentFamily(event: Event): DocFamily {
  if (event.type === 'compte_rendu') return compteRenduFamily(event);
  if (event.type !== 'document') return 'autre';
  const hay = `${event.content.categorie ?? ''} ${event.content.libelle ?? ''}`.toLowerCase();
  if (/avenant/.test(hay)) return 'avenant';
  if (/devis/.test(hay)) return 'devis';
  if (/acompte|arrhes/.test(hay)) return 'acompte';
  if (/facture/.test(hay)) return 'facture';
  if (/plan/.test(hay)) return 'plan';
  if (/garantie/.test(hay)) return 'garantie';
  if (/\bdoe\b|dossier des ouvrages/.test(hay)) return 'doe';
  if (/pr[ée]-?r[ée]ception/.test(hay)) return 'pre_reception';
  if (/r[ée]ception/.test(hay)) return 'reception';
  if (/visite/.test(hay)) return 'visite';
  if (/r[ée]serve/.test(hay)) return 'reserve';
  return 'autre';
}

/** Familles réellement présentes dans un jeu de documents (dans l'ordre canonique). */
export function presentFamilies(events: Event[]): DocFamily[] {
  const present = new Set(events.map(documentFamily));
  return DOC_FAMILY_ORDER.filter((f) => present.has(f));
}

/** Filtre PUR : ne modifie jamais la source, renvoie une nouvelle liste. */
export function filterDocuments(events: Event[], filter: DocFilter): Event[] {
  if (filter === 'tous') return events;
  return events.filter((e) => documentFamily(e) === filter);
}
