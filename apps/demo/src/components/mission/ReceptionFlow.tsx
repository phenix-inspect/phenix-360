import { useEffect, useMemo, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  MAX_LEVEE_PHOTOS,
  RESERVE_RESPONSABLE_LABEL,
  isCompteRendu,
  isPublished,
  prereceptionReference,
  receptionComplete,
  reservesDePrereception,
  reservesRestantes,
  reserveEstLevee,
  validatedDevis,
  leveeComplete,
  type CompteRenduEvent,
  type Event,
  type EventActor,
  type Project,
  type ReceptionData,
  type ReceptionReserve,
  type ReserveLevee,
} from '@phenix360/core';
import {
  Camera,
  Check,
  Download,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { demo, dossierOf, nameOf } from '../../store';
import { ACCEPT_IMAGE, loadPhotos } from '../../lib/media';
import { fmtDate } from '../../lib/format';
import { LeaveConfirmDialog, useBeforeUnloadGuard } from './LeaveGuard';
import { Portal } from '../Portal';

type Step = 'lever' | 'valider' | 'termine';

/**
 * La Pré-réception VALIDÉE la plus récente d'un chantier (version la plus haute,
 * puis date). C'est la SEULE source de la Réception — jamais le devis directement.
 */
function latestPrereception(events: Event[], projectId: string): CompteRenduEvent | undefined {
  const evs = events.filter(
    (e): e is CompteRenduEvent =>
      e.projectId === projectId && isCompteRendu(e) && isPublished(e) && !!e.content.prereception,
  );
  if (evs.length === 0) return undefined;
  return evs.reduce((best, e) => {
    const bv = best.content.prereception?.version ?? 1;
    const ev = e.content.prereception?.version ?? 1;
    if (ev !== bv) return ev > bv ? e : best;
    return e.createdAt >= best.createdAt ? e : best;
  });
}

/**
 * RÉCEPTION — dernière étape contractuelle du chantier. Elle repart EXCLUSIVEMENT
 * de la Pré-réception validée : elle ne contrôle plus les prestations, elle vérifie
 * que TOUTES les réserves ont été levées (commentaire de levée + photos avant /
 * après). Tant qu'une réserve reste ouverte, la Réception ne peut pas être validée.
 * Une fois validée, PHÉNIX diffuse le PV au client et clôture le chantier.
 */
export function ReceptionFlow({
  project,
  actor,
  onClose,
}: {
  project: Project;
  actor: EventActor;
  onClose: () => void;
}): React.JSX.Element {
  const snap = demo.getSnapshot();
  const dossier = useMemo(() => dossierOf(snap, project.id), [snap, project.id]);
  const source = useMemo(
    () => latestPrereception(snap.events, project.id),
    [snap.events, project.id],
  );

  const [step, setStep] = useState<Step>('lever');
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [commentaireGeneral, setCommentaireGeneral] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const clientName = project.clientId ? nameOf(snap, project.clientId) : undefined;
  const conducteur = nameOf(snap, actor.userId);
  const now = useMemo(() => new Date(), []);
  const dateStr = cap(
    now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  const prereceptionData = source?.content.prereception;
  const prVersion = prereceptionData?.version ?? 1;
  const prereceptionRef = source ? prereceptionReference(source.createdAt, prVersion) : '';
  const devisRef = validatedDevis(dossier)?.reference ?? dossier?.devis?.reference;
  const avenants = (dossier?.avenants ?? []).map((a) => a.numero);

  // Les réserves de la Pré-réception, dénormalisées (jamais recréées) + leur levée.
  const [reserves, setReserves] = useState<ReceptionReserve[]>(() =>
    source && prereceptionData ? reservesDePrereception(prereceptionData, source.createdAt) : [],
  );

  // PERTE DE SAISIE — la Réception est « en cours de saisie » dès qu'une levée a
  // été amorcée (photo/commentaire) ou qu'un commentaire général est écrit. Tant
  // que le chantier n'est pas clôturé, quitter effacerait ce travail : on prévient.
  const dirty =
    step !== 'termine' && (reserves.some((r) => !!r.levee) || commentaireGeneral.trim().length > 0);
  useBeforeUnloadGuard(dirty);
  const requestClose = (): void => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || confirmLeave) return;
      if (step === 'valider') setStep('lever');
      else requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dirty, confirmLeave]);

  const patchLevee = (posteId: string, patch: Partial<ReserveLevee>): void =>
    setReserves((rs) =>
      rs.map((r) =>
        r.posteId === posteId
          ? {
              ...r,
              levee: {
                commentaire: '',
                photos: [],
                dateLevee: now.toISOString(),
                conducteur,
                ...r.levee,
                ...patch,
              },
            }
          : r,
      ),
    );

  const toggleLevee = (posteId: string, on: boolean): void =>
    setReserves((rs) =>
      rs.map((r) => {
        if (r.posteId !== posteId) return r;
        if (!on) {
          const { levee: _drop, ...rest } = r;
          return rest;
        }
        return {
          ...r,
          levee: r.levee ?? {
            commentaire: '',
            photos: [],
            dateLevee: now.toISOString(),
            conducteur,
          },
        };
      }),
    );

  const data: ReceptionData = {
    prereceptionEventId: source?.id ?? '',
    prereceptionRef,
    ...(devisRef ? { devisRef } : {}),
    avenants,
    prestationsTotal: prereceptionData?.prestations.length ?? 0,
    reserves,
    ...(commentaireGeneral.trim() ? { commentaireGeneral } : {}),
  };

  const restantes = reservesRestantes(reserves);
  const complete = receptionComplete(reserves);

  const validate = async (): Promise<void> => {
    if (busy || !complete || !source) return;
    setBusy(true);
    try {
      const { receptionId } = await demo.createReception(project.id, actor, data);
      setCreatedId(receptionId);
      setStep('termine');
    } finally {
      setBusy(false);
    }
  };

  // Aucune Pré-réception validée → la Réception est bloquée (source unique).
  if (!source || !prereceptionData) {
    return (
      <Shell onClose={onClose} sousTitre="Ouverture">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-warning/15 text-warning [&_svg]:size-7">
            <Lock aria-hidden />
          </span>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Réception indisponible
          </h2>
          <p className="text-sm text-muted-foreground">
            La Pré-réception doit être validée avant de réaliser la Réception.
          </p>
          <Button onClick={onClose}>J’ai compris</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      onClose={requestClose}
      sousTitre={
        step === 'lever' ? 'Levée des réserves' : step === 'valider' ? 'Validation' : 'Clôturé'
      }
    >
      <LeaveConfirmDialog
        open={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onLeave={onClose}
      />
      <div className="flex-1 overflow-y-auto">
        {step === 'lever' && (
          <div className="mx-auto max-w-2xl space-y-6 px-5 py-7">
            <Entete
              chantier={project.name}
              adresse={project.address}
              client={clientName}
              conducteur={conducteur}
              dateStr={dateStr}
              devisRef={devisRef}
              avenants={avenants}
              prereceptionRef={prereceptionRef}
            />

            <Resume
              prestationsTotal={prereceptionData.prestations.length}
              reservesCreees={reserves.length}
              reservesLevees={reserves.length - restantes}
              reservesRestantes={restantes}
            />

            {reserves.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
                <ShieldCheck aria-hidden />
                Aucune réserve n’avait été émise lors de la Pré-réception. La réception peut être
                prononcée directement.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    Levée des réserves
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Contrôle final de chaque réserve émise en Pré-réception. Photo « après » et
                    commentaire de levée obligatoires.
                  </p>
                </div>
                <ul className="space-y-3">
                  {reserves.map((r) => (
                    <li key={r.posteId}>
                      <ReserveCard reserve={r} onToggle={toggleLevee} onPatch={patchLevee} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'valider' && (
          <ValidationStep
            project={project}
            onPreview={() => demo.previewReception(project.id, actor, data)}
          />
        )}

        {step === 'termine' && (
          <TermineStep createdId={createdId} project={project} reserves={reserves} />
        )}
      </div>

      <footer className="border-t border-border px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {step === 'lever' && (
            <>
              <span className="text-xs text-muted-foreground">
                {restantes > 0
                  ? `${restantes} réserve${restantes > 1 ? 's' : ''} reste${
                      restantes > 1 ? 'nt' : ''
                    } à lever`
                  : reserves.length > 0
                    ? 'Toutes les réserves sont levées'
                    : 'Aucune réserve à lever'}
              </span>
              <Button size="lg" onClick={() => setStep('valider')} disabled={!complete}>
                <KeyRound aria-hidden /> Valider la Réception
              </Button>
            </>
          )}
          {step === 'valider' && (
            <>
              <Button variant="ghost" onClick={() => setStep('lever')}>
                Revenir aux réserves
              </Button>
              <Button size="lg" onClick={() => void validate()} disabled={busy || !complete}>
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                Diffuser au client
              </Button>
            </>
          )}
          {step === 'termine' && (
            <>
              <span className="text-xs text-muted-foreground">Chantier clôturé — archivable.</span>
              <Button size="lg" onClick={onClose}>
                <Check aria-hidden /> Terminer
              </Button>
            </>
          )}
        </div>
      </footer>
    </Shell>
  );
}

/* -------------------------------- Coquille -------------------------------- */

function Shell({
  onClose,
  sousTitre,
  children,
}: {
  onClose: () => void;
  sousTitre: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Portal>
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
          <p className="font-serif text-lg font-semibold text-foreground">Réception</p>
          <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
            {sousTitre}
          </span>
        </header>
        {children}
      </div>
    </Portal>
  );
}

/* -------------------------------- En-tête --------------------------------- */

function Entete({
  chantier,
  adresse,
  client,
  conducteur,
  dateStr,
  devisRef,
  avenants,
  prereceptionRef,
}: {
  chantier: string;
  adresse?: string;
  client?: string;
  conducteur: string;
  dateStr: string;
  devisRef?: string;
  avenants: number[];
  prereceptionRef: string;
}): React.JSX.Element {
  return (
    <section className="flex flex-wrap gap-x-8 gap-y-2 rounded-2xl border border-border bg-surface p-5">
      <Meta label="Chantier" value={chantier} />
      {adresse && <Meta label="Adresse" value={adresse} />}
      {client && <Meta label="Client" value={client} />}
      <Meta label="Conducteur" value={conducteur} />
      <Meta label="Date" value={dateStr} />
      {devisRef && <Meta label="N° du devis" value={devisRef} />}
      {avenants.length > 0 && (
        <Meta label="Avenants intégrés" value={avenants.map((n) => `n°${n}`).join(', ')} />
      )}
      <Meta label="Réf. Pré-réception" value={prereceptionRef} />
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

/* --------------------------------- Résumé --------------------------------- */

function Resume({
  prestationsTotal,
  reservesCreees,
  reservesLevees,
  reservesRestantes: restantes,
}: {
  prestationsTotal: number;
  reservesCreees: number;
  reservesLevees: number;
  reservesRestantes: number;
}): React.JSX.Element {
  const tiles: { n: number; label: string; alerte?: boolean }[] = [
    { n: prestationsTotal, label: 'Prestations' },
    { n: reservesCreees, label: 'Réserves créées' },
    { n: reservesLevees, label: 'Réserves levées' },
    { n: restantes, label: 'Réserves restantes', alerte: restantes > 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl border bg-surface p-4 text-center ${
            t.alerte ? 'border-warning bg-warning/10' : 'border-border'
          }`}
        >
          <div
            className={`text-2xl font-semibold ${t.alerte ? 'text-warning' : 'text-foreground'}`}
          >
            {t.n}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Carte d'une réserve -------------------------- */

function ReserveCard({
  reserve: r,
  onToggle,
  onPatch,
}: {
  reserve: ReceptionReserve;
  onToggle: (posteId: string, on: boolean) => void;
  onPatch: (posteId: string, patch: Partial<ReserveLevee>) => void;
}): React.JSX.Element {
  const levee = r.levee;
  const isLevee = reserveEstLevee(r);
  const enCours = !!levee && !isLevee;
  return (
    <div
      id={`reserve-${r.posteId}`}
      className={`scroll-mt-24 rounded-xl border bg-surface p-3.5 ${
        isLevee ? 'border-gold-300' : enCours ? 'border-warning' : 'border-destructive'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700">
          Réserve n°{r.numero}
        </span>
        <span className="text-sm font-medium text-foreground">{r.prestationLabel}</span>
        <span className="text-xs text-muted-foreground">· {r.lotLabel}</span>
      </div>

      <div className="mt-2 space-y-2 rounded-lg border border-border bg-paper-50 p-3 text-sm">
        <div>
          <FieldLabel>Commentaire initial</FieldLabel>
          <p className="text-foreground">{r.commentaireInitial || '—'}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Responsable : {RESERVE_RESPONSABLE_LABEL[r.responsable]}</span>
          <span>Créée le {fmtDate(r.dateCreation)}</span>
        </div>
        {r.photosAvant.filter((ph) => ph.imageUrl).length > 0 && (
          <div>
            <FieldLabel>Photos avant</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {r.photosAvant
                .filter((ph) => ph.imageUrl)
                .map((ph, i) => (
                  <img
                    key={i}
                    src={ph.imageUrl}
                    alt=""
                    className="size-16 rounded-lg border border-border object-cover"
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={!!levee}
          onChange={(e) => onToggle(r.posteId, e.target.checked)}
          className="size-4 accent-gold-600"
        />
        Réserve levée
        {isLevee && <Check aria-hidden className="size-4 text-gold-600" />}
      </label>

      {levee && <LeveeFields reserve={r} levee={levee} onPatch={onPatch} incomplete={enCours} />}
    </div>
  );
}

function LeveeFields({
  reserve: r,
  levee,
  onPatch,
  incomplete,
}: {
  reserve: ReceptionReserve;
  levee: ReserveLevee;
  onPatch: (posteId: string, patch: Partial<ReserveLevee>) => void;
  incomplete: boolean;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photos = levee.photos;

  const addPhotos = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const room = MAX_LEVEE_PHOTOS - photos.length;
      const { media, error } = await loadPhotos(Array.from(files).slice(0, room));
      setPhotoError(error);
      onPatch(r.posteId, { photos: [...photos, ...media] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-paper-50 p-3">
      {incomplete && (
        <p className="flex items-center gap-1.5 rounded-lg bg-warning/15 px-2 py-1 text-xs font-medium text-warning [&_svg]:size-3.5">
          <ShieldCheck aria-hidden />
          Commentaire de levée et au moins une photo « après » obligatoires.
        </p>
      )}
      <div className="space-y-1.5">
        <FieldLabel>Photos « après » ({photos.length}/3)</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((ph, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              <img src={ph.imageUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onPatch(r.posteId, { photos: photos.filter((_, j) => j !== i) })}
                aria-label="Retirer la photo"
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink-900/60 text-paper-0 [&_svg]:size-3"
              >
                <X aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MAX_LEVEE_PHOTOS && (
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
        {photoError && (
          <p role="alert" className="text-sm text-destructive">
            {photoError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Commentaire de levée (obligatoire)</FieldLabel>
        <textarea
          id={`levee-${r.posteId}`}
          value={levee.commentaire}
          onChange={(e) => onPatch(r.posteId, { commentaire: e.target.value })}
          rows={2}
          placeholder="Décrivez la reprise effectuée…"
          className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
      </div>
    </div>
  );
}

/* --------------------------- Validation & clôture ------------------------- */

function ValidationStep({
  project,
  onPreview,
}: {
  project: Project;
  onPreview: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Validation avant envoi
        </h2>
        <p className="text-sm text-muted-foreground">
          Toutes les réserves sont levées. Prévisualisez le PV de réception, puis diffusez-le au
          client. Rien n’est transmis tant que vous n’avez pas validé.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-warning bg-warning/10 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/20 text-warning [&_svg]:size-5">
          <Lock aria-hidden />
        </span>
        <p className="text-sm text-foreground">
          <span className="font-medium">Brouillon</span> — visible de vous seul. Le client ne voit
          rien, aucune notification n’est envoyée avant votre validation.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <FileText aria-hidden />
          PV de réception — {project.name}
          <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            Brouillon
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Réserves levées (commentaire initial + de levée, photos avant / après), conclusion,
          signatures PHÉNIX et Client.
        </p>
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye aria-hidden /> Prévisualiser
        </Button>
      </div>
    </div>
  );
}

function TermineStep({
  createdId,
  project,
  reserves,
}: {
  createdId: string | null;
  project: Project;
  reserves: ReceptionReserve[];
}): React.JSX.Element {
  const event = useMemo(
    () => (createdId ? demo.getSnapshot().events.find((e) => e.id === createdId) : undefined),
    [createdId],
  );
  const levees = reserves.filter((r) => leveeComplete(r.levee)).length;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div className="flex items-center gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
          <Check aria-hidden />
        </span>
        <div>
          <p className="font-serif text-lg font-semibold text-foreground">
            Réception validée — chantier clôturé
          </p>
          <p className="text-sm text-muted-foreground">
            {levees > 0
              ? `${levees} réserve${levees > 1 ? 's' : ''} levée${levees > 1 ? 's' : ''}. `
              : ''}
            Le PV a été diffusé à l’Espace client (le client est notifié). Le chantier est
            archivable.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <Lock aria-hidden />
        Document verrouillé et non modifiable. Une correction se fait en créant une nouvelle
        version.
      </div>

      {event && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
            <FileText aria-hidden />
            PV de réception — {project.name}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => demo.openDocument(event, 'client')}>
              <Eye aria-hidden /> Prévisualiser
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => demo.downloadDocument(event, 'client')}
            >
              <Download aria-hidden /> Télécharger en PDF
            </Button>
          </div>
        </div>
      )}
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
