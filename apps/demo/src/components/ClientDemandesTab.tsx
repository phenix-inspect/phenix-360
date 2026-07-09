import { useState } from 'react';
import { Badge, EmptyState, SegmentedControl } from '@phenix360/ui';
import {
  demandeRepondue,
  demandesPourPhenix,
  type DemandeEvent,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { ChevronDown, Inbox } from 'lucide-react';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';
import { DemandeThread } from './DemandeThread';

type Filtre = 'tous' | 'en_attente' | 'repondues' | 'non_lues';

/**
 * « Vos demandes » (côté client) — l'historique des échanges avec PHÉNIX via Léon.
 * Répond à UNE question : « Où en sont mes échanges avec PHÉNIX ? ». Même logique
 * que le tableau conducteur, adaptée au client : lecture seule (le client ne
 * répond pas ici — il parle à Léon), filtres simples, et un repère « non lu » sur
 * les demandes dont la RÉPONSE n'a pas encore été ouverte.
 *
 * Statuts (client-safe, jamais le « à traiter » interne) :
 *  • En attente = transmise, pas encore répondue ;
 *  • Répondu    = PHÉNIX a répondu ;
 *  • Non lue    = répondue mais la réponse n'a pas encore été ouverte.
 */
export function ClientDemandesTab({
  snap,
  project,
  actor,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
}): React.JSX.Element {
  const events = snap.events.filter((e) => e.projectId === project.id);
  const demandes = demandesPourPhenix(events).filter((e) => e.actor.role === 'client');
  const seen = snap.seen['client'] ?? {};

  const repondu = (d: DemandeEvent): boolean => demandeRepondue(d);
  const enAttente = (d: DemandeEvent): boolean => !repondu(d);
  const nonLue = (d: DemandeEvent): boolean => repondu(d) && !seen[d.id];

  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = {
    tous: demandes.length,
    en_attente: demandes.filter(enAttente).length,
    repondues: demandes.filter(repondu).length,
    non_lues: demandes.filter(nonLue).length,
  };
  const matches = (d: DemandeEvent): boolean =>
    filtre === 'tous'
      ? true
      : filtre === 'en_attente'
        ? enAttente(d)
        : filtre === 'repondues'
          ? repondu(d)
          : nonLue(d);
  const visibles = demandes.filter(matches);

  // Ouvrir une demande = marquer sa réponse LUE (le repère « non lu » s'éteint).
  const toggle = (d: DemandeEvent): void => {
    setOpenId((cur) => (cur === d.id ? null : d.id));
    if (nonLue(d)) demo.markSeen('client', [d.id]);
  };

  const filtres: { value: Filtre; label: string }[] = [
    { value: 'tous', label: `Tous (${counts.tous})` },
    { value: 'en_attente', label: `En attente (${counts.en_attente})` },
    { value: 'repondues', label: `Répondues (${counts.repondues})` },
    { value: 'non_lues', label: `Non lues (${counts.non_lues})` },
  ];

  return (
    <div className="space-y-4" data-tab="client-demandes">
      <header className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-foreground">Vos demandes</h2>
        <p className="text-sm text-muted-foreground">
          Tout ce que vous avez demandé à PHÉNIX via Léon, et ses réponses. Pour une nouvelle
          demande, parlez simplement à Léon.
        </p>
      </header>

      <div className="overflow-x-auto">
        <SegmentedControl value={filtre} onValueChange={setFiltre} options={filtres} />
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden />}
          title="Aucune demande"
          description={
            filtre === 'tous'
              ? 'Posez votre question à Léon : vous la retrouverez ici, avec sa réponse.'
              : 'Aucune demande ne correspond à ce filtre.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map((d) => {
            const isOpen = openId === d.id;
            const nl = nonLue(d);
            return (
              <li
                key={d.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(d)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {nl && <Badge variant="info">Nouvelle réponse</Badge>}
                      <Badge variant={repondu(d) ? 'success' : 'warning'}>
                        {repondu(d) ? 'Répondu' : 'En attente'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(d.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`block truncate text-sm ${nl ? 'font-semibold text-foreground' : 'text-foreground'}`}
                    >
                      {d.content.question}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-border p-4">
                    <DemandeThread demande={d} actor={actor} nameOf={(u) => nameOf(snap, u)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
