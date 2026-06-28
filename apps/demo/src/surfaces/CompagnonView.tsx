import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Timeline,
  ActivityItem,
} from '@phenix360/ui';
import {
  EVENT_TYPE_LABEL,
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  PROJECT_STATUS_LABEL,
  attachmentId,
  sortByDate,
  userId,
  type EventActor,
  type EventType,
  type Event,
  type Project,
  type ProjectStep,
} from '@phenix360/core';
import { demo, nameOf, type DemoSnapshot } from '../store';
import { fmtDateTime } from '../lib/format';

function compagnonActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'compagnon');
  const id = member?.userId ?? userId('compagnon-demo');
  return { userId: id, role: 'compagnon', displayName: nameOf(snap, id) };
}

const newAttachment = (projectId: string) => ({
  id: attachmentId(crypto.randomUUID()),
  kind: 'photo' as const,
  bucket: 'demo',
  storagePath: `${projectId}/${crypto.randomUUID()}.jpg`,
  mimeType: 'image/jpeg',
  createdAt: new Date().toISOString(),
});

const TYPES: EventType[] = ['compte_rendu', 'photo', 'document', 'demande'];

export function CompagnonView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const actor = compagnonActor(snap, project);
  const events = sortByDate(snap.events.filter((e) => e.projectId === project.id));
  const drafts = events.filter((e) => e.state === 'brouillon');

  const [type, setType] = useState<EventType>('compte_rendu');
  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState<ProjectStep>('gros_oeuvre');
  const [legende, setLegende] = useState('');
  const [libelle, setLibelle] = useState('');
  const [question, setQuestion] = useState('');
  const [destinataire, setDestinataire] = useState<'client' | 'equipe'>('client');
  const [visibility, setVisibility] = useState<'client' | 'interne'>('client');

  const reset = () => {
    setTexte('');
    setLegende('');
    setLibelle('');
    setQuestion('');
  };

  const create = async (publish: boolean) => {
    const base = { projectId: project.id, actor, visibility } as const;
    if (type === 'compte_rendu') {
      if (!texte.trim()) return;
      await demo.appendEvent({
        ...base,
        type: 'compte_rendu',
        state: publish ? 'publie' : 'brouillon',
        content: { texte: texte.trim(), etapeProposee: etape, etapeConfirmee: etape },
      });
    } else if (type === 'photo') {
      await demo.appendEvent({
        ...base,
        type: 'photo',
        state: publish ? 'publie' : 'brouillon',
        content: { attachment: newAttachment(project.id), legende: legende.trim() || undefined },
      });
    } else if (type === 'document') {
      if (!libelle.trim()) return;
      await demo.appendEvent({
        ...base,
        type: 'document',
        state: publish ? 'publie' : 'brouillon',
        content: {
          attachment: {
            ...newAttachment(project.id),
            kind: 'document',
            mimeType: 'application/pdf',
          },
          libelle: libelle.trim(),
        },
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
    reset();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight">{project.name}</h2>
          <p className="text-sm text-muted-foreground">Interface PHÉNIX — capture terrain</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="neutral">{PROJECT_STATUS_LABEL[project.status]}</Badge>
          <Badge variant="gold">
            {project.currentStep ? PROJECT_STEP_LABEL[project.currentStep] : 'Étape à venir'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle saisie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={type === t ? 'primary' : 'outline'}
                onClick={() => setType(t)}
              >
                {EVENT_TYPE_LABEL[t]}
              </Button>
            ))}
          </div>

          {type === 'compte_rendu' && (
            <div className="space-y-3">
              <Textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Ex. Dalle coulée, séchage en cours…"
                rows={3}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Étape confirmée
                <select
                  value={etape}
                  onChange={(e) => setEtape(e.target.value as ProjectStep)}
                  className="h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                >
                  {PROJECT_STEPS.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STEP_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {type === 'photo' && (
            <Input
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              placeholder="Légende de la photo (optionnel)"
            />
          )}
          {type === 'document' && (
            <Input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Libellé du document (ex. Devis plomberie)"
            />
          )}
          {type === 'demande' && (
            <div className="space-y-3">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex. Quel carrelage pour la salle de bain ?"
                rows={2}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Destinataire
                <select
                  value={destinataire}
                  onChange={(e) => setDestinataire(e.target.value as 'client' | 'equipe')}
                  className="h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                >
                  <option value="client">Client (décision attendue)</option>
                  <option value="equipe">Équipe PHÉNIX</option>
                </select>
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {type !== 'demande' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
            <div className="ml-auto flex gap-2">
              {type !== 'demande' && (
                <Button variant="outline" size="sm" onClick={() => void create(false)}>
                  Enregistrer (brouillon)
                </Button>
              )}
              <Button size="sm" onClick={() => void create(type === 'demande' ? false : true)}>
                {type === 'demande' ? 'Créer la demande' : 'Publier'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">À publier ({drafts.length})</h3>
          <ul className="space-y-2">
            {drafts.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{eventTitle(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {EVENT_TYPE_LABEL[e.type]} · brouillon
                  </p>
                </div>
                <Button size="sm" onClick={() => void demo.publishEvent(e.id, actor.userId)}>
                  Publier
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Journal du chantier ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
        ) : (
          <Timeline>
            {events.map((e) => (
              <ActivityItem
                key={e.id}
                type={e.type}
                title={eventTitle(e)}
                description={eventDescription(e)}
                date={fmtDateTime(e.createdAt)}
                author={nameOf(snap, e.actor.userId)}
                authorRole={e.actor.role}
                visibility={e.visibility}
              >
                <span className="mt-1 inline-block">
                  <Badge
                    variant={
                      e.state === 'publie'
                        ? 'success'
                        : e.state === 'brouillon'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {e.state}
                  </Badge>
                </span>
              </ActivityItem>
            ))}
          </Timeline>
        )}
      </section>
    </div>
  );
}

export function eventTitle(e: Event): string {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.etapeConfirmee
        ? PROJECT_STEP_LABEL[e.content.etapeConfirmee]
        : 'Compte rendu';
    case 'photo':
      return e.content.legende ?? 'Photo';
    case 'document':
      return e.content.libelle;
    case 'demande':
      return 'Demande';
  }
}

export function eventDescription(e: Event): string | undefined {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.texte;
    case 'demande':
      return e.content.resolution
        ? `${e.content.question} → ${e.content.resolution.texte}`
        : e.content.question;
    case 'photo':
      return undefined;
    case 'document':
      return undefined;
  }
}
