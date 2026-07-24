import { cn } from '@phenix360/ui';

/** Pastille d'initiales — humanise le récit (auteur d'un événement). */
export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}): React.JSX.Element {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'P';
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground',
        className,
      )}
    >
      {initials}
    </span>
  );
}
