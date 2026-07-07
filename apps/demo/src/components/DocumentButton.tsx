import { FileText } from 'lucide-react';
import type { Event } from '@phenix360/core';
import { demo } from '../store';

/**
 * Bouton d'ouverture d'un document — règle unique de PHÉNIX : tout document se
 * consulte d'un clic. Un vrai fichier (PDF / image) s'ouvre ; un document généré
 * par PHÉNIX (compte rendu, PV de réception, fiche de référence) se génère à
 * l'ouverture. Rendu pour les événements `document` et `compte_rendu`.
 */
export function DocumentButton({
  event,
  className,
}: {
  event: Event;
  className?: string;
}): React.JSX.Element {
  const label = event.type === 'compte_rendu' ? 'Consulter le compte rendu' : 'Ouvrir le document';
  return (
    <button
      type="button"
      onClick={() => demo.openDocument(event)}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 ${className ?? ''}`}
    >
      <FileText aria-hidden />
      {label}
    </button>
  );
}
