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

const dot = (s: AttentionItem['severity']): string =>
  s === 'warning' ? 'bg-gold-500' : s === 'success' ? 'bg-success' : 'bg-info';

/**
 * « PHÉNIX surveille votre chantier » — synthèse prioritaire de l'accueil
 * Compagnon. Pas un tableau technique : ce qui mérite l'attention aujourd'hui.
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
  const actionable = items.filter((i) => i.severity !== 'success').length;

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
              {actionable > 0
                ? 'Voici ce qui mérite votre attention aujourd’hui.'
                : 'Tout est sous contrôle aujourd’hui.'}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-success">
            <CheckCircle2 aria-hidden />
            Aucune action urgente — votre chantier est bien préparé.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
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
      </CardContent>
    </Card>
  );
}
