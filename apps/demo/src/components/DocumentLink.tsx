import { FileText } from 'lucide-react';
import type { EventAttachment } from '@phenix360/core';
import { openAttachment } from '../lib/document';

/**
 * Ouvre un document réel (data URL base64) dans un nouvel onglet / l'aperçu du
 * navigateur. Rendu UNIQUEMENT s'il y a un vrai fichier attaché — les documents
 * seedés (sans `dataUrl`) n'affichent pas de lien mort.
 */
export function DocumentLink({
  attachment,
  className,
}: {
  attachment: EventAttachment;
  className?: string;
}): React.JSX.Element | null {
  if (!attachment.dataUrl) return null;
  return (
    <button
      type="button"
      onClick={() => openAttachment(attachment)}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 ${className ?? ''}`}
    >
      <FileText aria-hidden />
      Ouvrir le document
    </button>
  );
}
