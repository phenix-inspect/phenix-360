import { useMemo, useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  CONFIDENCE_LABEL,
  consolidateDevis,
  consolidatedTotals,
  reconcileTotals,
  type ConfidenceLevel,
  type Devis,
  type DevisPoste,
  type Project,
  type ProjectDossier,
} from '@phenix360/core';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { demo } from '../store';
import { fmtMoney } from '../lib/format';

/**
 * VÉRIFIER LA TRANSCRIPTION DU DEVIS — étape de validation humaine (VISION Art. 9).
 * PHÉNIX a transcrit le devis en lots/postes ; le conducteur CONTRÔLE face au
 * document original avant que le contrat ne devienne exploitable. Rien n'est
 * contractuel tant qu'il n'a pas validé : la transcription reste en brouillon.
 * Une mauvaise transcription est plus dangereuse qu'une absence de transcription
 * — l'écran met en évidence les lignes incertaines et bloque une validation
 * aveugle quand les totaux ne se réconcilient pas.
 */
export function ContractReview({
  project,
  dossier,
  onClose,
}: {
  project: Project;
  dossier: ProjectDossier;
  onClose: () => void;
}): React.JSX.Element {
  const [lots, setLots] = useState(() => structuredClone(dossier.devis?.lots ?? []));
  const [busy, setBusy] = useState(false);
  const [ackEcart, setAckEcart] = useState(false);

  const devis: Devis = useMemo(() => ({ lots }), [lots]);
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

  // Le document ORIGINAL archivé (source officielle), s'il est ouvrable.
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

  const nbPostes = lots.reduce((n, l) => n + l.postes.length, 0);
  const incoherent = !reconciliation.coherent;
  const canValidate = nbPostes > 0 && (!incoherent || ackEcart);

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

  const saveDraft = (): void => {
    demo.saveContractTranscription(project.id, devis);
    onClose();
  };

  const validate = (): void => {
    if (!canValidate || busy) return;
    setBusy(true);
    try {
      demo.saveContractTranscription(project.id, devis);
      demo.validateContract(project.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

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
        <p className="font-serif text-lg font-semibold text-foreground">
          Vérifier la transcription du devis
        </p>
        <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
          Brouillon
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-5 py-7">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Contrôlez le contrat face à votre devis
            </h2>
            <p className="text-sm text-muted-foreground">
              PHÉNIX a transcrit votre devis. Corrigez ce qui doit l’être : rien n’est contractuel
              tant que vous n’avez pas validé.
            </p>
          </div>

          {/* Document original — la source officielle, jamais modifiée. */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <FileText aria-hidden className="size-5 shrink-0 text-gold-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Document original</p>
              <p className="text-xs text-muted-foreground">
                {originalDoc
                  ? 'Archivé tel quel — la source officielle, à comparer à la transcription.'
                  : 'Aucun fichier original archivé pour ce chantier (devis saisi en texte).'}
              </p>
            </div>
            {originalDoc && (
              <Button size="sm" variant="outline" onClick={() => demo.openDocument(originalDoc)}>
                <FileText aria-hidden /> Ouvrir l’original
              </Button>
            )}
          </div>

          {/* Réconciliation des totaux. */}
          <div
            className={`rounded-2xl border p-4 ${
              incoherent ? 'border-warning bg-warning/10' : 'border-gold-200 bg-gold-50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4">
              {incoherent ? (
                <AlertTriangle aria-hidden className="text-warning" />
              ) : (
                <Check aria-hidden className="text-gold-700" />
              )}
              Réconciliation des totaux
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <Row label="Somme des lignes (HT)" value={fmtMoney(reconciliation.sommeLignesHT)} />
              {reconciliation.totalHTDeclare != null && (
                <Row label="Total HT déclaré" value={fmtMoney(reconciliation.totalHTDeclare)} />
              )}
              <Row label="TTC (transcription)" value={fmtMoney(totals.ttc)} />
            </dl>
            {incoherent && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-foreground">
                  Écart de {fmtMoney(reconciliation.ecartHT ?? 0)} entre la somme des lignes et le
                  total déclaré. Corrigez la transcription, ou confirmez que vous avez vérifié.
                </p>
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={ackEcart}
                    onChange={(e) => setAckEcart(e.target.checked)}
                    className="size-4 accent-gold-600"
                  />
                  J’ai vérifié l’écart face au document original.
                </label>
              </div>
            )}
          </div>

          {/* Prestations transcrites — éditables, avec confiance. */}
          <div className="space-y-5">
            {lots.map((lot, li) => (
              <section key={lot.id} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-700">
                  {lot.label || 'Lot sans titre'}
                </h3>
                <ul className="space-y-2">
                  {lot.postes.map((p, pi) => (
                    <li
                      key={p.id}
                      className="space-y-2 rounded-xl border border-border bg-surface p-3"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          value={p.label}
                          onChange={(e) => patchPoste(li, pi, { label: e.target.value })}
                          placeholder="Libellé de la prestation…"
                          className="flex-1 rounded-lg border border-input bg-paper-50 px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
                        />
                        {p.confidence && <ConfidenceBadge level={p.confidence} />}
                        <button
                          type="button"
                          onClick={() => removePoste(li, pi)}
                          aria-label="Supprimer la ligne"
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-paper-50 hover:text-foreground [&_svg]:size-4"
                        >
                          <Trash2 aria-hidden />
                        </button>
                      </div>
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
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addPoste(li)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline [&_svg]:size-3.5"
                >
                  <Plus aria-hidden /> Ajouter une prestation oubliée
                </button>
              </section>
            ))}
          </div>
        </div>
      </div>

      <footer className="border-t border-border px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={saveDraft}>
            Enregistrer le brouillon
          </Button>
          <Button size="lg" onClick={validate} disabled={!canValidate || busy}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
            Valider la transcription
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

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  eleve: 'bg-success/15 text-success',
  moyen: 'bg-warning/15 text-warning',
  faible: 'bg-destructive/15 text-destructive',
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }): React.JSX.Element {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLE[level]}`}
    >
      {CONFIDENCE_LABEL[level]}
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
