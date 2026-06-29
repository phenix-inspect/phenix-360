import { useState } from 'react';
import { Button, Textarea } from '@phenix360/ui';
import { Lock, Sparkles } from 'lucide-react';
import { proposalNoun, type ClientDecision } from '@phenix360/core';
import { fmtDate } from '../lib/format';
import { ProposalGallery } from './ProposalGallery';

/**
 * Décision client, vue CLIENT — ultra simple. Le bandeau reste la règle absolue
 * (« Une décision vous attend ») ; au clic, le client voit UNIQUEMENT la
 * décision concernée. Quand PHÉNIX a préparé des propositions, il les présente
 * comme des ambiances soignées (photo + titre + description) ; le client
 * sélectionne celle qu'il préfère. Jamais de délais fournisseurs, de
 * dépendances, de commandes, de calculs internes ni d'alertes conducteur.
 */
export function ClientDecisionBanner({
  decision,
  onValidate,
  onModify,
}: {
  decision: ClientDecision;
  onValidate: (optionId?: string) => Promise<void>;
  onModify: (message: string) => Promise<void>;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const cat = decision.categorie.toLowerCase();
  const hasOptions = decision.options.length > 0;
  const canValidate = !hasOptions || selectedId != null;

  const validate = async () => {
    if (!canValidate) return;
    setBusy(true);
    await onValidate(selectedId ?? undefined);
    setBusy(false);
    setOpen(false);
  };

  const sendModification = async () => {
    if (!message.trim()) return;
    setBusy(true);
    await onModify(message.trim());
    setBusy(false);
    setMessage('');
    setModifying(false);
    setOpen(false);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-200 bg-gold-50 p-6 shadow-gold sm:p-7">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">
          <Sparkles aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
              Action requise
            </p>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {open ? `Votre validation ${cat} est attendue` : 'Une décision vous attend'}
            </h2>
            {open ? (
              <div className="space-y-1 text-sm leading-relaxed text-ink-600">
                {decision.decideAvant && (
                  <p>
                    Pour conserver le planning prévu, j'ai besoin de votre validation avant le{' '}
                    <span className="font-medium text-foreground">
                      {fmtDate(decision.decideAvant)}
                    </span>
                    .
                  </p>
                )}
                {hasOptions ? (
                  <p>
                    J'ai préparé plusieurs {proposalNoun(decision.categorie)} pour votre {cat}.
                    Sélectionnez celle que vous préférez.
                  </p>
                ) : (
                  <p>
                    {decision.detail
                      ? `Proposition : ${decision.detail}.`
                      : 'Indiquez-moi votre préférence.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-ink-600">
                J'ai besoin de votre validation sur votre {cat}.
              </p>
            )}
          </div>

          {!open && (
            <Button size="sm" onClick={() => setOpen(true)}>
              Voir la décision
            </Button>
          )}

          {open && !modifying && (
            <div className="space-y-4">
              {hasOptions && (
                <ProposalGallery
                  options={decision.options}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || !canValidate} onClick={() => void validate()}>
                  {hasOptions ? 'Valider mon choix' : 'Valider le choix proposé'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setModifying(true)}
                >
                  {hasOptions ? 'Je souhaite une modification' : 'Demander une modification'}
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
                <Lock aria-hidden />
                Votre choix sera enregistré et partagé avec l'équipe projet.
              </p>
            </div>
          )}

          {open && modifying && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Que souhaitez-vous modifier ?
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Décrivez ce que vous aimeriez changer…"
                  className="mt-1.5"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy || !message.trim()}
                  onClick={() => void sendModification()}
                >
                  Envoyer ma demande
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setModifying(false);
                    setMessage('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
