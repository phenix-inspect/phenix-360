import { useEffect, useRef, useState } from 'react';
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
  AlertTriangle,
  BookUser,
  Building2,
  Download,
  Eye,
  HardHat,
  Pencil,
  PlusCircle,
  RotateCcw,
  Settings2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { projectId, type ProjectId } from '@phenix360/core';
import { demo, useDemo } from './store';
import { AujourdhuiView } from './surfaces/AujourdhuiView';
import { PointDuSoirView } from './surfaces/PointDuSoirView';
import { CompagnonView, type CompagnonTab } from './surfaces/CompagnonView';
import { ArtisanView } from './surfaces/ArtisanView';
import { ClientView } from './surfaces/ClientView';
import { Annuaire } from './surfaces/Annuaire';
import { PhenixStart } from './start/PhenixStart';
import { Welcome } from './start/Welcome';
import { ChantierForm, type ChantierValues } from './start/ChantierForm';

type ChantierFormState = { mode: 'create' } | { mode: 'edit'; projectId: ProjectId } | null;

type ViewMode = 'aujourdhui' | 'soir' | 'compagnon' | 'artisan' | 'client';

/**
 * RC1 : l'application n'est pas encore partagée aux artisans. On MASQUE toute
 * l'interface artisan (aucune invitation visible) sans rien supprimer — le code
 * `ArtisanView` reste, réactivable en repassant ce drapeau à `true`.
 */
const SHOW_ARTISAN = false;

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'aujourdhui', label: 'Aujourd’hui' },
  { value: 'compagnon', label: 'Chantier' },
  ...(SHOW_ARTISAN ? [{ value: 'artisan' as const, label: 'Artisan' }] : []),
  { value: 'client', label: 'Espace client' },
];

export function App(): React.JSX.Element {
  const snap = useDemo();
  const [view, setView] = useState<ViewMode>('aujourdhui');
  const [creating, setCreating] = useState(false);
  const [annuaire, setAnnuaire] = useState(false);
  const [managing, setManaging] = useState(false);
  // Onglet d'ouverture imposé au chantier (ex. « Récit » depuis un commentaire client).
  const [compaTab, setCompaTab] = useState<CompagnonTab | undefined>(undefined);
  // Aperçu client : PRÉVISUALISATION temporaire. On garde un chantier prévisualisé
  // LOCAL, qui ne touche JAMAIS au chantier actif du conducteur. En quittant
  // l'aperçu, on réinitialise → on revient exactement où l'on était.
  const [clientPreviewId, setClientPreviewId] = useState<ProjectId | null>(null);
  const [chantierForm, setChantierForm] = useState<ChantierFormState>(null);

  useEffect(() => {
    if (view !== 'client') setClientPreviewId(null);
  }, [view]);

  // Tout premier lancement : on propose un choix (démo / à vide) au lieu de
  // forcer la démo. Rien d'autre ne s'affiche tant que le choix n'est pas fait.
  if (!snap.seeded) {
    return <Welcome onDemo={() => demo.loadDemo()} onBlank={() => demo.startBlank()} />;
  }

  const activeProject =
    snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0] ?? null;
  // Le chantier réellement affiché dans l'aperçu client (défaut : le chantier
  // actif). Piloté localement, sans jamais modifier `activeProjectId`.
  const previewProject = snap.projects.find((p) => p.id === clientPreviewId) ?? activeProject;

  // Ancrage de contexte : on sait TOUJOURS sur quel chantier on travaille et
  // quel espace on prévisualise. Rien sur « Aujourd'hui » (vue multi-chantiers).
  const anchor =
    creating || annuaire || activeProject === null
      ? null
      : view === 'compagnon'
        ? { label: 'Chantier', name: activeProject.name, preview: false }
        : view === 'artisan'
          ? { label: 'Aperçu artisan', name: activeProject.name, preview: true }
          : view === 'client'
            ? {
                label: 'Aperçu client',
                name: (previewProject ?? activeProject).name,
                preview: true,
              }
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
          {!creating && !annuaire && (
            <SegmentedControl
              value={view === 'soir' ? 'aujourdhui' : view}
              onValueChange={setView}
              options={VIEW_OPTIONS}
              aria-label="Choisir la vue"
            />
          )}
          <Button
            size="icon"
            variant={annuaire ? 'secondary' : 'ghost'}
            aria-label="Annuaire"
            title="Annuaire"
            aria-pressed={annuaire}
            onClick={() => {
              setCreating(false);
              setAnnuaire((v) => !v);
            }}
          >
            <BookUser aria-hidden />
          </Button>
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
              {snap.projects.length > 1 && (view === 'client' || view === 'compagnon') ? (
                // Le chantier ancré devient un SÉLECTEUR :
                //  • en Chantier → change le chantier ACTIF (on reste en suivi,
                //    l'onglet courant est conservé par CompagnonView) ;
                //  • en Aperçu client → change le chantier PRÉVISUALISÉ (état
                //    local temporaire, sans toucher au chantier actif).
                <select
                  value={
                    (view === 'client' ? (previewProject ?? activeProject) : activeProject)?.id ??
                    ''
                  }
                  onChange={(e) =>
                    view === 'client'
                      ? setClientPreviewId(projectId(e.target.value))
                      : demo.setActiveProject(projectId(e.target.value))
                  }
                  aria-label={
                    view === 'client'
                      ? 'Choisir le chantier à prévisualiser'
                      : 'Changer de chantier'
                  }
                  className="max-w-[60vw] truncate rounded-md border border-border bg-surface px-2 py-0.5 text-sm font-medium text-foreground"
                >
                  {snap.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate font-medium text-foreground">{anchor.name}</span>
              )}
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
        ) : annuaire ? (
          <Annuaire />
        ) : view === 'aujourdhui' ? (
          snap.projects.length === 0 ? (
            <NoProject onNew={() => setChantierForm({ mode: 'create' })} />
          ) : (
            <AujourdhuiView
              snap={snap}
              onOpenChantier={(id, tab, momentId) => {
                demo.setActiveProject(projectId(id));
                setCompaTab(tab);
                // Notification « commentaire client » : on ouvre le Moment
                // concerné dans le Récit (le conducteur = rôle « compagnon »).
                if (momentId) demo.focusMoment(momentId, 'compagnon');
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
          <CompagnonView snap={snap} project={activeProject} initialTab={compaTab} />
        ) : view === 'artisan' ? (
          <ArtisanView snap={snap} project={activeProject} />
        ) : (
          <ClientView snap={snap} project={previewProject ?? activeProject} />
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
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const resetImport = (): void => {
    setPendingImport(null);
    setImportError(null);
  };
  const close = (): void => {
    resetImport();
    onClose();
  };

  const handleExport = (): void => {
    const json = demo.exportWorkspace();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phenix-360-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFilePicked = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const text = await file.text();
    setImportError(null);
    setPendingImport(text); // ouvre l'étape de confirmation (jamais d'import direct)
  };

  const confirmImport = (): void => {
    if (pendingImport === null) return;
    const res = demo.importWorkspace(pendingImport);
    if (!res.ok) {
      setImportError(res.error); // message clair, rien n'a été modifié
      return;
    }
    resetImport();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer</DialogTitle>
          <DialogDescription>Vos chantiers, vos sauvegardes et la démonstration.</DialogDescription>
        </DialogHeader>

        {pendingImport !== null ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-700">
              <AlertTriangle aria-hidden />
              <p>
                Importer cette sauvegarde <strong>remplacera</strong> vos données actuelles. Cette
                action est irréversible.
              </p>
            </div>
            {importError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive bg-surface p-3 text-sm text-destructive [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <AlertTriangle aria-hidden />
                {importError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetImport}>
                Annuler
              </Button>
              <Button onClick={confirmImport}>Remplacer mes données</Button>
            </div>
          </div>
        ) : (
          <>
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
            </div>

            <div className="grid gap-2 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sauvegarde locale
              </p>
              <Button variant="outline" className="justify-start" onClick={handleExport}>
                <Download aria-hidden />
                Exporter mes données
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => fileInput.current?.click()}
              >
                <Upload aria-hidden />
                Importer une sauvegarde
              </Button>
            </div>

            <div className="grid gap-2 border-t border-border pt-3">
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
          </>
        )}

        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            void onFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
