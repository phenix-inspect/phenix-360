import { useState } from 'react';
import { Badge, Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  SELECTION_STATUS_LABEL,
  buildProjectMemory,
  type EventActor,
  type Order,
  type OrderStatus,
  type Project,
  type ProjectDossier,
} from '@phenix360/core';
import { Banknote, CalendarDays, FileText, ListChecks, Palette, Sparkles } from 'lucide-react';
import { demo } from '../store';
import { fmtDateShort, fmtMoney } from '../lib/format';
import { RoadmapProgress } from './RoadmapProgress';
import { DocumentStatusBadge } from './DocumentStatusBadge';

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
  const memory = buildProjectMemory(dossier);

  const patch = (next: Partial<ProjectDossier>) =>
    demo.saveDossier(project.id, { ...dossier, ...next });

  const setOrderStatus = (id: string, statut: OrderStatus) =>
    patch({ orders: dossier.orders.map((o) => (o.id === id ? { ...o, statut } : o)) });

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

  return (
    <div className="space-y-6">
      <Info dossier={dossier} />

      <Section
        icon={<ListChecks aria-hidden />}
        title="Feuille de route"
        count={dossier.roadmap.length}
      >
        <RoadmapProgress roadmap={dossier.roadmap} />
      </Section>

      {dossier.planning.length > 0 && (
        <Section
          icon={<CalendarDays aria-hidden />}
          title="Planning proposé"
          count={dossier.planning.length}
        >
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {dossier.planning.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 bg-surface px-3 py-2 text-sm"
              >
                <span className="text-foreground">{t.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtDateShort(t.start)} → {fmtDateShort(t.end)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={<Banknote aria-hidden />} title="Commandes" count={dossier.orders.length}>
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.orders.map((o) => (
            <OrderCard key={o.id} order={o} onStatus={(s) => setOrderStatus(o.id, s)} />
          ))}
        </div>
      </Section>

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
  onStatus,
}: {
  order: Order;
  onStatus: (s: OrderStatus) => void;
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
        {order.garantie ? ` · Garantie ${order.garantie}` : ''}
      </p>
      <select
        value={order.statut}
        onChange={(e) => onStatus(e.target.value as OrderStatus)}
        className="h-8 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
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
