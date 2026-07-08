import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { MISSIONS, type MissionKind } from '@phenix360/core';
import {
  ClipboardList,
  Eye,
  FileText,
  HelpCircle,
  Images,
  KeyRound,
  PenLine,
  Reply,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ComposerKind } from '../Composer';

const ICONS: Record<MissionKind, LucideIcon> = {
  visite: Eye,
  reunion: Users,
  livraison: Truck,
  prereception: ClipboardList,
  reception: KeyRound,
  sav: Wrench,
  note: PenLine,
};

/**
 * Actions administratives DÉPLACÉES du Suivi vers ce point d'entrée unique : le
 * conducteur ne se demande plus « où cliquer » — pour CRÉER, c'est toujours ici.
 * Le Suivi ne sert plus qu'à CONSULTER (radar, dernière activité).
 */
const COMPOSE_ACTIONS: {
  kind: ComposerKind;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    kind: 'document',
    label: 'Ajouter un document',
    description: 'Devis, plan, facture…',
    icon: FileText,
  },
  {
    kind: 'demande',
    label: 'Demander au client',
    description: 'Une décision, un document ou une question',
    icon: HelpCircle,
  },
  {
    kind: 'repondre',
    label: 'Répondre au client',
    description: 'Les questions en attente de réponse',
    icon: Reply,
  },
];

/**
 * « Pourquoi êtes-vous là ? » — le seul choix du conducteur, en un tap. Ce n'est
 * pas « quel document créer ? » : c'est la raison de sa présence. La mission
 * oriente ensuite tout ce que PHÉNIX prépare, sans jamais l'enfermer.
 */
export function MissionPicker({
  onSelect,
  onPublishAlbum,
  onCompose,
  pendingReplies = 0,
  onClose,
}: {
  onSelect: (kind: MissionKind) => void;
  /** Publier un album photo dans « Dans les coulisses » (la brique plaisir). */
  onPublishAlbum: () => void;
  /** Actions administratives (document, demande, réponse) — déplacées du Suivi. */
  onCompose: (kind: ComposerKind) => void;
  /** Nombre de questions client en attente (badge sur « Répondre au client »). */
  pendingReplies?: number;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pourquoi êtes-vous là ?</DialogTitle>
          <DialogDescription>
            Choisissez votre mission. Ensuite, montrez et parlez — PHÉNIX prépare le reste.
          </DialogDescription>
        </DialogHeader>

        {/* Action PLAISIR mise en avant : publier des photos dans les coulisses,
            sans passer par le sous-menu (qui reste un espace de consultation). */}
        <button
          type="button"
          onClick={onPublishAlbum}
          className="group flex w-full items-start gap-3 rounded-xl border border-gold-200 bg-gold-50 p-4 text-left shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
            <Images aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              Publier dans les coulisses
            </span>
            <span className="block text-xs text-muted-foreground">
              Jusqu’à 10 photos → un album, partagé au client
            </span>
          </span>
        </button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MISSIONS.map((m) => {
            const Icon = ICONS[m.kind];
            return (
              <button
                key={m.kind}
                type="button"
                onClick={() => onSelect(m.kind)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
                  <Icon aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions administratives (document / demande / réponse), déplacées du
            Suivi : créer, c'est TOUJOURS ici. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMPOSE_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.kind}
                type="button"
                onClick={() => onCompose(a.kind)}
                className="group relative flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-5">
                  <Icon aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{a.label}</span>
                  <span className="block text-xs text-muted-foreground">{a.description}</span>
                </span>
                {a.kind === 'repondre' && pendingReplies > 0 && (
                  <span className="absolute right-3 top-3">
                    <Badge variant="gold">{pendingReplies}</Badge>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
