/**
 * PHÉNIX 360 — Gestion du chantier : la MISSION
 * ===========================================================================
 * Le conducteur ne « crée pas un document ». Il choisit une mission (pourquoi il
 * est là), il montre et il parle. Chaque mission proposée possède désormais son
 * FLUX DÉDIÉ (Compte rendu de chantier, Pré-réception, Réception) — il n'existe
 * plus de flux générique « capture → prépare → partage ». Ce module ne porte donc
 * que le CATALOGUE des missions (le menu « Pourquoi êtes-vous là ? ») ; la logique
 * de chaque mission vit dans son écran et son sélecteur de store dédiés.
 */
import type { MomentType } from './fil.js';

/**
 * Les missions de la V1 « Gestion du chantier ». Toutes sont des MomentType.
 * Décision produit (09/07/2026) : « Visite » et « Réunion » ont FUSIONNÉ en un
 * unique « Compte rendu de chantier » (une visite improvisée et une réunion
 * programmée produisent le même résultat — le conducteur ne choisit plus le bon
 * bouton, il raconte simplement ce qu'il vient de constater).
 */
export type MissionKind =
  'compte_rendu' | 'livraison' | 'prereception' | 'reception' | 'sav' | 'note';

export interface MissionDef {
  kind: MissionKind;
  label: string;
  description: string;
}

/**
 * Catalogue des missions PROPOSÉES dans « Nouvelle mission » (l'écran d'entrée
 * « Pourquoi êtes-vous là ? »). On garde ce menu extrêmement simple : uniquement
 * les missions réellement utilisées au quotidien, et chacune dispose de son flux
 * dédié. Une mission ne figure ici QUE si un écran sait la dérouler.
 */
export const MISSIONS: MissionDef[] = [
  {
    kind: 'compte_rendu',
    label: 'Compte rendu de chantier',
    description: 'Photographier, commenter, diffuser — point par point',
  },
  {
    kind: 'prereception',
    label: 'Pré-réception',
    description: 'Vérifier l’exécution du contrat signé',
  },
  { kind: 'reception', label: 'Réception', description: 'Clôturer le chantier proprement' },
];
