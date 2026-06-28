import { FileText, Heart, MessageCircle, NotebookPen } from 'lucide-react';
import { ROLE_LABEL, type Event } from '@phenix360/core';
import { Avatar } from './Avatar';
import { PhotoTile } from './PhotoTile';
import { eventDescription, eventTitle } from '../lib/eventText';
import { fmtDateTime } from '../lib/format';

/**
 * Une carte du RÉCIT client : un instant du chantier. La photo est l'élément
 * principal (le texte l'accompagne). Les réactions ❤️ / 💬 sont préparées
 * visuellement (désactivées) pour amorcer la direction « Moments ».
 */
export function MomentCard({
  event,
  authorName,
}: {
  event: Event;
  authorName: string;
}): React.JSX.Element {
  const title = eventTitle(event);
  const description = eventDescription(event);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {event.type === 'photo' && <PhotoTile photo={event} />}

      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">{authorName}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[event.actor.role]} · {fmtDateTime(event.createdAt)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {event.type !== 'photo' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold-700 [&_svg]:size-3.5">
              {event.type === 'document' ? <FileText aria-hidden /> : <NotebookPen aria-hidden />}
              {event.type === 'document' ? 'Document' : 'Compte rendu'}
            </span>
          )}
          <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {description != null && (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
          {event.type === 'document' && (
            <span className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
              <FileText aria-hidden />
              {event.content.attachment.fileName ?? `${event.content.libelle}.pdf`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-5 border-t border-border pt-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-sm [&_svg]:size-4">
            <Heart aria-hidden /> J'aime
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm [&_svg]:size-4">
            <MessageCircle aria-hidden /> Commenter
          </span>
          <span className="ml-auto text-xs italic">Bientôt</span>
        </div>
      </div>
    </article>
  );
}
