import {
  PROJECT_STATUS_LABEL,
  PROJECT_STEP_LABEL,
  type Project,
  type ProjectStatus,
} from '@phenix360/core';
import { Badge, cn } from '@phenix360/ui';
import { MapPin } from 'lucide-react';
import { PROJECT_STATUS_BADGE } from '../lib/status';

/**
 * Le projet est le HÉROS de l'écran : grand titre éditorial, client, et l'état
 * du chantier (statut, + étape courante côté conducteur). Le LOT en cours
 * (« Gros œuvre »…) est une information INTERNE conducteur : côté client, on ne
 * montre que le statut (`showStep={false}`). Le client suit le détail via le
 * Récit ou en demandant à Léon.
 */
export function ProjectHero({
  project,
  clientName,
  compact = false,
  showStep = true,
  status,
  className,
}: {
  project: Project;
  clientName: string;
  compact?: boolean;
  /** Affiche le badge du LOT en cours. Interne conducteur — false côté client. */
  showStep?: boolean;
  /**
   * Statut RÉEL à afficher (dérivé des faits via `deriveProjectStatus`). Source de
   * vérité unique — à fournir par l'appelant. À défaut, on retombe sur le champ
   * stocké (compat), mais toute surface doit passer le statut dérivé.
   */
  status?: ProjectStatus;
  className?: string;
}): React.JSX.Element {
  const shownStatus = status ?? project.status;
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3', className)}>
      <div className="space-y-1">
        <h1
          className={cn(
            'font-serif font-semibold tracking-tight text-foreground',
            compact ? 'text-2xl' : 'text-3xl sm:text-4xl',
          )}
        >
          {project.name}
        </h1>
        <p className="text-sm text-muted-foreground">{clientName}</p>
        {project.address && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600">
            <MapPin aria-hidden />
            {project.address}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant={PROJECT_STATUS_BADGE[shownStatus]}>
          {PROJECT_STATUS_LABEL[shownStatus]}
        </Badge>
        {showStep && (
          <Badge variant="gold">
            {project.currentStep ? PROJECT_STEP_LABEL[project.currentStep] : 'Étape à venir'}
          </Badge>
        )}
      </div>
    </div>
  );
}
