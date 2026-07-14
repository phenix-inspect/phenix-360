import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@phenix360/ui';
import { FileText, Send, User } from 'lucide-react';

/**
 * CONDITION BÊTA #2 — CONFIRMATION AVANT DIFFUSION CLIENT.
 * =======================================================
 * Aucune action VISIBLE PAR LE CLIENT ne doit partir d'un simple clic ambigu.
 * Avant de rendre un document visible au client, le conducteur voit un récapitulatif
 * clair (document, destinataire, version, notification) et confirme explicitement.
 * Le bouton d'action est verrouillé pendant l'envoi (anti double-clic → jamais de
 * double diffusion).
 */
export function DiffusionConfirmDialog({
  open,
  documentLabel,
  clientName,
  version,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  documentLabel: string;
  clientName?: string;
  version?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Diffuser ce document au client ?</DialogTitle>
          <DialogDescription>
            Vérifiez avant d’envoyer. Une fois diffusé, le document devient visible dans l’espace
            client.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <Recap icon={<FileText aria-hidden />} label="Document">
            {documentLabel}
            {version != null && version > 1 ? ` — version ${version}` : ''}
          </Recap>
          <Recap icon={<User aria-hidden />} label="Destinataire">
            {clientName ? `${clientName} (espace client)` : 'Votre client (espace client)'}
          </Recap>
          <Recap icon={<Send aria-hidden />} label="Notification">
            Le client recevra une notification « Nouveau document partagé ».
          </Recap>
        </dl>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Send aria-hidden />
            {busy ? 'Diffusion…' : 'Confirmer la diffusion au client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Recap({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}
