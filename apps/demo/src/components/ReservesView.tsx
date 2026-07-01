import { Badge, Button, Card, CardContent, EmptyState } from '@phenix360/ui';
import {
  leveeDeReserve,
  reserveEvents,
  reserveStatut,
  type Event,
  type Project,
  type ReserveEvent,
} from '@phenix360/core';
import { CircleCheck, Flag, Image as ImageIcon } from 'lucide-react';
import { nameOf, type DemoSnapshot } from '../store';
import { fmtDate, fmtDateShort } from '../lib/format';

/**
 * Vue RÉSERVES — pilotage opérationnel. C'est une LECTURE des événements du
 * journal (réserves + levées), jamais une base séparée : le Journal reste la
 * source de vérité, aucune duplication. On regroupe les réserves ouvertes
 * (à traiter) et levées (mémoire), avec responsable, échéance, lien retour vers
 * la photo annotée, action « Lever » et preuve de levée.
 */
export function ReservesView({
  snap,
  project,
  events,
  onLeverReserve,
  onOpenFilPhoto,
}: {
  snap: DemoSnapshot;
  project: Project;
  events: Event[];
  onLeverReserve: (reserve: ReserveEvent) => void;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const all = reserveEvents(events);
  const ouvertes = all.filter((r) => reserveStatut(r, events) === 'ouverte');
  const levees = all.filter((r) => reserveStatut(r, events) === 'levee');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          Réserves du chantier
        </h2>
        <p className="text-sm text-muted-foreground">
          Le pilotage des points à reprendre — une lecture du journal, jamais un double.
        </p>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={<Flag aria-hidden />}
          title="Aucune réserve"
          description="Créez une réserve depuis une photo annotée du Fil : elle apparaîtra ici, prête à être suivie puis levée."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              À lever
              <Badge variant={ouvertes.length > 0 ? 'warning' : 'neutral'}>{ouvertes.length}</Badge>
            </h3>
            {ouvertes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Toutes les réserves sont levées. Rien à reprendre pour le moment.
              </p>
            ) : (
              <ul className="space-y-3">
                {ouvertes.map((r) => {
                  const overdue = r.content.echeance != null && r.content.echeance < today;
                  return (
                    <li key={r.id}>
                      <Card>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
                              <Flag aria-hidden />
                              <span className="font-medium">Réserve n°{r.content.numero}</span>
                            </div>
                            <Badge variant="warning">ouverte</Badge>
                          </div>

                          <p className="text-sm text-foreground">{r.content.libelle}</p>

                          <MetaLine
                            responsable={r.content.responsable}
                            echeance={r.content.echeance}
                            overdue={overdue}
                          />

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <Button size="sm" onClick={() => onLeverReserve(r)}>
                              <CircleCheck aria-hidden /> Lever la réserve
                            </Button>
                            {r.content.source?.kind === 'fil' && (
                              <VoirLaPhoto source={r.content.source} onOpen={onOpenFilPhoto} />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              Levées
              <Badge variant={levees.length > 0 ? 'success' : 'neutral'}>{levees.length}</Badge>
            </h3>
            {levees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réserve levée pour l'instant.</p>
            ) : (
              <ul className="space-y-3">
                {levees.map((r) => {
                  const levee = leveeDeReserve(r, events);
                  return (
                    <li key={r.id}>
                      <Card>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-success">
                              <CircleCheck aria-hidden />
                              <span className="font-medium">Réserve n°{r.content.numero}</span>
                            </div>
                            <Badge variant="success">levée</Badge>
                          </div>

                          <p className="text-sm text-foreground">{r.content.libelle}</p>

                          <MetaLine
                            responsable={r.content.responsable}
                            echeance={r.content.echeance}
                            overdue={false}
                          />

                          {levee && (
                            <div className="rounded-lg border border-border bg-paper-50 p-3">
                              <p className="text-xs text-muted-foreground">
                                Levée le {fmtDate(levee.createdAt)} par{' '}
                                {nameOf(snap, levee.actor.userId)}
                              </p>
                              {levee.content.note && (
                                <p className="mt-1 text-sm text-foreground">{levee.content.note}</p>
                              )}
                              {levee.content.preuve && (
                                <img
                                  src={levee.content.preuve.imageUrl}
                                  alt="Photo de preuve de la levée"
                                  className="mt-2 aspect-[4/3] w-32 rounded-lg border border-border object-cover"
                                />
                              )}
                            </div>
                          )}

                          {r.content.source?.kind === 'fil' && (
                            <VoirLaPhoto source={r.content.source} onOpen={onOpenFilPhoto} />
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MetaLine({
  responsable,
  echeance,
  overdue,
}: {
  responsable?: string;
  echeance?: string;
  overdue: boolean;
}): React.JSX.Element | null {
  if (!responsable && !echeance) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {responsable && (
        <span>
          Responsable : <span className="text-foreground">{responsable}</span>
        </span>
      )}
      {echeance && (
        <span className={overdue ? 'text-destructive' : undefined}>
          Échéance :{' '}
          <span className={overdue ? 'font-medium' : 'text-foreground'}>
            {fmtDateShort(echeance)}
          </span>
          {overdue ? ' · en retard' : ''}
        </span>
      )}
    </div>
  );
}

function VoirLaPhoto({
  source,
  onOpen,
}: {
  source: { momentId: string; photoId?: string };
  onOpen: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpen(source.momentId, source.photoId)}
      className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 underline-offset-4 hover:underline [&_svg]:size-3.5"
    >
      <ImageIcon aria-hidden /> Voir la photo
    </button>
  );
}
