import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@phenix360/ui';
import {
  CONTACT_ROLES,
  CONTACT_ROLE_LABEL,
  type Contact,
  type ContactRole,
  type Project,
} from '@phenix360/core';
import { demo } from '../../store';

/**
 * Créer / modifier un contact de l'annuaire. Tous les champs métier d'un
 * conducteur : rôle, société, tél, email, WhatsApp, adresse, notes, chantiers
 * liés. On ne ressaisit jamais un contact (VISION Art. 6).
 */
export function ContactEditor({
  contact,
  projects,
  initialProjectId,
  initialRole,
  onClose,
  onCreated,
}: {
  contact?: Contact;
  projects: Project[];
  /** Chantier à pré-lier pour un NOUVEAU contact (créé depuis un Carnet). */
  initialProjectId?: string;
  /** Rôle par défaut d'un NOUVEAU contact (créé depuis un sélecteur ciblé). */
  initialRole?: ContactRole;
  onClose: () => void;
  /** Appelé avec l'id du contact enregistré (pour le sélectionner en amont). */
  onCreated?: (id: string) => void;
}): React.JSX.Element {
  const [nom, setNom] = useState(contact?.nom ?? '');
  const [societe, setSociete] = useState(contact?.societe ?? '');
  const [role, setRole] = useState<ContactRole>(contact?.role ?? initialRole ?? 'artisan');
  const [trade, setTrade] = useState(contact?.trade ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? '');
  const [address, setAddress] = useState(contact?.address ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [projectIds, setProjectIds] = useState<string[]>(
    contact?.projectIds ?? (initialProjectId ? [initialProjectId] : []),
  );

  const toggleProject = (id: string): void =>
    setProjectIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = (): void => {
    const n = nom.trim();
    if (!n) return;
    const trimmed = (s: string): string | undefined => (s.trim() ? s.trim() : undefined);
    const id = contact?.id ?? crypto.randomUUID();
    demo.saveContact({
      id,
      nom: n,
      role,
      projectIds,
      createdAt: contact?.createdAt ?? new Date().toISOString(),
      // On préserve le lien membre (client) — jamais éditable depuis le carnet.
      ...(contact?.userId ? { userId: contact.userId } : {}),
      ...(trimmed(trade) ? { trade: trimmed(trade) } : {}),
      ...(trimmed(societe) ? { societe: trimmed(societe) } : {}),
      ...(trimmed(phone) ? { phone: trimmed(phone) } : {}),
      ...(trimmed(email) ? { email: trimmed(email) } : {}),
      ...(trimmed(whatsapp) ? { whatsapp: trimmed(whatsapp) } : {}),
      ...(trimmed(address) ? { address: trimmed(address) } : {}),
      ...(trimmed(notes) ? { notes: trimmed(notes) } : {}),
    });
    onCreated?.(id);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'Modifier le contact' : 'Nouveau contact'}</DialogTitle>
          <DialogDescription>Réutilisable sur tous vos chantiers.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Nom">
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              aria-label="Nom du contact"
              autoFocus
            />
          </F>
          <F label="Société">
            <Input value={societe} onChange={(e) => setSociete(e.target.value)} />
          </F>
          <F label="Rôle">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ContactRole)}
              aria-label="Rôle du contact"
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {CONTACT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {CONTACT_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </F>
          {(role === 'artisan' || role === 'fournisseur') && (
            <F label={role === 'artisan' ? 'Corps d’état / lot' : 'Fourniture'}>
              <Input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder={role === 'artisan' ? 'Ex. Plomberie' : 'Ex. Carrelage'}
              />
            </F>
          )}
          <F label="Téléphone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
            />
          </F>
          <F label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </F>
          <F label="WhatsApp (si différent)">
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </F>
          <F label="Adresse" full>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </F>
          <F label="Notes" full>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </F>
        </div>

        {projects.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">Chantiers liés</span>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => {
                const on = projectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors duration-base ${
                      on
                        ? 'border-primary bg-gold-100 text-gold-800'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!nom.trim()}>
            {contact ? 'Enregistrer' : 'Créer le contact'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function F({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
