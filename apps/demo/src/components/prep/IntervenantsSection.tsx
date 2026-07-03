import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import type { Fournisseur, ProjectDossier, SousTraitant } from '@phenix360/core';
import { HardHat, Plus, Truck, X } from 'lucide-react';

type Person = SousTraitant | Fournisseur;

/**
 * Intervenants du chantier (EPIC 1 — Préparation) : artisans / sous-traitants et
 * fournisseurs, avec contact. CRUD complet — le conducteur constitue son équipe
 * avant le premier coup de marteau. VISION Art. 2.
 */
export function IntervenantsSection({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const artisans = dossier.sousTraitants ?? [];
  const fournisseurs = dossier.fournisseurs ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <List
        icon={<HardHat aria-hidden />}
        title="Artisans & sous-traitants"
        lotPlaceholder="Lot (ex. Plomberie)"
        people={artisans}
        onAdd={(p) => patch({ sousTraitants: [...artisans, p] })}
        onRemove={(id) => patch({ sousTraitants: artisans.filter((x) => x.id !== id) })}
      />
      <List
        icon={<Truck aria-hidden />}
        title="Fournisseurs"
        lotPlaceholder="Fourniture (ex. Carrelage)"
        people={fournisseurs}
        onAdd={(p) => patch({ fournisseurs: [...fournisseurs, p] })}
        onRemove={(id) => patch({ fournisseurs: fournisseurs.filter((x) => x.id !== id) })}
      />
    </div>
  );
}

function List({
  icon,
  title,
  lotPlaceholder,
  people,
  onAdd,
  onRemove,
}: {
  icon: React.ReactNode;
  title: string;
  lotPlaceholder: string;
  people: Person[];
  onAdd: (p: Person) => void;
  onRemove: (id: string) => void;
}): React.JSX.Element {
  const [nom, setNom] = useState('');
  const [lot, setLot] = useState('');
  const [contact, setContact] = useState('');

  const add = (): void => {
    const n = nom.trim();
    if (!n) return;
    onAdd({
      id: crypto.randomUUID(),
      nom: n,
      ...(lot.trim() ? { lot: lot.trim() } : {}),
      ...(contact.trim() ? { contact: contact.trim() } : {}),
    });
    setNom('');
    setLot('');
    setContact('');
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          {icon}
          {title}
          <span className="text-muted-foreground">({people.length})</span>
        </h3>

        {people.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.nom}
                    {p.lot ? (
                      <span className="font-normal text-muted-foreground"> · {p.lot}</span>
                    ) : null}
                  </p>
                  {p.contact && (
                    <p className="truncate text-xs text-muted-foreground">{p.contact}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Retirer ${p.nom}`}
                  onClick={() => onRemove(p.id)}
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom"
              aria-label={`Nom — ${title}`}
            />
            <Input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder={lotPlaceholder}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Contact (tél. ou email)"
              className="min-w-40 flex-1"
            />
            <Button
              size="sm"
              onClick={add}
              disabled={!nom.trim()}
              aria-label={`Ajouter — ${title}`}
            >
              <Plus aria-hidden /> Ajouter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
