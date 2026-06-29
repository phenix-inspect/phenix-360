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
  SELECTION_STATUS_LABEL,
  buildClientDecisions,
  buildDecisionContent,
  buildProjectMemory,
  decisionVisibility,
  studyProject,
  type ClientDecisionStatus,
  type Event,
  type EventActor,
  type Order,
  type OrderStatus,
  type Project,
  type ProjectDossier,
} from '@phenix360/core';
import {
  Banknote,
  CalendarDays,
  FileText,
  ListChecks,
  MessageSquareWarning,
  Palette,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { demo } from '../store';
import { fmtDate, fmtDateShort, fmtMoney } from '../lib/format';
import { RoadmapProgress } from './RoadmapProgress';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { LaunchNotePanel } from './LaunchNotePanel';
import { SmartPlanningView } from './SmartPlanningView';
import { ProposalWorkshop } from './ProposalWorkshop';

/** Vue « Préparation » : tout ce que PHÉNIX a préparé pour le chantier. */
export function DossierPanel({
  project,
  dossier,
  actor,
  events,
}: {
  project: Project;
  dossier: ProjectDossier;
  actor: EventActor;
  events: Event[];
}): React.JSX.Element {
  const memory = buildProjectMemory(dossier);
  const note = studyProject(dossier, events);
  const [editing, setEditing] = useState<Order | null>(null);

  const patch = (next: Partial<ProjectDossier>) =>
    demo.saveDossier(project.id, { ...dossier, ...next });

  const setOrderStatus = (id: string, statut: OrderStatus) =>
    patch({ orders: dossier.orders.map((o) => (o.id === id ? { ...o, statut } : o)) });

  const saveOrder = (updated: Order) => {
    patch({ orders: dossier.orders.map((o) => (o.id === updated.id ? updated : o)) });
    setEditing(null);
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

  const askDocument = async (docId: string, label: string) => {
    patch({
      documents: dossier.documents.map((d) =>
        d.id === docId ? { ...d, status: 'demande_client' } : d,
      ),
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'demande',
      visibility: 'client',
      state: 'ouverte',
      content: {
        question: `Pour préparer votre chantier, pouvez-vous nous transmettre : ${label} ?`,
        destinataire: 'client',
      },
    });
  };

  const stepLabels = (ids?: string[]): string[] =>
    (ids ?? []).map((id) => dossier.roadmap.find((s) => s.id === id)?.label ?? id);

  return (
    <div className="space-y-6">
      <LaunchNotePanel
        note={note}
        onAskDocument={(docId) => {
          const d = dossier.documents.find((x) => x.id === docId);
          if (d) void askDocument(d.id, d.label);
        }}
      />

      <Info dossier={dossier} />

      <Section
        icon={<ListChecks aria-hidden />}
        title="Feuille de route"
        count={dossier.roadmap.length}
      >
        <RoadmapProgress roadmap={dossier.roadmap} />
      </Section>

      <Section icon={<CalendarDays aria-hidden />} title="Planning" count={dossier.roadmap.length}>
        <SmartPlanningView
          dossier={dossier}
          onSetStartDate={(date) =>
            patch({ infos: { ...dossier.infos, startDate: date ?? undefined } })
          }
        />
      </Section>

      <Section icon={<Banknote aria-hidden />} title="Commandes" count={dossier.orders.length}>
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              steps={stepLabels(o.stepIds)}
              onStatus={(s) => setOrderStatus(o.id, s)}
              onEdit={() => setEditing(o)}
            />
          ))}
        </div>
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

      <Section
        icon={<Palette aria-hidden />}
        title="Choix client"
        count={dossier.selections.length}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {dossier.selections.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gold-700">
                  {s.categorie}
                </span>
                <Badge
                  variant={
                    s.statut === 'valide' ? 'success' : s.statut === 'propose' ? 'info' : 'neutral'
                  }
                >
                  {SELECTION_STATUS_LABEL[s.statut]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-foreground">{s.label}</p>
              {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<FileText aria-hidden />} title="Documents" count={dossier.documents.length}>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {dossier.documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-surface px-3 py-2"
            >
              <span className="text-sm text-foreground">{d.label}</span>
              <div className="flex items-center gap-2">
                <DocumentStatusBadge status={d.status} />
                {(d.status === 'manquant' || d.status === 'a_fournir') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void askDocument(d.id, d.label)}
                  >
                    Demander au client
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {dossier.questions.length > 0 && (
        <Section
          icon={<Sparkles aria-hidden />}
          title="Questions de PHÉNIX"
          count={dossier.questions.filter((q) => !q.answered).length}
        >
          <QuestionsList dossier={dossier} onSave={patch} />
        </Section>
      )}

      <Section icon={<Sparkles aria-hidden />} title="Mémoire du projet">
        <p className="text-sm text-muted-foreground">
          L’assistant PHÉNIX connaît déjà {memory.travaux.length} lots de travaux,{' '}
          {memory.commandes.length} commandes, {memory.choix.length} choix client et{' '}
          {memory.garanties.length} garanties. Il pourra répondre aux questions du client et des
          équipes.
        </p>
      </Section>

      {editing && (
        <OrderEditor
          order={editing}
          roadmap={dossier.roadmap}
          onSave={saveOrder}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Info({ dossier }: { dossier: ProjectDossier }): React.JSX.Element {
  const i = dossier.infos;
  const rows: [string, string | undefined][] = [
    ['Client', i.clientName],
    ['Téléphone', i.phone],
    ['Email', i.email],
    ['Adresse', i.address],
    ['Type de bien', i.propertyType],
    ['Surface', i.surface ? `${i.surface} m²` : undefined],
    ['Budget', i.budget ? fmtMoney(i.budget) : undefined],
    ['Durée', i.duration],
    ['Début', i.startDate ? fmtDateShort(i.startDate) : undefined],
  ];
  return (
    <Card>
      <CardContent className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm text-foreground">{value ?? '—'}</p>
          </div>
        ))}
      </CardContent>
    </Card>
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
  roadmap,
  onSave,
  onClose,
}: {
  order: Order;
  roadmap: ProjectDossier['roadmap'];
  onSave: (order: Order) => void;
  onClose: () => void;
}): React.JSX.Element {
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
            <Input
              value={o.fournisseur ?? ''}
              onChange={(e) => set('fournisseur', e.target.value)}
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

function QuestionsList({
  dossier,
  onSave,
}: {
  dossier: ProjectDossier;
  onSave: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const answer = (id: string) => {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    const q = dossier.questions.find((x) => x.id === id);
    const questions = dossier.questions.map((x) =>
      x.id === id ? { ...x, answered: true, answer: text } : x,
    );
    const infos = q?.field ? { ...dossier.infos, [q.field]: text } : dossier.infos;
    onSave({ questions, infos });
  };

  return (
    <ul className="space-y-2">
      {dossier.questions.map((q) => (
        <li key={q.id} className="rounded-lg border border-border bg-surface p-3">
          <p className="text-sm text-foreground">{q.question}</p>
          {q.answered ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Réponse :</span> {q.answer}
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                value={drafts[q.id] ?? ''}
                onChange={(e) => setDrafts((s) => ({ ...s, [q.id]: e.target.value }))}
                placeholder="Répondre maintenant (ou plus tard)…"
              />
              <Button size="sm" onClick={() => answer(q.id)}>
                Répondre
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
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

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
        {count != null && <span className="text-sm text-muted-foreground">({count})</span>}
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
