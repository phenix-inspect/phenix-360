import { useEffect, useMemo, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  MOINS_VALUE_MOTIFS,
  PRERECEPTION_SYNTHESE_LABEL,
  PRESTATION_STATUT_DOT,
  PRESTATION_STATUT_SHORT,
  RESERVE_RESPONSABLE_LABEL,
  RESERVE_RESPONSABLES,
  MAX_PRERECEPTION_PHOTOS,
  buildPrestationsAVerifier,
  devisAVerifier,
  validatedDevis,
  originLabel,
  prereceptionComplete,
  prereceptionReference,
  prereceptionSynthese,
  prestationComplete,
  type DetailTechnique,
  type EventActor,
  type PrereceptionData,
  type PrestationStatut,
  type PrestationVerif,
  type Project,
  type ReserveResponsableKind,
} from '@phenix360/core';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { demo, dossierOf, nameOf } from '../../store';
import { ACCEPT_IMAGE, mediaUploader } from '../../lib/media';

type Step = 'verifier' | 'finaliser' | 'valider' | 'envoye';

/** Champ obligatoire manquant d'une prestation (pour le raccourci « compléter »). */
type ChampManquant = { champ: 'reserve' | 'nonfait' | 'motif'; label: string; court: string };

/**
 * Le premier champ obligatoire MANQUANT d'une prestation (aligné sur
 * `prestationComplete`). `null` si la prestation est complète.
 */
function champManquant(p: PrestationVerif): ChampManquant | null {
  if (p.statut === 'reserve' && !(p.reserve && p.reserve.commentaire.trim()))
    return { champ: 'reserve', label: 'commentaire de réserve', court: 'commentaire' };
  if (p.statut === 'non_fait' && !(p.commentaireNonFait ?? '').trim())
    return { champ: 'nonfait', label: 'commentaire', court: 'commentaire' };
  if (p.statut === 'moins_value' && !(p.motifMoinsValue ?? '').trim())
    return { champ: 'motif', label: 'motif', court: 'motif' };
  return null;
}

/** Tronque un libellé pour l'affichage compact (le libellé complet reste ailleurs). */
function courtLabel(s: string, n = 40): string {
  const t = s.trim();
  return t.length <= n
    ? t
    : `${t.slice(0, t.lastIndexOf(' ', n) > 0 ? t.lastIndexOf(' ', n) : n)}…`;
}

/** Les quatre statuts PROFESSIONNELS, dans l'ordre (libellés & pastilles du cœur). */
const STATUTS: { statut: PrestationStatut; dot: string; short: string }[] = (
  ['fait', 'reserve', 'non_fait', 'moins_value'] as const
).map((statut) => ({
  statut,
  dot: PRESTATION_STATUT_DOT[statut],
  short: PRESTATION_STATUT_SHORT[statut],
}));

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
  // On ne reprend QUE les prestations des lots VALIDÉS (validatedDevis). Un lot
  // non vérifié n'alimente jamais la pré-réception.
  const [prestations, setPrestations] = useState<PrestationVerif[]>(() =>
    buildPrestationsAVerifier(validatedDevis(dossier), dossier?.avenants ?? []),
  );
  // Reste-t-il des lots à vérifier (devis présent mais pas entièrement validé) ?
  const enBrouillon = devisAVerifier(dossier);
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

  // En-tête d'identité du chantier (adresse, client, conducteur, référence, version).
  const snap = demo.getSnapshot();
  const clientName = project.clientId ? nameOf(snap, project.clientId) : undefined;
  const conducteur = nameOf(snap, actor.userId);
  const nextVersion =
    snap.events.filter(
      (e) => e.projectId === project.id && e.type === 'compte_rendu' && !!e.content.prereception,
    ).length + 1;
  const reference = prereceptionReference(now.toISOString(), nextVersion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (step === 'valider') setStep('finaliser');
      else if (step === 'finaliser') setStep('verifier');
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
        // sans objet (une réserve n'existe que pour « Réceptionné avec réserve »…).
        // On CONSERVE la traçabilité contractuelle : page source + détails techniques.
        const next: PrestationVerif = {
          posteId: p.posteId,
          lotLabel: p.lotLabel,
          label: p.label,
          origin: p.origin,
          statut,
          ...(p.sourcePage != null ? { sourcePage: p.sourcePage } : {}),
          ...(p.detailsTechniques ? { detailsTechniques: p.detailsTechniques } : {}),
        };
        if (statut === 'reserve')
          next.reserve = p.reserve ?? { photos: [], commentaire: '', responsable: 'artisan' };
        if (statut === 'non_fait') next.commentaireNonFait = p.commentaireNonFait ?? '';
        if (statut === 'moins_value') next.motifMoinsValue = p.motifMoinsValue ?? '';
        return next;
      }),
    );

  const patchPrestation = (posteId: string, patch: Partial<PrestationVerif>): void => {
    setPrestations((ps) => ps.map((p) => (p.posteId === posteId ? { ...p, ...patch } : p)));
    // Le conducteur saisit dans la carte mise en évidence → on retire l'accent.
    setHighlightId((h) => (h === posteId ? null : h));
  };

  /* --- Raccourci « compléter » : cibler la prestation incomplète et son champ --- */
  // Prestations incomplètes, dans l'ordre du contrat, avec leur champ manquant.
  const incompletsListe = useMemo(
    () =>
      prestations
        .map((p) => ({ p, manque: champManquant(p) }))
        .filter((x): x is { p: PrestationVerif; manque: ChampManquant } => x.manque !== null),
    [prestations],
  );
  const incompletsIds = incompletsListe.map((x) => x.p.posteId);

  // Prestation actuellement ciblée (scroll + focus + mise en évidence).
  const [cibleId, setCibleId] = useState<string | null>(null);
  // Navigation « erreur X sur N » active (déclenchée par le raccourci de synthèse).
  const [navMode, setNavMode] = useState(false);
  // Carte mise en évidence temporairement (accent + message local).
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Liste compacte des incomplets dépliée ?
  const [showAllInc, setShowAllInc] = useState(false);

  /** Saute vers une prestation incomplète : revient à la vérification et la cible. */
  const allerVers = (posteId: string): void => {
    setNavMode(true);
    setCibleId(posteId);
    setStep('verifier');
  };

  /** Navigation Précédent / Suivant entre les prestations incomplètes. */
  const navErreur = (delta: number): void => {
    const ids = incompletsIds;
    if (ids.length === 0) return;
    const i = Math.max(0, ids.indexOf(cibleId ?? ''));
    setCibleId(ids[(i + delta + ids.length) % ids.length] ?? null);
  };

  // Arrivée sur la cible : défiler jusqu'à la carte, ouvrir le champ, y poser le focus.
  useEffect(() => {
    if (step !== 'verifier' || !cibleId) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(`prestation-${cibleId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Le focus est posé APRÈS le défilement (preventScroll : pas de saut brutal).
      (document.getElementById(`champ-${cibleId}`) as HTMLElement | null)?.focus({
        preventScroll: true,
      });
      setHighlightId(cibleId);
    });
    return () => cancelAnimationFrame(raf);
  }, [step, cibleId]);

  // La mise en évidence s'efface toute seule après quelques secondes.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  // Après correction : recalcul immédiat → on propose automatiquement la suivante,
  // ou on sort du mode navigation quand tout est complet.
  useEffect(() => {
    if (!navMode) return;
    const ids = prestations.filter((p) => champManquant(p)).map((p) => p.posteId);
    if (ids.length === 0) {
      setNavMode(false);
      setCibleId(null);
      return;
    }
    setCibleId((cur) => (cur && ids.includes(cur) ? cur : (ids[0] ?? null)));
  }, [prestations, navMode]);

  // La saisie complète, prête à prévisualiser puis à valider. Tant qu'elle n'est
  // pas validée, RIEN n'est créé ni diffusé (le client ne voit rien).
  const data: PrereceptionData = { presents, prestations, commentaireGeneral };

  // VALIDER ET ENVOYER — le seul moment où le document quitte PHÉNIX.
  const validate = async (): Promise<void> => {
    if (busy || !prereceptionComplete(prestations)) return;
    setBusy(true);
    try {
      const { prereceptionId } = await demo.createPrereception(project.id, actor, data);
      setCreatedId(prereceptionId);
      setStep('envoye');
    } finally {
      setBusy(false);
    }
  };

  const synthese = prereceptionSynthese(prestations);
  const incomplets = incompletsListe.length;
  const hasContract = prestations.length > 0;
  const positionCible = Math.max(0, incompletsIds.indexOf(cibleId ?? '')) + 1;

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
              : step === 'valider'
                ? 'Validation avant envoi'
                : 'Envoyé'}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {step === 'verifier' && (
          <>
            {navMode && incompletsIds.length > 1 && (
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-warning bg-warning/10 px-5 py-2.5">
                <span className="text-xs font-medium text-foreground">
                  Élément incomplet {positionCible} sur {incompletsIds.length}
                </span>
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => navErreur(-1)}>
                    <ArrowLeft aria-hidden /> Précédent
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navErreur(1)}>
                    Suivant <ArrowRight aria-hidden />
                  </Button>
                </div>
              </div>
            )}
            <div className="mx-auto max-w-2xl space-y-6 px-5 py-7">
              <EnteteMission
                chantier={project.name}
                adresse={project.address}
                client={clientName}
                conducteur={conducteur}
                reference={reference}
                version={nextVersion}
                dateStr={dateStr}
                heureStr={heureStr}
                presents={presents}
                onPresents={setPresents}
              />

              {!hasContract ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                  {enBrouillon
                    ? 'Le devis doit être analysé et validé avant de lancer la pré-réception. Ouvrez « Vérifier le devis » depuis la Préparation.'
                    : 'Aucune prestation au contrat : ajoutez d’abord le devis signé du chantier pour lancer la pré-réception.'}
                </div>
              ) : (
                <PrestationsListe
                  prestations={prestations}
                  onStatut={setStatut}
                  onPatch={patchPrestation}
                  highlightId={highlightId}
                />
              )}
            </div>
          </>
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

            {incomplets > 0 ? (
              <div className="rounded-xl border border-warning bg-warning/10 p-3">
                <button
                  type="button"
                  onClick={() => allerVers(incompletsListe[0]!.p.posteId)}
                  className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-warning"
                >
                  <ClipboardCheck aria-hidden />
                  {incomplets} prestation{incomplets > 1 ? 's' : ''} à compléter
                  <ArrowRight aria-hidden className="ml-auto" />
                </button>
                {incomplets === 1 && (
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">
                    {courtLabel(incompletsListe[0]!.p.label, 44)} —{' '}
                    {incompletsListe[0]!.manque.label} manquant
                  </p>
                )}
                {incomplets > 1 && (
                  <ul className="mt-2 space-y-0.5">
                    {(showAllInc ? incompletsListe : incompletsListe.slice(0, 3)).map(
                      ({ p, manque }) => (
                        <li key={p.posteId}>
                          <button
                            type="button"
                            onClick={() => allerVers(p.posteId)}
                            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs text-foreground hover:bg-warning/15 [&_svg]:size-3.5 [&_svg]:text-warning"
                          >
                            <ArrowRight aria-hidden />
                            <span className="font-medium">{courtLabel(p.label, 34)}</span>
                            <span className="text-muted-foreground">— {manque.court} manquant</span>
                          </button>
                        </li>
                      ),
                    )}
                    {incompletsListe.length > 3 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setShowAllInc((v) => !v)}
                          className="pl-2 pt-0.5 text-xs font-medium text-gold-700 hover:underline"
                        >
                          {showAllInc
                            ? 'Réduire'
                            : `Voir les ${incompletsListe.length} prestations`}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
                <ShieldCheck aria-hidden />
                Toutes les prestations sont complètes. Les documents peuvent être vérifiés.
              </div>
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

        {step === 'valider' && (
          <ValidationStep
            project={project}
            onPreview={(audience) => demo.previewPrereception(project.id, actor, data, audience)}
          />
        )}

        {step === 'envoye' && (
          <EnvoyeStep createdId={createdId} synthese={synthese} project={project} />
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
                onClick={() => setStep('valider')}
                disabled={incomplets > 0 || !hasContract}
              >
                <ShieldCheck aria-hidden /> Générer les documents
              </Button>
            </>
          )}
          {step === 'valider' && (
            <>
              <Button variant="ghost" onClick={() => setStep('verifier')}>
                <Pencil aria-hidden /> Modifier la Pré-réception
              </Button>
              <Button size="lg" onClick={() => void validate()} disabled={busy || incomplets > 0}>
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                Valider et envoyer
              </Button>
            </>
          )}
          {step === 'envoye' && (
            <>
              <span className="text-xs text-muted-foreground">
                Document validé — diffusé et verrouillé.
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
  chantier,
  adresse,
  client,
  conducteur,
  reference,
  version,
  dateStr,
  heureStr,
  presents,
  onPresents,
}: {
  chantier: string;
  adresse?: string;
  client?: string;
  conducteur: string;
  reference: string;
  version: number;
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
        <Meta label="Chantier" value={chantier} />
        {adresse && <Meta label="Adresse" value={adresse} />}
        {client && <Meta label="Client" value={client} />}
        <Meta label="Conducteur" value={conducteur} />
        <Meta label="Référence" value={reference} />
        {version > 1 && <Meta label="Version" value={`V${version}`} />}
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
  highlightId,
}: {
  prestations: PrestationVerif[];
  onStatut: (posteId: string, statut: PrestationStatut) => void;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
  highlightId: string | null;
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
                <PrestationCard
                  prestation={p}
                  onStatut={onStatut}
                  onPatch={onPatch}
                  highlight={p.posteId === highlightId}
                />
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
  highlight,
}: {
  prestation: PrestationVerif;
  onStatut: (posteId: string, statut: PrestationStatut) => void;
  onPatch: (posteId: string, patch: Partial<PrestationVerif>) => void;
  highlight: boolean;
}): React.JSX.Element {
  const incomplete = !prestationComplete(p);
  const estReserve = p.statut === 'reserve';
  return (
    <div
      id={`prestation-${p.posteId}`}
      className={`scroll-mt-24 rounded-xl border bg-surface p-3.5 transition-shadow ${
        highlight ? 'ring-2 ring-warning ring-offset-2 ring-offset-background' : ''
      } ${
        estReserve
          ? 'border-destructive border-l-4 border-l-destructive bg-destructive/5'
          : incomplete
            ? 'border-warning'
            : 'border-border'
      }`}
    >
      {highlight && incomplete && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-warning/15 px-2 py-1 text-xs font-medium text-warning [&_svg]:size-3.5">
          <ClipboardCheck aria-hidden />
          Champ obligatoire à compléter
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {estReserve && (
          <span aria-hidden className="text-destructive">
            ⚠️
          </span>
        )}
        <span className="text-sm font-medium text-foreground">{p.label}</span>
        {p.origin.kind === 'avenant' && (
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700">
            {originLabel(p.origin)}
          </span>
        )}
      </div>

      {p.detailsTechniques && p.detailsTechniques.length > 0 && (
        <DetailsTechniquesAide details={p.detailsTechniques} />
      )}

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
            id={`champ-${p.posteId}`}
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

/* -------------------- Détails techniques (AIDE AU CONTRÔLE) ---------------- */

/**
 * Repères techniques DÉRIVÉS du devis, affichés sous la prestation en AIDE AU
 * CONTRÔLE (« 18 prises ? », « receveur 800×800 ? »). Ils ne créent JAMAIS de
 * prestation ; toute donnée incertaine est signalée « À vérifier ».
 */
function DetailsTechniquesAide({ details }: { details: DetailTechnique[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const utiles = details.filter(
    (d) => d.type === 'équipement' || d.type === 'matériau' || d.dimensions,
  );
  const affichés = open ? utiles : utiles.slice(0, 4);
  if (utiles.length === 0) return <></>;
  const attr = (d: DetailTechnique): string =>
    [
      d.quantité != null ? `${d.quantité}${d.unité ? ` ${d.unité}` : ''}` : null,
      d.dimensions,
      d.couleur,
      d.marque,
      d.référence,
    ]
      .filter(Boolean)
      .join(' · ');
  return (
    <div className="mt-2 rounded-lg border border-dashed border-border bg-paper-50 px-3 py-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Aide au contrôle — détails techniques du devis
      </p>
      <ul className="space-y-0.5">
        {affichés.map((d, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs text-foreground">
            <span className="text-muted-foreground">•</span>
            <span>{d.libellé}</span>
            {attr(d) && <span className="text-muted-foreground">({attr(d)})</span>}
            {d.niveauConfiance === 'À vérifier' && (
              <span className="rounded-full bg-warning/15 px-1.5 text-[10px] font-medium text-warning">
                À vérifier
              </span>
            )}
          </li>
        ))}
      </ul>
      {utiles.length > 4 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-[11px] font-medium text-gold-700 hover:underline"
        >
          {open ? 'Réduire' : `Voir les ${utiles.length} détails`}
        </button>
      )}
    </div>
  );
}

/* ------------------------- Cas « Réceptionné avec réserve » --------------- */

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
          id={`champ-${p.posteId}`}
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
        id={`champ-${p.posteId}`}
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
  const tiles: { dot: string; n: number; label: string; reserve?: boolean }[] = [
    {
      dot: PRESTATION_STATUT_DOT.fait,
      n: synthese.conformes,
      label: PRERECEPTION_SYNTHESE_LABEL.conformes,
    },
    {
      dot: PRESTATION_STATUT_DOT.reserve,
      n: synthese.avecReserve,
      label: PRERECEPTION_SYNTHESE_LABEL.avecReserve,
      reserve: true,
    },
    {
      dot: PRESTATION_STATUT_DOT.non_fait,
      n: synthese.restantes,
      label: PRERECEPTION_SYNTHESE_LABEL.restantes,
    },
    {
      dot: PRESTATION_STATUT_DOT.moins_value,
      n: synthese.supprimees,
      label: PRERECEPTION_SYNTHESE_LABEL.supprimees,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl border bg-surface p-4 text-center ${
            t.reserve && t.n > 0 ? 'border-destructive bg-destructive/5' : 'border-border'
          }`}
        >
          <div
            className={`text-2xl font-semibold ${
              t.reserve && t.n > 0 ? 'text-destructive' : 'text-foreground'
            }`}
          >
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

/* --------------------- Étape « Validation avant envoi » ------------------- */

/**
 * Aucun document contractuel ne quitte PHÉNIX sans validation humaine (VISION
 * Art. 9). Les deux versions sont préparées en BROUILLON, visibles du seul
 * conducteur : il les prévisualise EXACTEMENT comme le destinataire les recevra,
 * puis décide — Modifier ou Valider et envoyer.
 */
function ValidationStep({
  project,
  onPreview,
}: {
  project: Project;
  onPreview: (audience: 'client' | 'artisan') => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Validation avant envoi
        </h2>
        <p className="text-sm text-muted-foreground">
          Document contractuel : vous gardez le dernier contrôle. Rien n’est transmis tant que vous
          n’avez pas validé.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-warning bg-warning/10 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/20 text-warning [&_svg]:size-5">
          <Lock aria-hidden />
        </span>
        <p className="text-sm text-foreground">
          <span className="font-medium">Brouillon</span> — visible de vous seul. Le client et les
          artisans ne voient rien, aucune notification n’est envoyée.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Prévisualisez chaque version — {project.name}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewCard
            title="Version client"
            description="Prestations, statuts, réserves (photos + commentaire), commentaire général. Aucune donnée interne."
            onPreview={() => onPreview('client')}
          />
          <PreviewCard
            title="Version artisan"
            description="Tout l’opérationnel : responsables, dates de reprise, photos et commentaires."
            onPreview={() => onPreview('artisan')}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Vérifiez photos, commentaires, statuts, prestations, informations affichées et masquées,
          mise en page et qualité générale avant de valider.
        </p>
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  description,
  onPreview,
}: {
  title: string;
  description: string;
  onPreview: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <FileText aria-hidden />
        {title}
        <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
          Brouillon
        </span>
      </div>
      <p className="flex-1 text-xs text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" onClick={onPreview}>
        <Eye aria-hidden /> Prévisualiser
      </Button>
    </div>
  );
}

/* --------------------------- Étape « Envoyé » ----------------------------- */

function EnvoyeStep({
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
            Pré-réception validée et envoyée
          </p>
          <p className="text-sm text-muted-foreground">
            Version client → Espace client (le client est notifié). Version artisan → à transmettre
            aux artisans concernés.
          </p>
        </div>
      </div>

      <SyntheseTiles synthese={synthese} />

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <Lock aria-hidden />
        Document verrouillé et non modifiable. Une correction se fait en créant une nouvelle
        version.
      </div>

      {event && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documents diffusés — {project.name}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DocCard
              title="Version client"
              description="Envoyée à l’Espace client. Prestations, statuts, réserves. Sans donnée interne."
              onOpen={() => (event ? demo.openDocument(event, 'client') : undefined)}
              onDownload={() => (event ? demo.downloadDocument(event, 'client') : undefined)}
            />
            <DocCard
              title="Version artisan"
              description="À transmettre aux artisans. Responsables, dates de reprise, photos et commentaires."
              onOpen={() => (event ? demo.openDocument(event, 'artisan') : undefined)}
              onDownload={() => (event ? demo.downloadDocument(event, 'artisan') : undefined)}
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
          <Eye aria-hidden /> Prévisualiser
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download aria-hidden /> Télécharger en PDF
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
