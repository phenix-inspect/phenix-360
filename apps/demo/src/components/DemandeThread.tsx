import { useState } from 'react';
import { Badge, Button, Textarea } from '@phenix360/ui';
import { MessageCircle, Send } from 'lucide-react';
import type { CompteRenduPhoto, DemandeEvent, EventActor, UploadedMedia } from '@phenix360/core';
import { demo } from '../store';
import { fmtDateTime } from '../lib/format';
import { PhotoPicker } from './PhotoPicker';

/** Petite galerie en lecture seule (photos jointes à une demande / réponse). */
function PhotoStrip({
  photos,
}: {
  photos: CompteRenduPhoto[] | undefined;
}): React.JSX.Element | null {
  const list = (photos ?? []).filter((p) => p.imageUrl);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((p, i) => (
        <img
          key={i}
          src={p.imageUrl}
          alt=""
          className="size-20 rounded-lg border border-border object-cover"
        />
      ))}
    </div>
  );
}

/**
 * La MÉMOIRE d'une demande client : la question + ses photos, la réponse du
 * conducteur + ses photos, le statut (À traiter / Répondu) et les dates. Modèle
 * simple « 1 demande = 1 réponse » — pas de fil infini. Côté conducteur
 * (`canReply`), une réponse unique (texte obligatoire + 0 à 3 photos) est
 * proposée tant que la demande est ouverte. Côté client (lecture seule), un
 * message rassure tant qu'aucune réponse n'est arrivée.
 */
export function DemandeThread({
  demande,
  actor,
  nameOf,
  canReply = false,
}: {
  demande: DemandeEvent;
  actor: EventActor;
  nameOf: (userId: string) => string;
  canReply?: boolean;
}): React.JSX.Element {
  const c = demande.content;
  const resolution = c.resolution;
  const repondue = resolution != null;
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState('');
  const [photos, setPhotos] = useState<UploadedMedia[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!texte.trim() || busy) return;
    setBusy(true);
    try {
      await demo.repondreDemandeClient(demande.id, actor, {
        texte: texte.trim(),
        photos: photos.map((p) => ({
          imageUrl: p.imageUrl,
          bucket: p.bucket,
          storagePath: p.storagePath,
        })),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <MessageCircle aria-hidden />
          Demande client
        </span>
        <Badge variant={repondue ? 'success' : 'warning'}>
          {repondue ? 'Répondu' : canReply ? 'À traiter' : 'En attente'}
        </Badge>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {nameOf(demande.actor.userId)} · {fmtDateTime(demande.createdAt)}
        </p>
        <p className="whitespace-pre-line text-sm text-foreground">{c.question}</p>
        <PhotoStrip photos={c.photos} />
      </div>

      {repondue && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-gold-700">
            Réponse de PHÉNIX · {fmtDateTime(resolution.resolvedAt)}
          </p>
          <p className="whitespace-pre-line text-sm text-foreground">{resolution.texte}</p>
          <PhotoStrip photos={resolution.photos} />
        </div>
      )}

      {!repondue && !canReply && (
        <p className="border-t border-border pt-3 text-xs italic text-muted-foreground">
          Votre demande a bien été transmise à PHÉNIX.
        </p>
      )}

      {canReply && !repondue && (
        <div className="border-t border-border pt-3">
          {open ? (
            <div className="space-y-2">
              <Textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Votre réponse au client…"
                rows={3}
                aria-label="Réponse au client"
              />
              <PhotoPicker photos={photos} onChange={setPhotos} />
              <div className="flex gap-2">
                <Button size="sm" disabled={!texte.trim() || busy} onClick={() => void submit()}>
                  <Send aria-hidden /> {busy ? 'Envoi…' : 'Envoyer la réponse'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>
              Répondre
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
