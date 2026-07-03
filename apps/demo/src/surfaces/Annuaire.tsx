import { useMemo, useState } from 'react';
import { Button, EmptyState, Input } from '@phenix360/ui';
import { CONTACT_ROLES, CONTACT_ROLE_LABEL, type Contact, type ContactRole } from '@phenix360/core';
import { BookUser, Plus, Search } from 'lucide-react';
import { demo, useDemo } from '../store';
import { ContactCard } from '../components/contacts/ContactCard';
import { ContactEditor } from '../components/contacts/ContactEditor';

type Filter = 'tous' | ContactRole;

/**
 * Annuaire du conducteur — le carnet d'adresses global, réutilisable sur tous
 * les chantiers (VISION Art. 6 : on ne ressaisit jamais un contact). Recherche,
 * filtre par rôle, création/édition. Chaque contact porte ses actions de
 * communication et l'historique des échanges tracés.
 */
export function Annuaire(): React.JSX.Element {
  const snap = useDemo();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return snap.contacts
      .filter((c) => (filter === 'tous' ? true : c.role === filter))
      .filter((c) =>
        q
          ? [c.nom, c.societe, c.phone, c.email, CONTACT_ROLE_LABEL[c.role]]
              .filter(Boolean)
              .some((v) => v!.toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [snap.contacts, filter, q]);

  // Rôles réellement présents (on ne propose pas de filtres vides).
  const presentRoles = CONTACT_ROLES.filter((r) => snap.contacts.some((c) => c.role === r));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground [&_svg]:size-6 [&_svg]:text-gold-600">
          <BookUser aria-hidden />
          <div>
            <h2 className="font-serif text-2xl">Annuaire</h2>
            <p className="text-sm text-muted-foreground">
              Votre carnet d’adresses, réutilisable sur tous vos chantiers.
            </p>
          </div>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden /> Nouveau contact
        </Button>
      </div>

      {snap.contacts.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact…"
              aria-label="Rechercher un contact"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === 'tous'} onClick={() => setFilter('tous')}>
              Tous
            </FilterChip>
            {presentRoles.map((r) => (
              <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)}>
                {CONTACT_ROLE_LABEL[r]}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {snap.contacts.length === 0 ? (
        <EmptyState
          icon={<BookUser aria-hidden />}
          title="Votre annuaire est vide"
          description="Ajoutez vos clients, artisans et fournisseurs une seule fois. Vous les retrouverez sur chaque chantier, prêts à être appelés ou relancés."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden /> Ajouter un contact
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          Aucun contact ne correspond à cette recherche.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              projects={snap.projects}
              onEdit={() => setEditing(c)}
              onDelete={() => {
                if (window.confirm(`Supprimer « ${c.nom} » de l’annuaire ?`))
                  demo.deleteContact(c.id);
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <ContactEditor
          {...(editing !== 'new' ? { contact: editing } : {})}
          projects={snap.projects}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors duration-base ${
        active
          ? 'border-primary bg-gold-100 text-gold-800'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
