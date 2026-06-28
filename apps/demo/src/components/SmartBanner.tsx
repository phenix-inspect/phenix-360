import { CheckCircle2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { nextClientAction, type Event, type EventActor, type Project } from '@phenix360/core';
import { DecisionResponder } from './DecisionResponder';

/**
 * Le BANDEAU INTELLIGENT — fonctionnalité signature. Répond d'un coup d'œil à
 * « ai-je quelque chose à faire aujourd'hui ? ». N'embarque aucune logique :
 * il affiche le résultat de `nextClientAction` (cœur dans @phenix360/core).
 * Spectaculaire mais sobre : accent or quand une action est requise, serein
 * sinon — jamais « vide ».
 */
export function SmartBanner({
  project,
  events,
  actor,
}: {
  project: Project;
  events: Event[];
  actor: EventActor;
}): React.JSX.Element {
  const action = nextClientAction(project, events);

  if (action.kind === 'decision_attendue') {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-gold-200 bg-gold-50 p-6 shadow-gold sm:p-7">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">
            <Sparkles aria-hidden />
          </span>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
                Action requise{action.total > 1 ? ` · ${action.total} décisions` : ''}
              </p>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {action.title}
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">{action.detail}</p>
            </div>
            <DecisionResponder decision={action.decision} actor={actor} />
          </div>
        </div>
      </section>
    );
  }

  if (action.kind === 'nouvelle_photo') {
    return (
      <section className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
          <ImageIcon aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            {action.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-ink-500 [&_svg]:size-5">
        <CheckCircle2 aria-hidden />
      </span>
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          {action.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
      </div>
    </section>
  );
}
