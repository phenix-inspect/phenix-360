import { useState } from 'react';
import { Images, Trash2 } from 'lucide-react';
import {
  ROLE_LABEL,
  messagesDuMoment,
  momentCover,
  type Annotation,
  type Message,
  type Moment,
} from '@phenix360/core';
import { Avatar } from '../Avatar';
import { fmtDate } from '../../lib/format';
import { FilImage } from './FilImage';
import { CoupDeCoeurButton } from './CoupDeCoeurButton';
import { MessageThread } from './MessageThread';
import { MomentGallery } from './MomentGallery';
import { type AnnotationInput } from './PhotoAnnotator';

/**
 * Un Moment, présenté comme une PAGE D'ALBUM : grande photo, puis auteur,
 * titre, légende, coup de cœur et messages — beaucoup de respiration. On
 * emprunte l'ergonomie d'Instagram, mais l'esprit est celui d'un bel album
 * photo, jamais d'une fiche d'application.
 */
export function FilMoment({
  moment,
  zoneLabel,
  nameOf,
  hasCoup,
  messages,
  annotations,
  locked,
  canDelete,
  onToggleCoup,
  onSendMessage,
  onSendPhotoMessage,
  onAddAnnotation,
  onDelete,
}: {
  moment: Moment;
  zoneLabel?: string;
  nameOf: (userId: string) => string;
  hasCoup: boolean;
  /** Tous les messages du Moment (niveaux 1 et 2). */
  messages: Message[];
  /** Toutes les annotations du Moment. */
  annotations: Annotation[];
  locked: boolean;
  canDelete: boolean;
  onToggleCoup: () => void;
  onSendMessage: (texte: string) => void;
  onSendPhotoMessage: (photoId: string, texte: string) => void;
  onAddAnnotation: (input: AnnotationInput) => void;
  onDelete: () => void;
}): React.JSX.Element {
  const cover = momentCover(moment);
  const count = moment.photos.length;
  const [gallery, setGallery] = useState(false);
  // La carte du Fil reste sobre : seuls les messages du Moment (niveau 1).
  const messagesMoment = messagesDuMoment(moment.id, messages);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {/* Grande photo (couverture), cadre net (mobile-friendly) — ouvre la galerie */}
      <button
        type="button"
        onClick={() => setGallery(true)}
        aria-label={count > 1 ? `Ouvrir l’album (${count} photos)` : 'Agrandir la photo'}
        className="relative block aspect-[4/5] w-full bg-paper-100"
      >
        {cover && <FilImage photo={cover} />}
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

      {gallery && (
        <MomentGallery
          moment={moment}
          messages={messages}
          annotations={annotations}
          nameOf={nameOf}
          onSendPhotoMessage={onSendPhotoMessage}
          onAddAnnotation={onAddAnnotation}
          onClose={() => setGallery(false)}
        />
      )}

      <div className="space-y-5 p-6">
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

        {/* Titre + légende */}
        <div className="space-y-1.5">
          <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            {moment.title}
          </h3>
          {cover?.legende && (
            <p className="text-sm leading-relaxed text-muted-foreground">{cover.legende}</p>
          )}
        </div>

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
