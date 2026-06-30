import { Trash2 } from 'lucide-react';
import { ROLE_LABEL, momentCover, type Message, type Moment } from '@phenix360/core';
import { Avatar } from '../Avatar';
import { fmtDate } from '../../lib/format';
import { FilImage } from './FilImage';
import { CoupDeCoeurButton } from './CoupDeCoeurButton';
import { MessageThread } from './MessageThread';

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
  locked,
  canDelete,
  onToggleCoup,
  onSendMessage,
  onDelete,
}: {
  moment: Moment;
  zoneLabel?: string;
  nameOf: (userId: string) => string;
  hasCoup: boolean;
  messages: Message[];
  locked: boolean;
  canDelete: boolean;
  onToggleCoup: () => void;
  onSendMessage: (texte: string) => void;
  onDelete: () => void;
}): React.JSX.Element {
  const cover = momentCover(moment);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {/* Grande photo, cadre net (mobile-friendly) */}
      <div className="relative aspect-[4/5] w-full bg-paper-100">
        {cover && <FilImage photo={cover} />}
      </div>

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
          <MessageThread messages={messages} nameOf={nameOf} onSend={onSendMessage} />
        </div>
      </div>
    </article>
  );
}
