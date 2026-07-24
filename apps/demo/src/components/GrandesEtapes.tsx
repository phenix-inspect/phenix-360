import { Badge } from '@phenix360/ui';
import {
  buildClientPlanning,
  type ClientMilestone,
  type ProjectDossier,
  type ProjectStatus,
} from '@phenix360/core';
import { Check, CircleDot, Circle } from 'lucide-react';
import { fmtDate } from '../lib/format';

/**
 * « Les grandes étapes du chantier » — la lecture CLIENT du planning, volontairement
 * PREMIUM et rassurante : 5 grands jalons de cycle de vie (Projet validé,
 * Préparation, Démarrage, Pré-réception, Réception), JAMAIS les lots techniques
 * (plomberie, peinture…) — ceux-là sont réservés à Léon. Le contenu évolue tout
 * seul selon le statut : estimations avant le démarrage, dates estimées ensuite.
 * Vision GLOBALE, jamais un planning d'exécution (aucune promesse par prestation).
 */
export function GrandesEtapes({
  status,
  dossier,
}: {
  status: ProjectStatus;
  dossier: ProjectDossier | null;
}): React.JSX.Element {
  const planning = buildClientPlanning(status, dossier);

  return (
    <div className="space-y-3">
      <ol className="overflow-hidden rounded-2xl border border-border bg-surface">
        {planning.milestones.map((m) => (
          <Milestone key={m.key} m={m} />
        ))}
      </ol>
      <p className="px-1 text-sm text-muted-foreground">{planning.message}</p>
    </div>
  );
}

/** Texte secondaire d'un jalon : date (chantier démarré) ou estimation (avant). */
function detailOf(m: ClientMilestone): string | null {
  if (m.key === 'demarrage')
    return m.date
      ? `Début officiel : ${fmtDate(m.date)}`
      : m.estimate
        ? `Démarrage estimé : ${m.estimate}`
        : null;
  if (m.key === 'prereception') return m.date ? `Pré-réception estimée : ${fmtDate(m.date)}` : null;
  if (m.key === 'reception') return m.date ? `Réception estimée : ${fmtDate(m.date)}` : null;
  return null;
}

function Milestone({ m }: { m: ClientMilestone }): React.JSX.Element {
  const detail = detailOf(m);
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-4 ${
          m.state === 'done'
            ? 'bg-success/15 text-success'
            : m.state === 'current'
              ? 'bg-gold-100 text-gold-700'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {m.state === 'done' ? (
          <Check aria-hidden />
        ) : m.state === 'current' ? (
          <CircleDot aria-hidden />
        ) : (
          <Circle aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{m.label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Badge variant={m.state === 'done' ? 'success' : m.state === 'current' ? 'gold' : 'neutral'}>
        {m.state === 'done' ? 'Terminé' : m.state === 'current' ? 'En cours' : 'À venir'}
      </Badge>
    </li>
  );
}
