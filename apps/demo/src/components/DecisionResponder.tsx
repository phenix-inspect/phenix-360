import { useRef, useState } from 'react';
import { Button, Textarea } from '@phenix360/ui';
import { Paperclip, X } from 'lucide-react';
import type { Decision, EventActor, EventAttachment } from '@phenix360/core';
import { demo } from '../store';
import { MAX_DOC_MB, readDocumentAttachment } from '../lib/upload';
import { ACCEPT_DOCUMENT } from '../lib/media';

/**
 * Réponse du client à une demande adressée par le conducteur. Deux natures :
 *  • décision simple → un message (le choix / la réponse) ;
 *  • demande de DOCUMENT (`attendu === 'document'`) → échange documentaire : le
 *    client JOINT un document (PDF / image), le commentaire est facultatif. Trois
 *    cas possibles : commentaire seul, document seul, document + commentaire.
 * Aucune logique métier : appelle les ports `demo.resolveDemande` /
 * `demo.resolveDocumentDemande`.
 */
export function DecisionResponder({
  decision,
  actor,
  className,
  onResolved,
}: {
  decision: Decision;
  actor: EventActor;
  className?: string;
  /** Appelé après une réponse RÉUSSIE — permet un accusé rassurant côté client. */
  onResolved?: (kind: 'reponse' | 'document') => void;
}): React.JSX.Element {
  const isDocument = decision.attendu === 'document';
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState('');
  const [pending, setPending] = useState<EventAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setTexte('');
    setPending(null);
    setError(null);
    setOpen(false);
  };

  const onPick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setError(null);
    const res = await readDocumentAttachment(decision.projectId, file);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPending(res.value);
  };

  const submitDocument = async (): Promise<void> => {
    if (busy || (!pending && !texte.trim())) return;
    setBusy(true);
    try {
      await demo.resolveDocumentDemande(decision.eventId, {
        projectId: decision.projectId,
        actor,
        texte: texte.trim(),
        ...(pending ? { attachment: pending } : {}),
        ...(decision.docLibelle ? { libelle: decision.docLibelle } : {}),
        ...(decision.docCategorie ? { categorie: decision.docCategorie } : {}),
      });
      reset();
      onResolved?.('document');
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async (): Promise<void> => {
    if (!texte.trim() || busy) return;
    // Verrou anti double-envoi (double-clic → deux réponses sur la même demande).
    setBusy(true);
    try {
      await demo.resolveDemande(decision.eventId, {
        texte: texte.trim(),
        resolvedBy: actor.userId,
        resolvedAt: new Date().toISOString(),
      });
      reset();
      onResolved?.('reponse');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className={className}>
        {isDocument ? 'Répondre / joindre un document' : 'Répondre'}
      </Button>
    );
  }

  if (!isDocument) {
    return (
      <div className={className}>
        <Textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={2}
          placeholder="Votre décision…"
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={busy || !texte.trim()} onClick={() => void submitDecision()}>
            Valider ma décision
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_DOCUMENT}
        className="hidden"
        data-testid="client-doc-file"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Paperclip aria-hidden />
          {pending ? pending.fileName : `Joindre un document (PDF ou photo, max ${MAX_DOC_MB} Mo)`}
        </Button>
        {pending && (
          <button
            type="button"
            aria-label="Retirer le document"
            onClick={() => setPending(null)}
            className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
          >
            <X aria-hidden />
          </button>
        )}
      </div>
      <Textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={2}
        placeholder="Ajouter un commentaire (facultatif)…"
        className="mt-2"
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() => void submitDocument()}
          disabled={busy || (!pending && !texte.trim())}
        >
          Envoyer
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
