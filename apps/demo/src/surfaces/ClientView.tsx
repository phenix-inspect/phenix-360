import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Timeline,
  ActivityItem,
} from '@phenix360/ui';
import {
  clientFeed,
  forClient,
  gallery,
  nextClientAction,
  pendingClientDecisions,
  runAssistant,
  userId,
  type AssistantResult,
  type Decision,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';
import { eventDescription, eventTitle } from './CompagnonView';

function clientActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'client');
  const id = member?.userId ?? project.clientId ?? userId('client-demo');
  return { userId: id, role: 'client', displayName: nameOf(snap, id) };
}

function DecisionResponder({
  decision,
  actor,
}: {
  decision: Decision;
  actor: EventActor;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState('');
  const submit = async () => {
    if (!texte.trim()) return;
    await demo.resolveDemande(decision.eventId, {
      texte: texte.trim(),
      resolvedBy: actor.userId,
      resolvedAt: new Date().toISOString(),
    });
    setTexte('');
    setOpen(false);
  };
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Répondre
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2">
      <Textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={2}
        placeholder="Votre décision…"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit()}>
          Valider ma décision
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

export function ClientView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const actor = clientActor(snap, project);
  const events = snap.events.filter((e) => e.projectId === project.id);
  const action = nextClientAction(project, events);
  const feed = clientFeed(events);
  const photos = gallery(forClient(events));
  const decisions = pendingClientDecisions(events);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold tracking-tight">{project.name}</h2>
        <p className="text-sm text-muted-foreground">
          Votre espace — {nameOf(snap, project.clientId)}
        </p>
      </div>

      {/* Bandeau intelligent — l'UI n'affiche que le résultat de nextClientAction */}
      <Card
        className={action.kind === 'decision_attendue' ? 'border-primary shadow-gold' : undefined}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {action.kind === 'decision_attendue' && <Badge variant="gold">Action</Badge>}
            {action.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{action.detail}</p>
          {action.kind === 'decision_attendue' && (
            <DecisionResponder decision={action.decision} actor={actor} />
          )}
        </CardContent>
      </Card>

      <Assistant snap={snap} project={project} actor={actor} />

      {decisions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Décisions en attente ({decisions.length})</h3>
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.eventId} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm text-foreground">{d.question}</p>
                <div className="mt-2">
                  <DecisionResponder decision={d} actor={actor} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Photos ({photos.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-lg border border-border">
                <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">
                  Photo
                </div>
                {p.content.legende && (
                  <figcaption className="truncate p-2 text-xs text-muted-foreground">
                    {p.content.legende}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Le récit de votre chantier</h3>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Votre équipe PHÉNIX prépare votre chantier.
          </p>
        ) : (
          <Timeline>
            {feed.map((e) => (
              <ActivityItem
                key={e.id}
                type={e.type}
                title={eventTitle(e)}
                description={eventDescription(e)}
                date={fmtDateTime(e.createdAt)}
                author={nameOf(snap, e.actor.userId)}
                authorRole={e.actor.role}
              />
            ))}
          </Timeline>
        )}
      </section>
    </div>
  );
}

function Assistant({
  snap,
  project,
  actor,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
}): React.JSX.Element {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    const events = snap.events.filter((e) => e.projectId === project.id);
    const res = await runAssistant({ question: question.trim(), events });
    setResult(res);
    setBusy(false);
  };

  const transmettre = async () => {
    if (result?.kind !== 'demande_intent') return;
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'demande',
      visibility: 'client',
      state: 'ouverte',
      content: { question: result.demande.question, destinataire: 'equipe' },
    });
    setResult(null);
    setQuestion('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assistant PHÉNIX 360</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Posez une question sur votre chantier…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void ask();
            }}
          />
          <Button onClick={() => void ask()} disabled={busy}>
            Demander
          </Button>
        </div>

        {result?.kind === 'answer' && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <p className="whitespace-pre-line text-sm text-foreground">{result.answer}</p>
            {result.sources.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sources : {result.sources.map((s) => s.excerpt).join(' · ')}
              </p>
            )}
          </div>
        )}

        {result?.kind === 'demande_intent' && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <p className="text-sm text-muted-foreground">{result.message}</p>
            <Button size="sm" onClick={() => void transmettre()}>
              Transmettre à l'équipe
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
