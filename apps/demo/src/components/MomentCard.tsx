import { FileText, Heart, MessageCircle, NotebookPen, Sparkles } from 'lucide-react';
import { ROLE_LABEL, type Event } from '@phenix360/core';
import { Avatar } from './Avatar';
import { PhotoTile } from './PhotoTile';
import { DocumentLink } from './DocumentLink';
import { openAttachment } from '../lib/document';
import { eventDescription, eventTitle } from '../lib/eventText';
import { fmtDate } from '../lib/format';

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
  // Document RÉELLEMENT ouvrable = un fichier attaché (data URL). Sinon on n'offre
  // aucun lien (ni titre cliquable) : « disponible prochainement ».
  const openableDoc =
    event.type === 'document' && event.content.attachment.dataUrl ? event.content.attachment : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      {event.type === 'photo' && <PhotoTile photo={event} />}

      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={authorName} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">{authorName}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABEL[event.actor.role]} · {fmtDate(event.createdAt)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {event.type !== 'photo' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold-700 [&_svg]:size-3.5">
              {event.type === 'document' ? (
                <FileText aria-hidden />
              ) : event.type === 'decision' ? (
                <Sparkles aria-hidden />
              ) : (
                <NotebookPen aria-hidden />
              )}
              {event.type === 'document'
                ? 'Document'
                : event.type === 'decision'
                  ? 'Décision'
                  : event.type === 'demande'
                    ? 'Demande'
                    : 'Compte rendu'}
            </span>
          )}
          {openableDoc ? (
            <button
              type="button"
              onClick={() => openAttachment(openableDoc)}
              className="block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground underline-offset-4 transition-colors hover:text-gold-700 hover:underline">
                {title}
              </h3>
            </button>
          ) : (
            <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          )}
          {description != null && (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
          {event.type === 'document' &&
            (openableDoc ? (
              <span className="mt-1 inline-flex">
                <DocumentLink attachment={openableDoc} />
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm text-muted-foreground [&_svg]:size-4">
                <FileText aria-hidden />
                Document disponible prochainement
              </span>
            ))}
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
