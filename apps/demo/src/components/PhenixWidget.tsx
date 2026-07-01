import { useEffect, useRef, useState } from 'react';
import { Button } from '@phenix360/ui';
import { isDemande, type EventActor, type Project } from '@phenix360/core';
import { ArrowRight, Send, Sparkles, X } from 'lucide-react';
import { conversationOf, demo, type DemoSnapshot, type PhenixMessage } from '../store';

const SUGGESTIONS = [
  'Est-ce que je dois faire quelque chose ?',
  'Où en est le chantier ?',
  'Où est le devis signé ?',
  'Quand est prévue la livraison ?',
];

/**
 * PHÉNIX — le concierge du client (B1). Bouton flottant premium + panneau de
 * conversation. PHÉNIX répond simplement quand il sait (avec la source), propose
 * l'action attendue (« toujours faire avancer »), et transmet à l'équipe quand
 * il ne sait pas — puis reprend le fil dès que le conducteur a répondu. Aucune
 * mécanique interne visible.
 */
export function PhenixWidget({
  snap,
  project,
  actor,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const messages = conversationOf(snap, project.id);
  const events = snap.events.filter((e) => e.projectId === project.id);

  // Reprise d'escalade : si la demande liée a été répondue, PHÉNIX a une réponse.
  const reponseFor = (demandeRef?: string): string | null => {
    if (!demandeRef) return null;
    const e = events.find((x) => x.id === demandeRef);
    if (e && isDemande(e) && (e.state === 'traitee' || e.state === 'close')) {
      return e.content.resolution?.texte ?? null;
    }
    return null;
  };

  useEffect(() => {
    if (open && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text: string): Promise<void> => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setDraft('');
    await demo.askPhenix(project.id, actor, t);
    setBusy(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir PHÉNIX"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-ink-900 py-3 pl-3 pr-5 text-paper-0 shadow-lg transition-transform duration-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
        >
          <span className="grid size-8 place-items-center rounded-full bg-gold-500/20 text-gold-300 [&_svg]:size-5">
            <Sparkles aria-hidden />
          </span>
          <span className="text-left leading-tight">
            <span className="block font-serif text-sm font-semibold">PHÉNIX</span>
            <span className="block text-[0.65rem] text-paper-0/70">Une question ?</span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-modal flex justify-end">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-lg">
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-ink-900 text-gold-300 [&_svg]:size-5">
                <Sparkles aria-hidden />
              </span>
              <div className="flex-1">
                <p className="font-serif text-lg font-semibold leading-tight text-foreground">
                  PHÉNIX
                </p>
                <p className="text-xs text-muted-foreground">Votre suivi de chantier, en direct.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-5"
              >
                <X aria-hidden />
              </button>
            </header>

            {/* Thread */}
            <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <PhenixBubble
                text={
                  'Bonjour 👋 Je suis PHÉNIX. Je connais votre chantier : posez-moi une question, ' +
                  'je vous réponds simplement.'
                }
              />
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  m={m}
                  reponse={reponseFor(m.demandeRef)}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>

            {/* Footer */}
            <footer className="border-t border-border px-5 py-4">
              {messages.length === 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold-300 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Écrivez à PHÉNIX…"
                  className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-input bg-surface px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <Button
                  size="icon"
                  aria-label="Envoyer"
                  disabled={!draft.trim() || busy}
                  onClick={() => void send(draft)}
                >
                  <Send aria-hidden />
                </Button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function MessageRow({
  m,
  reponse,
  onClose,
}: {
  m: PhenixMessage;
  reponse: string | null;
  onClose: () => void;
}): React.JSX.Element {
  if (m.role === 'client') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-900 px-4 py-2.5 text-sm text-paper-0">
          {m.texte}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <PhenixBubble text={m.texte} />
      {m.sources && m.sources.length > 0 && (
        <p className="pl-1 text-xs italic text-muted-foreground">
          Réponse basée sur {m.sources.map((s) => s.clientLabel).join(', ')}.
        </p>
      )}
      {m.avancer && (
        <div className="ml-1 rounded-xl border border-gold-200 bg-gold-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
            Pour faire avancer votre chantier
          </p>
          <p className="mt-0.5 text-sm text-foreground">{m.avancer.label}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{m.avancer.effort}</span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline [&_svg]:size-3.5"
            >
              Le faire maintenant <ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      )}
      {m.kind === 'escalade' &&
        (reponse ? (
          <PhenixBubble
            text={`J'ai une réponse concernant votre question : ${reponse}`}
            highlight
          />
        ) : (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-700">
            En attente de l'équipe PHÉNIX
          </span>
        ))}
    </div>
  );
}

function PhenixBubble({
  text,
  highlight,
}: {
  text: string;
  highlight?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink-900 text-gold-300 [&_svg]:size-3.5">
        <Sparkles aria-hidden />
      </span>
      <p
        className={`max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm ${
          highlight
            ? 'border border-gold-300 bg-gold-50 text-foreground'
            : 'border border-border bg-surface text-foreground'
        }`}
      >
        {text}
      </p>
    </div>
  );
}
