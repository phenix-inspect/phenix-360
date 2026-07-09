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

type Filtre = 'tous' | 'a_traiter' | 'non_lus' | 'repondus';

/**
 * Onglet « Demandes client » — le TABLEAU DE PILOTAGE des demandes créées via
 * Léon (pas une messagerie). Il regroupe tout l'historique, filtrable, sans
 * polluer le Suivi. Modèle « 1 demande = 1 réponse » : le conducteur ouvre une
 * demande (elle passe « Lu »), y répond une fois (elle passe « Répondu » et
 * quitte « Aujourd'hui »), et la trace reste ici comme au Suivi.
 *
 * Statuts croisés :
 *  • À traiter  = pas encore répondue (`state === 'ouverte'`) ;
 *  • Répondu    = réponse conducteur enregistrée ;
 *  • Non lu     = jamais ouverte par le conducteur (accusé `seen['compagnon']`).
 */
export function DemandesClientTab({
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
  const seen = snap.seen['compagnon'] ?? {};

  const repondu = (d: DemandeEvent): boolean => demandeRepondue(d);
  const aTraiter = (d: DemandeEvent): boolean => !repondu(d);
  // « Non lu » = jamais ouverte ET pas encore répondue (une demande répondue
  // est « Répondu », jamais « Non lu »).
  const nonLu = (d: DemandeEvent): boolean => !seen[d.id] && !repondu(d);

  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = {
    tous: demandes.length,
    a_traiter: demandes.filter(aTraiter).length,
    non_lus: demandes.filter(nonLu).length,
    repondus: demandes.filter(repondu).length,
  };
  const matches = (d: DemandeEvent): boolean =>
    filtre === 'tous'
      ? true
      : filtre === 'a_traiter'
        ? aTraiter(d)
        : filtre === 'non_lus'
          ? nonLu(d)
          : repondu(d);
  const visibles = demandes.filter(matches);

  // Ouvrir une demande = la marquer LUE (le badge « non lu » diminue), sans la
  // clôturer : la réponse reste une action distincte (1 demande = 1 réponse).
  const toggle = (d: DemandeEvent): void => {
    setOpenId((cur) => (cur === d.id ? null : d.id));
    if (nonLu(d)) demo.markSeen('compagnon', [d.id]);
  };

  const filtres: { value: Filtre; label: string }[] = [
    { value: 'tous', label: `Tous (${counts.tous})` },
    { value: 'a_traiter', label: `À traiter (${counts.a_traiter})` },
    { value: 'non_lus', label: `Non lus (${counts.non_lus})` },
    { value: 'repondus', label: `Répondus (${counts.repondus})` },
  ];

  return (
    <div className="space-y-4" data-tab="demandes-client">
      <header className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-foreground">Demandes client</h2>
        <p className="text-sm text-muted-foreground">
          Toutes les demandes envoyées par le client via Léon. Un tableau de pilotage : vous ouvrez,
          vous répondez une fois. La trace reste au Suivi.
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
              ? 'Les demandes que le client envoie via Léon apparaîtront ici.'
              : 'Aucune demande ne correspond à ce filtre.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map((d) => {
            const isOpen = openId === d.id;
            const inconnu = nonLu(d);
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
                      {inconnu && <Badge variant="info">Non lu</Badge>}
                      <Badge variant={repondu(d) ? 'success' : 'warning'}>
                        {repondu(d) ? 'Répondu' : 'À traiter'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {nameOf(snap, d.actor.userId)} · {fmtDateTime(d.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`block truncate text-sm ${inconnu ? 'font-semibold text-foreground' : 'text-foreground'}`}
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
                    <DemandeThread
                      demande={d}
                      actor={actor}
                      nameOf={(u) => nameOf(snap, u)}
                      canReply
                    />
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
