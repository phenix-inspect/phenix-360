import { useState } from 'react';
import {
  BrandLockup,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SegmentedControl,
} from '@phenix360/ui';
import { PlusCircle, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import { projectId } from '@phenix360/core';
import { demo, useDemo } from './store';
import { CompagnonView } from './surfaces/CompagnonView';
import { ClientView } from './surfaces/ClientView';
import { PhenixStart } from './start/PhenixStart';

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
          {!creating && (
            <SegmentedControl
              value={view}
              onValueChange={setView}
              options={VIEW_OPTIONS}
              aria-label="Choisir la vue"
            />
          )}
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
        {creating ? (
          <PhenixStart
            onCreated={() => {
              setCreating(false);
              setView('compagnon');
            }}
            onCancel={() => setCreating(false)}
          />
        ) : activeProject === null ? (
          <div className="mx-auto max-w-xl py-10">
            <EmptyState
              icon={<Sparkles aria-hidden />}
              title="Aucun projet pour l'instant"
              description="Déposez un dossier et laissez PHÉNIX préparer le chantier, ou rechargez le projet de démonstration."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setCreating(true)}>Nouveau projet</Button>
                  <Button variant="outline" onClick={() => demo.loadDemo()}>
                    Charger la démonstration
                  </Button>
                </div>
              }
            />
          </div>
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
