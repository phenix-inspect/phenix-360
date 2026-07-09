import { useState } from 'react';
import { Badge, Button } from '@phenix360/ui';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  PROJECT_STEP_LABEL,
  actionsOuvertes,
  buildDayBriefing,
  pendingClientDecisions,
  questionsEnAttente,
  reservesOuvertes,
  type Event,
  type ChantierResume,
  type DecisionEvent,
  type ProjectStatus,
} from '@phenix360/core';
import {
  Check,
  ChevronRight,
  Flag,
  ListChecks,
  MoonStar,
  SlidersHorizontal,
  Sunrise,
  Truck,
  X,
} from 'lucide-react';
import {
  choixClientValidesATraiter,
  conductorNotifications,
  demo,
  mostRecentPendingClientMoment,
  nameOf,
  pendingClientCommentCount,
  type DemoSnapshot,
} from '../store';
import { NotificationsFeed } from '../components/NotificationsFeed';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_SHORT } from '../lib/status';
import { cityOf } from '../lib/ville';
import type { CompagnonTab } from './CompagnonView';

/**
 * « Aujourd'hui » — le point du matin. Le conducteur ouvre PHÉNIX et voit SA
 * JOURNÉE, tous chantiers confondus (VISION.md Art. 3), avant d'entrer dans un
 * chantier. Aucune donnée inventée : tout est agrégé des faits (Art. 7 & 8).
 */

/**
 * Trois compteurs seulement — le matin doit se lire en cinq secondes. « À traiter »
 * agrège tout ce que le conducteur doit faire côté client/dossier (décisions,
 * choix validés, actions, réponses) ; les Réserves et les Livraisons gardent leur
 * propre compteur car ce sont des flux distincts. Chaque élément ouvre le bon
 * onglet (routage porté par l'élément, pas par le compteur).
 */
type FilterKind = 'a_traiter' | 'reserves' | 'livraisons';

const FILTERS: Record<FilterKind, { title: string }> = {
  a_traiter: { title: 'À traiter aujourd’hui' },
  reserves: { title: 'Réserves à lever' },
  livraisons: { title: 'Livraisons à contrôler' },
};

/** Un élément à traiter : son libellé, l'onglet à ouvrir, et s'il se « traite »
 *  d'un geste (choix validé → « Pris en compte »). */
type TaskItem = { key: string; label: string; tab: CompagnonTab; treatable?: boolean };

/** Libellé d'un choix validé : la catégorie et l'option retenue (ou délégation). */
function choixLabel(e: DecisionEvent): string {
  const c = e.content;
  return c.optionLabel ? `${c.categorie} — ${c.optionLabel}` : `Choix ${c.categorie.toLowerCase()}`;
}

/** Les axes d'« urgence » qui filtrent la liste des chantiers (ce qui reste à faire). */
type UrgenceKind = 'actions' | 'decisions' | 'reserves' | 'commentaires' | 'livraisons';

const URGENCE_LABEL: Record<UrgenceKind, string> = {
  actions: 'Avec actions à faire',
  decisions: 'Avec décisions client',
  reserves: 'Avec réserves à lever',
  commentaires: 'Avec commentaires client',
  livraisons: 'Avec livraisons',
};
const URGENCE_KINDS = Object.keys(URGENCE_LABEL) as UrgenceKind[];

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
  // Filtres de pilotage de la liste « Mes chantiers ». Ils se COMBINENT tous.
  // Statut : barre de puces toujours visible (le plus consulté au coup d'œil).
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  // Ville / client / urgence : affinages, repliés derrière « Filtres ».
  const [villeFilter, setVilleFilter] = useState<string | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string | 'all'>('all');
  const [urgenceFilter, setUrgenceFilter] = useState<UrgenceKind | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

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

  // Choix client VALIDÉS à prendre en compte (device-local : moins ceux déjà
  // traités). Symétrique des décisions « en attente » : ici, c'est au conducteur
  // d'agir (commander, prévenir l'artisan, planifier).
  const choixItems = (projectId: string): DecisionEvent[] =>
    choixClientValidesATraiter(snap, projectId);
  const totalChoix = briefing.chantiers.reduce((s, c) => s + choixItems(c.projectId).length, 0);

  const phrase = buildPhrase({ ...t, choix: totalChoix });

  const activeId =
    snap.projects.find((p) => p.id === snap.activeProjectId)?.id ?? snap.projects[0]?.id;

  // Compteur d'un chantier pour un filtre donné. « À traiter » agrège les quatre
  // natures de tâche conducteur ; réserves et livraisons restent distinctes.
  const countFor = (kind: FilterKind, c: ChantierResume): number => {
    switch (kind) {
      case 'a_traiter':
        return c.decisions + choixItems(c.projectId).length + c.actions + c.questions;
      case 'reserves':
        return c.reserves;
      case 'livraisons':
        return c.livraisons;
    }
  };

  // Les ÉLÉMENTS PRÉCIS d'un chantier pour un compteur donné — mêmes sélecteurs
  // que ceux qui produisent les compteurs (`buildDayBriefing`), donc cohérence
  // garantie entre le nombre et la liste. Chaque élément porte l'onglet à ouvrir.
  const itemsFor = (kind: FilterKind, projectId: string): TaskItem[] => {
    const events = eventsByProject[projectId] ?? [];
    switch (kind) {
      case 'a_traiter':
        return [
          ...pendingClientDecisions(events).map((d) => ({
            key: d.eventId,
            label: `Décision client · ${d.question}`,
            tab: 'suivi' as CompagnonTab,
          })),
          ...choixItems(projectId).map((e) => ({
            key: e.id,
            label: `Choix validé · ${choixLabel(e)}`,
            tab: 'suivi' as CompagnonTab,
            treatable: true,
          })),
          ...actionsOuvertes(events).map((e) => ({
            key: e.id,
            label: `Action · ${e.type === 'action' ? e.content.libelle : ''}`,
            tab: 'suivi' as CompagnonTab,
          })),
          ...questionsEnAttente(events).map((e) => ({
            key: e.id,
            label: `Question client · ${e.content.question}`,
            tab: 'suivi' as CompagnonTab,
          })),
        ];
      case 'reserves':
        // Plus d'onglet dédié « Réserves » : une réserve est un événement du
        // Journal. On ouvre le Suivi (historique), où elle se lit et se lève.
        return reservesOuvertes(events).map((r) => ({
          key: r.id,
          label: `Réserve n°${r.content.numero} · ${r.content.libelle}`,
          tab: 'suivi' as CompagnonTab,
        }));
      case 'livraisons':
        return (snap.dossiers[projectId]?.orders ?? [])
          .filter((o) => o.statut === 'commandee')
          .map((o) => ({
            key: o.id,
            label: o.fournisseur ? `${o.label} · ${o.fournisseur}` : o.label,
            tab: 'preparation' as CompagnonTab,
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
    ? briefing.chantiers.filter((c) => countFor(filter, c) > 0)
    : briefing.chantiers;

  // --- Filtres de pilotage (statut / ville / client / urgence), combinés. ---
  const projectById = (id: string) => snap.projects.find((p) => p.id === id);
  const villeOf = (c: ChantierResume): string | null => cityOf(projectById(c.projectId)?.address);
  const clientIdOf = (c: ChantierResume): string | undefined =>
    projectById(c.projectId)?.clientId ?? undefined;

  // Options DÉRIVÉES des chantiers (aucune saisie) : on n'affiche que le réel.
  const villeOptions = Array.from(
    new Set(briefing.chantiers.map(villeOf).filter((v): v is string => v !== null)),
  ).sort((a, b) => a.localeCompare(b, 'fr'));
  const clientOptions = Array.from(
    new Set(briefing.chantiers.map(clientIdOf).filter((v): v is string => v !== undefined)),
  )
    .map((id) => ({ id, name: nameOf(snap, id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const matchVille = (c: ChantierResume): boolean =>
    villeFilter === 'all' || villeOf(c) === villeFilter;
  const matchClient = (c: ChantierResume): boolean =>
    clientFilter === 'all' || clientIdOf(c) === clientFilter;
  const hasUrgence = (c: ChantierResume, k: UrgenceKind): boolean => {
    switch (k) {
      case 'actions':
        return c.actions > 0;
      case 'decisions':
        return c.decisions > 0;
      case 'reserves':
        return c.reserves > 0;
      case 'commentaires':
        return pendingClientCommentCount(snap, c.projectId) > 0;
      case 'livraisons':
        return c.livraisons > 0;
    }
  };
  const matchUrgence = (c: ChantierResume): boolean =>
    urgenceFilter === 'all' || hasUrgence(c, urgenceFilter);

  // Base = tous les axes SAUF le statut, pour garder des compteurs de statut
  // justes quand un autre filtre est actif (source de vérité : project.status).
  const baseChantiers = briefing.chantiers.filter(
    (c) => matchVille(c) && matchClient(c) && matchUrgence(c),
  );
  const statusCount = (s: ProjectStatus): number =>
    baseChantiers.filter((c) => c.status === s).length;
  const chantiersFiltered = baseChantiers.filter(
    (c) => statusFilter === 'all' || c.status === statusFilter,
  );

  const anyFilterActive =
    statusFilter !== 'all' ||
    villeFilter !== 'all' ||
    clientFilter !== 'all' ||
    urgenceFilter !== 'all';
  const advancedActiveCount =
    (villeFilter !== 'all' ? 1 : 0) +
    (clientFilter !== 'all' ? 1 : 0) +
    (urgenceFilter !== 'all' ? 1 : 0);
  const resetFilters = (): void => {
    setStatusFilter('all');
    setVilleFilter('all');
    setClientFilter('all');
    setUrgenceFilter('all');
  };

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

      {/* Notifications — ce que le CLIENT a fait (❤️, commentaire, décision).
          On réutilise Aujourd'hui : un clic ouvre l'élément et éteint le signal. */}
      <NotificationsFeed
        notifications={snap.projects.flatMap((p) => conductorNotifications(snap, p.id))}
        onOpen={(n) => {
          demo.markSeen('compagnon', n.seenKeys);
          onOpenChantier(n.projectId, n.tab as CompagnonTab | undefined, n.momentId);
        }}
      />

      {/* Ce qui réclame votre attention — trois compteurs, lus en cinq secondes.
          « À traiter » regroupe tout ce qui est sur votre bureau (décisions,
          choix validés, actions, réponses) ; Réserves et Livraisons à part. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<ListChecks aria-hidden />}
          value={t.decisions + totalChoix + t.actions + t.questions}
          label="à traiter aujourd’hui"
          accent
          active={filter === 'a_traiter'}
          onActivate={() => activateFilter('a_traiter')}
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
          icon={<Truck aria-hidden />}
          value={t.livraisons}
          label="livraisons à contrôler"
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
                    onOpenItem={(item) => onOpenChantier(c.projectId, item.tab)}
                    onTreatItem={(key) => demo.markChoixTraite(key)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                Mes chantiers ({chantiersFiltered.length}
                {chantiersFiltered.length !== t.chantiers ? ` sur ${t.chantiers}` : ''})
              </h2>
              <div className="flex items-center gap-2">
                {anyFilterActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <X aria-hidden /> Réinitialiser
                  </Button>
                )}
                <Button
                  variant={advancedActiveCount > 0 ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                >
                  <SlidersHorizontal aria-hidden /> Filtres
                  {advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ''}
                </Button>
              </div>
            </div>

            {/* STATUT — puces toujours visibles : le tri le plus fréquent, au coup
                d'œil. « Tous » d'abord, puis chaque statut présent (compteur juste,
                cohérent avec les autres filtres actifs). */}
            <div className="flex flex-wrap gap-2">
              <StatusChip
                label="Tous"
                count={baseChantiers.length}
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />
              {PROJECT_STATUSES.filter((s) => statusCount(s) > 0).map((s) => (
                <StatusChip
                  key={s}
                  label={PROJECT_STATUS_SHORT[s]}
                  count={statusCount(s)}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                />
              ))}
            </div>

            {/* Affinages VILLE / CLIENT / URGENCE — repliés derrière « Filtres »
                pour garder l'écran simple (Art. 11). Ils se combinent au statut. */}
            {showFilters && (
              <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3">
                <FilterSelect
                  label="Ville"
                  ariaLabel="Filtrer par ville"
                  value={villeFilter}
                  onChange={setVilleFilter}
                  allLabel="Toutes les villes"
                  options={villeOptions.map((v) => ({ value: v, label: v }))}
                  emptyHint={villeOptions.length === 0 ? 'Aucune ville renseignée' : undefined}
                />
                <FilterSelect
                  label="Client"
                  ariaLabel="Filtrer par client"
                  value={clientFilter}
                  onChange={setClientFilter}
                  allLabel="Tous les clients"
                  options={clientOptions.map((c) => ({ value: c.id, label: c.name }))}
                />
                <FilterSelect
                  label="Urgence"
                  ariaLabel="Filtrer par urgence"
                  value={urgenceFilter}
                  onChange={(v) => setUrgenceFilter(v as UrgenceKind | 'all')}
                  allLabel="Toutes"
                  options={URGENCE_KINDS.map((k) => ({ value: k, label: URGENCE_LABEL[k] }))}
                />
              </div>
            )}

            {chantiersFiltered.length === 0 ? (
              <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun chantier ne correspond à ces filtres.
                </p>
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X aria-hidden /> Réinitialiser les filtres
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {chantiersFiltered.map((c) => {
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
                          comments > 0
                            ? mostRecentPendingClientMoment(snap, c.projectId)
                            : undefined,
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
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
  choix: number;
}): string {
  const bits: string[] = [];
  if (t.decisions > 0) bits.push(`${t.decisions} décision${t.decisions > 1 ? 's' : ''} client`);
  if (t.choix > 0) bits.push(`${t.choix} choix client à traiter`);
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

/** Une puce de la barre de filtres par statut : libellé + compteur, active ou non. */
function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active
          ? 'border-gold-500 bg-gold-100 text-gold-800'
          : 'border-border bg-surface text-muted-foreground hover:border-gold-300 hover:bg-gold-50'
      }`}
    >
      {label}
      <span className={active ? 'text-gold-700' : 'text-foreground'}>({count})</span>
    </button>
  );
}

/** Un select d'affinage (ville / client / urgence) : libellé + « tout » + options. */
function FilterSelect({
  label,
  ariaLabel,
  value,
  onChange,
  allLabel,
  options,
  emptyHint,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  /** Message quand aucune option n'est dérivable (ex. aucune ville renseignée). */
  emptyHint?: string;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className="rounded-lg border border-input bg-surface px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-60"
      >
        <option value="all">{emptyHint ?? allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
  onTreatItem,
}: {
  name: string;
  clientName: string;
  step: string;
  active?: boolean;
  items: TaskItem[];
  onOpenItem: (item: TaskItem) => void;
  /** Action rapide par élément (ex. « Pris en compte » pour un choix validé). */
  onTreatItem?: (key: string) => void;
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
          <li key={it.key} className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => onOpenItem(it)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-paper-50 px-3 py-2 text-left text-sm text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {it.treatable && onTreatItem && (
              <button
                type="button"
                onClick={() => onTreatItem(it.key)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink-900 px-2.5 text-xs font-semibold text-paper-0 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
              >
                <Check aria-hidden />
                Pris en compte
              </button>
            )}
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
          <Badge variant={PROJECT_STATUS_BADGE[c.status]}>{PROJECT_STATUS_LABEL[c.status]}</Badge>
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
