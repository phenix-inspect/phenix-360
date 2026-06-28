import * as React from 'react';
import { cn } from '../lib/cn.js';

/**
 * Textarea — saisie multi-lignes (compte rendu terrain, message). Confortable à
 * lire et à écrire. Valeurs issues des tokens.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm leading-relaxed text-foreground transition-colors duration-base ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
