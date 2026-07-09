import { useState } from 'react';
import { Button } from '@phenix360/ui';
import { Download, FileText } from 'lucide-react';
import { sortByDate, type CrAudience, type Event } from '@phenix360/core';
import { demo } from '../store';
import { DocumentButton } from './DocumentButton';
import { DocumentFilterBar } from './DocumentFilterBar';
import { filterDocuments, type DocFilter } from '../lib/documentFilter';
import { generatedDocumentTitle } from '../lib/generatedDocument';
import { fmtDate } from '../lib/format';

/**
 * Onglet DOCUMENTS de l'ESPACE CLIENT — « où retrouver mes documents ? ». Tout y
 * est : devis, avenants, factures, comptes rendus, visites, PV de pré-réception /
 * réception, garanties, notices… Chaque document s'OUVRE et se TÉLÉCHARGE, et se
 * FILTRE par type (même filtre que le conducteur). Le client ne cherche jamais
 * ailleurs. On ne lit QUE ce qui lui est partagé, on ne crée jamais rien.
 */
export function ClientDocuments({
  events,
  audience = 'conducteur',
}: {
  events: Event[];
  /** Version des comptes rendus ouverts/téléchargés (filtrage par destinataire). */
  audience?: CrAudience;
}): React.JSX.Element {
  const all = sortByDate(
    events.filter((e) => e.type === 'document' || e.type === 'compte_rendu'),
    'desc',
  );
  const [filter, setFilter] = useState<DocFilter>('tous');
  const docs = filterDocuments(all, filter);

  if (all.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
        Vos devis, factures, comptes rendus et attestations apparaîtront ici, prêts à être ouverts
        ou téléchargés.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <DocumentFilterBar events={all} value={filter} onChange={setFilter} />

      {docs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          Aucun document de ce type pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {docs.map((e) => (
            <li
              key={e.id}
              id={`ev-${e.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface px-4 py-3"
            >
              <button
                type="button"
                onClick={() => demo.openDocument(e, audience)}
                aria-label={`Ouvrir : ${generatedDocumentTitle(e)}`}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileText
                  aria-hidden
                  className="size-5 shrink-0 text-gold-600 group-hover:text-gold-700"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground group-hover:text-gold-700 group-hover:underline">
                    {generatedDocumentTitle(e)}
                  </span>
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                    {e.type === 'document' ? (e.content.categorie ?? 'Document') : 'Compte rendu'} ·{' '}
                    {fmtDate(e.createdAt)}
                  </span>
                </span>
              </button>
              <DocumentButton event={e} audience={audience} />
              <Button
                size="sm"
                variant="outline"
                aria-label={`Télécharger : ${generatedDocumentTitle(e)}`}
                onClick={() => demo.downloadDocument(e, audience)}
              >
                <Download aria-hidden /> Télécharger
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
