import type { Event } from '@phenix360/core';
import {
  DOC_FAMILY_LABEL,
  documentFamily,
  presentFamilies,
  type DocFilter,
} from '../lib/documentFilter';

/**
 * Barre de filtres par TYPE de document — identique côté conducteur et côté client.
 * On n'affiche que les familles réellement présentes (plus « Tous »), avec le
 * compte de chacune. Purement présentationnel : le filtrage est calculé en amont,
 * aucune donnée n'est modifiée. Masquée s'il n'y a qu'une seule famille (inutile).
 */
export function DocumentFilterBar({
  events,
  value,
  onChange,
}: {
  events: Event[];
  value: DocFilter;
  onChange: (next: DocFilter) => void;
}): React.JSX.Element | null {
  const families = presentFamilies(events);
  if (families.length <= 1) return null;

  const countOf = (f: DocFilter): number =>
    f === 'tous' ? events.length : events.filter((e) => documentFamily(e) === f).length;

  const chip = (f: DocFilter, label: string): React.JSX.Element => {
    const active = value === f;
    return (
      <button
        key={f}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onChange(f)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active
            ? 'border-gold-300 bg-gold-50 text-gold-800'
            : 'border-border bg-surface text-muted-foreground hover:border-gold-300 hover:text-foreground'
        }`}
      >
        {label}
        <span className={active ? 'text-gold-600' : 'text-muted-foreground'}>({countOf(f)})</span>
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Filtrer les documents par type"
      className="flex flex-wrap gap-1.5"
    >
      {chip('tous', 'Tous')}
      {families.map((f) => chip(f, DOC_FAMILY_LABEL[f]))}
    </div>
  );
}
