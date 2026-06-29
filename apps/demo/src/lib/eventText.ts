import { PROJECT_STEP_LABEL, describeDecisionEvent, type Event } from '@phenix360/core';

/** Titre lisible d'un événement (présentation — dérivé du contenu typé). */
export function eventTitle(e: Event): string {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.etapeConfirmee
        ? PROJECT_STEP_LABEL[e.content.etapeConfirmee]
        : 'Compte rendu';
    case 'photo':
      return e.content.legende ?? 'Photo du chantier';
    case 'document':
      return e.content.libelle;
    case 'demande':
      return e.content.destinataire === 'client' ? 'Une décision vous attend' : 'Demande';
    case 'decision':
      return describeDecisionEvent(e.content).title;
  }
}

/** Texte d'accompagnement d'un événement (présentation). */
export function eventDescription(e: Event): string | undefined {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.texte;
    case 'demande':
      return e.content.resolution
        ? `${e.content.question} → ${e.content.resolution.texte}`
        : e.content.question;
    case 'decision':
      return describeDecisionEvent(e.content).description;
    case 'photo':
      return undefined;
    case 'document':
      return undefined;
  }
}
