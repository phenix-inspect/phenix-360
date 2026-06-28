import { useState } from 'react';
import { Button, Textarea } from '@phenix360/ui';
import type { Decision, EventActor } from '@phenix360/core';
import { demo } from '../store';

/**
 * Réponse du client à une décision attendue. Aucune logique métier : appelle le
 * port `demo.resolveDemande`. Réutilisé par le bandeau intelligent et la liste
 * des décisions.
 */
export function DecisionResponder({
  decision,
  actor,
  className,
}: {
  decision: Decision;
  actor: EventActor;
  className?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState('');

  const submit = async () => {
    if (!texte.trim()) return;
    await demo.resolveDemande(decision.eventId, {
      texte: texte.trim(),
      resolvedBy: actor.userId,
      resolvedAt: new Date().toISOString(),
    });
    setTexte('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className={className}>
        Répondre
      </Button>
    );
  }

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
        <Button size="sm" onClick={() => void submit()}>
          Valider ma décision
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
