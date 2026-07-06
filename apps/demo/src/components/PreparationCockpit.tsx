import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  buildClientShareReadiness,
  buildPreparation,
  isAcompteDocument,
  type ClientShareReadiness,
  type PreparationSummary,
  type ProjectDossier,
} from '@phenix360/core';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  ListChecks,
  Plus,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { fmtDate, fmtMoney } from '../lib/format';

/**
 * BUREAU DE PRÉPARATION (EPIC 5) — réduit à l'essentiel : « ce chantier peut-il
 * partir chez le client, oui ou non ? ». Un seul juge de paix (la check-list de
 * partage, toujours visible), un budget lisible en deux secondes, et la check-list
 * personnelle du conducteur. Le reste du dossier (devis, planning, commandes,
 * décisions, documents) vit dans ses sections dédiées, plus bas.
 */
export function PreparationCockpit({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const prep: PreparationSummary = buildPreparation(dossier);
  const share = buildClientShareReadiness(dossier);
  return (
    <div className="space-y-4">
      <ClientShareBlock dossier={dossier} share={share} prep={prep} patch={patch} />
      <CompactBudget
        budget={prep.budget}
        onSave={(v) => patch({ budgetPrevisionnel: v })}
        onReset={() => patch({ budgetPrevisionnel: undefined })}
      />
      <LaunchChecklist dossier={dossier} patch={patch} />
    </div>
  );
}

/* -------- Partage client : la check-list qui décide du partage ------------ */

/** Alertes NON bloquantes (informatives) dérivées du dossier + préparation. */
function computeAlerts(dossier: ProjectDossier, prep: PreparationSummary): string[] {
  const alerts: string[] = [];
  for (const d of dossier.documents)
    if (d.recommande && d.status !== 'fourni' && !/devis/i.test(d.label) && !isAcompteDocument(d))
      alerts.push(`Document à fournir : ${d.label}`);
  const aCommander = dossier.orders.filter((o) => o.statut === 'a_commander').length;
  if (aCommander > 0) alerts.push(`${aCommander} commande(s) à prévoir`);
  if (dossier.planning.length === 0) alerts.push('Planning prévisionnel à affiner');
  if (prep.budget.depasse) alerts.push('Budget engagé au-dessus du prévisionnel');
  const enRetard = prep.bloquants.filter((b) => b.kind === 'decision').length;
  if (enRetard > 0) alerts.push(`${enRetard} décision(s) client en retard`);
  return alerts;
}

/**
 * La check-list de partage — TOUJOURS dépliée : le conducteur ne cherche jamais
 * ce qui manque. Trois éléments obligatoires (devis signé · acompte reçu · date
 * officielle fixée), chacun coché ✅ ou barré ❌ avec le geste pour le lever.
 * Les trois cochés → le chantier part chez le client. Le reste = alertes.
 */
function ClientShareBlock({
  dossier,
  share,
  prep,
  patch,
}: {
  dossier: ProjectDossier;
  share: ClientShareReadiness;
  prep: PreparationSummary;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const alerts = computeAlerts(dossier, prep);

  // « Acompte reçu » est validé dès qu'UN document d'acompte est fourni (règle du
  // bloquant, source unique). Le bouton reflète cet état, jamais un seul document.
  const acomptePaid = share.blockers.find((b) => b.key === 'acompte')?.done ?? false;
  const acompteDoc = dossier.documents.find((d) => isAcompteDocument(d));
  const toggleAcompte = (): void => {
    if (acomptePaid)
      // Dévalider : toute preuve d'acompte fournie repasse en « à fournir ».
      patch({
        documents: dossier.documents.map((d) =>
          isAcompteDocument(d) && d.status === 'fourni' ? { ...d, status: 'a_fournir' } : d,
        ),
      });
    else if (acompteDoc)
      patch({
        documents: dossier.documents.map((d) =>
          d.id === acompteDoc.id ? { ...d, status: 'fourni' } : d,
        ),
      });
    else
      patch({
        documents: [
          ...dossier.documents,
          { id: 'doc-acompte', label: 'Acompte versé', status: 'fourni', categorie: 'acompte' },
        ],
      });
  };
  const setStartDate = (v: string): void =>
    patch({ infos: { ...dossier.infos, ...(v ? { startDate: v } : { startDate: undefined }) } });

  const box = share.shareable
    ? 'border-success/40 bg-success/5'
    : 'border-destructive/40 bg-destructive/5';
  const done = share.blockers.filter((b) => b.done).length;

  return (
    <div className={`space-y-4 rounded-2xl border p-5 ${box}`}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center [&_svg]:size-8">
          {share.shareable ? (
            <CheckCircle2 aria-hidden className="text-success" />
          ) : (
            <XCircle aria-hidden className="text-destructive" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {share.shareable ? 'Prêt à partager au client' : 'Pas encore prêt'}
          </h2>
          <p className="text-sm text-muted-foreground">{done} / 3 éléments obligatoires validés</p>
        </div>
      </div>

      {/* La check-list, toujours visible. */}
      <ul className="space-y-1.5">
        {share.blockers.map((b) => (
          <li
            key={b.key}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <span className="[&_svg]:size-4">
              {b.done ? (
                <CheckCircle2 aria-hidden className="text-success" />
              ) : (
                <XCircle aria-hidden className="text-destructive" />
              )}
            </span>
            <span className="flex-1 font-medium text-foreground">{b.label}</span>
            {b.key === 'acompte' && (
              <Button size="sm" variant={b.done ? 'ghost' : 'outline'} onClick={toggleAcompte}>
                {b.done ? 'Annuler' : 'Marquer comme payé'}
              </Button>
            )}
            {b.key === 'demarrage' &&
              (b.done ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {dossier.infos.startDate ? fmtDate(dossier.infos.startDate) : ''}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setStartDate('')}>
                    Effacer
                  </Button>
                </span>
              ) : (
                <input
                  type="date"
                  aria-label="Date officielle de démarrage"
                  value={dossier.infos.startDate ?? ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-input bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
              ))}
            {b.key === 'devis' && !b.done && (
              <span className="text-xs text-muted-foreground">
                Déposez le devis signé (Documents)
              </span>
            )}
          </li>
        ))}
      </ul>

      {share.shareable && (
        <p className="flex items-center gap-2 text-sm font-medium text-success [&_svg]:size-4">
          <CheckCircle2 aria-hidden />
          Le chantier est prêt à être partagé au client.
        </p>
      )}

      {/* Alertes NON bloquantes — jamais un blocage, juste à surveiller. */}
      {alerts.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-700 [&_svg]:size-4">
            <AlertTriangle aria-hidden /> Alertes (non bloquantes)
          </h3>
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li
                key={a}
                className="flex items-start gap-2 text-sm text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-gold-600"
              >
                <AlertTriangle aria-hidden />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Budget --------------------------------- */

/**
 * Budget lisible en deux secondes : une seule carte, une seule ligne —
 * prévisionnel · engagé · restant. Le prévisionnel s'édite en place.
 */
function CompactBudget({
  budget,
  onSave,
  onReset,
}: {
  budget: PreparationSummary['budget'];
  onSave: (v: number) => void;
  onReset: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget.previsionnel || ''));

  const save = (): void => {
    const n = Number(value.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) onSave(n);
    setEditing(false);
  };

  return (
    <Card className={budget.depasse ? 'border-destructive/40' : undefined}>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
          <Wallet aria-hidden /> Budget
        </span>

        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
          {editing ? (
            <span className="flex items-center gap-1.5">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                inputMode="numeric"
                aria-label="Budget prévisionnel"
                className="h-9 w-32"
                autoFocus
              />
              <Button size="icon" aria-label="Enregistrer" onClick={save}>
                <Check aria-hidden />
              </Button>
            </span>
          ) : (
            <Stat
              label="Prévisionnel"
              value={budget.previsionnel > 0 ? fmtMoney(budget.previsionnel) : '—'}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setValue(String(budget.previsionnel || ''));
                    setEditing(true);
                  }}
                  className="text-[0.7rem] font-medium text-gold-700 hover:underline"
                >
                  Modifier
                </button>
              }
            />
          )}
          <Divider />
          <Stat label="Engagé" value={fmtMoney(budget.engage)} />
          <Divider />
          <Stat label="Restant" value={fmtMoney(budget.restant)} danger={budget.restant < 0} />
        </div>

        <span className="text-[0.7rem] text-muted-foreground">
          {budget.depasse ? (
            <span className="font-medium text-destructive">budget dépassé</span>
          ) : budget.source === 'saisi' ? (
            <button type="button" onClick={onReset} className="hover:underline">
              saisi · revenir au devis
            </button>
          ) : budget.source === 'devis' ? (
            'd’après le devis signé'
          ) : budget.source === 'infos' ? (
            'd’après le dossier'
          ) : (
            'à renseigner'
          )}
        </span>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  danger,
  action,
}: {
  label: string;
  value: string;
  danger?: boolean;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-serif text-lg font-semibold ${danger ? 'text-destructive' : 'text-foreground'}`}
      >
        {value}
      </span>
      {action}
    </span>
  );
}

function Divider(): React.JSX.Element {
  return <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />;
}

/* ------------------------------ Check-list ------------------------------- */

/**
 * La check-list PERSONNELLE du conducteur (« clés récupérées »…). Purement
 * manuelle : l'état de préparation du dossier est déjà porté par la check-list de
 * partage ci-dessus — on ne le répète pas ici.
 */
function LaunchChecklist({
  dossier,
  patch,
}: {
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const manual = dossier.checklist ?? [];

  const add = (): void => {
    const label = draft.trim();
    if (!label) return;
    patch({ checklist: [...manual, { id: crypto.randomUUID(), label, done: false }] });
    setDraft('');
  };
  const toggle = (id: string): void =>
    patch({ checklist: manual.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  const remove = (id: string): void => patch({ checklist: manual.filter((c) => c.id !== id) });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <ListChecks aria-hidden /> Check-list de lancement
        </h3>

        {manual.length > 0 && (
          <ul className="space-y-1.5">
            {manual.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-label={c.done ? 'Décocher' : 'Cocher'}
                  aria-pressed={c.done}
                  className="[&_svg]:size-4"
                >
                  {c.done ? (
                    <CheckCircle2 aria-hidden className="text-success" />
                  ) : (
                    <Circle aria-hidden className="text-muted-foreground" />
                  )}
                </button>
                <span
                  className={`flex-1 ${c.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                >
                  {c.label}
                </span>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="Retirer"
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ajouter un point (ex. clés récupérées)"
            aria-label="Nouveau point de check-list"
            className="h-9"
          />
          <Button size="icon" aria-label="Ajouter le point" onClick={add} disabled={!draft.trim()}>
            <Plus aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
