/**
 * Messages pré-remplis proposés par PHÉNIX selon le contexte (VISION Art. 7 :
 * PHÉNIX propose, le conducteur ajuste et envoie). Déterministe, aucune IA. Le
 * conducteur reste maître du texte final avant d'ouvrir l'app native.
 */
export const COMM_TEMPLATES = [
  { kind: 'relance_artisan', label: 'Relance artisan' },
  { kind: 'envoi_cr', label: 'Envoi compte rendu' },
  { kind: 'demande_document', label: 'Demande de document' },
  { kind: 'confirmation_livraison', label: 'Confirmation de livraison' },
  { kind: 'rappel_intervention', label: 'Rappel d’intervention' },
  { kind: 'demande_disponibilite', label: 'Demande de disponibilité' },
  { kind: 'message_client', label: 'Message client rassurant' },
] as const;

export type CommTemplateKind = (typeof COMM_TEMPLATES)[number]['kind'];

export interface CommTemplateResult {
  subject?: string;
  body: string;
  /** Motif tracé au Journal (« relance intervention »). */
  sujet: string;
}

export function buildCommMessage(
  kind: CommTemplateKind,
  ctx: { contactNom?: string; chantier?: string },
): CommTemplateResult {
  const prenom = ctx.contactNom ? ctx.contactNom.split(/[\s—-]/)[0] : '';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const surChantier = ctx.chantier ? ` du chantier « ${ctx.chantier} »` : '';
  const signature = '\n\nMickaël — PHÉNIX';

  switch (kind) {
    case 'relance_artisan':
      return {
        sujet: 'relance artisan',
        subject: ctx.chantier ? `Chantier ${ctx.chantier}` : 'Chantier',
        body: `${bonjour}\nJe reviens vers vous concernant votre intervention${surChantier}. Pouvez-vous me confirmer votre passage et la date ? Merci.${signature}`,
      };
    case 'envoi_cr':
      return {
        sujet: 'envoi compte rendu',
        subject: ctx.chantier ? `Compte rendu — ${ctx.chantier}` : 'Compte rendu',
        body: `${bonjour}\nVoici le compte rendu${surChantier}. Je reste à votre disposition.${signature}`,
      };
    case 'demande_document':
      return {
        sujet: 'demande de document',
        subject: ctx.chantier
          ? `Document à transmettre — ${ctx.chantier}`
          : 'Document à transmettre',
        body: `${bonjour}\nPour avancer${surChantier}, pourriez-vous me transmettre le document demandé ? Merci d'avance.${signature}`,
      };
    case 'confirmation_livraison':
      return {
        sujet: 'confirmation de livraison',
        subject: ctx.chantier ? `Livraison — ${ctx.chantier}` : 'Livraison',
        body: `${bonjour}\nPouvez-vous me confirmer la date de livraison${surChantier} ? Merci.${signature}`,
      };
    case 'rappel_intervention':
      return {
        sujet: 'rappel intervention',
        subject: ctx.chantier ? `Rappel intervention — ${ctx.chantier}` : 'Rappel intervention',
        body: `${bonjour}\nPetit rappel pour votre intervention${surChantier}. Merci de me prévenir en cas d'imprévu.${signature}`,
      };
    case 'demande_disponibilite':
      return {
        sujet: 'demande de disponibilité',
        subject: ctx.chantier ? `Disponibilité — ${ctx.chantier}` : 'Disponibilité',
        body: `${bonjour}\nQuelles sont vos disponibilités cette semaine pour intervenir${surChantier} ? Merci.${signature}`,
      };
    case 'message_client':
      return {
        sujet: 'message client',
        subject: ctx.chantier ? `Votre chantier ${ctx.chantier}` : 'Votre chantier',
        body: `${bonjour}\nUn point rapide${surChantier} : tout avance comme prévu, je vous tiens informé à chaque étape. N'hésitez pas si vous avez la moindre question.${signature}`,
      };
  }
}
