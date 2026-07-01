import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@phenix360/ui';
import { MISSIONS, type MissionKind } from '@phenix360/core';
import {
  ClipboardList,
  Eye,
  KeyRound,
  PenLine,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

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
 * « Pourquoi êtes-vous là ? » — le seul choix du conducteur, en un tap. Ce n'est
 * pas « quel document créer ? » : c'est la raison de sa présence. La mission
 * oriente ensuite tout ce que PHÉNIX prépare, sans jamais l'enfermer.
 */
export function MissionPicker({
  onSelect,
  onClose,
}: {
  onSelect: (kind: MissionKind) => void;
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
      </DialogContent>
    </Dialog>
  );
}
