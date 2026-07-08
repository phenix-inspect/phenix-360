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

/** Délai d'inactivité avant que les contrôles secondaires s'effacent (ms). */
const IDLE_MS = 4000;

/** Ratio largeur/hauteur d'une photo, si ses dimensions sont connues. */
const ratioDePhoto = (p?: FilPhoto): number | null =>
  p && p.width && p.height ? p.width / p.height : null;

/**
 * Viewer photo plein écran — une EXPÉRIENCE immersive type Photos iPhone /
 * Instagram, pas un composant métier. Pendant qu'il est ouvert, on oublie PHÉNIX :
 * la photo est le sujet, l'interface s'efface.
 *
 * Architecture (verrouillée — RC1) : portal sur `document.body`, `z-viewer`
 * (au-dessus du header et du concierge Léon), fond noir opaque, scroll du body
 * verrouillé, focus piégé + rendu à l'ouvrant à la fermeture. La photo est
 * dimensionnée « au pixel » (zone mesurée × ratio réel) : entière, centrée, sans
 * scroll, et le calque d'annotations reste aligné.
 *
 * Chrome (RC2) : au repos on ne voit que le compteur, le bouton fermer et les
 * flèches ; les contrôles secondaires (titre, zoom, annoter, miniatures, bouton
 * commentaires, légende) apparaissent au mouvement et s'effacent après inactivité.
 * Un tap sur la photo bascule le mode immersif (tout disparaît / réapparaît). Les
 * commentaires et annotations vivent dans un Bottom Sheet qui ne vole plus de
 * hauteur. Fermeture : Échap, croix, clic sur le fond, glissé vers le bas.
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
  // Zoom : la photo reste ENTIÈRE ; le zoom regarde un détail (glisser pour déplacer).
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Chrome immersif : `immersive` = tout masqué (tap) ; `controls` = contrôles
  // secondaires visibles (apparaissent au mouvement, s'effacent après inactivité).
  const [immersive, setImmersive] = useState(false);
  const [controls, setControls] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Animation d'ouverture / fermeture (opacity + léger scale).
  const [entered, setEntered] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const sheetStartY = useRef<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(ratioDePhoto(photos[start]));

  // Refs miroir : lues dans les timers/écouteurs sans les recréer.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const total = photos.length;
  const current = photos[index];

  const clearIdle = (): void => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
  };
  const scheduleHide = (): void => {
    clearIdle();
    idle.current = setTimeout(() => {
      // On garde les contrôles tant qu'on annote ou que la feuille est ouverte.
      if (!editingRef.current && !sheetRef.current) setControls(false);
    }, IDLE_MS);
  };
  /** Tout réveiller : sortir de l'immersif, montrer les contrôles, réarmer l'inactivité. */
  const wake = (): void => {
    setImmersive(false);
    setControls(true);
    scheduleHide();
  };

  const go = (dir: -1 | 1): void => {
    setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));
    wake();
  };
  const toggleZoom = (): void =>
    setZoom((z) => {
      if (z) setPan({ x: 0, y: 0 });
      return !z;
    });

  // Fermeture animée : on rejoue l'anim inverse, puis on démonte.
  const requestClose = (): void => {
    setEntered(false);
    setTimeout(onClose, 200);
  };

  // Verrou du scroll de la page (un vrai plein écran).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Focus : piégé dans le viewer, rendu à l'élément ouvrant à la fermeture.
  useEffect(() => {
    openerRef.current = document.activeElement;
    const id = requestAnimationFrame(() => {
      setEntered(true);
      dialogRef.current?.focus();
    });
    scheduleHide();
    return () => {
      cancelAnimationFrame(id);
      clearIdle();
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suivi de la taille de la zone photo (redimensionnement, rotation mobile).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = (): void => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Préchargement des voisines → changement de photo instantané.
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) {
      if (p?.imageUrl) {
        const im = new Image();
        im.src = p.imageUrl;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Changement de photo : brouillon effacé, zoom réinitialisé, ratio réamorcé.
  useEffect(() => {
    setDraft('');
    setZoom(false);
    setPan({ x: 0, y: 0 });
    setRatio(ratioDePhoto(photos[index]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Clavier : Échap (feuille puis viewer), flèches, piège à focus (Tab).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (items.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (sheetRef.current) setSheet(false);
        else requestClose();
        return;
      }
      wake();
      if (zoom) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, total]);

  const counts = comptesMessagesParPhoto(messages);
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
  // sur un libellé générique (entête + nom accessible du viewer).
  const heading = moment.title.trim() || moment.observations?.trim() || 'Photos du chantier';
  const commentCount = photoMessages.length;

  // Le plus grand cadre au ratio de la photo qui tient dans la zone mesurée.
  const R = ratio ?? 0.8; // 4/5 par défaut, le temps de connaître le vrai ratio
  const box =
    stageSize.w > 0 && stageSize.h > 0
      ? stageSize.w / stageSize.h > R
        ? { width: stageSize.h * R, height: stageSize.h }
        : { width: stageSize.w, height: stageSize.w / R }
      : null;
  const scaleIn = entered ? 1 : 0.96;
  const wrapperStyle: React.CSSProperties = {
    ...(box
      ? { width: `${box.width}px`, height: `${box.height}px` }
      : { maxWidth: '100%', maxHeight: '100%' }),
    transform: zoom ? `scale(2) translate(${pan.x}px, ${pan.y}px)` : `scale(${scaleIn})`,
  };

  // Visibilité du chrome : niveau 1 (compteur, fermer, flèches) tant qu'on n'est
  // pas en immersif ; niveau 2 (contrôles secondaires) seulement au mouvement.
  const tier1 = !immersive;
  const tier2 = !immersive && controls;
  const fade = (visible: boolean): string =>
    `transition-opacity duration-base ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-viewer overflow-hidden overscroll-contain outline-none"
      style={{
        backgroundColor: '#000',
        opacity: entered ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onMouseMove={wake}
    >
      {/* Zone photo — plein écran. Tap = bascule immersif ; clic sur le fond noir
          (hors photo) = fermeture ; glissé horizontal = navigation ; glissé bas =
          fermeture. Zoomé : glisser déplace la photo. */}
      <div
        ref={stageRef}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${
          zoom ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        onPointerDown={(e) => {
          pointerStart.current = { x: e.clientX, y: e.clientY };
          if (zoom) drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!zoom || !drag.current) return;
          // /2 : on annule l'échelle pour un déplacement 1:1 au doigt.
          const dx = (e.clientX - drag.current.x) / 2;
          const dy = (e.clientY - drag.current.y) / 2;
          drag.current = { x: e.clientX, y: e.clientY };
          setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        }}
        onPointerUp={(e) => {
          const s = pointerStart.current;
          pointerStart.current = null;
          if (editing) return;
          if (zoom) {
            drag.current = null;
            return;
          }
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          const adx = Math.abs(dx);
          const ady = Math.abs(dy);
          if (adx > 40 && adx > ady) {
            go(dx < 0 ? 1 : -1);
            return;
          }
          if (dy > 80 && ady > adx) {
            requestClose();
            return;
          }
          if (adx < 10 && ady < 10) {
            // Tap : sur le fond noir → fermer ; sur la photo → bascule immersif.
            if (e.target === stageRef.current) requestClose();
            else setImmersive((v) => !v);
          }
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
      </div>

      {/* Barre haute. Niveau 1 : compteur + fermer. Niveau 2 : titre + zoom /
          annoter / afficher-masquer (apparaissent au mouvement). */}
      <div
        data-chrome="top"
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-paper-0 ${fade(
          tier1,
        )}`}
        style={{ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))' }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium tabular-nums" aria-label="Position dans l’album">
            {index + 1} / {total}
          </p>
          <p className={`truncate font-serif text-lg font-semibold tracking-tight ${fade(tier2)}`}>
            {heading}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className={`flex items-center gap-1 ${fade(tier2)}`}>
            {current.imageUrl && !editing && (
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
                aria-label={
                  showAnnotations ? 'Masquer les annotations' : 'Afficher les annotations'
                }
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
                wake();
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
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fermer"
            className="inline-flex size-10 items-center justify-center rounded-full text-paper-0 transition-colors duration-base hover:bg-paper-0/10 [&_svg]:size-5"
          >
            <X aria-hidden />
          </button>
        </div>
      </div>

      {/* Flèches (niveau 1, hors zoom). */}
      {tier1 && !zoom && index > 0 && (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Photo précédente"
          className="absolute left-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
        >
          <ChevronLeft aria-hidden />
        </button>
      )}
      {tier1 && !zoom && index < total - 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Photo suivante"
          className="absolute right-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper-0/10 text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-6"
        >
          <ChevronRight aria-hidden />
        </button>
      )}

      {/* Barre basse (niveau 2) : légende + bouton commentaires + pellicule. */}
      <div
        data-chrome="bottom"
        className={`absolute inset-x-0 bottom-0 space-y-2 p-3 text-paper-0 ${fade(tier2)}`}
        style={{ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))' }}
      >
        {current.legende && (
          <p className="mx-auto max-w-2xl text-center text-sm opacity-90">{current.legende}</p>
        )}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setSheet(true);
              setControls(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-0/10 px-3.5 py-1.5 text-sm text-paper-0 transition-colors duration-base hover:bg-paper-0/20 [&_svg]:size-4"
          >
            <MessageCircle aria-hidden />
            Commentaires ({commentCount})
          </button>
        </div>
        {/* Pellicule COMPACTE. */}
        {total > 1 && (
          <div className="mx-auto flex max-w-2xl snap-x justify-center gap-1.5 overflow-x-auto">
            {photos.map((p, i) => {
              const hasMsg = (counts.get(p.id) ?? 0) > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    wake();
                  }}
                  aria-label={`Aller à la photo ${i + 1}`}
                  aria-current={i === index}
                  className={`relative size-10 shrink-0 snap-start overflow-hidden rounded-md border-2 transition-all duration-base ${
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
      </div>

      {/* BOTTOM SHEET commentaires / annotations — la photo reste visible derrière.
          Fermable au clic (croix / fond) ou au glissé vers le bas. */}
      {sheet && (
        <>
          <button
            type="button"
            aria-label="Fermer les commentaires"
            onClick={() => setSheet(false)}
            className="absolute inset-0 cursor-default bg-transparent"
          />
          <section
            role="dialog"
            aria-label="Commentaires de la photo"
            className="absolute inset-x-0 bottom-0 flex max-h-[70%] flex-col rounded-t-2xl bg-ink-900 text-paper-0 shadow-2xl"
            onTouchStart={(e) => {
              sheetStartY.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              if (sheetStartY.current == null) return;
              const dy =
                (e.changedTouches[0]?.clientY ?? sheetStartY.current) - sheetStartY.current;
              if (dy > 60) setSheet(false);
              sheetStartY.current = null;
            }}
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="mx-auto h-1 w-10 rounded-full bg-paper-0/25" aria-hidden />
              <button
                type="button"
                onClick={() => setSheet(false)}
                aria-label="Réduire les commentaires"
                className="absolute right-3 inline-flex size-9 items-center justify-center rounded-full text-paper-0 hover:bg-paper-0/10 [&_svg]:size-5"
              >
                <X aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              {photoMessages.length === 0 && !(canCreateAction && photoAnnotations.length > 0) && (
                <p className="py-6 text-center text-sm opacity-70">
                  Aucun commentaire pour l’instant.
                </p>
              )}
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

              {/* PONT conducteur : créer une réserve depuis une annotation. */}
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

            <div className="flex gap-2 border-t border-paper-0/15 p-3">
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
          </section>
        </>
      )}
    </div>,
    document.body,
  );
}
