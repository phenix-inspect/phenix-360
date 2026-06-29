import { buildSmartPlanning, type ProjectDossier } from '@phenix360/core';
import { Banknote, CalendarClock, Palette, TriangleAlert } from 'lucide-react';
import { fmtDateShort } from '../lib/format';

/**
 * Planning intelligent (vue conducteur), en deux états :
 *  • préparé (sans date de démarrage) → ordre, durées, dépendances, commandes à
 *    anticiper, décisions à obtenir — sans dates calendaires ;
 *  • daté → dates de phase + dates limites de commande et de choix.
 * Dérivé du dossier (vivant).
 */
export function SmartPlanningView({
  dossier,
}: {
  dossier: ProjectDossier;
}): React.JSX.Element | null {
  const planning = buildSmartPlanning(dossier);
  if (planning.phases.length === 0) return null;

  return (
    <div className="space-y-3">
      {!planning.dated && (
        <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-ink-700">
          Planning préparé — validez la date de démarrage et je date tout (phases, commandes,
          décisions).
        </p>
      )}

      <ol className="space-y-3">
        {planning.phases.map((ph) => (
          <li key={ph.stepId} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-medium text-foreground">{ph.label}</h4>
              <span className="font-mono text-xs text-muted-foreground">
                {ph.start && ph.end
                  ? `${fmtDateShort(ph.start)} → ${fmtDateShort(ph.end)} · ${ph.durationDays} j`
                  : `${ph.durationDays} j`}
              </span>
            </div>

            {(ph.orders.length > 0 || ph.choices.length > 0) && (
              <ul className="mt-2 space-y-1.5">
                {ph.choices.map((c) => (
                  <li
                    key={c.selectionId}
                    className="flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0"
                  >
                    <Palette aria-hidden className="text-gold-600" />
                    <span className={c.pending ? 'text-foreground' : 'text-muted-foreground'}>
                      {c.figerAvant
                        ? `Choix ${c.categorie.toLowerCase()} à figer avant le ${fmtDateShort(c.figerAvant)}`
                        : `Choix ${c.categorie.toLowerCase()} à obtenir`}
                      {c.pending ? '' : ' — validé'}
                    </span>
                  </li>
                ))}
                {ph.orders.map((o) => (
                  <li
                    key={o.orderId}
                    className="flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0"
                  >
                    {o.risk ? (
                      <TriangleAlert aria-hidden className="text-gold-700" />
                    ) : (
                      <Banknote aria-hidden className="text-muted-foreground" />
                    )}
                    <span className={o.risk ? 'text-gold-800' : 'text-muted-foreground'}>
                      {o.commanderAvant
                        ? `Commander ${o.label.toLowerCase()} avant le ${fmtDateShort(o.commanderAvant)}${
                            o.risk ? ' — délai tendu' : ''
                          }`
                        : `Commande à anticiper : ${o.label.toLowerCase()}${
                            o.delaiJours ? ` (délai ${o.delaiJours} j)` : ''
                          }`}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {ph.drying != null && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">
                <CalendarClock aria-hidden />+ {ph.drying} j de séchage avant la suite
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
