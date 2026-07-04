import { Images, Lock, MessageCircle, Send, Trash2, Users } from 'lucide-react';
import {
  MOMENT_TYPE_SHORT,
  ROLE_LABEL,
  messagesDuMoment,
  momentCover,
  momentPartageClient,
  momentTypeOf,
  type Message,
  type Moment,
} from '@phenix360/core';
import { Avatar } from '../Avatar';
import { fmtDate } from '../../lib/format';
import { FilImage } from './FilImage';
import { CoupDeCoeurButton } from './CoupDeCoeurButton';
import { MessageThread } from './MessageThread';

/**
 * Un Moment, présenté comme une PAGE D'ALBUM : grande photo, puis type, auteur,
 * titre, observations, intervenants, coup de cœur et messages — beaucoup de
 * respiration. Côté conducteur, l'état de partage est visible (interne / partagé)
 * avec l'action « Partager avec le client ». La galerie immersive est pilotée par
 * le parent (FilView) pour permettre l'ouverture ciblée (lien retour du Journal).
 */
export function FilMoment({
  moment,
  zoneLabel,
  nameOf,
  hasCoup,
  messages,
  locked,
  canDelete,
  canShare,
  pendingComment = false,
  onToggleCoup,
  onSendMessage,
  onOpenGallery,
  onDelete,
  onShare,
}: {
  moment: Moment;
  zoneLabel?: string;
  nameOf: (userId: string) => string;
  hasCoup: boolean;
  /** Tous les messages du Moment (la carte n'affiche que le niveau 1). */
  messages: Message[];
  locked: boolean;
  canDelete: boolean;
  /** Le conducteur peut voir l'état de partage et publier au client. */
  canShare: boolean;
  /** Le client a laissé le dernier message → réponse du conducteur attendue. */
  pendingComment?: boolean;
  onToggleCoup: () => void;
  onSendMessage: (texte: string) => void;
  onOpenGallery: () => void;
  onDelete: () => void;
  onShare: () => void;
}): React.JSX.Element {
  const cover = momentCover(moment);
  const count = moment.photos.length;
  const shared = momentPartageClient(moment);
  // La carte du Fil reste sobre : seuls les messages du Moment (niveau 1).
  const messagesMoment = messagesDuMoment(moment.id, messages);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {/* Grande photo (couverture), cadre net (mobile-friendly) — ouvre la galerie */}
      <button
        type="button"
        onClick={onOpenGallery}
        aria-label={count > 1 ? `Ouvrir l’album (${count} photos)` : 'Agrandir la photo'}
        className="relative block aspect-[4/5] w-full bg-paper-100"
      >
        {cover && <FilImage photo={cover} />}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-paper-0/90 px-2.5 py-1 text-xs font-medium text-ink-800 shadow-sm">
          {MOMENT_TYPE_SHORT[momentTypeOf(moment)]}
        </span>
        {count > 1 && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-paper-0 [&_svg]:size-3.5"
            style={{ backgroundColor: 'rgba(19,16,9,0.55)' }}
          >
            <Images aria-hidden />
            {count} photos
          </span>
        )}
      </button>

      <div className="space-y-5 p-6">
        {pendingComment && (
          <div className="flex items-center gap-1.5 rounded-lg bg-gold-100 px-3 py-1.5 text-xs font-medium text-gold-800 [&_svg]:size-3.5">
            <MessageCircle aria-hidden /> Nouveau commentaire du client — à vous de répondre
          </div>
        )}
        {/* Auteur + date (+ pièce discrète) */}
        <div className="flex items-center gap-3">
          <Avatar name={nameOf(moment.authorId)} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">
              {nameOf(moment.authorId)}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[moment.authorRole]} · {fmtDate(moment.createdAt)}
              {zoneLabel ? ` · ${zoneLabel}` : ''}
            </p>
          </div>
          {/* Le verrouillage est une règle métier : invisible côté usage. On
              n'expose que l'action de suppression, tant qu'aucune interaction. */}
          {canDelete && !locked && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Supprimer ce moment"
              className="text-muted-foreground transition-colors duration-base hover:text-foreground [&_svg]:size-4"
            >
              <Trash2 aria-hidden />
            </button>
          )}
        </div>

        {/* Titre + observations */}
        <div className="space-y-1.5">
          <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            {moment.title}
          </h3>
          {moment.observations ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{moment.observations}</p>
          ) : (
            cover?.legende && (
              <p className="text-sm leading-relaxed text-muted-foreground">{cover.legende}</p>
            )
          )}
        </div>

        {/* Intervenants présents */}
        {moment.intervenants && moment.intervenants.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
            <Users aria-hidden />
            <span>Présents : {moment.intervenants.join(', ')}</span>
          </p>
        )}

        {/* État / action de partage — conducteur uniquement */}
        {canShare && (
          <div className="border-t border-border pt-4">
            {shared ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-success-foreground [&_svg]:size-3.5">
                <Send aria-hidden />
                Partagé avec le client
              </span>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
                  <Lock aria-hidden />
                  Moment interne
                </span>
                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-paper-0 transition-transform hover:-translate-y-0.5 [&_svg]:size-3.5"
                >
                  <Send aria-hidden />
                  Partager avec le client
                </button>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4">
          <CoupDeCoeurButton active={hasCoup} onToggle={onToggleCoup} />
        </div>

        <div className="border-t border-border pt-4">
          <MessageThread messages={messagesMoment} nameOf={nameOf} onSend={onSendMessage} />
        </div>
      </div>
    </article>
  );
}
