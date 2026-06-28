/**
 * PHÉNIX 360 — Données de démonstration (FIXTURE, pas de logique métier)
 * ---------------------------------------------------------------------------
 * Raconte un chantier déjà vivant (« Appartement Lyon 6e ») pour que le projet
 * soit immédiatement le héros : comptes rendus, photos légendées, un document,
 * une décision en attente (alimente le bandeau), une demande client→équipe à
 * traiter, une note interne. Pur jeu de données typé — `currentStep` est calculé
 * par le sélecteur core (aucune duplication de logique).
 */
import {
  attachmentId,
  currentStep,
  eventId,
  projectId,
  projectMemberId,
  userId,
  type BackendState,
  type Event,
  type EventActor,
  type Project,
  type ProjectMember,
} from '@phenix360/core';

export interface DemoSeed {
  state: BackendState;
  people: Record<string, string>;
  activeProjectId: string;
}

const uuid = (): string => globalThis.crypto.randomUUID();
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

export function buildDemoSeed(): DemoSeed {
  const pid = projectId(uuid());
  const compaId = userId(uuid());
  const clientId = userId(uuid());
  const compagnon: EventActor = { userId: compaId, role: 'compagnon', displayName: 'Mickaël' };
  const cliente: EventActor = { userId: clientId, role: 'client', displayName: 'Mme Martin' };

  const photo = (n: number, actor: EventActor, legende: string, piece: string): Event => ({
    id: eventId(uuid()),
    projectId: pid,
    type: 'photo',
    actor,
    visibility: 'client',
    state: 'publie',
    captureId: null,
    createdAt: daysAgo(n),
    publishedBy: actor.userId,
    publishedAt: daysAgo(n),
    content: {
      attachment: {
        id: attachmentId(uuid()),
        kind: 'photo',
        bucket: 'demo',
        storagePath: `${pid}/${uuid()}.jpg`,
        mimeType: 'image/jpeg',
        width: 1600,
        height: 1200,
        createdAt: daysAgo(n),
      },
      legende,
      piece,
    },
  });

  const compteRendu = (n: number, texte: string): Event => ({
    id: eventId(uuid()),
    projectId: pid,
    type: 'compte_rendu',
    actor: compagnon,
    visibility: 'client',
    state: 'publie',
    captureId: null,
    createdAt: daysAgo(n),
    publishedBy: compaId,
    publishedAt: daysAgo(n),
    content: { texte, etapeProposee: 'gros_oeuvre', etapeConfirmee: 'gros_oeuvre' },
  });

  const events: Event[] = [
    compteRendu(
      18,
      'Installation du chantier et protection des sols. Démarrage du gros œuvre dans de bonnes conditions.',
    ),
    photo(17, compagnon, 'Préparation de la zone de travail', 'Séjour'),
    photo(14, compagnon, 'Ouverture du mur porteur entre la cuisine et le séjour', 'Cuisine'),
    compteRendu(
      12,
      'Pose du linteau acier et étaiement. La structure est sécurisée, nous pouvons poursuivre sereinement.',
    ),
    // Document partagé au client
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'document',
      actor: compagnon,
      visibility: 'client',
      state: 'publie',
      captureId: null,
      createdAt: daysAgo(10),
      publishedBy: compaId,
      publishedAt: daysAgo(10),
      content: {
        attachment: {
          id: attachmentId(uuid()),
          kind: 'document',
          bucket: 'demo',
          storagePath: `${pid}/${uuid()}.pdf`,
          mimeType: 'application/pdf',
          fileName: 'Devis-plomberie.pdf',
          createdAt: daysAgo(10),
        },
        libelle: 'Devis plomberie — lot sanitaire',
      },
    },
    // Demande du client vers l'équipe (à traiter côté compagnon ; invisible au
    // client tant que non résolue).
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'demande',
      actor: cliente,
      visibility: 'client',
      state: 'ouverte',
      captureId: null,
      createdAt: daysAgo(8),
      publishedBy: null,
      publishedAt: null,
      content: {
        question:
          'Serait-il possible d’avancer la livraison de la cuisine si le planning le permet ?',
        destinataire: 'equipe',
      },
    },
    photo(7, compagnon, 'Coulage de la dalle, séchage en cours', 'Salle de bain'),
    compteRendu(
      5,
      'Dalle coulée. Séchage en cours avant d’attaquer le second œuvre la semaine prochaine.',
    ),
    // Note interne (visible compagnon uniquement)
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'compte_rendu',
      actor: compagnon,
      visibility: 'interne',
      state: 'publie',
      captureId: null,
      createdAt: daysAgo(4),
      publishedBy: compaId,
      publishedAt: daysAgo(4),
      content: { texte: 'Relancer le fournisseur pour confirmer le délai du carrelage.' },
    },
    // Décision en attente du client → alimente le bandeau intelligent
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'demande',
      actor: compagnon,
      visibility: 'client',
      state: 'ouverte',
      captureId: null,
      createdAt: daysAgo(3),
      publishedBy: null,
      publishedAt: null,
      content: {
        question:
          'Quel carrelage souhaitez-vous pour la salle de bain ? Deux ambiances sont proposées dans le devis joint.',
        destinataire: 'client',
      },
    },
    photo(1, compagnon, 'Cloisons de distribution en cours de montage', 'Chambre'),
  ];

  const project: Project = {
    id: pid,
    name: 'Appartement Lyon 6e',
    clientId,
    status: 'en_cours',
    currentStep: currentStep(events),
    createdAt: daysAgo(20),
  };

  const members: ProjectMember[] = [
    {
      id: projectMemberId(uuid()),
      projectId: pid,
      userId: compaId,
      role: 'compagnon',
      createdAt: daysAgo(20),
    },
    {
      id: projectMemberId(uuid()),
      projectId: pid,
      userId: clientId,
      role: 'client',
      createdAt: daysAgo(20),
    },
  ];

  return {
    state: { projects: [project], members, events },
    people: { [compaId]: 'Mickaël', [clientId]: 'Mme Martin' },
    activeProjectId: pid,
  };
}
