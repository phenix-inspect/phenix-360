import { useState } from 'react';
import { Badge, Button, Card, CardContent } from '@phenix360/ui';
import { Download, Eye, EyeOff, FileText, Library } from 'lucide-react';
import {
  sortByDate,
  type Event,
  type EventActor,
  type Project,
  type ProjectDossier,
} from '@phenix360/core';
import { demo } from '../store';
import { DocumentButton } from './DocumentButton';
import { DocumentFilterBar } from './DocumentFilterBar';
import { PrepDocumentsSection } from './prep/PrepDocuments';
import { filterDocuments, type DocFilter } from '../lib/documentFilter';
import { generatedDocumentTitle } from '../lib/generatedDocument';
import { fmtDate } from '../lib/format';

/**
 * Onglet DOCUMENTS — répond à « où retrouver un document ? ». Il REGROUPE tout :
 * les documents de préparation (suivi d'obtention, dépôt, partage) ET la
 * bibliothèque de tous les documents/PV générés du chantier (devis, factures,
 * comptes rendus, pré-réception, réception…). Chaque document est consultable,
 * ouvrable, téléchargeable et — pour un fichier — partageable au client. On ne
 * cherche JAMAIS un document ailleurs. Aucune logique métier : lecture du journal.
 */
export function DocumentsTab({
  project,
  dossier,
  actor,
  events,
}: {
  project: Project;
  dossier: ProjectDossier | null;
  actor: EventActor;
  events: Event[];
}): React.JSX.Element {
  // La bibliothèque = tous les documents + comptes rendus du journal, SAUF ceux
  // déjà gérés par la préparation (évite tout doublon dans l'onglet).
  const dossierEventIds = new Set((dossier?.documents ?? []).map((d) => d.eventId).filter(Boolean));
  const library = sortByDate(
    events.filter(
      (e) => (e.type === 'document' || e.type === 'compte_rendu') && !dossierEventIds.has(e.id),
    ),
    'desc',
  );
  const [filter, setFilter] = useState<DocFilter>('tous');
  const shown = filterDocuments(library, filter);

  const patch = (next: Partial<ProjectDossier>): void => {
    if (dossier) demo.saveDossier(project.id, { ...dossier, ...next });
  };
  const askDocument = async (docId: string, label: string): Promise<void> => {
    if (!dossier) return;
    patch({
      documents: dossier.documents.map((d) =>
        d.id === docId ? { ...d, status: 'demande_client' } : d,
      ),
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'demande',
      visibility: 'client',
      state: 'ouverte',
      content: {
        question: `Pour préparer votre chantier, pouvez-vous nous transmettre : ${label} ?`,
        destinataire: 'client',
      },
    });
  };

  return (
    <div className="space-y-6">
      {dossier && (
        <PrepDocumentsSection
          project={project}
          dossier={dossier}
          patch={patch}
          onAskDocument={(docId, label) => void askDocument(docId, label)}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
            <Library aria-hidden />
            Bibliothèque du chantier
            <span className="text-muted-foreground">({library.length})</span>
          </h3>

          <DocumentFilterBar events={library} value={filter} onChange={setFilter} />

          {library.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
              Devis, factures, plans, comptes rendus, PV de pré-réception et de réception… tous vos
              documents se retrouveront ici. Un document s'ajoute via « Nouvelle mission ».
            </p>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
              Aucun document de ce type pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {shown.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface px-3 py-2.5"
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-gold-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{generatedDocumentTitle(e)}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {e.type === 'document' ? (e.content.categorie ?? 'Document') : 'Compte rendu'}{' '}
                      · {fmtDate(e.createdAt)}
                    </p>
                  </div>
                  <Badge variant={e.visibility === 'client' ? 'success' : 'neutral'}>
                    {e.visibility === 'client' ? 'Visible client' : 'Interne'}
                  </Badge>
                  <DocumentButton event={e} />
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Télécharger : ${generatedDocumentTitle(e)}`}
                    onClick={() => demo.downloadDocument(e)}
                  >
                    <Download aria-hidden /> Télécharger
                  </Button>
                  {e.type === 'document' && (
                    <Button
                      size="sm"
                      variant={e.visibility === 'client' ? 'primary' : 'outline'}
                      aria-label={
                        e.visibility === 'client'
                          ? `Rendre interne : ${e.content.libelle}`
                          : `Partager au client : ${e.content.libelle}`
                      }
                      onClick={() =>
                        void demo.setDocumentVisibility(
                          e.id,
                          e.visibility === 'client' ? 'interne' : 'client',
                        )
                      }
                    >
                      {e.visibility === 'client' ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                      {e.visibility === 'client' ? 'Visible client' : 'Partager'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
