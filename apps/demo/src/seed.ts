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
  type CoupDeCoeur,
  type Event,
  type EventActor,
  type Message,
  type Moment,
  type Project,
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
    // Demande du client vers l'équipe, PRISE EN CHARGE (en cours) : priorité,
    // responsable et timeline renseignés. Invisible au client tant que non
    // répondue (le travail en cours ne fuit jamais).
    {
      id: eventId(uuid()),
      projectId: pid,
      type: 'demande',
      actor: cliente,
      visibility: 'client',
      state: 'en_cours',
      captureId: null,
      createdAt: daysAgo(8),
      publishedBy: null,
      publishedAt: null,
      content: {
        question:
          'Serait-il possible d’avancer la livraison de la cuisine si le planning le permet ?',
        destinataire: 'equipe',
        priorite: 'haute',
        responsable: 'Conducteur',
        activites: [
          {
            kind: 'ouverture',
            authorId: clientId,
            authorRole: 'client',
            at: daysAgo(8),
          },
          {
            kind: 'statut',
            authorId: compaId,
            authorRole: 'compagnon',
            at: daysAgo(7),
            to: 'en_cours',
            from: 'ouverte',
          },
          {
            kind: 'commentaire',
            authorId: compaId,
            authorRole: 'compagnon',
            at: daysAgo(7),
            texte: 'Je vérifie le délai avec Mobalpa avant de confirmer.',
          },
        ],
      },
    },
    // Demande du client vers l'équipe, DÉJÀ RÉPONDUE : le client voit la réponse
    // (Q&A), le détail interne (timeline) reste côté conducteur.
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
        destinataire: 'equipe',
        priorite: 'normale',
        responsable: 'Conducteur',
        resolution: {
          texte: 'Oui : livraison confirmée pour lundi, avant le démarrage des cloisons.',
          resolvedBy: compaId,
          resolvedAt: daysAgo(6),
        },
        activites: [
          { kind: 'ouverture', authorId: clientId, authorRole: 'client', at: daysAgo(9) },
          {
            kind: 'statut',
            authorId: compaId,
            authorRole: 'compagnon',
            at: daysAgo(8),
            to: 'en_cours',
            from: 'ouverte',
          },
          {
            kind: 'reponse',
            authorId: compaId,
            authorRole: 'compagnon',
            at: daysAgo(6),
            to: 'traitee',
            texte: 'Oui : livraison confirmée pour lundi, avant le démarrage des cloisons.',
          },
        ],
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
    title: string,
    zoneLabel: string,
    legendes: string[] = [],
  ): Moment => {
    const at = daysAgo(n);
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
      title,
      zoneId: zoneByLabel(zoneLabel).id,
      visibleTo: DEFAULT_AUDIENCE,
      photos,
      coverPhotoId: photos[0]!.id,
    };
  };

  // Réparti sur deux mois → deux séparateurs de chapitre dans le Fil.
  const mCloisons = mkMoment(1, 'Cloisons terminées', 'Séjour', ['Distribution des pièces posée']);
  // Un ALBUM multi-photos (3 photos) → badge « 3 photos » + galerie immersive.
  const mDalle = mkMoment(6, 'Dalle coulée', 'Salle de bain', [
    'Coffrage et ferraillage',
    'Coulage en cours',
    'Surface talochée, séchage',
  ]);
  const mMur = mkMoment(12, 'Ouverture du mur porteur', 'Cuisine', [
    'Cuisine ouverte sur le séjour',
  ]);
  const mPrepa = mkMoment(22, 'Préparation du chantier', 'Chambre');
  const mDemarrage = mkMoment(40, 'Démarrage du chantier', 'Façade', [
    'Installation et protections',
  ]);
  const moments: Moment[] = [mCloisons, mDalle, mMur, mPrepa, mDemarrage];

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
      responsable: 'Électricien',
      echeance: echeanceLevee,
      source: {
        kind: 'fil',
        momentId: mDalle.id,
        photoId: mDalle.photos[1]!.id,
        annotationId: annId,
      },
    },
  });

  return {
    state: { projects: [project], members, events },
    people: { [compaId]: 'Mickaël', [clientId]: 'Mme Martin' },
    activeProjectId: pid,
    dossiers: { [pid]: dossier },
    fil: {
      moments: { [pid]: moments },
      coups: { [pid]: coups },
      messages: { [pid]: messages },
      zones: { [pid]: zones },
      annotations: { [pid]: annotations },
    },
  };
}
