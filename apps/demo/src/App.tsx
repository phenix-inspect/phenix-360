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
import {
  Building2,
  Eye,
  HardHat,
  Pencil,
  PlusCircle,
  RotateCcw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { projectId, type ProjectId } from '@phenix360/core';
import { demo, useDemo } from './store';
import { AujourdhuiView } from './surfaces/AujourdhuiView';
import { PointDuSoirView } from './surfaces/PointDuSoirView';
import { CompagnonView } from './surfaces/CompagnonView';
import { ArtisanView } from './surfaces/ArtisanView';
import { ClientView } from './surfaces/ClientView';
import { PhenixStart } from './start/PhenixStart';
import { Welcome } from './start/Welcome';
import { ChantierForm, type ChantierValues } from './start/ChantierForm';

type ChantierFormState = { mode: 'create' } | { mode: 'edit'; projectId: ProjectId } | null;

type ViewMode = 'aujourdhui' | 'soir' | 'compagnon' | 'artisan' | 'client';

const VIEW_OPTIONS = [
  { value: 'aujourdhui' as const, label: 'Aujourd’hui' },
  { value: 'compagnon' as const, label: 'Chantier' },
  { value: 'artisan' as const, label: 'Artisan' },
  { value: 'client' as const, label: 'Espace client' },
];

export function App(): React.JSX.Element {
  const snap = useDemo();
  const [view, setView] = useState<ViewMode>('aujourdhui');
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [chantierForm, setChantierForm] = useState<ChantierFormState>(null);

  // Tout premier lancement : on propose un choix (démo / à vide) au lieu de
  // forcer la démo. Rien d'autre ne s'affiche tant que le choix n'est pas fait.
  if (!snap.seeded) {
    return <Welcome onDemo={() => demo.loadDemo()} onBlank={() => demo.startBlank()} />;
  }

  const activeProject =
    snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0] ?? null;

  // Ancrage de contexte : on sait TOUJOURS sur quel chantier on travaille et
  // quel espace on prévisualise. Rien sur « Aujourd'hui » (vue multi-chantiers).
  const anchor =
    creating || activeProject === null
      ? null
      : view === 'compagnon'
        ? { label: 'Chantier', name: activeProject.name, preview: false }
        : view === 'artisan'
          ? { label: 'Aperçu artisan', name: activeProject.name, preview: true }
          : view === 'client'
            ? { label: 'Aperçu client', name: activeProject.name, preview: true }
            : null;

  const editProject =
    chantierForm?.mode === 'edit'
      ? (snap.projects.find((p) => p.id === chantierForm.projectId) ?? null)
      : null;
  const editInitial: Partial<ChantierValues> | undefined = editProject
    ? {
        name: editProject.name,
        clientName: editProject.clientId ? (snap.people[editProject.clientId] ?? '') : '',
        address: editProject.address ?? '',
        startStep: editProject.currentStep ?? 'gros_oeuvre',
      }
    : undefined;

  const submitChantier = async (values: ChantierValues): Promise<void> => {
    if (!chantierForm) return;
    if (chantierForm.mode === 'create') {
      await demo.createChantier(values);
      setView('compagnon');
    } else {
      await demo.updateChantier(chantierForm.projectId, values);
    }
    setChantierForm(null);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-sticky border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
          <BrandLockup size="lg" subtitle className="mr-auto" />
          {!creating && (
            <SegmentedControl
              value={view === 'soir' ? 'aujourdhui' : view}
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

        {anchor && (
          <div className="border-t border-border/60 bg-surface/40">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm sm:px-6 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600">
              {anchor.preview ? <Eye aria-hidden /> : <Building2 aria-hidden />}
              <span className="text-muted-foreground">{anchor.label}</span>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span className="truncate font-medium text-foreground">{anchor.name}</span>
            </div>
          </div>
        )}
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
        ) : view === 'aujourdhui' ? (
          snap.projects.length === 0 ? (
            <NoProject onNew={() => setChantierForm({ mode: 'create' })} />
          ) : (
            <AujourdhuiView
              snap={snap}
              onOpenChantier={(id) => {
                demo.setActiveProject(projectId(id));
                setView('compagnon');
              }}
              onCloturer={() => setView('soir')}
            />
          )
        ) : view === 'soir' ? (
          <PointDuSoirView snap={snap} onPreparerDemain={() => setView('aujourdhui')} />
        ) : activeProject === null ? (
          <NoProject onNew={() => setCreating(true)} />
        ) : view === 'compagnon' ? (
          <CompagnonView snap={snap} project={activeProject} />
        ) : view === 'artisan' ? (
          <ArtisanView snap={snap} project={activeProject} />
        ) : (
          <ClientView snap={snap} project={activeProject} />
        )}
      </main>

      <ManageDialog
        open={managing}
        canEdit={activeProject !== null}
        onClose={() => setManaging(false)}
        onNewChantier={() => {
          setManaging(false);
          setChantierForm({ mode: 'create' });
        }}
        onEditChantier={() => {
          if (!activeProject) return;
          setManaging(false);
          setChantierForm({ mode: 'edit', projectId: activeProject.id });
        }}
        onGuided={() => {
          setManaging(false);
          setCreating(true);
        }}
      />

      {chantierForm && (
        <ChantierForm
          mode={chantierForm.mode}
          initial={editInitial}
          onSubmit={submitChantier}
          onClose={() => setChantierForm(null)}
        />
      )}
    </div>
  );
}

function NoProject({ onNew }: { onNew: () => void }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={<HardHat aria-hidden />}
        title="Aucun chantier pour l'instant"
        description="Créez votre premier chantier — nom, client, adresse — et commencez à le suivre. Ou rechargez le chantier de démonstration pour explorer."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onNew}>
              <HardHat aria-hidden /> Créer un chantier
            </Button>
            <Button variant="outline" onClick={() => demo.loadDemo()}>
              Charger la démonstration
            </Button>
          </div>
        }
      />
    </div>
  );
}

function ManageDialog({
  open,
  canEdit,
  onClose,
  onNewChantier,
  onEditChantier,
  onGuided,
}: {
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onNewChantier: () => void;
  onEditChantier: () => void;
  onGuided: () => void;
}): React.JSX.Element {
  const snap = useDemo();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer</DialogTitle>
          <DialogDescription>Vos chantiers et les données de démonstration.</DialogDescription>
        </DialogHeader>

        {snap.projects.length > 1 && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Chantier actif</span>
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
          <Button variant="outline" className="justify-start" onClick={onNewChantier}>
            <HardHat aria-hidden />
            Nouveau chantier
          </Button>
          {canEdit && (
            <Button variant="outline" className="justify-start" onClick={onEditChantier}>
              <Pencil aria-hidden />
              Modifier le chantier actif
            </Button>
          )}
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
            onClick={onGuided}
          >
            <PlusCircle aria-hidden />
            Parcours guidé (déposer un dossier)
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
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
