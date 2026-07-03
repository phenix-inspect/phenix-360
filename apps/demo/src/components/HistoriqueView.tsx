import { useState } from 'react';
import { ActivityItem, Badge, EmptyState, SegmentedControl, Timeline } from '@phenix360/ui';
import { projectHistory, sortByDate, type Event, type Project } from '@phenix360/core';
import { History, Star } from 'lucide-react';
import { demo, nameOf, pinnedOf, type DemoSnapshot } from '../store';
import { fmtDate } from '../lib/format';
import { eventDescription, eventTitle, journalStatut } from '../lib/eventText';
import { PhotoTile } from './PhotoTile';

/**
 * Historique du projet — la mémoire chronologique du chantier, du devis signé à
 * aujourd'hui. C'est une VUE du journal (jalons + événements épinglés), jamais
 * une base de données séparée. On n'efface rien : on raconte.
 */
export function HistoriqueView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const events = snap.events.filter((e) => e.projectId === project.id);
  const pinned = pinnedOf(snap, project.id);
  const [filter, setFilter] = useState<'tout' | 'epingles'>('tout');

  // Jalons du journal + tout événement épinglé (même hors jalon, ex. une photo).
  const byId = new Map<string, Event>();
  for (const e of projectHistory(events)) byId.set(e.id, e);
  for (const e of events) if (pinned.has(e.id)) byId.set(e.id, e);
  let items = sortByDate([...byId.values()], 'asc');
  if (filter === 'epingles') items = items.filter((e) => pinned.has(e.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Historique du projet
          </h2>
          <p className="text-sm text-muted-foreground">
            Toute la vie de votre chantier, du devis signé jusqu'à aujourd'hui.
          </p>
        </div>
        <SegmentedControl
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'tout', label: 'Tout' },
            { value: 'epingles', label: 'Épinglés' },
          ]}
          aria-label="Filtrer l'historique"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={filter === 'epingles' ? <Star aria-hidden /> : <History aria-hidden />}
          title={filter === 'epingles' ? 'Aucun moment épinglé' : "L'histoire commence bientôt"}
          description={
            filter === 'epingles'
              ? 'Épinglez les moments importants pour les retrouver et raconter le chantier.'
              : 'Les moments marquants du chantier apparaîtront ici, du premier jour à la réception.'
          }
        />
      ) : (
        <Timeline>
          {items.map((e) => {
            const isPinned = pinned.has(e.id);
            const badge = journalStatut(e, events);
            return (
              <ActivityItem
                key={e.id}
                type={e.type}
                title={eventTitle(e)}
                description={eventDescription(e)}
                date={fmtDate(e.createdAt)}
                author={nameOf(snap, e.actor.userId)}
                authorRole={e.actor.role}
                visibility={e.visibility}
                media={
                  e.type === 'photo' && isPinned ? (
                    <PhotoTile photo={e} size="thumb" className="w-28" />
                  ) : undefined
                }
              >
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  <button
                    type="button"
                    onClick={() => demo.togglePin(project.id, e.id)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5 ${
                      isPinned ? 'text-gold-700' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Star aria-hidden className={isPinned ? 'fill-current' : ''} />
                    {isPinned ? 'Épinglé' : 'Épingler'}
                  </button>
                </span>
              </ActivityItem>
            );
          })}
        </Timeline>
      )}
    </div>
  );
}
