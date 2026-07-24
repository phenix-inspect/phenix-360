import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@phenix360/ui';
import { ROLE_LABEL, type Message } from '@phenix360/core';
import { Send } from 'lucide-react';
import { Avatar } from '../Avatar';
import { fmtDateTime } from '../../lib/format';

/**
 * Messages sous un Moment (niveau 1). Vocabulaire apaisé — « Laisser un
 * message », pas « commenter ». Panneau sobre, jamais un mur de commentaires.
 */
export function MessageThread({
  messages,
  nameOf,
  onSend,
  autoFocus = false,
}: {
  messages: Message[];
  nameOf: (userId: string) => string;
  onSend: (texte: string) => void;
  /** Poser le curseur dans le champ (ouvert depuis une notification). */
  autoFocus?: boolean;
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ouvert depuis une notification : le champ de réponse est prêt à écrire.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const send = (): void => {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft('');
  };

  return (
    <div className="space-y-3">
      {messages.length > 0 && (
        <ul className="space-y-2.5">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={nameOf(m.authorId)} className="size-7 text-[0.625rem]" />
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{nameOf(m.authorId)}</span>{' '}
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABEL[m.authorRole]} · {fmtDateTime(m.createdAt)}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-foreground">{m.texte}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un petit mot…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <Button size="sm" variant="outline" onClick={send} disabled={!draft.trim()}>
          <Send aria-hidden />
        </Button>
      </div>
    </div>
  );
}
