import type { ProjectId } from '@phenix360/core';
import { useDemo } from '../store';
import { ContactActions } from './contacts/ContactActions';

/**
 * Pont réserve → annuaire : le responsable d'une réserve EST un contact (lien
 * direct, source unique). Depuis le Suivi, PHÉNIX propose de le joindre en un
 * geste — appeler, relancer par SMS/WhatsApp/mail — sans quitter le journal
 * (VISION Art. 6, 7). Toute action lancée d'ici est tracée au Journal.
 *
 * (Auparavant dans la page « Réserves », supprimée : la réserve est désormais un
 * événement du Journal, retrouvé et actionné au Suivi.)
 */
export function ReserveResponsable({
  projectId,
  contactId,
}: {
  projectId: ProjectId;
  contactId: string;
}): React.JSX.Element | null {
  const snap = useDemo();
  const contact = snap.contacts.find((c) => c.id === contactId);
  if (!contact) return null;
  const project = snap.projects.find((p) => p.id === projectId);
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/60 p-2.5">
      <p className="mb-1.5 text-xs text-muted-foreground">
        Joindre <span className="font-medium text-foreground">{contact.nom}</span>
        {contact.societe ? ` · ${contact.societe}` : ''}
      </p>
      <ContactActions
        contact={contact}
        projectId={projectId}
        {...(project ? { chantierName: project.name } : {})}
        compact
      />
    </div>
  );
}
