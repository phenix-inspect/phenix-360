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
      return e.content.destinataire === 'client'
        ? 'Une décision vous attend'
        : e.content.destinataire === 'conducteur'
          ? 'Signalement artisan'
          : 'Demande';
    case 'decision':
      return describeDecisionEvent(e.content).title;
    case 'reserve':
      return `Réserve n°${e.content.numero}`;
    case 'levee':
      return `Réserve n°${e.content.reserveNumero} levée`;
    case 'action':
      return e.content.libelle;
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
      return undefined;
    case 'document':
      return undefined;
  }
}
