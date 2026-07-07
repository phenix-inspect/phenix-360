import { Bell } from 'lucide-react';
import type { AppNotification } from '../store';

/**
 * Centre de notifications — RÉUTILISE l'écran d'accueil (Aujourd'hui côté
 * conducteur, Espace client côté client), jamais un écran dédié. Une liste
 * compacte de notifications DÉRIVÉES des faits : un clic ouvre l'élément concerné
 * et la marque lue (elle disparaît). Rien à afficher → le bloc s'efface.
 */
export function NotificationsFeed({
  notifications,
  onOpen,
}: {
  notifications: AppNotification[];
  onOpen: (n: AppNotification) => void;
}): React.JSX.Element | null {
  if (notifications.length === 0) return null;
  return (
    <section
      aria-label="Notifications"
      className="space-y-2 rounded-2xl border border-gold-200 bg-gold-50 p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gold-800 [&_svg]:size-4">
        <Bell aria-hidden />
        Notifications ({notifications.length})
      </h2>
      <ul className="space-y-1.5">
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpen(n)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span aria-hidden className="text-base leading-none">
                {n.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{n.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
