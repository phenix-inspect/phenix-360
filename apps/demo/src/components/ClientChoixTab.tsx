import { useState } from 'react';
import { Badge, EmptyState, SegmentedControl } from '@phenix360/ui';
import type { ClientDecision } from '@phenix360/core';
import { Palette } from 'lucide-react';
import { ClientDecisionBanner } from './ClientDecisionBanner';

type Filtre = 'tous' | 'en_attente' | 'repondu' | 'annule';

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
  onValidate: (d: ClientDecision, optionId?: string) => Promise<void>;
}): React.JSX.Element {
  const enAttente = (d: ClientDecision): boolean => d.pending;
  const repondu = (d: ClientDecision): boolean => !d.pending;

  const [filtre, setFiltre] = useState<Filtre>('tous');

  const counts = {
    tous: decisions.length,
    en_attente: decisions.filter(enAttente).length,
    repondu: decisions.filter(repondu).length,
    annule: 0,
  };
  const matches = (d: ClientDecision): boolean =>
    filtre === 'tous'
      ? true
      : filtre === 'en_attente'
        ? enAttente(d)
        : filtre === 'repondu'
          ? repondu(d)
          : false; // « annulé » : aucun choix annulable pour l'instant
  const visibles = decisions.filter(matches);

  const filtres: { value: Filtre; label: string }[] = [
    { value: 'tous', label: `Tous (${counts.tous})` },
    { value: 'en_attente', label: `En attente (${counts.en_attente})` },
    { value: 'repondu', label: `Répondu (${counts.repondu})` },
    { value: 'annule', label: `Annulé (${counts.annule})` },
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
                  onValidate={(optionId) => onValidate(d, optionId)}
                />
              </li>
            ) : (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
                    {d.categorie}
                  </p>
                  <p className="truncate text-sm text-foreground">{d.label}</p>
                  {d.detail && <p className="truncate text-xs text-muted-foreground">{d.detail}</p>}
                </div>
                <Badge variant={repondu(d) ? 'success' : 'warning'}>
                  {repondu(d) ? 'Répondu' : 'En attente'}
                </Badge>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
