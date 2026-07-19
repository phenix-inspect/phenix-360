import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { Camera, ImageUp, X } from 'lucide-react';
import { ACCEPT_IMAGE } from '../lib/media';

/**
 * L'appareil a-t-il un pointeur GROSSIER (doigt) ? → téléphone / tablette. On
 * propose alors le choix « Prendre une photo / Choisir un fichier ». Sur un
 * ordinateur (pointeur fin), on ouvre directement le sélecteur de fichiers : pas
 * de bouton « appareil photo » inutile. SSR-safe, réactif au branchement d'une
 * souris/écran tactile.
 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const apply = (): void => setCoarse(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return coarse;
}

/**
 * PHOTO / PIÈCE JOINTE — point d'entrée UNIQUE et PARTAGÉ de toute l'application.
 * ---------------------------------------------------------------------------
 * Où que l'on ajoute une photo (compte rendu, réserve, coulisses, décision,
 * document, espace client…), on utilise CE composant — jamais une implémentation
 * maison. Il garantit partout le MÊME comportement :
 *
 *   • Sur téléphone / tablette : un choix clair « Prendre une photo » (ouvre
 *     directement l'appareil, via l'attribut natif `capture`) OU « Choisir une
 *     photo ou un fichier » (sélecteur natif complet : photothèque, Fichiers,
 *     iCloud Drive, Google Drive… selon l'appareil).
 *   • Sur ordinateur : ouverture directe du sélecteur de fichiers (pas de bouton
 *     appareil photo superflu).
 *
 * On s'appuie sur le sélecteur de fichiers NATIF (jamais `getUserMedia`) : les
 * autorisations appareil photo, l'annulation et le refus sont gérés par l'OS/
 * navigateur — rien à réimplémenter, et « Annuler » ne fait qu'abandonner sans
 * erreur. Le composant ne gère QUE la SOURCE : l'appelant reçoit les fichiers
 * (`onFiles`) et garde sa logique (aperçu, `loadPhotos`, état de chargement,
 * message d'erreur, garde anti double-envoi).
 */
export function PhotoInput({
  onFiles,
  multiple = false,
  disabled = false,
  accept = ACCEPT_IMAGE,
  camera = true,
  className,
  children,
  ariaLabel,
  title = 'Ajouter une photo',
  inputTestId,
}: {
  /** Reçoit les fichiers choisis (caméra ou bibliothèque). */
  onFiles: (files: File[]) => void | Promise<void>;
  multiple?: boolean;
  disabled?: boolean;
  /** Types acceptés (défaut : images). Pour un document : `ACCEPT_DOCUMENT`. */
  accept?: string;
  /** Proposer « Prendre une photo » (appareil). `false` pour un import seul. */
  camera?: boolean;
  /** Style du déclencheur (bouton). */
  className?: string;
  /** Contenu du déclencheur (icône + libellé). */
  children: React.ReactNode;
  ariaLabel?: string;
  /** Titre de la feuille de choix (mobile). */
  title?: string;
  /** `data-testid` posé sur l'entrée « bibliothèque » (pour les tests e2e). */
  inputTestId?: string;
}): React.JSX.Element {
  const coarse = useCoarsePointer();
  const [sheetOpen, setSheetOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  const emit = (files: FileList | null): void => {
    if (files && files.length > 0) void onFiles(Array.from(files));
  };

  const openTrigger = (): void => {
    if (disabled) return;
    // Ordinateur (ou caméra désactivée) → sélecteur de fichiers directement.
    if (!camera || !coarse) {
      libraryRef.current?.click();
      return;
    }
    // Téléphone / tablette → feuille de choix « appareil photo / fichier ».
    setSheetOpen(true);
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>): void => {
    // On ferme la feuille PUIS on déclenche l'entrée native (clic programmatique,
    // hors piège de pointeur d'un éventuel Dialog parent).
    setSheetOpen(false);
    ref.current?.click();
  };

  return (
    <>
      {/* Deux entrées NATIVES cachées. La BIBLIOTHÈQUE est rendue en premier :
          `input[type=file]:first` correspond ainsi au sélecteur « classique »
          (comportement historique, cible des tests). L'appareil photo (capture)
          suit. Les deux appellent le MÊME `onFiles`. */}
      <input
        ref={libraryRef}
        type="file"
        accept={accept}
        {...(multiple ? { multiple: true } : {})}
        {...(inputTestId ? { 'data-testid': inputTestId } : {})}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        {...(multiple ? { multiple: true } : {})}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={openTrigger}
        disabled={disabled}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        className={className}
      >
        {children}
      </button>

      {/* Feuille de choix (téléphone/tablette) : un vrai Dialog (Radix) — géré
          correctement même IMBRIQUÉ dans un autre Dialog (focus, Échap, clics). */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-w-sm gap-3">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Prenez une photo maintenant, ou choisissez-en une dans votre téléphone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start"
              onClick={() => pick(cameraRef)}
            >
              <Camera aria-hidden /> Prendre une photo
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start"
              onClick={() => pick(libraryRef)}
            >
              <ImageUp aria-hidden /> Choisir une photo ou un fichier
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full justify-center text-muted-foreground"
              onClick={() => setSheetOpen(false)}
            >
              <X aria-hidden /> Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
