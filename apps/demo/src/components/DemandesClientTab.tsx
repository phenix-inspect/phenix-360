import { useState } from 'react';
import { Badge, EmptyState, SegmentedControl } from '@phenix360/ui';
import {
  demandeRepondue,
  demandesPourPhenix,
  type ClientSelection,
  type DemandeEvent,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { ChevronDown, Inbox } from 'lucide-react';
import { demo, dossierOf, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';
import { DemandeThread } from './DemandeThread';
import { ChoixClientCard, type ChoixStatus } from './ChoixClientCard';

type Filtre = 'tous' | 'demandes' | 'choix' | 'non_lus' | 'en_attente' | 'repondus';

/** Élément unifié du tableau de pilotage : une demande simple OU un choix client. */
type Item =
  | { type: 'demande'; id: string; createdAt: string; status: ChoixStatus; demande: DemandeEvent }
  | {
      type: 'choix';
      id: string;
      createdAt: string;
      status: ChoixStatus;
      selection: ClientSelection;
    };

/**
 * Onglet « Demandes client » — le TABLEAU DE PILOTAGE de TOUT ce que le
 * conducteur échange avec le client, sans nouvel onglet ni doublon :
 *  • DEMANDES simples (posées via Léon) : « 1 demande = 1 réponse » ;
 *  • CHOIX CLIENT (« Demander au client → Demande de choix ») : un objet pilotable
 *    avec options, photos et réponse.
 *
 * Statuts (normalisés pour le filtrage) :
 *  • Non lu       = pas encore ouvert (demande : par le conducteur ; choix : par le
 *    client) et sans réponse ;
 *  • En attente   = ouvert mais pas encore répondu ;
 *  • Répondu      = réponse enregistrée (demande) / option choisie (choix).
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
  const seenCompagnon = snap.seen['compagnon'] ?? {};
  const seenClient = snap.seen['client'] ?? {};
  const dossier = dossierOf(snap, project.id);

  // --- DEMANDES simples (via Léon) -----------------------------------------
  const demandeItems: Item[] = demandesPourPhenix(events)
    .filter((e) => e.actor.role === 'client')
    .map((d): Item => {
      const status: ChoixStatus = demandeRepondue(d)
        ? 'repondu'
        : seenCompagnon[d.id]
          ? 'en_attente'
          : 'non_lu';
      return { type: 'demande', id: d.id, createdAt: d.createdAt, status, demande: d };
    });

  // --- CHOIX CLIENT (proposés au client, à suivre ici) ----------------------
  // Un choix « envoyé » au client = une sélection PROPOSÉE ou déjà VALIDÉE. Sa
  // date vient de la trace `decision`/`envoyee` (repli : création du dossier).
  const envoyeeAt = new Map<string, string>();
  for (const e of events)
    if (e.type === 'decision' && e.content.kind === 'envoyee')
      envoyeeAt.set(e.content.selectionId, e.createdAt);
  const choixItems: Item[] = (dossier?.selections ?? [])
    .filter((s) => s.statut === 'propose' || s.statut === 'valide')
    .map((s): Item => {
      const status: ChoixStatus =
        s.statut === 'valide' ? 'repondu' : seenClient[s.id] ? 'en_attente' : 'non_lu';
      return {
        type: 'choix',
        id: s.id,
        createdAt: envoyeeAt.get(s.id) ?? dossier?.createdAt ?? project.createdAt,
        status,
        selection: s,
      };
    });

  const items = [...demandeItems, ...choixItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );

  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [openId, setOpenId] = useState<string | null>(null);

  const matches = (it: Item): boolean => {
    switch (filtre) {
      case 'tous':
        return true;
      case 'demandes':
        return it.type === 'demande';
      case 'choix':
        return it.type === 'choix';
      case 'non_lus':
        return it.status === 'non_lu';
      case 'en_attente':
        return it.status === 'en_attente';
      case 'repondus':
        return it.status === 'repondu';
    }
  };
  const visibles = items.filter(matches);

  const counts = {
    tous: items.length,
    demandes: items.filter((i) => i.type === 'demande').length,
    choix: items.filter((i) => i.type === 'choix').length,
    non_lus: items.filter((i) => i.status === 'non_lu').length,
    en_attente: items.filter((i) => i.status === 'en_attente').length,
    repondus: items.filter((i) => i.status === 'repondu').length,
  };
  const filtres: { value: Filtre; label: string }[] = [
    { value: 'tous', label: `Tous (${counts.tous})` },
    { value: 'demandes', label: `Demandes (${counts.demandes})` },
    { value: 'choix', label: `Choix client (${counts.choix})` },
    { value: 'non_lus', label: `Non lus (${counts.non_lus})` },
    { value: 'en_attente', label: `En attente (${counts.en_attente})` },
    { value: 'repondus', label: `Répondus (${counts.repondus})` },
  ];

  // Ouvrir une DEMANDE simple la marque LUE (côté conducteur). Ouvrir un CHOIX ne
  // change JAMAIS son statut : c'est l'ouverture par le CLIENT qui compte.
  const toggle = (it: Item): void => {
    setOpenId((cur) => (cur === it.id ? null : it.id));
    if (it.type === 'demande' && it.status === 'non_lu') demo.markSeen('compagnon', [it.id]);
  };

  return (
    <div className="space-y-4" data-tab="demandes-client">
      <header className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-foreground">Demandes client</h2>
        <p className="text-sm text-muted-foreground">
          Toutes les demandes et les choix de votre client. Un tableau de pilotage : vous suivez le
          statut, vous répondez une fois. La trace reste au Suivi.
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
              ? 'Les demandes et les choix de votre client apparaîtront ici.'
              : 'Aucun élément ne correspond à ce filtre.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map((it) => {
            const isOpen = openId === it.id;
            const nonLu = it.status === 'non_lu';
            const title =
              it.type === 'demande' ? it.demande.content.question : it.selection.categorie;
            return (
              <li
                key={it.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(it)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {it.type === 'choix' && <Badge variant="gold">Choix client</Badge>}
                      {nonLu && <Badge variant="info">Non lu</Badge>}
                      <Badge variant={badgeVariant(it)}>{badgeLabel(it)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {nameOf(
                          snap,
                          it.type === 'demande' ? it.demande.actor.userId : project.clientId,
                        )}{' '}
                        · {fmtDateTime(it.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`block truncate text-sm ${nonLu ? 'font-semibold text-foreground' : 'text-foreground'}`}
                    >
                      {title}
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
                    {it.type === 'demande' ? (
                      <DemandeThread
                        demande={it.demande}
                        actor={actor}
                        nameOf={(u) => nameOf(snap, u)}
                        canReply
                      />
                    ) : (
                      <ChoixClientCard
                        selection={it.selection}
                        createdAt={it.createdAt}
                        status={it.status}
                      />
                    )}
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

/** Libellé du badge de statut selon le type et l'état. */
function badgeLabel(it: Item): string {
  if (it.status === 'repondu') return 'Répondu';
  if (it.type === 'choix') return it.status === 'en_attente' ? 'En attente' : 'Non lu';
  // Demande simple : le conducteur agit → « À traiter » tant qu'il n'a pas répondu.
  return 'À traiter';
}
function badgeVariant(it: Item): 'success' | 'warning' {
  return it.status === 'repondu' ? 'success' : 'warning';
}
