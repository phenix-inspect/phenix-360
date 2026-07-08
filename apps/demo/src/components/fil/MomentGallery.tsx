import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  MessageCircle,
  PenLine,
  Send,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ROLE_LABEL,
  annotationsDePhoto,
  comptesMessagesParPhoto,
  messagesDePhoto,
  type Annotation,
  type FilPhoto,
  type Message,
  type Moment,
} from '@phenix360/core';
import { fmtDateTime } from '../../lib/format';
import { FilImage } from './FilImage';
import { PhotoAnnotator, type AnnotationInput } from './PhotoAnnotator';

const ACTION_LABEL: Record<'decision' | 'reserve' | 'sav', string> = {
  decision: 'Décision',
  reserve: 'Réserve',
  sav: 'SAV',
};

/** Ratio largeur/hauteur d'une photo, si ses dimensions sont connues. */
const ratioDePhoto = (p?: FilPhoto): number | null =>
  p && p.width && p.height ? p.width / p.height : null;

/**
 * Viewer photo plein écran — un VRAI mode de consultation (type Photos iPhone /
 * Instagram), pas un overlay bavard posé sur la page :
 *   • rendu via portal sur `document.body` + `z-viewer` (au-dessus du header et du
 *     concierge Léon), fond noir opaque, scroll du body verrouillé ;
 *   • la photo tient TOUJOURS dans la fenêtre, centrée, entière (jamais de scroll) :
 *     on mesure le stage (ResizeObserver) et le ratio réel de la photo, puis on
 *     dimensionne un cadre qui épouse exactement l'image — le calque d'annotations
 *     (inset-0) reste donc aligné au pixel près ;
 *   • navigation flèches (desktop) + swipe (mobile) + clavier, compteur clair,
 *     pellicule de miniatures compacte, zoom + déplacement.
 * Le client peut laisser un message ATTACHÉ à la photo (niveau 2) ; le conducteur
 * peut annoter et créer une réserve depuis une annotation.
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
  // Zoom : la photo est montrée ENTIÈRE (jamais recadrée) ; le zoom permet de
  // regarder un détail. Déplacement au doigt/souris une fois zoomé.
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Dimensionnement « au pixel » : on mesure la zone photo et le ratio réel de
  // l'image pour lui donner exactement le plus grand cadre qui tient dedans.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(ratioDePhoto(photos[start]));

  // Un viewer plein écran ne laisse jamais le body défiler derrière lui.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // On suit la taille de la zone photo (rotation, redimensionnement, clavier mobile).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = (): void => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = photos.length;
  const go = (dir: -1 | 1): void => setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));
  const toggleZoom = (): void =>
    setZoom((z) => {
      if (z) setPan({ x: 0, y: 0 });
      return !z;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (zoom) return; // zoomé : les flèches ne changent pas de photo.
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom]);

  // On change de photo : brouillon effacé (un message = une photo), zoom remis à
  // zéro, ratio réamorcé sur les dimensions connues (affiné à la charge de l'image).
  useEffect(() => {
    setDraft('');
    setZoom(false);
    setPan({ x: 0, y: 0 });
    setRatio(ratioDePhoto(photos[index]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

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
  // Les albums « coulisses » n'ont pas de titre : on retombe sur la légende, puis
  // sur un libellé générique (pour l'entête et le nom accessible de la galerie).
  const heading = moment.title.trim() || moment.observations?.trim() || 'Photos du chantier';

  // Le plus grand cadre au ratio de la photo qui tient dans la zone mesurée :
  // borné par la hauteur si la zone est « plus large » que la photo, sinon par
  // la largeur. Résultat = photo entière, centrée, sans recadrage ni scroll.
  const R = ratio ?? 0.8; // 4/5 par défaut, le temps de connaître le vrai ratio
  const box =
    stageSize.w > 0 && stageSize.h > 0
      ? stageSize.w / stageSize.h > R
        ? { width: stageSize.h * R, height: stageSize.h }
        : { width: stageSize.w, height: stageSize.w / R }
      : null;
  const wrapperStyle: React.CSSProperties = {
    ...(box
      ? { width: `${box.width}px`, height: `${box.height}px` }
      : { maxWidth: '100%', maxHeight: '100%' }),
    ...(zoom ? { transform: `scale(2) translate(${pan.x}px, ${pan.y}px)` } : null),
  };

  return createPortal(
    <div
      className="fixed inset-0 z-viewer flex flex-col overflow-hidden overscroll-contain"
      style={{ backgroundColor: '#000' }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onTouchStart={(e) => {
        if (editing || zoom) return;
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (editing || zoom || touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Barre haute : titre + compteur (+ repères) + actions */}
      <div className="flex shrink-0 items-center justify-between gap-3 p-4 text-paper-0">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold tracking-tight">{heading}</p>
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
          {!editing && current.imageUrl && (
            <button
              type="button"
              onClick={toggleZoom}
              aria-label={zoom ? 'Dézoomer' : 'Zoomer'}
              aria-pressed={zoom}
              className="inline-flex size-10 items-center justify-center rounded-full text-paper-0 transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-5"
            >
              {zoom ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />}
            </button>
          )}
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
              setZoom(false);
              setPan({ x: 0, y: 0 });
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

      {/* Zone photo : occupe TOUT l'espace disponible entre les deux barres. La
          photo est centrée et dimensionnée pour tenir entière (cadre = ratio réel
          × zone mesurée) — jamais de recadrage, jamais de scroll. Le calque
          d'annotations épouse ce cadre au pixel près. Zoomé, on déplace au doigt. */}
      <div
        ref={stageRef}
        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
          zoom ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        onPointerDown={(e) => {
          if (!zoom) return;
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!zoom || !drag.current) return;
          // /2 : on annule le facteur d'échelle pour un déplacement 1:1 au doigt.
          const dx = (e.clientX - drag.current.x) / 2;
          const dy = (e.clientY - drag.current.y) / 2;
          drag.current = { x: e.clientX, y: e.clientY };
          setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div className="relative transition-transform duration-base" style={wrapperStyle}>
          {current.imageUrl ? (
            <img
              src={current.imageUrl}
              alt={current.legende ?? 'Photo du chantier'}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight)
                  setRatio(el.naturalWidth / el.naturalHeight);
              }}
              onDoubleClick={() => {
                if (!editing) toggleZoom();
              }}
              draggable={false}
              className="absolute inset-0 block size-full select-none object-contain"
            />
          ) : (
            <FilImage photo={current} className="absolute inset-0 size-full" />
          )}
          <PhotoAnnotator
            key={current.id}
            photo={current}
            annotations={photoAnnotations}
            show={showAnnotations}
            editing={editing}
            onAdd={onAddAnnotation}
          />
        </div>

        {index > 0 && !zoom && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Photo précédente"
            className="absolute left-3 inline-flex size-11 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
          >
            <ChevronLeft aria-hidden />
          </button>
        )}
        {index < total - 1 && !zoom && (
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

      {/* Barre basse COMPACTE : légende + pellicule + (messages / annotations) +
          saisie. La zone messages/annotations est plafonnée et défile en interne —
          elle ne pousse jamais la photo hors écran ni ne fait défiler la page. */}
      <div className="shrink-0 space-y-2.5 p-3 text-paper-0">
        {current.legende && (
          <p className="mx-auto max-w-2xl text-center text-sm opacity-90">{current.legende}</p>
        )}
        {/* Pellicule de miniatures COMPACTE : parcours d'un coup d'œil, saut direct.
            Pastille or = la photo porte un mot. */}
        {total > 1 && (
          <div className="mx-auto flex max-w-2xl snap-x justify-center gap-1.5 overflow-x-auto">
            {photos.map((p, i) => {
              const hasMsg = (counts.get(p.id) ?? 0) > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Aller à la photo ${i + 1}`}
                  aria-current={i === index}
                  className={`relative size-12 shrink-0 snap-start overflow-hidden rounded-md border-2 transition-all duration-base ${
                    i === index
                      ? 'border-paper-0'
                      : 'border-transparent opacity-55 hover:opacity-90'
                  }`}
                >
                  <FilImage photo={p} />
                  {hasMsg && (
                    <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-gold-400 ring-1 ring-ink-900/40" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mx-auto w-full max-w-2xl space-y-2">
          {(photoMessages.length > 0 || (canCreateAction && photoAnnotations.length > 0)) && (
            <div className="max-h-[28vh] space-y-2 overflow-y-auto">
              {photoMessages.length > 0 && (
                <ul className="space-y-1.5">
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
                              onClick={() => {
                                setReserveFor(a.id);
                                setResp('');
                                setEch('');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-paper-0/20 px-2.5 py-1 text-xs transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-3.5"
                            >
                              <Flag aria-hidden />
                              Créer une réserve
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
            </div>
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
    </div>,
    document.body,
  );
}
