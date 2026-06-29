import { Banknote, FileText, Lock, Palette, Plus, TriangleAlert } from 'lucide-react';
import {
  consolidateDevis,
  consolidatedLotTotalHT,
  consolidatedTotals,
  devisVigilances,
  originLabel,
  type Avenant,
  type ConsolidatedPoste,
  type Devis,
  type ProjectDossier,
} from '@phenix360/core';
import { fmtMoney } from '../lib/format';

/**
 * Lecture du devis signé : lots → postes (quantités, montants, TVA, matériaux),
 * totaux ventilés par taux. Vue CONSOLIDÉE et APPEND-ONLY : devis initial +
 * avenants. Chaque poste connaît son origine (« Devis initial » / « Avenant
 * n°X ») ; un poste remplacé ne disparaît pas — il reste visible, barré, marqué
 * « remplacé par avenant n°X ». Le devis signé est IMMUABLE : on ne le « corrige »
 * jamais ; une erreur se traite en vigilance ou par un nouvel avenant.
 */
export function DevisBreakdown({
  devis,
  avenants = [],
  dossier,
  onOpen,
}: {
  devis: Devis;
  avenants?: Avenant[];
  dossier: ProjectDossier;
  onOpen?: (anchor: string) => void;
}): React.JSX.Element {
  const consolidated = consolidateDevis(devis, avenants);
  const totals = consolidatedTotals(consolidated);
  const vigilances = devisVigilances(devis);

  return (
    <div className="space-y-3">
      {avenants.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-gold-800 [&_svg]:size-4">
            <Plus aria-hidden />
            {avenants.length} avenant{avenants.length > 1 ? 's' : ''} intégré
            {avenants.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-0.5 text-xs text-gold-800/90">
            {consolidated.avenants.map((a) => (
              <li key={a.numero}>
                Avenant n°{a.numero}
                {a.label ? ` — ${a.label}` : ''}
                {a.date ? ` · signé le ${frDate(a.date)}` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Le devis initial n'est jamais modifié : chaque avenant s'ajoute et les montants
            ci-dessous tiennent compte des postes remplacés.
          </p>
        </div>
      )}

      {consolidated.lots.map((lot) => {
        const orders = lot.orderIds
          .map((id) => dossier.orders.find((o) => o.id === id))
          .filter((o): o is NonNullable<typeof o> => o != null);
        const selections = lot.selectionIds
          .map((id) => dossier.selections.find((s) => s.id === id))
          .filter((s): s is NonNullable<typeof s> => s != null);
        const documents = lot.documentIds
          .map((id) => dossier.documents.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => d != null);
        const lotVigilances = vigilances.filter((v) => v.lotLabel === lot.label);
        const hasLinks =
          orders.length + selections.length + documents.length + lotVigilances.length > 0;

        return (
          <div
            key={lot.label}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-paper-50 px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">{lot.label}</p>
              <p className="font-mono text-sm text-foreground">
                {fmtMoney(consolidatedLotTotalHT(lot))} HT
              </p>
            </div>
            <ul className="divide-y divide-border">
              {lot.postes.map((cp) => (
                <PosteRow key={cp.poste.id} cp={cp} />
              ))}
            </ul>

            {hasLinks && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
                {orders.map((o) => (
                  <LinkChip
                    key={o.id}
                    icon={<Banknote aria-hidden />}
                    label={`Commande · ${o.label}`}
                    onClick={onOpen ? () => onOpen(`order-${o.id}`) : undefined}
                  />
                ))}
                {selections.map((s) => (
                  <LinkChip
                    key={s.id}
                    icon={<Palette aria-hidden />}
                    label={`Choix · ${s.categorie}`}
                    onClick={onOpen ? () => onOpen(`selection-${s.id}`) : undefined}
                  />
                ))}
                {documents.map((d) => (
                  <LinkChip
                    key={d.id}
                    icon={<FileText aria-hidden />}
                    label={`Document · ${d.label}`}
                    onClick={onOpen ? () => onOpen(`document-${d.id}`) : undefined}
                  />
                ))}
                {lotVigilances.map((v) => (
                  <LinkChip
                    key={v.id}
                    tone="warn"
                    icon={<TriangleAlert aria-hidden />}
                    label="Vigilance"
                    title={v.message}
                    onClick={onOpen ? () => onOpen('note-lancement') : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

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
        {avenants.length > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            Total à jour, avenants compris (postes remplacés exclus).
          </p>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
        <Lock aria-hidden />
        Le devis signé est immuable. En cas d'erreur ou d'évolution, PHÉNIX la signale (vigilance)
        ou ajoute un avenant — il ne modifie jamais le document signé.
      </p>
    </div>
  );
}

/** Une ligne de poste : libellé + détail, badge d'origine, état « remplacé ». */
function PosteRow({ cp }: { cp: ConsolidatedPoste }): React.JSX.Element {
  const { poste: p, origin, replacedByNumero } = cp;
  const replaced = replacedByNumero != null;
  return (
    <li
      className={`flex items-baseline justify-between gap-3 px-4 py-2 text-sm ${
        replaced ? 'bg-paper-50/60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate ${replaced ? 'text-muted-foreground line-through' : 'text-foreground'}`}
          >
            {p.label}
          </p>
          <OriginBadge label={originLabel(origin)} kind={origin.kind} />
          {replaced && (
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
              remplacé par avenant n°{replacedByNumero}
            </span>
          )}
        </div>
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
        <p
          className={`font-mono ${replaced ? 'text-muted-foreground line-through' : 'text-foreground'}`}
        >
          {fmtMoney(p.montantHT)}
        </p>
        <p className="text-xs text-muted-foreground">TVA {p.tva} %</p>
      </div>
    </li>
  );
}

function OriginBadge({
  label,
  kind,
}: {
  label: string;
  kind: 'initial' | 'avenant';
}): React.JSX.Element {
  const cls =
    kind === 'avenant'
      ? 'border-gold-300 bg-gold-50 text-gold-800'
      : 'border-border bg-paper-50 text-muted-foreground';
  return <span className={`rounded-full border px-2 py-0.5 text-[0.6875rem] ${cls}`}>{label}</span>;
}

const frDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

function LinkChip({
  icon,
  label,
  title,
  tone = 'default',
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  tone?: 'default' | 'warn';
  onClick?: () => void;
}): React.JSX.Element {
  const cls =
    tone === 'warn'
      ? 'border-gold-300 bg-gold-50 text-gold-800'
      : 'border-border bg-surface text-muted-foreground';
  const interactive = onClick ? 'hover:border-gold-300 hover:text-foreground' : 'cursor-default';
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={!onClick}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs [&_svg]:size-3.5 ${cls} ${interactive}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
