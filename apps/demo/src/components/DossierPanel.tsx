import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@phenix360/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  buildClientDecisions,
  avenantImpact,
  buildDecisionContent,
  consolidateDevis,
  decisionVisibility,
  type Avenant,
  type AvenantImpact,
  type ClientDecisionStatus,
  type DevisPoste,
  type EventActor,
  type Order,
  type OrderStatus,
  type Project,
  type ProjectDossier,
  type ProjectId,
} from '@phenix360/core';
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  MessageSquareWarning,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  X,
} from 'lucide-react';
import { demo, useDemo } from '../store';
import { fmtDate, fmtDateShort, fmtMoney } from '../lib/format';
import { ContactPicker } from './contacts/ContactPicker';
import { DevisBreakdown } from './DevisBreakdown';
import { PreparationCockpit } from './PreparationCockpit';
import { SmartPlanningView } from './SmartPlanningView';
import { ProposalWorkshop } from './ProposalWorkshop';
import { CoordonneesCard } from './prep/CoordonneesCard';
import { PhotosAvantSection } from './prep/PrepDocuments';

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
  // Avenant fraîchement déposé → PHÉNIX affiche sa mini-note d'intégration.
  const [integratedNumero, setIntegratedNumero] = useState<number | null>(null);
  // Le détail du devis (poste par poste) est une RÉFÉRENCE, consultée rarement en
  // semaine : replié par défaut pour ne pas alourdir la lecture (règle des 5 s).
  const [showDevis, setShowDevis] = useState(false);

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

  // Le conducteur envoie (ou renvoie) les propositions au client.
  const sendProposals = async (selId: string) => {
    const sel = dossier.selections.find((s) => s.id === selId);
    if (!sel) return;
    const kind = sel.modificationRequested ? 'renvoyee' : 'envoyee';
    patch({
      selections: dossier.selections.map((s) =>
        s.id === selId ? { ...s, statut: 'propose', modificationRequested: false } : s,
      ),
    });
    const content = buildDecisionContent({
      kind,
      origin: 'conducteur',
      selection: sel,
      statutApres: 'propose',
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility(kind),
      state: 'publie',
      content,
    });
  };

  // Le client a délégué : le conducteur (sur recommandation de PHÉNIX) arbitre.
  // On enregistre le choix final et on le trace au journal.
  const confirmDelegation = async (selId: string, optionId: string) => {
    const sel = dossier.selections.find((s) => s.id === selId);
    if (!sel) return;
    const opt = sel.options?.find((o) => o.id === optionId);
    patch({
      selections: dossier.selections.map((s) =>
        s.id === selId ? { ...s, chosenOptionId: optionId, detail: opt?.title ?? s.detail } : s,
      ),
    });
    const content = buildDecisionContent({
      kind: 'reco_confirmee',
      origin: 'phenix',
      selection: sel,
      statutApres: sel.statut,
      optionId,
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility('reco_confirmee'),
      state: 'publie',
      content,
    });
  };

  // Déposer un avenant signé : un NOUVEAU devis signé est remis, PHÉNIX l'analyse
  // et l'INTÈGRE au chantier (jamais une modification du devis initial). Pour la
  // démo, le « fichier déposé » est scénarisé : montée en gamme du poste le plus
  // structurant + travaux supplémentaires. PHÉNIX recalcule alors les impacts
  // (commandes, choix, documents, planning, budget, vigilances) et trace tout au
  // journal. Append-only : on ajoute, on ne réécrit jamais.
  const addAvenant = async () => {
    if (!dossier.devis) return;
    const existing = dossier.avenants ?? [];
    const numero = existing.length + 1;

    // Poste actif le plus cher → candidat à une montée en gamme (remplacement).
    const consolidated = consolidateDevis(dossier.devis, existing);
    let target: { lotLabel: string; poste: DevisPoste } | null = null;
    for (const lot of consolidated.lots) {
      for (const cp of lot.postes) {
        if (cp.replacedByNumero != null) continue;
        if (!target || cp.poste.montantHT > target.poste.montantHT) {
          target = { lotLabel: lot.label, poste: cp.poste };
        }
      }
    }
    if (!target) return;

    const upgraded: DevisPoste = {
      id: `p-av${numero}-up`,
      label: `${target.poste.label} — montée en gamme`,
      ...(target.poste.unite ? { unite: target.poste.unite } : {}),
      ...(target.poste.quantite != null ? { quantite: target.poste.quantite } : {}),
      ...(target.poste.materiau ? { materiau: target.poste.materiau } : {}),
      montantHT: Math.round(target.poste.montantHT * 1.15),
      tva: target.poste.tva,
      remplacePosteId: target.poste.id,
    };
    const added: DevisPoste = {
      id: `p-av${numero}-add`,
      label: 'Travaux supplémentaires demandés par le client',
      unite: 'forfait',
      montantHT: 1500,
      tva: 10,
    };
    const avenant: Avenant = {
      id: `av-${numero}`,
      numero,
      reference: `AV-${new Date().getFullYear()}-${String(numero).padStart(2, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      label: `Montée en gamme « ${target.lotLabel} » + travaux supplémentaires`,
      lots: [
        { id: `lot-av${numero}-a`, label: target.lotLabel, postes: [upgraded] },
        { id: `lot-av${numero}-b`, label: 'Travaux supplémentaires', postes: [added] },
      ],
    };

    patch({ avenants: [...existing, avenant] });
    setIntegratedNumero(numero);

    // PHÉNIX recalcule les impacts de l'avenant (source unique : même sélecteur
    // que la mini-note affichée à l'écran).
    const impact = avenantImpact(dossier.devis, existing, avenant);
    const sign = impact.deltaHT >= 0 ? '+' : '−';
    const lines = [
      `Avenant n°${numero} déposé et intégré par PHÉNIX (le devis initial reste intact).`,
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

      {dossier.devis && (
        <Section
          icon={<Receipt aria-hidden />}
          title="Le devis"
          count={consolidateDevis(dossier.devis, dossier.avenants).lots.length}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void addAvenant()}>
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
          {showDevis && (
            <DevisBreakdown
              devis={dossier.devis}
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

      {dossier.selections.some((s) => (s.options?.length ?? 0) > 0) && (
        <Section icon={<Sparkles aria-hidden />} title="Propositions préparées par PHÉNIX">
          <ProposalWorkshop
            selections={dossier.selections}
            onChange={(next) => patch({ selections: next })}
            onSend={(selId) => void sendProposals(selId)}
            onConfirmDelegation={(selId, optionId) => void confirmDelegation(selId, optionId)}
          />
        </Section>
      )}

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
