import { useState } from 'react';
import { Badge, Button } from '@phenix360/ui';
import {
  CONTACT_ROLE_LABEL,
  type Contact,
  type ContactRole,
  type Project,
  type ProjectId,
} from '@phenix360/core';
import { Building2, History, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import { ContactActions } from './ContactActions';
import { communicationsOf, useDemo } from '../../store';
import { eventTitle, eventDescription } from '../../lib/eventText';
import { fmtDateTime } from '../../lib/format';

const ROLE_VARIANT: Record<ContactRole, 'gold' | 'info' | 'neutral'> = {
  client: 'gold',
  artisan: 'neutral',
  fournisseur: 'info',
  architecte: 'info',
  bureau_controle: 'neutral',
  assureur: 'neutral',
  investisseur: 'info',
  autre: 'neutral',
};

/**
 * Carte d'un contact de l'annuaire : identité, coordonnées, actions de
 * communication (deep-links) et historique des échanges tracés. Réutilisée par
 * l'Annuaire global et par le Carnet du chantier (Préparation).
 */
export function ContactCard({
  contact,
  projectId = null,
  chantierName,
  projects = [],
  onEdit,
  onDelete,
}: {
  contact: Contact;
  projectId?: ProjectId | null;
  chantierName?: string;
  /** Chantiers connus (pour afficher les rattachements dans l'annuaire global). */
  projects?: Project[];
  onEdit?: () => void;
  onDelete?: () => void;
}): React.JSX.Element {
  const snap = useDemo();
  const [showHistory, setShowHistory] = useState(false);
  const history = communicationsOf(snap, contact.id);
  const linked = projects.filter((p) => contact.projectIds.includes(p.id));

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar name={contact.nom} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{contact.nom}</p>
            <Badge variant={ROLE_VARIANT[contact.role]}>{CONTACT_ROLE_LABEL[contact.role]}</Badge>
          </div>
          {contact.societe && <p className="text-sm text-muted-foreground">{contact.societe}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Modifier ${contact.nom}`}
              onClick={onEdit}
            >
              <Pencil aria-hidden />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Supprimer ${contact.nom}`}
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {(contact.phone || contact.email || contact.address) && (
        <div className="space-y-1 text-sm text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-gold-600">
          {contact.phone && (
            <p className="flex items-center gap-2">
              <Phone aria-hidden /> {contact.phone}
            </p>
          )}
          {contact.email && (
            <p className="flex items-center gap-2">
              <Mail aria-hidden /> {contact.email}
            </p>
          )}
          {contact.address && (
            <p className="flex items-center gap-2">
              <MapPin aria-hidden /> {contact.address}
            </p>
          )}
        </div>
      )}

      {contact.notes && <p className="text-sm text-foreground">{contact.notes}</p>}

      {linked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
          <Building2 aria-hidden />
          {linked.map((p) => (
            <span key={p.id} className="rounded-full bg-muted px-2 py-0.5">
              {p.name}
            </span>
          ))}
        </div>
      )}

      <ContactActions contact={contact} projectId={projectId} chantierName={chantierName} />

      {history.length > 0 && (
        <div className="border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-base hover:text-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600"
          >
            <History aria-hidden />
            {showHistory ? 'Masquer' : 'Historique'} des échanges ({history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {history.map((e) => (
                <li key={e.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{eventTitle(e)}</span>
                  {eventDescription(e) ? ` — ${eventDescription(e)}` : ''}
                  <span className="block text-[11px] text-muted-foreground/80">
                    {fmtDateTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
