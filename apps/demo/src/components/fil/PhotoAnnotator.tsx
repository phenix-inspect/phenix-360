import { useRef, useState } from 'react';
import { ArrowUpRight, Circle, Hash, Pen, Type, X } from 'lucide-react';
import {
  prochainNumeroAnnotation,
  type Annotation,
  type AnnotationPoint,
  type AnnotationType,
  type FilPhoto,
} from '@phenix360/core';

const clamp = (v: number): number => Math.min(1, Math.max(0, v));

interface Draft {
  type: AnnotationType;
  points: AnnotationPoint[];
}

/** Entrée passée au parent pour créer une annotation. */
export interface AnnotationInput {
  photoId: string;
  type: AnnotationType;
  points: AnnotationPoint[];
  texte?: string;
  numero?: number;
  note?: string;
}

const TOOLS: { type: AnnotationType; label: string; icon: React.ReactNode }[] = [
  { type: 'cercle', label: 'Entourer', icon: <Circle aria-hidden /> },
  { type: 'fleche', label: 'Flèche', icon: <ArrowUpRight aria-hidden /> },
  { type: 'trait', label: 'Dessiner', icon: <Pen aria-hidden /> },
  { type: 'texte', label: 'Texte', icon: <Type aria-hidden /> },
  { type: 'numero', label: 'Numéro', icon: <Hash aria-hidden /> },
];

/**
 * Calque d'ANNOTATIONS au-dessus d'une photo — l'image d'origine n'est JAMAIS
 * modifiée. Affiche les annotations (SVG + repères) et, en mode édition,
 * laisse dessiner (cercle, flèche, trait, texte, numéro). Coordonnées
 * normalisées (0..1). Une note saisie crée un message rattaché (via onAdd).
 */
export function PhotoAnnotator({
  photo,
  annotations,
  show,
  editing,
  onAdd,
}: {
  photo: FilPhoto;
  annotations: Annotation[];
  show: boolean;
  editing: boolean;
  onAdd: (input: AnnotationInput) => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<AnnotationType>('cercle');
  const [draft, setDraft] = useState<Draft | null>(null);
  // Forme/point en attente d'une note (cercle/flèche/trait/texte).
  const [pending, setPending] = useState<Draft | null>(null);
  const [note, setNote] = useState('');

  const visibleAnnotations = show || editing ? annotations : [];

  const rel = (e: React.PointerEvent): AnnotationPoint => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const onDown = (e: React.PointerEvent): void => {
    if (!editing || pending) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = rel(e);
    if (tool === 'numero') {
      onAdd({
        photoId: photo.id,
        type: 'numero',
        points: [p],
        numero: prochainNumeroAnnotation(photo.id, annotations),
      });
      return;
    }
    if (tool === 'texte') {
      setPending({ type: 'texte', points: [p] });
      return;
    }
    setDraft({ type: tool, points: tool === 'trait' ? [p] : [p, p] });
  };

  const onMove = (e: React.PointerEvent): void => {
    if (!editing || !draft) return;
    e.stopPropagation();
    const p = rel(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.type === 'trait') return { ...d, points: [...d.points, p] };
      return { ...d, points: [d.points[0]!, p] };
    });
  };

  const onUp = (e: React.PointerEvent): void => {
    if (!editing || !draft) return;
    e.stopPropagation();
    setPending(draft);
    setDraft(null);
  };

  const confirmPending = (): void => {
    if (!pending) return;
    onAdd({
      photoId: photo.id,
      type: pending.type,
      points: pending.points,
      ...(pending.type === 'texte' ? { texte: note.trim() || 'Note' } : {}),
      ...(pending.type !== 'texte' && note.trim() ? { note: note.trim() } : {}),
    });
    setPending(null);
    setNote('');
  };

  const cancelPending = (): void => {
    setPending(null);
    setNote('');
  };

  const renderShape = (a: Draft | Annotation, key: string, color = '#d4452f'): React.ReactNode => {
    const c = 'color' in a ? a.color : color;
    const pts = a.points;
    if (a.type === 'trait') {
      return (
        <polyline
          key={key}
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={c}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (a.type === 'cercle') {
      const [p0, p1] = [pts[0]!, pts[1] ?? pts[0]!];
      return (
        <ellipse
          key={key}
          cx={(p0.x + p1.x) / 2}
          cy={(p0.y + p1.y) / 2}
          rx={Math.abs(p1.x - p0.x) / 2}
          ry={Math.abs(p1.y - p0.y) / 2}
          fill="none"
          stroke={c}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (a.type === 'fleche') {
      const [p0, p1] = [pts[0]!, pts[1] ?? pts[0]!];
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const L = 0.05;
      const h1 = { x: p1.x - L * Math.cos(ang - 0.5), y: p1.y - L * Math.sin(ang - 0.5) };
      const h2 = { x: p1.x - L * Math.cos(ang + 0.5), y: p1.y - L * Math.sin(ang + 0.5) };
      const common = {
        stroke: c,
        strokeWidth: 3,
        strokeLinecap: 'round' as const,
        vectorEffect: 'non-scaling-stroke' as const,
      };
      return (
        <g key={key}>
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} />
          <line x1={p1.x} y1={p1.y} x2={h1.x} y2={h1.y} {...common} />
          <line x1={p1.x} y1={p1.y} x2={h2.x} y2={h2.y} {...common} />
        </g>
      );
    }
    return null;
  };

  return (
    <div ref={ref} className="absolute inset-0">
      {/* Calque vectoriel (cercle / flèche / trait) */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full"
      >
        {visibleAnnotations.map((a) => renderShape(a, a.id))}
        {draft && renderShape(draft, 'draft')}
        {pending && pending.type !== 'texte' && renderShape(pending, 'pending')}
      </svg>

      {/* Calque HTML (texte / numéro) */}
      {visibleAnnotations
        .filter((a) => a.type === 'texte' || a.type === 'numero')
        .map((a) => (
          <Label key={a.id} point={a.points[0]!} color={a.color}>
            {a.type === 'numero' ? a.numero : a.texte}
          </Label>
        ))}
      {pending?.type === 'texte' && <Label point={pending.points[0]!}>{note || '…'}</Label>}

      {/* Capture des gestes en mode édition */}
      {editing && !pending && (
        <div
          className="absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      )}

      {/* Palette d'outils */}
      {editing && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-paper-0/20 bg-ink-900/70 p-1 text-paper-0">
          {TOOLS.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setTool(t.type)}
              title={t.label}
              aria-label={t.label}
              aria-pressed={tool === t.type}
              className={`inline-flex size-9 items-center justify-center rounded-full transition-colors duration-base [&_svg]:size-4 ${
                tool === t.type ? 'bg-gold-500 text-primary-foreground' : 'hover:bg-paper-0/10'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>
      )}

      {/* Saisie de la note rattachée à l'annotation qui vient d'être tracée */}
      {pending && (
        <div className="absolute inset-x-3 bottom-3 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-paper-0/20 bg-ink-900/85 p-2 text-paper-0">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmPending();
              if (e.key === 'Escape') cancelPending();
            }}
            placeholder={
              pending.type === 'texte' ? 'Votre texte…' : 'Décrire cette annotation (optionnel)…'
            }
            className="h-9 flex-1 rounded-lg border border-paper-0/20 bg-paper-0/10 px-3 text-sm text-paper-0 placeholder:text-paper-0/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <button
            type="button"
            onClick={confirmPending}
            className="h-9 rounded-lg bg-gold-500 px-3 text-sm font-medium text-primary-foreground"
          >
            Valider
          </button>
          <button
            type="button"
            onClick={cancelPending}
            aria-label="Annuler"
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-paper-0/10 [&_svg]:size-4"
          >
            <X aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function Label({
  point,
  color = '#d4452f',
  children,
}: {
  point: AnnotationPoint;
  color?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const isNum = typeof children === 'number';
  return (
    <span
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full text-xs font-semibold text-paper-0"
      style={{
        left: `${point.x * 100}%`,
        top: `${point.y * 100}%`,
        backgroundColor: color,
        padding: isNum ? '0' : '0.125rem 0.5rem',
        width: isNum ? '1.5rem' : undefined,
        height: isNum ? '1.5rem' : undefined,
        display: isNum ? 'inline-flex' : undefined,
        alignItems: isNum ? 'center' : undefined,
        justifyContent: isNum ? 'center' : undefined,
      }}
    >
      {children}
    </span>
  );
}
