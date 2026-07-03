import { FileText } from 'lucide-react';
import type { EventAttachment } from '@phenix360/core';

/**
 * Aperçu d'un document réel (Lot 3) : ouvre / télécharge le fichier local
 * (data URL base64). Rendu uniquement s'il y a un vrai fichier attaché — les
 * documents seedés (sans `dataUrl`) n'affichent pas de lien mort.
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
    <a
      href={attachment.dataUrl}
      download={attachment.fileName ?? 'document'}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-3.5 ${className ?? ''}`}
    >
      <FileText aria-hidden />
      Ouvrir le document
    </a>
  );
}
