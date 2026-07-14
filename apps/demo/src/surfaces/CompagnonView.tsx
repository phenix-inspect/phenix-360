import { useEffect, useRef, useState } from 'react';
import {
  ActivityItem,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
} from '@phenix360/ui';
import {
  EVENT_STATE_LABEL,
  EVENT_TYPE_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  crADesPointsPour,
  demandeRepondue,
  demandesPourPhenix,
  reserveStatut,
  sortByDate,
  userId,
  type Event,
  type EventActor,
  type MissionKind,
  type Project,
  type ProjectStatus,
  type ReserveEvent,
} from '@phenix360/core';
import {
  CalendarClock,
  CircleCheck,
  FileText,
  HardHat,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { demo, dossierOf, filOf, nameOf, type DemoSnapshot } from '../store';
import { fmtDate } from '../lib/format';
import { eventDescription, eventTitle, journalStatut } from '../lib/eventText';
import { ProjectHero } from '../components/ProjectHero';
import { PhotoTile } from '../components/PhotoTile';
import { DocumentButton } from '../components/DocumentButton';
import { CompteRenduPoints } from '../components/CompteRenduPoints';
import { DemandeThread } from '../components/DemandeThread';
import { DemandesClientTab } from '../components/DemandesClientTab';
import { ReserveResponsable } from '../components/ReserveResponsable';
import { DossierPanel } from '../components/DossierPanel';
import { DocumentsTab } from '../components/DocumentsTab';
import { FilView } from '../components/fil/FilView';
import { MomentComposer } from '../components/fil/MomentComposer';
import { ReserveLeveeDialog } from '../components/ReserveLeveeDialog';
import { Composer, type ComposerKind } from '../components/Composer';
import { ClientDecisionComposer } from '../components/ClientDecisionComposer';
import { MissionPicker } from '../components/mission/MissionPicker';
import { CompteRenduFlow } from '../components/mission/CompteRenduFlow';
import { PrereceptionFlow } from '../components/mission/PrereceptionFlow';
import { ReceptionFlow } from '../components/mission/ReceptionFlow';
import { DeleteChantierButton } from '../components/DeleteChantierButton';

function compagnonActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'compagnon');
  const id = member?.userId ?? userId('compagnon-demo');
  return { userId: id, role: 'compagnon', displayName: nameOf(snap, id) };
}

export type CompagnonTab = 'suivi' | 'preparation' | 'documents' | 'fil' | 'demandes';

export function CompagnonView({
  snap,
  project,
  initialTab,
}: {
  snap: DemoSnapshot;
  project: Project;
  /** Onglet d'ouverture imposé (ex. « Récit » quand un client a commenté). */
  initialTab?: CompagnonTab;
}): React.JSX.Element {
  const actor = compagnonActor(snap, project);
  const events = sortByDate(snap.events.filter((e) => e.projectId === project.id));
  const dossier = dossierOf(snap, project.id);
  const [composer, setComposer] = useState<ComposerKind | null>(null);
  const [missionPicker, setMissionPicker] = useState(false);
  const [missionKind, setMissionKind] = useState<MissionKind | null>(null);
  const [decisionComposer, setDecisionComposer] = useState(false);
  // Publier un album « coulisses » depuis Nouvelle mission (jamais le sous-menu).
  const [albumComposer, setAlbumComposer] = useState(false);
  const [lever, setLever] = useState<ReserveEvent | null>(null);
  // À l'ouverture d'un chantier en préparation, on accueille par la note de
  // lancement (onglet Préparation) ; sinon, le suivi du jour — sauf onglet imposé.
  const [tab, setTab] = useState<CompagnonTab>(
    initialTab ?? (dossier && project.status === 'pas_commence' ? 'preparation' : 'suivi'),
  );

  // Changement de chantier depuis la barre : on CONSERVE l'onglet courant (le
  // composant n'est pas remonté). Seule exception : la Préparation, qui n'a pas
  // de contenu sans dossier → on retombe sur Suivi. On n'agit qu'au changement
  // de chantier (pas quand l'utilisateur ouvre lui-même Préparation à vide).
  const prevProjectId = useRef(project.id);
  useEffect(() => {
    if (prevProjectId.current === project.id) return;
    prevProjectId.current = project.id;
    if (tab === 'preparation' && !dossier) setTab('suivi');
  }, [project.id, tab, dossier]);

  // Badge « Demandes client » : demandes du client NON LUES ET pas encore
  // répondues (une demande répondue est « Répondu », jamais « Non lu »). Le badge
  // diminue quand le conducteur ouvre la demande (accusé `seen['compagnon']`).
  const seenCompagnon = snap.seen['compagnon'] ?? {};
  const nbDemandesNonLues = demandesPourPhenix(events).filter(
    (e) => e.actor.role === 'client' && !seenCompagnon[e.id] && !demandeRepondue(e),
  ).length;

  const openFilPhoto = (momentId: string, photoId?: string): void => {
    demo.openFilPhoto(momentId, photoId);
    setTab('fil');
  };

  const suivi = (
    <SuiviTab
      snap={snap}
      project={project}
      actor={actor}
      events={events}
      onNewMission={() => setMissionPicker(true)}
      onOpenFilPhoto={openFilPhoto}
      onLeverReserve={setLever}
    />
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Le projet est le héros dès l'entrée : plus de « Bonjour / Projet
            actuel » (déjà dit dans Aujourd'hui et la barre de contexte). */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ProjectHero
            project={project}
            clientName={nameOf(snap, project.clientId)}
            compact
            className="min-w-0 flex-1"
          />
          <Button size="lg" className="shrink-0" onClick={() => setMissionPicker(true)}>
            <Plus aria-hidden /> Nouvelle mission
          </Button>
        </div>
        {/* Statut métier — modifiable à la main (transitions manuelles, RC1) ;
            à droite, la suppression protégée du chantier actif. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Statut du chantier</span>
            <select
              value={project.status}
              onChange={(e) =>
                void demo.updateProject(project.id, { status: e.target.value as ProjectStatus })
              }
              aria-label="Statut du chantier"
              className="rounded-lg border border-input bg-surface px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <DeleteChantierButton projectId={project.id} name={project.name} className="ml-auto" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CompagnonTab)}>
        {/* Onglets nombreux : on autorise le RETOUR À LA LIGNE (h-auto flex-wrap)
            pour qu'aucun onglet (« Demandes client »…) ne soit masqué hors écran
            sur une largeur normale, au lieu d'un défilement horizontal peu
            découvrable. Plus d'onglet « Réserves » : une réserve est un événement
            du Journal, gérée depuis les missions (Pré-réception / Réception) et
            lue au Suivi. */}
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
          <TabsTrigger value="preparation">Préparation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="fil">Dans les coulisses</TabsTrigger>
          <TabsTrigger value="demandes">
            <span className="flex items-center gap-1.5">
              Demandes client
              {nbDemandesNonLues > 0 && <Badge variant="info">{nbDemandesNonLues}</Badge>}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="suivi">{suivi}</TabsContent>
        <TabsContent value="preparation">
          {dossier ? (
            <DossierPanel project={project} dossier={dossier} actor={actor} />
          ) : (
            <PrepEmpty project={project} />
          )}
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab project={project} dossier={dossier ?? null} events={events} />
        </TabsContent>
        <TabsContent value="fil">
          <FilView snap={snap} project={project} actor={actor} canCompose />
        </TabsContent>
        <TabsContent value="demandes">
          <DemandesClientTab snap={snap} project={project} actor={actor} />
        </TabsContent>
      </Tabs>

      <Composer
        kind={composer}
        project={project}
        actor={actor}
        onClose={() => setComposer(null)}
        onEscalateDecision={() => {
          // « Demander au client → Décision » : bascule vers le composer structuré.
          setComposer(null);
          setDecisionComposer(true);
        }}
      />

      {lever && <ReserveLeveeDialog reserve={lever} actor={actor} onClose={() => setLever(null)} />}

      {missionPicker && (
        <MissionPicker
          onSelect={(kind) => {
            setMissionKind(kind);
            setMissionPicker(false);
          }}
          onPublishAlbum={() => {
            setMissionPicker(false);
            setAlbumComposer(true);
          }}
          onCompose={(kind) => {
            setMissionPicker(false);
            setComposer(kind);
          }}
          onClose={() => setMissionPicker(false)}
        />
      )}

      {decisionComposer && (
        <ClientDecisionComposer
          onCreate={(input) => demo.createClientDecision(project, actor, input)}
          onClose={() => setDecisionComposer(false)}
        />
      )}

      {albumComposer && (
        <MomentComposer
          project={project}
          actor={actor}
          zones={filOf(snap, project.id).zones}
          onClose={() => setAlbumComposer(false)}
        />
      )}

      {missionKind === 'compte_rendu' && (
        <CompteRenduFlow project={project} actor={actor} onClose={() => setMissionKind(null)} />
      )}
      {missionKind === 'prereception' && (
        <PrereceptionFlow project={project} actor={actor} onClose={() => setMissionKind(null)} />
      )}
      {missionKind === 'reception' && (
        <ReceptionFlow project={project} actor={actor} onClose={() => setMissionKind(null)} />
      )}
    </div>
  );
}

function PrepEmpty({ project }: { project: Project }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl py-8">
      <EmptyState
        icon={<HardHat aria-hidden />}
        title="Préparez ce chantier"
        description="Coordonnées client, devis, budget, intervenants, documents, plans, diagnostics, photos avant travaux, commandes, planning et check-list de lancement — tout ce qu'il faut pour démarrer sereinement."
        action={
          <Button onClick={() => demo.ensureDossier(project)}>
            <HardHat aria-hidden /> Démarrer la préparation
          </Button>
        }
      />
    </div>
  );
}

function SuiviTab({
  snap,
  project,
  actor,
  events,
  onNewMission,
  onOpenFilPhoto,
  onLeverReserve,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  events: Event[];
  onNewMission: () => void;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
  onLeverReserve: (reserve: ReserveEvent) => void;
}): React.JSX.Element {
  const drafts = events.filter((e) => e.state === 'brouillon');
  // Le Suivi ne CRÉE plus rien : toute création passe par « Nouvelle mission »
  // (entrée UNIQUE). Il ne sert qu'à CONSULTER — dernière activité + à publier les
  // brouillons. Le journal complet est une ARCHIVE : on n'en montre que la dernière
  // activité, dépliable à la demande (100 % conservé).
  const [showAllJournal, setShowAllJournal] = useState(false);
  const RECENT_JOURNAL = 4;
  const journalEvents = showAllJournal ? events : events.slice(0, RECENT_JOURNAL);

  return (
    <div className="space-y-6">
      {drafts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">À publier ({drafts.length})</h3>
          <ul className="space-y-2">
            {drafts.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{eventTitle(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {EVENT_TYPE_LABEL[e.type]} · {EVENT_STATE_LABEL[e.state].toLowerCase()}
                  </p>
                </div>
                <Button size="sm" onClick={() => void demo.publishEvent(e.id, actor.userId)}>
                  Publier
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-medium text-foreground">
            {showAllJournal ? 'Journal du chantier' : 'Dernière activité'}
          </h3>
          {events.length === 0 ? (
            <EmptyState
              icon={<CalendarClock aria-hidden />}
              title="Le journal est vide"
              description="Votre première mission ouvrira le journal du chantier."
              action={<Button onClick={onNewMission}>Nouvelle mission</Button>}
            />
          ) : (
            <Timeline>
              {journalEvents.map((e) => {
                const statut = e.type === 'reserve' ? reserveStatut(e, events) : null;
                const badge = journalStatut(e, events);
                const filSrc =
                  e.type === 'demande' || e.type === 'reserve' ? e.content.source : undefined;
                const canLever = e.type === 'reserve' && statut === 'ouverte';
                // Tout document / compte rendu est CONSULTABLE (fichier réel ou
                // document généré par PHÉNIX) — jamais une simple ligne inerte.
                const openableDoc = e.type === 'document' || e.type === 'compte_rendu';
                const crPoints = e.type === 'compte_rendu' ? e.content.points : undefined;
                const isCrPoints = (crPoints?.length ?? 0) > 0;
                // Pré-réception : une saisie, deux documents dérivés par destinataire.
                const isPrereceptionDoc = e.type === 'compte_rendu' && !!e.content.prereception;
                // Demande du client : le Suivi ne conserve que la TRACE OFFICIELLE
                // une fois RÉPONDUE (lecture seule). Le pilotage et la réponse se
                // font dans l'onglet « Demandes client » — le Suivi n'est pas un
                // centre d'action pour les demandes, juste la mémoire.
                const demandeClient =
                  e.type === 'demande' && e.content.destinataire === 'phenix' && demandeRepondue(e)
                    ? e
                    : null;
                // Réserve OUVERTE avec un responsable (contact) : on peut le joindre
                // directement depuis le Suivi (l'onglet « Réserves » a été retiré).
                const reserveResponsableId =
                  e.type === 'reserve' && statut === 'ouverte'
                    ? e.content.responsableContactId
                    : undefined;
                const hasRow = badge != null || filSrc?.kind === 'fil' || canLever || openableDoc;
                return (
                  <ActivityItem
                    key={e.id}
                    type={e.type}
                    title={eventTitle(e)}
                    description={eventDescription(e)}
                    date={fmtDate(e.createdAt)}
                    author={nameOf(snap, e.actor.userId)}
                    authorRole={e.actor.role}
                    visibility={e.visibility}
                    media={
                      e.type === 'photo' ? (
                        <PhotoTile photo={e} size="thumb" className="w-28" />
                      ) : e.type === 'levee' && e.content.preuve ? (
                        <img
                          src={e.content.preuve.imageUrl}
                          alt="Photo de preuve de la levée"
                          className="aspect-[4/3] w-28 rounded-lg border border-border object-cover"
                        />
                      ) : undefined
                    }
                  >
                    {hasRow && (
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                        {filSrc?.kind === 'fil' && (
                          <button
                            type="button"
                            onClick={() => onOpenFilPhoto(filSrc.momentId, filSrc.photoId)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5"
                          >
                            <ImageIcon aria-hidden /> Voir la photo
                          </button>
                        )}
                        {canLever && (
                          <button
                            type="button"
                            onClick={() => onLeverReserve(e)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gold-600 px-2.5 py-1 text-xs font-semibold text-paper-0 transition-colors duration-base hover:bg-gold-700 [&_svg]:size-3.5"
                          >
                            <CircleCheck aria-hidden /> Lever la réserve
                          </button>
                        )}
                        {openableDoc && <DocumentButton event={e} />}
                        {isCrPoints && crADesPointsPour(crPoints, 'client') && (
                          <button
                            type="button"
                            onClick={() => demo.openDocument(e, 'client')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5"
                          >
                            <FileText aria-hidden /> PDF client
                          </button>
                        )}
                        {isCrPoints && crADesPointsPour(crPoints, 'artisan') && (
                          <button
                            type="button"
                            onClick={() => demo.openDocument(e, 'artisan')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5"
                          >
                            <FileText aria-hidden /> PDF artisan
                          </button>
                        )}
                        {isPrereceptionDoc && (
                          <>
                            <button
                              type="button"
                              onClick={() => demo.openDocument(e, 'client')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5"
                            >
                              <FileText aria-hidden /> Version client
                            </button>
                            <button
                              type="button"
                              onClick={() => demo.openDocument(e, 'artisan')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5"
                            >
                              <FileText aria-hidden /> Version artisan
                            </button>
                          </>
                        )}
                      </span>
                    )}
                    {isCrPoints && <CompteRenduPoints points={crPoints} audience="conducteur" />}
                    {demandeClient && (
                      <div className="mt-3">
                        <DemandeThread
                          demande={demandeClient}
                          actor={actor}
                          nameOf={(u) => nameOf(snap, u)}
                        />
                      </div>
                    )}
                    {reserveResponsableId && (
                      <div className="mt-3">
                        <ReserveResponsable
                          projectId={e.projectId}
                          contactId={reserveResponsableId}
                        />
                      </div>
                    )}
                  </ActivityItem>
                );
              })}
            </Timeline>
          )}
          {events.length > RECENT_JOURNAL && (
            <button
              type="button"
              onClick={() => setShowAllJournal((v) => !v)}
              aria-expanded={showAllJournal}
              className="text-sm font-medium text-gold-700 hover:underline"
            >
              {showAllJournal ? 'Réduire' : `Voir tout le journal (${events.length})`}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
