import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  buttonVariants,
} from '@phenix360/ui';
import {
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  type EventActor,
  type EventAttachment,
  type Project,
  type ProjectStep,
} from '@phenix360/core';
import {
  ChevronLeft,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  MessageSquareQuote,
  Upload,
  X,
} from 'lucide-react';
import { demo } from '../store';
import { MAX_DOC_MB, readDocumentAttachment, readPhotoAttachment } from '../lib/upload';
import { ACCEPT_DOCUMENT } from '../lib/media';
import { PhotoInput } from './PhotoInput';
import { LeaveConfirmInline, useBeforeUnloadGuard } from './mission/LeaveGuard';

export type ComposerKind = 'compte_rendu' | 'photo' | 'document' | 'demande';

/**
 * Types de documents demandables au client (« Demander au client → Document »).
 * La CATÉGORIE choisie classe automatiquement le document reçu.
 */
const DOC_TYPES = [
  'Justificatif d’acompte',
  'Attestation assurance',
  'RIB',
  'Diagnostic',
  'DPE',
  'Plan',
  'Autorisation copropriété',
  'Pièce d’identité',
  'Autre',
] as const;

const TITLES: Record<ComposerKind, { title: string; description: string }> = {
  compte_rendu: {
    title: 'Nouveau compte rendu',
    description: 'Décrivez l’avancée du jour. Visible par votre client.',
  },
  photo: { title: 'Ajouter des photos', description: 'Partagez l’avancement en images.' },
  document: { title: 'Ajouter un document', description: 'Devis, plan, facture…' },
  demande: {
    title: 'Demander au client',
    description: 'Une décision, un document ou une question — au bon endroit, en un geste.',
  },
};

/** Composer ciblé (un dialogue par action). Réutilise les ports `demo.*`. */
export function Composer({
  kind,
  project,
  actor,
  onClose,
  onEscalateDecision,
}: {
  kind: ComposerKind | null;
  project: Project;
  actor: EventActor;
  onClose: () => void;
  /** « Demander au client → Décision » ouvre le composer de décision structuré. */
  onEscalateDecision?: () => void;
}): React.JSX.Element | null {
  // PERTE DE SAISIE — l'état « en cours de saisie » vit dans CaptureForm ; on le
  // remonte ici (où se trouve la fermeture du Dialog) pour intercepter Échap /
  // clic hors modal / croix et proposer la confirmation avant d'abandonner.
  // On lit la valeur via une ref mise à jour SYNCHRONEMENT au rendu de l'enfant :
  // un « je tape puis Échap immédiat » ne doit jamais passer entre deux rendus.
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useBeforeUnloadGuard(dirty);
  const requestClose = (): void => {
    if (dirtyRef.current) setConfirmLeave(true);
    else onClose();
  };

  if (kind === null) return null;
  const meta = TITLES[kind];
  return (
    <Dialog open onOpenChange={(o) => !o && !confirmLeave && requestClose()}>
      {/* Pas de classe `position` ici : `DialogContent` est déjà `fixed` (centré)
          ET sert d'ancrage aux enfants `absolute` (LeaveConfirmInline). Passer
          `relative` ferait tomber `fixed` (tailwind-merge résout le conflit de
          position) → la fenêtre partait hors écran (seul le voile gris restait). */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <CaptureForm
          kind={kind}
          project={project}
          actor={actor}
          onDone={onClose}
          dirtyRef={dirtyRef}
          onDirtyChange={setDirty}
          onEscalateDecision={onEscalateDecision}
        />
        {/* Confirmation EN LIGNE : même couche Radix, aucun conflit de focus. */}
        <LeaveConfirmInline
          open={confirmLeave}
          onCancel={() => setConfirmLeave(false)}
          onLeave={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function CaptureForm({
  kind,
  project,
  actor,
  onDone,
  dirtyRef,
  onDirtyChange,
  onEscalateDecision,
}: {
  kind: Exclude<ComposerKind, 'repondre'>;
  project: Project;
  actor: EventActor;
  onDone: () => void;
  dirtyRef: MutableRefObject<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onEscalateDecision?: () => void;
}): React.JSX.Element {
  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState<ProjectStep>(project.currentStep ?? 'gros_oeuvre');
  const [legende, setLegende] = useState('');
  const [piece, setPiece] = useState('');
  const [libelle, setLibelle] = useState('');
  const [question, setQuestion] = useState('');
  // « Demander au client » : choix du type (décision / document / question).
  const [demandeMode, setDemandeMode] = useState<'menu' | 'document' | 'question'>('menu');
  const [docLibelle, setDocLibelle] = useState('');
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>(DOC_TYPES[0]);
  const [echeance, setEcheance] = useState('');
  const [visibility, setVisibility] = useState<'client' | 'interne'>('client');
  // Vrais fichiers (Lot 3) : aperçu local base64.
  const [photos, setPhotos] = useState<EventAttachment[]>([]);
  const [doc, setDoc] = useState<EventAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // « En cours de saisie » dès qu'un champ utile est renseigné (tous types
  // confondus). Le menu « Demander au client » vide n'est pas considéré saisi.
  const dirty =
    texte.trim() !== '' ||
    legende.trim() !== '' ||
    piece.trim() !== '' ||
    libelle.trim() !== '' ||
    question.trim() !== '' ||
    docLibelle.trim() !== '' ||
    echeance !== '' ||
    photos.length > 0 ||
    doc !== null;
  // Écriture SYNCHRONE (au rendu) : `requestClose` du parent lit toujours la
  // dernière valeur, même si l'utilisateur ferme dans le même tick que sa frappe.
  dirtyRef.current = dirty;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const onPickPhotos = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    setBusy(true);
    setUploadError(null);
    try {
      for (const file of files) {
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

  const onPickDoc = async (files: File[]): Promise<void> => {
    const file = files[0];
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
          : // kind === 'demande'
            demandeMode === 'document'
            ? docLibelle.trim().length > 0
            : demandeMode === 'question'
              ? question.trim().length > 0
              : false;

  const submitDemande = async () => {
    if (!canSubmit || busy) return;
    // Verrou anti double-envoi : on désactive les boutons pendant l'écriture (sinon
    // un double-clic rapide crée deux demandes identiques + deux notifications).
    setBusy(true);
    try {
      if (demandeMode === 'document') {
        // Demande de DOCUMENT : visible client automatiquement (échange documentaire).
        await demo.appendEvent({
          projectId: project.id,
          actor,
          visibility: 'client',
          type: 'demande',
          state: 'ouverte',
          content: {
            question: question.trim() || `Pouvez-vous nous transmettre : ${docLibelle.trim()} ?`,
            destinataire: 'client',
            attendu: 'document',
            docLibelle: docLibelle.trim(),
            docCategorie: docType,
            ...(echeance ? { echeance } : {}),
          },
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
    } finally {
      setBusy(false);
    }
  };

  const submit = async (publish: boolean) => {
    if (!canSubmit || busy) return;
    // Verrou anti double-envoi (double-clic → événements dupliqués, photos postées
    // deux fois). On désactive les boutons le temps de l'écriture.
    setBusy(true);
    try {
      await doSubmit(publish);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async (publish: boolean) => {
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
          {photos.length === 0 ? (
            <PhotoInput
              onFiles={onPickPhotos}
              multiple
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground transition-colors hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-6 [&_svg]:text-gold-600"
            >
              <ImageIcon aria-hidden />
              Choisir des photos
            </PhotoInput>
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
              <PhotoInput
                onFiles={onPickPhotos}
                multiple
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Upload aria-hidden /> Ajouter d’autres photos
              </PhotoInput>
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
            <PhotoInput
              onFiles={onPickDoc}
              accept={ACCEPT_DOCUMENT}
              title="Ajouter un document"
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground transition-colors hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-6 [&_svg]:text-gold-600"
            >
              <FileText aria-hidden />
              Choisir un fichier (PDF ou image, max {MAX_DOC_MB} Mo)
            </PhotoInput>
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

      {kind === 'demande' && demandeMode === 'menu' && (
        <div className="space-y-2">
          <DemandeChoice
            icon={<MessageSquareQuote aria-hidden />}
            title="Demander une décision"
            description="Un choix à valider (carrelage, coloris, option…)"
            onClick={() => onEscalateDecision?.()}
          />
          <DemandeChoice
            icon={<FileText aria-hidden />}
            title="Demander un document"
            description="Acompte, assurance, RIB, diagnostic, DPE, plan…"
            onClick={() => setDemandeMode('document')}
          />
          <DemandeChoice
            icon={<HelpCircle aria-hidden />}
            title="Poser une question simple"
            description="Une question ouverte à votre client"
            onClick={() => setDemandeMode('question')}
          />
        </div>
      )}

      {kind === 'demande' && demandeMode === 'question' && (
        <>
          <BackToMenu onClick={() => setDemandeMode('menu')} />
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. Confirmez-vous la date de livraison ?"
            rows={2}
            autoFocus
          />
        </>
      )}

      {kind === 'demande' && demandeMode === 'document' && (
        <>
          <BackToMenu onClick={() => setDemandeMode('menu')} />
          <Field label="Document demandé">
            <Input
              value={docLibelle}
              onChange={(e) => setDocLibelle(e.target.value)}
              placeholder="Ex. Attestation d’assurance décennale"
              autoFocus
            />
          </Field>
          <Field label="Type de document">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])}
              className={selectCls}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Message au client (facultatif)">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex. Merci de nous transmettre ce document dès que possible."
              rows={2}
            />
          </Field>
          <Field label="Échéance souhaitée (facultatif)">
            <Input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">Visible par le client automatiquement.</p>
        </>
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
        {kind === 'demande' && demandeMode !== 'menu' && (
          <Button onClick={() => void submitDemande()} disabled={!canSubmit || busy}>
            {demandeMode === 'document' ? 'Envoyer la demande de document' : 'Envoyer la demande'}
          </Button>
        )}
        {kind !== 'demande' && (
          <Button onClick={() => void submit(true)} disabled={!canSubmit || busy}>
            Publier
          </Button>
        )}
      </div>
    </div>
  );
}

/** Un choix du menu « Demander au client » (décision / document / question). */
function DemandeChoice({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"
    >
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/** Retour au menu de type de demande. */
function BackToMenu({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&_svg]:size-4"
    >
      <ChevronLeft aria-hidden />
      Changer de type de demande
    </button>
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
