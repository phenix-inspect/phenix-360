import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';

/**
 * Protection contre la PERTE DE SAISIE. Dès qu'une mission contient un travail en
 * cours, on prévient avant de quitter — par la croix / Échap (dialogue clair) ET
 * par le rechargement / la fermeture d'onglet (garde native `beforeunload`). On ne
 * dérange JAMAIS l'utilisateur si rien n'a été saisi.
 */
export function useBeforeUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      // Requis par certains navigateurs pour afficher la confirmation native.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/**
 * Confirmation d'abandon EN LIGNE (dans la surface elle-même). À utiliser quand
 * la surface protégée est déjà un Dialog Radix (composers) : un second Dialog
 * Radix superposé se disputerait le focus / `pointer-events` / `aria-hidden` du
 * premier (le bouton « Continuer » devenait inaccessible). Rendu à l'intérieur du
 * DialogContent, ce calque `absolute` reste dans la même couche Radix — donc
 * pleinement cliquable et lisible par les lecteurs d'écran.
 */
export function LeaveConfirmInline({
  open,
  onCancel,
  onLeave,
}: {
  open: boolean;
  onCancel: () => void;
  onLeave: () => void;
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Échap = « Continuer la saisie » ; on empêche Radix de fermer le composer.
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/95 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Votre saisie n’est pas terminée"
    >
      <div className="w-full max-w-sm">
        <h2 className="font-serif text-xl font-semibold leading-tight tracking-tight text-foreground">
          Votre saisie n’est pas terminée
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Voulez-vous vraiment quitter sans enregistrer ? Votre travail en cours sera perdu.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Continuer la saisie
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Quitter sans enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Dialogue « quitter sans enregistrer ? » — uniforme pour toutes les missions. */
export function LeaveConfirmDialog({
  open,
  onCancel,
  onLeave,
}: {
  open: boolean;
  onCancel: () => void;
  onLeave: () => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Votre saisie n’est pas terminée</DialogTitle>
          <DialogDescription>
            Voulez-vous vraiment quitter sans enregistrer ? Votre travail en cours sera perdu.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Continuer la saisie
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Quitter sans enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
