import { Badge } from '@phenix360/ui';
import { buildSmartPlanning, type ProjectDossier } from '@phenix360/core';
import { fmtDate, fmtDateShort } from '../lib/format';
import { PlanningFrieze } from './PlanningFrieze';

/**
 * « Les grandes étapes du chantier » — la lecture CLIENT du planning. Elle
 * n'apparaît QU'À PARTIR de la validation de la date de démarrage : avant, le
 * client ne voit aucun planning. Une fois daté, il voit une version simplifiée
 * (grandes étapes, date de début, date de fin prévisionnelle, état de chaque
 * étape) — jamais les durées métier, les séchages, les commandes, les
 * dépendances techniques ni aucune contrainte interne.
 */
export function GrandesEtapes({ dossier }: { dossier: ProjectDossier }): React.JSX.Element | null {
  const planning = buildSmartPlanning(dossier);
  // Tant que la date de démarrage n'est pas validée : rien côté client.
  if (!planning.dated || planning.phases.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const stepState = (start?: string, end?: string): 'À venir' | 'En cours' | 'Terminée' => {
    if (end && end < today) return 'Terminée';
    if (start && start <= today) return 'En cours';
    return 'À venir';
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Début :{' '}
            <span className="font-medium text-foreground">{fmtDate(planning.startDate!)}</span>
          </span>
          {planning.endDate && (
            <span className="text-muted-foreground">
              Fin prévue :{' '}
              <span className="font-medium text-foreground">{fmtDate(planning.endDate)}</span>
            </span>
          )}
        </div>
        <PlanningFrieze phases={planning.phases} dated />
      </div>

      <ol className="overflow-hidden rounded-2xl border border-border bg-surface">
        {planning.phases.map((ph, i) => {
          const state = stepState(ph.start, ph.end);
          return (
            <li
              key={ph.stepId}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-100 font-mono text-xs font-semibold text-gold-800">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{ph.label}</p>
                {ph.start && ph.end && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {fmtDateShort(ph.start)} → {fmtDateShort(ph.end)}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  state === 'Terminée' ? 'success' : state === 'En cours' ? 'info' : 'neutral'
                }
              >
                {state}
              </Badge>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
