import { useEffect, useRef, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  MISSION_LABEL,
  buildCorps,
  prepareMission,
  type ActionPriorite,
  type CrAction,
  type CrDecision,
  type CrQuestion,
  type EventActor,
  type MissionKind,
  type MissionPreparation,
  type MissionReserveDraft,
  type Project,
  type QuestionEtat,
  type UploadedMedia,
} from '@phenix360/core';
import { Camera, Check, Loader2, Mic, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { demo } from '../../store';
import { mediaUploader } from '../../lib/media';

type Step = 'capture' | 'comprend' | 'partager';

interface Pick {
  key: string;
  media: UploadedMedia;
}

const AUDIENCES: { id: string; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'artisan', label: 'Artisan' },
  { id: 'architecte', label: 'Architecte' },
  { id: 'bc', label: 'Bureau de contrôle' },
  { id: 'investisseur', label: 'Investisseur' },
  { id: 'moe', label: 'Maître d’œuvre' },
];

/**
 * La mission, vécue comme une CAMÉRA QUI ÉCOUTE (VISION.md Art. 5, 11). Plein
 * écran, très peu de boutons : le conducteur photographie et parle — il ne
 * rédige rien. PHÉNIX comprend, il valide, il partage. Le document est une
 * conséquence (Art. 8), jamais un objectif.
 */
export function MissionFlow({
  kind,
  project,
  actor,
  onClose,
}: {
  kind: MissionKind;
  project: Project;
  actor: EventActor;
  onClose: () => void;
}): React.JSX.Element {
  const [step, setStep] = useState<Step>('capture');
  const [busy, setBusy] = useState(false);

  // Capture : photos + phrases dictées/écrites.
  const [picks, setPicks] = useState<Pick[]>([]);
  const [phrasesList, setPhrasesList] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  // Préparation (éditable) + partage.
  const [prep, setPrep] = useState<MissionPreparation | null>(null);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [shared, setShared] = useState<string[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (step === 'comprend') setStep('capture');
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => mediaUploader(f)));
      setPicks((p) => [...p, ...uploaded.map((media) => ({ key: crypto.randomUUID(), media }))]);
    } finally {
      setBusy(false);
    }
  };

  const addPhrase = (): void => {
    const v = draft.trim();
    if (!v) return;
    setPhrasesList((l) => [...l, v]);
    setDraft('');
  };

  const runPhenix = (): void => {
    const recit = phrasesList.join('. ');
    setPrep(prepareMission({ kind, recit, presents: [], photoIds: [] }));
    setStep('comprend');
  };

  const validate = async (): Promise<void> => {
    if (!prep || busy) return;
    setBusy(true);
    try {
      const corps = buildCorps({ ...prep });
      await demo.createMission(project.id, actor, {
        kind,
        medias: picks.map((p) => p.media),
        recit: phrasesList.join('. '),
        presents: prep.presents,
        prepared: { ...prep, corps },
      });
      setStep('partager');
    } finally {
      setBusy(false);
    }
  };

  const share = async (): Promise<void> => {
    if (!prep || audiences.length === 0 || busy) return;
    setBusy(true);
    try {
      const snap = demo.getSnapshot();
      const missionEvent = snap.events
        .filter(
          (e) =>
            e.projectId === project.id && e.type === 'compte_rendu' && e.visibility === 'interne',
        )
        .at(-1);
      const momentId = (snap.fil.moments[project.id] ?? []).at(-1)?.id ?? '';
      if (missionEvent) {
        await demo.shareMission(project.id, actor, {
          missionEventId: missionEvent.id,
          momentId,
          audiences,
          texteClient: prep.texteClient,
          docTitre: prep.docTitre,
        });
        setShared(audiences);
      }
    } finally {
      setBusy(false);
    }
  };

  const canFinish = picks.length > 0 || phrasesList.length > 0 || draft.trim().length > 0;

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background">
      {/* Barre minimale */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-5"
        >
          <X aria-hidden />
        </button>
        <p className="font-serif text-lg font-semibold text-foreground">{MISSION_LABEL[kind]}</p>
        <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
          {step === 'capture'
            ? 'En cours'
            : step === 'comprend'
              ? 'PHÉNIX a compris'
              : 'Enregistré'}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {step === 'capture' && (
          <CaptureStep
            picks={picks}
            busy={busy}
            phrasesList={phrasesList}
            draft={draft}
            onPick={onPick}
            onRemovePick={(key) => setPicks((p) => p.filter((x) => x.key !== key))}
            onDraft={setDraft}
            onAddPhrase={addPhrase}
            onRemovePhrase={(i) => setPhrasesList((l) => l.filter((_, j) => j !== i))}
          />
        )}

        {step === 'comprend' && prep && <ComprendStep prep={prep} onChange={setPrep} />}

        {step === 'partager' && prep && (
          <PartagerStep
            prep={prep}
            project={project}
            audiences={audiences}
            shared={shared}
            onToggle={(id) =>
              setAudiences((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
            }
          />
        )}
      </div>

      {/* Pied : une seule action forte */}
      <footer className="border-t border-border px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          {step === 'capture' && (
            <>
              <span className="text-xs text-muted-foreground">
                {picks.length > 0 || phrasesList.length > 0
                  ? `${picks.length} photo${picks.length > 1 ? 's' : ''} · ${phrasesList.length} note${phrasesList.length > 1 ? 's' : ''}`
                  : 'Photographiez et parlez'}
              </span>
              <Button size="lg" onClick={runPhenix} disabled={!canFinish}>
                <Sparkles aria-hidden /> J’ai terminé
              </Button>
            </>
          )}
          {step === 'comprend' && (
            <>
              <Button variant="ghost" onClick={() => setStep('capture')}>
                Reprendre
              </Button>
              <Button size="lg" onClick={() => void validate()} disabled={busy}>
                <Check aria-hidden /> Valider
              </Button>
            </>
          )}
          {step === 'partager' && (
            <>
              {!shared ? (
                <>
                  <Button variant="ghost" onClick={onClose}>
                    Terminer
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => void share()}
                    disabled={audiences.length === 0 || busy}
                  >
                    <Send aria-hidden /> Partager
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Partagé (aperçu).</span>
                  <Button size="lg" onClick={onClose}>
                    Terminer
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

/* --------------------------- Étape 1 : capture ---------------------------- */

function CaptureStep({
  picks,
  busy,
  phrasesList,
  draft,
  onPick,
  onRemovePick,
  onDraft,
  onAddPhrase,
  onRemovePhrase,
}: {
  picks: Pick[];
  busy: boolean;
  phrasesList: string[];
  draft: string;
  onPick: (files: FileList | null) => void;
  onRemovePick: (key: string) => void;
  onDraft: (v: string) => void;
  onAddPhrase: () => void;
  onRemovePhrase: (i: number) => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl space-y-8 px-5 py-8">
      <p className="text-center text-sm text-muted-foreground">
        Vivez votre chantier. Montrez, parlez — PHÉNIX écoute.
      </p>

      {/* Photos */}
      <div className="grid grid-cols-3 gap-2">
        {picks.map((p) => (
          <div
            key={p.key}
            className="relative aspect-square overflow-hidden rounded-xl border border-border"
          >
            <img src={p.media.imageUrl} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onRemovePick(p.key)}
              aria-label="Retirer la photo"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3.5"
            >
              <X aria-hidden />
            </button>
          </div>
        ))}
        <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-paper-50 text-muted-foreground transition-colors hover:border-gold-300 hover:text-foreground">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => onPick(e.target.files)}
          />
          {busy ? (
            <Loader2 aria-hidden className="size-6 animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs [&_svg]:size-6">
              <Camera aria-hidden />
              Photo
            </span>
          )}
        </label>
      </div>

      {/* Ce que vous dites */}
      <div className="space-y-3">
        {phrasesList.length > 0 && (
          <ul className="space-y-1.5">
            {phrasesList.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden />
                <span className="flex-1">{p}</span>
                <button
                  type="button"
                  onClick={() => onRemovePhrase(i)}
                  aria-label="Retirer"
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onAddPhrase();
              }
            }}
            rows={1}
            placeholder="Dites ce qu’il s’est passé…"
            className="max-h-32 min-h-[3rem] flex-1 resize-none rounded-2xl border border-input bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <MicButton onText={onDraft} />
          <Button size="icon" aria-label="Ajouter" onClick={onAddPhrase} disabled={!draft.trim()}>
            <Plus aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Voix (Web Speech API) -------------------------- */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSpeech(): SRCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Bouton micro : dicte dans le champ. Absent si le navigateur ne sait pas. */
function MicButton({ onText }: { onText: (t: string) => void }): React.JSX.Element | null {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const SR = getSpeech();
  if (!SR) return null;

  const toggle = (): void => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e): void => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i]![0]!.transcript;
      onText(t);
    };
    rec.onend = (): void => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'PHÉNIX écoute' : 'Dicter'}
      className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors [&_svg]:size-5 ${
        listening
          ? 'animate-pulse border-gold-400 bg-gold-100 text-gold-700'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
      }`}
    >
      <Mic aria-hidden />
    </button>
  );
}

/* -------------------------- Étape 2 : PHÉNIX comprend --------------------- */

function ComprendStep({
  prep,
  onChange,
}: {
  prep: MissionPreparation;
  onChange: (p: MissionPreparation) => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Voici ce que j’ai compris
        </h2>
        <p className="text-sm text-muted-foreground">
          Relisez, corrigez, complétez. Rien n’est enregistré tant que vous n’avez pas validé.
        </p>
      </div>

      <EditList
        label="Présents"
        items={prep.presents}
        onChange={(items) => onChange({ ...prep, presents: items })}
      />

      <CardSection<CrDecision>
        label="Décisions"
        items={prep.decisions}
        blank={() => ({ libelle: '', bloque: false })}
        onChange={(decisions) => onChange({ ...prep, decisions })}
        render={(d, set) => (
          <>
            <LibelleInput
              value={d.libelle}
              placeholder="La décision prise…"
              onChange={(libelle) => set({ ...d, libelle })}
            />
            <div className="flex flex-wrap gap-2">
              <MetaInput
                placeholder="Qui décide ?"
                value={d.quiDecide}
                onChange={(v) => set({ ...d, quiDecide: v })}
              />
              <MetaInput
                placeholder="Impact"
                value={d.impact}
                onChange={(v) => set({ ...d, impact: v })}
              />
            </div>
            <Toggle
              label="Bloque le chantier"
              checked={Boolean(d.bloque)}
              onChange={(bloque) => set({ ...d, bloque })}
            />
          </>
        )}
      />

      <CardSection<CrAction>
        label="Actions à suivre"
        items={prep.actions}
        blank={() => ({ label: '', priorite: 'normale' })}
        onChange={(actions) => onChange({ ...prep, actions })}
        render={(a, set) => (
          <>
            <LibelleInput
              value={a.label}
              placeholder="L'action à suivre…"
              onChange={(label) => set({ ...a, label })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <MetaInput
                placeholder="Responsable"
                value={a.responsable}
                onChange={(v) => set({ ...a, responsable: v })}
              />
              <DateInput value={a.echeance} onChange={(v) => set({ ...a, echeance: v })} />
              <PrioritePicker
                value={a.priorite ?? 'normale'}
                onChange={(p) => set({ ...a, priorite: p })}
              />
            </div>
            <MetaInput
              full
              placeholder="Commentaire (optionnel)"
              value={a.commentaire}
              onChange={(v) => set({ ...a, commentaire: v })}
            />
          </>
        )}
      />

      <CardSection<MissionReserveDraft>
        label="Réserves / points à reprendre"
        items={prep.reserves}
        blank={() => ({ libelle: '' })}
        onChange={(reserves) => onChange({ ...prep, reserves })}
        render={(r, set) => (
          <>
            <LibelleInput
              value={r.libelle}
              placeholder="Le point à reprendre…"
              onChange={(libelle) => set({ ...r, libelle })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <MetaInput
                placeholder="Responsable"
                value={r.responsable}
                onChange={(v) => set({ ...r, responsable: v })}
              />
              <DateInput value={r.echeance} onChange={(v) => set({ ...r, echeance: v })} />
            </div>
          </>
        )}
      />

      <CardSection<CrQuestion>
        label="Questions client"
        items={prep.questionsClient}
        blank={() => ({ libelle: '', etat: 'ouverte' })}
        onChange={(questionsClient) => onChange({ ...prep, questionsClient })}
        render={(q, set) => (
          <>
            <LibelleInput
              value={q.libelle}
              placeholder="La question du client…"
              onChange={(libelle) => set({ ...q, libelle })}
            />
            <EtatPicker value={q.etat} onChange={(etat) => set({ ...q, etat })} />
          </>
        )}
      />

      {prep.manquants.length > 0 && (
        <EditList
          label="Manquants / dommages"
          items={prep.manquants}
          onChange={(items) => onChange({ ...prep, manquants: items })}
        />
      )}

      {prep.observations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Observations
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {prep.observations.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Liste éditable : corriger, retirer, AJOUTER. Toujours affichée (même vide). */
function EditList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {items.length > 0 ? ` (${items.length})` : ''}
      </p>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={it}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-9 flex-1 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Supprimer « ${it} »`}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-4"
              >
                <Trash2 aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
      >
        <Plus aria-hidden /> Ajouter
      </button>
    </div>
  );
}

/* --------- Cartes de pilotage riches (éditables, sans popup) -------------- */

function CardSection<T>({
  label,
  items,
  blank,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  blank: () => T;
  onChange: (items: T[]) => void;
  render: (item: T, set: (v: T) => void) => React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {items.length > 0 ? ` (${items.length})` : ''}
      </p>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3"
        >
          <div className="flex-1 space-y-2">
            {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Supprimer"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-paper-50 hover:text-foreground [&_svg]:size-4"
          >
            <Trash2 aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
      >
        <Plus aria-hidden /> Ajouter
      </button>
    </div>
  );
}

function LibelleInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-transparent bg-transparent px-0 text-sm font-medium text-foreground focus:border-transparent focus:outline-none focus:ring-0"
    />
  );
}

function MetaInput({
  value,
  placeholder,
  onChange,
  full,
}: {
  value?: string;
  placeholder: string;
  onChange: (v: string | undefined) => void;
  full?: boolean;
}): React.JSX.Element {
  return (
    <input
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`h-8 rounded-lg border border-input bg-paper-50 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400 ${
        full ? 'w-full' : 'w-36'
      }`}
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}): React.JSX.Element {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label="Échéance"
      className="h-8 rounded-lg border border-input bg-paper-50 px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
    />
  );
}

const PRIORITES: ActionPriorite[] = ['basse', 'normale', 'haute'];

function PrioritePicker({
  value,
  onChange,
}: {
  value: ActionPriorite;
  onChange: (p: ActionPriorite) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-input">
      {PRIORITES.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 text-xs capitalize transition-colors ${
            value === p
              ? 'bg-gold-100 font-medium text-gold-800'
              : 'bg-surface text-muted-foreground'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

const ETATS: { id: QuestionEtat; label: string }[] = [
  { id: 'ouverte', label: 'Ouverte' },
  { id: 'repondue', label: 'Répondue' },
  { id: 'reportee', label: 'Reportée' },
];

function EtatPicker({
  value,
  onChange,
}: {
  value: QuestionEtat;
  onChange: (e: QuestionEtat) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-input">
      {ETATS.map((e) => (
        <button
          key={e.id}
          type="button"
          aria-pressed={value === e.id}
          onClick={() => onChange(e.id)}
          className={`px-2.5 py-1 text-xs transition-colors ${
            value === e.id
              ? 'bg-gold-100 font-medium text-gold-800'
              : 'bg-surface text-muted-foreground'
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-gold-600"
      />
      {label}
    </label>
  );
}

/* -------------------------- Étape 3 : partager ---------------------------- */

function PartagerStep({
  prep,
  project,
  audiences,
  shared,
  onToggle,
}: {
  prep: MissionPreparation;
  project: Project;
  audiences: string[];
  shared: string[] | null;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
      <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-gold-700">
        <Check aria-hidden />
        Enregistré dans le Journal — privé, tant que vous ne partagez pas.
      </div>

      <MissionDoc prep={prep} project={project} />

      {shared ? (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm text-foreground">
          Partagé (aperçu) à : <strong>{sharedLabels(shared)}</strong>.
          {shared.includes('client') && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Le client voit une version simplifiée, sans aucune donnée interne.
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Partager à
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AUDIENCES.map((a) => {
              const on = audiences.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(a.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                    on
                      ? 'border-gold-400 bg-gold-100 font-medium text-gold-800'
                      : 'border-border bg-surface text-muted-foreground hover:border-gold-300'
                  }`}
                >
                  {a.label}
                  {on && <Check aria-hidden className="size-4" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Aperçu / journalisation uniquement — pas d’envoi ni de signature réels en V1.
          </p>
        </div>
      )}
    </div>
  );
}

function sharedLabels(ids: string[]): string {
  return ids.map((id) => AUDIENCES.find((a) => a.id === id)?.label ?? id).join(', ');
}

/** Aperçu du document généré (vue imprimable simple). */
function MissionDoc({
  prep,
  project,
}: {
  prep: MissionPreparation;
  project: Project;
}): React.JSX.Element {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <article className="rounded-xl border border-border bg-paper-0 p-5">
      <header className="border-b border-border pb-3">
        <p className="text-xs uppercase tracking-wide text-gold-700">{prep.docTitre}</p>
        <h3 className="font-serif text-lg font-semibold text-foreground">{project.name}</h3>
        <p className="text-xs text-muted-foreground">{date}</p>
      </header>
      <div className="space-y-3 pt-3 text-sm">
        {prep.presents.length > 0 && (
          <DocSection title="Présents">{prep.presents.join(', ')}</DocSection>
        )}
        {prep.observations.length > 0 && (
          <DocSection title="Observations">
            <DocList items={prep.observations} />
          </DocSection>
        )}
        {prep.decisions.length > 0 && (
          <DocSection title="Décisions">
            <DocList
              items={prep.decisions.map(
                (d) =>
                  `${d.libelle}${docSuffix([d.quiDecide, d.bloque ? 'bloque le chantier' : undefined])}`,
              )}
            />
          </DocSection>
        )}
        {prep.actions.length > 0 && (
          <DocSection title="Actions à suivre">
            <DocList
              items={prep.actions.map((a) => `${a.label}${docSuffix([a.responsable, a.echeance])}`)}
            />
          </DocSection>
        )}
        {prep.questionsClient.length > 0 && (
          <DocSection title="Questions client">
            <DocList items={prep.questionsClient.map((q) => `${q.libelle} (${q.etat})`)} />
          </DocSection>
        )}
        {prep.manquants.length > 0 && (
          <DocSection title="Manquants / dommages">
            <DocList items={prep.manquants} />
          </DocSection>
        )}
        {prep.reserves.length > 0 && (
          <DocSection title={`Réserves (${prep.reserves.length})`}>
            <ol className="space-y-0.5">
              {prep.reserves.map((r, i) => (
                <li key={i}>
                  {i + 1}. {r.libelle}
                  {docSuffix([r.responsable, r.echeance])}
                </li>
              ))}
            </ol>
          </DocSection>
        )}
      </div>
    </article>
  );
}

function docSuffix(parts: (string | undefined)[]): string {
  const s = parts.filter(Boolean).join(' · ');
  return s ? ` — ${s}` : '';
}

function DocList({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i}>• {it}</li>
      ))}
    </ul>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </section>
  );
}
