import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  buildClientShareReadiness,
  buildPreparation,
  type ChecklistTone,
  type ClientShareReadiness,
  type PreparationSummary,
  type ProjectDossier,
} from '@phenix360/core';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ListChecks,
  Lock,
  Plus,
  Truck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { fmtDate, fmtDateShort, fmtMoney } from '../lib/format';

/**
 * BUREAU DE PRÉPARATION (EPIC 5) — le cockpit qui répond en 30 secondes à
 * « ce chantier peut-il démarrer ? ». Lecture pure de `buildPreparation`
 * (déterministe, aucune IA) : verdict → budget → check-list → bloquants →
 * intervenants → dates. Le détail complet du dossier reste juste dessous.
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
      <BudgetSummary
        budget={prep.budget}
        onSave={(v) => patch({ budgetPrevisionnel: v })}
        onReset={() => patch({ budgetPrevisionnel: undefined })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <LaunchChecklist prep={prep} dossier={dossier} patch={patch} />
        <KeyDates prep={prep} />
      </div>
    </div>
  );
}

/* -------- Partage client : 3 bloquants actionnables + alertes ------------ */

/** Alertes NON bloquantes (informatives) dérivées du dossier + préparation. */
function computeAlerts(dossier: ProjectDossier, prep: PreparationSummary): string[] {
  const alerts: string[] = [];
  for (const d of dossier.documents)
    if (d.recommande && d.status !== 'fourni' && !/devis|acompte|arrhes/i.test(d.label))
      alerts.push(`Document à fournir : ${d.label}`);
  const aCommander = dossier.orders.filter((o) => o.statut === 'a_commander').length;
  if (aCommander > 0) alerts.push(`${aCommander} commande(s) à prévoir`);
  if (dossier.planning.length === 0) alerts.push('Planning prévisionnel à affiner');
  if (prep.budget.depasse) alerts.push('Budget engagé au-dessus du prévisionnel');
  const enRetard = prep.bloquants.filter((b) => b.kind === 'decision').length;
  if (enRetard > 0) alerts.push(`${enRetard} décision(s) client en retard`);
  return alerts;
}

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
  // Ouvert d'office quand ce n'est pas prêt : le conducteur voit TOUT DE SUITE
  // ce qui bloque, sans chercher.
  const [open, setOpen] = useState(!share.shareable);
  const alerts = computeAlerts(dossier, prep);

  const acompteDoc = dossier.documents.find((d) => /acompte|arrhes/i.test(d.label));
  const acomptePaid = acompteDoc?.status === 'fourni';
  const toggleAcompte = (): void => {
    if (acompteDoc)
      patch({
        documents: dossier.documents.map((d) =>
          d.id === acompteDoc.id ? { ...d, status: acomptePaid ? 'a_fournir' : 'fourni' } : d,
        ),
      });
    else
      patch({
        documents: [
          ...dossier.documents,
          { id: 'doc-acompte', label: 'Acompte versé', status: 'fourni', categorie: 'autre' },
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
    <div className={`overflow-hidden rounded-2xl border ${box}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="grid size-12 shrink-0 place-items-center [&_svg]:size-8">
          {share.shareable ? (
            <CheckCircle2 aria-hidden className="text-success" />
          ) : (
            <XCircle aria-hidden className="text-destructive" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-2xl font-semibold tracking-tight text-foreground">
            {share.shareable ? 'Prêt à partager au client' : 'Pas encore prêt'}
          </span>
          <span className="block text-sm text-muted-foreground">
            {share.shareable
              ? 'Les 3 éléments obligatoires sont validés — l’espace client est accessible.'
              : 'Le dossier n’est pas partageable au client. Voir ce qui bloque.'}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-right">
            <span className="block font-serif text-3xl font-semibold text-foreground">
              {done}
              <span className="text-lg text-muted-foreground">/3</span>
            </span>
            <span className="block text-xs text-muted-foreground">bloquants validés</span>
          </span>
          <ChevronDown
            aria-hidden
            className={`size-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-surface/60 p-5">
          {/* BLOQUANTS AVANT PARTAGE CLIENT */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive [&_svg]:size-4">
              <Lock aria-hidden /> Bloquants avant partage client
            </h3>
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
                    <Button
                      size="sm"
                      variant={b.done ? 'ghost' : 'outline'}
                      onClick={toggleAcompte}
                    >
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
          </div>

          {/* ALERTES NON BLOQUANTES */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gold-700 [&_svg]:size-4">
                <AlertTriangle aria-hidden /> Alertes (non bloquantes)
              </h3>
              <ul className="space-y-1.5">
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
      )}
    </div>
  );
}

/* -------------------------------- Budget --------------------------------- */

function BudgetSummary({
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
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
              <Wallet aria-hidden /> Prévisionnel
            </p>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setValue(String(budget.previsionnel || ''));
                  setEditing(true);
                }}
                className="text-xs font-medium text-gold-700 hover:underline"
              >
                Modifier
              </button>
            )}
          </div>
          {editing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                inputMode="numeric"
                aria-label="Budget prévisionnel"
                className="h-9"
                autoFocus
              />
              <Button size="icon" aria-label="Enregistrer" onClick={save}>
                <Check aria-hidden />
              </Button>
            </div>
          ) : (
            <p className="mt-1 font-serif text-2xl font-semibold text-foreground">
              {budget.previsionnel > 0 ? fmtMoney(budget.previsionnel) : '—'}
            </p>
          )}
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {budget.source === 'saisi' ? (
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
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
            <Wallet aria-hidden /> Engagé
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-foreground">
            {fmtMoney(budget.engage)}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">commandes déjà passées</p>
        </CardContent>
      </Card>

      <Card className={budget.depasse ? 'border-destructive/40' : undefined}>
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-gold-600">
            <Wallet aria-hidden /> Restant
          </p>
          <p
            className={`mt-1 font-serif text-2xl font-semibold ${
              budget.restant < 0 ? 'text-destructive' : 'text-foreground'
            }`}
          >
            {fmtMoney(budget.restant)}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {budget.depasse ? 'budget dépassé' : 'prévisionnel − engagé'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Check-list ------------------------------- */

const TONE_ICON: Record<ChecklistTone, React.ReactNode> = {
  fait: <CheckCircle2 aria-hidden className="text-success" />,
  a_verifier: <AlertTriangle aria-hidden className="text-gold-600" />,
  bloquant: <XCircle aria-hidden className="text-destructive" />,
};

function LaunchChecklist({
  prep,
  dossier,
  patch,
}: {
  prep: PreparationSummary;
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

  const autoItems = prep.checklist.filter((c) => c.auto);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <ListChecks aria-hidden /> Check-list de lancement
        </h3>

        <ul className="space-y-1.5">
          {autoItems.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 text-sm [&_svg]:size-4">
              {TONE_ICON[c.tone]}
              <span className="flex-1 text-foreground">{c.label}</span>
              {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
            </li>
          ))}
        </ul>

        {manual.length > 0 && (
          <ul className="space-y-1.5 border-t border-border pt-2.5">
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

        <div className="flex items-center gap-2 border-t border-border pt-2.5">
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

/* ------------------------------- Dates ----------------------------------- */

const DATE_ICON = {
  demarrage: <CalendarClock aria-hidden />,
  jalon: <Circle aria-hidden />,
  livraison: <Truck aria-hidden />,
};

function KeyDates({ prep }: { prep: PreparationSummary }): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <CalendarClock aria-hidden /> Prochaines dates
        </h3>
        {prep.datesImportantes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune date à venir.</p>
        ) : (
          <ul className="space-y-1.5">
            {prep.datesImportantes.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2.5 text-sm [&_svg]:size-3.5 [&_svg]:text-gold-600"
              >
                {DATE_ICON[d.kind]}
                <span className="flex-1 text-foreground">{d.label}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {fmtDateShort(d.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
