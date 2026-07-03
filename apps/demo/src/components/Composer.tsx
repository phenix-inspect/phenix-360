import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Textarea,
} from '@phenix360/ui';
import {
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  questionsEnAttente,
  type Event,
  type EventActor,
  type EventAttachment,
  type Project,
  type ProjectStep,
} from '@phenix360/core';
import { FileText, Image as ImageIcon, Inbox, Upload, X } from 'lucide-react';
import { demo } from '../store';
import { MAX_DOC_MB, readDocumentAttachment, readPhotoAttachment } from '../lib/upload';

export type ComposerKind = 'compte_rendu' | 'photo' | 'document' | 'demande' | 'repondre';

const TITLES: Record<ComposerKind, { title: string; description: string }> = {
  compte_rendu: {
    title: 'Nouveau compte rendu',
    description: 'Décrivez l’avancée du jour. Visible par votre client.',
  },
  photo: { title: 'Ajouter des photos', description: 'Partagez l’avancement en images.' },
  document: { title: 'Ajouter un document', description: 'Devis, plan, facture…' },
  demande: {
    title: 'Demander une décision au client',
    description: 'Posez une question ou soumettez un choix à votre client.',
  },
  repondre: {
    title: 'Répondre au client',
    description: 'Les questions du client en attente de votre réponse.',
  },
};

/** Composer ciblé (un dialogue par action). Réutilise les ports `demo.*`. */
export function Composer({
  kind,
  project,
  actor,
  events,
  onClose,
}: {
  kind: ComposerKind | null;
  project: Project;
  actor: EventActor;
  events: Event[];
  onClose: () => void;
}): React.JSX.Element | null {
  if (kind === null) return null;
  const meta = TITLES[kind];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        {kind === 'repondre' ? (
          <ReplyList project={project} actor={actor} events={events} onDone={onClose} />
        ) : (
          <CaptureForm kind={kind} project={project} actor={actor} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CaptureForm({
  kind,
  project,
  actor,
  onDone,
}: {
  kind: Exclude<ComposerKind, 'repondre'>;
  project: Project;
  actor: EventActor;
  onDone: () => void;
}): React.JSX.Element {
  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState<ProjectStep>(project.currentStep ?? 'gros_oeuvre');
  const [legende, setLegende] = useState('');
  const [piece, setPiece] = useState('');
  const [libelle, setLibelle] = useState('');
  const [question, setQuestion] = useState('');
  const [visibility, setVisibility] = useState<'client' | 'interne'>('client');
  // Vrais fichiers (Lot 3) : aperçu local base64.
  const [photos, setPhotos] = useState<EventAttachment[]>([]);
  const [doc, setDoc] = useState<EventAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  const onPickPhotos = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const res = await readPhotoAttachment(project.id, file);
        if (!res.ok) {
          setUploadError(res.error); // message clair, on stoppe l'ajout
          return;
        }
        setPhotos((p) => [...p, res.value]);
      }
    } finally {
      setBusy(false);
    }
  };

  const onPickDoc = async (files: FileList | null): Promise<void> => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const res = await readDocumentAttachment(project.id, file);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setDoc(res.value);
      if (!libelle.trim()) setLibelle(res.value.fileName ?? 'Document');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    kind === 'compte_rendu'
      ? texte.trim().length > 0
      : kind === 'photo'
        ? photos.length > 0
        : kind === 'document'
          ? doc !== null && libelle.trim().length > 0
          : question.trim().length > 0;

  const submit = async (publish: boolean) => {
    if (!canSubmit || busy) return;
    const base = { projectId: project.id, actor, visibility } as const;
    if (kind === 'compte_rendu') {
      await demo.appendEvent({
        ...base,
        type: 'compte_rendu',
        state: publish ? 'publie' : 'brouillon',
        content: { texte: texte.trim(), etapeProposee: etape, etapeConfirmee: etape },
      });
    } else if (kind === 'photo') {
      // Une vraie photo = un événement (album géré par Le Fil).
      for (const attachment of photos) {
        await demo.appendEvent({
          ...base,
          type: 'photo',
          state: publish ? 'publie' : 'brouillon',
          content: {
            attachment,
            legende: legende.trim() || undefined,
            piece: piece.trim() || undefined,
          },
        });
      }
    } else if (kind === 'document') {
      if (!doc) return;
      await demo.appendEvent({
        ...base,
        type: 'document',
        state: publish ? 'publie' : 'brouillon',
        content: { attachment: doc, libelle: libelle.trim() },
      });
    } else {
      await demo.appendEvent({
        projectId: project.id,
        actor,
        visibility: 'client',
        type: 'demande',
        state: 'ouverte',
        content: { question: question.trim(), destinataire: 'client' },
      });
    }
    onDone();
  };

  const selectCls = 'h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground';

  return (
    <div className="space-y-4">
      {kind === 'compte_rendu' && (
        <>
          <Textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ex. Dalle coulée, séchage en cours…"
            rows={3}
            autoFocus
          />
          <Field label="Étape confirmée">
            <select
              value={etape}
              onChange={(e) => setEtape(e.target.value as ProjectStep)}
              className={selectCls}
            >
              {PROJECT_STEPS.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STEP_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {kind === 'photo' && (
        <>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void onPickPhotos(e.target.files);
              e.target.value = '';
            }}
          />
          {photos.length === 0 ? (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground transition-colors hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-6 [&_svg]:text-gold-600"
            >
              <ImageIcon aria-hidden />
              Choisir des photos
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((a) => (
                  <div key={a.id} className="relative overflow-hidden rounded-lg">
                    <img
                      src={a.dataUrl}
                      alt={a.fileName ?? 'Photo'}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Retirer la photo"
                      onClick={() => setPhotos((p) => p.filter((x) => x.id !== a.id))}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-paper-0 [&_svg]:size-3.5"
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => photoInput.current?.click()}>
                <Upload aria-hidden /> Ajouter d’autres photos
              </Button>
            </div>
          )}
          <Field label="Légende">
            <Input
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              placeholder="Ex. Coulage de la dalle"
            />
          </Field>
          <Field label="Pièce (optionnel)">
            <Input
              value={piece}
              onChange={(e) => setPiece(e.target.value)}
              placeholder="Ex. Salle de bain"
            />
          </Field>
        </>
      )}

      {kind === 'document' && (
        <>
          <input
            ref={docInput}
            type="file"
            accept=".pdf,application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              void onPickDoc(e.target.files);
              e.target.value = '';
            }}
          />
          {doc ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
              <span className="flex size-9 items-center justify-center rounded-lg bg-gold-100 text-gold-700 [&_svg]:size-5">
                <FileText aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{doc.fileName}</span>
              <button
                type="button"
                aria-label="Retirer le document"
                onClick={() => setDoc(null)}
                className="text-muted-foreground hover:text-foreground [&_svg]:size-4"
              >
                <X aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => docInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground transition-colors hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-6 [&_svg]:text-gold-600"
            >
              <FileText aria-hidden />
              Choisir un fichier (PDF ou image, max {MAX_DOC_MB} Mo)
            </button>
          )}
          <Field label="Libellé du document">
            <Input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Devis plomberie"
            />
          </Field>
        </>
      )}

      {uploadError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive bg-surface p-3 text-sm text-destructive [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <X aria-hidden />
          {uploadError}
        </p>
      )}

      {kind === 'demande' && (
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex. Quel carrelage pour la salle de bain ?"
          rows={2}
          autoFocus
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {kind !== 'demande' && (
          <label className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            Visibilité
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'client' | 'interne')}
              className="h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
            >
              <option value="client">Client</option>
              <option value="interne">Interne</option>
            </select>
          </label>
        )}
        {kind !== 'demande' && (
          <Button
            variant="outline"
            onClick={() => void submit(false)}
            disabled={!canSubmit || busy}
          >
            Brouillon
          </Button>
        )}
        <Button onClick={() => void submit(true)} disabled={!canSubmit || busy}>
          {kind === 'demande' ? 'Envoyer la demande' : 'Publier'}
        </Button>
      </div>
    </div>
  );
}

function ReplyList({
  project,
  actor,
  events,
  onDone,
}: {
  project: Project;
  actor: EventActor;
  events: Event[];
  onDone: () => void;
}): React.JSX.Element {
  const queue = questionsEnAttente(events);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden />}
        title="Aucune demande en attente"
        description="Vos clients n’attendent aucune réponse pour le moment."
        action={
          <Button variant="outline" onClick={onDone}>
            Fermer
          </Button>
        }
      />
    );
  }

  const reply = async (eventId: (typeof queue)[number]['id']) => {
    const texte = (drafts[eventId] ?? '').trim();
    if (!texte) return;
    await demo.resolveDemande(eventId, {
      texte,
      resolvedBy: actor.userId,
      resolvedAt: new Date().toISOString(),
    });
    if (queue.length === 1) onDone();
  };

  return (
    <ul className="space-y-3">
      {queue.map((d) => (
        <li key={d.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm text-foreground">{d.content.question}</p>
          <Textarea
            value={drafts[d.id] ?? ''}
            onChange={(e) => setDrafts((s) => ({ ...s, [d.id]: e.target.value }))}
            rows={2}
            placeholder="Votre réponse au client…"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void reply(d.id)}>
              Répondre
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
