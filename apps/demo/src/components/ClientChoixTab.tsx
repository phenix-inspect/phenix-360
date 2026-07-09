import { useState } from 'react';
import { Badge, EmptyState, SegmentedControl } from '@phenix360/ui';
import { isPhenixDelegate, type ClientDecision } from '@phenix360/core';
import { MessageSquare, Palette, Sparkles } from 'lucide-react';
import { ClientDecisionBanner } from './ClientDecisionBanner';
import { demo } from '../store';

type Filtre = 'tous' | 'en_attente' | 'repondu';

/**
 * « Vos choix » (côté client) — l'historique des DÉCISIONS demandées au client :
 * carrelage, peinture, robinetterie, poignées, dates… Répond à UNE question :
 * « Quelles décisions ai-je prises ou dois-je encore prendre ? ». Chaque choix
 * porte un statut ; les choix actionnables (une proposition à valider) restent
 * actionnables ici. Jamais de délais fournisseurs ni de mécanique interne.
 *
 * Statuts : En attente (pas encore validé) · Répondu (validé) · Annulé (réservé —
 * aucun choix n'est annulable pour l'instant).
 */
export function ClientChoixTab({
  decisions,
  onValidate,
}: {
  decisions: ClientDecision[];
  onValidate: (d: ClientDecision, optionId?: string, comment?: string) => Promise<void>;
}): React.JSX.Element {
  const enAttente = (d: ClientDecision): boolean => d.pending;
  const repondu = (d: ClientDecision): boolean => !d.pending;

  const [filtre, setFiltre] = useState<Filtre>('tous');

  const counts = {
    tous: decisions.length,
    en_attente: decisions.filter(enAttente).length,
    repondu: decisions.filter(repondu).length,
  };
  const matches = (d: ClientDecision): boolean =>
    filtre === 'tous' ? true : filtre === 'en_attente' ? enAttente(d) : repondu(d);
  const visibles = decisions.filter(matches);

  const filtres: { value: Filtre; label: string }[] = [
    { value: 'tous', label: `Tous (${counts.tous})` },
    { value: 'en_attente', label: `En attente (${counts.en_attente})` },
    { value: 'repondu', label: `Répondu (${counts.repondu})` },
  ];

  return (
    <div className="space-y-4" data-tab="client-choix">
      <header className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-foreground">Vos choix</h2>
        <p className="text-sm text-muted-foreground">
          Toutes les décisions que PHÉNIX vous demande — celles à prendre et celles déjà validées.
        </p>
      </header>

      <div className="overflow-x-auto">
        <SegmentedControl value={filtre} onValueChange={setFiltre} options={filtres} />
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icon={<Palette aria-hidden />}
          title="Aucun choix"
          description={
            filtre === 'tous'
              ? 'Les décisions que PHÉNIX vous demandera apparaîtront ici.'
              : 'Aucun choix ne correspond à ce filtre.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map((d) =>
            d.clientActionable ? (
              // Choix à valider : le client agit directement (proposition à trancher).
              <li key={d.id}>
                <ClientDecisionBanner
                  decision={d}
                  onOpen={() => demo.markChoixOpenedByClient([d.id])}
                  onValidate={(optionId, comment) => onValidate(d, optionId, comment)}
                />
              </li>
            ) : (
              <li
                key={d.id}
                className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
                      {d.categorie}
                    </p>
                    <p className="truncate text-sm text-foreground">{d.label}</p>
                  </div>
                  <Badge variant={repondu(d) ? 'success' : 'warning'}>
                    {repondu(d) ? 'Répondu' : 'En attente'}
                  </Badge>
                </div>
                {repondu(d) && <ChoixReponse decision={d} />}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Rappel au client de CE QU'IL A CHOISI : l'option retenue en clair (libellé +
 * photo) et son commentaire — jamais un simple numéro. Rassure et fait foi.
 */
function ChoixReponse({ decision }: { decision: ClientDecision }): React.JSX.Element {
  const delegated =
    isPhenixDelegate(decision.chosenOptionId ?? undefined) || decision.options.length === 0;
  const idx = decision.options.findIndex((o) => o.id === decision.chosenOptionId);
  const chosen = idx >= 0 ? decision.options[idx] : undefined;
  const letter = idx >= 0 ? String.fromCharCode(65 + idx) : '';

  return (
    <div className="rounded-xl border border-success/40 bg-success/5 p-3">
      {delegated || !chosen ? (
        <p className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Sparkles aria-hidden />
          {chosen ? chosen.title : (decision.detail ?? 'Choix confié à PHÉNIX')}
        </p>
      ) : (
        <div className="flex items-start gap-3">
          {chosen.imageUrl && (
            <img
              src={chosen.imageUrl}
              alt={chosen.title}
              className="size-16 shrink-0 rounded-md object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-success">Votre choix</p>
            <p className="text-sm font-semibold text-foreground">
              Option {letter} — {chosen.title}
            </p>
            {chosen.description && (
              <p className="text-xs text-muted-foreground">{chosen.description}</p>
            )}
          </div>
        </div>
      )}
      {decision.clientComment && (
        <p className="mt-2 flex items-start gap-2 text-sm text-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
          <MessageSquare aria-hidden />
          <span className="italic">« {decision.clientComment} »</span>
        </p>
      )}
    </div>
  );
}
