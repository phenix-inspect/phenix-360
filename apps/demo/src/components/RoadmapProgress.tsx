import { cn } from '@phenix360/ui';
import type { RoadmapStep } from '@phenix360/core';

/**
 * Feuille de route du projet (étapes propres au chantier). Affichage en flux —
 * remplace la notion fixe gros œuvre / second œuvre / finitions.
 */
export function RoadmapProgress({
  roadmap,
  className,
}: {
  roadmap: RoadmapStep[];
  className?: string;
}): React.JSX.Element {
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-1 gap-y-2', className)}>
      {roadmap.map((step, i) => (
        <li key={step.id} className="flex items-center gap-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground">
            <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
            {step.label}
          </span>
          {i < roadmap.length - 1 && (
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
