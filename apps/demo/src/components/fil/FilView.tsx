import { useEffect, useState } from 'react';
import { Button, EmptyState, SegmentedControl } from '@phenix360/ui';
import {
  aMisCoupDeCoeur,
  bibliothequeImages,
  filDuChantier,
  momentVerrouille,
  type AudienceGroup,
  type EventActor,
  type Moment,
  type Project,
} from '@phenix360/core';
import { ImagePlus, Images } from 'lucide-react';
import { demo, filOf, nameOf, type DemoSnapshot } from '../../store';
import { FilMoment } from './FilMoment';
import { BibliothequeView } from './BibliothequeView';
import { MomentComposer } from './MomentComposer';
import { MomentGallery } from './MomentGallery';

/**
 * Le Fil — espace de vie du chantier. Colonne unique, défilement fluide mais
 * FINI (du plus récent au premier jour), séparateurs de chapitre discrets.
 * Ergonomie Instagram, esprit album premium. « 1 partage = 2 vues » : un
 * sélecteur bascule entre Le Fil (chronologie) et la Bibliothèque (classement)
 * sur exactement les mêmes médias. La galerie immersive est rendue ici (une
 * seule), ce qui permet l'ouverture ciblée d'une photo (lien retour depuis le
 * Journal). Aucune logique métier ici : on lit les sélecteurs de core.
 */
export function FilView({
  snap,
  project,
  actor,
  canCompose,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  canCompose: boolean;
}): React.JSX.Element {
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState<'fil' | 'bibliotheque'>('fil');
  const [gallery, setGallery] = useState<{ moment: Moment; photoId?: string } | null>(null);
  const { moments, coups, messages, zones, annotations } = filOf(snap, project.id);
  const viewer: AudienceGroup = actor.role === 'client' ? 'client' : 'phenix';
  const entries = filDuChantier(moments, { viewer });
  const images = bibliothequeImages(moments, { viewer });
  const zoneLabel = (id?: string): string | undefined => zones.find((z) => z.id === id)?.label;
  const name = (userId: string): string => nameOf(snap, userId);
  const vide = entries.length === 0;

  // Lien retour « Voir la photo » depuis le Journal : ouvre la galerie ciblée.
  const target = snap.filTarget;
  useEffect(() => {
    if (!target) return;
    const m = moments.find((x) => x.id === target.momentId);
    if (m) setGallery({ moment: m, ...(target.photoId ? { photoId: target.photoId } : {}) });
    demo.clearFilTarget();
  }, [target, moments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <Images aria-hidden />
            <h2 className="font-serif text-xl font-semibold tracking-tight">Le Fil</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {view === 'fil'
              ? 'L’histoire de votre chantier, en images.'
              : 'Toutes vos photos, prêtes à être retrouvées.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl
            value={view}
            onValueChange={setView}
            options={[
              { value: 'fil', label: 'Le Fil' },
              { value: 'bibliotheque', label: 'Bibliothèque' },
            ]}
            aria-label="Changer de vue"
          />
          {canCompose && (
            <Button onClick={() => setComposing(true)}>
              <ImagePlus aria-hidden /> Créer un moment
            </Button>
          )}
        </div>
      </div>

      {vide ? (
        <EmptyState
          icon={<Images aria-hidden />}
          title="Le Fil commence bientôt"
          description={
            canCompose
              ? 'Créez un premier moment : il ouvrira l’histoire du chantier.'
              : 'Les premiers moments de votre chantier apparaîtront ici très bientôt.'
          }
          action={
            canCompose ? (
              <Button onClick={() => setComposing(true)}>
                <ImagePlus aria-hidden /> Créer un moment
              </Button>
            ) : undefined
          }
        />
      ) : view === 'bibliotheque' ? (
        <BibliothequeView
          images={images}
          zones={zones}
          momentsAimes={new Set(coups.map((c) => c.momentId))}
        />
      ) : (
        <div className="mx-auto max-w-xl space-y-6">
          {entries.map((entry) =>
            entry.kind === 'chapitre' ? (
              <div key={`ch-${entry.key}`} className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {entry.label}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : (
              <FilMoment
                key={entry.moment.id}
                moment={entry.moment}
                zoneLabel={zoneLabel(entry.moment.zoneId)}
                nameOf={name}
                hasCoup={aMisCoupDeCoeur(entry.moment.id, actor.userId, coups)}
                messages={messages.filter((m) => m.momentId === entry.moment.id)}
                locked={momentVerrouille(entry.moment.id, coups, messages)}
                canDelete={canCompose}
                canShare={canCompose}
                onToggleCoup={() => demo.toggleCoupDeCoeur(project.id, entry.moment.id, actor)}
                onSendMessage={(texte) =>
                  demo.addMessage(project.id, entry.moment.id, actor, texte)
                }
                onOpenGallery={() => setGallery({ moment: entry.moment })}
                onDelete={() => demo.deleteMoment(project.id, entry.moment.id)}
                onShare={() => demo.shareMoment(project.id, entry.moment.id)}
              />
            ),
          )}
          <p className="pb-2 text-center text-xs text-muted-foreground">· Le début du chantier ·</p>
        </div>
      )}

      {composing && (
        <MomentComposer
          project={project}
          actor={actor}
          zones={zones}
          onClose={() => setComposing(false)}
        />
      )}

      {gallery && (
        <MomentGallery
          moment={gallery.moment}
          messages={messages.filter((m) => m.momentId === gallery.moment.id)}
          annotations={annotations.filter((a) => a.momentId === gallery.moment.id)}
          nameOf={name}
          canCreateAction={canCompose}
          {...(gallery.photoId ? { initialPhotoId: gallery.photoId } : {})}
          onSendPhotoMessage={(photoId, texte) =>
            demo.addMessage(project.id, gallery.moment.id, actor, texte, photoId)
          }
          onAddAnnotation={(input) =>
            demo.addAnnotation(project.id, { momentId: gallery.moment.id, actor, ...input })
          }
          onCreateReserve={(annotationId, options) =>
            void demo.createReserveFromAnnotation(project.id, annotationId, actor, options)
          }
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  );
}
