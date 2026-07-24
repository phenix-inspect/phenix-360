import { CalendarClock } from 'lucide-react';
import { nextClientMilestone, type ProjectDossier, type ProjectStatus } from '@phenix360/core';
import { GrandesEtapes } from './GrandesEtapes';

/** « 3 septembre 2026 » — date d'un jalon (jour ancré à midi local, sans décalage). */
const fmtJalon = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const DAY_MS = 86_400_000;
const daysUntil = (iso: string, nowMs: number): number =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - nowMs) / DAY_MS);

/**
 * « Planning de votre projet » — bloc de l'Espace client qui montre les GRANDES
 * ÉTAPES (démarrage, pré-réception, réception…), jamais le planning technique. Il
 * réutilise `GrandesEtapes` (source unique `buildClientPlanning`) : les dates
 * viennent du chantier conducteur et se mettent à jour toutes seules.
 */
export function ClientPlanningBlock({
  status,
  dossier,
}: {
  status: ProjectStatus;
  dossier: ProjectDossier | null;
}): React.JSX.Element {
  return (
    <section
      id="section-planning"
      data-testid="client-planning"
      className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
        <CalendarClock aria-hidden />
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Planning de votre projet
        </h2>
      </div>
      <GrandesEtapes status={status} dossier={dossier} />
    </section>
  );
}

/**
 * Rappel « Aujourd'hui » de la PROCHAINE grande étape : « Pré-réception dans
 * 5 jours » ou « Réception prévue le 25 septembre 2026 ». Le client sait toujours
 * quelle est la prochaine étape et quand, sans avoir à demander à Léon.
 */
export function ClientProchaineEtape({
  status,
  dossier,
}: {
  status: ProjectStatus;
  dossier: ProjectDossier | null;
}): React.JSX.Element | null {
  const next = nextClientMilestone(status, dossier);
  if (!next) return null;

  let quand: string;
  if (next.date) {
    const d = daysUntil(next.date, Date.now());
    quand =
      d <= 0
        ? "aujourd'hui"
        : d === 1
          ? 'demain'
          : d <= 14
            ? `dans ${d} jours`
            : `prévue le ${fmtJalon(next.date)}`;
  } else if (next.estimate) {
    quand = next.estimate;
  } else {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        document
          .getElementById('section-planning')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      data-testid="prochaine-etape"
      className="flex w-full items-center gap-3 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-left text-sm text-gold-800 transition-colors duration-base hover:bg-gold-100 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-gold-600"
    >
      <CalendarClock aria-hidden />
      <span>
        Prochaine étape&nbsp;: <span className="font-semibold">{next.label}</span> {quand}.
      </span>
    </button>
  );
}
