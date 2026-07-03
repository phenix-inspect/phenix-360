/**
 * PHÉNIX 360 — Contact (annuaire du conducteur)
 * ---------------------------------------------------------------------------
 * Un contact est une PERSONNE réutilisable entre chantiers : client, artisan,
 * fournisseur, architecte, bureau de contrôle, assureur, investisseur… Le
 * conducteur ne ressaisit jamais un contact (VISION Art. 6). Depuis un contact,
 * PHÉNIX lance une communication (appel / SMS / WhatsApp / mail / itinéraire) —
 * l'app native s'ouvre, PHÉNIX garde la trace (VISION Art. 1, 2, 7).
 */
import type { IsoDateTime } from './ids.js';

export const CONTACT_ROLES = [
  'client',
  'artisan',
  'fournisseur',
  'architecte',
  'bureau_controle',
  'assureur',
  'investisseur',
  'autre',
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  client: 'Client',
  artisan: 'Artisan',
  fournisseur: 'Fournisseur',
  architecte: 'Architecte',
  bureau_controle: 'Bureau de contrôle',
  assureur: 'Assureur',
  investisseur: 'Investisseur',
  autre: 'Autre',
};

export interface Contact {
  id: string;
  nom: string;
  societe?: string;
  role: ContactRole;
  phone?: string;
  email?: string;
  /** Numéro WhatsApp s'il diffère du téléphone. */
  whatsapp?: string;
  address?: string;
  notes?: string;
  /** Chantiers liés à ce contact (ids de projet). */
  projectIds: string[];
  createdAt: IsoDateTime;
}
