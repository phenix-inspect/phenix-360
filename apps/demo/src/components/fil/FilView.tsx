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
import {
  demo,
  filOf,
  nameOf,
  pendingClientMoments,
  pendingTeamMoments,
  type DemoSnapshot,
} from '../../store';
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
  view: viewProp,
  onViewChange,
}: {
  snap: DemoSnapshot;
  project: Project;
  actor: EventActor;
  canCompose: boolean;
  /** Vue contrôlée (Récit / Bibliothèque) — le parent pilote (sommaire client). */
  view?: 'fil' | 'bibliotheque';
  onViewChange?: (view: 'fil' | 'bibliotheque') => void;
}): React.JSX.Element {
  const [composing, setComposing] = useState(false);
  // Vue interne par défaut ; contrôlée si le parent fournit `view`/`onViewChange`.
  const [internalView, setInternalView] = useState<'fil' | 'bibliotheque'>('fil');
  const view = viewProp ?? internalView;
  const setView = (v: 'fil' | 'bibliotheque'): void =>
    onViewChange ? onViewChange(v) : setInternalView(v);
  const [gallery, setGallery] = useState<{ moment: Moment; photoId?: string } | null>(null);
  // Moment sur lequel poser le curseur de réponse (ouvert depuis une notification).
  const [focusMomentId, setFocusMomentId] = useState<string | null>(null);
  const { moments, coups, messages, zones, annotations } = filOf(snap, project.id);
  // Signal « nouveau message » symétrique : côté conducteur, un commentaire client
  // en attente ; côté client, un mot de l'équipe non encore vu.
  const viewerIsClient = actor.role === 'client';
  const pending = viewerIsClient
    ? pendingTeamMoments(snap, project.id)
    : pendingClientMoments(snap, project.id);
  const pendingText = viewerIsClient
    ? 'Nouveau message de votre équipe'
    : 'Nouveau commentaire du client — à vous de répondre';
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

  // Notification actionnable : on ouvre le Moment CONCERNÉ (pas tout le Récit).
  // `role` cible le bon Récit en Côte à côte. Consulter = LU : on marque le
  // Moment vu (éteint la notification), on défile jusqu'à lui, on le met en
  // évidence et on pose le curseur dans la réponse.
  const focus = snap.momentFocus;
  useEffect(() => {
    if (!focus || focus.role !== actor.role) return;
    const m = moments.find((x) => x.id === focus.momentId);
    if (!m) return; // pas dans ce Récit : un autre FilView le consommera.
    demo.markMomentSeen(actor.role, focus.momentId);
    setView('fil');
    setFocusMomentId(focus.momentId);
    demo.clearMomentFocus();
    requestAnimationFrame(() => {
      const el = document.getElementById(`fil-moment-${focus.momentId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate?.(
        [
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
          { boxShadow: '0 0 0 4px rgba(169,128,58,0.55)' },
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
        ],
        { duration: 1600, easing: 'ease-out' },
      );
    });
  }, [focus, moments, actor.role]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <Images aria-hidden />
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Dans les coulisses du chantier
            </h2>
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
              { value: 'fil', label: 'Dans les coulisses' },
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
          title="Les coulisses du chantier commencent bientôt"
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
                pendingComment={pending.has(entry.moment.id)}
                pendingText={pendingText}
                focusReply={focusMomentId === entry.moment.id}
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
