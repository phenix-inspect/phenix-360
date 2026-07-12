import { useEffect, useMemo, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  MOINS_VALUE_MOTIFS,
  RESERVE_RESPONSABLE_LABEL,
  RESERVE_RESPONSABLES,
  MAX_PRERECEPTION_PHOTOS,
  buildPrestationsAVerifier,
  originLabel,
  prereceptionComplete,
  prereceptionSynthese,
  prestationComplete,
  type EventActor,
  type PrestationStatut,
  type PrestationVerif,
  type Project,
  type ReserveResponsableKind,
} from '@phenix360/core';
import {
  Camera,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { demo, dossierOf } from '../../store';
import { ACCEPT_IMAGE, mediaUploader } from '../../lib/media';

type Step = 'verifier' | 'finaliser' | 'termine';

/** Les quatre statuts, dans l'ordre, avec leur pastille de couleur. */
const STATUTS: { statut: PrestationStatut; dot: string; short: string }[] = [
  { statut: 'fait', dot: '🟢', short: 'Fait' },
  { statut: 'reserve', dot: '🟠', short: 'Réserve' },
  { statut: 'non_fait', dot: '🟡', short: 'À faire' },
  { statut: 'moins_value', dot: '⚫', short: 'Moins-value' },
];

/**
 * PRÉ-RÉCEPTION — vérifier l'exécution du contrat (VISION Art. 8). PHÉNIX
 * reconstruit les prestations du devis signé + des avenants ; le conducteur ne
 * ressaisit rien : il CONTRÔLE, prestation par prestation (Fait / Réserve / À
 * faire / Moins-value). Une seule saisie → deux documents (client / artisan)
 * dérivés par destinataire. Expérience fluide, extrêmement simple, premium.
 */
export function PrereceptionFlow({
  project,
  actor,
  onClose,
}: {
  project: Project;
  actor: EventActor;
  onClose: () => void;
}): React.JSX.Element {
  const dossier = useMemo(() => dossierOf(demo.getSnapshot(), project.id), [project.id]);
  const [step, setStep] = useState<Step>('verifier');
  const [busy, setBusy] = useState(false);
  const [presents, setPresents] = useState<string[]>([]);
  const [prestations, setPrestations] = useState<PrestationVerif[]>(() =>
    buildPrestationsAVerifier(dossier?.devis, dossier?.avenants ?? []),
  );
  const [commentaireGeneral, setCommentaireGeneral] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (step === 'finaliser') setStep('verifier');
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const setStatut = (posteId: string, statut: PrestationStatut): void =>
    setPrestations((ps) =>
      ps.map((p) => {
        if (p.posteId !== posteId) return p;
        // On repart d'un objet propre : changer de statut vide les champs devenus
        // sans objet (une réserve n'existe que pour « Fait avec réserve »…).
        const next: PrestationVerif = {
          posteId: p.posteId,
          lotLabel: p.lotLabel,
          label: p.label,
          origin: p.origin,
          statut,
        };
        if (statut === 'reserve')
          next.reserve = p.reserve ?? { photos: [], commentaire: '', responsable: 'artisan' };
        if (statut === 'non_fait') next.commentaireNonFait = p.commentaireNonFait ?? '';
        if (statut === 'moins_value') next.motifMoinsValue = p.motifMoinsValue ?? '';
        return next;
      }),
    );

  const patchPrestation = (posteId: string, patch: Partial<PrestationVerif>): void =>
    setPrestations((ps) => ps.map((p) => (p.posteId === posteId ? { ...p, ...patch } : p)));

  const generate = async (): Promise<void> => {
    if (busy || !prereceptionComplete(prestations)) return;
    setBusy(true);
    try {
      const { prereceptionId } = await demo.createPrereception(project.id, actor, {
        presents,
        prestations,
        commentaireGeneral,
      });
      setCreatedId(prereceptionId);
      setStep('termine');
    } finally {
      setBusy(false);
    }
  };

  const synthese = prereceptionSynthese(prestations);
  const incomplets = prestations.filter((p) => !prestationComplete(p)).length;
  const hasContract = prestations.length > 0;

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-5"
        >
          <X aria-hidden />
        </button>
        <p className="font-serif text-lg font-semibold text-foreground">Pré-réception</p>
        <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
          {step === 'verifier'
            ? 'Vérification du contrat'
            : step === 'finaliser'
              ? 'Synthèse'
              : 'Enregistré'}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {step === 'verifier' && (
          <div className="mx-auto max-w-2xl space-y-6 px-5 py-7">
            <EnteteMission
              dateStr={dateStr}
              heureStr={heureStr}
              presents={presents}
              onPresents={setPresents}
            />

            {!hasContract ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                Aucune prestation au contrat : ajoutez d’abord le devis signé du chantier pour
                lancer la pré-réception.
              </div>
            ) : (
              <PrestationsListe
                prestations={prestations}
                onStatut={setStatut}
                onPatch={patchPrestation}
              />
            )}
          </div>
        )}

        {step === 'finaliser' && (
          <div className="mx-auto max-w-2xl space-y-6 px-5 py-7">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Synthèse de la pré-réception
              </h2>
              <p className="text-sm text-muted-foreground">
                Calculée automatiquement à partir de votre vérification.
              </p>
            </div>

            <SyntheseTiles synthese={synthese} />

            {incomplets > 0 && (
              <button
                type="button"
                onClick={() => setStep('verifier')}
                className="flex w-full items-center gap-2 rounded-xl border border-warning bg-warning/10 px-4 py-3 text-left text-sm text-foreground [&_svg]:size-4 [&_svg]:text-warning"
              >
                <ClipboardCheck aria-hidden />
                {incomplets} prestation{incomplets > 1 ? 's' : ''} à compléter (commentaire ou motif
                manquant) — revenir à la vérification.
              </button>
            )}

            <div className="space-y-2">
              <label
                htmlFor="pv-mot"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Commentaire général de pré-réception
              </label>
              <textarea
                id="pv-mot"
                value={commentaireGeneral}
                onChange={(e) => setCommentaireGeneral(e.target.value)}
                rows={4}
                placeholder="La pré-réception s’est déroulée dans de bonnes conditions. Les principaux ouvrages sont conformes. Quelques finitions restent à reprendre avant la réception définitive."
                className="w-full resize-y rounded-2xl border border-input bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
              <p className="text-xs text-muted-foreground">
                Ce commentaire apparaîtra dans le document client et le document artisan.
              </p>
            </div>
          </div>
        )}

        {step === 'termine' && (
          <TermineStep createdId={createdId} synthese={synthese} project={project} />
        )}
      </div>

      <footer className="border-t border-border px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {step === 'verifier' && (
            <>
              <span className="text-xs text-muted-foreground">
                {hasContract
                  ? `${prestations.length} prestation${prestations.length > 1 ? 's' : ''} au contrat`
                  : 'Aucune prestation'}
              </span>
              <Button size="lg" onClick={() => setStep('finaliser')} disabled={!hasContract}>
                Voir la synthèse
              </Button>
            </>
          )}
          {step === 'finaliser' && (
            <>
              <Button variant="ghost" onClick={() => setStep('verifier')}>
                Revenir aux prestations
              </Button>
              <Button
                size="lg"
                onClick={() => void generate()}
                disabled={busy || incomplets > 0 || !hasContract}
              >
                {busy ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden />
                )}
                Générer les documents
              </Button>
            </>
          )}
          {step === 'termine' && (
            <>
              <span className="text-xs text-muted-foreground">
                Enregistré dans Documents et le Suivi.
              </span>
              <Button size="lg" onClick={onClose}>
                <Check aria-hidden /> Terminer
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------ En-tête ----------------------------------- */

function EnteteMission({
  dateStr,
  heureStr,
  presents,
  onPresents,
}: {
  dateStr: string;
  heureStr: string;
  presents: string[];
  onPresents: (v: string[]) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const add = (): void => {
    const v = draft.trim();
    if (!v) return;
    onPresents([...presents, v]);
    setDraft('');
  };
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Meta label="Date" value={cap(dateStr)} />
        <Meta label="Heure" value={heureStr} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Présents (optionnel)
        </p>
        {presents.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {presents.map((p, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-50 px-3 py-1 text-sm text-foreground"
              >
                {p}
                <button
                  type="button"
                  onClick={() => onPresents(presents.filter((_, j) => j !== i))}
                  aria-label={`Retirer ${p}`}
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Conducteur PHÉNIX, Client, Artisan peinture…"
            className="h-10 flex-1 rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <Button
            size="icon"
            aria-label="Ajouter un présent"
            onClick={add}
            disabled={!draft.trim()}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/* --------------------------- Liste des prestations ------------------------ */

function PrestationsListe({
  prestations,
  onStatut,
  onPatch,
}: {
  prestations: PrestationVerif[];
  onStatut: (posteId: string, statut: PrestationStatut) => void;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
}): React.JSX.Element {
  // Regroupement par lot (corps d'état), dans l'ordre du contrat.
  const order: string[] = [];
  const byLot = new Map<string, PrestationVerif[]>();
  for (const p of prestations) {
    if (!byLot.has(p.lotLabel)) {
      byLot.set(p.lotLabel, []);
      order.push(p.lotLabel);
    }
    byLot.get(p.lotLabel)?.push(p);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Vérifiez chaque prestation vendue
        </h2>
        <p className="text-sm text-muted-foreground">
          Reconstruites du devis signé et de tous les avenants. Un statut par prestation — une
          réserve seulement si nécessaire.
        </p>
      </div>

      {order.map((lot) => (
        <section key={lot} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-700">{lot}</h3>
          <ul className="space-y-2">
            {(byLot.get(lot) ?? []).map((p) => (
              <li key={p.posteId}>
                <PrestationCard prestation={p} onStatut={onStatut} onPatch={onPatch} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PrestationCard({
  prestation: p,
  onStatut,
  onPatch,
}: {
  prestation: PrestationVerif;
  onStatut: (posteId: string, statut: PrestationStatut) => void;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
}): React.JSX.Element {
  const incomplete = !prestationComplete(p);
  return (
    <div
      className={`rounded-xl border bg-surface p-3.5 ${
        incomplete ? 'border-warning' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-foreground">{p.label}</span>
        {p.origin.kind === 'avenant' && (
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700">
            {originLabel(p.origin)}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {STATUTS.map((s) => {
          const on = p.statut === s.statut;
          return (
            <button
              key={s.statut}
              type="button"
              aria-pressed={on}
              onClick={() => onStatut(p.posteId, s.statut)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                on
                  ? 'border-gold-400 bg-gold-100 text-gold-800'
                  : 'border-border bg-paper-50 text-muted-foreground hover:border-gold-300'
              }`}
            >
              <span aria-hidden>{s.dot}</span>
              {s.short}
            </button>
          );
        })}
      </div>

      {p.statut === 'reserve' && p.reserve && <ReserveFields prestation={p} onPatch={onPatch} />}

      {p.statut === 'non_fait' && (
        <div className="mt-3">
          <FieldLabel>Commentaire (obligatoire)</FieldLabel>
          <textarea
            value={p.commentaireNonFait ?? ''}
            onChange={(e) => onPatch(p.posteId, { commentaireNonFait: e.target.value })}
            rows={2}
            placeholder="Livraison prévue la semaine prochaine."
            className="w-full resize-y rounded-lg border border-input bg-paper-50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
      )}

      {p.statut === 'moins_value' && <MotifPicker prestation={p} onPatch={onPatch} />}
    </div>
  );
}

/* ------------------------- Cas « Fait avec réserve » ---------------------- */

function ReserveFields({
  prestation: p,
  onPatch,
}: {
  prestation: PrestationVerif;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const reserve = p.reserve ?? { photos: [], commentaire: '', responsable: 'artisan' as const };
  const photos = reserve.photos;

  const addPhotos = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const room = MAX_PRERECEPTION_PHOTOS - photos.length;
      const uploaded = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map((f) => mediaUploader(f)),
      );
      onPatch(p.posteId, { reserve: { ...reserve, photos: [...photos, ...uploaded] } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-paper-50 p-3">
      <div className="space-y-1.5">
        <FieldLabel>Photos ({photos.length}/3)</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((ph, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              <img src={ph.imageUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  onPatch(p.posteId, {
                    reserve: { ...reserve, photos: photos.filter((_, j) => j !== i) },
                  })
                }
                aria-label="Retirer la photo"
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3"
              >
                <X aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MAX_PRERECEPTION_PHOTOS && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-gold-300 hover:text-foreground">
              <input
                type="file"
                accept={ACCEPT_IMAGE}
                multiple
                className="sr-only"
                onChange={(e) => void addPhotos(e.target.files)}
              />
              {busy ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <Camera aria-hidden className="size-5" />
              )}
            </label>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Commentaire (obligatoire)</FieldLabel>
        <textarea
          value={reserve.commentaire}
          onChange={(e) =>
            onPatch(p.posteId, { reserve: { ...reserve, commentaire: e.target.value } })
          }
          rows={2}
          placeholder="Décrivez la réserve à reprendre…"
          className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Responsable</FieldLabel>
          <div className="inline-flex overflow-hidden rounded-lg border border-input">
            {RESERVE_RESPONSABLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reserve.responsable === r}
                onClick={() => onPatch(p.posteId, { reserve: { ...reserve, responsable: r } })}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  reserve.responsable === r
                    ? 'bg-gold-100 font-medium text-gold-800'
                    : 'bg-surface text-muted-foreground'
                }`}
              >
                {RESERVE_RESPONSABLE_LABEL[r as ReserveResponsableKind]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Reprise prévue (optionnel)</FieldLabel>
          <input
            type="date"
            value={reserve.dateReprise ?? ''}
            onChange={(e) =>
              onPatch(p.posteId, {
                reserve: { ...reserve, dateReprise: e.target.value || undefined },
              })
            }
            className="h-9 rounded-lg border border-input bg-surface px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Cas « Plus à faire » (motif) -------------------- */

function MotifPicker({
  prestation: p,
  onPatch,
}: {
  prestation: PrestationVerif;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
}): React.JSX.Element {
  const value = p.motifMoinsValue ?? '';
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-paper-50 p-3">
      <FieldLabel>Motif (obligatoire)</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {MOINS_VALUE_MOTIFS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value === m}
            onClick={() => onPatch(p.posteId, { motifMoinsValue: m })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              value === m
                ? 'border-gold-400 bg-gold-100 font-medium text-gold-800'
                : 'border-border bg-surface text-muted-foreground hover:border-gold-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onPatch(p.posteId, { motifMoinsValue: e.target.value })}
        placeholder="Précisez le motif…"
        className="h-9 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      <p className="text-xs text-muted-foreground">
        Cette prestation sera déduite de la facture finale.
      </p>
    </div>
  );
}

/* ------------------------------ Synthèse ---------------------------------- */

function SyntheseTiles({
  synthese,
}: {
  synthese: ReturnType<typeof prereceptionSynthese>;
}): React.JSX.Element {
  const tiles: { dot: string; n: number; label: string }[] = [
    { dot: '🟢', n: synthese.conformes, label: 'Conformes' },
    { dot: '🟠', n: synthese.avecReserve, label: 'Avec réserve' },
    { dot: '🟡', n: synthese.restantes, label: 'Restant à réaliser' },
    { dot: '⚫', n: synthese.supprimees, label: 'Supprimées' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-border bg-surface p-4 text-center">
          <div className="text-2xl font-semibold text-foreground">
            <span className="mr-1 align-middle text-base" aria-hidden>
              {t.dot}
            </span>
            {t.n}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Étape finale ------------------------------ */

function TermineStep({
  createdId,
  synthese,
  project,
}: {
  createdId: string | null;
  synthese: ReturnType<typeof prereceptionSynthese>;
  project: Project;
}): React.JSX.Element {
  const event = useMemo(
    () => (createdId ? demo.getSnapshot().events.find((e) => e.id === createdId) : undefined),
    [createdId],
  );
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div className="flex items-center gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
          <Check aria-hidden />
        </span>
        <div>
          <p className="font-serif text-lg font-semibold text-foreground">
            Pré-réception enregistrée
          </p>
          <p className="text-sm text-muted-foreground">
            Rangée dans Documents et le Suivi. Deux versions ont été générées.
          </p>
        </div>
      </div>

      <SyntheseTiles synthese={synthese} />

      {event && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documents générés — {project.name}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DocCard
              title="Version client"
              description="Prestations, statuts, réserves (photos + commentaire), commentaire général. Sans donnée interne."
              onOpen={() => demo.openDocument(event, 'client')}
              onDownload={() => demo.downloadDocument(event, 'client')}
            />
            <DocCard
              title="Version artisan"
              description="Tout l’opérationnel : responsables, dates de reprise, photos et commentaires."
              onOpen={() => demo.openDocument(event, 'artisan')}
              onDownload={() => demo.downloadDocument(event, 'artisan')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DocCard({
  title,
  description,
  onOpen,
  onDownload,
}: {
  title: string;
  description: string;
  onOpen: () => void;
  onDownload: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <FileText aria-hidden />
        {title}
      </div>
      <p className="flex-1 text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onOpen}>
          <FileText aria-hidden /> Ouvrir
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download aria-hidden /> Télécharger
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Utilitaires ------------------------------ */

function FieldLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function cap(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
