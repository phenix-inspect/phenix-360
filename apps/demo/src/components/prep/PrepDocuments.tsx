import { useRef, useState } from 'react';
import { Button, Card, CardContent } from '@phenix360/ui';
import {
  PREP_DOC_CATEGORY_LABEL,
  type EventVisibility,
  type Project,
  type ProjectDocument,
  type ProjectDossier,
} from '@phenix360/core';
import { Camera, ChevronDown, Eye, EyeOff, FileText, ImagePlus, X } from 'lucide-react';
import { DocumentStatusBadge } from '../DocumentStatusBadge';
import { DocumentButton } from '../DocumentButton';
import { DocumentLink } from '../DocumentLink';
import { DiffusionConfirmDialog } from '../DiffusionConfirmDialog';
import { demo, nameOf, useDemo } from '../../store';
import { readPhotoAttachment } from '../../lib/upload';
import { ACCEPT_IMAGE } from '../../lib/media';

/**
 * Documents du chantier (EPIC 1 — Préparation) : devis, plans, diagnostics, DPE,
 * assurances, contrats… CONSULTATION uniquement — l'ajout d'un document passe
 * EXCLUSIVEMENT par « Nouvelle mission → Ajouter un document » (un seul point
 * d'entrée, aucun doublon). Ici on suit l'état d'obtention, on ouvre le fichier,
 * on demande au client et on partage. VISION Art. 7, 8, 9.
 */
export function PrepDocumentsSection({
  project,
  dossier,
  patch,
}: {
  project: Project;
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const snap = useDemo();
  const docs = dossier.documents.filter((d) => d.categorie !== 'photo_avant');

  // Le fichier vit dans la BIBLIOTHÈQUE (événement `document` du Journal) : on le
  // résout via `eventId`. Repli sur `attachment` pour d'anciennes données.
  const documentEvent = (d: ProjectDocument) =>
    d.eventId ? snap.events.find((e) => e.id === d.eventId && e.type === 'document') : undefined;
  // Visibilité courante d'un document PARTAGEABLE (avec fichier au Journal) ; null
  // s'il n'a pas de fichier (rien à montrer au client).
  const visibilityOf = (d: ProjectDocument): EventVisibility | null =>
    documentEvent(d)?.visibility ?? null;

  const remove = (id: string): void =>
    patch({ documents: dossier.documents.filter((d) => d.id !== id) });

  // Diffusion client sous confirmation explicite (Condition bêta #2) : rendre un
  // document visible au client passe par un récapitulatif, jamais un simple clic.
  const clientName = project.clientId ? nameOf(snap, project.clientId) : undefined;
  const [diffuseDoc, setDiffuseDoc] = useState<ProjectDocument | null>(null);
  const [diffusing, setDiffusing] = useState(false);
  const confirmDiffusion = async (): Promise<void> => {
    if (!diffuseDoc || diffusing) return;
    setDiffusing(true);
    try {
      await demo.setPrepDocumentVisibility(project.id, diffuseDoc.id, 'client');
      setDiffuseDoc(null);
    } finally {
      setDiffusing(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <FileText aria-hidden />
          Documents
          <span className="text-muted-foreground">({docs.length})</span>
        </h3>

        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
            Les documents de préparation apparaîtront ici. Pour en ajouter un, passez par « Nouvelle
            mission → Ajouter un document ».
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{d.label}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {PREP_DOC_CATEGORY_LABEL[d.categorie ?? 'autre']}
                  </p>
                </div>
                <DocumentStatusBadge status={d.status} />
                {(() => {
                  // Document rattaché à la bibliothèque (événement) → toujours
                  // consultable (fichier réel OU document généré par PHÉNIX).
                  // Repli legacy : un attachment porté par le dossier (avant la
                  // Consolidation Documents).
                  const ev = documentEvent(d);
                  if (ev) return <DocumentButton event={ev} />;
                  return d.attachment?.dataUrl ? <DocumentLink attachment={d.attachment} /> : null;
                })()}
                {(() => {
                  // Bascule interne ↔ visible client (documents AVEC fichier).
                  const vis = visibilityOf(d);
                  if (!vis) return null;
                  const shared = vis === 'client';
                  return (
                    <Button
                      size="sm"
                      variant={shared ? 'primary' : 'outline'}
                      aria-label={
                        shared
                          ? `Rendre interne : ${d.label}`
                          : `Rendre visible au client : ${d.label}`
                      }
                      onClick={() => {
                        // interne → client = DIFFUSION : confirmation explicite.
                        // client → interne = masquer : direct (rien ne part au client).
                        if (shared)
                          void demo.setPrepDocumentVisibility(project.id, d.id, 'interne');
                        else setDiffuseDoc(d);
                      }}
                    >
                      {/* Libellé = ACTION du clic (verbe), jamais un statut. */}
                      {shared ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      {shared ? 'Ne plus partager' : 'Partager'}
                    </Button>
                  );
                })()}
                <button
                  type="button"
                  aria-label={`Retirer ${d.label}`}
                  onClick={() => remove(d.id)}
                  className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DiffusionConfirmDialog
        open={diffuseDoc !== null}
        documentLabel={diffuseDoc?.label ?? ''}
        clientName={clientName}
        busy={diffusing}
        onCancel={() => setDiffuseDoc(null)}
        onConfirm={() => void confirmDiffusion()}
      />
    </Card>
  );
}

/**
 * Photos avant travaux — l'état des lieux visuel (preuve en cas de litige). Utile
 * SURTOUT à la création : on ne les efface pas, mais on les tient REPLIÉES par
 * défaut pour ne pas polluer le quotidien. Accessibles à la demande (« Voir »).
 */
export function PhotosAvantSection({
  project,
  dossier,
  patch,
}: {
  project: Project;
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
}): React.JSX.Element {
  const photos = dossier.documents.filter((d) => d.categorie === 'photo_avant' && d.attachment);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setError(null);
    const added: ProjectDocument[] = [];
    for (const file of Array.from(files)) {
      const res = await readPhotoAttachment(project.id, file);
      if (!res.ok) {
        setError(res.error);
        break;
      }
      added.push({
        id: crypto.randomUUID(),
        label: res.value.fileName ?? 'Photo avant travaux',
        categorie: 'photo_avant',
        status: 'fourni',
        attachment: res.value,
      });
    }
    if (added.length) patch({ documents: [...dossier.documents, ...added] });
  };

  const remove = (id: string): void =>
    patch({ documents: dossier.documents.filter((d) => d.id !== id) });

  return (
    <Card>
      <CardContent className="p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4"
        >
          <Camera aria-hidden className="text-gold-600" />
          Photos avant travaux
          <span className="text-muted-foreground">({photos.length})</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            {open ? 'Masquer' : 'Voir'}
            <ChevronDown aria-hidden className={open ? 'rotate-180' : undefined} />
          </span>
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photos.map((d) => (
                  <div key={d.id} className="relative overflow-hidden rounded-lg">
                    <img
                      src={d.attachment!.dataUrl}
                      alt={d.label}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Retirer ${d.label}`}
                      onClick={() => remove(d.id)}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-paper-0 [&_svg]:size-3.5"
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_IMAGE}
              multiple
              className="hidden"
              data-testid="prep-photo-file"
              onChange={(e) => {
                void onPick(e.target.files);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden /> Ajouter des photos
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
