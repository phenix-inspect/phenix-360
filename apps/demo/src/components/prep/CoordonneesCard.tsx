import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import type { Project, ProjectDossier, ProjectInfos } from '@phenix360/core';
import { Contact as ContactIcon, Pencil } from 'lucide-react';
import { clientContactOf, demo, useDemo } from '../../store';
import { fmtDateShort, fmtMoney } from '../../lib/format';
import { ContactEditor } from '../contacts/ContactEditor';

/**
 * Coordonnées & accès client (Préparation). L'identité du client (nom, tél,
 * email, adresse) est éditée **une seule fois**, sur son CONTACT (source unique —
 * VISION Art. 6) ; les infos du bien (type, surface, budget, durée, début) vivent
 * sur le dossier. Plus de ressaisie, plus de doublon.
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
  const snap = useDemo();
  const [editingInfos, setEditingInfos] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const i = dossier.infos;
  const client = clientContactOf(snap, project.clientId);

  const openClient = (): void => {
    setEditingClientId(client?.id ?? demo.ensureClientContact(project));
  };

  if (editingInfos) {
    return (
      <Editor
        infos={i}
        onCancel={() => setEditingInfos(false)}
        onSave={(next) => {
          patch({ infos: { ...i, ...next } });
          setEditingInfos(false);
        }}
      />
    );
  }

  const editingContact = editingClientId
    ? snap.contacts.find((c) => c.id === editingClientId)
    : undefined;

  const rows: [string, string | undefined][] = [
    ['Client', client?.nom ?? i.clientName],
    ['Téléphone', client?.phone ?? i.phone],
    ['Email', client?.email ?? i.email],
    ['Adresse', client?.address ?? project.address ?? i.address],
    ['Type de bien', i.propertyType],
    ['Surface', i.surface ? `${i.surface} m²` : undefined],
    ['Budget', i.budget ? fmtMoney(i.budget) : undefined],
    ['Durée estimée', i.duration],
    ['Début souhaité', i.startDate ? fmtDateShort(i.startDate) : undefined],
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <ContactIcon aria-hidden />
          <h3 className="text-sm font-medium">Coordonnées & accès client</h3>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={openClient}
            >
              <Pencil aria-hidden /> Modifier le client
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setEditingInfos(true)}
            >
              <Pencil aria-hidden /> Modifier les infos
            </Button>
          </div>
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
          chantier est créé pour lui. Ses coordonnées se modifient sur sa fiche contact.
        </p>
      </CardContent>

      {editingContact && (
        <ContactEditor
          contact={editingContact}
          projects={snap.projects}
          onClose={() => setEditingClientId(null)}
        />
      )}
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
          <ContactIcon aria-hidden /> Informations du bien
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
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
