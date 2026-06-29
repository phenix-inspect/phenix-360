import { useEffect, useRef, useState } from 'react';
import { BrandLockup, Button } from '@phenix360/ui';
import {
  PREPARATION_STAGES,
  buildDossierSummary,
  mockAnalyzeDossier,
  type ProjectProposal,
} from '@phenix360/core';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import { demo } from '../store';
import { fmtDuree } from '../lib/format';
import { ProposalReview } from './ProposalReview';

type Phase = 'drop' | 'analysis' | 'ready' | 'review';
interface Dropped {
  id: string;
  name: string;
}

/**
 * Création du projet. Le conducteur ne remplit pas un logiciel : il dépose le
 * devis signé, PHÉNIX prend de l'avance, puis il DÉCOUVRE un projet déjà
 * préparé qu'il n'a plus qu'à ajuster. Rien n'est créé sans validation finale.
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

  const onAnalysisDone = async () => {
    const result = await mockAnalyzeDossier({ files: files.map((f) => ({ name: f.name })) });
    setProposal(result);
    setPhase('ready');
  };

  const validate = async (edited: ProjectProposal) => {
    await demo.createFromProposal(edited);
    onCreated();
  };

  if (phase === 'analysis') return <AnalysisScreen onDone={() => void onAnalysisDone()} />;
  if (phase === 'ready' && proposal)
    return (
      <ReadyScreen
        proposal={proposal}
        onContinue={(duration) => {
          setProposal({
            ...proposal,
            dossier: {
              ...proposal.dossier,
              infos: { ...proposal.dossier.infos, duration },
            },
          });
          setPhase('review');
        }}
      />
    );
  if (phase === 'review' && proposal)
    return (
      <ProposalReview
        proposal={proposal}
        onValidate={(p) => void validate(p)}
        onCancel={() => setPhase('ready')}
      />
    );

  return (
    <DropScreen
      files={files}
      setFiles={setFiles}
      onStart={() => setPhase('analysis')}
      onCancel={onCancel}
    />
  );
}

/* -------------------------------------------------------------------------- *
 * 1. Le dossier arrive — le devis signé est la base, obligatoire
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
          Nouveau chantier
        </h1>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Pour commencer, déposez le devis signé — c'est la base de votre chantier. Je m'occupe du
          reste.
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
          Déposez le devis signé
        </span>
        <span className="max-w-md text-sm text-muted-foreground">
          Ajoutez aussi, si vous les avez, plans, DPE, diagnostics, photos, CCTP, descriptif
          architecte… Vous pourrez en ajouter à tout moment.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </button>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const isDevis = f.name.toLowerCase().includes('devis');
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                {isDevis && (
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gold-700">
                    Devis signé
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Retirer"
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                >
                  <X aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onStart} disabled={!hasDevis}>
            <Sparkles aria-hidden /> PHÉNIX prépare le chantier
          </Button>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {hasDevis
            ? 'Devis signé détecté — je peux préparer le chantier.'
            : 'Le devis signé est obligatoire pour démarrer un chantier.'}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * 2. PHÉNIX prépare (progression sereine)
 * -------------------------------------------------------------------------- */
function AnalysisScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= PREPARATION_STAGES.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((n) => n + 1), 460);
    return () => clearTimeout(t);
  }, [done, onDone]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup size="lg" />
        <p className="text-sm text-muted-foreground">Je prépare votre chantier…</p>
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
                className={`text-sm ${isDone || isActive ? 'text-foreground' : 'text-muted-foreground'}`}
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

/* -------------------------------------------------------------------------- *
 * 3. « Votre projet est prêt. » — résumé express + cadrage de la durée
 * -------------------------------------------------------------------------- *
 * PHÉNIX travaille avant le conducteur : il a CHERCHÉ la durée dans le devis
 * avant de la demander. Et il affiche d'abord un résumé express (durée annoncée
 * ⇆ durée réaliste, étapes, commandes critiques, décisions, risque principal)
 * pour qu'en quelques secondes le conducteur sente si le chantier est tendu.
 */
const DURATION_PRESETS = ['6 semaines', '2 mois', '3 mois', '45 jours ouvrés'];

function ReadyScreen({
  proposal,
  onContinue,
}: {
  proposal: ProjectProposal;
  onContinue: (duration: string) => void;
}): React.JSX.Element {
  const d = proposal.dossier;
  const detected = d.infos.duration ?? null;
  const [duration, setDuration] = useState(detected ?? '');
  const [editing, setEditing] = useState(!detected);

  const summary = buildDossierSummary({
    ...d,
    infos: { ...d.infos, duration: duration.trim() || undefined },
  });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-8">
          <Sparkles aria-hidden />
        </span>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
          Votre projet est prêt.
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          J'ai préparé votre chantier à partir du devis signé. Voici l'essentiel — nous le
          parcourrons ensuite ensemble.
        </p>
      </div>

      {/* (4) Le résumé express, juste après l'analyse — avant même le planning. */}
      <div className="w-full space-y-3 rounded-2xl border border-border bg-surface p-5 text-left">
        <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
          J'ai étudié votre dossier.
        </p>
        <ul className="space-y-2 text-sm">
          <SummaryRow
            label="Durée annoncée au client"
            value={summary.announcedLabel ?? 'à préciser'}
          />
          <SummaryRow
            label="Durée que j'estime réaliste"
            value={fmtDuree(summary.estimatedDays)}
            warn={summary.durationMismatch}
          />
          <SummaryRow label="Étapes identifiées" value={String(summary.steps)} />
          <SummaryRow label="Commandes critiques" value={String(summary.criticalOrders)} />
          <SummaryRow label="Décisions client à obtenir" value={String(summary.clientDecisions)} />
          <SummaryRow
            label="Principal risque"
            value={summary.mainRisk ?? 'aucun risque majeur détecté'}
          />
        </ul>
      </div>

      {/* (1) PHÉNIX a cherché la durée avant de la demander. */}
      <div className="w-full space-y-3 rounded-2xl border border-border bg-surface p-5 text-left">
        {detected && !editing ? (
          <>
            <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
              J'ai trouvé dans votre devis une durée prévisionnelle de{' '}
              <span className="text-gold-700">{detected}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Est-ce bien la durée que vous avez annoncée au client ?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onContinue(duration.trim())}>
                <CheckCircle2 aria-hidden /> Oui, c'est exact
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Modifier
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
              {detected
                ? 'Quelle durée souhaitez-vous retenir ?'
                : "Je n'ai pas trouvé de durée prévisionnelle dans votre devis."}
            </p>
            <p className="text-sm text-muted-foreground">
              {detected
                ? 'Ajustez la durée annoncée au client.'
                : 'Quelle durée avez-vous annoncée au client ?'}
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDuration(preset)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    duration === preset
                      ? 'border-gold-400 bg-gold-100 font-medium text-gold-800'
                      : 'border-border bg-paper-50 text-foreground hover:border-gold-300'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ou saisissez librement (ex. 10 semaines)"
              className="h-10 w-full rounded-lg border border-input bg-paper-50 px-3 text-sm text-foreground"
            />
            <Button
              size="lg"
              disabled={!duration.trim()}
              onClick={() => onContinue(duration.trim())}
            >
              Découvrons votre projet <ArrowRight aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}): React.JSX.Element {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`flex items-center gap-1.5 text-right font-medium [&_svg]:size-4 ${
          warn ? 'text-gold-700' : 'text-foreground'
        }`}
      >
        {warn && <TriangleAlert aria-hidden />}
        {value}
      </span>
    </li>
  );
}
