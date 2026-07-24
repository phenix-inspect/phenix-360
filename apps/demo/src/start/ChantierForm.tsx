import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@phenix360/ui';
import { PROJECT_STEPS, PROJECT_STEP_LABEL, type ProjectStep } from '@phenix360/core';

export interface ChantierValues {
  name: string;
  clientName: string;
  address: string;
  startStep: ProjectStep;
}

/**
 * Créer / modifier un chantier RÉEL (Lot 2). Petit formulaire premium, direct :
 * nom, client, adresse, étape de départ. Pas d'onboarding, pas de tunnel. Sert la
 * création (champs vides) ET l'édition (pré-remplie). VISION Art. 2, 11.
 */
export function ChantierForm({
  mode,
  initial,
  onSubmit,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ChantierValues>;
  onSubmit: (values: ChantierValues) => void | Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [clientName, setClientName] = useState(initial?.clientName ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [startStep, setStartStep] = useState<ProjectStep>(initial?.startStep ?? 'gros_oeuvre');
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({ name, clientName, address, startStep });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Créer un chantier' : 'Modifier le chantier'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Votre chantier, en quelques secondes. Vous pourrez tout modifier ensuite.'
              : 'Mettez à jour les informations de ce chantier.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Nom du chantier</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Rénovation appartement Lyon 6e"
              aria-label="Nom du chantier"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Nom du client</span>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex. Mme Martin"
              aria-label="Nom du client"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Adresse</span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex. 12 rue de la République, Lyon 6e"
              aria-label="Adresse du chantier"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Étape de départ</span>
            <select
              value={startStep}
              onChange={(e) => setStartStep(e.target.value as ProjectStep)}
              aria-label="Étape de départ"
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              {PROJECT_STEPS.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STEP_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {mode === 'create' ? 'Créer le chantier' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
