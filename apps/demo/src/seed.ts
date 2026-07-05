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
  DEFAULT_AUDIENCE,
  INTERNAL_AUDIENCE,
  SHARED_AUDIENCE,
  annotationId,
  attachmentId,
  buildPlanning,
  coupDeCoeurId,
  currentStep,
  eventId,
  filPhotoId,
  messageId,
  momentId,
  projectId,
  projectMemberId,
  userId,
  zoneId,
  type Annotation,
  type BackendState,
  type Contact,
  type CoupDeCoeur,
  type Event,
  type EventActor,
  type Message,
  type Moment,
  type MomentType,
  type Project,
  type ProjectStatus,
  type ProjectStep,
  type ProjectDossier,
  type ProjectMember,
  type ProjectZone,
  type RoadmapStep,
} from '@phenix360/core';

export interface DemoSeed {
  state: BackendState;
  people: Record<string, string>;
  activeProjectId: string;
  dossiers: Record<string, ProjectDossier>;
  /** Annuaire du conducteur — contacts globaux, réutilisables entre chantiers. */
  contacts: Contact[];
  /** Le Fil — agrégat distinct du Journal (par projet). */
  fil: {
    moments: Record<string, Moment[]>;
    coups: Record<string, CoupDeCoeur[]>;
    messages: Record<string, Message[]>;
    zones: Record<string, ProjectZone[]>;
    annotations: Record<string, Annotation[]>;
  };
}

const uuid = (): string => globalThis.crypto.randomUUID();
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

export function buildDemoSeed(): DemoSeed {
  const pid = projectId(uuid());
  const compaId = userId(uuid());
  const clientId = userId(uuid());
  // Id de contact partagé : la réserve seedée référence ce contact (responsable).
  const elecProContactId = uuid();
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
    // Document partagé au client AVEC un vrai fichier (data URL) : ouvrable dans
    // un nouvel onglet. Démontre l'ouverture réelle côté client.
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'document',
      actor: compagnon,
      visibility: 'client',
      state: 'publie',
      captureId: null,
      createdAt: daysAgo(6),
      publishedBy: compaId,
      publishedAt: daysAgo(6),
      content: {
        attachment: {
          id: attachmentId(uuid()),
          kind: 'document',
          bucket: 'demo',
          storagePath: `${pid}/${uuid()}.png`,
          mimeType: 'image/png',
          fileName: 'Plan-salle-de-bain.png',
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          createdAt: daysAgo(6),
        },
        libelle: 'Plan de la salle de bain',
      },
    },
    // Document INTERNE (visibilité interne) : visible du conducteur seul, JAMAIS
    // du client. Sert de garde-fou client-safe.
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'document',
      actor: compagnon,
      visibility: 'interne',
      state: 'publie',
      captureId: null,
      createdAt: daysAgo(7),
      publishedBy: compaId,
      publishedAt: daysAgo(7),
      content: {
        attachment: {
          id: attachmentId(uuid()),
          kind: 'document',
          bucket: 'demo',
          storagePath: `${pid}/${uuid()}.pdf`,
          mimeType: 'application/pdf',
          fileName: 'Contrat-sous-traitant.pdf',
          createdAt: daysAgo(7),
        },
        libelle: 'Contrat sous-traitant (interne)',
      },
    },
    // Question du CLIENT à PHÉNIX, en attente de réponse (le conducteur répond,
    // il ne se crée pas de tâche interne). Reste interne tant que non répondue.
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
        destinataire: 'phenix',
      },
    },
    // Question du CLIENT à PHÉNIX, DÉJÀ RÉPONDUE : le client voit la réponse (Q&A).
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'demande',
      actor: cliente,
      visibility: 'client',
      state: 'traitee',
      captureId: null,
      createdAt: daysAgo(9),
      publishedBy: null,
      publishedAt: null,
      content: {
        question: 'Les fenêtres seront-elles livrées avant la pose des cloisons ?',
        destinataire: 'phenix',
        resolution: {
          texte: 'Oui : livraison confirmée pour lundi, avant le démarrage des cloisons.',
          resolvedBy: compaId,
          resolvedAt: new Date().toISOString(),
        },
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
    address: '8 rue Vauban, 69006 Lyon',
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

  const roadmap: RoadmapStep[] = [
    'Dépose',
    'Gros œuvre',
    'Plomberie',
    'Électricité',
    'Plâtrerie',
    'Carrelage & faïence',
    'Peinture',
    'Sols',
    'Cuisine',
    'Réception',
  ].map((label, i) => ({ id: `step-${i + 1}`, label }));

  const startDate = new Date(Date.now() - 18 * 86_400_000).toISOString().slice(0, 10);
  const dossier: ProjectDossier = {
    infos: {
      clientName: 'Mme Martin',
      phone: '06 22 14 88 03',
      email: 'm.martin@email.fr',
      address: '8 rue Vauban, 69006 Lyon',
      propertyType: 'Appartement',
      surface: 78,
      budget: 64000,
      duration: '3 mois',
      startDate,
    },
    roadmap,
    planning: buildPlanning(roadmap, startDate, 60),
    orders: [
      {
        id: 'o1',
        label: 'Cuisine équipée',
        fournisseur: 'Mobalpa',
        reference: 'MOB-CHENE-CLAIR',
        quantite: 1,
        montant: 9800,
        garantie: '5 ans',
        delaiJours: 42,
        dateCommande: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
        dateLivraisonEstimee: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
        bonCommande: 'BC-Mobalpa-204.pdf',
        stepIds: ['step-9'],
        statut: 'commandee',
      },
      {
        id: 'o2',
        label: 'Carrelage salle de bain',
        fournisseur: 'Porcelanosa',
        reference: 'POR-STON-60',
        quantite: 18,
        montant: 2100,
        delaiJours: 28,
        stepIds: ['step-6'],
        statut: 'a_commander',
      },
      {
        id: 'o3',
        label: 'Robinetterie',
        fournisseur: 'Grohe',
        reference: 'GRO-ESSENCE',
        quantite: 1,
        montant: 1250,
        garantie: '10 ans',
        dateLivraisonReelle: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
        stepIds: ['step-3'],
        statut: 'livree',
      },
    ],
    selections: [
      {
        id: 's1',
        categorie: 'Carrelage',
        label: 'Salle de bain',
        statut: 'a_choisir',
        detail: 'Deux ambiances proposées',
        options: [
          {
            id: 'A',
            title: 'Grès effet pierre, grand format',
            description:
              'Carreaux grand format effet pierre, pose minérale et contemporaine pour une salle de bain apaisante.',
            imageSeed: 'carrelage-pierre',
          },
          {
            id: 'B',
            title: 'Zellige blanc nacré',
            description:
              'Zelliges faits main aux reflets nacrés, pour une ambiance artisanale et lumineuse.',
            imageSeed: 'carrelage-zellige',
          },
          {
            id: 'C',
            title: 'Terrazzo doux ton sable',
            description:
              'Terrazzo aux éclats fins sur fond sable, un parti pris graphique et chaleureux.',
            imageSeed: 'carrelage-terrazzo',
          },
        ],
      },
      {
        id: 's2',
        categorie: 'Peinture',
        label: 'Séjour & chambres',
        statut: 'valide',
        detail: 'Blanc cassé mat',
      },
      {
        id: 's3',
        categorie: 'Cuisine',
        label: 'Façades & plan de travail',
        statut: 'propose',
        options: [
          {
            id: 'A',
            title: 'Façades bois clair & plan de travail quartz blanc',
            description:
              'Ambiance chaleureuse et lumineuse. Façades en bois clair, plan de travail quartz blanc pour un rendu doux et naturel.',
            imageSeed: 'cuisine-bois-clair',
          },
          {
            id: 'B',
            title: 'Façades blanches & plan de travail noir',
            description:
              'Ambiance moderne et contrastée. Façades blanches mates, plan de travail noir pour un style élégant et intemporel.',
            imageSeed: 'cuisine-blanc-noir',
          },
          {
            id: 'C',
            title: 'Façades vert sauge & plan de travail bois',
            description:
              'Ambiance douce et tendance. Façades vert sauge mates, plan de travail bois clair pour une atmosphère naturelle.',
            imageSeed: 'cuisine-vert-sauge',
          },
          {
            id: 'D',
            title: 'Façades gris anthracite & plan de travail marbre clair',
            description:
              'Ambiance chic et contemporaine. Façades gris anthracite, plan de travail marbre clair pour un rendu raffiné.',
            imageSeed: 'cuisine-anthracite-marbre',
          },
          {
            id: 'E',
            title: 'Façades beige sable & plan de travail pierre',
            description:
              'Ambiance douce et minérale. Façades beige sable, plan de travail pierre pour un style épuré et harmonieux.',
            imageSeed: 'cuisine-beige-pierre',
          },
        ],
      },
    ],
    documents: [
      { id: 'd1', label: 'Devis signé', status: 'fourni', recommande: true },
      // Acompte payé : chantier en cours → dossier partageable au client.
      { id: 'd5', label: 'Acompte versé', status: 'fourni', recommande: true },
      { id: 'd2', label: 'Plans', status: 'fourni' },
      { id: 'd3', label: 'DPE', status: 'a_fournir', recommande: true },
      { id: 'd4', label: "Attestation d'assurance", status: 'fourni' },
    ],
    questions: [
      { id: 'q1', question: 'Confirmer la date de réception souhaitée ?', answered: false },
    ],
    devis: {
      reference: 'DEV-2024-0188',
      date: new Date(Date.now() - 25 * 86_400_000).toISOString().slice(0, 10),
      lots: [
        {
          id: 'lot-go',
          label: 'Gros œuvre & dépose',
          stepId: 'step-2',
          postes: [
            {
              id: 'p-go-1',
              label: 'Démolition & maçonnerie',
              unite: 'forfait',
              montantHT: 6500,
              tva: 10,
            },
          ],
        },
        {
          id: 'lot-plomberie',
          label: 'Plomberie',
          stepId: 'step-3',
          orderIds: ['o3'],
          postes: [
            {
              id: 'p-pl-1',
              label: 'Réseau & évacuations',
              unite: 'ens.',
              montantHT: 3800,
              tva: 10,
            },
            {
              id: 'p-pl-2',
              label: 'Robinetterie (fourniture & pose)',
              unite: 'ens.',
              montantHT: 1250,
              tva: 10,
            },
          ],
        },
        {
          id: 'lot-elec',
          label: 'Électricité',
          stepId: 'step-4',
          postes: [
            {
              id: 'p-el-1',
              label: 'Mise aux normes & points',
              unite: 'ens.',
              montantHT: 4200,
              tva: 10,
            },
          ],
        },
        {
          id: 'lot-carrelage',
          label: 'Carrelage & faïence',
          stepId: 'step-6',
          orderIds: ['o2'],
          selectionIds: ['s1'],
          postes: [
            {
              id: 'p-ca-1',
              label: 'Carrelage sol salle de bain',
              quantite: 18,
              unite: 'm²',
              prixUnitaireHT: 95,
              montantHT: 1710,
              tva: 10,
              materiau: 'Grès cérame',
            },
            { id: 'p-ca-2', label: 'Faïence murale', unite: 'forfait', montantHT: 900, tva: 10 },
            {
              id: 'p-ca-3',
              label: 'Étanchéité sous carrelage',
              unite: 'forfait',
              montantHT: 450,
              tva: 10,
            },
          ],
        },
        {
          id: 'lot-peinture',
          label: 'Peinture',
          stepId: 'step-7',
          selectionIds: ['s2'],
          postes: [
            {
              id: 'p-pe-1',
              label: 'Préparation + 2 couches',
              quantite: 160,
              unite: 'm²',
              prixUnitaireHT: 28,
              montantHT: 4480,
              tva: 10,
            },
          ],
        },
        {
          id: 'lot-sols',
          label: 'Revêtements de sol',
          stepId: 'step-8',
          postes: [
            {
              id: 'p-so-1',
              label: 'Parquet contrecollé fourniture & pose',
              quantite: 55,
              unite: 'm²',
              prixUnitaireHT: 70,
              montantHT: 3850,
              tva: 10,
              materiau: 'Chêne contrecollé',
            },
          ],
        },
        {
          id: 'lot-cuisine',
          label: 'Cuisine',
          stepId: 'step-9',
          orderIds: ['o1'],
          selectionIds: ['s3'],
          postes: [
            {
              id: 'p-cu-1',
              label: 'Fourniture cuisine équipée',
              unite: 'ens.',
              montantHT: 9800,
              tva: 20,
            },
            {
              id: 'p-cu-2',
              label: 'Pose & raccordements',
              unite: 'forfait',
              montantHT: 1500,
              tva: 10,
            },
          ],
        },
      ],
    },
    // Avenant n°1 — NOUVEAU devis signé, AJOUTÉ (le devis initial reste intact).
    // Il fait monter la cuisine en gamme (le poste d'origine reste visible,
    // marqué « remplacé par avenant n°1 ») et ajoute un poste sanitaire.
    avenants: [
      {
        id: 'av-1',
        numero: 1,
        reference: 'AV-2024-01',
        date: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
        label: 'Montée en gamme cuisine + WC suspendu',
        lots: [
          {
            id: 'lot-av1-cuisine',
            label: 'Cuisine',
            postes: [
              {
                id: 'p-av1-cu',
                label: 'Fourniture cuisine équipée — finition haut de gamme',
                unite: 'ens.',
                montantHT: 12400,
                tva: 20,
                remplacePosteId: 'p-cu-1',
              },
            ],
          },
          {
            id: 'lot-av1-plomberie',
            label: 'Plomberie',
            postes: [
              {
                id: 'p-av1-wc',
                label: 'WC suspendu (fourniture & pose)',
                unite: 'ens.',
                montantHT: 980,
                tva: 10,
                materiau: 'Céramique',
              },
            ],
          },
        ],
      },
    ],
    sources: ['Devis-renovation-Martin.pdf', 'Plans-appartement.pdf'],
    createdAt: new Date().toISOString(),
  };

  // ----------------------------- Le Fil --------------------------------
  // Agrégat distinct du Journal : la vie visuelle du chantier. Photos sans
  // imageUrl → rendu en tuile dégradée premium (la vraie image arrive à l'upload).
  const zones: ProjectZone[] = ['Séjour', 'Cuisine', 'Salle de bain', 'Chambre', 'Façade'].map(
    (label, i) => ({ id: zoneId(`zone-${i + 1}`), projectId: pid, label, ordre: i }),
  );
  const zoneByLabel = (label: string): ProjectZone => zones.find((z) => z.label === label)!;

  const mkMoment = (
    n: number,
    type: MomentType,
    title: string,
    zoneLabel: string,
    opts: {
      legendes?: string[];
      observations?: string;
      intervenants?: string[];
      /** Partagé au client par défaut ; `false` = Moment interne (privé). */
      shared?: boolean;
    } = {},
  ): Moment => {
    const at = daysAgo(n);
    const legendes = opts.legendes ?? [];
    const nb = Math.max(1, legendes.length);
    const photos = Array.from({ length: nb }, (_, i) => ({
      id: filPhotoId(uuid()),
      bucket: 'demo',
      storagePath: `${pid}/fil/${uuid()}.jpg`,
      mimeType: 'image/jpeg',
      width: 1600,
      height: 1200,
      ...(legendes[i] ? { legende: legendes[i] } : {}),
      ordre: i,
      createdAt: at,
    }));
    return {
      id: momentId(uuid()),
      projectId: pid,
      authorId: compaId,
      authorRole: 'compagnon',
      createdAt: at,
      publishedAt: at,
      state: 'publie',
      type,
      title,
      zoneId: zoneByLabel(zoneLabel).id,
      // Interne par défaut sauf partage explicite (règle « privé par défaut »).
      visibleTo: opts.shared === false ? INTERNAL_AUDIENCE : SHARED_AUDIENCE,
      ...(opts.observations ? { observations: opts.observations } : {}),
      ...(opts.intervenants ? { intervenants: opts.intervenants } : {}),
      photos,
      coverPhotoId: photos[0]!.id,
    };
  };

  // Réparti sur deux mois → deux séparateurs de chapitre dans le Fil.
  const mCloisons = mkMoment(1, 'etape', 'Cloisons terminées', 'Séjour', {
    legendes: ['Distribution des pièces posée'],
  });
  // Un Moment INTERNE (privé) : réunion de chantier — visible du conducteur seul,
  // jamais du client tant qu'il n'est pas partagé. Démontre « privé par défaut ».
  const mReunion = mkMoment(2, 'reunion', 'Réunion de chantier hebdomadaire', 'Séjour', {
    observations:
      'Point d’avancement : cloisons terminées, séchage de la dalle conforme. Le plombier interviendra lundi. Aucun aléa signalé.',
    intervenants: ['Mickaël (conducteur)', 'Plombier', 'Électricien'],
    shared: false,
  });
  // Un ALBUM multi-photos (3 photos) → badge « 3 photos » + galerie immersive.
  const mDalle = mkMoment(6, 'etape', 'Dalle coulée', 'Salle de bain', {
    legendes: ['Coffrage et ferraillage', 'Coulage en cours', 'Surface talochée, séchage'],
  });
  const mMur = mkMoment(12, 'etape', 'Ouverture du mur porteur', 'Cuisine', {
    legendes: ['Cuisine ouverte sur le séjour'],
  });
  const mVisite = mkMoment(15, 'visite', 'Visite de chantier avec Mme Martin', 'Chambre', {
    observations:
      'Visite sur site : la cliente valide l’implantation des prises et l’emplacement du meuble vasque.',
    intervenants: ['Mickaël (conducteur)', 'Mme Martin'],
  });
  const mPrepa = mkMoment(22, 'visite', 'Préparation du chantier', 'Chambre');
  const mDemarrage = mkMoment(40, 'etape', 'Démarrage du chantier', 'Façade', {
    legendes: ['Installation et protections'],
  });
  const moments: Moment[] = [mCloisons, mReunion, mDalle, mMur, mVisite, mPrepa, mDemarrage];

  // Une interaction existante → un Moment verrouillé (mémoire fiable).
  const coups: CoupDeCoeur[] = [
    {
      id: coupDeCoeurId(uuid()),
      momentId: mMur.id,
      userId: clientId,
      userRole: 'client',
      createdAt: daysAgo(11),
    },
  ];
  const msgPrise: Message = {
    id: messageId(uuid()),
    momentId: mDalle.id,
    photoId: mDalle.photos[1]!.id,
    parentId: null,
    authorId: clientId,
    authorRole: 'client',
    texte: 'Cette prise peut-elle être déplacée ?',
    createdAt: daysAgo(5),
  };
  const messages: Message[] = [
    // Niveau 1 : message du Moment.
    {
      id: messageId(uuid()),
      momentId: mDalle.id,
      photoId: null,
      parentId: null,
      authorId: clientId,
      authorRole: 'client',
      texte: 'Superbe, hâte de voir la suite !',
      createdAt: daysAgo(5),
    },
    // Niveau 2 : message attaché à UNE photo précise de l'album (annoté).
    msgPrise,
  ];

  // Annotation seedée : un cercle autour d'une zone, rattaché au message ci-dessus
  // (« cercle rouge + commentaire »). Coordonnées normalisées (0..1). Elle a été
  // convertie en RÉSERVE (pont annotation → réserve) → `action`.
  const annId = annotationId(uuid());
  const reserveId = eventId(uuid());
  const annotations: Annotation[] = [
    {
      id: annId,
      projectId: pid,
      momentId: mDalle.id,
      photoId: mDalle.photos[1]!.id,
      type: 'cercle',
      points: [
        { x: 0.32, y: 0.4 },
        { x: 0.6, y: 0.66 },
      ],
      color: '#d4452f',
      authorId: clientId,
      authorRole: 'client',
      visibleTo: DEFAULT_AUDIENCE,
      createdAt: daysAgo(5),
      messageId: msgPrise.id,
      action: { kind: 'reserve', ref: reserveId },
    },
  ];

  // Réserve OUVERTE seedée (interne, invisible au client), créée depuis la photo
  // annotée ci-dessus : prête à être LEVÉE côté conducteur. Ajoutée au journal.
  const echeanceLevee = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  events.push({
    id: reserveId,
    projectId: pid,
    type: 'reserve',
    actor: compagnon,
    visibility: 'interne',
    state: 'ouverte',
    captureId: null,
    createdAt: daysAgo(2),
    publishedBy: compaId,
    publishedAt: daysAgo(2),
    content: {
      numero: 1,
      libelle: 'Cette prise peut-elle être déplacée ?',
      responsableContactId: elecProContactId,
      responsable: 'Élec Pro',
      echeance: echeanceLevee,
      source: {
        kind: 'fil',
        momentId: mDalle.id,
        photoId: mDalle.photos[1]!.id,
        annotationId: annId,
      },
    },
  });

  // Un fait du jour (interne) : la visite de contrôle de ce matin. Nourrit le
  // point du soir (« ce que vous avez fait aujourd'hui ») sur une démo fraîche.
  events.push({
    id: eventId(uuid()),
    projectId: pid,
    type: 'compte_rendu',
    actor: compagnon,
    visibility: 'interne',
    state: 'publie',
    captureId: null,
    createdAt: new Date().toISOString(),
    publishedBy: compaId,
    publishedAt: new Date().toISOString(),
    content: {
      texte: 'Visite de contrôle ce matin : le second œuvre peut démarrer.',
      etapeConfirmee: 'gros_oeuvre',
    },
  });

  // ----------------------- Les autres chantiers -----------------------------
  // Un conducteur pilote plusieurs affaires : « Aujourd'hui » agrège tout
  // (VISION.md Art. 3). Chantiers plus légers (faits seuls, sans dossier).
  const extraPeople: Record<string, string> = {};
  const extraProjects: Project[] = [];
  const extraMembers: ProjectMember[] = [];
  const extraEvents: Event[] = [];
  const extraDossiers: Record<string, ProjectDossier> = {};

  const makeChantier = (opts: {
    name: string;
    clientName: string;
    address?: string;
    step: ProjectStep;
    status?: ProjectStatus;
    startedDaysAgo: number;
    reserves: string[];
    clientDecision?: string;
    clientQuestion?: string;
  }): void => {
    const cid = projectId(uuid());
    const clId = userId(uuid());
    const compa: EventActor = { userId: compaId, role: 'compagnon', displayName: 'Mickaël' };
    extraPeople[clId] = opts.clientName;
    const evs: Event[] = [];

    // Un compte rendu client (fixe l'étape + nourrit le fil client).
    evs.push({
      id: eventId(uuid()),
      projectId: cid,
      type: 'compte_rendu',
      actor: compa,
      visibility: 'client',
      state: 'publie',
      captureId: null,
      createdAt: daysAgo(2),
      publishedBy: compaId,
      publishedAt: daysAgo(2),
      content: { texte: 'Le chantier avance conformément au planning.', etapeConfirmee: opts.step },
    });

    opts.reserves.forEach((libelle, i) => {
      evs.push({
        id: eventId(uuid()),
        projectId: cid,
        type: 'reserve',
        actor: compa,
        visibility: 'interne',
        state: 'ouverte',
        captureId: null,
        createdAt: daysAgo(3),
        publishedBy: compaId,
        publishedAt: daysAgo(3),
        content: {
          numero: i + 1,
          libelle,
          responsable: 'Artisan',
          echeance: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        },
      });
    });

    if (opts.clientDecision) {
      evs.push({
        id: eventId(uuid()),
        projectId: cid,
        type: 'demande',
        actor: compa,
        visibility: 'client',
        state: 'ouverte',
        captureId: null,
        createdAt: daysAgo(2),
        publishedBy: null,
        publishedAt: null,
        content: { question: opts.clientDecision, destinataire: 'client' },
      });
    }
    if (opts.clientQuestion) {
      evs.push({
        id: eventId(uuid()),
        projectId: cid,
        type: 'demande',
        actor: { userId: clId, role: 'client', displayName: opts.clientName },
        visibility: 'client',
        state: 'ouverte',
        captureId: null,
        createdAt: daysAgo(1),
        publishedBy: null,
        publishedAt: null,
        content: { question: opts.clientQuestion, destinataire: 'phenix' },
      });
    }

    extraProjects.push({
      id: cid,
      name: opts.name,
      clientId: clId,
      address: opts.address,
      status: opts.status ?? 'en_cours',
      currentStep: opts.step,
      createdAt: daysAgo(opts.startedDaysAgo),
    });
    // Dossier partageable (chantier avancé) : les 3 bloquants sont validés —
    // devis signé, acompte versé, date officielle fixée. Roadmap standard pour
    // le planning client (grandes étapes seulement).
    extraDossiers[cid] = {
      infos: {
        clientName: opts.clientName,
        ...(opts.address ? { address: opts.address } : {}),
        startDate: new Date(Date.now() - opts.startedDaysAgo * 86_400_000)
          .toISOString()
          .slice(0, 10),
      },
      roadmap: ['Dépose', 'Gros œuvre', 'Second œuvre', 'Finitions', 'Réception'].map(
        (label, i) => ({ id: `${cid}-step-${i + 1}`, label }),
      ),
      planning: [],
      orders: [],
      selections: [],
      documents: [
        { id: `${cid}-devis`, label: 'Devis signé', status: 'fourni', recommande: true },
        { id: `${cid}-acompte`, label: 'Acompte versé', status: 'fourni', recommande: true },
      ],
      questions: [],
      sources: [],
      createdAt: daysAgo(opts.startedDaysAgo),
    };
    extraMembers.push(
      {
        id: projectMemberId(uuid()),
        projectId: cid,
        userId: compaId,
        role: 'compagnon',
        createdAt: daysAgo(opts.startedDaysAgo),
      },
      {
        id: projectMemberId(uuid()),
        projectId: cid,
        userId: clId,
        role: 'client',
        createdAt: daysAgo(opts.startedDaysAgo),
      },
    );
    extraEvents.push(...evs);
  };

  makeChantier({
    name: 'Maison Écully',
    clientName: 'M. Dubois',
    address: '12 chemin des Cuers, 69130 Écully',
    step: 'second_oeuvre',
    status: 'pre_reception',
    startedDaysAgo: 30,
    reserves: [
      'Joint de carrelage à reprendre dans la salle de bain',
      'Prise mal alignée en cuisine',
    ],
    clientDecision: 'Quelle finition souhaitez-vous pour la rampe d’escalier ?',
  });
  makeChantier({
    name: 'Duplex Croix-Rousse',
    clientName: 'Mme Bernard',
    address: '5 rue des Pierres Plantées, 69004 Lyon',
    step: 'finitions',
    status: 'levee_reserves',
    startedDaysAgo: 55,
    reserves: ['Retouche peinture dans la cage d’escalier'],
    clientQuestion: 'Serait-il possible de décaler la réception d’une semaine ?',
  });

  // ----------------------------- L'annuaire ---------------------------------
  // Le carnet d'adresses du conducteur : quelques contacts déjà liés au chantier
  // Lyon 6e (client, artisan, fournisseur) + un contact transverse non lié.
  const contacts: Contact[] = [
    {
      // Le contact « client » INCARNE le membre client (userId) : source unique
      // de ses coordonnées, édité une seule fois (VISION Art. 6).
      id: uuid(),
      nom: 'Mme Martin',
      role: 'client',
      userId: clientId,
      phone: '06 22 14 88 03',
      email: 'm.martin@email.fr',
      whatsapp: '06 22 14 88 03',
      address: '8 rue Vauban, 69006 Lyon',
      notes: 'Cliente du chantier Lyon 6e. Disponible en fin de journée.',
      projectIds: [pid],
      createdAt: daysAgo(20),
    },
    {
      id: uuid(),
      nom: 'Karim Bouaziz',
      societe: 'SARL Aqua',
      role: 'artisan',
      trade: 'Plomberie',
      phone: '06 45 12 78 90',
      email: 'contact@sarl-aqua.fr',
      notes: 'Plomberie — lot sanitaire. Réactif par WhatsApp.',
      projectIds: [pid],
      createdAt: daysAgo(18),
    },
    {
      id: elecProContactId,
      nom: 'Élec Pro',
      societe: 'Élec Pro',
      role: 'artisan',
      trade: 'Électricité',
      phone: '06 33 21 54 76',
      email: 'contact@elecpro.fr',
      projectIds: [pid],
      createdAt: daysAgo(18),
    },
    {
      id: uuid(),
      nom: 'Carrelage Lyonnais',
      societe: 'Carrelage Lyonnais',
      role: 'artisan',
      trade: 'Carrelage & faïence',
      phone: '04 78 42 19 03',
      email: 'contact@carrelage-lyonnais.fr',
      projectIds: [pid],
      createdAt: daysAgo(16),
    },
    {
      id: uuid(),
      nom: 'Showroom Mobalpa Lyon',
      societe: 'Mobalpa',
      role: 'fournisseur',
      trade: 'Cuisine équipée',
      phone: '04 72 00 11 22',
      email: 'lyon@mobalpa.fr',
      address: '15 cours Lafayette, 69003 Lyon',
      notes: 'Cuisine équipée — réf. MOB-CHENE-CLAIR.',
      projectIds: [pid],
      createdAt: daysAgo(12),
    },
    {
      id: uuid(),
      nom: 'Cabinet Vitruve',
      societe: 'Vitruve Architecture',
      role: 'architecte',
      phone: '04 78 55 33 21',
      email: 'atelier@vitruve-archi.fr',
      notes: 'Architecte partenaire, plusieurs affaires.',
      projectIds: [],
      createdAt: daysAgo(30),
    },
  ];

  return {
    state: {
      projects: [project, ...extraProjects],
      members: [...members, ...extraMembers],
      events: [...events, ...extraEvents],
    },
    people: { [compaId]: 'Mickaël', [clientId]: 'Mme Martin', ...extraPeople },
    activeProjectId: pid,
    dossiers: { [pid]: dossier, ...extraDossiers },
    contacts,
    fil: {
      moments: { [pid]: moments },
      coups: { [pid]: coups },
      messages: { [pid]: messages },
      zones: { [pid]: zones },
      annotations: { [pid]: annotations },
    },
  };
}
