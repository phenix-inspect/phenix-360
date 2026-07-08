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
  pendingText = 'Nouveau commentaire du client — à vous de répondre',
  focusReply = false,
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
  /** Un message est en attente sous ce Moment (côté conducteur OU client). */
  pendingComment?: boolean;
  /** Libellé du signal (dépend du point de vue). */
  pendingText?: string;
  /** Poser le curseur dans la réponse (ouvert depuis une notification). */
  focusReply?: boolean;
  onToggleCoup: () => void;
  onSendMessage: (texte: string) => void;
  onOpenGallery: () => void;
  onDelete: () => void;
  onShare: () => void;
}): React.JSX.Element {
  const photos = [...moment.photos].sort((a, b) => a.ordre - b.ordre);
  const cover = momentCover(moment);
  const count = moment.photos.length;
  // Aperçu multi-photos : la couverture d'abord, puis les suivantes dans l'ordre
  // (jusqu'à 3 tuiles ; au-delà, un « +N » sur la dernière).
  const apercu = (cover ? [cover, ...photos.filter((p) => p.id !== cover.id)] : photos).slice(0, 3);
  const shared = momentPartageClient(moment);
  // La carte du Fil reste sobre : seuls les messages du Moment (niveau 1).
  const messagesMoment = messagesDuMoment(moment.id, messages);

  return (
    <article
      id={`fil-moment-${moment.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
    >
      {/* Grande photo (couverture) — cadre plus DENSE pour parcourir le récit
          comme un fil social (≈ 33 % plus court que l'ancien 4/5), sans écraser
          l'image (object-cover recadre). Coins arrondis via l'article. Le clic
          ouvre toujours le plein écran. Un album (≥ 2 photos) montre une MOSAÏQUE
          d'aperçu — on voit d'un coup qu'il y en a plusieurs. */}
      <button
        type="button"
        onClick={onOpenGallery}
        aria-label={count > 1 ? `Ouvrir l’album (${count} photos)` : 'Agrandir la photo'}
        className="relative block aspect-[6/5] w-full bg-paper-100"
      >
        {count > 1 ? (
          <span
            className={`grid size-full gap-1 bg-border ${
              count === 2 ? 'grid-cols-2' : 'grid-cols-3 grid-rows-2'
            }`}
          >
            {apercu.map((p, i) => (
              <span
                key={p.id}
                className={`relative block overflow-hidden bg-paper-100 ${
                  count >= 3 && i === 0 ? 'col-span-2 row-span-2' : ''
                }`}
              >
                <FilImage photo={p} />
                {count > 3 && i === apercu.length - 1 && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-paper-0"
                    style={{ backgroundColor: 'rgba(19,16,9,0.55)' }}
                  >
                    +{count - 3}
                  </span>
                )}
              </span>
            ))}
          </span>
        ) : (
          cover && <FilImage photo={cover} />
        )}
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
            <MessageCircle aria-hidden /> {pendingText}
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

        {/* Titre (facultatif — les albums coulisses n'en ont pas) + légende. */}
        {(moment.title.trim() || moment.observations || cover?.legende) && (
          <div className="space-y-1.5">
            {moment.title.trim() && (
              <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                {moment.title}
              </h3>
            )}
            {moment.observations ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{moment.observations}</p>
            ) : (
              cover?.legende && (
                <p className="text-sm leading-relaxed text-muted-foreground">{cover.legende}</p>
              )
            )}
          </div>
        )}

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
          <MessageThread
            messages={messagesMoment}
            nameOf={nameOf}
            onSend={onSendMessage}
            autoFocus={focusReply}
          />
        </div>
      </div>
    </article>
  );
}
