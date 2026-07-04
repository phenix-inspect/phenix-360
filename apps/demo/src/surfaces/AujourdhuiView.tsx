import { useState } from 'react';
import { Button } from '@phenix360/ui';
import {
  PROJECT_STEP_LABEL,
  actionsOuvertes,
  buildDayBriefing,
  pendingClientDecisions,
  questionsEnAttente,
  reservesOuvertes,
  type Event,
  type ChantierResume,
} from '@phenix360/core';
import {
  ChevronRight,
  Flag,
  HelpCircle,
  ListChecks,
  MessageSquare,
  MoonStar,
  Sunrise,
  Truck,
  X,
} from 'lucide-react';
import {
  mostRecentPendingClientMoment,
  nameOf,
  pendingClientCommentCount,
  type DemoSnapshot,
} from '../store';
import type { CompagnonTab } from './CompagnonView';

/**
 * « Aujourd'hui » — le point du matin. Le conducteur ouvre PHÉNIX et voit SA
 * JOURNÉE, tous chantiers confondus (VISION.md Art. 3), avant d'entrer dans un
 * chantier. Aucune donnée inventée : tout est agrégé des faits (Art. 7 & 8).
 */

/** Les compteurs filtrables et ce qu'ils ouvrent (onglet du chantier). */
type FilterKind = 'decisions' | 'actions' | 'reserves' | 'questions' | 'livraisons';

const FILTERS: Record<
  FilterKind,
  { title: string; tab: CompagnonTab; count: (c: ChantierResume) => number }
> = {
  decisions: { title: 'Décisions client à traiter', tab: 'suivi', count: (c) => c.decisions },
  actions: { title: 'Actions à suivre', tab: 'suivi', count: (c) => c.actions },
  reserves: { title: 'Réserves à lever', tab: 'reserves', count: (c) => c.reserves },
  questions: { title: 'Questions client à répondre', tab: 'suivi', count: (c) => c.questions },
  livraisons: { title: 'Livraisons à contrôler', tab: 'preparation', count: (c) => c.livraisons },
};

export function AujourdhuiView({
  snap,
  onOpenChantier,
  onCloturer,
}: {
  snap: DemoSnapshot;
  onOpenChantier: (projectId: string, tab?: CompagnonTab, momentId?: string) => void;
  onCloturer: () => void;
}): React.JSX.Element {
  const compagnon = snap.members.find((m) => m.role === 'compagnon');
  const prenom = compagnon ? nameOf(snap, compagnon.userId) : 'Mickaël';
  const [filter, setFilter] = useState<FilterKind | null>(null);

  const eventsByProject: Record<string, Event[]> = {};
  for (const e of snap.events) (eventsByProject[e.projectId] ??= []).push(e);

  const briefing = buildDayBriefing({
    projects: snap.projects,
    eventsByProject,
    dossiersByProject: snap.dossiers,
  });
  const t = briefing.totals;

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const phrase = buildPhrase(t);

  const activeId =
    snap.projects.find((p) => p.id === snap.activeProjectId)?.id ?? snap.projects[0]?.id;

  // Les ÉLÉMENTS PRÉCIS d'un chantier pour un compteur donné — mêmes sélecteurs
  // que ceux qui produisent les compteurs (`buildDayBriefing`), donc cohérence
  // garantie entre le nombre et la liste. Aucune donnée inventée.
  const itemsFor = (kind: FilterKind, projectId: string): { key: string; label: string }[] => {
    const events = eventsByProject[projectId] ?? [];
    switch (kind) {
      case 'decisions':
        return pendingClientDecisions(events).map((d) => ({ key: d.eventId, label: d.question }));
      case 'actions':
        return actionsOuvertes(events).map((e) => ({
          key: e.id,
          label: e.type === 'action' ? e.content.libelle : '',
        }));
      case 'reserves':
        return reservesOuvertes(events).map((r) => ({
          key: r.id,
          label: `Réserve n°${r.content.numero} · ${r.content.libelle}`,
        }));
      case 'questions':
        return questionsEnAttente(events).map((e) => ({ key: e.id, label: e.content.question }));
      case 'livraisons':
        return (snap.dossiers[projectId]?.orders ?? [])
          .filter((o) => o.statut === 'commandee')
          .map((o) => ({
            key: o.id,
            label: o.fournisseur ? `${o.label} · ${o.fournisseur}` : o.label,
          }));
    }
  };

  const activateFilter = (kind: FilterKind): void => {
    setFilter((f) => (f === kind ? null : kind));
    document
      .getElementById('mes-chantiers')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Chantiers concernés par le filtre courant (ceux qui ont au moins un élément).
  const shown = filter
    ? briefing.chantiers.filter((c) => FILTERS[filter].count(c) > 0)
    : briefing.chantiers;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête du matin */}
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Sunrise aria-hidden />
          <span className="capitalize">{today}</span>
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Bonjour {prenom}
        </h1>
        <p className="text-base text-muted-foreground">{phrase}</p>
      </div>

      {/* Ce qui réclame votre attention — chaque compteur FILTRE la journée */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          icon={<HelpCircle aria-hidden />}
          value={t.decisions}
          label="décisions clients"
          accent
          active={filter === 'decisions'}
          onActivate={() => activateFilter('decisions')}
        />
        <Stat
          icon={<ListChecks aria-hidden />}
          value={t.actions}
          label="actions à suivre"
          accent
          active={filter === 'actions'}
          onActivate={() => activateFilter('actions')}
        />
        <Stat
          icon={<Flag aria-hidden />}
          value={t.reserves}
          label="réserves à lever"
          accent
          active={filter === 'reserves'}
          onActivate={() => activateFilter('reserves')}
        />
        <Stat
          icon={<MessageSquare aria-hidden />}
          value={t.questions}
          label="réponses à donner"
          active={filter === 'questions'}
          onActivate={() => activateFilter('questions')}
        />
        <Stat
          icon={<Truck aria-hidden />}
          value={t.livraisons}
          label="livraisons prévues"
          active={filter === 'livraisons'}
          onActivate={() => activateFilter('livraisons')}
        />
      </div>

      {/* Mes chantiers — liste normale, ou vue filtrée actionnable */}
      <section id="mes-chantiers" className="scroll-mt-24 space-y-3">
        {filter ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                {FILTERS[filter].title}
              </h2>
              <Button variant="outline" size="sm" onClick={() => setFilter(null)}>
                <X aria-hidden /> Tout afficher
              </Button>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
                Rien à traiter ici pour le moment.
              </p>
            ) : (
              <div className="space-y-2">
                {shown.map((c) => (
                  <ChantierFilteredCard
                    key={c.projectId}
                    name={c.name}
                    clientName={nameOf(snap, projectClientId(snap, c.projectId))}
                    step={c.step ? PROJECT_STEP_LABEL[c.step] : 'En préparation'}
                    active={c.projectId === activeId}
                    items={itemsFor(filter, c.projectId)}
                    onOpenItem={() => onOpenChantier(c.projectId, FILTERS[filter].tab)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Mes chantiers ({t.chantiers})
            </h2>
            <div className="space-y-2">
              {briefing.chantiers.map((c) => {
                const comments = pendingClientCommentCount(snap, c.projectId);
                return (
                  <ChantierCard
                    key={c.projectId}
                    domId={`chantier-${c.projectId}`}
                    chantier={c}
                    clientName={nameOf(snap, projectClientId(snap, c.projectId))}
                    active={c.projectId === activeId}
                    clientComments={comments}
                    onOpen={() =>
                      onOpenChantier(
                        c.projectId,
                        comments > 0 ? 'fil' : undefined,
                        comments > 0 ? mostRecentPendingClientMoment(snap, c.projectId) : undefined,
                      )
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={onCloturer}>
          <MoonStar aria-hidden /> Clôturer ma journée
        </Button>
      </div>
    </div>
  );
}

function projectClientId(snap: DemoSnapshot, projectId: string): string | undefined {
  return snap.projects.find((p) => p.id === projectId)?.clientId ?? undefined;
}

function buildPhrase(t: {
  chantiers: number;
  reserves: number;
  decisions: number;
  questions: number;
  actions: number;
}): string {
  const bits: string[] = [];
  if (t.decisions > 0) bits.push(`${t.decisions} décision${t.decisions > 1 ? 's' : ''} client`);
  if (t.actions > 0) bits.push(`${t.actions} action${t.actions > 1 ? 's' : ''} à suivre`);
  if (t.questions > 0) bits.push(`${t.questions} réponse${t.questions > 1 ? 's' : ''} à donner`);
  if (t.reserves > 0) bits.push(`${t.reserves} réserve${t.reserves > 1 ? 's' : ''} à lever`);
  if (bits.length === 0) return 'Rien d’urgent aujourd’hui. Vos chantiers avancent sereinement.';
  return `Aujourd’hui, ${bits.join(', ')} réclament votre attention.`;
}

function Stat({
  icon,
  value,
  label,
  accent,
  active,
  onActivate,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
  active?: boolean;
  onActivate?: () => void;
}): React.JSX.Element {
  const highlight = accent && value > 0;
  // Un compteur n'est un raccourci que s'il a quelque chose à montrer (> 0).
  const clickable = value > 0 && Boolean(onActivate);
  const base = `w-full rounded-xl border p-3 text-left ${
    active
      ? 'border-gold-500 bg-gold-100 ring-2 ring-gold-300'
      : highlight
        ? 'border-gold-300 bg-gold-50'
        : 'border-border bg-surface'
  }`;
  const inner = (
    <>
      <div
        className={`flex items-center gap-1.5 text-xs ${
          highlight || active ? 'text-gold-700' : 'text-muted-foreground'
        } [&_svg]:size-3.5`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
    </>
  );

  if (!clickable) return <div className={base}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={active}
      aria-label={`Filtrer : ${value} ${label}`}
      className={`${base} cursor-pointer transition-colors duration-base hover:border-gold-400 hover:bg-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      {inner}
    </button>
  );
}

/** Carte chantier en mode FILTRÉ : le nom + la liste des éléments à traiter,
 *  chacun ouvrant le chantier au bon onglet. */
function ChantierFilteredCard({
  name,
  clientName,
  step,
  active,
  items,
  onOpenItem,
}: {
  name: string;
  clientName: string;
  step: string;
  active?: boolean;
  items: { key: string; label: string }[];
  onOpenItem: () => void;
}): React.JSX.Element {
  return (
    <div
      className={`rounded-xl border bg-surface p-4 shadow-sm ${
        active ? 'border-gold-400' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-serif text-lg font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{clientName}</span>
        {active && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-800">
            <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
            Chantier actif
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{step}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onClick={onOpenItem}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-paper-50 px-3 py-2 text-left text-sm text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChantierCard({
  domId,
  chantier,
  clientName,
  active,
  clientComments = 0,
  onOpen,
}: {
  domId: string;
  chantier: ChantierResume;
  clientName: string;
  active?: boolean;
  clientComments?: number;
  onOpen: () => void;
}): React.JSX.Element {
  const c = chantier;
  const badges: { label: string; accent?: boolean }[] = [];
  if (clientComments > 0)
    badges.push({
      label: `${clientComments} commentaire${clientComments > 1 ? 's' : ''} client`,
      accent: true,
    });
  if (c.decisions > 0) badges.push({ label: `${c.decisions} décision client`, accent: true });
  if (c.actions > 0)
    badges.push({ label: `${c.actions} action${c.actions > 1 ? 's' : ''}`, accent: true });
  if (c.questions > 0) badges.push({ label: `${c.questions} à répondre`, accent: true });
  if (c.reserves > 0) badges.push({ label: `${c.reserves} réserve${c.reserves > 1 ? 's' : ''}` });
  if (c.livraisons > 0)
    badges.push({ label: `${c.livraisons} livraison${c.livraisons > 1 ? 's' : ''}` });

  return (
    <button
      type="button"
      id={domId}
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active
          ? 'border-gold-400 bg-surface'
          : c.urgent
            ? 'border-gold-200 bg-surface'
            : 'border-border bg-surface'
      }`}
    >
      <span
        className={`mt-0.5 h-10 w-1.5 shrink-0 rounded-full ${c.urgent ? 'bg-gold-500' : 'bg-border'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-serif text-lg font-semibold text-foreground">{c.name}</span>
          <span className="text-xs text-muted-foreground">{clientName}</span>
          {active && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-800">
              <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
              Chantier actif
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {c.step ? PROJECT_STEP_LABEL[c.step] : 'En préparation'}
        </span>
        {badges.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b.label}
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  b.accent
                    ? 'bg-gold-100 text-gold-800'
                    : 'border border-border bg-paper-50 text-muted-foreground'
                }`}
              >
                {b.label}
              </span>
            ))}
          </span>
        )}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
