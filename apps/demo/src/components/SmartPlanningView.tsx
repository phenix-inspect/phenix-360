import { useEffect, useRef, useState } from 'react';
import { buildSmartPlanning, type PlanningPhase, type ProjectDossier } from '@phenix360/core';
import { CalendarClock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { fmtDate, fmtDateShort, fmtDuree } from '../lib/format';
import { PlanningFrieze } from './PlanningFrieze';

/**
 * Le planning, vu comme un conducteur de travaux le présenterait — jamais un
 * formulaire ni un Gantt technique. PHÉNIX présente d'abord son travail, puis
 * pose UNE seule question naturelle : la date de démarrage. La durée est une
 * estimation calculée, pas une saisie. Quand la date change, PHÉNIX « recale »
 * visiblement le chantier (le moment magique). Dérivé du dossier (vivant).
 */
export function SmartPlanningView({
  dossier,
  onSetStartDate,
}: {
  dossier: ProjectDossier;
  onSetStartDate: (date: string | null) => void;
}): React.JSX.Element | null {
  const planning = buildSmartPlanning(dossier);
  const [recalc, setRecalc] = useState<'full' | 'short' | null>(null);
  const [editing, setEditing] = useState(false);

  if (planning.phases.length === 0) return null;

  const pickDate = (value: string) => {
    if (!value) return;
    const mode: 'full' | 'short' = planning.dated ? 'short' : 'full';
    onSetStartDate(value);
    setEditing(false);
    setRecalc(mode);
  };

  return (
    <div className="relative space-y-5">
      {/* (4) Le bandeau-promesse, tant que la date manque. */}
      {!planning.dated && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm font-medium text-ink-800">
          Votre planning est prêt. Il me manque uniquement la date de démarrage pour tout dater
          automatiquement.
        </p>
      )}

      {/* (1) PHÉNIX présente d'abord son travail, puis pose une seule question. */}
      {!planning.dated ? (
        <WorkSummary planning={planning} onPick={pickDate} />
      ) : (
        <DatedHeader
          planning={planning}
          editing={editing}
          onToggleEdit={() => setEditing((v) => !v)}
          onPick={pickDate}
        />
      )}

      {/* (5) La frise légère et éditoriale — visible dans les deux états. */}
      <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Le déroulé du chantier
          </p>
          <p className="font-mono text-xs text-gold-700">
            Durée estimée : {fmtDuree(planning.estimatedDays)}
          </p>
        </div>
        <PlanningFrieze phases={planning.phases} dated={planning.dated} />
      </section>

      {/* (3) Les cartes parlent comme un conducteur. */}
      <ol className="space-y-3">
        {planning.phases.map((ph, i) => (
          <PhaseCard
            key={ph.stepId}
            phase={ph}
            index={i}
            dated={planning.dated}
            dossier={dossier}
          />
        ))}
      </ol>

      {/* (6) Le moment magique : PHÉNIX recale le chantier. */}
      {recalc && <RecalcOverlay mode={recalc} onDone={() => setRecalc(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * (1) + (2) Présentation du travail + la seule question : la date.
 * -------------------------------------------------------------------------- */
function WorkSummary({
  planning,
  onPick,
}: {
  planning: ReturnType<typeof buildSmartPlanning>;
  onPick: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="space-y-2">
        <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
          J'ai préparé votre planning.
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <Bullet>J'ai identifié {planning.phases.length} étapes.</Bullet>
          <Bullet>J'estime la durée du chantier à {fmtDuree(planning.estimatedDays)}.</Bullet>
          <Bullet>
            Les dépendances techniques et les temps de séchage sont déjà pris en compte.
          </Bullet>
          <Bullet>
            Il me manque simplement une information pour dater l'ensemble du chantier.
          </Bullet>
        </ul>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <label className="flex flex-col gap-2">
          <span className="font-serif text-base font-semibold text-foreground">
            À quelle date souhaitez-vous démarrer les travaux ?
          </span>
          <input
            type="date"
            onChange={(e) => onPick(e.target.value)}
            className="h-11 w-full max-w-xs rounded-lg border border-input bg-paper-50 px-3 text-sm text-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Dès que vous confirmez cette date, je cale automatiquement toutes les étapes, les
          commandes, les décisions client et les délais de livraison.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * État daté : confirmation rassurante + modification discrète de la date.
 * -------------------------------------------------------------------------- */
function DatedHeader({
  planning,
  editing,
  onToggleEdit,
  onPick,
}: {
  planning: ReturnType<typeof buildSmartPlanning>;
  editing: boolean;
  onToggleEdit: () => void;
  onPick: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Votre planning est daté.
          </p>
          <p className="text-sm text-muted-foreground">
            Le chantier démarre le{' '}
            <span className="font-medium text-foreground">
              {planning.startDate ? fmtDate(planning.startDate) : '—'}
            </span>
            {planning.endDate && (
              <>
                {' '}
                et s'achève autour du{' '}
                <span className="font-medium text-foreground">{fmtDate(planning.endDate)}</span>
              </>
            )}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          className="shrink-0 text-xs font-medium text-gold-700 underline-offset-2 hover:underline"
        >
          {editing ? 'Annuler' : 'Modifier la date'}
        </button>
      </div>

      {editing && (
        <label className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Nouvelle date de démarrage</span>
          <input
            type="date"
            defaultValue={planning.startDate ?? ''}
            onChange={(e) => onPick(e.target.value)}
            className="h-10 w-full max-w-xs rounded-lg border border-input bg-paper-50 px-3 text-sm text-foreground"
          />
        </label>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * (3) La carte d'étape parle comme un conducteur : durée estimée + conseils
 *     métier à anticiper avant l'étape (« je vous recommande de… »).
 * -------------------------------------------------------------------------- */
function PhaseCard({
  phase,
  index,
  dated,
  dossier,
}: {
  phase: PlanningPhase;
  index: number;
  dated: boolean;
  dossier: ProjectDossier;
}): React.JSX.Element {
  const recos = recommendations(phase, dated, dossier);

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-100 font-mono text-xs font-semibold text-gold-800">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-foreground">{phase.label}</h4>
          <p className="text-xs text-muted-foreground">
            Durée estimée : {phase.durationDays} jour{phase.durationDays > 1 ? 's' : ''}
            {dated && phase.start && phase.end && (
              <>
                {' '}
                · du {fmtDateShort(phase.start)} au {fmtDateShort(phase.end)}
              </>
            )}
          </p>
        </div>
      </div>

      {recos.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-sm text-foreground">Avant cette étape, je vous recommande de :</p>
          <ul className="mt-1.5 space-y-1">
            {recos.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        (phase.orders.length > 0 || phase.choices.length > 0) && (
          <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
            <CheckCircle2 aria-hidden />
            Tout est prêt pour cette étape.
          </p>
        )
      )}

      {phase.drying != null && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">
          <CalendarClock aria-hidden />+ {phase.drying} jours de séchage avant la suite
        </p>
      )}
    </li>
  );
}

/**
 * Conseils métier à anticiper avant une étape — formulés comme un conducteur :
 * obtenir un choix, passer une commande (avec le délai fournisseur). On n'affiche
 * que ce qui reste à faire ; le reste est déjà calé.
 */
function recommendations(phase: PlanningPhase, dated: boolean, dossier: ProjectDossier): string[] {
  const out: string[] = [];

  for (const c of phase.choices) {
    if (!c.pending) continue;
    const avant = dated && c.figerAvant ? ` avant le ${fmtDateShort(c.figerAvant)}` : '';
    out.push(`obtenir le choix ${c.categorie.toLowerCase()}${avant}`);
  }

  for (const o of phase.orders) {
    const order = dossier.orders.find((x) => x.id === o.orderId);
    const needsOrder = !order || order.statut === 'a_commander';
    if (!needsOrder) continue;
    const delai = o.delaiJours ? ` (délai fournisseur : ${o.delaiJours} jours)` : '';
    const avant = dated && o.commanderAvant ? ` avant le ${fmtDateShort(o.commanderAvant)}` : '';
    out.push(`commander ${o.label.toLowerCase()}${delai}${avant}`);
  }

  return out;
}

function Bullet({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
      <span>{children}</span>
    </li>
  );
}

/* -------------------------------------------------------------------------- *
 * (6) Le moment magique — PHÉNIX recale le chantier sous les yeux du conducteur.
 *     Complet la première fois, plus court à chaque modification. Pure mise en
 *     scène (pas un vrai calcul) : l'expérience doit donner le sentiment que
 *     PHÉNIX travaille, pas que l'utilisateur remplit un formulaire.
 * -------------------------------------------------------------------------- */
const RECALC_STAGES = [
  'J’intègre les temps de séchage',
  'Je vérifie les délais fournisseurs',
  'Je positionne les décisions client',
  'Je recherche les conflits de planning',
];

function RecalcOverlay({
  mode,
  onDone,
}: {
  mode: 'full' | 'short';
  onDone: () => void;
}): React.JSX.Element {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const count = mode === 'full' ? RECALC_STAGES.length : 2;
  const stages = RECALC_STAGES.slice(0, count);

  useEffect(() => {
    const stepMs = mode === 'full' ? 450 : 280;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= count) {
        window.clearInterval(id);
        window.setTimeout(() => setDone(true), stepMs);
        window.setTimeout(() => onDoneRef.current(), stepMs + 750);
      }
    }, stepMs);
    return () => window.clearInterval(id);
  }, [mode, count]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-paper-50/95 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-3 p-6">
        {done ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-6">
              <Sparkles aria-hidden />
            </span>
            <p className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Votre planning est prêt.
            </p>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-foreground [&_svg]:size-5 [&_svg]:animate-spin [&_svg]:text-gold-600">
              <Loader2 aria-hidden />
              Je recale les étapes…
            </p>
            <ul className="space-y-2">
              {stages.map((s, i) => (
                <li
                  key={s}
                  className={`flex items-center gap-2 text-sm transition-opacity [&_svg]:size-4 ${
                    i < revealed
                      ? 'text-foreground opacity-100'
                      : 'text-muted-foreground opacity-40'
                  }`}
                >
                  {i < revealed ? (
                    <CheckCircle2 aria-hidden className="text-gold-600" />
                  ) : (
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full border border-border"
                    />
                  )}
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
