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
  buildChantierAttention,
  questionsEnAttente,
  reserveStatut,
  reservesOuvertes,
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
  HelpCircle,
  Image as ImageIcon,
  NotebookPen,
  Plus,
  Reply,
} from 'lucide-react';
import { demo, dossierOf, nameOf, type DemoSnapshot } from '../store';
import { fmtDate } from '../lib/format';
import { eventDescription, eventTitle, journalStatut } from '../lib/eventText';
import { ProjectHero } from '../components/ProjectHero';
import { PhotoTile } from '../components/PhotoTile';
import { DocumentLink } from '../components/DocumentLink';
import { RoadmapProgress } from '../components/RoadmapProgress';
import { DossierPanel } from '../components/DossierPanel';
import { AttentionPanel } from '../components/AttentionPanel';
import { HistoriqueView } from '../components/HistoriqueView';
import { FilView } from '../components/fil/FilView';
import { ReservesView } from '../components/ReservesView';
import { ReserveLeveeDialog } from '../components/ReserveLeveeDialog';
import { Composer, type ComposerKind } from '../components/Composer';
import { ClientDecisionComposer } from '../components/ClientDecisionComposer';
import { MissionPicker } from '../components/mission/MissionPicker';
import { MissionFlow } from '../components/mission/MissionFlow';

function compagnonActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'compagnon');
  const id = member?.userId ?? userId('compagnon-demo');
  return { userId: id, role: 'compagnon', displayName: nameOf(snap, id) };
}

interface ActionDef {
  kind: ComposerKind;
  label: string;
  icon: React.ReactNode;
}

export type CompagnonTab = 'suivi' | 'preparation' | 'fil' | 'reserves' | 'historique';

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

  const attention = buildChantierAttention(dossier, events);
  const nbReservesOuvertes = reservesOuvertes(events).length;

  const askDocument = async (docId: string) => {
    if (!dossier) return;
    const doc = dossier.documents.find((d) => d.id === docId);
    if (!doc) return;
    demo.saveDossier(project.id, {
      ...dossier,
      documents: dossier.documents.map((d) =>
        d.id === docId ? { ...d, status: 'demande_client' } : d,
      ),
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'demande',
      visibility: 'client',
      state: 'ouverte',
      content: {
        question: `Pour préparer votre chantier, pouvez-vous nous transmettre : ${doc.label} ?`,
        destinataire: 'client',
      },
    });
  };

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
      onCompose={setComposer}
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
        {/* Statut métier — modifiable à la main (transitions manuelles, RC1). */}
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
        {dossier && <RoadmapProgress roadmap={dossier.roadmap} />}
      </div>

      <AttentionPanel
        items={attention}
        onAskDocument={(docId) => void askDocument(docId)}
        onOpenPreparation={() => setTab('preparation')}
      />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setTab(v as 'suivi' | 'preparation' | 'fil' | 'reserves' | 'historique')
        }
      >
        <TabsList>
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
          <TabsTrigger value="preparation">Préparation</TabsTrigger>
          <TabsTrigger value="fil">Récit</TabsTrigger>
          <TabsTrigger value="reserves">
            <span className="flex items-center gap-1.5">
              Réserves
              {nbReservesOuvertes > 0 && <Badge variant="warning">{nbReservesOuvertes}</Badge>}
            </span>
          </TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="suivi">{suivi}</TabsContent>
        <TabsContent value="preparation">
          {dossier ? (
            <DossierPanel project={project} dossier={dossier} actor={actor} events={events} />
          ) : (
            <PrepEmpty project={project} />
          )}
        </TabsContent>
        <TabsContent value="fil">
          <FilView snap={snap} project={project} actor={actor} canCompose />
        </TabsContent>
        <TabsContent value="reserves">
          <ReservesView
            snap={snap}
            project={project}
            actor={actor}
            events={events}
            onLeverReserve={setLever}
            onOpenFilPhoto={openFilPhoto}
          />
        </TabsContent>
        <TabsContent value="historique">
          <HistoriqueView snap={snap} project={project} />
        </TabsContent>
      </Tabs>

      <Composer
        kind={composer}
        project={project}
        actor={actor}
        events={events}
        onClose={() => setComposer(null)}
      />

      {lever && <ReserveLeveeDialog reserve={lever} actor={actor} onClose={() => setLever(null)} />}

      {missionPicker && (
        <MissionPicker
          onSelect={(kind) => {
            setMissionKind(kind);
            setMissionPicker(false);
          }}
          onClientDecision={() => {
            setMissionPicker(false);
            setDecisionComposer(true);
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

      {missionKind && (
        <MissionFlow
          kind={missionKind}
          project={project}
          actor={actor}
          onClose={() => setMissionKind(null)}
        />
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
  onCompose,
  onOpenFilPhoto,
  onLeverReserve,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  events: Event[];
  onCompose: (kind: ComposerKind) => void;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
  onLeverReserve: (reserve: ReserveEvent) => void;
}): React.JSX.Element {
  const drafts = events.filter((e) => e.state === 'brouillon');
  const pendingReplies = questionsEnAttente(events).length;

  const actions: ActionDef[] = [
    { kind: 'compte_rendu', label: 'Nouveau compte rendu', icon: <NotebookPen aria-hidden /> },
    { kind: 'photo', label: 'Ajouter des photos', icon: <ImageIcon aria-hidden /> },
    { kind: 'document', label: 'Ajouter un document', icon: <FileText aria-hidden /> },
    { kind: 'demande', label: 'Demander au client', icon: <HelpCircle aria-hidden /> },
    { kind: 'repondre', label: 'Répondre au client', icon: <Reply aria-hidden /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => onCompose(a.kind)}
            className="group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-colors duration-base ease-out hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
              {a.icon}
            </span>
            <span className="text-sm font-medium leading-snug text-foreground">{a.label}</span>
            {a.kind === 'repondre' && pendingReplies > 0 && (
              <span className="absolute right-3 top-3">
                <Badge variant="gold">{pendingReplies}</Badge>
              </span>
            )}
          </button>
        ))}
      </div>

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
          <h3 className="text-sm font-medium text-foreground">Journal du chantier</h3>
          {events.length === 0 ? (
            <EmptyState
              icon={<CalendarClock aria-hidden />}
              title="Le journal est vide"
              description="Votre première saisie ouvrira le journal du chantier."
              action={
                <Button onClick={() => onCompose('compte_rendu')}>Nouveau compte rendu</Button>
              }
            />
          ) : (
            <Timeline>
              {events.map((e) => {
                const statut = e.type === 'reserve' ? reserveStatut(e, events) : null;
                const badge = journalStatut(e, events);
                const filSrc =
                  e.type === 'demande' || e.type === 'reserve' ? e.content.source : undefined;
                const canLever = e.type === 'reserve' && statut === 'ouverte';
                const docAttachment =
                  e.type === 'document' && e.content.attachment.dataUrl
                    ? e.content.attachment
                    : undefined;
                const hasRow =
                  badge != null || filSrc?.kind === 'fil' || canLever || docAttachment != null;
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
                        {docAttachment && <DocumentLink attachment={docAttachment} />}
                      </span>
                    )}
                  </ActivityItem>
                );
              })}
            </Timeline>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
