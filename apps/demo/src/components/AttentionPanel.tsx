import { useState } from 'react';
import { Button, Card, CardContent } from '@phenix360/ui';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
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
};

const KIND_LABEL: Record<AttentionKind, string> = {
  commande: 'Commande',
  document: 'Document',
  question: 'Question',
  decision: 'Décision client',
  echeance: 'Échéance',
};

/** Priorité : décisions client, puis commandes critiques, puis documents bloquants. */
const KIND_RANK: Record<AttentionKind, number> = {
  decision: 0,
  commande: 1,
  document: 2,
  question: 3,
  echeance: 4,
};
const SEVERITY_RANK = { warning: 0, info: 1, success: 2 } as const;

const dot = (s: AttentionItem['severity']): string =>
  s === 'warning' ? 'bg-gold-500' : s === 'success' ? 'bg-success' : 'bg-info';

const DEFAULT_VISIBLE = 3;

/**
 * « PHÉNIX surveille votre chantier » — briefing de chef de chantier : en 5
 * secondes, les 3 priorités du jour. Les risques bloquants remontent ; les
 * éléments rassurants sont condensés en une ligne. « Voir tout » déplie le reste.
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
  const [expanded, setExpanded] = useState(false);

  const actionable = items
    .filter((i) => i.severity !== 'success')
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        KIND_RANK[a.kind] - KIND_RANK[b.kind],
    );
  const securedCount = items.filter((i) => i.severity === 'success').length;

  const visible = expanded ? actionable : actionable.slice(0, DEFAULT_VISIBLE);
  const hidden = actionable.length - visible.length;

  return (
    <Card className="border-gold-200 bg-gold-50 shadow-gold">
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
                className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot(item.severity)}`} />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
                  {KIND_ICON[item.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {KIND_LABEL[item.kind]}
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
                ) : item.kind === 'commande' ||
                  item.kind === 'question' ||
                  item.kind === 'decision' ||
                  item.kind === 'echeance' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground"
                    onClick={onOpenPreparation}
                  >
                    Ouvrir
                  </Button>
                ) : null}
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

        {(hidden > 0 || (expanded && actionable.length > DEFAULT_VISIBLE)) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-gold-700 underline-offset-4 hover:underline"
          >
            {expanded ? 'Réduire' : `Voir tout (${actionable.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
