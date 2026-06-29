import { useEffect, useRef, useState } from 'react';
import { BrandLockup, Button } from '@phenix360/ui';
import { PREPARATION_STAGES, mockAnalyzeDossier, type ProjectProposal } from '@phenix360/core';
import { CheckCircle2, FileText, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import { demo } from '../store';
import { ProposalReview } from './ProposalReview';

type Phase = 'drop' | 'analysis' | 'proposal';
interface Dropped {
  id: string;
  name: string;
}

/**
 * PHÉNIX Start — on ne crée plus un projet en remplissant un formulaire, on
 * dépose un dossier et PHÉNIX prépare le chantier. Dépôt → analyse scénarisée →
 * proposition éditable → validation humaine (création réelle du projet).
 */
export function PhenixStart({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('drop');
  const [files, setFiles] = useState<Dropped[]>([]);
  const [proposal, setProposal] = useState<ProjectProposal | null>(null);

  const startAnalysis = () => setPhase('analysis');

  const onAnalysisDone = async () => {
    const result = await mockAnalyzeDossier({ files: files.map((f) => ({ name: f.name })) });
    setProposal(result);
    setPhase('proposal');
  };

  const validate = async (edited: ProjectProposal) => {
    await demo.createFromProposal(edited);
    onCreated();
  };

  if (phase === 'analysis') return <AnalysisScreen onDone={() => void onAnalysisDone()} />;
  if (phase === 'proposal' && proposal)
    return (
      <ProposalReview
        proposal={proposal}
        onValidate={(p) => void validate(p)}
        onCancel={onCancel}
      />
    );

  return (
    <DropScreen files={files} setFiles={setFiles} onStart={startAnalysis} onCancel={onCancel} />
  );
}

/* -------------------------------------------------------------------------- *
 * 1. Dépôt du dossier
 * -------------------------------------------------------------------------- */
function DropScreen({
  files,
  setFiles,
  onStart,
  onCancel,
}: {
  files: Dropped[];
  setFiles: React.Dispatch<React.SetStateAction<Dropped[]>>;
  onStart: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).map((f) => ({ id: crypto.randomUUID(), name: f.name }));
    setFiles((prev) => [...prev, ...next]);
  };

  const hasDevis = files.some((f) => f.name.toLowerCase().includes('devis'));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Nouveau projet
        </h1>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Déposez votre dossier. PHÉNIX l’analyse et prépare automatiquement le chantier — vous
          n’aurez plus qu’à vérifier et valider.
        </p>
      </header>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-base ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          over ? 'border-primary bg-gold-50' : 'border-border bg-surface hover:border-gold-300'
        }`}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-7">
          <UploadCloud aria-hidden />
        </span>
        <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
          Déposez votre dossier
        </span>
        <span className="max-w-md text-sm text-muted-foreground">
          Devis accepté, plans, DPE, photos avant travaux, diagnostics, mails du client, CCTP,
          descriptif architecte… Glissez-déposez plusieurs fichiers.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Le devis n’est pas obligatoire, mais <strong>fortement recommandé</strong> pour une
        préparation complète.
      </p>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
              <button
                type="button"
                aria-label="Retirer"
                className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
              >
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={onStart}>
          <Sparkles aria-hidden />
          {files.length === 0 ? 'Préparer sans document' : 'Lancer l’analyse PHÉNIX'}
        </Button>
      </div>
      {!hasDevis && files.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Aucun devis détecté — PHÉNIX préparera une base que vous pourrez compléter.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * 2. Analyse scénarisée
 * -------------------------------------------------------------------------- */
function AnalysisScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= PREPARATION_STAGES.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((n) => n + 1), 480);
    return () => clearTimeout(t);
  }, [done, onDone]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup size="lg" />
        <p className="text-sm text-muted-foreground">PHÉNIX prépare votre chantier…</p>
      </div>

      <ol className="w-full space-y-1">
        {PREPARATION_STAGES.map((stage, i) => {
          const isDone = i < done;
          const isActive = i === done;
          return (
            <li
              key={stage.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-base ${
                isActive ? 'bg-gold-50' : ''
              }`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center [&_svg]:size-4">
                {isDone ? (
                  <CheckCircle2 aria-hidden className="text-success" />
                ) : isActive ? (
                  <Loader2 aria-hidden className="animate-spin text-gold-600" />
                ) : (
                  <span className="text-base opacity-50">{stage.icon}</span>
                )}
              </span>
              <span
                className={`text-sm ${
                  isDone || isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
