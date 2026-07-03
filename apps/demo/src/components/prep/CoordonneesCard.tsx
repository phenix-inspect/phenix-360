import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import type { Project, ProjectDossier, ProjectInfos } from '@phenix360/core';
import { Contact, Pencil } from 'lucide-react';
import { demo } from '../../store';
import { fmtDateShort, fmtMoney } from '../../lib/format';

/**
 * Coordonnées & accès client (EPIC 1 — Préparation). Éditable : le conducteur
 * saisit tout ce qu'il faut pour joindre le client et situer le chantier. La
 * mise à jour synchronise le dossier ET le chantier (nom client, adresse) pour
 * que l'ensemble de l'app reste cohérent. VISION Art. 2, 11.
 */
export function CoordonneesCard({
  project,
  dossier,
  patch,
}: {
  project: Project;
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const i = dossier.infos;

  if (editing) {
    return (
      <Editor
        infos={i}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          patch({ infos: { ...i, ...next } });
          // Synchronise le chantier (nom client + adresse) avec le dossier.
          void demo.updateChantier(project.id, {
            ...(next.clientName !== undefined ? { clientName: next.clientName } : {}),
            ...(next.address !== undefined ? { address: next.address } : {}),
          });
          setEditing(false);
        }}
      />
    );
  }

  const rows: [string, string | undefined][] = [
    ['Client', i.clientName],
    ['Téléphone', i.phone],
    ['Email', i.email],
    ['Adresse', i.address],
    ['Type de bien', i.propertyType],
    ['Surface', i.surface ? `${i.surface} m²` : undefined],
    ['Budget', i.budget ? fmtMoney(i.budget) : undefined],
    ['Durée estimée', i.duration],
    ['Début souhaité', i.startDate ? fmtDateShort(i.startDate) : undefined],
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Contact aria-hidden />
          <h3 className="text-sm font-medium">Coordonnées & accès client</h3>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden /> Modifier les coordonnées
          </Button>
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="text-sm text-foreground">{value ?? '—'}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Le client accède à son Espace client (récit, décisions, documents partagés) dès qu'un
          chantier est créé pour lui.
        </p>
      </CardContent>
    </Card>
  );
}

function Editor({
  infos,
  onSave,
  onCancel,
}: {
  infos: ProjectInfos;
  onSave: (next: Partial<ProjectInfos>) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [v, setV] = useState<ProjectInfos>(infos);
  const set = <K extends keyof ProjectInfos>(key: K, value: ProjectInfos[K]): void =>
    setV((p) => ({ ...p, [key]: value }));
  const num = (s: string): number | undefined => (s ? Number(s) : undefined);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Contact aria-hidden /> Coordonnées & accès client
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Nom du client">
            <Input value={v.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} />
          </F>
          <F label="Téléphone">
            <Input value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </F>
          <F label="Email">
            <Input value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </F>
          <F label="Adresse">
            <Input value={v.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </F>
          <F label="Type de bien">
            <Input
              value={v.propertyType ?? ''}
              onChange={(e) => set('propertyType', e.target.value)}
              placeholder="Ex. Appartement, Maison"
            />
          </F>
          <F label="Surface (m²)">
            <Input
              type="number"
              value={v.surface ?? ''}
              onChange={(e) => set('surface', num(e.target.value))}
            />
          </F>
          <F label="Budget (€)">
            <Input
              type="number"
              value={v.budget ?? ''}
              onChange={(e) => set('budget', num(e.target.value))}
            />
          </F>
          <F label="Durée estimée">
            <Input
              value={v.duration ?? ''}
              onChange={(e) => set('duration', e.target.value)}
              placeholder="Ex. 3 mois"
            />
          </F>
          <F label="Date de début souhaitée">
            <Input
              type="date"
              value={v.startDate ?? ''}
              onChange={(e) => set('startDate', e.target.value || undefined)}
            />
          </F>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={() => onSave(v)}>Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
