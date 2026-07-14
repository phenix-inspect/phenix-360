import { useState } from 'react';
import { Badge, Button, Card, CardContent } from '@phenix360/ui';
import { Download, Eye, EyeOff, FileText, Library, MailQuestion } from 'lucide-react';
import { sortByDate, type Event, type Project, type ProjectDossier } from '@phenix360/core';
import { demo, nameOf } from '../store';
import { DocumentButton } from './DocumentButton';
import { DocumentFilterBar } from './DocumentFilterBar';
import { PrepDocumentsSection } from './prep/PrepDocuments';
import { DiffusionConfirmDialog } from './DiffusionConfirmDialog';
import { filterDocuments, type DocFilter } from '../lib/documentFilter';
import { generatedDocumentTitle } from '../lib/generatedDocument';
import { fmtDate } from '../lib/format';

/**
 * Onglet DOCUMENTS — répond à « où retrouver un document ? ». Il REGROUPE tout :
 * le suivi des documents DEMANDÉS au client (avec leur statut « Reçu »), les
 * documents de préparation, ET la bibliothèque de tous les documents/PV générés du
 * chantier. Chaque document est consultable, ouvrable, téléchargeable et — pour un
 * fichier — partageable. CONSULTATION uniquement : on ne CRÉE rien ici (créer une
 * demande passe par « Nouvelle mission → Demander au client »).
 */
export function DocumentsTab({
  project,
  dossier,
  events,
}: {
  project: Project;
  dossier: ProjectDossier | null;
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

  // Diffusion client sous confirmation explicite (Condition bêta #2). Un document
  // interne ne devient JAMAIS visible du client sur un simple clic : récapitulatif
  // puis « Confirmer la diffusion au client ». Le repli interne (masquer) reste direct.
  const snap = demo.getSnapshot();
  const clientName = project.clientId ? nameOf(snap, project.clientId) : undefined;
  const [diffuseDoc, setDiffuseDoc] = useState<Extract<Event, { type: 'document' }> | null>(null);
  const [diffusing, setDiffusing] = useState(false);
  const confirmDiffusion = async (): Promise<void> => {
    if (!diffuseDoc || diffusing) return;
    setDiffusing(true);
    try {
      await demo.setDocumentVisibility(diffuseDoc.id, 'client');
      setDiffuseDoc(null);
    } finally {
      setDiffusing(false);
    }
  };

  // Suivi des documents DEMANDÉS au client (créés via « Nouvelle mission »). Le
  // clic n'agit pas : c'est un tableau de bord de consultation (En attente / Reçu).
  const docRequests = sortByDate(
    events.filter(
      (e): e is Extract<Event, { type: 'demande' }> =>
        e.type === 'demande' &&
        e.content.destinataire === 'client' &&
        e.content.attendu === 'document',
    ),
    'desc',
  );

  const patch = (next: Partial<ProjectDossier>): void => {
    if (dossier) demo.saveDossier(project.id, { ...dossier, ...next });
  };

  return (
    <div className="space-y-6">
      {docRequests.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
              <MailQuestion aria-hidden />
              Documents demandés au client
              <span className="text-muted-foreground">({docRequests.length})</span>
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {docRequests.map((r) => {
                const docId = r.content.resolution?.docEventId;
                const docEv = docId
                  ? events.find((e) => e.id === docId && e.type === 'document')
                  : undefined;
                // « Reçu » = un document a été fourni ; « Répondu » = réponse sans
                // document (commentaire seul) ; sinon « En attente ».
                const status = docEv ? 'Reçu' : r.state === 'traitee' ? 'Répondu' : 'En attente';
                const variant = docEv ? 'success' : r.state === 'traitee' ? 'neutral' : 'warning';
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface px-3 py-2.5"
                  >
                    {docEv ? (
                      <button
                        type="button"
                        onClick={() => demo.openDocument(docEv)}
                        aria-label={`Ouvrir : ${generatedDocumentTitle(docEv)}`}
                        className="group flex min-w-0 flex-1 flex-col rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate text-sm text-foreground group-hover:text-gold-700 group-hover:underline">
                          {r.content.docLibelle ?? r.content.question}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {r.content.docCategorie ?? 'Document'}
                          {r.content.echeance ? ` · avant le ${fmtDate(r.content.echeance)}` : ''}
                        </span>
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {r.content.docLibelle ?? r.content.question}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {r.content.docCategorie ?? 'Document'}
                          {r.content.echeance ? ` · avant le ${fmtDate(r.content.echeance)}` : ''}
                        </p>
                      </div>
                    )}
                    <Badge variant={variant}>{status}</Badge>
                    {docEv && <DocumentButton event={docEv} />}
                    {docEv && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Télécharger : ${generatedDocumentTitle(docEv)}`}
                        onClick={() => demo.downloadDocument(docEv)}
                      >
                        <Download aria-hidden /> Télécharger le fichier
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {dossier && <PrepDocumentsSection project={project} dossier={dossier} patch={patch} />}

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
                  <button
                    type="button"
                    onClick={() => demo.openDocument(e)}
                    aria-label={`Ouvrir : ${generatedDocumentTitle(e)}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:text-gold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText
                      aria-hidden
                      className="size-4 shrink-0 text-gold-600 group-hover:text-gold-700"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground group-hover:underline">
                        {generatedDocumentTitle(e)}
                      </span>
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                        {e.type === 'document'
                          ? (e.content.categorie ?? 'Document')
                          : 'Compte rendu'}{' '}
                        · {fmtDate(e.createdAt)}
                      </span>
                    </span>
                  </button>
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
                    <Download aria-hidden />{' '}
                    {e.type === 'document' ? 'Télécharger le fichier' : 'Télécharger en PDF'}
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
                      onClick={() => {
                        // interne → client = DIFFUSION : passe par la confirmation.
                        // client → interne = masquer : action directe (rien ne part au client).
                        if (e.visibility === 'client')
                          void demo.setDocumentVisibility(e.id, 'interne');
                        else setDiffuseDoc(e);
                      }}
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

      <DiffusionConfirmDialog
        open={diffuseDoc !== null}
        documentLabel={diffuseDoc?.content.libelle ?? ''}
        clientName={clientName}
        busy={diffusing}
        onCancel={() => setDiffuseDoc(null)}
        onConfirm={() => void confirmDiffusion()}
      />
    </div>
  );
}
