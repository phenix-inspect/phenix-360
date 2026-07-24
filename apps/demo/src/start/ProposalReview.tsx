import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  SELECTION_STATUS_LABEL,
  SELECTION_STATUSES,
  buildOrderAlerts,
  type ClientSelection,
  type DocumentStatus,
  type Order,
  type OrderStatus,
  type PreparationQuestion,
  type ProjectDossier,
  type ProjectProposal,
  type SelectionStatus,
} from '@phenix360/core';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Lightbulb,
  Plus,
  Trash2,
} from 'lucide-react';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { DevisBreakdown } from '../components/DevisBreakdown';
import { SmartPlanningView } from '../components/SmartPlanningView';

/* -------------------------------------------------------------------------- *
 * Le conducteur ne remplit pas un logiciel : il DÉCOUVRE ce que PHÉNIX a déjà
 * préparé, puis ajuste. Chaque chapitre s'ouvre sur « Ce que PHÉNIX a déjà
 * préparé », jamais sur une page vide. Pas de validation intermédiaire.
 * -------------------------------------------------------------------------- */

type ChapterId = 'projet' | 'travaux' | 'achats' | 'choix' | 'documents' | 'planning';

const CHAPTERS: { id: ChapterId; label: string; title: string }[] = [
  { id: 'projet', label: 'Le projet', title: 'Le projet' },
  { id: 'travaux', label: 'Les travaux', title: 'Les travaux' },
  { id: 'achats', label: 'Achats', title: 'Les achats & commandes' },
  { id: 'choix', label: 'Choix', title: 'Les choix du client' },
  { id: 'documents', label: 'Documents', title: 'Les documents' },
  { id: 'planning', label: 'Le planning', title: 'Le planning' },
];

const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';
const uid = (): string => crypto.randomUUID().slice(0, 8);

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
  const [step, setStep] = useState(0); // 0..CHAPTERS.length-1 = chapitre ; === length = récap

  const patch = (next: Partial<ProjectDossier>) => setDossier((d) => ({ ...d, ...next }));
  const isRecap = step === CHAPTERS.length;
  const chapter = CHAPTERS[step];

  const goNext = () => setStep((s) => Math.min(CHAPTERS.length, s + 1));
  const goPrev = () => (step === 0 ? onCancel() : setStep((s) => s - 1));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
          Création du projet
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">{name}</h1>
        <ChapterRail current={step} onJump={setStep} />
      </header>

      {isRecap ? (
        <Recap dossier={dossier} />
      ) : (
        <div className="space-y-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {chapter!.title}
          </h2>
          {chapter!.id === 'projet' && (
            <ChapterProjet dossier={dossier} name={name} setName={setName} patch={patch} />
          )}
          {chapter!.id === 'travaux' && <ChapterTravaux dossier={dossier} patch={patch} />}
          {chapter!.id === 'achats' && <ChapterAchats dossier={dossier} patch={patch} />}
          {chapter!.id === 'choix' && <ChapterChoix dossier={dossier} patch={patch} />}
          {chapter!.id === 'documents' && <ChapterDocuments dossier={dossier} patch={patch} />}
          {chapter!.id === 'planning' && <ChapterPlanning dossier={dossier} patch={patch} />}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={goPrev}>
          <ArrowLeft aria-hidden />
          {step === 0 ? 'Retour' : 'Précédent'}
        </Button>
        {isRecap ? (
          <Button
            onClick={() => onValidate({ projectName: name.trim() || 'Nouveau projet', dossier })}
            disabled={name.trim().length === 0}
          >
            <CheckCircle2 aria-hidden /> Valider et démarrer le chantier
          </Button>
        ) : (
          <Button onClick={goNext}>
            {step === CHAPTERS.length - 1 ? 'Terminer' : 'Chapitre suivant'}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/* --- Chrome ------------------------------------------------------------- */
function ChapterRail({
  current,
  onJump,
}: {
  current: number;
  onJump: (i: number) => void;
}): React.JSX.Element {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {CHAPTERS.map((c, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={c.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onJump(i)}
              className={
                active
                  ? 'rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground'
                  : done
                    ? 'rounded-full px-3 py-1 text-gold-700 hover:underline'
                    : 'rounded-full px-3 py-1 text-muted-foreground hover:text-foreground'
              }
            >
              {c.label}
            </button>
            {i < CHAPTERS.length - 1 && <span className="text-muted-foreground">·</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Prepared({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ce que PHÉNIX a déjà préparé
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

function ToVerify({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-700 [&_svg]:size-4">
        <Lightbulb aria-hidden />
        Ce que PHÉNIX vous recommande de vérifier
      </p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Reco({ text, action }: { text: string; action?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
      <p className="text-sm text-ink-700">{text}</p>
      {action}
    </div>
  );
}

function QuestionFix({
  question,
  onAnswer,
}: {
  question: PreparationQuestion;
  onAnswer: (id: string, value: string) => void;
}): React.JSX.Element {
  const [v, setV] = useState(question.answer ?? '');
  return (
    <div className="space-y-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
      <p className="text-sm text-ink-700">{question.question}</p>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Préciser…" />
        <Button size="sm" onClick={() => v.trim() && onAnswer(question.id, v.trim())}>
          Préciser
        </Button>
      </div>
    </div>
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

/* --- Chapitres ---------------------------------------------------------- */
type PatchFn = (next: Partial<ProjectDossier>) => void;

function ChapterProjet({
  dossier,
  name,
  setName,
  patch,
}: {
  dossier: ProjectDossier;
  name: string;
  setName: (v: string) => void;
  patch: PatchFn;
}): React.JSX.Element {
  const i = dossier.infos;
  const setInfo = <K extends keyof ProjectDossier['infos']>(
    key: K,
    value: ProjectDossier['infos'][K],
  ) => patch({ infos: { ...dossier.infos, [key]: value } });

  const answer = (id: string, value: string) => {
    const q = dossier.questions.find((x) => x.id === id);
    patch({
      questions: dossier.questions.map((x) =>
        x.id === id ? { ...x, answered: true, answer: value } : x,
      ),
      infos: q?.field ? { ...dossier.infos, [q.field]: value } : dossier.infos,
    });
  };

  const recos = dossier.questions.filter((q) => !q.answered && q.field && q.field !== 'startDate');

  return (
    <>
      <Prepared>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du projet">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Client">
            <Input
              value={i.clientName ?? ''}
              onChange={(e) => setInfo('clientName', e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input value={i.phone ?? ''} onChange={(e) => setInfo('phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={i.email ?? ''} onChange={(e) => setInfo('email', e.target.value)} />
          </Field>
          <Field label="Adresse du chantier">
            <Input value={i.address ?? ''} onChange={(e) => setInfo('address', e.target.value)} />
          </Field>
          <Field label="Type de bien">
            <Input
              value={i.propertyType ?? ''}
              onChange={(e) => setInfo('propertyType', e.target.value)}
            />
          </Field>
          <Field label="Surface (m²)">
            <Input
              type="number"
              value={i.surface ?? ''}
              onChange={(e) =>
                setInfo('surface', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </Field>
          <Field label="Budget (€) — devis signé">
            <Input
              type="number"
              value={i.budget ?? ''}
              onChange={(e) =>
                setInfo('budget', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </Field>
        </div>
      </Prepared>

      {recos.length > 0 && (
        <ToVerify>
          {recos.map((q) => (
            <QuestionFix key={q.id} question={q} onAnswer={answer} />
          ))}
        </ToVerify>
      )}
    </>
  );
}

function ChapterTravaux({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: PatchFn;
}): React.JSX.Element {
  const move = (from: number, to: number) => {
    const next = [...dossier.roadmap];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    patch({ roadmap: next });
  };
  const hasNettoyage = dossier.roadmap.some((s) => /nettoyage/i.test(s.label));

  return (
    <>
      {dossier.devis && (
        <Prepared>
          <p className="text-sm text-muted-foreground">
            J'ai lu votre devis signé et structuré les travaux par lots (postes, montants, TVA,
            matériaux).
          </p>
          <DevisBreakdown devis={dossier.devis} dossier={dossier} />
        </Prepared>
      )}

      <Prepared>
        <p className="text-sm text-muted-foreground">
          La feuille de route déroule les étapes du chantier — vous pouvez les réordonner, en
          renommer, en ajouter ou en retirer.
        </p>
        <ul className="space-y-2">
          {dossier.roadmap.map((step, idx) => (
            <li key={step.id} className="flex items-center gap-2">
              <span className="w-6 text-center font-mono text-xs text-muted-foreground">
                {idx + 1}
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
              <Button
                size="icon"
                variant="ghost"
                aria-label="Monter"
                disabled={idx === 0}
                onClick={() => move(idx, idx - 1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Descendre"
                disabled={idx === dossier.roadmap.length - 1}
                onClick={() => move(idx, idx + 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Retirer"
                onClick={() => patch({ roadmap: dossier.roadmap.filter((s) => s.id !== step.id) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              roadmap: [...dossier.roadmap, { id: `step-${uid()}`, label: 'Nouvelle étape' }],
            })
          }
        >
          <Plus aria-hidden /> Ajouter une étape
        </Button>
      </Prepared>

      <ToVerify>
        <Reco text="Vérifiez l'ordre des étapes — vous pouvez en renommer, en ajouter ou en retirer." />
        {!hasNettoyage && (
          <Reco
            text="Je vous conseille d'ajouter une étape Nettoyage avant la réception."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rec = [...dossier.roadmap];
                  const at = Math.max(0, rec.length - 1);
                  rec.splice(at, 0, { id: `step-${uid()}`, label: 'Nettoyage' });
                  patch({ roadmap: rec });
                }}
              >
                Ajouter
              </Button>
            }
          />
        )}
      </ToVerify>
    </>
  );
}

function ChapterAchats({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: PatchFn;
}): React.JSX.Element {
  const setOrder = (id: string, next: Partial<Order>) =>
    patch({ orders: dossier.orders.map((o) => (o.id === id ? { ...o, ...next } : o)) });
  const alerts = buildOrderAlerts(dossier).filter((a) => a.severity !== 'success');

  return (
    <>
      <Prepared>
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.orders.map((o) => (
            <div key={o.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <Input value={o.label} onChange={(e) => setOrder(o.id, { label: e.target.value })} />
              <div className="flex gap-2">
                <Input
                  value={o.fournisseur ?? ''}
                  placeholder="Fournisseur"
                  onChange={(e) => setOrder(o.id, { fournisseur: e.target.value })}
                />
                <Input
                  type="number"
                  value={o.montant ?? ''}
                  placeholder="Montant"
                  onChange={(e) =>
                    setOrder(o.id, { montant: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <select
                value={o.statut}
                onChange={(e) => setOrder(o.id, { statut: e.target.value as OrderStatus })}
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
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              orders: [
                ...dossier.orders,
                { id: `ord-${uid()}`, label: 'Nouvelle commande', statut: 'a_commander' },
              ],
            })
          }
        >
          <Plus aria-hidden /> Ajouter une commande
        </Button>
      </Prepared>

      <ToVerify>
        {alerts.map((a) => (
          <Reco key={a.id} text={a.message} />
        ))}
        <Reco text="Vérifiez les montants issus du devis et ajoutez les commandes que j'aurais pu manquer." />
      </ToVerify>
    </>
  );
}

function ChapterChoix({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: PatchFn;
}): React.JSX.Element {
  const setSel = (id: string, next: Partial<ClientSelection>) =>
    patch({ selections: dossier.selections.map((s) => (s.id === id ? { ...s, ...next } : s)) });
  const aChoisir = dossier.selections.filter((s) => s.statut === 'a_choisir').length;

  return (
    <>
      <Prepared>
        <div className="grid gap-2 sm:grid-cols-2">
          {dossier.selections.map((s) => (
            <div key={s.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <Input
                value={s.categorie}
                onChange={(e) => setSel(s.id, { categorie: e.target.value })}
                className="text-xs font-medium uppercase tracking-wide"
              />
              <Input value={s.label} onChange={(e) => setSel(s.id, { label: e.target.value })} />
              <select
                value={s.statut}
                onChange={(e) => setSel(s.id, { statut: e.target.value as SelectionStatus })}
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
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              selections: [
                ...dossier.selections,
                {
                  id: `sel-${uid()}`,
                  categorie: 'Choix',
                  label: 'Nouveau choix',
                  statut: 'a_choisir',
                },
              ],
            })
          }
        >
          <Plus aria-hidden /> Ajouter un choix
        </Button>
      </Prepared>

      <ToVerify>
        <Reco
          text={`${aChoisir} choix devront être faits par votre client — je les afficherai dans son espace.`}
        />
      </ToVerify>
    </>
  );
}

function ChapterDocuments({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: PatchFn;
}): React.JSX.Element {
  const setDoc = (id: string, status: DocumentStatus) =>
    patch({ documents: dossier.documents.map((d) => (d.id === id ? { ...d, status } : d)) });
  const toAsk = dossier.documents.filter(
    (d) => d.status === 'manquant' || d.status === 'a_fournir',
  );

  return (
    <>
      <Prepared>
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
                  onChange={(e) => setDoc(d.id, e.target.value as DocumentStatus)}
                  className="h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
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
      </Prepared>

      {toAsk.length > 0 && (
        <ToVerify>
          {toAsk.map((d) => (
            <Reco
              key={d.id}
              text={
                d.status === 'manquant'
                  ? `Le ${d.label} est recommandé mais absent du dossier.`
                  : `Le ${d.label} sera à fournir plus tard.`
              }
              action={
                <Button size="sm" variant="outline" onClick={() => setDoc(d.id, 'demande_client')}>
                  Le demander au client
                </Button>
              }
            />
          ))}
        </ToVerify>
      )}
    </>
  );
}

function ChapterPlanning({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: PatchFn;
}): React.JSX.Element {
  return (
    <SmartPlanningView
      dossier={dossier}
      onSetStartDate={(date) =>
        patch({ infos: { ...dossier.infos, startDate: date ?? undefined } })
      }
    />
  );
}

function Recap({ dossier }: { dossier: ProjectDossier }): React.JSX.Element {
  const toAsk = dossier.documents.filter((d) => d.status === 'demande_client').length;
  const open = dossier.questions.filter((q) => !q.answered).length;
  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-6">
          <CheckCircle2 aria-hidden />
        </span>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          Tout est prêt.
        </h2>
        <p className="text-sm text-muted-foreground">
          {dossier.roadmap.length} étapes · {dossier.orders.length} commandes ·{' '}
          {dossier.selections.length} choix client · {dossier.documents.length} documents
          {toAsk > 0 ? ` (${toAsk} à demander au client)` : ''}.
        </p>
        {open > 0 && (
          <p className="text-sm text-muted-foreground">
            J'ai noté {open} point(s) à préciser — vous pourrez y revenir à tout moment.
          </p>
        )}
        <p className="text-sm text-foreground">
          En validant, je crée le chantier et j'ouvre l'espace de votre client.
        </p>
      </CardContent>
    </Card>
  );
}
