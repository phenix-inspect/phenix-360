import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  buildPreparation,
  type ChecklistTone,
  type PrepVerdict,
  type PreparationSummary,
  type ProjectDossier,
} from '@phenix360/core';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  ListChecks,
  Plus,
  Truck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { fmtDateShort, fmtMoney } from '../lib/format';

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
  return (
    <div className="space-y-4">
      <ReadinessBanner readiness={prep.readiness} nbBloquants={prep.bloquants.length} />
      <BudgetSummary
        budget={prep.budget}
        onSave={(v) => patch({ budgetPrevisionnel: v })}
        onReset={() => patch({ budgetPrevisionnel: undefined })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <LaunchChecklist prep={prep} dossier={dossier} patch={patch} />
        <div className="space-y-4">
          {prep.bloquants.length > 0 && <BlockersList prep={prep} />}
          <TeamSuppliers prep={prep} dossier={dossier} patch={patch} />
          <KeyDates prep={prep} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Verdict --------------------------------- */

const VERDICT: Record<
  PrepVerdict,
  { label: string; sub: string; box: string; icon: React.ReactNode }
> = {
  pret: {
    label: 'Prêt à démarrer',
    sub: 'Tous les points de lancement sont au vert.',
    box: 'border-success/40 bg-success/5',
    icon: <CheckCircle2 aria-hidden className="text-success" />,
  },
  presque: {
    label: 'Presque prêt',
    sub: 'Quelques points restent à vérifier avant de lancer.',
    box: 'border-gold-300 bg-gold-50',
    icon: <AlertTriangle aria-hidden className="text-gold-700" />,
  },
  pas_pret: {
    label: 'Pas encore prêt',
    sub: 'Un ou plusieurs points bloquent le démarrage.',
    box: 'border-destructive/40 bg-destructive/5',
    icon: <XCircle aria-hidden className="text-destructive" />,
  },
};

function ReadinessBanner({
  readiness,
  nbBloquants,
}: {
  readiness: PreparationSummary['readiness'];
  nbBloquants: number;
}): React.JSX.Element {
  const v = VERDICT[readiness.verdict];
  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-2xl border p-5 ${v.box}`}>
      <span className="grid size-12 shrink-0 place-items-center [&_svg]:size-8">{v.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          {v.label}
        </p>
        <p className="text-sm text-muted-foreground">{v.sub}</p>
      </div>
      <div className="text-right">
        <p className="font-serif text-3xl font-semibold text-foreground">
          {readiness.prets}
          <span className="text-lg text-muted-foreground">/{readiness.total}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          points prêts
          {nbBloquants > 0 ? ` · ${nbBloquants} bloquant${nbBloquants > 1 ? 's' : ''}` : ''}
        </p>
      </div>
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

/* ------------------------------ Bloquants -------------------------------- */

function BlockersList({ prep }: { prep: PreparationSummary }): React.JSX.Element {
  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-destructive [&_svg]:size-4">
          <AlertTriangle aria-hidden /> Points bloquants
        </h3>
        <ul className="space-y-1.5">
          {prep.bloquants.map((b) => (
            <li
              key={b.id}
              className="flex items-start gap-2 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-destructive"
            >
              <XCircle aria-hidden className="mt-0.5 shrink-0" />
              <span>{b.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Intervenants ------------------------------- */

function TeamSuppliers({
  prep,
  dossier,
  patch,
}: {
  prep: PreparationSummary;
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const [nom, setNom] = useState('');
  const [lot, setLot] = useState('');
  const list = dossier.sousTraitants ?? [];

  const add = (): void => {
    const n = nom.trim();
    if (!n) return;
    patch({
      sousTraitants: [
        ...list,
        { id: crypto.randomUUID(), nom: n, ...(lot.trim() ? { lot: lot.trim() } : {}) },
      ],
    });
    setNom('');
    setLot('');
  };
  const remove = (id: string): void => patch({ sousTraitants: list.filter((s) => s.id !== id) });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Users aria-hidden /> Intervenants
        </h3>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sous-traitants retenus
          </p>
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun sous-traitant retenu pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                >
                  <span className="font-medium">{s.nom}</span>
                  {s.lot && <span className="text-muted-foreground">· {s.lot}</span>}
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={`Retirer ${s.nom}`}
                    className="text-muted-foreground hover:text-foreground [&_svg]:size-3"
                  >
                    <X aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Nom"
              aria-label="Nom du sous-traitant"
              className="h-8 w-32"
            />
            <Input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Lot (optionnel)"
              aria-label="Lot du sous-traitant"
              className="h-8 w-32"
            />
            <Button size="sm" variant="outline" onClick={add} disabled={!nom.trim()}>
              <Plus aria-hidden /> Ajouter
            </Button>
          </div>
        </div>

        {prep.fournisseurs.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fournisseurs
            </p>
            <p className="text-sm text-foreground">{prep.fournisseurs.join(' · ')}</p>
          </div>
        )}
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
