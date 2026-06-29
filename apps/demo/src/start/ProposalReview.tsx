import { useState } from 'react';
import { Badge, Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  SELECTION_STATUS_LABEL,
  SELECTION_STATUSES,
  buildPlanning,
  type DocumentStatus,
  type OrderStatus,
  type ProjectDossier,
  type ProjectProposal,
  type SelectionStatus,
} from '@phenix360/core';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { fmtDateShort, fmtMoney } from '../lib/format';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';

const parseDurationDays = (duration?: string): number => {
  if (!duration) return 60;
  const m = duration.match(/(\d+)\s*(mois|semaine|jour|an)/i);
  if (!m) return 60;
  const n = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  if (unit.startsWith('an')) return n * 365;
  if (unit.startsWith('mois')) return n * 30;
  if (unit.startsWith('sem')) return n * 7;
  return n;
};

const selectCls = 'h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground';

export function ProposalReview({
  proposal,
  onValidate,
  onCancel,
}: {
  proposal: ProjectProposal;
  onValidate: (proposal: ProjectProposal) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(proposal.projectName);
  const [dossier, setDossier] = useState<ProjectDossier>(proposal.dossier);

  const patch = (next: Partial<ProjectDossier>) => setDossier((d) => ({ ...d, ...next }));
  const setInfo = <K extends keyof ProjectDossier['infos']>(
    key: K,
    value: ProjectDossier['infos'][K],
  ) => patch({ infos: { ...dossier.infos, [key]: value } });

  const recomputePlanning = () => {
    const start = dossier.infos.startDate ?? new Date().toISOString().slice(0, 10);
    patch({
      planning: buildPlanning(dossier.roadmap, start, parseDurationDays(dossier.infos.duration)),
    });
  };

  const unanswered = dossier.questions.filter((q) => !q.answered).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header className="space-y-2 text-center">
        <Badge variant="gold" className="mx-auto">
          <Sparkles aria-hidden /> Proposition de PHÉNIX
        </Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Projet proposé par PHÉNIX
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Ceci n’est pas encore le projet. PHÉNIX a préparé le chantier à partir de votre dossier —
          vérifiez, corrigez, complétez, puis validez. <strong>L’IA prépare, vous validez.</strong>
        </p>
      </header>

      <Field label="Nom du projet">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {/* Informations générales */}
      <Block title="Informations générales">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <Input
              value={dossier.infos.clientName ?? ''}
              onChange={(e) => setInfo('clientName', e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={dossier.infos.phone ?? ''}
              onChange={(e) => setInfo('phone', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              value={dossier.infos.email ?? ''}
              onChange={(e) => setInfo('email', e.target.value)}
            />
          </Field>
          <Field label="Adresse du chantier">
            <Input
              value={dossier.infos.address ?? ''}
              onChange={(e) => setInfo('address', e.target.value)}
            />
          </Field>
          <Field label="Type de bien">
            <Input
              value={dossier.infos.propertyType ?? ''}
              onChange={(e) => setInfo('propertyType', e.target.value)}
            />
          </Field>
          <Field label="Surface (m²)">
            <Input
              type="number"
              value={dossier.infos.surface ?? ''}
              onChange={(e) =>
                setInfo('surface', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </Field>
          <Field label="Budget (€)">
            <Input
              type="number"
              value={dossier.infos.budget ?? ''}
              onChange={(e) =>
                setInfo('budget', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </Field>
          <Field label="Durée annoncée">
            <Input
              value={dossier.infos.duration ?? ''}
              onChange={(e) => setInfo('duration', e.target.value)}
            />
          </Field>
          <Field label="Date de début">
            <Input
              type="date"
              value={dossier.infos.startDate ?? ''}
              onChange={(e) => setInfo('startDate', e.target.value || undefined)}
            />
          </Field>
        </div>
      </Block>

      {/* Feuille de route */}
      <Block
        title="Feuille de route"
        hint="Construite à partir du devis. Renommez, réorganisez, ajoutez ou supprimez."
      >
        <ul className="space-y-2">
          {dossier.roadmap.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2">
              <span className="w-6 text-center font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <Input
                value={step.label}
                onChange={(e) =>
                  patch({
                    roadmap: dossier.roadmap.map((s) =>
                      s.id === step.id ? { ...s, label: e.target.value } : s,
                    ),
                  })
                }
              />
              <IconBtn
                label="Monter"
                disabled={i === 0}
                onClick={() => patch({ roadmap: move(dossier.roadmap, i, i - 1) })}
              >
                <ArrowUp aria-hidden />
              </IconBtn>
              <IconBtn
                label="Descendre"
                disabled={i === dossier.roadmap.length - 1}
                onClick={() => patch({ roadmap: move(dossier.roadmap, i, i + 1) })}
              >
                <ArrowDown aria-hidden />
              </IconBtn>
              <IconBtn
                label="Supprimer"
                onClick={() => patch({ roadmap: dossier.roadmap.filter((s) => s.id !== step.id) })}
              >
                <Trash2 aria-hidden />
              </IconBtn>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            patch({
              roadmap: [
                ...dossier.roadmap,
                { id: `step-${crypto.randomUUID().slice(0, 8)}`, label: 'Nouvelle étape' },
              ],
            })
          }
        >
          <Plus aria-hidden /> Ajouter une étape
        </Button>
      </Block>

      {/* Planning */}
      <Block title="Planning" hint="Proposé à partir des étapes, du début et de la durée.">
        <Button size="sm" variant="outline" onClick={recomputePlanning}>
          <CalendarDays aria-hidden /> Proposer un planning
        </Button>
        {dossier.planning.length > 0 && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
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
        )}
      </Block>

      {/* Commandes */}
      <Block title="Commandes" hint="Détectées dans le devis. Tout reste modifiable.">
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.orders.map((o) => (
            <div key={o.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <Input
                value={o.label}
                onChange={(e) =>
                  patch({
                    orders: dossier.orders.map((x) =>
                      x.id === o.id ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <div className="flex gap-2">
                <Input
                  value={o.fournisseur ?? ''}
                  placeholder="Fournisseur"
                  onChange={(e) =>
                    patch({
                      orders: dossier.orders.map((x) =>
                        x.id === o.id ? { ...x, fournisseur: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  value={o.montant ?? ''}
                  placeholder="Montant"
                  onChange={(e) =>
                    patch({
                      orders: dossier.orders.map((x) =>
                        x.id === o.id
                          ? { ...x, montant: e.target.value ? Number(e.target.value) : undefined }
                          : x,
                      ),
                    })
                  }
                />
              </div>
              <select
                value={o.statut}
                onChange={(e) =>
                  patch({
                    orders: dossier.orders.map((x) =>
                      x.id === o.id ? { ...x, statut: e.target.value as OrderStatus } : x,
                    ),
                  })
                }
                className={`${selectCls} w-full`}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Block>

      {/* Choix client */}
      <Block title="Choix client" hint="Ces fiches alimenteront l’espace client.">
        <div className="grid gap-2 sm:grid-cols-2">
          {dossier.selections.map((s) => (
            <div key={s.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <span className="text-xs font-medium uppercase tracking-wide text-gold-700">
                {s.categorie}
              </span>
              <Input
                value={s.label}
                onChange={(e) =>
                  patch({
                    selections: dossier.selections.map((x) =>
                      x.id === s.id ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <select
                value={s.statut}
                onChange={(e) =>
                  patch({
                    selections: dossier.selections.map((x) =>
                      x.id === s.id ? { ...x, statut: e.target.value as SelectionStatus } : x,
                    ),
                  })
                }
                className={`${selectCls} w-full`}
              >
                {SELECTION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {SELECTION_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Block>

      {/* Documents */}
      <Block title="Documents" hint="PHÉNIX ne bloque jamais : chaque document a un état.">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {dossier.documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-surface px-3 py-2"
            >
              <span className="text-sm text-foreground">{d.label}</span>
              <div className="flex items-center gap-2">
                <DocumentStatusBadge status={d.status} />
                <select
                  value={d.status}
                  onChange={(e) =>
                    patch({
                      documents: dossier.documents.map((x) =>
                        x.id === d.id ? { ...x, status: e.target.value as DocumentStatus } : x,
                      ),
                    })
                  }
                  className={selectCls}
                >
                  {DOCUMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {DOCUMENT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </Block>

      {/* Questions */}
      {dossier.questions.length > 0 && (
        <Block
          title="Questions de PHÉNIX"
          hint="PHÉNIX n’invente jamais : répondez maintenant ou plus tard."
        >
          <ul className="space-y-2">
            {dossier.questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm text-foreground">{q.question}</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={q.answer ?? ''}
                    placeholder="Votre réponse (optionnel)…"
                    onChange={(e) =>
                      patch({
                        questions: dossier.questions.map((x) =>
                          x.id === q.id
                            ? {
                                ...x,
                                answer: e.target.value,
                                answered: e.target.value.trim().length > 0,
                              }
                            : x,
                        ),
                        infos:
                          q.field && e.target.value
                            ? { ...dossier.infos, [q.field]: e.target.value }
                            : dossier.infos,
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* Validation */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            {unanswered > 0
              ? `${unanswered} question(s) sans réponse — vous pourrez y revenir plus tard.`
              : 'Tout est prêt. Vous pouvez créer le projet.'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              onClick={() => onValidate({ projectName: name.trim() || 'Nouveau projet', dossier })}
              disabled={name.trim().length === 0}
            >
              <CheckCircle2 aria-hidden /> Valider et créer le projet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
