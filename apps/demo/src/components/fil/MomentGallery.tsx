import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  ListPlus,
  MessageCircle,
  PenLine,
  Send,
  X,
} from 'lucide-react';
import {
  ROLE_LABEL,
  annotationsDePhoto,
  comptesMessagesParPhoto,
  messagesDePhoto,
  type Annotation,
  type Message,
  type Moment,
} from '@phenix360/core';
import { fmtDateTime } from '../../lib/format';
import { FilImage } from './FilImage';
import { PhotoAnnotator, type AnnotationInput } from './PhotoAnnotator';

const ACTION_LABEL: Record<'demande' | 'decision' | 'reserve' | 'sav', string> = {
  demande: 'Demande',
  decision: 'Décision',
  reserve: 'Réserve',
  sav: 'SAV',
};

/**
 * Galerie immersive d'un album : plein écran, navigation fluide (flèches,
 * clavier, swipe), compteur et légende par photo. Le client peut laisser un
 * message ATTACHÉ à la photo affichée (niveau 2) — un commentaire contextualisé,
 * pas une discussion sociale. Repère discret du nombre de messages par photo.
 */
export function MomentGallery({
  moment,
  messages,
  annotations,
  nameOf,
  canCreateAction,
  initialPhotoId,
  onSendPhotoMessage,
  onAddAnnotation,
  onCreateDemande,
  onCreateReserve,
  onClose,
}: {
  moment: Moment;
  messages: Message[];
  annotations: Annotation[];
  nameOf: (userId: string) => string;
  canCreateAction: boolean;
  initialPhotoId?: string;
  onSendPhotoMessage: (photoId: string, texte: string) => void;
  onAddAnnotation: (input: AnnotationInput) => void;
  onCreateDemande: (annotationId: string) => void;
  onCreateReserve: (
    annotationId: string,
    options: { responsable?: string; echeance?: string },
  ) => void;
  onClose: () => void;
}): React.JSX.Element {
  const photos = [...moment.photos].sort((a, b) => a.ordre - b.ordre);
  const start = Math.max(
    0,
    photos.findIndex((p) => p.id === (initialPhotoId ?? moment.coverPhotoId)),
  );
  const [index, setIndex] = useState(start);
  const [draft, setDraft] = useState('');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [editing, setEditing] = useState(false);
  // Réserve : annotation pour laquelle on saisit responsable / échéance.
  const [reserveFor, setReserveFor] = useState<string | null>(null);
  const [resp, setResp] = useState('');
  const [ech, setEch] = useState('');
  const touchX = useRef<number | null>(null);

  const total = photos.length;
  const go = (dir: -1 | 1): void => setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // On efface le brouillon quand on change de photo (un message = une photo).
  useEffect(() => setDraft(''), [index]);

  const counts = comptesMessagesParPhoto(messages);
  const current = photos[index];
  if (!current) return <></>;

  const photoMessages = messagesDePhoto(current.id, messages);
  const photoAnnotations = annotationsDePhoto(current.id, annotations);
  const messageById = new Map(messages.map((m) => [m.id, m] as const));
  const annotationLabel = (a: Annotation): string => {
    if (a.messageId && messageById.get(a.messageId)) return messageById.get(a.messageId)!.texte;
    if (a.texte) return a.texte;
    if (a.type === 'numero') return `Point ${a.numero ?? ''}`.trim();
    return { cercle: 'Zone entourée', fleche: 'Flèche', trait: 'Tracé', texte: 'Texte' }[
      a.type
    ] as string;
  };
  const send = (): void => {
    const t = draft.trim();
    if (!t) return;
    onSendPhotoMessage(current.id, t);
    setDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col"
      style={{ backgroundColor: 'rgba(19,16,9,0.985)' }}
      role="dialog"
      aria-modal="true"
      aria-label={moment.title}
      onTouchStart={(e) => {
        if (editing) return;
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (editing || touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Barre haute : titre + compteur (+ repères) + actions */}
      <div className="flex items-center justify-between gap-3 p-4 text-paper-0">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold tracking-tight">{moment.title}</p>
          <p className="flex items-center gap-2 text-xs opacity-80">
            <span>
              {index + 1} / {total}
            </span>
            {photoMessages.length > 0 && (
              <span className="inline-flex items-center gap-1 [&_svg]:size-3.5">
                <MessageCircle aria-hidden />
                {photoMessages.length}
              </span>
            )}
            {photoAnnotations.length > 0 && (
              <span className="inline-flex items-center gap-1 [&_svg]:size-3.5">
                <PenLine aria-hidden />
                {photoAnnotations.length}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {photoAnnotations.length > 0 && !editing && (
            <button
              type="button"
              onClick={() => setShowAnnotations((v) => !v)}
              aria-label={showAnnotations ? 'Masquer les annotations' : 'Afficher les annotations'}
              aria-pressed={showAnnotations}
              className="inline-flex size-10 items-center justify-center rounded-full text-paper-0 transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-5"
            >
              {showAnnotations ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setShowAnnotations(true);
            }}
            aria-label={editing ? 'Terminer l’annotation' : 'Annoter la photo'}
            aria-pressed={editing}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-base [&_svg]:size-4 ${
              editing ? 'bg-gold-500 text-primary-foreground' : 'text-paper-0 hover:bg-paper-0/10'
            }`}
          >
            <PenLine aria-hidden />
            {editing ? 'Terminer' : 'Annoter'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex size-10 items-center justify-center rounded-full text-paper-0 transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-5"
          >
            <X aria-hidden />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        <div className="relative max-h-full w-full max-w-3xl">
          <div className="relative mx-auto aspect-[4/5] max-h-[58vh] w-full overflow-hidden rounded-xl">
            <FilImage photo={current} />
            <PhotoAnnotator
              key={current.id}
              photo={current}
              annotations={photoAnnotations}
              show={showAnnotations}
              editing={editing}
              onAdd={onAddAnnotation}
            />
          </div>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Photo précédente"
            className="absolute left-3 inline-flex size-11 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
          >
            <ChevronLeft aria-hidden />
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Photo suivante"
            className="absolute right-3 inline-flex size-11 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
          >
            <ChevronRight aria-hidden />
          </button>
        )}
      </div>

      {/* Légende + pastilles (repère messages) + messages de la photo */}
      <div className="space-y-3 p-4 text-paper-0">
        {current.legende && (
          <p className="mx-auto max-w-2xl text-center text-sm opacity-90">{current.legende}</p>
        )}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((p, i) => {
              const hasMsg = (counts.get(p.id) ?? 0) > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Aller à la photo ${i + 1}`}
                  className={`size-1.5 rounded-full transition-colors duration-base ${
                    i === index ? 'bg-paper-0' : hasMsg ? 'bg-gold-400' : 'bg-paper-0/35'
                  }`}
                />
              );
            })}
          </div>
        )}

        <div className="mx-auto w-full max-w-2xl space-y-2">
          {photoMessages.length > 0 && (
            <ul className="max-h-28 space-y-1.5 overflow-y-auto">
              {photoMessages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">{nameOf(m.authorId)}</span>{' '}
                  <span className="text-xs opacity-70">
                    {ROLE_LABEL[m.authorRole]} · {fmtDateTime(m.createdAt)}
                  </span>
                  <p className="opacity-90">{m.texte}</p>
                </li>
              ))}
            </ul>
          )}

          {/* PONT conducteur : créer une Demande ou une Réserve depuis une annotation. */}
          {canCreateAction && photoAnnotations.length > 0 && (
            <ul className="space-y-2 border-t border-paper-0/15 pt-2">
              {photoAnnotations.map((a) => (
                <li key={a.id} className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
                      <PenLine aria-hidden className="opacity-70" />
                      <span className="truncate">{annotationLabel(a)}</span>
                    </span>
                    {a.action ? (
                      <span className="shrink-0 rounded-full bg-gold-500/20 px-2 py-0.5 text-xs text-gold-300">
                        {ACTION_LABEL[a.action.kind]} créée
                      </span>
                    ) : reserveFor === a.id ? null : (
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCreateDemande(a.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-paper-0/20 px-2.5 py-1 text-xs transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-3.5"
                        >
                          <ListPlus aria-hidden />
                          Demande
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReserveFor(a.id);
                            setResp('');
                            setEch('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-paper-0/20 px-2.5 py-1 text-xs transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-3.5"
                        >
                          <Flag aria-hidden />
                          Réserve
                        </button>
                      </span>
                    )}
                  </div>

                  {reserveFor === a.id && !a.action && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-paper-0/15 bg-paper-0/5 p-2">
                      <input
                        value={resp}
                        onChange={(e) => setResp(e.target.value)}
                        placeholder="Responsable (ex. Peintre)"
                        className="h-9 min-w-[8rem] flex-1 rounded-lg border border-paper-0/20 bg-paper-0/10 px-3 text-sm text-paper-0 placeholder:text-paper-0/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
                      />
                      <input
                        type="date"
                        value={ech}
                        onChange={(e) => setEch(e.target.value)}
                        aria-label="Échéance"
                        className="h-9 rounded-lg border border-paper-0/20 bg-paper-0/10 px-3 text-sm text-paper-0 focus:outline-none focus:ring-2 focus:ring-gold-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onCreateReserve(a.id, { responsable: resp, echeance: ech });
                          setReserveFor(null);
                        }}
                        className="h-9 rounded-lg bg-gold-500 px-3 text-sm font-medium text-primary-foreground"
                      >
                        Créer la réserve
                      </button>
                      <button
                        type="button"
                        onClick={() => setReserveFor(null)}
                        className="h-9 rounded-lg px-2 text-sm hover:bg-paper-0/10"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Écrire un petit mot sur cette photo…"
              className="h-10 flex-1 rounded-lg border border-paper-0/20 bg-paper-0/10 px-3 text-sm text-paper-0 placeholder:text-paper-0/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              aria-label="Envoyer"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-paper-0/20 text-paper-0 transition-colors duration-base hover:bg-paper-0/10 disabled:opacity-40 [&_svg]:size-4"
            >
              <Send aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
