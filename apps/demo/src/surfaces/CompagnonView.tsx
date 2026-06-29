import { useState } from 'react';
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
  EVENT_TYPE_LABEL,
  buildChantierAttention,
  sortByDate,
  teamQueue,
  userId,
  type Event,
  type EventActor,
  type Project,
} from '@phenix360/core';
import {
  CalendarClock,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  NotebookPen,
  Reply,
} from 'lucide-react';
import { demo, dossierOf, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';
import { eventDescription, eventTitle } from '../lib/eventText';
import { ProjectHero } from '../components/ProjectHero';
import { PhotoTile } from '../components/PhotoTile';
import { RoadmapProgress } from '../components/RoadmapProgress';
import { DossierPanel } from '../components/DossierPanel';
import { AttentionPanel } from '../components/AttentionPanel';
import { Composer, type ComposerKind } from '../components/Composer';

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

export function CompagnonView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const actor = compagnonActor(snap, project);
  const events = sortByDate(snap.events.filter((e) => e.projectId === project.id));
  const dossier = dossierOf(snap, project.id);
  const [composer, setComposer] = useState<ComposerKind | null>(null);
  const [tab, setTab] = useState<'suivi' | 'preparation'>('suivi');

  const attention = buildChantierAttention(dossier, events);

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

  const suivi = (
    <SuiviTab snap={snap} project={project} actor={actor} events={events} onCompose={setComposer} />
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour {actor.displayName}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projet actuel</p>
        </div>
        <ProjectHero project={project} clientName={nameOf(snap, project.clientId)} compact />
        {dossier && <RoadmapProgress roadmap={dossier.roadmap} />}
      </div>

      <AttentionPanel
        items={attention}
        onAskDocument={(docId) => void askDocument(docId)}
        onOpenPreparation={() => setTab('preparation')}
      />

      {dossier ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'suivi' | 'preparation')}>
          <TabsList>
            <TabsTrigger value="suivi">Suivi</TabsTrigger>
            <TabsTrigger value="preparation">Préparation</TabsTrigger>
          </TabsList>
          <TabsContent value="suivi">{suivi}</TabsContent>
          <TabsContent value="preparation">
            <DossierPanel project={project} dossier={dossier} actor={actor} />
          </TabsContent>
        </Tabs>
      ) : (
        suivi
      )}

      <Composer
        kind={composer}
        project={project}
        actor={actor}
        events={events}
        onClose={() => setComposer(null)}
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
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  events: Event[];
  onCompose: (kind: ComposerKind) => void;
}): React.JSX.Element {
  const drafts = events.filter((e) => e.state === 'brouillon');
  const pendingReplies = teamQueue(events).filter(
    (e) => e.content.destinataire === 'equipe',
  ).length;

  const actions: ActionDef[] = [
    { kind: 'compte_rendu', label: 'Nouveau compte rendu', icon: <NotebookPen aria-hidden /> },
    { kind: 'photo', label: 'Ajouter des photos', icon: <ImageIcon aria-hidden /> },
    { kind: 'document', label: 'Ajouter un document', icon: <FileText aria-hidden /> },
    { kind: 'demande', label: 'Déclarer une demande', icon: <HelpCircle aria-hidden /> },
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
                    {EVENT_TYPE_LABEL[e.type]} · brouillon
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
              {events.map((e) => (
                <ActivityItem
                  key={e.id}
                  type={e.type}
                  title={eventTitle(e)}
                  description={eventDescription(e)}
                  date={fmtDateTime(e.createdAt)}
                  author={nameOf(snap, e.actor.userId)}
                  authorRole={e.actor.role}
                  visibility={e.visibility}
                  media={
                    e.type === 'photo' ? (
                      <PhotoTile photo={e} size="thumb" className="w-28" />
                    ) : undefined
                  }
                >
                  <span className="mt-1 inline-block">
                    <Badge
                      variant={
                        e.state === 'publie'
                          ? 'success'
                          : e.state === 'brouillon'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {e.state}
                    </Badge>
                  </span>
                </ActivityItem>
              ))}
            </Timeline>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
