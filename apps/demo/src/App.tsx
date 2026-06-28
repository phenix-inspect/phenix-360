import { useState } from 'react';
import {
  BrandLockup,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  SegmentedControl,
} from '@phenix360/ui';
import { PlusCircle, RotateCcw, Settings2, Sparkles } from 'lucide-react';
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

type ViewMode = 'compagnon' | 'client' | 'split';

const VIEW_OPTIONS = [
  { value: 'compagnon' as const, label: 'Compagnon' },
  { value: 'client' as const, label: 'Espace client' },
  { value: 'split' as const, label: 'Côte à côte' },
];

export function App(): React.JSX.Element {
  const snap = useDemo();
  const [view, setView] = useState<ViewMode>('client');
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);

  const activeProject =
    snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0] ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-sticky border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
          <BrandLockup size="lg" subtitle className="mr-auto" />
          <SegmentedControl
            value={view}
            onValueChange={setView}
            options={VIEW_OPTIONS}
            aria-label="Choisir la vue"
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Gérer"
            title="Gérer"
            onClick={() => setManaging(true)}
          >
            <Settings2 aria-hidden />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {creating || activeProject === null ? (
          activeProject === null && !creating ? (
            <div className="mx-auto max-w-xl py-10">
              <EmptyState
                icon={<Sparkles aria-hidden />}
                title="Aucun projet pour l'instant"
                description="Créez votre premier chantier, ou rechargez le projet de démonstration pour découvrir PHÉNIX 360."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setCreating(true)}>Créer votre premier projet</Button>
                    <Button variant="outline" onClick={() => demo.loadDemo()}>
                      Charger la démonstration
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <CreateProject onDone={() => setCreating(false)} />
          )
        ) : view === 'split' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <FramedSurface label="Côté compagnon">
              <CompagnonView snap={snap} project={activeProject} />
            </FramedSurface>
            <FramedSurface label="Côté client">
              <ClientView snap={snap} project={activeProject} />
            </FramedSurface>
          </div>
        ) : view === 'compagnon' ? (
          <CompagnonView snap={snap} project={activeProject} />
        ) : (
          <ClientView snap={snap} project={activeProject} />
        )}
      </main>

      <ManageDialog
        open={managing}
        onClose={() => setManaging(false)}
        onNewProject={() => {
          setManaging(false);
          setCreating(true);
        }}
      />
    </div>
  );
}

function FramedSurface({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ManageDialog({
  open,
  onClose,
  onNewProject,
}: {
  open: boolean;
  onClose: () => void;
  onNewProject: () => void;
}): React.JSX.Element {
  const snap = useDemo();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer</DialogTitle>
          <DialogDescription>Projets et données de démonstration.</DialogDescription>
        </DialogHeader>

        {snap.projects.length > 1 && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Projet actif</span>
            <select
              value={snap.activeProjectId ?? ''}
              onChange={(e) => demo.setActiveProject(projectId(e.target.value))}
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {snap.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={onNewProject}>
            <PlusCircle aria-hidden />
            Nouveau projet
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              demo.loadDemo();
              onClose();
            }}
          >
            <Sparkles aria-hidden />
            Recharger la démonstration
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
            onClick={() => {
              demo.reset();
              onClose();
            }}
          >
            <RotateCcw aria-hidden />
            Repartir de zéro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
