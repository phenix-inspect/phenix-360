import { Check } from 'lucide-react';
import {
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  PROJECT_STEP_ORDER,
  type ProjectStep,
} from '@phenix360/core';
import { cn } from '@phenix360/ui';

/**
 * Avancement par ÉTAPES (jamais un %). Donne l'émotion « un chantier qui
 * avance » : étapes passées validées, étape courante en or, à venir discrètes.
 * Lecture pure de `project.currentStep` — aucune logique ici.
 */
export function StepProgress({
  current,
  className,
}: {
  current: ProjectStep | null;
  className?: string;
}): React.JSX.Element {
  const currentOrder = current ? PROJECT_STEP_ORDER[current] : -1;

  return (
    <ol className={cn('flex items-center', className)}>
      {PROJECT_STEPS.map((step, i) => {
        const order = PROJECT_STEP_ORDER[step];
        const done = order < currentOrder;
        const active = order === currentOrder;
        const last = i === PROJECT_STEPS.length - 1;
        return (
          <li key={step} className={cn('flex items-center', last ? 'shrink-0' : 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold [&_svg]:size-3.5',
                  active && 'border-primary bg-primary text-primary-foreground',
                  done && 'border-gold-300 bg-gold-100 text-gold-800',
                  !active && !done && 'border-border bg-surface text-muted-foreground',
                )}
              >
                {done ? <Check aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {PROJECT_STEP_LABEL[step]}
              </span>
            </div>
            {!last && (
              <span
                aria-hidden
                className={cn('mx-2 h-px flex-1', done ? 'bg-gold-300' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
