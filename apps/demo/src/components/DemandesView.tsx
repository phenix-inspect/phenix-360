import { useState } from 'react';
import { Badge, Button, Card, CardContent, EmptyState, Input, Textarea } from '@phenix360/ui';
import {
  DEMANDE_PRIORITES,
  DEMANDE_PRIORITE_LABEL,
  demandeStatutLabel,
  isDemandeActive,
  teamDemandes,
  type DemandeActivite,
  type DemandeEvent,
  type DemandePriorite,
  type Event,
  type EventActor,
  type EventState,
} from '@phenix360/core';
import {
  CheckCircle2,
  CornerUpLeft,
  Flag,
  HelpCircle,
  Image as ImageIcon,
  MessageSquare,
  PlayCircle,
  UserPlus,
} from 'lucide-react';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';

/**
 * Vue DEMANDES — le poste de pilotage du conducteur. Lecture des demandes
 * équipe du journal (jamais un double), avec cycle de vie complet :
 * ouverte → en cours → répondue → fermée. Responsable, priorité, commentaires
 * et timeline sont portés par la demande (append-only). Aucune logique métier
 * ici : on lit les sélecteurs core et on déclenche les actions du store.
 */
export function DemandesView({
  snap,
  events,
  actor,
  onOpenFilPhoto,
}: {
  snap: DemoSnapshot;
  events: Event[];
  actor: EventActor;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const demandes = teamDemandes(events);
  const actives = demandes.filter(isDemandeActive);
  const traitees = demandes.filter((d) => !isDemandeActive(d));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          Demandes de l'équipe
        </h2>
        <p className="text-sm text-muted-foreground">
          Le suivi des points à traiter — une lecture du journal, jamais un double.
        </p>
      </div>

      {demandes.length === 0 ? (
        <EmptyState
          icon={<HelpCircle aria-hidden />}
          title="Aucune demande"
          description="Les demandes adressées à l'équipe apparaîtront ici, prêtes à être prises en charge puis résolues."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              À traiter
              <Badge variant={actives.length > 0 ? 'warning' : 'neutral'}>{actives.length}</Badge>
            </h3>
            {actives.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune demande en attente. Tout est traité.
              </p>
            ) : (
              <ul className="space-y-3">
                {actives.map((d) => (
                  <li key={d.id}>
                    <DemandeCard
                      demande={d}
                      snap={snap}
                      actor={actor}
                      onOpenFilPhoto={onOpenFilPhoto}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              Traitées
              <Badge variant={traitees.length > 0 ? 'success' : 'neutral'}>{traitees.length}</Badge>
            </h3>
            {traitees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune demande traitée pour l'instant.
              </p>
            ) : (
              <ul className="space-y-3">
                {traitees.map((d) => (
                  <li key={d.id}>
                    <DemandeCard
                      demande={d}
                      snap={snap}
                      actor={actor}
                      onOpenFilPhoto={onOpenFilPhoto}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function statutVariant(state: EventState): 'warning' | 'info' | 'success' | 'neutral' {
  switch (state) {
    case 'ouverte':
      return 'warning';
    case 'en_cours':
      return 'info';
    case 'traitee':
      return 'success';
    default:
      return 'neutral';
  }
}

function prioriteVariant(p: DemandePriorite): 'danger' | 'warning' | 'neutral' | 'outline' {
  switch (p) {
    case 'urgente':
      return 'danger';
    case 'haute':
      return 'warning';
    case 'basse':
      return 'outline';
    default:
      return 'neutral';
  }
}

function DemandeCard({
  demande: d,
  snap,
  actor,
  onOpenFilPhoto,
}: {
  demande: DemandeEvent;
  snap: DemoSnapshot;
  actor: EventActor;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  const [comment, setComment] = useState('');
  const [assignee, setAssignee] = useState('');
  const priorite = d.content.priorite ?? 'normale';
  const activites = d.content.activites ?? [];
  const send = (fn: () => Promise<void>) => void fn();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 text-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600">
            <HelpCircle aria-hidden />
            <span className="font-medium">{d.content.question}</span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={statutVariant(d.state)}>{demandeStatutLabel(d.state)}</Badge>
            <Badge variant={prioriteVariant(priorite)}>{DEMANDE_PRIORITE_LABEL[priorite]}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Responsable :{' '}
            <span className="text-foreground">{d.content.responsable ?? 'Non assignée'}</span>
          </span>
          <span>Ouverte le {fmtDateTime(d.createdAt)}</span>
          {d.content.source?.kind === 'fil' && (
            <button
              type="button"
              onClick={() => onOpenFilPhoto(d.content.source!.momentId, d.content.source!.photoId)}
              className="inline-flex items-center gap-1 font-medium text-gold-700 underline-offset-4 hover:underline [&_svg]:size-3.5"
            >
              <ImageIcon aria-hidden /> Voir la photo
            </button>
          )}
        </div>

        {activites.length > 0 && <Timeline snap={snap} activites={activites} />}

        {/* Priorité + assignation (toujours modifiables tant qu'active) */}
        {isDemandeActive(d) && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Priorité
              <select
                value={priorite}
                onChange={(e) =>
                  send(() =>
                    demo.setDemandePriorite(d.id, actor, e.target.value as DemandePriorite),
                  )
                }
                className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-foreground"
              >
                {DEMANDE_PRIORITES.map((p) => (
                  <option key={p} value={p}>
                    {DEMANDE_PRIORITE_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-1 items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Assigner à
                <Input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Ex. Électricien"
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={!assignee.trim()}
                onClick={() =>
                  send(async () => {
                    await demo.assignDemande(d.id, actor, assignee);
                    setAssignee('');
                  })
                }
              >
                <UserPlus aria-hidden /> Assigner
              </Button>
            </div>
          </div>
        )}

        {/* Commentaire libre (toujours possible) */}
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Commentaire
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter une note interne…"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={!comment.trim()}
            onClick={() =>
              send(async () => {
                await demo.commentDemande(d.id, actor, comment);
                setComment('');
              })
            }
          >
            <MessageSquare aria-hidden /> Commenter
          </Button>
        </div>

        {/* Réponse (formulaire déroulant) */}
        {answering && (
          <div className="space-y-2 rounded-lg border border-border bg-paper-50 p-3">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Votre réponse (elle deviendra visible côté client)…"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAnswering(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={!answer.trim()}
                onClick={() =>
                  send(async () => {
                    await demo.answerDemande(d.id, actor, answer);
                    setAnswer('');
                    setAnswering(false);
                  })
                }
              >
                Envoyer la réponse
              </Button>
            </div>
          </div>
        )}

        {/* Actions de cycle de vie */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {d.state === 'ouverte' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => send(() => demo.startDemande(d.id, actor))}
            >
              <PlayCircle aria-hidden /> Prendre en charge
            </Button>
          )}
          {isDemandeActive(d) && !answering && (
            <Button size="sm" onClick={() => setAnswering(true)}>
              <CornerUpLeft aria-hidden /> Répondre
            </Button>
          )}
          {d.state === 'traitee' && (
            <Button size="sm" onClick={() => send(() => demo.closeDemande(d.id, actor))}>
              <CheckCircle2 aria-hidden /> Clôturer
            </Button>
          )}
          {(d.state === 'traitee' || d.state === 'close') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => send(() => demo.reopenDemande(d.id, actor))}
            >
              <Flag aria-hidden /> Rouvrir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Timeline({
  snap,
  activites,
}: {
  snap: DemoSnapshot;
  activites: DemandeActivite[];
}): React.JSX.Element {
  return (
    <ol className="space-y-1.5 border-l border-border pl-3">
      {activites.map((a, i) => (
        <li key={i} className="text-xs text-muted-foreground">
          <span className="text-foreground">{activiteText(a)}</span>
          {' · '}
          {nameOf(snap, a.authorId)} · {fmtDateTime(a.at)}
        </li>
      ))}
    </ol>
  );
}

function activiteText(a: DemandeActivite): string {
  switch (a.kind) {
    case 'ouverture':
      return 'Demande ouverte';
    case 'statut':
      return a.to === 'en_cours'
        ? 'Prise en charge'
        : a.to === 'close'
          ? 'Clôturée'
          : a.to === 'ouverte'
            ? 'Rouverte'
            : `Statut : ${a.to ? demandeStatutLabel(a.to) : '—'}`;
    case 'assignation':
      return `Assignée à ${a.responsable ?? '—'}`;
    case 'priorite':
      return `Priorité : ${a.priorite ? DEMANDE_PRIORITE_LABEL[a.priorite] : '—'}`;
    case 'commentaire':
      return a.texte ?? '';
    case 'reponse':
      return `Réponse : ${a.texte ?? ''}`;
    default:
      return '';
  }
}
