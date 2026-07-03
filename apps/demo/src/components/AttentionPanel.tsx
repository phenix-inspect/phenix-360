import { Button, Card, CardContent } from '@phenix360/ui';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
  FilePlus2,
  HelpCircle,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { AttentionItem, AttentionKind } from '@phenix360/core';

const KIND_ICON: Record<AttentionKind, React.ReactNode> = {
  commande: <Banknote aria-hidden />,
  document: <FileText aria-hidden />,
  question: <Sparkles aria-hidden />,
  decision: <HelpCircle aria-hidden />,
  echeance: <CalendarDays aria-hidden />,
  avenant: <FilePlus2 aria-hidden />,
};

const KIND_LABEL: Record<AttentionKind, string> = {
  commande: 'Commande',
  document: 'Document',
  question: 'Question',
  decision: 'Décision client',
  echeance: 'Échéance',
  avenant: 'Avenant',
};

/**
 * Priorité entre blocages : décision client, puis impact avenant, puis commande
 * critique, puis document bloquant.
 */
const KIND_RANK: Record<AttentionKind, number> = {
  decision: 0,
  avenant: 1,
  commande: 2,
  document: 3,
  question: 4,
  echeance: 5,
};

const dot = (s: AttentionItem['severity']): string =>
  s === 'warning' ? 'bg-gold-500' : s === 'success' ? 'bg-success' : 'bg-info';

/** Un radar, pas une liste : 3 blocages maximum. Le reste est dans la Préparation. */
const MAX_VISIBLE = 3;

/**
 * « PHÉNIX surveille votre chantier » — le RADAR du conducteur : en 10 secondes,
 * « qu'est-ce qui bloque réellement mon chantier maintenant ? ». On ne montre que
 * les blocages (`warning`), 3 au maximum, triés par priorité. Le contexte non
 * bloquant (phases à venir, questions) vit dans la Préparation. Les éléments
 * rassurants sont condensés en une ligne (VISION Art. 3, 7, 10, 11).
 */
export function AttentionPanel({
  items,
  onAskDocument,
  onOpenPreparation,
}: {
  items: AttentionItem[];
  onAskDocument: (docId: string) => void;
  onOpenPreparation: () => void;
}): React.JSX.Element {
  // Radar = uniquement ce qui bloque réellement le chantier.
  const blockers = items
    .filter((i) => i.severity === 'warning')
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
  const securedCount = items.filter((i) => i.severity === 'success').length;

  const visible = blockers.slice(0, MAX_VISIBLE);
  const overflow = blockers.length - visible.length;
  const actionable = blockers;

  return (
    <Card data-testid="attention-panel" className="border-gold-200 bg-gold-50 shadow-gold">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">
            <Wand2 aria-hidden />
          </span>
          <div>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              PHÉNIX surveille votre chantier
            </h2>
            <p className="text-sm text-muted-foreground">
              {actionable.length > 0
                ? 'Voici ce qui mérite votre attention aujourd’hui.'
                : 'Tout est sous contrôle aujourd’hui.'}
            </p>
          </div>
        </div>

        {actionable.length === 0 && securedCount === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-success">
            <CheckCircle2 aria-hidden />
            Aucune action urgente — votre chantier est bien préparé.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 ${
                  item.kind === 'avenant'
                    ? 'animate-in fade-in-0 slide-in-from-top-1 duration-base'
                    : ''
                }`}
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot(item.severity)}`} />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
                  {KIND_ICON[item.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {KIND_LABEL[item.kind]}
                    {item.avenant && (
                      <span
                        title={`${item.avenant.added} prestation(s) ajoutée(s) · ${item.avenant.replaced} modifiée(s)`}
                        className="rounded-full border border-border bg-paper-50 px-2 py-0.5 font-mono text-[0.6875rem] normal-case tracking-normal text-muted-foreground animate-in fade-in-0 zoom-in-95 duration-base"
                      >
                        +{item.avenant.added} / ~{item.avenant.replaced}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-foreground">{item.message}</p>
                </div>
                {item.kind === 'document' && item.docId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onAskDocument(item.docId!)}
                  >
                    Demander
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={onOpenPreparation}
                  >
                    Ouvrir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {securedCount > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-success">
            <CheckCircle2 aria-hidden />
            {securedCount} phase{securedCount > 1 ? 's' : ''}{' '}
            {securedCount > 1 ? 'sont sécurisées' : 'est sécurisée'} côté commandes.
          </p>
        )}

        {overflow > 0 && (
          <button
            type="button"
            onClick={onOpenPreparation}
            className="text-sm font-medium text-gold-700 underline-offset-4 hover:underline"
          >
            + {overflow} autre{overflow > 1 ? 's' : ''} point{overflow > 1 ? 's' : ''} à traiter →
            Préparation
          </button>
        )}
      </CardContent>
    </Card>
  );
}
