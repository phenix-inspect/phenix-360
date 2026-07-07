import { useRef, useState } from 'react';
import { Button, Card, CardContent, Input } from '@phenix360/ui';
import {
  PREP_DOC_CATEGORIES,
  PREP_DOC_CATEGORY_LABEL,
  type EventAttachment,
  type EventVisibility,
  type PrepDocCategory,
  type Project,
  type ProjectDocument,
  type ProjectDossier,
} from '@phenix360/core';
import {
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { DocumentStatusBadge } from '../DocumentStatusBadge';
import { DocumentButton } from '../DocumentButton';
import { DocumentLink } from '../DocumentLink';
import { demo, useDemo } from '../../store';
import { readDocumentAttachment, readPhotoAttachment, MAX_DOC_MB } from '../../lib/upload';
import { ACCEPT_DOCUMENT, ACCEPT_IMAGE } from '../../lib/media';

const FILE_CATEGORIES = PREP_DOC_CATEGORIES.filter((c) => c !== 'photo_avant');

/**
 * Documents du chantier (EPIC 1 — Préparation) : devis, plans, diagnostics, DPE,
 * assurances, contrats… Chaque document a une famille, un état, et peut porter un
 * VRAI fichier (Lot 3) ouvrable. On peut aussi en ajouter un « à fournir » pour le
 * demander au client. VISION Art. 7, 8, 9.
 */
export function PrepDocumentsSection({
  project,
  dossier,
  patch,
  onAskDocument,
}: {
  project: Project;
  dossier: ProjectDossier;
  patch: (next: Partial<ProjectDossier>) => void;
  onAskDocument: (docId: string, label: string) => void;
}): React.JSX.Element {
  const snap = useDemo();
  const docs = dossier.documents.filter((d) => d.categorie !== 'photo_avant');
  const [label, setLabel] = useState('');
  const [categorie, setCategorie] = useState<PrepDocCategory>('devis');
  // Privé par défaut (anti-fuite) : le document ne part au client que sur choix.
  const [visibility, setVisibility] = useState<EventVisibility>('interne');
  const [pending, setPending] = useState<EventAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Le fichier vit dans la BIBLIOTHÈQUE (événement `document` du Journal) : on le
  // résout via `eventId`. Repli sur `attachment` pour d'anciennes données.
  const documentEvent = (d: ProjectDocument) =>
    d.eventId ? snap.events.find((e) => e.id === d.eventId && e.type === 'document') : undefined;
  const fileOf = (d: ProjectDocument): EventAttachment | undefined => {
    const ev = documentEvent(d);
    if (ev) return ev.type === 'document' ? ev.content.attachment : undefined;
    return d.attachment;
  };
  // Visibilité courante d'un document PARTAGEABLE (avec fichier au Journal) ; null
  // s'il n'a pas de fichier (rien à montrer au client).
  const visibilityOf = (d: ProjectDocument): EventVisibility | null =>
    documentEvent(d)?.visibility ?? null;

  const onPick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setError(null);
    const res = await readDocumentAttachment(project.id, file);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPending(res.value);
    if (!label.trim()) setLabel(res.value.fileName ?? 'Document');
  };

  const add = (): void => {
    const l = label.trim() || pending?.fileName || PREP_DOC_CATEGORY_LABEL[categorie];
    // Le fichier rejoint la bibliothèque unique (événement Journal) ; la checklist
    // ne fait que pointer vers lui (source unique — Consolidation Documents).
    void demo.addPrepDocument(project.id, {
      label: l,
      categorie,
      visibility,
      ...(pending ? { attachment: pending } : {}),
    });
    setLabel('');
    setPending(null);
    setVisibility('interne');
    setError(null);
  };

  const remove = (id: string): void =>
    patch({ documents: dossier.documents.filter((d) => d.id !== id) });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <FileText aria-hidden />
          Documents
          <span className="text-muted-foreground">({docs.length})</span>
        </h3>

        {docs.length > 0 && (
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
                      onClick={() =>
                        void demo.setPrepDocumentVisibility(
                          project.id,
                          d.id,
                          shared ? 'interne' : 'client',
                        )
                      }
                    >
                      {shared ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                      {shared ? 'Visible client' : 'Interne'}
                    </Button>
                  );
                })()}
                {(d.status === 'manquant' || d.status === 'a_fournir') && !fileOf(d) && (
                  <Button size="sm" variant="outline" onClick={() => onAskDocument(d.id, d.label)}>
                    Demander au client
                  </Button>
                )}
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

        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Libellé (ex. Devis plomberie signé)"
              aria-label="Libellé du document"
            />
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as PrepDocCategory)}
              aria-label="Type de document"
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {FILE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PREP_DOC_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Visibilité
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as EventVisibility)}
              aria-label="Visibilité du document"
              className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-foreground"
            >
              <option value="interne">Interne uniquement</option>
              <option value="client">Visible client</option>
            </select>
            <span>Par défaut interne — évite toute fuite tant que vous ne partagez pas.</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_DOCUMENT}
            className="hidden"
            data-testid="prep-doc-file"
            onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip aria-hidden />{' '}
              {pending ? pending.fileName : `Joindre un fichier (max ${MAX_DOC_MB} Mo)`}
            </Button>
            {pending && (
              <button
                type="button"
                aria-label="Retirer le fichier"
                onClick={() => setPending(null)}
                className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
              >
                <X aria-hidden />
              </button>
            )}
            <Button size="sm" className="ml-auto" onClick={add}>
              <Plus aria-hidden /> Ajouter le document
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </CardContent>
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
