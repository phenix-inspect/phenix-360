import { Button } from '@phenix360/ui';
import { buildEveningReview, type Event } from '@phenix360/core';
import {
  ArrowRight,
  Check,
  Flag,
  HelpCircle,
  ListChecks,
  MessageSquare,
  MoonStar,
} from 'lucide-react';
import { nameOf, type DemoSnapshot } from '../store';

/**
 * « Clôturer ma journée » — le point du soir. À 18 h, le conducteur voit ce
 * qu'il a fait, ce qui reste ouvert et ce qu'il faut surveiller demain — puis il
 * rentre la tête vide (VISION.md Art. 10). Rien d'inventé : agrégé des faits
 * (Art. 7). Privé conducteur : cette synthèse n'existe que de son côté.
 */
export function PointDuSoirView({
  snap,
  onPreparerDemain,
}: {
  snap: DemoSnapshot;
  onPreparerDemain: () => void;
}): React.JSX.Element {
  const compagnon = snap.members.find((m) => m.role === 'compagnon');
  const prenom = compagnon ? nameOf(snap, compagnon.userId) : 'Mickaël';

  const eventsByProject: Record<string, Event[]> = {};
  for (const e of snap.events) (eventsByProject[e.projectId] ??= []).push(e);

  const review = buildEveningReview({
    projects: snap.projects,
    eventsByProject,
    dossiersByProject: snap.dossiers,
  });

  const ouvert = [
    { icon: <ListChecks aria-hidden />, n: review.actions, label: 'actions à suivre' },
    { icon: <Flag aria-hidden />, n: review.reserves, label: 'réserves à lever' },
    { icon: <HelpCircle aria-hidden />, n: review.decisions, label: 'décisions client en attente' },
    { icon: <MessageSquare aria-hidden />, n: review.questions, label: 'réponses à donner' },
  ].filter((x) => x.n > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <MoonStar aria-hidden />
          Fin de journée
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Clôturer ma journée
        </h1>
        <p className="text-base text-muted-foreground">
          Vous pouvez rentrer, {prenom}. Voici votre journée — tout est tracé.
        </p>
      </div>

      {/* Ce que vous avez fait aujourd'hui */}
      <Section title="Aujourd’hui, vous avez">
        {review.totalFaits === 0 ? (
          <p className="text-sm text-muted-foreground">Journée calme — rien à consigner.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {review.faits.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-3 py-1.5 text-sm text-foreground [&_svg]:size-3.5 [&_svg]:text-gold-700"
              >
                <Check aria-hidden />
                {f.count} {f.label}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Ce qui reste ouvert */}
      <Section title="Ce qui reste ouvert">
        {ouvert.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien en attente. Tout est à jour.</p>
        ) : (
          <ul className="space-y-2">
            {ouvert.map((x) => (
              <li
                key={x.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-gold-600"
              >
                {x.icon}
                <span className="font-serif text-lg font-semibold">{x.n}</span>
                <span className="text-muted-foreground">{x.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* À surveiller demain */}
      <Section title="À surveiller demain">
        {review.demain.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien de particulier. Bonne soirée.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-foreground">
            {review.demain.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4">
        <p className="font-serif text-lg font-semibold text-foreground">Tout est tracé.</p>
        <p className="text-sm text-foreground">
          <strong>Demain est prêt.</strong> Vous pouvez rentrer chez vous.
        </p>
        <Button size="lg" className="mt-3" onClick={onPreparerDemain}>
          Préparer demain <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
