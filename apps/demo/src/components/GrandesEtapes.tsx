import { buildSmartPlanning, type ProjectDossier } from '@phenix360/core';
import { fmtDateShort, fmtDuree } from '../lib/format';
import { PlanningFrieze } from './PlanningFrieze';

/**
 * « Les grandes étapes du chantier » — la lecture CLIENT du planning de
 * référence : simple, rassurante, sans jargon (jamais le mot « Gantt »). Une
 * frise visuelle légère pour saisir le déroulé d'un coup d'œil, puis la liste
 * des étapes. Les dates n'apparaissent qu'une fois la date de démarrage validée.
 */
export function GrandesEtapes({ dossier }: { dossier: ProjectDossier }): React.JSX.Element | null {
  const planning = buildSmartPlanning(dossier);
  if (planning.phases.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <p className="font-mono text-xs text-gold-700">
          {planning.announcedLabel
            ? `Durée annoncée : ${planning.announcedLabel}`
            : `Durée estimée : ${fmtDuree(planning.estimatedDays)}`}
        </p>
        <PlanningFrieze phases={planning.phases} dated={planning.dated} />
      </div>

      <ol className="overflow-hidden rounded-2xl border border-border bg-surface">
        {planning.phases.map((ph, i) => (
          <li
            key={ph.stepId}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-100 font-mono text-xs font-semibold text-gold-800">
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">{ph.label}</span>
            {ph.start && ph.end && (
              <span className="font-mono text-xs text-muted-foreground">
                {fmtDateShort(ph.start)} → {fmtDateShort(ph.end)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
