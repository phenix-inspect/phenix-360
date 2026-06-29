import { buildSmartPlanning, type ProjectDossier } from '@phenix360/core';
import { fmtDateShort } from '../lib/format';

/**
 * « Les grandes étapes du chantier » — la lecture CLIENT du planning de
 * référence : simple, rassurante, sans jargon (jamais le mot « Gantt »). Les
 * dates n'apparaissent qu'une fois la date de démarrage validée.
 */
export function GrandesEtapes({ dossier }: { dossier: ProjectDossier }): React.JSX.Element | null {
  const planning = buildSmartPlanning(dossier);
  if (planning.phases.length === 0) return null;

  return (
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
  );
}
