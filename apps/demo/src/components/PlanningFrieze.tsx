import { type PlanningPhase } from '@phenix360/core';
import { fmtMonth } from '../lib/format';

/**
 * Frise du chantier — une lecture visuelle légère, sobre et éditoriale du
 * déroulé. Jamais un Gantt technique : pas de grille dense, pas de ressources,
 * pas de jargon. Deux lectures du même enchaînement :
 *  • préparé → déroulé relatif (durées proportionnelles), sans dates ;
 *  • daté → lecture calendaire alignée sur les mois.
 */
export function PlanningFrieze({
  phases,
  dated,
}: {
  phases: PlanningPhase[];
  dated: boolean;
}): React.JSX.Element | null {
  if (phases.length === 0) return null;

  // Poids de chaque phase (durée + séchage), pour des largeurs proportionnelles.
  const weights = phases.map((p) => p.durationDays + (p.drying ?? 0));
  const total = weights.reduce((a, w) => a + w, 0) || 1;

  // Repères de mois (état daté uniquement) : début de chaque mois traversé.
  const months = dated ? monthMarkers(phases) : [];

  return (
    <div className="space-y-2">
      {months.length > 0 && (
        <div className="flex items-baseline gap-2 overflow-hidden">
          {months.map((m) => (
            <span
              key={m.iso}
              className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground"
              style={{ width: `${m.share * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex h-2 overflow-hidden rounded-full bg-paper-100">
        {phases.map((p, i) => (
          <span
            key={p.stepId}
            title={p.label}
            className={i % 2 === 0 ? 'h-full bg-gold-400' : 'h-full bg-gold-200'}
            style={{ width: `${(weights[i]! / total) * 100}%` }}
          />
        ))}
      </div>

      <ol className="flex gap-2 overflow-hidden">
        {phases.map((p, i) => (
          <li
            key={p.stepId}
            className="min-w-0 shrink-0"
            style={{ width: `${(weights[i]! / total) * 100}%` }}
          >
            <p className="truncate text-[0.7rem] font-medium text-foreground">{p.label}</p>
            <p className="truncate text-[0.65rem] text-muted-foreground">
              {dated && p.start ? fmtMonth(p.start).replace(/\s\d{4}$/, '') : `${p.durationDays} j`}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Largeur relative de chaque mois traversé par le chantier (état daté). */
function monthMarkers(phases: PlanningPhase[]): { iso: string; label: string; share: number }[] {
  const first = phases[0]?.start;
  const last = phases[phases.length - 1]?.end;
  if (!first || !last) return [];
  const start = new Date(`${first}T00:00:00`).getTime();
  const end = new Date(`${last}T00:00:00`).getTime();
  const span = Math.max(1, end - start);

  const out: { iso: string; label: string; share: number }[] = [];
  const cursor = new Date(`${first}T00:00:00`);
  cursor.setDate(1);
  while (cursor.getTime() <= end) {
    const monthStart = Math.max(start, cursor.getTime());
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    const monthEnd = Math.min(end, next.getTime());
    out.push({
      iso: cursor.toISOString().slice(0, 7),
      label: cursor.toLocaleDateString('fr-FR', { month: 'short' }),
      share: (monthEnd - monthStart) / span,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
