import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { ProjectId } from '@phenix360/core';
import { demo } from '../store';

/**
 * Suppression d'un chantier — action destructive PROTÉGÉE (confirmation
 * obligatoire), sans nouvel écran : un simple bouton + une boîte de dialogue de
 * confirmation. 100 % local (aucun backend). Réutilisée dans « Gérer » et sur la
 * fiche du chantier actif.
 */
export function DeleteChantierButton({
  projectId,
  name,
  onDeleted,
  className,
  label = 'Supprimer ce chantier',
  compact = false,
}: {
  projectId: ProjectId;
  name: string;
  onDeleted?: () => void;
  className?: string;
  label?: string;
  /** Rendu icône seule (pour une liste dense). */
  compact?: boolean;
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);

  const remove = (): void => {
    void demo.deleteChantier(projectId);
    setConfirming(false);
    onDeleted?.();
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Supprimer ${name}`}
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-base hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 ${className ?? ''}`}
        >
          <Trash2 aria-hidden />
        </button>
      ) : (
        <Button
          variant="ghost"
          className={`justify-start text-destructive hover:bg-destructive/10 ${className ?? ''}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden />
          {label}
        </Button>
      )}

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {name} » ?</DialogTitle>
            <DialogDescription>
              Cette action supprime le chantier et toutes ses données locales.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-destructive">
            <AlertTriangle aria-hidden />
            <p>
              Journal, missions, réserves, photos et coulisses, documents et conversations PHÉNIX
              seront retirés. <strong>Cette action est irréversible.</strong>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={remove}>
              <Trash2 aria-hidden />
              Supprimer définitivement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
