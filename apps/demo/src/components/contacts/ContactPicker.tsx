import { useState } from 'react';
import { CONTACT_ROLE_LABEL, type ContactRole, type ProjectId } from '@phenix360/core';
import { Plus } from 'lucide-react';
import { contactsOf, useDemo } from '../../store';
import { ContactEditor } from './ContactEditor';

/**
 * Sélecteur de contact — remplace TOUT champ « nom » en texte libre (responsable
 * d'une réserve, fournisseur d'une commande…). On choisit dans l'annuaire (les
 * contacts du chantier d'abord) ou on en crée un à la volée. Source unique :
 * l'objet ne garde qu'un `contactId`, jamais un nom ressaisi (VISION Art. 6).
 */
export function ContactPicker({
  projectId,
  value,
  onChange,
  role,
  label,
  placeholder = 'Choisir un contact…',
}: {
  projectId: ProjectId;
  value?: string;
  onChange: (contactId: string | undefined) => void;
  /** Rôle proposé par défaut à la création (et tri en tête si fourni). */
  role?: ContactRole;
  label?: string;
  placeholder?: string;
}): React.JSX.Element {
  const snap = useDemo();
  const [creating, setCreating] = useState(false);

  // Contacts du chantier d'abord (les plus probables), puis le reste de l'annuaire.
  const linked = contactsOf(snap, projectId);
  const linkedIds = new Set(linked.map((c) => c.id));
  const others = snap.contacts.filter((c) => !linkedIds.has(c.id));
  const sortNom = (a: { nom: string }, b: { nom: string }): number =>
    a.nom.localeCompare(b.nom, 'fr');
  linked.sort(sortNom);
  others.sort(sortNom);

  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label={label ?? 'Contact'}
        className="h-9 flex-1 rounded-lg border border-input bg-surface px-2 text-sm text-foreground"
      >
        <option value="">{placeholder}</option>
        {linked.length > 0 && (
          <optgroup label="Ce chantier">
            {linked.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
                {c.trade ? ` · ${c.trade}` : c.societe ? ` · ${c.societe}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Annuaire">
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
                {c.trade
                  ? ` · ${c.trade}`
                  : c.societe
                    ? ` · ${c.societe}`
                    : ` · ${CONTACT_ROLE_LABEL[c.role]}`}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Nouveau contact"
        title="Nouveau contact"
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-gold-600 transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-4"
      >
        <Plus aria-hidden />
      </button>

      {creating && (
        <ContactEditor
          projects={snap.projects}
          initialProjectId={projectId}
          {...(role ? { initialRole: role } : {})}
          onClose={() => setCreating(false)}
          onCreated={(id) => onChange(id)}
        />
      )}
    </div>
  );
}
