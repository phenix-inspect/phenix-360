import { useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { CONTACT_ROLE_LABEL, type Contact, type Project } from '@phenix360/core';
import { Link2, Plus } from 'lucide-react';
import { contactsOf, demo, useDemo } from '../../store';
import { ContactCard } from './ContactCard';
import { ContactEditor } from './ContactEditor';

/**
 * Carnet du chantier (Préparation) : les contacts de l'annuaire liés à CE
 * chantier — appeler, relancer, envoyer un CR sans quitter PHÉNIX. Toute action
 * lancée d'ici est tracée au Journal du chantier (VISION Art. 6, 7, 9).
 */
export function CarnetChantier({ project }: { project: Project }): React.JSX.Element {
  const snap = useDemo();
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [linking, setLinking] = useState(false);
  const contacts = contactsOf(snap, project.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const unlinked = snap.contacts.filter((c) => !c.projectIds.includes(project.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        {unlinked.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
            <Link2 aria-hidden /> Lier un contact
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus aria-hidden /> Nouveau contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
          Aucun contact lié à ce chantier. Liez un client, un artisan ou un fournisseur pour
          l’appeler et le relancer en un geste.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              projectId={project.id}
              chantierName={project.name}
              onEdit={() => setEditing(c)}
            />
          ))}
        </div>
      )}

      {linking && (
        <Dialog open onOpenChange={(o) => !o && setLinking(false)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lier un contact au chantier</DialogTitle>
              <DialogDescription>
                Choisissez dans votre annuaire — un contact peut servir plusieurs chantiers.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {unlinked.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.societe ? `${c.societe} · ` : ''}
                      {CONTACT_ROLE_LABEL[c.role]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => demo.toggleContactProject(c.id, project.id)}
                  >
                    <Link2 aria-hidden /> Lier
                  </Button>
                </li>
              ))}
              {unlinked.length === 0 && (
                <li className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
                  Tous vos contacts sont déjà liés à ce chantier.
                </li>
              )}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Badge variant="neutral">{unlinked.length} disponible(s)</Badge>
              <Button variant="ghost" onClick={() => setLinking(false)}>
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editing && (
        <ContactEditor
          {...(editing !== 'new' ? { contact: editing } : {})}
          projects={snap.projects}
          initialProjectId={project.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
