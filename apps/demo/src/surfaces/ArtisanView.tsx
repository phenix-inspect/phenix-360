import { useState } from 'react';
import { Badge, Button, Card, CardContent, EmptyState, Input } from '@phenix360/ui';
import {
  isAction,
  isCompteRendu,
  reserveEvents,
  reserveStatut,
  userId,
  type ActionPriorite,
  type Event,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { CalendarClock, Camera, CheckCircle2, Flag, HardHat, ListChecks, Send } from 'lucide-react';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { fmtDateShort } from '../lib/format';
import { StepProgress } from '../components/StepProgress';

/**
 * MODE ARTISAN (EPIC 11) — l'espace du sous-traitant sur un chantier. Il reçoit
 * ses interventions (réserves + actions qui lui sont attribuées), voit son
 * planning, partage des photos et signale au conducteur qu'une intervention est
 * terminée (« à valider »). Il n'accède qu'à ce qui le concerne, jamais au privé
 * client : tout ce qu'il écrit est INTERNE (VISION.md Art. 9). Identité artisan
 * par sélecteur en V1 (l'authentification viendra avec l'EPIC 14).
 */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

interface Intervention {
  key: string;
  kind: 'reserve' | 'action';
  libelle: string;
  echeance?: string;
  priorite?: ActionPriorite;
  signalText: string;
}

export function ArtisanView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const events = snap.events.filter((e) => e.projectId === project.id);
  const moments = snap.fil.moments[project.id] ?? [];
  const clientName = norm(nameOf(snap, project.clientId));

  // Artisans du chantier : responsables des réserves/actions + intervenants des
  // moments (hors conducteur et client).
  const names = new Set<string>();
  for (const r of reserveEvents(events)) {
    const x = r.content.responsable?.trim();
    if (x) names.add(x);
  }
  for (const a of events.filter(isAction)) {
    const x = a.content.responsable?.trim();
    if (x) names.add(x);
  }
  for (const m of moments) {
    for (const i of m.intervenants ?? []) {
      const c = i.replace(/\s*\(.*\)\s*/, '').trim();
      if (c && !/conduct/i.test(i) && norm(c) !== clientName) names.add(c);
    }
  }
  const artisans = [...names].sort((a, b) => a.localeCompare(b));

  const storeKey = `phenix:artisan:${project.id}`;
  const [selected, setSelected] = useState<string>(
    () => localStorage.getItem(storeKey) ?? artisans[0] ?? '',
  );
  const [signaled, setSignaled] = useState<Set<string>>(new Set());

  const chooseArtisan = (name: string): void => {
    setSelected(name);
    setSignaled(new Set());
    localStorage.setItem(storeKey, name);
  };

  if (artisans.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <EmptyState
          icon={<HardHat aria-hidden />}
          title="Aucun artisan sur ce chantier"
          description="Attribuez une réserve ou une action à un artisan (ex. « Plombier ») : son espace apparaîtra ici."
        />
      </div>
    );
  }

  const actor: EventActor = {
    userId: userId(`artisan-${slug(selected)}`),
    role: 'sous_traitant',
    displayName: selected,
  };
  const isMine = (responsable?: string): boolean =>
    responsable != null && norm(responsable).includes(norm(selected));

  const interventions: Intervention[] = [
    ...reserveEvents(events)
      .filter((r) => reserveStatut(r, events) === 'ouverte' && isMine(r.content.responsable))
      .map((r) => ({
        key: r.id,
        kind: 'reserve' as const,
        libelle: r.content.libelle,
        echeance: r.content.echeance,
        priorite: r.content.priorite,
        signalText: `Réserve n°${r.content.numero} « ${r.content.libelle} » — terminée, à valider (signalé par ${selected}).`,
      })),
    ...events
      .filter(isAction)
      .filter((a) => a.content.statut === 'a_faire' && isMine(a.content.responsable))
      .map((a) => ({
        key: a.id,
        kind: 'action' as const,
        libelle: a.content.libelle,
        echeance: a.content.echeance,
        priorite: a.content.priorite,
        signalText: `Action « ${a.content.libelle} » — terminée, à valider (signalé par ${selected}).`,
      })),
  ];

  const signal = async (it: Intervention): Promise<void> => {
    await demo.artisanSignal(project.id, actor, it.signalText);
    setSignaled((s) => new Set(s).add(it.key));
  };

  const infos = events
    .filter(isCompteRendu)
    // Le récit PARTAGÉ du chantier — pas les notes internes du conducteur, qui
    // ne sont pas destinées à l'artisan (VISION Art. 9).
    .filter((e) => e.state === 'publie' && e.visibility === 'client')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête + identité */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
            <HardHat aria-hidden />
            Espace artisan
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Vous intervenez en tant que
          </span>
          <select
            value={selected}
            onChange={(e) => chooseArtisan(e.target.value)}
            aria-label="Choisir l'artisan"
            className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
          >
            {artisans.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mon planning */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <CalendarClock aria-hidden /> Où en est le chantier
        </h2>
        <Card>
          <CardContent className="p-4">
            <StepProgress current={project.currentStep} />
          </CardContent>
        </Card>
      </section>

      {/* Mes interventions */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <ListChecks aria-hidden /> Mes interventions
          <Badge variant={interventions.length > 0 ? 'warning' : 'neutral'}>
            {interventions.length}
          </Badge>
        </h2>
        {interventions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Rien à faire pour vous ici pour le moment. Le conducteur vous préviendra.
          </p>
        ) : (
          <ul className="space-y-3">
            {interventions.map((it) => {
              const done = signaled.has(it.key);
              return (
                <li key={it.key}>
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
                          {it.kind === 'reserve' ? (
                            <Flag aria-hidden />
                          ) : (
                            <ListChecks aria-hidden />
                          )}
                          <span className="font-medium">
                            {it.kind === 'reserve' ? 'Réserve' : 'Action'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {it.priorite === 'haute' && (
                            <Badge variant="warning">Priorité haute</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{it.libelle}</p>
                      {it.echeance && (
                        <p className="text-xs text-muted-foreground">
                          Échéance :{' '}
                          <span className="text-foreground">{fmtDateShort(it.echeance)}</span>
                        </p>
                      )}
                      <div className="pt-1">
                        {done ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-50 px-3 py-1.5 text-sm font-medium text-gold-800 [&_svg]:size-4">
                            <CheckCircle2 aria-hidden /> Signalé — en attente de validation
                          </span>
                        ) : (
                          <Button size="sm" onClick={() => void signal(it)}>
                            <CheckCircle2 aria-hidden /> Signaler terminé
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Partager mon avancement */}
      <ShareProgress project={project} actor={actor} />

      {/* Dernières infos du chantier */}
      {infos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Dernières infos du chantier</h2>
          <ul className="space-y-2">
            {infos.map((e) => (
              <li key={e.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm text-foreground">{e.content.texte}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(snap, e.actor.userId)} · {fmtDateShort(e.createdAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShareProgress({
  project,
  actor,
}: {
  project: Project;
  actor: EventActor;
}): React.JSX.Element {
  const [legende, setLegende] = useState('');
  const [piece, setPiece] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await demo.artisanPhoto(project.id, actor, { legende, piece });
      setLegende('');
      setPiece('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <Camera aria-hidden /> Partager mon avancement
      </h2>
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            Une photo, un mot — le conducteur reçoit votre avancement (jamais visible du client).
          </p>
          <Input
            value={legende}
            onChange={(e) => setLegende(e.target.value)}
            placeholder="Ex. Reprise du joint terminée"
            aria-label="Légende de la photo"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={piece}
              onChange={(e) => setPiece(e.target.value)}
              placeholder="Pièce (optionnel)"
              aria-label="Pièce"
              className="h-9 w-48"
            />
            <Button size="sm" onClick={() => void send()} disabled={busy}>
              <Send aria-hidden /> Envoyer au conducteur
            </Button>
            {sent && (
              <span className="inline-flex items-center gap-1 text-sm text-gold-700 [&_svg]:size-4">
                <CheckCircle2 aria-hidden /> Envoyé
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
