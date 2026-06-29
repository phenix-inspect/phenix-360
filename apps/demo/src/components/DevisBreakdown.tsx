import { devisTotals, lotTotalHT, type Devis } from '@phenix360/core';
import { fmtMoney } from '../lib/format';

/**
 * Lecture du devis signé : lots → postes (quantités, montants, TVA, matériaux),
 * avec les totaux ventilés par taux. Présentation premium et sobre, en lecture
 * seule — la matière première que PHÉNIX a extraite, que le conducteur relit.
 */
export function DevisBreakdown({ devis }: { devis: Devis }): React.JSX.Element {
  const totals = devisTotals(devis);

  return (
    <div className="space-y-3">
      {devis.lots.map((lot) => (
        <div key={lot.id} className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-paper-50 px-4 py-2.5">
            <p className="text-sm font-medium text-foreground">{lot.label}</p>
            <p className="font-mono text-sm text-foreground">{fmtMoney(lotTotalHT(lot))} HT</p>
          </div>
          <ul className="divide-y divide-border">
            {lot.postes.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      p.quantite != null ? `${p.quantite} ${p.unite ?? ''}`.trim() : p.unite,
                      p.prixUnitaireHT != null ? `${fmtMoney(p.prixUnitaireHT)} / u` : null,
                      p.materiau,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-foreground">{fmtMoney(p.montantHT)}</p>
                  <p className="text-xs text-muted-foreground">TVA {p.tva} %</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="space-y-1 rounded-xl border border-border bg-paper-50 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total HT</span>
          <span className="font-mono text-foreground">{fmtMoney(totals.ht)}</span>
        </div>
        {totals.parTaux.map((t) => (
          <div key={t.taux} className="flex justify-between text-xs text-muted-foreground">
            <span>TVA {t.taux} %</span>
            <span className="font-mono">{fmtMoney(t.tva)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-border pt-1.5 font-medium">
          <span className="text-foreground">Total TTC</span>
          <span className="font-mono text-gold-800">{fmtMoney(totals.ttc)}</span>
        </div>
      </div>
    </div>
  );
}
