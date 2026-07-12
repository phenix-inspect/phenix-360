import { useMemo, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  CONFIANCE_LABEL,
  consolidateDevis,
  consolidatedTotals,
  evaluerVerification,
  raisonVerification,
  reconcileTotals,
  type Devis,
  type DevisLot,
  type DevisPoste,
  type GraviteControle,
  type Project,
  type ProjectDossier,
  type VerificationNiveau,
} from '@phenix360/core';
import {
  AlertTriangle,
  Check,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { demo } from '../store';
import { fmtMoney } from '../lib/format';

/**
 * VÉRIFICATION DU DEVIS — validation humaine, LOT PAR LOT (VISION Art. 9).
 * PHÉNIX a analysé le devis ; le conducteur CONTRÔLE chaque lot face au document
 * original, puis le valide indépendamment. Un lot non validé n'alimente jamais
 * une fonctionnalité. Chaque ligne affiche son état de lecture (🟢 vérifié · 🟠 à
 * vérifier · 🔴 non compris) et explique « pourquoi » quand ce n'est pas vert.
 */
export function DevisVerification({
  project,
  dossier,
  onClose,
}: {
  project: Project;
  dossier: ProjectDossier;
  onClose: () => void;
}): React.JSX.Element {
  const [lots, setLots] = useState<DevisLot[]>(() => structuredClone(dossier.devis?.lots ?? []));
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null); // posteId dont on montre le « pourquoi »

  const devis: Devis = useMemo(() => ({ ...dossier.devis, lots }), [lots, dossier.devis]);
  const reconciliation = useMemo(
    () =>
      reconcileTotals(
        devis,
        dossier.reconciliation?.totalHTDeclare,
        dossier.reconciliation?.totalTTCDeclare,
      ),
    [devis, dossier.reconciliation],
  );
  const totals = useMemo(() => consolidatedTotals(consolidateDevis(devis, [])), [devis]);
  const compte = { valides: lots.filter((l) => l.statut === 'valide').length, total: lots.length };

  const originalDoc = useMemo(
    () =>
      demo
        .getSnapshot()
        .events.find(
          (e) =>
            e.projectId === project.id &&
            e.type === 'document' &&
            /devis/i.test(e.content.libelle ?? '') &&
            Boolean(e.content.attachment?.dataUrl),
        ),
    [project.id],
  );

  const patchPoste = (lotIdx: number, posteIdx: number, patch: Partial<DevisPoste>): void =>
    setLots((prev) =>
      prev.map((l, i) =>
        i !== lotIdx
          ? l
          : {
              ...l,
              postes: l.postes.map((p, j) => (j !== posteIdx ? p : { ...p, ...patch })),
            },
      ),
    );

  const removePoste = (lotIdx: number, posteIdx: number): void =>
    setLots((prev) =>
      prev.map((l, i) =>
        i !== lotIdx ? l : { ...l, postes: l.postes.filter((_, j) => j !== posteIdx) },
      ),
    );

  const addPoste = (lotIdx: number): void =>
    setLots((prev) =>
      prev.map((l, i) =>
        i !== lotIdx
          ? l
          : {
              ...l,
              postes: [
                ...l.postes,
                {
                  id: `p-add-${crypto.randomUUID().slice(0, 8)}`,
                  label: '',
                  montantHT: 0,
                  tva: 10,
                },
              ],
            },
      ),
    );

  const lotHasNonCompris = (lot: DevisLot): boolean =>
    lot.postes.some((p) => evaluerVerification(p) === 'non_compris');

  const persist = (next: DevisLot[]): void =>
    demo.saveDevisAnalyse(project.id, { ...devis, lots: next });

  const validateLot = (lotId: string): void => {
    if (busy) return;
    setBusy(true);
    try {
      const next = lots.map((l) => (l.id === lotId ? { ...l, statut: 'valide' as const } : l));
      setLots(next);
      persist(next);
      demo.validateLot(project.id, lotId);
    } finally {
      setBusy(false);
    }
  };

  const validateAll = (): void => {
    if (busy || lots.some(lotHasNonCompris)) return;
    setBusy(true);
    try {
      const next = lots.map((l) => ({ ...l, statut: 'valide' as const }));
      setLots(next);
      persist(next);
      demo.validateAllLots(project.id);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = (): void => {
    persist(lots);
    onClose();
  };

  const restants = compte.total - compte.valides;
  const canValidateAll = restants > 0 && !lots.some(lotHasNonCompris);

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
        <p className="font-serif text-lg font-semibold text-foreground">Vérification du devis</p>
        <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
          {compte.valides}/{compte.total} lots validés
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-5 py-7">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Vérifiez votre devis, lot par lot
            </h2>
            <p className="text-sm text-muted-foreground">
              PHÉNIX a analysé votre devis. Contrôlez chaque lot face à l’original et validez-le :
              un lot validé devient exploitable, les autres restent en attente.
            </p>
          </div>

          {/* Document original — la source officielle, jamais modifiée. */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <FileText aria-hidden className="size-5 shrink-0 text-gold-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Document original</p>
              <p className="text-xs text-muted-foreground">
                {originalDoc
                  ? 'Archivé tel quel — la source officielle, à comparer à l’analyse.'
                  : 'Aucun fichier original archivé pour ce chantier (devis saisi en texte).'}
              </p>
            </div>
            {originalDoc && (
              <Button size="sm" variant="outline" onClick={() => demo.openDocument(originalDoc)}>
                <FileText aria-hidden /> Ouvrir l’original
              </Button>
            )}
          </div>

          {/* Vérification des totaux. */}
          <div
            className={`rounded-2xl border p-4 ${
              reconciliation.coherent
                ? 'border-gold-200 bg-gold-50'
                : 'border-warning bg-warning/10'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4">
              {reconciliation.coherent ? (
                <Check aria-hidden className="text-gold-700" />
              ) : (
                <AlertTriangle aria-hidden className="text-warning" />
              )}
              Vérification des totaux
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <Row label="Somme des lignes (HT)" value={fmtMoney(reconciliation.sommeLignesHT)} />
              {reconciliation.totalHTDeclare != null && (
                <Row label="Total HT déclaré" value={fmtMoney(reconciliation.totalHTDeclare)} />
              )}
              <Row label="TTC (devis)" value={fmtMoney(totals.ttc)} />
            </dl>
            {!reconciliation.coherent && (
              <p className="mt-3 text-sm text-foreground">
                Écart de {fmtMoney(reconciliation.ecartHT ?? 0)} entre la somme des lignes et le
                total déclaré. Contrôlez les lignes concernées avant de valider.
              </p>
            )}
          </div>

          {/* Contrôles de cohérence du moteur (montants, comptage, options…). */}
          {dossier.analyse && dossier.analyse.controles.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">Contrôles de cohérence</p>
              <ul className="space-y-1.5">
                {dossier.analyse.controles.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <ControleDot gravite={c.gravite} />
                    <span className="text-foreground">
                      <span className="font-medium">{c.libelle} — </span>
                      <span className="text-muted-foreground">{c.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Exclusions / notes écartées du contrat (jamais des prestations). */}
          {dossier.analyse && dossier.analyse.exclusions.length > 0 && (
            <div className="space-y-1.5 rounded-2xl border border-border bg-paper-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4">
                <AlertTriangle aria-hidden className="text-warning" />
                {dossier.analyse.exclusions.length} exclusion(s) écartée(s) du contrat
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {dossier.analyse.exclusions.map((ex, i) => (
                  <li key={i}>
                    « {ex.texte} » <span className="opacity-70">— p. {ex.page}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Ces mentions ne sont pas des prestations : elles ne comptent ni au budget ni à la
                pré-réception.
              </p>
            </div>
          )}

          {/* Lots — validation indépendante. */}
          <div className="space-y-5">
            {lots.map((lot, li) => {
              const valide = lot.statut === 'valide';
              const bloque = lotHasNonCompris(lot);
              return (
                <section key={lot.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {lot.label || 'Lot sans titre'}
                    </h3>
                    <LotChip valide={valide} />
                    <div className="ml-auto">
                      {valide ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success [&_svg]:size-4">
                          <Check aria-hidden /> Lot validé
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => validateLot(lot.id)}
                          disabled={busy || bloque}
                          title={
                            bloque
                              ? 'Complétez les lignes « non comprises » avant de valider ce lot'
                              : undefined
                          }
                        >
                          <Check aria-hidden /> Valider ce lot
                        </Button>
                      )}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {lot.postes.map((p, pi) => {
                      const niveau = evaluerVerification(p);
                      return (
                        <li key={p.id} className="space-y-2 rounded-xl border border-border p-3">
                          <div className="flex items-start gap-2">
                            <input
                              value={p.label}
                              onChange={(e) => patchPoste(li, pi, { label: e.target.value })}
                              placeholder="Libellé de la prestation…"
                              className="flex-1 rounded-lg border border-input bg-paper-50 px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
                            />
                            <VerifBadge level={niveau} />
                            <button
                              type="button"
                              onClick={() => removePoste(li, pi)}
                              aria-label="Supprimer la ligne"
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-paper-50 hover:text-foreground [&_svg]:size-4"
                            >
                              <Trash2 aria-hidden />
                            </button>
                          </div>
                          {/* Traçabilité : libellé court opérationnel + page source. */}
                          {(p.libelleCourt || p.sourcePage != null || p.option) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {p.libelleCourt && p.libelleCourt !== p.label && (
                                <span className="rounded bg-paper-50 px-1.5 py-0.5">
                                  Libellé court : {p.libelleCourt}
                                </span>
                              )}
                              {p.sourcePage != null && (
                                <span className="inline-flex items-center gap-1 [&_svg]:size-3">
                                  <FileText aria-hidden /> p. {p.sourcePage}
                                </span>
                              )}
                              {p.option && (
                                <span className="rounded-full bg-gold-100 px-2 py-0.5 font-medium text-gold-700">
                                  Option — à valider
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <NumField
                              label="Qté"
                              value={p.quantite}
                              onChange={(v) => patchPoste(li, pi, { quantite: v })}
                            />
                            <TextField
                              label="Unité"
                              value={p.unite}
                              onChange={(v) => patchPoste(li, pi, { unite: v })}
                            />
                            <NumField
                              label="PU HT"
                              value={p.prixUnitaireHT}
                              onChange={(v) => patchPoste(li, pi, { prixUnitaireHT: v })}
                            />
                            <NumField
                              label="Montant HT"
                              value={p.montantHT}
                              onChange={(v) => patchPoste(li, pi, { montantHT: v ?? 0 })}
                            />
                            <NumField
                              label="TVA %"
                              value={p.tva}
                              onChange={(v) => patchPoste(li, pi, { tva: v ?? 0 })}
                            />
                            {niveau !== 'verifie' && (
                              <button
                                type="button"
                                onClick={() => setWhy(why === p.id ? null : p.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
                              >
                                <HelpCircle aria-hidden /> Voir pourquoi
                              </button>
                            )}
                          </div>
                          {why === p.id && niveau !== 'verifie' && (
                            <div className="rounded-lg border border-warning bg-warning/10 p-3 text-xs text-foreground">
                              <p className="font-medium">{raisonVerification(p)}</p>
                              {p.sourceText && (
                                <p className="mt-1 text-muted-foreground">
                                  Extrait analysé : « {p.sourceText} »
                                </p>
                              )}
                              {originalDoc && (
                                <button
                                  type="button"
                                  onClick={() => demo.openDocument(originalDoc)}
                                  className="mt-2 inline-flex items-center gap-1 font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
                                >
                                  <FileText aria-hidden /> Ouvrir le document original
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {!valide && (
                    <button
                      type="button"
                      onClick={() => addPoste(li)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
                    >
                      <Plus aria-hidden /> Ajouter une prestation oubliée
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="border-t border-border px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={saveDraft}>
            Enregistrer et fermer
          </Button>
          <Button size="lg" onClick={validateAll} disabled={busy || !canValidateAll}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Lock aria-hidden />}
            Tout valider
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

const VERIF_DOT: Record<VerificationNiveau, string> = {
  verifie: '🟢',
  a_verifier: '🟠',
  non_compris: '🔴',
};
const VERIF_STYLE: Record<VerificationNiveau, string> = {
  verifie: 'bg-success/15 text-success',
  a_verifier: 'bg-warning/15 text-warning',
  non_compris: 'bg-destructive/15 text-destructive',
};

function VerifBadge({ level }: { level: VerificationNiveau }): React.JSX.Element {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${VERIF_STYLE[level]}`}
    >
      <span aria-hidden>{VERIF_DOT[level]}</span>
      {CONFIANCE_LABEL[level]}
    </span>
  );
}

const CONTROLE_DOT: Record<GraviteControle, string> = {
  ok: '🟢',
  info: '🔵',
  attention: '🟠',
  bloquant: '🔴',
};

function ControleDot({ gravite }: { gravite: GraviteControle }): React.JSX.Element {
  return (
    <span aria-hidden className="mt-0.5 text-[11px]">
      {CONTROLE_DOT[gravite]}
    </span>
  );
}

function LotChip({ valide }: { valide: boolean }): React.JSX.Element {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        valide ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
      }`}
    >
      {valide ? 'Validé' : 'À vérifier'}
    </span>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="h-8 w-24 rounded-lg border border-input bg-paper-50 px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8 w-20 rounded-lg border border-input bg-paper-50 px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
    </label>
  );
}
