import { useState } from 'react';
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
  attachmentId,
  teamQueue,
  type Event,
  type EventActor,
  type Project,
  type ProjectStep,
} from '@phenix360/core';
import { Inbox } from 'lucide-react';
import { demo } from '../store';

export type ComposerKind = 'compte_rendu' | 'photo' | 'document' | 'demande' | 'repondre';

const TITLES: Record<ComposerKind, { title: string; description: string }> = {
  compte_rendu: {
    title: 'Nouveau compte rendu',
    description: 'Décrivez l’avancée du jour. Visible par votre client.',
  },
  photo: { title: 'Ajouter des photos', description: 'Partagez l’avancement en images.' },
  document: { title: 'Ajouter un document', description: 'Devis, plan, facture…' },
  demande: {
    title: 'Déclarer une demande',
    description: 'Une décision à demander au client, ou un point pour l’équipe.',
  },
  repondre: {
    title: 'Répondre au client',
    description: 'Les demandes en attente de votre réponse.',
  },
};

const newAttachment = (projectId: string, kind: 'photo' | 'document') => ({
  id: attachmentId(crypto.randomUUID()),
  kind,
  bucket: 'demo',
  storagePath: `${projectId}/${crypto.randomUUID()}.${kind === 'photo' ? 'jpg' : 'pdf'}`,
  mimeType: kind === 'photo' ? 'image/jpeg' : 'application/pdf',
  createdAt: new Date().toISOString(),
});

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
  const [destinataire, setDestinataire] = useState<'client' | 'equipe'>('client');
  const [visibility, setVisibility] = useState<'client' | 'interne'>('client');

  const submit = async (publish: boolean) => {
    const base = { projectId: project.id, actor, visibility } as const;
    if (kind === 'compte_rendu') {
      if (!texte.trim()) return;
      await demo.appendEvent({
        ...base,
        type: 'compte_rendu',
        state: publish ? 'publie' : 'brouillon',
        content: { texte: texte.trim(), etapeProposee: etape, etapeConfirmee: etape },
      });
    } else if (kind === 'photo') {
      await demo.appendEvent({
        ...base,
        type: 'photo',
        state: publish ? 'publie' : 'brouillon',
        content: {
          attachment: newAttachment(project.id, 'photo'),
          legende: legende.trim() || undefined,
          piece: piece.trim() || undefined,
        },
      });
    } else if (kind === 'document') {
      if (!libelle.trim()) return;
      await demo.appendEvent({
        ...base,
        type: 'document',
        state: publish ? 'publie' : 'brouillon',
        content: { attachment: newAttachment(project.id, 'document'), libelle: libelle.trim() },
      });
    } else {
      if (!question.trim()) return;
      await demo.appendEvent({
        projectId: project.id,
        actor,
        visibility: 'client',
        type: 'demande',
        state: 'ouverte',
        content: { question: question.trim(), destinataire },
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
          <Field label="Légende">
            <Input
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              placeholder="Ex. Coulage de la dalle"
              autoFocus
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
        <Field label="Libellé du document">
          <Input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Devis plomberie"
            autoFocus
          />
        </Field>
      )}

      {kind === 'demande' && (
        <>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. Quel carrelage pour la salle de bain ?"
            rows={2}
            autoFocus
          />
          <Field label="Destinataire">
            <select
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value as 'client' | 'equipe')}
              className={selectCls}
            >
              <option value="client">Client (décision attendue)</option>
              <option value="equipe">Équipe PHÉNIX</option>
            </select>
          </Field>
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
          <Button variant="outline" onClick={() => void submit(false)}>
            Brouillon
          </Button>
        )}
        <Button onClick={() => void submit(true)}>
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
  const queue = teamQueue(events).filter((e) => e.content.destinataire === 'equipe');
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
