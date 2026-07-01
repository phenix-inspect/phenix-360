import * as React from 'react';
import {
  CircleCheck,
  EyeOff,
  FileText,
  Flag,
  HelpCircle,
  Image,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import type { ActorRole, EventType, EventVisibility } from '@phenix360/core';
import { ROLE_LABEL } from '@phenix360/core';
import { cn } from '../lib/cn.js';
import { Badge } from './badge.js';

/**
 * Timeline + ActivityItem — la brique du JOURNAL D'ÉVÉNEMENTS (ADR-002/004 §4).
 * Couche de PRÉSENTATION uniquement : le vocabulaire métier (type, rôle,
 * visibilité) vient des types canoniques de `@phenix360/core` — aucune
 * duplication. La mise en forme (icône, libellé, mono) reste ici.
 *
 * Pilotée par props d'affichage (déjà dérivées d'une ligne `event`) : sobre,
 * premium, modulaire. Connecteur du dernier élément masqué. Tokens uniquement.
 */

/** Icône de marqueur par défaut selon le type d'événement (présentation). */
const TYPE_ICON: Record<EventType, React.ReactNode> = {
  compte_rendu: <NotebookPen aria-hidden="true" />,
  photo: <Image aria-hidden="true" />,
  document: <FileText aria-hidden="true" />,
  demande: <HelpCircle aria-hidden="true" />,
  decision: <Sparkles aria-hidden="true" />,
  reserve: <Flag aria-hidden="true" />,
  levee: <CircleCheck aria-hidden="true" />,
};

export const Timeline = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        'flex flex-col [&>li:last-child>div:last-child]:pb-0 [&>li:last-child_[data-slot=connector]]:hidden',
        className,
      )}
      {...props}
    />
  ),
);
Timeline.displayName = 'Timeline';

export interface ActivityItemProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, 'title'> {
  /** Type d'événement du journal — choisit l'icône par défaut du marqueur. */
  type?: EventType;
  /** Titre de l'événement. */
  title: React.ReactNode;
  /** Description / résumé (contenu typé côté données). */
  description?: React.ReactNode;
  /** Horodatage (`created_at`), rendu en mono, discret. */
  date?: React.ReactNode;
  /** Nom de l'auteur (l'IA n'est jamais auteur — ADR-001). */
  author?: React.ReactNode;
  /** Rôle de l'auteur. */
  authorRole?: ActorRole;
  /** Visibilité : `interne` affiche un repère discret « masqué au client ». */
  visibility?: EventVisibility;
  /** Override de l'icône/contenu du marqueur. */
  marker?: React.ReactNode;
  /** Zone média extensible : vignettes photo, pièce jointe document, etc. */
  media?: React.ReactNode;
}

export const ActivityItem = React.forwardRef<HTMLLIElement, ActivityItemProps>(
  (
    {
      className,
      type,
      title,
      description,
      date,
      author,
      authorRole,
      visibility,
      marker,
      media,
      children,
      ...props
    },
    ref,
  ) => {
    const markerNode = marker ?? (type ? TYPE_ICON[type] : null);
    const hasMeta = author != null || authorRole != null || visibility === 'interne';
    return (
      <li ref={ref} className={cn('relative flex gap-4', className)} {...props}>
        <div className="flex flex-col items-center">
          <span
            data-slot="marker"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm [&_svg]:size-4"
          >
            {markerNode}
          </span>
          <span data-slot="connector" aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />
        </div>

        <div className="flex-1 pb-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium text-foreground">{title}</p>
            {date != null && (
              <time className="shrink-0 font-mono text-xs text-muted-foreground">{date}</time>
            )}
          </div>

          {hasMeta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {(author != null || authorRole != null) && (
                <span>
                  {author}
                  {author != null && authorRole != null ? ' · ' : ''}
                  {authorRole != null ? ROLE_LABEL[authorRole] : ''}
                </span>
              )}
              {visibility === 'interne' && (
                <Badge variant="outline">
                  <EyeOff aria-hidden="true" />
                  Interne
                </Badge>
              )}
            </div>
          )}

          {description != null && (
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</div>
          )}

          {children}

          {media != null && <div className="mt-3">{media}</div>}
        </div>
      </li>
    );
  },
);
ActivityItem.displayName = 'ActivityItem';
