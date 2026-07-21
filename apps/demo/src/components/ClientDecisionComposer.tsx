import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@phenix360/ui';
import { Image as ImageIcon, Plus, Send, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { SelectionOption } from '@phenix360/core';
import { warmGradient } from './gradient';
import { fileToImageUrl } from '../lib/image';
import { PhotoInput } from './PhotoInput';
import { LeaveConfirmInline, useBeforeUnloadGuard } from './mission/LeaveGuard';

const MAX_OPTIONS = 5;

interface DraftOption {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
}

/**
 * « Décision client » — le conducteur PRÉPARE une décision et l'envoie au client.
 * Formulaire simple (pas de nouveau module) : titre, contexte, photos, jusqu'à
 * 5 choix (titre + description + photo optionnelle). La délégation « Je fais
 * confiance à PHÉNIX » est TOUJOURS offerte au client en plus — inutile de
 * l'ajouter ici. En sortie : une décision client existante (réutilise le modèle).
 */
export function ClientDecisionComposer({
  onCreate,
  onClose,
}: {
  onCreate: (input: {
    titre: string;
    contexte?: string;
    photos?: string[];
    options: SelectionOption[];
  }) => void | Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const [titre, setTitre] = useState('');
  const [contexte, setContexte] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [options, setOptions] = useState<DraftOption[]>([
    { id: crypto.randomUUID(), title: '', description: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // PERTE DE SAISIE — la demande est « en cours » dès qu'un champ est rempli.
  const dirty =
    titre.trim() !== '' ||
    contexte.trim() !== '' ||
    photos.length > 0 ||
    options.some((o) => o.title.trim() !== '' || o.description.trim() !== '' || !!o.imageUrl);
  useBeforeUnloadGuard(dirty);
  const requestClose = (): void => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };

  const setOption = (id: string, patch: Partial<DraftOption>): void =>
    setOptions((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const removeOption = (id: string): void => setOptions((os) => os.filter((o) => o.id !== id));
  const addOption = (): void =>
    setOptions((os) =>
      os.length >= MAX_OPTIONS
        ? os
        : [...os, { id: crypto.randomUUID(), title: '', description: '' }],
    );

  const addPhotos = async (files: File[]): Promise<void> => {
    const urls = await Promise.all(files.map((f) => fileToImageUrl(f)));
    setPhotos((p) => [...p, ...urls]);
  };

  // Au moins un choix nommé (la délégation PHÉNIX s'ajoutera côté client).
  const validOptions = options.filter((o) => o.title.trim() !== '');
  const canSubmit = titre.trim() !== '' && validOptions.length >= 1 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    await onCreate({
      titre: titre.trim(),
      ...(contexte.trim() ? { contexte: contexte.trim() } : {}),
      ...(photos.length > 0 ? { photos } : {}),
      options: validOptions.map((o): SelectionOption => ({
        id: o.id,
        title: o.title.trim(),
        ...(o.description.trim() ? { description: o.description.trim() } : {}),
        ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
      })),
    });
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !confirmLeave && requestClose()}>
      {/* Pas de `relative` : `DialogContent` est déjà `fixed` (le passer casserait
          le centrage — tailwind-merge résout le conflit de position → hors écran). */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Demander une décision au client</DialogTitle>
          <DialogDescription>
            Présentez le choix, ajoutez vos options. Le client validera depuis son espace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Titre de la demande</label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Choix du carrelage de la salle de bain"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Contexte / explication{' '}
              <span className="font-normal text-muted-foreground">(optionnel)</span>
            </label>
            <Textarea
              value={contexte}
              onChange={(e) => setContexte(e.target.value)}
              rows={2}
              placeholder="Expliquez au client ce que vous attendez de lui."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Photos <span className="font-normal text-muted-foreground">(optionnel)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => (
                <div
                  key={i}
                  className="relative size-20 overflow-hidden rounded-lg border border-border"
                >
                  <img src={src} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="Retirer la photo"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-ink-900/70 text-paper-0 [&_svg]:size-3"
                  >
                    <X aria-hidden />
                  </button>
                </div>
              ))}
              <PhotoInput
                multiple
                onFiles={addPhotos}
                className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-gold-300 hover:text-foreground [&_svg]:size-4"
              >
                <Upload aria-hidden />
                Ajouter
              </PhotoInput>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Les choix proposés ({validOptions.length}/{MAX_OPTIONS})
              </label>
            </div>

            <ul className="space-y-3">
              {options.map((o, i) => {
                const ref = String.fromCharCode(65 + i);
                const seed = `${o.id}-${o.title}`;
                return (
                  <li key={o.id} className="flex gap-3 rounded-xl border border-border p-3">
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-gold-100 font-mono text-xs font-semibold text-gold-800">
                        {ref}
                      </span>
                      <div
                        className="relative aspect-[4/3] w-24 overflow-hidden rounded-lg"
                        style={o.imageUrl ? undefined : warmGradient(seed)}
                      >
                        {o.imageUrl ? (
                          <img src={o.imageUrl} alt={o.title} className="size-full object-cover" />
                        ) : (
                          <span
                            aria-hidden
                            className="absolute inset-0 flex items-center justify-center text-paper-0 [&_svg]:size-6"
                            style={{ opacity: 0.18 }}
                          >
                            <ImageIcon />
                          </span>
                        )}
                      </div>
                      <PhotoInput
                        onFiles={(files) => {
                          const file = files[0];
                          if (file)
                            void fileToImageUrl(file).then((imageUrl) =>
                              setOption(o.id, { imageUrl }),
                            );
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
                      >
                        <Upload aria-hidden />
                        {o.imageUrl ? 'Remplacer' : 'Photo'}
                      </PhotoInput>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={o.title}
                        onChange={(e) => setOption(o.id, { title: e.target.value })}
                        placeholder={`Titre du choix ${ref}`}
                      />
                      <Textarea
                        value={o.description}
                        onChange={(e) => setOption(o.id, { description: e.target.value })}
                        rows={2}
                        placeholder="Description courte (optionnel)"
                      />
                    </div>

                    {options.length > 1 && (
                      <button
                        type="button"
                        aria-label="Supprimer ce choix"
                        onClick={() => removeOption(o.id)}
                        className="shrink-0 self-start text-muted-foreground hover:text-destructive [&_svg]:size-4"
                      >
                        <Trash2 aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <Button
              size="sm"
              variant="outline"
              disabled={options.length >= MAX_OPTIONS}
              onClick={addOption}
            >
              <Plus aria-hidden />
              Ajouter un choix{options.length >= MAX_OPTIONS ? ' (max 5)' : ''}
            </Button>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-ink-800 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-700">
            <Sparkles aria-hidden />
            <span>
              L'option « Je fais confiance à PHÉNIX et je laisse mon conducteur choisir pour moi »
              sera proposée au client, en plus de vos choix.
            </span>
          </p>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={requestClose}>
              Annuler
            </Button>
            <Button disabled={!canSubmit} onClick={() => void submit()}>
              <Send aria-hidden />
              Envoyer au client
            </Button>
          </div>
        </div>
        {/* Confirmation EN LIGNE : même couche Radix, aucun conflit de focus. */}
        <LeaveConfirmInline
          open={confirmLeave}
          onCancel={() => setConfirmLeave(false)}
          onLeave={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
