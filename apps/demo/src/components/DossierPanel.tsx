import { useRef, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@phenix360/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  buildClientDecisions,
  avenantImpact,
  consolidateDevis,
  devisAVerifier,
  devisAvecLotsExploitables,
  lotsValidesCount,
  validatedDevis,
  type Avenant,
  type AvenantImpact,
  type ClientDecisionStatus,
  type Devis,
  type DevisLot,
  type DevisPoste,
  type EventActor,
  type EventAttachment,
  type Order,
  type OrderStatus,
  type Project,
  type ProjectDossier,
  type ProjectId,
} from '@phenix360/core';
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import { demo, useDemo } from '../store';
import { fmtDate, fmtDateShort, fmtMoney } from '../lib/format';
import { openAttachment } from '../lib/document';
import { readDocumentAttachment, MAX_DOC_MB } from '../lib/upload';
import { ACCEPT_DOCUMENT } from '../lib/media';
import { LeaveConfirmInline } from './mission/LeaveGuard';
import { ContactPicker } from './contacts/ContactPicker';
import { DevisVerification } from './DevisVerification';
import { DevisBreakdown } from './DevisBreakdown';
import { PreparationCockpit } from './PreparationCockpit';
import { SmartPlanningView } from './SmartPlanningView';
import { CoordonneesCard } from './prep/CoordonneesCard';
import { PhotosAvantSection } from './prep/PrepDocuments';
import { AssistantChantier } from './AssistantChantier';

/** Vue « Préparation » : tout ce que PHÉNIX a préparé pour le chantier. */
export function DossierPanel({
  project,
  dossier,
  actor,
}: {
  project: Project;
  dossier: ProjectDossier;
  actor: EventActor;
}): React.JSX.Element {
  const [editing, setEditing] = useState<Order | null>(null);
  // Avenant fraîchement VALIDÉ → PHÉNIX affiche sa mini-note d'intégration.
  const [integratedNumero, setIntegratedNumero] = useState<number | null>(null);
  // Dialogue « Déposer un avenant signé » (dépôt + saisie des postes réels).
  const [depositing, setDepositing] = useState(false);
  // Le détail du devis (poste par poste) est une RÉFÉRENCE, consultée rarement en
  // semaine : replié par défaut pour ne pas alourdir la lecture (règle des 5 s).
  const [showDevis, setShowDevis] = useState(false);
  // Écran « Vérification du devis » (validation humaine, lot par lot).
  const [reviewContract, setReviewContract] = useState(false);

  const patch = (next: Partial<ProjectDossier>) =>
    demo.saveDossier(project.id, { ...dossier, ...next });

  const setOrderStatus = (id: string, statut: OrderStatus) =>
    patch({ orders: dossier.orders.map((o) => (o.id === id ? { ...o, statut } : o)) });

  const saveOrder = (updated: Order) => {
    patch({ orders: dossier.orders.map((o) => (o.id === updated.id ? updated : o)) });
    setEditing(null);
  };

  const addOrder = () => {
    const o: Order = { id: crypto.randomUUID(), label: 'Nouvelle commande', statut: 'a_commander' };
    patch({ orders: [...dossier.orders, o] });
    setEditing(o);
  };

  // Avenants en attente de validation (déposés, PAS ENCORE intégrés au contrat).
  const brouillons = dossier.avenantsBrouillon ?? [];
  // Verrou d'intégration d'avenant (anti double-clic, synchrone).
  const validatingRef = useRef(false);

  // Enregistrer un avenant DÉPOSÉ en BROUILLON. PHÉNIX ne fabrique rien et
  // n'intègre rien : le brouillon reste à l'écart du contrat (il ne nourrit ni
  // Léon, ni la Préparation, ni la Pré-réception, ni le budget) jusqu'à validation.
  const saveBrouillon = (avenant: Avenant): void => {
    patch({ avenantsBrouillon: [...brouillons, avenant] });
    setDepositing(false);
  };

  const deleteBrouillon = (id: string): void => {
    patch({ avenantsBrouillon: brouillons.filter((a) => a.id !== id) });
  };

  // VALIDATION HUMAINE : le conducteur a relu les impacts proposés et confirme
  // l'intégration. L'avenant reçoit alors son numéro DÉFINITIF, quitte le brouillon
  // et rejoint `avenants` (source unique du contrat consolidé). On trace au journal
  // interne. Append-only : rien n'est réécrit, le devis initial reste intact.
  const validateAvenant = async (brouillon: Avenant): Promise<void> => {
    // Verrou SYNCHRONE anti double-clic : sans lui, un second clic rapide
    // réintègre l'avenant (même numéro) avant le re-rendu → doublon au contrat.
    if (validatingRef.current || !dossier.devis) return;
    validatingRef.current = true;
    const validated = dossier.avenants ?? [];
    const numero = validated.length + 1;
    const finalAvenant: Avenant = {
      ...brouillon,
      numero,
      reference:
        brouillon.reference ?? `AV-${new Date().getFullYear()}-${String(numero).padStart(2, '0')}`,
    };
    patch({
      avenants: [...validated, finalAvenant],
      avenantsBrouillon: brouillons.filter((a) => a.id !== brouillon.id),
    });
    setIntegratedNumero(numero);

    const impact = avenantImpact(dossier.devis, validated, finalAvenant);
    const sign = impact.deltaHT >= 0 ? '+' : '−';
    const lines = [
      `Avenant n°${numero} validé et intégré au contrat (le devis initial reste intact).`,
      `• ${impact.postesRemplaces} poste(s) remplacé(s), ${impact.postesAjoutes} poste(s) ajouté(s).`,
      `• Budget : ${sign}${fmtMoney(Math.abs(impact.deltaHT))} HT.`,
      impact.commandesAMettreAJour > 0
        ? `• ${impact.commandesAMettreAJour} commande(s) à mettre à jour.`
        : null,
      impact.choixAObtenir > 0 ? `• ${impact.choixAObtenir} choix client à obtenir.` : null,
      impact.documentsNecessaires > 0
        ? `• ${impact.documentsNecessaires} document(s) nécessaire(s).`
        : null,
      impact.vigilances > 0 ? `• ${impact.vigilances} vigilance(s) à lever.` : null,
      impact.impactPlanning ? '• Impact planning à vérifier.' : null,
    ].filter(Boolean);

    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'compte_rendu',
      visibility: 'interne',
      state: 'publie',
      content: { texte: lines.join('\n') },
    });
    validatingRef.current = false;
  };

  const stepLabels = (ids?: string[]): string[] =>
    (ids ?? []).map((id) => dossier.roadmap.find((s) => s.id === id)?.label ?? id);

  // Depuis un poste de devis : on amène le conducteur jusqu'à ce que PHÉNIX a
  // préparé (commande, choix, document, vigilance), avec un bref surlignage.
  const openAnchor = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-gold-400', 'ring-offset-2');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-gold-400', 'ring-offset-2'), 1600);
  };

  const integrated =
    integratedNumero != null
      ? (dossier.avenants ?? []).find((a) => a.numero === integratedNumero)
      : undefined;

  return (
    <div className="space-y-6">
      <PreparationCockpit dossier={dossier} patch={patch} />

      <CoordonneesCard project={project} dossier={dossier} patch={patch} />

      {/* Lots à vérifier : rien n'est contractuel tant que le conducteur n'a pas
          vérifié et validé chaque lot face à l'original. Bannière de progression. */}
      {devisAVerifier(dossier) && (
        <ContractDraftBanner
          valides={lotsValidesCount(dossier).valides}
          total={lotsValidesCount(dossier).total}
          reconciliationCoherent={dossier.reconciliation?.coherent ?? true}
          onReview={() => setReviewContract(true)}
        />
      )}

      {/* « Le devis » n'affiche QUE les lots validés (exploitables). */}
      {devisAvecLotsExploitables(dossier) && dossier.devis && (
        <Section
          icon={<Receipt aria-hidden />}
          title="Le devis"
          count={consolidateDevis(validatedDevis(dossier), dossier.avenants).lots.length}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setDepositing(true)}>
                <Plus aria-hidden /> Déposer un avenant signé
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDevis((v) => !v)}
                aria-expanded={showDevis}
              >
                {showDevis ? 'Masquer' : 'Voir le devis'}
                <ChevronDown className={showDevis ? 'rotate-180' : undefined} aria-hidden />
              </Button>
            </div>
          }
        >
          {integrated && (
            <AvenantIntegrationNote
              impact={avenantImpact(
                dossier.devis,
                (dossier.avenants ?? []).filter((a) => a.numero < integrated.numero),
                integrated,
              )}
              onClose={() => setIntegratedNumero(null)}
            />
          )}
          {brouillons.length > 0 && dossier.devis && (
            <div className="mb-3 space-y-3">
              {brouillons.map((b) => (
                <AvenantBrouillonCard
                  key={b.id}
                  brouillon={b}
                  impact={avenantImpact(dossier.devis!, dossier.avenants ?? [], b)}
                  onValidate={() => void validateAvenant(b)}
                  onDelete={() => deleteBrouillon(b.id)}
                />
              ))}
            </div>
          )}
          {showDevis && (
            <DevisBreakdown
              devis={validatedDevis(dossier) ?? dossier.devis}
              avenants={dossier.avenants}
              dossier={dossier}
              onOpen={openAnchor}
            />
          )}
        </Section>
      )}

      {dossier.roadmap.length > 0 && (
        <Section icon={<CalendarDays aria-hidden />} title="Planning prévisionnel">
          <SmartPlanningView
            dossier={dossier}
            onSetStartDate={(date) =>
              patch({ infos: { ...dossier.infos, startDate: date ?? undefined } })
            }
          />
        </Section>
      )}

      <Section
        icon={<Banknote aria-hidden />}
        title="Commandes"
        count={dossier.orders.length}
        action={
          <Button size="sm" variant="outline" onClick={addOrder}>
            <Plus aria-hidden /> Ajouter une commande
          </Button>
        }
      >
        {dossier.orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
            Aucune commande. Ajoutez les achats à anticiper (cuisine, carrelage, menuiseries…).
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dossier.orders.map((o) => (
              <div key={o.id} id={`order-${o.id}`} className="rounded-xl">
                <OrderCard
                  order={o}
                  steps={stepLabels(o.stepIds)}
                  onStatus={(s) => setOrderStatus(o.id, s)}
                  onEdit={() => setEditing(o)}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      <DecisionsSection dossier={dossier} />

      {/* La section « Propositions préparées par PHÉNIX » (interaction client directe) a
          été retirée (09/07/2026). L'Assistant Chantier ci-dessous est un copilote
          INTERNE en lecture seule : il PRÉPARE des brouillons (matériel, commandes,
          choix, check-list, vigilances, documents, photos) mais n'envoie rien — les
          actions passent par les points d'entrée officiels après validation. */}
      <AssistantChantier dossier={dossier} />

      <PhotosAvantSection project={project} dossier={dossier} patch={patch} />

      {editing && (
        <OrderEditor
          order={editing}
          projectId={project.id}
          roadmap={dossier.roadmap}
          onSave={saveOrder}
          onClose={() => setEditing(null)}
        />
      )}

      {reviewContract && (
        <DevisVerification
          project={project}
          dossier={dossier}
          onClose={() => setReviewContract(false)}
        />
      )}

      {depositing && dossier.devis && (
        <AvenantDepositDialog
          projectId={project.id}
          devis={dossier.devis}
          validatedAvenants={dossier.avenants ?? []}
          onSave={saveBrouillon}
          onClose={() => setDepositing(false)}
        />
      )}
    </div>
  );
}

/**
 * Bannière « devis à vérifier » : PHÉNIX a analysé le devis mais des lots restent
 * à valider. Tant qu'un lot n'est pas validé, ses prestations ne sont présentées
 * nulle part comme contractuelles. La bannière indique la progression
 * (« X lots sur Y validés ») et ouvre l'écran de vérification.
 */
function ContractDraftBanner({
  valides,
  total,
  reconciliationCoherent,
  onReview,
}: {
  valides: number;
  total: number;
  reconciliationCoherent: boolean;
  onReview: () => void;
}): React.JSX.Element {
  const partiel = valides > 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning bg-warning/10 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning/20 text-warning [&_svg]:size-5">
        {reconciliationCoherent ? <ClipboardCheck aria-hidden /> : <AlertTriangle aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {partiel
            ? `${valides} lot${valides > 1 ? 's' : ''} sur ${total} validé${valides > 1 ? 's' : ''} — les autres restent à vérifier.`
            : 'Le devis doit être analysé et validé avant d’afficher les prestations du chantier.'}
        </p>
        <p className="text-xs text-muted-foreground">
          {reconciliationCoherent
            ? 'PHÉNIX a analysé votre devis. Vérifiez chaque lot face à l’original, puis validez-le.'
            : 'Les totaux analysés ne se réconcilient pas — un contrôle est nécessaire avant validation.'}
        </p>
      </div>
      <Button size="sm" onClick={onReview}>
        <ClipboardCheck aria-hidden /> Vérifier le devis
      </Button>
    </div>
  );
}

function OrderCard({
  order,
  steps,
  onStatus,
  onEdit,
}: {
  order: Order;
  steps: string[];
  onStatus: (s: OrderStatus) => void;
  onEdit: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{order.label}</p>
        {order.montant != null && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {fmtMoney(order.montant)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {order.fournisseur ?? 'Fournisseur à définir'}
        {order.reference ? ` · réf. ${order.reference}` : ''}
        {order.quantite != null ? ` · ×${order.quantite}` : ''}
      </p>
      {(order.dateLivraisonReelle || order.dateLivraisonEstimee) && (
        <p className="text-xs text-muted-foreground">
          {order.dateLivraisonReelle
            ? `Livrée le ${fmtDateShort(order.dateLivraisonReelle)}`
            : `Livraison estimée ${fmtDateShort(order.dateLivraisonEstimee!)}`}
          {order.garantie ? ` · Garantie ${order.garantie}` : ''}
        </p>
      )}
      {steps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {steps.map((s) => (
            <span
              key={s}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <select
          value={order.statut}
          onChange={(e) => onStatus(e.target.value as OrderStatus)}
          className="h-8 flex-1 rounded-md border border-input bg-surface px-2 text-xs text-foreground"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden /> Détails
        </Button>
      </div>
    </div>
  );
}

function OrderEditor({
  order,
  projectId,
  roadmap,
  onSave,
  onClose,
}: {
  order: Order;
  projectId: ProjectId;
  roadmap: ProjectDossier['roadmap'];
  onSave: (order: Order) => void;
  onClose: () => void;
}): React.JSX.Element {
  const snap = useDemo();
  const [o, setO] = useState<Order>(order);
  const set = <K extends keyof Order>(key: K, value: Order[K]) =>
    setO((p) => ({ ...p, [key]: value }));
  const num = (v: string): number | undefined => (v ? Number(v) : undefined);
  const toggleStep = (id: string) =>
    set(
      'stepIds',
      (o.stepIds ?? []).includes(id)
        ? (o.stepIds ?? []).filter((x) => x !== id)
        : [...(o.stepIds ?? []), id],
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{o.label || 'Commande'}</DialogTitle>
          <DialogDescription>
            Fiche commande — toutes les informations sont modifiables.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Désignation" full>
            <Input value={o.label} onChange={(e) => set('label', e.target.value)} />
          </F>
          <F label="Fournisseur">
            <ContactPicker
              projectId={projectId}
              role="fournisseur"
              value={o.fournisseurContactId}
              onChange={(id) => {
                const c = id ? snap.contacts.find((x) => x.id === id) : undefined;
                setO((p) => ({
                  ...p,
                  fournisseurContactId: id,
                  ...(c ? { fournisseur: c.nom } : {}),
                }));
              }}
              label="Fournisseur"
              placeholder="Fournisseur (un contact)…"
            />
          </F>
          <F label="Référence">
            <Input value={o.reference ?? ''} onChange={(e) => set('reference', e.target.value)} />
          </F>
          <F label="Quantité">
            <Input
              type="number"
              value={o.quantite ?? ''}
              onChange={(e) => set('quantite', num(e.target.value))}
            />
          </F>
          <F label="Montant (€)">
            <Input
              type="number"
              value={o.montant ?? ''}
              onChange={(e) => set('montant', num(e.target.value))}
            />
          </F>
          <F label="Statut">
            <select
              value={o.statut}
              onChange={(e) => set('statut', e.target.value as OrderStatus)}
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </F>
          <F label="Délai annoncé (jours)">
            <Input
              type="number"
              value={o.delaiJours ?? ''}
              onChange={(e) => set('delaiJours', num(e.target.value))}
            />
          </F>
          <F label="Numéro de suivi">
            <Input
              value={o.numeroSuivi ?? ''}
              onChange={(e) => set('numeroSuivi', e.target.value)}
            />
          </F>
          <F label="Date de commande">
            <Input
              type="date"
              value={o.dateCommande ?? ''}
              onChange={(e) => set('dateCommande', e.target.value || undefined)}
            />
          </F>
          <F label="Livraison estimée">
            <Input
              type="date"
              value={o.dateLivraisonEstimee ?? ''}
              onChange={(e) => set('dateLivraisonEstimee', e.target.value || undefined)}
            />
          </F>
          <F label="Livraison réelle">
            <Input
              type="date"
              value={o.dateLivraisonReelle ?? ''}
              onChange={(e) => set('dateLivraisonReelle', e.target.value || undefined)}
            />
          </F>
          <F label="Garantie">
            <Input value={o.garantie ?? ''} onChange={(e) => set('garantie', e.target.value)} />
          </F>
          <F label="Devis fournisseur">
            <Input
              value={o.devisFournisseur ?? ''}
              onChange={(e) => set('devisFournisseur', e.target.value)}
              placeholder="lien ou fichier"
            />
          </F>
          <F label="Bon de commande">
            <Input
              value={o.bonCommande ?? ''}
              onChange={(e) => set('bonCommande', e.target.value)}
              placeholder="lien ou fichier"
            />
          </F>
          <F label="Facture">
            <Input
              value={o.facture ?? ''}
              onChange={(e) => set('facture', e.target.value)}
              placeholder="lien ou fichier"
            />
          </F>
          <F label="Notice">
            <Input
              value={o.notice ?? ''}
              onChange={(e) => set('notice', e.target.value)}
              placeholder="lien ou fichier"
            />
          </F>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm text-muted-foreground">Étapes servies par cette commande</span>
          <div className="flex flex-wrap gap-2">
            {roadmap.map((step) => {
              const on = (o.stepIds ?? []).includes(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors duration-base ${
                    on
                      ? 'border-primary bg-gold-100 text-gold-800'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSave(o)}>Enregistrer la commande</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DECISION_BADGE: Record<
  ClientDecisionStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }
> = {
  obtenu: { label: 'Obtenue', variant: 'success' },
  a_obtenir: { label: 'À obtenir', variant: 'neutral' },
  proche: { label: 'Échéance proche', variant: 'warning' },
  en_retard: { label: 'En retard', variant: 'danger' },
};

/**
 * « Décisions client à obtenir » — chaque décision est datée sur le calendrier
 * métier (échéance qui tient compte du délai fournisseur si elle déclenche une
 * commande). On met en avant les décisions encore à obtenir, triées par urgence.
 */
function DecisionsSection({ dossier }: { dossier: ProjectDossier }): React.JSX.Element | null {
  const decisions = buildClientDecisions(dossier);
  const pending = decisions.filter((d) => d.pending);
  if (decisions.length === 0) return null;

  return (
    <Section
      icon={<MessageSquareWarning aria-hidden />}
      title="Décisions client à obtenir"
      count={pending.length}
    >
      {pending.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          Toutes les décisions client sont obtenues.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((d) => {
            const badge = DECISION_BADGE[d.status];
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{d.categorie}</span> — {d.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.decideAvant
                      ? `À décider avant le ${fmtDate(d.decideAvant)}`
                      : 'À décider — datez le chantier pour connaître l’échéance'}
                    {d.stepLabel ? ` · pour l’étape « ${d.stepLabel} »` : ''}
                  </p>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/**
 * Mini-note d'intégration : juste après le dépôt d'un avenant, PHÉNIX confirme
 * ce qu'il a recalculé. Lecture du sélecteur `avenantImpact` (aucune logique
 * ici). On n'affiche que les impacts pertinents (lignes non nulles).
 */
function AvenantIntegrationNote({
  impact,
  onClose,
}: {
  impact: AvenantImpact;
  onClose: () => void;
}): React.JSX.Element {
  const sign = impact.deltaHT >= 0 ? '+' : '−';
  const plural = (n: number): string => (n > 1 ? 's' : '');
  const lines: string[] = [
    `${impact.postesRemplaces} poste${plural(impact.postesRemplaces)} remplacé${plural(impact.postesRemplaces)}`,
    `${impact.postesAjoutes} poste${plural(impact.postesAjoutes)} ajouté${plural(impact.postesAjoutes)}`,
    `${sign}${fmtMoney(Math.abs(impact.deltaHT))} HT`,
  ];
  if (impact.commandesAMettreAJour > 0)
    lines.push(
      `${impact.commandesAMettreAJour} commande${plural(impact.commandesAMettreAJour)} à mettre à jour`,
    );
  if (impact.choixAObtenir > 0) lines.push(`${impact.choixAObtenir} choix client à obtenir`);
  if (impact.documentsNecessaires > 0)
    lines.push(
      `${impact.documentsNecessaires} document${plural(impact.documentsNecessaires)} nécessaire${plural(impact.documentsNecessaires)}`,
    );
  if (impact.vigilances > 0)
    lines.push(`${impact.vigilances} vigilance${plural(impact.vigilances)} à lever`);
  if (impact.impactPlanning) lines.push('impact planning à vérifier');

  return (
    <div className="mb-3 rounded-xl border border-gold-300 bg-gold-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 font-medium text-gold-800 [&_svg]:size-4">
          <Sparkles aria-hidden />
          J'ai intégré l'avenant n°{impact.numero}.
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
        >
          <X aria-hidden />
        </button>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-1.5">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold-600" />
            {l}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Le devis initial reste intact — l'avenant s'ajoute, rien n'est réécrit.
      </p>
    </div>
  );
}

/**
 * Carte d'un avenant DÉPOSÉ mais NON VALIDÉ. Elle affiche clairement l'état
 * « brouillon » (rien n'est intégré), le document réellement déposé, et les
 * IMPACTS PROPOSÉS calculés par PHÉNIX (sélecteur `avenantImpact`) — à relire avant
 * la validation humaine. Aucune donnée contractuelle n'est active tant que le
 * conducteur n'a pas cliqué « Valider et intégrer ».
 */
function AvenantBrouillonCard({
  brouillon,
  impact,
  onValidate,
  onDelete,
}: {
  brouillon: Avenant;
  impact: AvenantImpact;
  onValidate: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const sign = impact.deltaHT >= 0 ? '+' : '−';
  const plural = (n: number): string => (n > 1 ? 's' : '');
  const lines: string[] = [
    `${impact.postesRemplaces} poste${plural(impact.postesRemplaces)} remplacé${plural(impact.postesRemplaces)}`,
    `${impact.postesAjoutes} poste${plural(impact.postesAjoutes)} ajouté${plural(impact.postesAjoutes)}`,
    `budget ${sign}${fmtMoney(Math.abs(impact.deltaHT))} HT`,
  ];
  if (impact.commandesAMettreAJour > 0)
    lines.push(
      `${impact.commandesAMettreAJour} commande${plural(impact.commandesAMettreAJour)} à mettre à jour`,
    );
  if (impact.choixAObtenir > 0) lines.push(`${impact.choixAObtenir} choix client à obtenir`);
  if (impact.vigilances > 0)
    lines.push(`${impact.vigilances} vigilance${plural(impact.vigilances)} à lever`);
  if (impact.impactPlanning) lines.push('impact planning à vérifier');

  return (
    <div className="rounded-xl border border-warning bg-warning/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Badge variant="warning">Brouillon — non intégré</Badge>
            {brouillon.reference ?? 'Avenant déposé'}
          </p>
          {brouillon.label && (
            <p className="mt-0.5 text-xs text-muted-foreground">{brouillon.label}</p>
          )}
        </div>
        {brouillon.sourceAttachment && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openAttachment(brouillon.sourceAttachment!)}
          >
            <Eye aria-hidden /> Document déposé
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Impacts proposés (à relire avant validation)
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
          {lines.map((l) => (
            <li key={l} className="flex items-center gap-1.5">
              <span className="size-1 shrink-0 rounded-full bg-gold-600" />
              {l}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Tant qu’il n’est pas validé, cet avenant ne modifie ni le devis, ni le budget, ni la
        Préparation, ni la Pré-réception, et Léon l’ignore.
      </p>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 aria-hidden /> Supprimer le brouillon
        </Button>
        <Button size="sm" onClick={onValidate}>
          <Check aria-hidden /> Valider et intégrer l’avenant
        </Button>
      </div>
    </div>
  );
}

/** Ligne d'avenant saisie par le conducteur (jamais fabriquée par PHÉNIX). */
interface AvenantLine {
  id: string;
  label: string;
  montantHT: string;
  tva: number;
  remplacePosteId: string;
}

const TVA_OPTIONS = [20, 10, 5.5] as const;

/**
 * Dépôt d'un avenant signé — le FLUX HONNÊTE (Condition bêta #3). PHÉNIX ne
 * fabrique aucune donnée : le conducteur DÉPOSE le document réellement signé, puis
 * saisit les postes que l'avenant modifie (nouveaux postes / remplacements). PHÉNIX
 * calcule et affiche les IMPACTS PROPOSÉS en direct. À l'enregistrement, l'avenant
 * part en BROUILLON (non intégré) : la validation, elle, se fait sur la carte.
 */
function AvenantDepositDialog({
  projectId,
  devis,
  validatedAvenants,
  onSave,
  onClose,
}: {
  projectId: string;
  devis: Devis;
  validatedAvenants: Avenant[];
  onSave: (avenant: Avenant) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [attachment, setAttachment] = useState<EventAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [label, setLabel] = useState('');
  const [lines, setLines] = useState<AvenantLine[]>([
    { id: crypto.randomUUID(), label: '', montantHT: '', tva: 20, remplacePosteId: '' },
  ]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Postes ACTIFS du contrat consolidé (pour cibler un remplacement).
  const consolidated = consolidateDevis(devis, validatedAvenants);
  const activePostes = consolidated.lots.flatMap((lot) =>
    lot.postes
      .filter((cp) => cp.replacedByNumero == null)
      .map((cp) => ({ id: cp.poste.id, label: cp.poste.label, lotLabel: lot.label })),
  );

  const setLine = (id: string, patch: Partial<AvenantLine>): void =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = (): void =>
    setLines((ls) => [
      ...ls,
      { id: crypto.randomUUID(), label: '', montantHT: '', tva: 20, remplacePosteId: '' },
    ]);
  const removeLine = (id: string): void => setLines((ls) => ls.filter((l) => l.id !== id));

  const onPick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const res = await readDocumentAttachment(projectId, file);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setAttachment(res.value);
    } finally {
      setBusy(false);
    }
  };

  const validLines = lines.filter((l) => l.label.trim() !== '' && Number(l.montantHT) > 0);
  const provisionalNumero = validatedAvenants.length + 1;

  // Avenant PROVISOIRE (pour l'aperçu d'impact), construit des lignes valides.
  const buildAvenant = (): Avenant => {
    const byLot = new Map<string, DevisPoste[]>();
    validLines.forEach((line) => {
      const replaced = line.remplacePosteId
        ? activePostes.find((p) => p.id === line.remplacePosteId)
        : undefined;
      const lotLabel = replaced ? replaced.lotLabel : 'Travaux supplémentaires';
      const poste: DevisPoste = {
        id: `p-avb-${line.id}`,
        label: line.label.trim(),
        montantHT: Number(line.montantHT),
        tva: line.tva,
        ...(line.remplacePosteId ? { remplacePosteId: line.remplacePosteId } : {}),
      };
      if (!byLot.has(lotLabel)) byLot.set(lotLabel, []);
      byLot.get(lotLabel)!.push(poste);
    });
    const lots: DevisLot[] = [...byLot].map(([lab, postes], i) => ({
      id: `lot-avb-${i}`,
      label: lab,
      postes,
    }));
    return {
      id: `avb-${crypto.randomUUID()}`,
      numero: provisionalNumero,
      reference:
        reference.trim() ||
        `AV-${new Date().getFullYear()}-${String(provisionalNumero).padStart(2, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      label: label.trim() || `Avenant n°${provisionalNumero}`,
      lots,
      ...(attachment ? { sourceAttachment: attachment } : {}),
    };
  };

  const preview =
    validLines.length > 0 ? avenantImpact(devis, validatedAvenants, buildAvenant()) : null;
  const canSave = attachment !== null && validLines.length > 0 && !busy;

  const dirty =
    attachment !== null ||
    reference.trim() !== '' ||
    label.trim() !== '' ||
    lines.some(
      (l) => l.label.trim() !== '' || l.montantHT.trim() !== '' || l.remplacePosteId !== '',
    );
  const requestClose = (): void => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !confirmLeave && requestClose()}>
      <DialogContent className="relative max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Déposer un avenant signé</DialogTitle>
          <DialogDescription>
            Déposez le document réellement signé, puis saisissez ce que l’avenant modifie. PHÉNIX
            n’invente rien : il calcule les impacts à partir de ce que vous entrez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Le document signé (obligatoire). */}
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_DOCUMENT}
              className="hidden"
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {attachment ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gold-100 text-gold-700 [&_svg]:size-5">
                  <FileText aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {attachment.fileName}
                </span>
                <button
                  type="button"
                  aria-label="Retirer le document"
                  onClick={() => setAttachment(null)}
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                >
                  <X aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground transition-colors hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-6 [&_svg]:text-gold-600"
              >
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
                Déposer l’avenant signé (PDF ou image, max {MAX_DOC_MB} Mo)
              </button>
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
          </div>

          {/* 2. Références (facultatives). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Référence (facultatif)</span>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={`AV-${new Date().getFullYear()}-${String(provisionalNumero).padStart(2, '0')}`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Intitulé (facultatif)</span>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. Montée en gamme cuisine + travaux supplémentaires"
              />
            </label>
          </div>

          {/* 3. Postes de l'avenant (saisis, jamais inventés). */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Ce que l’avenant modifie</p>
            <ul className="space-y-3">
              {lines.map((line, i) => {
                const replaced = line.remplacePosteId
                  ? activePostes.find((p) => p.id === line.remplacePosteId)
                  : undefined;
                return (
                  <li key={line.id} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Poste {i + 1}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Retirer le poste ${i + 1}`}
                          onClick={() => removeLine(line.id)}
                          className="ml-auto text-muted-foreground hover:text-destructive [&_svg]:size-4"
                        >
                          <Trash2 aria-hidden />
                        </button>
                      )}
                    </div>
                    <Input
                      value={line.label}
                      onChange={(e) => setLine(line.id, { label: e.target.value })}
                      placeholder="Désignation du poste (ex. Plan de travail quartz)"
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Montant HT (€)
                        <Input
                          type="number"
                          value={line.montantHT}
                          onChange={(e) => setLine(line.id, { montantHT: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        TVA
                        <select
                          value={line.tva}
                          onChange={(e) => setLine(line.id, { tva: Number(e.target.value) })}
                          className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
                        >
                          {TVA_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {String(t).replace('.', ',')} %
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Remplace un poste ?
                        <select
                          value={line.remplacePosteId}
                          onChange={(e) => setLine(line.id, { remplacePosteId: e.target.value })}
                          className="h-10 rounded-lg border border-input bg-surface px-2 text-sm text-foreground"
                        >
                          <option value="">Nouveau poste</option>
                          {activePostes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label.length > 40 ? `${p.label.slice(0, 40)}…` : p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {replaced && (
                      <p className="text-xs text-muted-foreground">
                        Remplace « {replaced.label} » ({replaced.lotLabel}).
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus aria-hidden /> Ajouter un poste
            </Button>
          </div>

          {/* 4. Impacts proposés (aperçu, calculés en direct). */}
          {preview && (
            <div className="rounded-xl border border-gold-200 bg-gold-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Impacts proposés
              </p>
              <p className="mt-1 text-sm text-foreground">
                {preview.postesRemplaces} remplacé(s), {preview.postesAjoutes} ajouté(s) · budget{' '}
                {preview.deltaHT >= 0 ? '+' : '−'}
                {fmtMoney(Math.abs(preview.deltaHT))} HT
                {preview.commandesAMettreAJour > 0
                  ? ` · ${preview.commandesAMettreAJour} commande(s) à revoir`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rien n’est intégré maintenant : vous validerez l’avenant ensuite, après relecture.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={requestClose}>
            Annuler
          </Button>
          <Button disabled={!canSave} onClick={() => onSave(buildAvenant())}>
            <Check aria-hidden /> Enregistrer le brouillon
          </Button>
        </DialogFooter>

        <LeaveConfirmInline
          open={confirmLeave}
          onCancel={() => setConfirmLeave(false)}
          onLeave={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
        {count != null && <span className="text-sm text-muted-foreground">({count})</span>}
        {action && <div className="ml-auto [&_svg]:size-4 [&_svg]:text-current">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function F({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
