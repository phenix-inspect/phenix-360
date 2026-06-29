import { useState } from 'react';
import { Button } from '@phenix360/ui';
import { Sparkles } from 'lucide-react';
import type { ClientDecision } from '@phenix360/core';
import { fmtDate } from '../lib/format';

/**
 * Décision client, vue CLIENT — ultra simple. Le bandeau reste la règle absolue
 * (« Une décision vous attend ») ; au clic, le client voit UNIQUEMENT la
 * décision concernée et deux actions claires. Jamais de délais fournisseurs, de
 * dépendances, de commandes, de calculs internes ni d'alertes conducteur.
 */
export function ClientDecisionBanner({
  decision,
  onValidate,
  onModify,
}: {
  decision: ClientDecision;
  onValidate: () => Promise<void>;
  onModify: () => Promise<void>;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    setOpen(false);
  };

  const titre = `Votre choix ${decision.categorie.toLowerCase()} est attendu`;

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
              Action requise
            </p>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {open ? titre : 'Une décision vous attend'}
            </h2>
            {open ? (
              <p className="text-sm leading-relaxed text-ink-600">
                Pour conserver le planning prévu, j'ai besoin de votre validation
                {decision.decideAvant ? (
                  <>
                    {' '}
                    avant le{' '}
                    <span className="font-medium text-foreground">
                      {fmtDate(decision.decideAvant)}
                    </span>
                  </>
                ) : (
                  ' dès que possible'
                )}
                .{decision.detail ? ` Proposition : ${decision.detail}.` : ''}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-ink-600">{titre}.</p>
            )}
          </div>

          {open ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void run(onValidate)}>
                Valider le choix proposé
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run(onModify)}
              >
                Demander une modification
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>
              Voir la décision
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
