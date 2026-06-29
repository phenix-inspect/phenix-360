import { Button, Card, CardContent } from '@phenix360/ui';
import { CheckCircle2, ClipboardCheck, Lightbulb, TriangleAlert } from 'lucide-react';
import type { LaunchNote } from '@phenix360/core';

/**
 * « Note de lancement » — la note de passation d'un conducteur senior qui a
 * étudié le dossier avant vous. Équilibrée : préparé · rassure · attention ·
 * conseils. Vivante (recalculée à chaque évolution du dossier/journal).
 */
export function LaunchNotePanel({
  note,
  onAskDocument,
}: {
  note: LaunchNote;
  onAskDocument: (docId: string) => void;
}): React.JSX.Element {
  const p = note.prepared;
  const preparedLine = [
    `${p.roadmap} étapes`,
    `${p.orders} commandes`,
    `${p.selections} choix client`,
    `${p.documents} documents triés`,
    p.hasPlanning ? 'planning proposé' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="border-gold-200 bg-gold-50 shadow-gold">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">
            <ClipboardCheck aria-hidden />
          </span>
          <div>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Ma note de lancement
            </h2>
            <p className="text-sm text-muted-foreground">
              J'ai étudié votre dossier avant vous — voici ce que j'en retiens.
            </p>
          </div>
        </div>

        <Block title="Ce que j'ai déjà préparé pour vous" tone="prepared">
          <p className="text-sm text-foreground">{preparedLine}.</p>
        </Block>

        {note.reassuring.length > 0 && (
          <Block title="Ce qui me rassure" tone="reassuring">
            <ul className="space-y-1.5">
              {note.reassuring.map((f) => (
                <Line key={f.id} icon={<CheckCircle2 aria-hidden />} tone="reassuring">
                  {f.title}
                </Line>
              ))}
            </ul>
          </Block>
        )}

        {note.attention.length > 0 && (
          <Block title="Ce qui mérite votre attention" tone="attention">
            <ul className="space-y-1.5">
              {note.attention.map((f) => (
                <Line key={f.id} icon={<TriangleAlert aria-hidden />} tone="attention">
                  {f.title}
                </Line>
              ))}
            </ul>
          </Block>
        )}

        {note.advice.length > 0 && (
          <Block title="Ce que je vous conseille de faire ensuite" tone="advice">
            <ol className="space-y-2">
              {note.advice.map((a, i) => {
                const docId = a.action?.type === 'document' ? a.action.docId : null;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <span className="flex items-start gap-2 text-sm text-foreground">
                      <span className="font-mono text-xs text-gold-700">{i + 1}.</span>
                      {a.title}
                    </span>
                    {docId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => onAskDocument(docId)}
                      >
                        Demander au client
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          </Block>
        )}
      </CardContent>
    </Card>
  );
}

type Tone = 'prepared' | 'reassuring' | 'attention' | 'advice';

const TONE_ICON_COLOR: Record<Tone, string> = {
  prepared: 'text-gold-700',
  reassuring: 'text-success',
  attention: 'text-gold-700',
  advice: 'text-gold-700',
};

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: Tone;
  children: React.ReactNode;
}): React.JSX.Element {
  const Icon =
    tone === 'advice' ? Lightbulb : tone === 'reassuring' ? CheckCircle2 : ClipboardCheck;
  return (
    <section className="space-y-2">
      <p
        className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide [&_svg]:size-4 ${TONE_ICON_COLOR[tone]}`}
      >
        <Icon aria-hidden />
        {title}
      </p>
      {children}
    </section>
  );
}

function Line({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: 'reassuring' | 'attention';
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li
      className={`flex items-start gap-2 text-sm text-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${
        tone === 'reassuring' ? '[&_svg]:text-success' : '[&_svg]:text-gold-600'
      }`}
    >
      {icon}
      <span>{children}</span>
    </li>
  );
}
