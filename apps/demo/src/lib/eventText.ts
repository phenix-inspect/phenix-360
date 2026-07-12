import {
  PROJECT_STEP_LABEL,
  describeDecisionEvent,
  reserveStatut,
  type CommCanal,
  type Event,
} from '@phenix360/core';

/** Première lettre en capitale (le contexte métier saisi peut être en minuscule). */
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const COMM_CANAL_LABEL: Record<CommCanal, string> = {
  appel: 'Appel',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
  itineraire: 'Itinéraire',
};

/**
 * Titre lisible d'un événement (présentation — dérivé du contenu typé). Forme
 * « Type · contexte métier » : l'œil identifie d'abord la NATURE de l'entrée,
 * puis son ancrage chantier (étape, pièce, choix). Le détail vit dans la
 * description, jamais dans le titre.
 */
export function eventTitle(e: Event): string {
  switch (e.type) {
    case 'compte_rendu':
      if (e.content.prereception) return 'Pré-réception';
      return e.content.etapeConfirmee
        ? `Compte rendu · ${PROJECT_STEP_LABEL[e.content.etapeConfirmee]}`
        : 'Compte rendu';
    case 'photo':
      return e.content.piece ? `Photo · ${e.content.piece}` : 'Photo';
    case 'document':
      return e.content.libelle;
    case 'demande':
      return e.content.destinataire === 'client'
        ? 'Décision attendue du client'
        : e.content.destinataire === 'conducteur'
          ? 'Signalement artisan'
          : 'Question du client';
    case 'decision':
      return `Décision client · ${cap(e.content.categorie)}`;
    case 'reserve':
      return `Réserve n°${e.content.numero}`;
    case 'levee':
      return `Réserve n°${e.content.reserveNumero} levée`;
    case 'action':
      return e.content.libelle;
    case 'communication':
      return `${COMM_CANAL_LABEL[e.content.canal]} · ${e.content.contactNom}`;
  }
}

/** Texte d'accompagnement d'un événement (présentation). */
export function eventDescription(e: Event): string | undefined {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.texte;
    case 'demande': {
      const base = e.content.resolution
        ? `${e.content.question} → ${e.content.resolution.texte}`
        : e.content.question;
      return e.content.source?.kind === 'fil' ? `${base} · depuis une photo annotée du Fil` : base;
    }
    case 'decision':
      return describeDecisionEvent(e.content).description;
    case 'reserve': {
      const c = e.content;
      const meta = [
        c.responsable ? `Responsable : ${c.responsable}` : null,
        c.echeance ? `échéance ${c.echeance}` : null,
        c.source?.kind === 'fil' ? 'depuis une photo annotée du Fil' : null,
      ].filter(Boolean);
      return meta.length > 0 ? `${c.libelle} · ${meta.join(' · ')}` : c.libelle;
    }
    case 'levee': {
      const parts = [e.content.note, e.content.preuve ? 'photo de preuve jointe' : null].filter(
        Boolean,
      );
      return parts.length > 0 ? parts.join(' · ') : 'Réserve levée et tracée au journal.';
    }
    case 'action': {
      const c = e.content;
      const meta = [
        c.responsable ? `Responsable : ${c.responsable}` : null,
        c.echeance ? `échéance ${c.echeance}` : null,
        c.priorite && c.priorite !== 'normale' ? `priorité ${c.priorite}` : null,
      ].filter(Boolean);
      return meta.length > 0 ? `${c.libelle} · ${meta.join(' · ')}` : c.libelle;
    }
    case 'photo':
      // La légende porte le détail : elle passe du titre à la description, pour
      // que le titre reste « Photo · Pièce » (lecture immédiate) sans rien perdre.
      return e.content.legende;
    case 'document':
      return undefined;
    case 'communication': {
      const parts = [e.content.role, e.content.sujet].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : undefined;
    }
  }
}

export interface JournalStatut {
  label: string;
  variant: 'warning' | 'success';
}

/**
 * Badge d'état d'une ligne de journal — un seul par ligne, et seulement s'il
 * PORTE une information. « Publié » n'est jamais affiché : tout est publié par
 * défaut, le badge serait du bruit et écraserait les états qui comptent. Casse et
 * sémantique unifiées entre tous les types : à traiter = ambre (`warning`), fait
 * = vert (`success`). VISION Art. 11 (simplicité).
 */
export function journalStatut(e: Event, events: Event[]): JournalStatut | null {
  if (e.state === 'brouillon') return { label: 'Brouillon', variant: 'warning' };
  switch (e.type) {
    case 'reserve':
      return reserveStatut(e, events) === 'levee'
        ? { label: 'Levée', variant: 'success' }
        : { label: 'Ouverte', variant: 'warning' };
    case 'levee':
      return { label: 'Levée', variant: 'success' };
    case 'demande':
      if (e.state === 'ouverte') return { label: 'En attente', variant: 'warning' };
      if (e.state === 'traitee') return { label: 'Traitée', variant: 'success' };
      return null;
    default:
      // compte_rendu / photo / document / decision publiés : aucun badge.
      return null;
  }
}
