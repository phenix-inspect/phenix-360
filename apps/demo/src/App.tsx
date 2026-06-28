import { useEffect, useState } from 'react';
import {
  Badge,
  BrandLockup,
  BrandSplash,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@phenix360/ui';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  PROJECT_STEP_LABEL,
  PROJECT_STEPS,
  projectId,
  userId,
  type ProjectStatus,
  type ProjectStep,
} from '@phenix360/core';
import { demo, useDemo } from './store';
import { CompagnonView } from './surfaces/CompagnonView';
import { ClientView } from './surfaces/ClientView';

type ViewMode = 'split' | 'compagnon' | 'client';

export function App(): React.JSX.Element {
  const snap = useDemo();
  const [view, setView] = useState<ViewMode>('split');
  const [creating, setCreating] = useState(false);

  const activeProject =
    snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0] ?? null;
  const showCreate = creating || activeProject === null;

  return (
    <div className="min-h-screen">
      <BootSplash />
      <header className="sticky top-0 z-sticky border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div className="mr-auto flex items-center gap-3">
            <BrandLockup subtitle />
            <Badge variant="neutral">Mode Démo</Badge>
          </div>

          {snap.projects.length > 0 && (
            <select
              value={activeProject?.id ?? ''}
              onChange={(e) => {
                demo.setActiveProject(projectId(e.target.value));
                setCreating(false);
              }}
              className="h-9 max-w-48 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
            >
              {snap.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(['split', 'compagnon', 'client'] as ViewMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={view === m ? 'primary' : 'ghost'}
                onClick={() => setView(m)}
              >
                {m === 'split' ? 'Côte à côte' : m === 'compagnon' ? 'Compagnon' : 'Espace client'}
              </Button>
            ))}
          </div>

          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            + Projet
          </Button>
          <Button size="sm" variant="ghost" onClick={() => demo.reset()}>
            Réinitialiser
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {showCreate ? (
          <CreateProject onDone={() => setCreating(false)} />
        ) : view === 'split' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface label="Compagnon" tone="interne">
              <CompagnonView snap={snap} project={activeProject!} />
            </Surface>
            <Surface label="Espace client" tone="client">
              <ClientView snap={snap} project={activeProject!} />
            </Surface>
          </div>
        ) : view === 'compagnon' ? (
          <CompagnonView snap={snap} project={activeProject!} />
        ) : (
          <ClientView snap={snap} project={activeProject!} />
        )}
      </main>
    </div>
  );
}

/**
 * Écran de démarrage : l'identité PHÉNIX (logo + nom + tagline) en premier,
 * fondu de sortie léger, puis démontage. Sobre, pas de gadget.
 */
function BootSplash(): React.JSX.Element | null {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'gone'>('visible');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('leaving'), 1300);
    const t2 = setTimeout(() => setPhase('gone'), 1750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'gone') return null;
  return <BrandSplash leaving={phase === 'leaving'} />;
}

function Surface({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'interne' | 'client';
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-paper-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant={tone === 'client' ? 'gold' : 'neutral'}>{label}</Badge>
      </div>
      {children}
    </div>
  );
}

function CreateProject({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [compaName, setCompaName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('en_cours');
  const [etape, setEtape] = useState<ProjectStep | ''>('');

  const submit = async () => {
    if (!name.trim()) return;
    const clientId = userId(crypto.randomUUID());
    const compaId = userId(crypto.randomUUID());
    const project = await demo.createProject({ name: name.trim(), status, clientId });
    await demo.addMember({ projectId: project.id, userId: compaId, role: 'compagnon' });
    await demo.addMember({ projectId: project.id, userId: clientId, role: 'client' });
    demo.setPerson(compaId, compaName.trim() || 'Compagnon PHÉNIX');
    demo.setPerson(clientId, clientName.trim() || 'Client');
    if (etape) {
      await demo.appendEvent({
        projectId: project.id,
        type: 'compte_rendu',
        actor: {
          userId: compaId,
          role: 'compagnon',
          displayName: compaName.trim() || 'Compagnon PHÉNIX',
        },
        visibility: 'client',
        state: 'publie',
        content: { texte: 'Démarrage du chantier.', etapeProposee: etape, etapeConfirmee: etape },
      });
    }
    demo.setActiveProject(project.id);
    onDone();
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Créer un projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Titre du chantier">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rénovation Martin — Lyon 6e"
            />
          </Field>
          <Field label="Client">
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Mme Martin"
            />
          </Field>
          <Field label="Compagnon (vous)">
            <Input
              value={compaName}
              onChange={(e) => setCompaName(e.target.value)}
              placeholder="Lucas"
            />
          </Field>
          <div className="flex flex-wrap gap-4">
            <Field label="Statut">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Étape initiale (optionnel)">
              <select
                value={etape}
                onChange={(e) => setEtape(e.target.value as ProjectStep | '')}
                className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
              >
                <option value="">— aucune</option>
                {PROJECT_STEPS.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STEP_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onDone}>
              Annuler
            </Button>
            <Button onClick={() => void submit()}>Créer le projet</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
