import { Lock, MapPin, Trash2 } from 'lucide-react';
import { ROLE_LABEL, momentCover, type Message, type Moment } from '@phenix360/core';
import { Avatar } from '../Avatar';
import { fmtDate } from '../../lib/format';
import { FilImage } from './FilImage';
import { CoupDeCoeurButton } from './CoupDeCoeurButton';
import { MessageThread } from './MessageThread';

/**
 * Un Moment dans Le Fil : ergonomie Instagram (grande image, titre, ♡, messages)
 * mais esprit album premium. La photo domine ; le reste accompagne.
 */
export function FilMoment({
  moment,
  zoneLabel,
  nameOf,
  coupsCount,
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
  coupsCount: number;
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
      {/* Image — cadre portrait, mobile-friendly */}
      <div className="relative aspect-[4/5] w-full bg-paper-100">
        {cover && <FilImage photo={cover} />}
        {zoneLabel && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-paper-0 [&_svg]:size-3.5"
            style={{ backgroundColor: 'rgba(19,16,9,0.55)' }}
          >
            <MapPin aria-hidden />
            {zoneLabel}
          </span>
        )}
        {cover?.legende && (
          <div
            className="absolute inset-x-0 bottom-0 p-4 text-paper-0"
            style={{
              backgroundImage: 'linear-gradient(to top, rgba(19,16,9,0.55), rgba(19,16,9,0))',
            }}
          >
            <p className="text-sm font-medium leading-snug">{cover.legende}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 p-5">
        {/* Auteur + date */}
        <div className="flex items-center gap-3">
          <Avatar name={nameOf(moment.authorId)} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">
              {nameOf(moment.authorId)}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[moment.authorRole]} · {fmtDate(moment.createdAt)}
            </p>
          </div>
          {locked ? (
            <span
              title="Ce moment fait partie de la mémoire du chantier"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3.5"
            >
              <Lock aria-hidden />
            </span>
          ) : (
            canDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Supprimer ce moment"
                className="text-muted-foreground transition-colors duration-base hover:text-foreground [&_svg]:size-4"
              >
                <Trash2 aria-hidden />
              </button>
            )
          )}
        </div>

        <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
          {moment.title}
        </h3>

        <div className="border-t border-border pt-3">
          <CoupDeCoeurButton active={hasCoup} count={coupsCount} onToggle={onToggleCoup} />
        </div>

        <div className="border-t border-border pt-3">
          <MessageThread messages={messages} nameOf={nameOf} onSend={onSendMessage} />
        </div>
      </div>
    </article>
  );
}
