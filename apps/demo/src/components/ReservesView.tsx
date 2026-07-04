import { useState } from 'react';
import { Badge, Button, Card, CardContent, EmptyState, Input } from '@phenix360/ui';
import {
  leveeDeReserve,
  reserveEvents,
  reserveStatut,
  type ActionPriorite,
  type Event,
  type EventActor,
  type Project,
  type ProjectId,
  type ReserveEvent,
} from '@phenix360/core';
import { AlertTriangle, CircleCheck, Flag, Image as ImageIcon, Plus, X } from 'lucide-react';
import { demo, nameOf, useDemo, type DemoSnapshot } from '../store';
import { fmtDate, fmtDateShort } from '../lib/format';
import { ContactActions } from './contacts/ContactActions';
import { ContactPicker } from './contacts/ContactPicker';

/**
 * Vue RÉSERVES — le REGISTRE pilotable du conducteur. Lecture des événements du
 * journal (réserves + levées), jamais une base séparée : le Journal reste la
 * source de vérité (VISION.md Art. 8). Le conducteur crée une réserve à la main,
 * la priorise, l'attribue, la date — et voit d'abord ce qui est EN RETARD. Tout
 * est interne : une réserve n'apparaît jamais côté client (Art. 9).
 */
const PRIORITE_RANK: Record<ActionPriorite, number> = { haute: 0, normale: 1, basse: 2 };

function sortOuvertes(list: ReserveEvent[]): ReserveEvent[] {
  return [...list].sort((a, b) => {
    const pa = PRIORITE_RANK[a.content.priorite ?? 'normale'];
    const pb = PRIORITE_RANK[b.content.priorite ?? 'normale'];
    if (pa !== pb) return pa - pb;
    // Ensuite : l'échéance la plus proche d'abord (sans échéance en dernier).
    const ea = a.content.echeance ?? '9999-12-31';
    const eb = b.content.echeance ?? '9999-12-31';
    return ea.localeCompare(eb);
  });
}

export function ReservesView({
  snap,
  project,
  actor,
  events,
  onLeverReserve,
  onOpenFilPhoto,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  events: Event[];
  onLeverReserve: (reserve: ReserveEvent) => void;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const all = reserveEvents(events);
  const today = new Date().toISOString().slice(0, 10);
  const ouvertes = all.filter((r) => reserveStatut(r, events) === 'ouverte');
  const enRetard = sortOuvertes(
    ouvertes.filter((r) => r.content.echeance != null && r.content.echeance < today),
  );
  const aLever = sortOuvertes(
    ouvertes.filter((r) => !(r.content.echeance != null && r.content.echeance < today)),
  );
  const levees = all.filter((r) => reserveStatut(r, events) === 'levee');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Réserves du chantier
          </h2>
          <p className="text-sm text-muted-foreground">
            Le pilotage des points à reprendre — une lecture du journal, jamais un double.
          </p>
        </div>
        <NewReserve project={project} actor={actor} />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={<Flag aria-hidden />}
          title="Aucune réserve"
          description="Ajoutez une réserve, ou créez-la depuis une photo annotée du Fil : elle apparaîtra ici, prête à être suivie puis levée."
        />
      ) : (
        <div className="space-y-6">
          {enRetard.length > 0 && (
            <Section
              title="En retard"
              count={enRetard.length}
              tone="danger"
              icon={<AlertTriangle aria-hidden />}
            >
              <ul className="space-y-3">
                {enRetard.map((r) => (
                  <OpenReserve
                    key={r.id}
                    r={r}
                    overdue
                    onLever={onLeverReserve}
                    onOpenFilPhoto={onOpenFilPhoto}
                  />
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="À lever"
            count={aLever.length}
            tone={aLever.length > 0 ? 'warn' : 'muted'}
          >
            {aLever.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {enRetard.length > 0
                  ? 'Aucune réserve à jour — voyez « En retard ».'
                  : 'Toutes les réserves sont levées. Rien à reprendre pour le moment.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {aLever.map((r) => (
                  <OpenReserve
                    key={r.id}
                    r={r}
                    overdue={false}
                    onLever={onLeverReserve}
                    onOpenFilPhoto={onOpenFilPhoto}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Levées"
            count={levees.length}
            tone={levees.length > 0 ? 'success' : 'muted'}
          >
            {levees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réserve levée pour l'instant.</p>
            ) : (
              <ul className="space-y-3">
                {levees.map((r) => (
                  <LeveeReserve
                    key={r.id}
                    r={r}
                    snap={snap}
                    events={events}
                    onOpenFilPhoto={onOpenFilPhoto}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Création manuelle ----------------------------- */

const PRIORITES: { id: ActionPriorite; label: string }[] = [
  { id: 'basse', label: 'Basse' },
  { id: 'normale', label: 'Normale' },
  { id: 'haute', label: 'Haute' },
];

function NewReserve({
  project,
  actor,
}: {
  project: Project;
  actor: EventActor;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [responsableContactId, setResponsableContactId] = useState<string | undefined>(undefined);
  const [echeance, setEcheance] = useState('');
  const [priorite, setPriorite] = useState<ActionPriorite>('normale');

  const reset = (): void => {
    setLibelle('');
    setResponsableContactId(undefined);
    setEcheance('');
    setPriorite('normale');
    setOpen(false);
  };

  const submit = async (): Promise<void> => {
    if (!libelle.trim()) return;
    await demo.createReserve(project.id, actor, {
      libelle,
      ...(responsableContactId ? { responsableContactId } : {}),
      echeance: echeance || undefined,
      priorite,
    });
    reset();
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Nouvelle réserve
      </Button>
    );
  }

  return (
    <Card className="w-full sm:w-96">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Nouvelle réserve</p>
          <button
            type="button"
            onClick={reset}
            aria-label="Annuler"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground [&_svg]:size-4"
          >
            <X aria-hidden />
          </button>
        </div>

        <Input
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="Le point à reprendre…"
          aria-label="Description de la réserve"
          autoFocus
        />

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Responsable</span>
          <ContactPicker
            projectId={project.id}
            value={responsableContactId}
            onChange={setResponsableContactId}
            label="Responsable"
            placeholder="Responsable (un contact)…"
          />
        </div>

        <input
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          aria-label="Échéance"
          className="h-9 w-full rounded-lg border border-input bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
        />

        <div className="flex items-center justify-between">
          <PrioritePicker value={priorite} onChange={setPriorite} />
          <Button size="sm" onClick={() => void submit()} disabled={!libelle.trim()}>
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PrioritePicker({
  value,
  onChange,
}: {
  value: ActionPriorite;
  onChange: (p: ActionPriorite) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-input">
      {PRIORITES.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={value === p.id}
          onClick={() => onChange(p.id)}
          className={`px-2.5 py-1 text-xs transition-colors ${
            value === p.id
              ? 'bg-gold-100 font-medium text-gold-800'
              : 'bg-surface text-muted-foreground'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Cartes ------------------------------------ */

function PrioriteBadge({ priorite }: { priorite?: ActionPriorite }): React.JSX.Element | null {
  if (!priorite || priorite === 'normale') return null;
  return (
    <Badge variant={priorite === 'haute' ? 'warning' : 'neutral'}>
      {priorite === 'haute' ? 'Priorité haute' : 'Priorité basse'}
    </Badge>
  );
}

function OpenReserve({
  r,
  overdue,
  onLever,
  onOpenFilPhoto,
}: {
  r: ReserveEvent;
  overdue: boolean;
  onLever: (reserve: ReserveEvent) => void;
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const snap = useDemo();
  // Le responsable est un CONTACT : on affiche son nom VIVANT (source unique) ;
  // repli sur l'instantané `responsable` pour les données historiques sans lien.
  const cid = r.content.responsableContactId;
  const responsableName = cid
    ? (snap.contacts.find((c) => c.id === cid)?.nom ?? r.content.responsable)
    : r.content.responsable;
  return (
    <li>
      <Card className={overdue ? 'border-destructive/40' : undefined}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
              <Flag aria-hidden />
              <span className="font-medium">Réserve n°{r.content.numero}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <PrioriteBadge priorite={r.content.priorite} />
              <Badge variant={overdue ? 'danger' : 'warning'}>
                {overdue ? 'en retard' : 'ouverte'}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-foreground">{r.content.libelle}</p>

          <MetaLine responsable={responsableName} echeance={r.content.echeance} overdue={overdue} />

          {cid && <ResponsableActions projectId={r.projectId} contactId={cid} />}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button size="sm" onClick={() => onLever(r)}>
              <CircleCheck aria-hidden /> Lever la réserve
            </Button>
            {r.content.source?.kind === 'fil' && (
              <VoirLaPhoto source={r.content.source} onOpen={onOpenFilPhoto} />
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function LeveeReserve({
  r,
  snap,
  events,
  onOpenFilPhoto,
}: {
  r: ReserveEvent;
  snap: DemoSnapshot;
  events: Event[];
  onOpenFilPhoto: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  const levee = leveeDeReserve(r, events);
  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-foreground [&_svg]:size-4 [&_svg]:text-success">
              <CircleCheck aria-hidden />
              <span className="font-medium">Réserve n°{r.content.numero}</span>
            </div>
            <Badge variant="success">levée</Badge>
          </div>

          <p className="text-sm text-foreground">{r.content.libelle}</p>

          <MetaLine
            responsable={r.content.responsable}
            echeance={r.content.echeance}
            overdue={false}
          />

          {levee && (
            <div className="rounded-lg border border-border bg-paper-50 p-3">
              <p className="text-xs text-muted-foreground">
                Levée le {fmtDate(levee.createdAt)} par {nameOf(snap, levee.actor.userId)}
              </p>
              {levee.content.note && (
                <p className="mt-1 text-sm text-foreground">{levee.content.note}</p>
              )}
              {levee.content.preuve && (
                <img
                  src={levee.content.preuve.imageUrl}
                  alt="Photo de preuve de la levée"
                  className="mt-2 aspect-[4/3] w-32 rounded-lg border border-border object-cover"
                />
              )}
            </div>
          )}

          {r.content.source?.kind === 'fil' && (
            <VoirLaPhoto source={r.content.source} onOpen={onOpenFilPhoto} />
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function Section({
  title,
  count,
  tone,
  icon,
  children,
}: {
  title: string;
  count: number;
  tone: 'danger' | 'warn' | 'success' | 'muted';
  icon?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const badge =
    tone === 'danger'
      ? 'danger'
      : tone === 'warn'
        ? 'warning'
        : tone === 'success'
          ? 'success'
          : 'neutral';
  return (
    <section className="space-y-3">
      <h3
        className={`flex items-center gap-2 text-sm font-medium ${
          tone === 'danger' ? 'text-destructive [&_svg]:size-4' : 'text-foreground'
        }`}
      >
        {icon}
        {title}
        <Badge variant={badge}>{count}</Badge>
      </h3>
      {children}
    </section>
  );
}

function MetaLine({
  responsable,
  echeance,
  overdue,
}: {
  responsable?: string;
  echeance?: string;
  overdue: boolean;
}): React.JSX.Element | null {
  if (!responsable && !echeance) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {responsable && (
        <span>
          Responsable : <span className="text-foreground">{responsable}</span>
        </span>
      )}
      {echeance && (
        <span className={overdue ? 'text-destructive' : undefined}>
          Échéance :{' '}
          <span className={overdue ? 'font-medium' : 'text-foreground'}>
            {fmtDateShort(echeance)}
          </span>
          {overdue ? ' · en retard' : ''}
        </span>
      )}
    </div>
  );
}

/**
 * Pont réserve → annuaire : le responsable EST un contact (lien direct, source
 * unique). PHÉNIX propose de le joindre en un geste — appeler, relancer par
 * SMS/WhatsApp — sans quitter la réserve (VISION Art. 6, 7). Toute action lancée
 * d'ici est tracée au Journal du chantier.
 */
function ResponsableActions({
  projectId,
  contactId,
}: {
  projectId: ProjectId;
  contactId: string;
}): React.JSX.Element | null {
  const snap = useDemo();
  const contact = snap.contacts.find((c) => c.id === contactId);
  if (!contact) return null;
  const project = snap.projects.find((p) => p.id === projectId);
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/60 p-2.5">
      <p className="mb-1.5 text-xs text-muted-foreground">
        Joindre <span className="font-medium text-foreground">{contact.nom}</span>
        {contact.societe ? ` · ${contact.societe}` : ''}
      </p>
      <ContactActions
        contact={contact}
        projectId={projectId}
        {...(project ? { chantierName: project.name } : {})}
        compact
      />
    </div>
  );
}

function VoirLaPhoto({
  source,
  onOpen,
}: {
  source: { momentId: string; photoId?: string };
  onOpen: (momentId: string, photoId?: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpen(source.momentId, source.photoId)}
      className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 underline-offset-4 hover:underline [&_svg]:size-3.5"
    >
      <ImageIcon aria-hidden /> Voir la photo
    </button>
  );
}
