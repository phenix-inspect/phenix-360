import * as React from 'react';
import { cn } from '../lib/cn.js';

/**
 * EmptyState — état vide ÉLÉGANT (jamais une page qui semble inachevée).
 * Icône optionnelle + titre éditorial + description + action. Sobre, centré,
 * généreux en espace. Tokens uniquement.
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon != null && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="font-serif text-lg font-semibold tracking-tight text-foreground">{title}</p>
        {description != null && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action != null && <div className="mt-2">{action}</div>}
    </div>
  );
}
EmptyState.displayName = 'EmptyState';
