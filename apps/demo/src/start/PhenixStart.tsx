import { useEffect, useRef, useState } from 'react';
import { BrandLockup, Button, Input } from '@phenix360/ui';
import {
  PREPARATION_STAGES,
  buildDossierSummary,
  type DevisExtraction,
  type ProjectProposal,
  type UploadedMedia,
} from '@phenix360/core';
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Palette,
  ScanLine,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { demo } from '../store';
import { recordError } from '../lib/diagnostics';
import { loadPhotos } from '../lib/media';
import { extractPdfGeometry, extractPdfText } from '../lib/pdf';
import { fmtDuree } from '../lib/format';
import { ProposalReview } from './ProposalReview';

type Phase = 'drop' | 'analysis' | 'synthesis' | 'review';
interface Dropped {
  id: string;
  name: string;
  /** Fichier brut conservé (pour lire réellement le texte des PDF). */
  file?: File;
  /** Média prêt (photo) — matérialisé en « Avant travaux » à la création. */
  media?: UploadedMedia;
}

/**
 * Création du chantier — UN SEUL parcours. Le conducteur dépose son dossier :
 *  • si des documents sont là, PHÉNIX les ANALYSE (port unique déterministe) et
 *    construit le chantier, puis affiche une SYNTHÈSE de tout ce qu'il a préparé ;
 *  • sinon, il bascule naturellement en création rapide (nom, client, adresse).
 * Rien n'est créé sans validation finale.
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
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  // Création en cours + message d'erreur VISIBLE : une création qui échoue ne doit
  // JAMAIS rester silencieuse (sinon le bouton semble « ne rien faire »).
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const photos = (): UploadedMedia[] =>
    files.map((f) => f.media).filter((m): m is UploadedMedia => m != null);

  const prepare = async (): Promise<void> => {
    // Lecture RÉELLE : on extrait le texte des PDF déposés (local, sans réseau).
    // Un PDF sans texte exploitable est signalé comme image (imagePdf).
    const analyzed = await Promise.all(
      files.map(async (f) => {
        const isPdf = /\.pdf$/i.test(f.name);
        if (!isPdf || !f.file) return { name: f.name };
        const { text, readable } = await extractPdfText(f.file);
        if (!readable) return { name: f.name, imagePdf: true };
        // On fournit AUSSI la géométrie : le moteur natif s'en sert si le PDF est
        // colonné ; sinon l'analyseur retombe sur le texte, sans surcoût visible.
        const pages = await extractPdfGeometry(f.file);
        return { name: f.name, text, pages };
      }),
    );
    const result = await demo.analyzeDossier({ files: analyzed });
    setProposal(name.trim() ? { ...result, projectName: name.trim() } : result);
    setPhase('analysis');
  };

  // Enveloppe COMMUNE de création : anti double-clic + surface toute erreur au
  // lieu de la laisser filer (une promesse rejetée « avalée » = bouton muet).
  const runCreate = async (fn: () => Promise<unknown>, context: string): Promise<void> => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      await fn();
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'La création a échoué. Réessayez.');
      recordError('error', `${context}: ${msg}`);
      setCreating(false);
    }
  };

  const quickCreate = (): Promise<void> =>
    runCreate(
      () =>
        demo.createChantier({
          name: name.trim(),
          clientName: clientName.trim() || undefined,
          address: address.trim() || undefined,
          startStep: 'gros_oeuvre',
        }),
      'createChantier',
    );

  const enter = (p: ProjectProposal): Promise<void> =>
    runCreate(() => {
      // On ARCHIVE le fichier original du devis (source officielle, ouvrable).
      const devisFile = files.find((f) => /\.pdf$/i.test(f.name) && f.file)?.file;
      return demo.createFromProposal(p, photos(), devisFile);
    }, 'createFromProposal');

  // Alternative temporaire (PDF non extractible) : analyser un texte collé à la
  // main. Passe par le MÊME port d'analyse — rien d'inventé, on lit ce texte.
  const analyzePastedText = async (pasted: string): Promise<void> => {
    const result = await demo.analyzeDossier({
      files: [{ name: 'devis-collé.txt', text: pasted }],
    });
    setProposal(name.trim() ? { ...result, projectName: name.trim() } : result);
  };

  let screen: React.JSX.Element;
  if (phase === 'analysis' && proposal) {
    screen = <AnalysisScene proposal={proposal} onDone={() => setPhase('synthesis')} />;
  } else if (phase === 'synthesis' && proposal) {
    screen = (
      <SynthesisScreen
        proposal={proposal}
        photosCount={photos().length}
        onEnter={() => void enter(proposal)}
        onAdjust={() => setPhase('review')}
        onAnalyzeText={(t) => void analyzePastedText(t)}
      />
    );
  } else if (phase === 'review' && proposal) {
    screen = (
      <ProposalReview
        proposal={proposal}
        onValidate={(p) => void enter(p)}
        onCancel={() => setPhase('synthesis')}
      />
    );
  } else {
    screen = (
      <NewChantierScreen
        files={files}
        setFiles={setFiles}
        name={name}
        setName={setName}
        clientName={clientName}
        setClientName={setClientName}
        address={address}
        setAddress={setAddress}
        onPrepare={() => void prepare()}
        onQuickCreate={() => void quickCreate()}
        onCancel={onCancel}
      />
    );
  }

  return (
    <>
      {screen}
      {(creating || error) && (
        <div className="fixed inset-x-0 bottom-5 z-modal flex justify-center px-4">
          <div
            role={error ? 'alert' : 'status'}
            className="max-w-lg rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg"
            style={{ color: error ? '#c2410c' : undefined }}
          >
            {error ? (
              <>
                <strong>La création n’a pas abouti.</strong> {error}
              </>
            ) : (
              'Création du chantier en cours…'
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- *
 * 1. Nouveau chantier — un seul écran : déposer OU renseigner
 * -------------------------------------------------------------------------- */
function NewChantierScreen({
  files,
  setFiles,
  name,
  setName,
  clientName,
  setClientName,
  address,
  setAddress,
  onPrepare,
  onQuickCreate,
  onCancel,
}: {
  files: Dropped[];
  setFiles: React.Dispatch<React.SetStateAction<Dropped[]>>;
  name: string;
  setName: (v: string) => void;
  clientName: string;
  setClientName: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  onPrepare: () => void;
  onQuickCreate: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null): void => {
    if (!list) return;
    for (const file of Array.from(list)) {
      const id = crypto.randomUUID();
      setFiles((prev) => [...prev, { id, name: file.name, file }]);
      if (file.type.startsWith('image/')) {
        // Aperçu best-effort via `loadPhotos` (ne jette JAMAIS) : une image illisible
        // (HEIC…) laisse le fichier en place SANS aperçu, jamais de rejection non gérée.
        void loadPhotos([file]).then(({ media }) => {
          const m = media[0];
          if (m) setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, media: m } : f)));
        });
      }
    }
  };

  const hasFiles = files.length > 0;
  const canQuick = name.trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Nouveau chantier
        </h1>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Déposez votre dossier (devis, plans, photos…) : PHÉNIX prépare le chantier pour vous. Sans
          document, renseignez simplement le nom pour créer un chantier vide.
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
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-base ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          Devis, acompte, plans, DPE, diagnostics, photos, CCTP, descriptif architecte… Vous pourrez
          en ajouter à tout moment.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </button>

      {hasFiles && (
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

      {/* Renseignements — utiles à la création rapide, ou pour nommer le chantier
          préparé. Toujours accessibles : le parcours reste unique. */}
      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Nom du chantier</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Rénovation appartement Lyon 6e"
            aria-label="Nom du chantier"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Client</span>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex. Mme Martin"
              aria-label="Nom du client"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Adresse</span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex. 12 rue de la République, Lyon"
              aria-label="Adresse du chantier"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          {hasFiles ? (
            <Button onClick={onPrepare}>
              <Sparkles aria-hidden /> Préparer mon chantier
            </Button>
          ) : (
            <Button onClick={onQuickCreate} disabled={!canQuick}>
              Créer le chantier <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {hasFiles
            ? 'Documents détectés — PHÉNIX peut préparer le chantier.'
            : 'Aucun document : renseignez au moins le nom pour créer un chantier vide.'}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * 2. PHÉNIX prépare — la scène, ENRICHIE : chaque étape révèle ce qui a été
 *    réellement trouvé dans le dossier (pas un simple minuteur).
 * -------------------------------------------------------------------------- */
function stageDetail(i: number, p: ProjectProposal): string | null {
  const d = p.dossier;
  const classes = d.documents.filter((x) => x.status === 'fourni').length;
  switch (i) {
    case 0:
      return `${d.documents.length} documents`;
    case 1:
      return d.infos.clientName ?? null;
    case 2:
      return d.infos.address ?? null;
    case 3:
      return (
        [d.infos.propertyType, d.infos.surface ? `${d.infos.surface} m²` : null]
          .filter(Boolean)
          .join(' · ') || null
      );
    case 4:
      return `${d.roadmap.length} étapes`;
    case 5:
      return `${d.orders.length} commandes`;
    case 6:
      return `${d.selections.length} choix client`;
    case 7:
      return d.infos.duration ?? null;
    case 8:
      return `${classes} classés`;
    default:
      return null;
  }
}

function AnalysisScene({
  proposal,
  onDone,
}: {
  proposal: ProjectProposal;
  onDone: () => void;
}): React.JSX.Element {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= PREPARATION_STAGES.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((n) => n + 1), 420);
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
          const detail = isDone ? stageDetail(i, proposal) : null;
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
                className={`flex-1 text-sm ${isDone || isActive ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {stage.label}
              </span>
              {detail && (
                <span className="shrink-0 text-xs font-medium text-gold-700">{detail}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * 3. SYNTHÈSE — « voici tout ce que j'ai préparé » avant d'entrer.
 * -------------------------------------------------------------------------- */
function SynthesisScreen({
  proposal,
  photosCount,
  onEnter,
  onAdjust,
  onAnalyzeText,
}: {
  proposal: ProjectProposal;
  photosCount: number;
  onEnter: () => void;
  onAdjust: () => void;
  onAnalyzeText: (text: string) => void;
}): React.JSX.Element {
  const d = proposal.dossier;
  const s = buildDossierSummary(d);
  const infos = d.infos;
  const fournisseurs = [...new Set(d.orders.map((o) => o.fournisseur).filter(Boolean))] as string[];
  const docsClasses = d.documents.filter((x) => x.status === 'fourni').length;
  const docsAFournir = d.documents.filter(
    (x) => x.status === 'a_fournir' || x.status === 'manquant',
  ).length;
  const contact = [infos.phone, infos.email].filter(Boolean).join(' · ');
  const bien = [infos.propertyType, infos.surface ? `${infos.surface} m²` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-8">
          <Sparkles aria-hidden />
        </span>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
          {proposal.projectName}
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Voici tout ce que j'ai préparé à partir de votre dossier. Vous pouvez entrer dans le
          chantier — ou l'ajuster avant.
        </p>
      </header>

      {proposal.extraction && (
        <DevisReadingCard extraction={proposal.extraction} onAnalyzeText={onAnalyzeText} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SynthCard icon={<User aria-hidden />} title="Le client">
          <SynthLine strong={infos.clientName ?? 'À préciser'} />
          {contact && <SynthLine muted={contact} />}
        </SynthCard>

        <SynthCard icon={<MapPin aria-hidden />} title="Le bien">
          {infos.address && <SynthLine strong={infos.address} />}
          {bien && <SynthLine muted={bien} />}
          {infos.budget != null && (
            <SynthLine muted={`Budget ${infos.budget.toLocaleString('fr-FR')} €`} />
          )}
        </SynthCard>

        {s.steps > 0 && (
          <SynthCard icon={<CalendarRange aria-hidden />} title="Le planning">
            <SynthLine strong={`${s.steps} étapes`} />
            <SynthLine
              muted={`Annoncée ${s.announcedLabel ?? 'à préciser'} · estimée ${fmtDuree(s.estimatedDays)}`}
              warn={s.durationRisk}
            />
          </SynthCard>
        )}

        {d.orders.length > 0 && (
          <SynthCard icon={<Package aria-hidden />} title="Les commandes">
            <SynthLine strong={`${d.orders.length} commandes`} />
            <SynthLine
              muted={`${s.criticalOrders} au délai critique`}
              warn={s.criticalOrders > 0}
            />
            {fournisseurs.length > 0 && <SynthLine muted={fournisseurs.slice(0, 3).join(', ')} />}
          </SynthCard>
        )}

        {s.clientDecisions > 0 && (
          <SynthCard icon={<Palette aria-hidden />} title="Les décisions client">
            <SynthLine strong={`${s.clientDecisions} à obtenir`} />
          </SynthCard>
        )}

        <SynthCard icon={<FileText aria-hidden />} title="Les documents">
          <SynthLine strong={`${docsClasses} classés`} />
          {docsAFournir > 0 && <SynthLine muted={`${docsAFournir} à fournir`} />}
        </SynthCard>

        {photosCount > 0 && (
          <SynthCard icon={<ImageIcon aria-hidden />} title="Photos avant travaux">
            <SynthLine
              strong={`${photosCount} ajoutée${photosCount > 1 ? 's' : ''} aux coulisses`}
            />
          </SynthCard>
        )}

        {s.mainRisk && (
          <SynthCard icon={<TriangleAlert aria-hidden />} title="À surveiller" warn>
            <SynthLine muted={s.mainRisk} warn />
          </SynthCard>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button size="lg" onClick={onEnter}>
          <CheckCircle2 aria-hidden /> Entrer dans le chantier
        </Button>
        <Button size="lg" variant="outline" onClick={onAdjust}>
          Ajuster le dossier
        </Button>
      </div>
    </div>
  );
}

/**
 * Le compte rendu de LECTURE RÉELLE du devis : ce que PHÉNIX a lu, ce qu'il n'a
 * pas trouvé, sa confiance. Jamais inventé. Si le PDF est une image, il le dit.
 */
function DevisReadingCard({
  extraction,
  onAnalyzeText,
}: {
  extraction: DevisExtraction;
  /** Alternative temporaire : analyser du texte collé à la main. */
  onAnalyzeText?: (text: string) => void;
}): React.JSX.Element {
  if (extraction.imageOnly)
    return (
      <div className="space-y-3 rounded-2xl border border-gold-300 bg-gold-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-gold-700 [&_svg]:size-5">
            <ScanLine aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Le fichier est lisible à l'écran mais son texte n'est pas extractible automatiquement
              pour l'instant.
            </p>
            <p className="text-sm text-muted-foreground">
              Ce PDF est probablement scanné (image) ou protégé. La lecture par OCR arrivera — en
              attendant, collez le texte du devis ci-dessous, ou renseignez les informations à la
              main.
            </p>
          </div>
        </div>
        {onAnalyzeText && <PasteDevisText onAnalyzeText={onAnalyzeText} />}
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <FileSearch aria-hidden />
          Lecture réelle du devis
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-800">
          {extraction.confidence}% des repères lus
        </span>
      </div>

      {extraction.detected.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {extraction.detected.map((f) => (
            <div key={f.key} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="flex items-start gap-1.5 text-sm text-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-success">
                <CheckCircle2 aria-hidden />
                <span>{f.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {extraction.missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Non détecté :</span> {extraction.missing.join(' · ')}.
          Complétez à la main si besoin — je n'invente rien.
        </p>
      )}
    </div>
  );
}

/** Coller le texte d'un devis à la main (alternative en attendant l'OCR). */
function PasteDevisText({
  onAnalyzeText,
}: {
  onAnalyzeText: (text: string) => void;
}): React.JSX.Element {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2 border-t border-gold-200 pt-3">
      <label className="text-xs font-medium text-foreground" htmlFor="paste-devis">
        Coller le texte du devis
      </label>
      <textarea
        id="paste-devis"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Sélectionnez le texte de votre devis (Ctrl/Cmd+A puis Ctrl/Cmd+C) et collez-le ici…"
        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={text.trim().length < 20} onClick={() => onAnalyzeText(text)}>
          <FileSearch aria-hidden /> Analyser ce texte
        </Button>
      </div>
    </div>
  );
}

function SynthCard({
  icon,
  title,
  warn,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  warn?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={`space-y-2 rounded-2xl border p-4 ${warn ? 'border-gold-300 bg-gold-50' : 'border-border bg-surface'}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SynthLine({
  strong,
  muted,
  warn,
}: {
  strong?: string;
  muted?: string;
  warn?: boolean;
}): React.JSX.Element {
  return (
    <p
      className={`flex items-center gap-1.5 text-sm [&_svg]:size-3.5 ${
        strong ? 'font-medium text-foreground' : warn ? 'text-gold-700' : 'text-muted-foreground'
      }`}
    >
      {warn && !strong && <TriangleAlert aria-hidden />}
      {strong ?? muted}
    </p>
  );
}
