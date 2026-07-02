import {
  PROJECT_STEP_LABEL,
  buildDayBriefing,
  type Event,
  type ChantierResume,
} from '@phenix360/core';
import { ChevronRight, Flag, HelpCircle, MessageSquare, Sunrise, Truck } from 'lucide-react';
import { nameOf, type DemoSnapshot } from '../store';

/**
 * « Aujourd'hui » — le point du matin. Le conducteur ouvre PHÉNIX et voit SA
 * JOURNÉE, tous chantiers confondus (VISION.md Art. 3), avant d'entrer dans un
 * chantier. Aucune donnée inventée : tout est agrégé des faits (Art. 7 & 8).
 */
export function AujourdhuiView({
  snap,
  onOpenChantier,
}: {
  snap: DemoSnapshot;
  onOpenChantier: (projectId: string) => void;
}): React.JSX.Element {
  const compagnon = snap.members.find((m) => m.role === 'compagnon');
  const prenom = compagnon ? nameOf(snap, compagnon.userId) : 'Mickaël';

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

      {/* Ce qui réclame votre attention */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<HelpCircle aria-hidden />}
          value={t.decisions}
          label="décisions clients"
          accent
        />
        <Stat icon={<Flag aria-hidden />} value={t.reserves} label="réserves à lever" accent />
        <Stat icon={<MessageSquare aria-hidden />} value={t.questions} label="clients à répondre" />
        <Stat icon={<Truck aria-hidden />} value={t.livraisons} label="livraisons prévues" />
      </div>

      {/* Mes chantiers */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
          Mes chantiers ({t.chantiers})
        </h2>
        <div className="space-y-2">
          {briefing.chantiers.map((c) => (
            <ChantierCard
              key={c.projectId}
              chantier={c}
              clientName={nameOf(snap, projectClientId(snap, c.projectId))}
              onOpen={() => onOpenChantier(c.projectId)}
            />
          ))}
        </div>
      </section>
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
}): string {
  const bits: string[] = [];
  if (t.decisions > 0) bits.push(`${t.decisions} décision${t.decisions > 1 ? 's' : ''} client`);
  if (t.questions > 0) bits.push(`${t.questions} client${t.questions > 1 ? 's' : ''} à répondre`);
  if (t.reserves > 0) bits.push(`${t.reserves} réserve${t.reserves > 1 ? 's' : ''} à lever`);
  if (bits.length === 0) return 'Rien d’urgent aujourd’hui. Vos chantiers avancent sereinement.';
  return `Aujourd’hui, ${bits.join(', ')} réclament votre attention.`;
}

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}): React.JSX.Element {
  const highlight = accent && value > 0;
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? 'border-gold-300 bg-gold-50' : 'border-border bg-surface'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs ${
          highlight ? 'text-gold-700' : 'text-muted-foreground'
        } [&_svg]:size-3.5`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChantierCard({
  chantier,
  clientName,
  onOpen,
}: {
  chantier: ChantierResume;
  clientName: string;
  onOpen: () => void;
}): React.JSX.Element {
  const c = chantier;
  const badges: { label: string; accent?: boolean }[] = [];
  if (c.decisions > 0) badges.push({ label: `${c.decisions} décision client`, accent: true });
  if (c.questions > 0) badges.push({ label: `${c.questions} à répondre`, accent: true });
  if (c.reserves > 0) badges.push({ label: `${c.reserves} réserve${c.reserves > 1 ? 's' : ''}` });
  if (c.livraisons > 0)
    badges.push({ label: `${c.livraisons} livraison${c.livraisons > 1 ? 's' : ''}` });

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        c.urgent ? 'border-gold-200 bg-surface' : 'border-border bg-surface'
      }`}
    >
      <span
        className={`mt-0.5 h-10 w-1.5 shrink-0 rounded-full ${c.urgent ? 'bg-gold-500' : 'bg-border'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-serif text-lg font-semibold text-foreground">{c.name}</span>
          <span className="text-xs text-muted-foreground">{clientName}</span>
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
