import { useState } from 'react';
import { Button, Card, CardContent, EmptyState, Input } from '@phenix360/ui';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import {
  clientFeed,
  nextClientAction,
  pendingClientDecisions,
  runAssistant,
  userId,
  type AssistantResult,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { SmartBanner } from '../components/SmartBanner';
import { ProjectHero } from '../components/ProjectHero';
import { StepProgress } from '../components/StepProgress';
import { MomentCard } from '../components/MomentCard';
import { DecisionResponder } from '../components/DecisionResponder';

function clientActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'client');
  const id = member?.userId ?? project.clientId ?? userId('client-demo');
  return { userId: id, role: 'client', displayName: nameOf(snap, id) };
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
  const feed = clientFeed(events);
  const decisions = pendingClientDecisions(events);
  const action = nextClientAction(project, events);
  // La décision prioritaire est déjà portée par le bandeau : on liste le reste.
  const otherDecisions =
    action.kind === 'decision_attendue'
      ? decisions.filter((d) => d.eventId !== action.decision.eventId)
      : decisions;

  const latest = feed[0];
  const rest = feed.slice(1);

  return (
    <div className="space-y-6">
      <SmartBanner project={project} events={events} actor={actor} />

      <Card>
        <CardContent className="space-y-5 p-6">
          <ProjectHero project={project} clientName={nameOf(snap, project.clientId)} />
          <StepProgress current={project.currentStep} />
        </CardContent>
      </Card>

      {otherDecisions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Autres décisions en attente ({otherDecisions.length})
          </h3>
          <ul className="space-y-2">
            {otherDecisions.map((d) => (
              <li key={d.eventId} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm text-foreground">{d.question}</p>
                <DecisionResponder decision={d} actor={actor} className="mt-2" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {feed.length === 0 ? (
        <EmptyState
          icon={<Sparkles aria-hidden />}
          title="Votre récit commence bientôt"
          description="Votre premier compte rendu et vos premières photos apparaîtront ici. Votre équipe PHÉNIX prépare votre chantier."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Dernière activité
            </h2>
            <MomentCard event={latest!} authorName={nameOf(snap, latest!.actor.userId)} />
          </section>

          {rest.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                Le récit de votre chantier
              </h2>
              <div className="space-y-5">
                {rest.map((e) => (
                  <MomentCard key={e.id} event={e} authorName={nameOf(snap, e.actor.userId)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Assistant snap={snap} project={project} actor={actor} />
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
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
          <MessageCircle aria-hidden />
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            Une question sur votre chantier ?
          </h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. Où en est la salle de bain ?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void ask();
            }}
          />
          <Button onClick={() => void ask()} disabled={busy}>
            <Send aria-hidden />
            Demander
          </Button>
        </div>

        {result?.kind === 'answer' && (
          <div className="space-y-2 rounded-lg border border-border bg-paper-50 p-3">
            <p className="whitespace-pre-line text-sm text-foreground">{result.answer}</p>
            {result.sources.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sources : {result.sources.map((s) => s.excerpt).join(' · ')}
              </p>
            )}
          </div>
        )}

        {result?.kind === 'demande_intent' && (
          <div className="space-y-2 rounded-lg border border-border bg-paper-50 p-3">
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
