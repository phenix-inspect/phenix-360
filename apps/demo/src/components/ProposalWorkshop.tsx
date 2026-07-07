import { useState } from 'react';
import { Badge, Button, Input, Textarea } from '@phenix360/ui';
import { Check, Image as ImageIcon, Plus, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import {
  isPhenixDelegate,
  proposalNoun,
  recommendDelegatedOption,
  type ClientSelection,
  type SelectionOption,
} from '@phenix360/core';
import { warmGradient } from './gradient';
import { fileToImageUrl } from '../lib/image';
import { ACCEPT_IMAGE } from '../lib/media';

const MAX_OPTIONS = 5;

/**
 * Atelier conducteur — « Propositions préparées par PHÉNIX ». Fidèle à la
 * promesse produit : PHÉNIX prépare, le conducteur RELIT et AJUSTE (titre,
 * texte, photo, suppression/ajout dans la limite de 5), puis ENVOIE au client.
 * Quand le client a DÉLÉGUÉ le choix, PHÉNIX recommande une proposition au
 * conducteur, qui confirme ou ajuste — le choix final reste tracé. Le client ne
 * voit rien de cet atelier.
 */
export function ProposalWorkshop({
  selections,
  onChange,
  onSend,
  onConfirmDelegation,
}: {
  selections: ClientSelection[];
  onChange: (next: ClientSelection[]) => void;
  onSend: (selectionId: string) => void;
  onConfirmDelegation: (selectionId: string, optionId: string) => void;
}): React.JSX.Element | null {
  const prepared = selections.filter((s) => (s.options?.length ?? 0) > 0);
  if (prepared.length === 0) return null;

  const mutate = (selId: string, fn: (s: ClientSelection) => ClientSelection) =>
    onChange(selections.map((s) => (s.id === selId ? fn(s) : s)));

  const setOption = (selId: string, optId: string, patch: Partial<SelectionOption>) =>
    mutate(selId, (s) => ({
      ...s,
      options: (s.options ?? []).map((o) => (o.id === optId ? { ...o, ...patch } : o)),
    }));

  const removeOption = (selId: string, optId: string) =>
    mutate(selId, (s) => ({ ...s, options: (s.options ?? []).filter((o) => o.id !== optId) }));

  const addOption = (selId: string) =>
    mutate(selId, (s) => {
      const opts = s.options ?? [];
      if (opts.length >= MAX_OPTIONS) return s;
      return {
        ...s,
        options: [
          ...opts,
          { id: crypto.randomUUID(), title: 'Nouvelle proposition', description: '' },
        ],
      };
    });

  const pickPhoto = async (selId: string, optId: string, file: File) => {
    const imageUrl = await fileToImageUrl(file);
    setOption(selId, optId, { imageUrl });
  };

  return (
    <div className="space-y-5">
      {prepared.map((s) => {
        const options = s.options ?? [];
        const delegatedPending = Boolean(s.delegatedToPhenix) && isPhenixDelegate(s.chosenOptionId);
        const delegatedFinal =
          Boolean(s.delegatedToPhenix) && !!s.chosenOptionId && !isPhenixDelegate(s.chosenOptionId);
        const retained = delegatedFinal
          ? options.find((o) => o.id === s.chosenOptionId)
          : undefined;
        const retainedRef = retained
          ? (retained.ref ?? String.fromCharCode(65 + options.indexOf(retained)))
          : '';

        return (
          <div key={s.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
                  {s.categorie}
                </p>
                <p className="text-sm text-foreground">
                  {options.length} {proposalNoun(s.categorie)} préparée
                  {options.length > 1 ? 's' : ''}
                </p>
              </div>
              <Badge
                variant={
                  s.statut === 'valide'
                    ? 'success'
                    : s.statut === 'propose'
                      ? 'info'
                      : s.modificationRequested
                        ? 'warning'
                        : 'neutral'
                }
              >
                {s.statut === 'valide'
                  ? s.delegatedToPhenix
                    ? 'Confié à PHÉNIX'
                    : 'Validé par le client'
                  : s.statut === 'propose'
                    ? 'Envoyé au client'
                    : s.modificationRequested
                      ? 'Modification demandée'
                      : 'À envoyer'}
              </Badge>
            </div>

            {delegatedPending ? (
              <DelegationPanel selection={s} onConfirm={onConfirmDelegation} />
            ) : delegatedFinal ? (
              <p className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-ink-800 [&_svg]:size-4 [&_svg]:text-gold-700">
                <Sparkles aria-hidden />
                Après délégation du client, PHÉNIX a retenu :{' '}
                <span className="font-medium">
                  {retainedRef} — {retained?.title}
                </span>
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {options.map((o, i) => {
                    const ref = o.ref ?? String.fromCharCode(65 + i);
                    const seed = o.imageSeed ?? `${o.id}-${o.title}`;
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
                              <img
                                src={o.imageUrl}
                                alt={o.title}
                                className="size-full object-cover"
                              />
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
                          <div className="flex flex-col items-center">
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground [&_svg]:size-3.5">
                              <Upload aria-hidden />
                              {o.imageUrl ? 'Remplacer' : 'Photo'}
                              <input
                                type="file"
                                accept={ACCEPT_IMAGE}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (file) void pickPhoto(s.id, o.id, file);
                                }}
                              />
                            </label>
                            {o.imageUrl && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => setOption(s.id, o.id, { imageUrl: undefined })}
                              >
                                Retirer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            value={o.title}
                            onChange={(e) => setOption(s.id, o.id, { title: e.target.value })}
                            placeholder="Titre de la proposition"
                          />
                          <Textarea
                            value={o.description ?? ''}
                            onChange={(e) => setOption(s.id, o.id, { description: e.target.value })}
                            rows={2}
                            placeholder="Texte de présentation"
                          />
                        </div>

                        <button
                          type="button"
                          aria-label="Supprimer cette proposition"
                          onClick={() => removeOption(s.id, o.id)}
                          className="shrink-0 self-start text-muted-foreground hover:text-destructive [&_svg]:size-4"
                        >
                          <Trash2 aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={options.length >= MAX_OPTIONS}
                    onClick={() => addOption(s.id)}
                  >
                    <Plus aria-hidden />
                    Ajouter une proposition
                    {options.length >= MAX_OPTIONS ? ' (max 5)' : ''}
                  </Button>
                  <Button size="sm" disabled={options.length === 0} onClick={() => onSend(s.id)}>
                    <Send aria-hidden />
                    {s.statut === 'propose' || s.modificationRequested
                      ? 'Renvoyer au client'
                      : 'Envoyer au client'}
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Le client a délégué : PHÉNIX recommande une proposition, le conducteur
 * confirme ou retient une autre. Le choix final est tracé au journal.
 */
function DelegationPanel({
  selection,
  onConfirm,
}: {
  selection: ClientSelection;
  onConfirm: (selectionId: string, optionId: string) => void;
}): React.JSX.Element | null {
  const rec = recommendDelegatedOption(selection);
  const options = selection.options ?? [];
  const [selected, setSelected] = useState(rec?.optionId ?? options[0]?.id ?? '');
  if (!rec) return null;

  return (
    <div className="space-y-3 rounded-xl border border-gold-200 bg-gold-50 p-3">
      <div className="space-y-0.5">
        <p className="font-serif text-base font-semibold tracking-tight text-foreground">
          Le client vous fait confiance.
        </p>
        <p className="text-sm text-muted-foreground">
          J'ai analysé les {proposalNoun(selection.categorie)} et je vous recommande :
        </p>
      </div>

      <div className="rounded-lg border border-gold-300 bg-surface p-3">
        <p className="font-serif text-base font-semibold text-foreground">
          {rec.ref} — {rec.title}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gold-700">Pourquoi</p>
        <ul className="mt-1 space-y-1">
          {rec.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Confirmez la recommandation, ou retenez une autre proposition :
        </p>
        {options.map((o, i) => {
          const ref = o.ref ?? String.fromCharCode(65 + i);
          const isSel = o.id === selected;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => setSelected(o.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                isSel
                  ? 'border-primary bg-surface'
                  : 'border-border bg-surface hover:border-gold-300'
              }`}
            >
              <span
                aria-hidden
                className={`flex size-4 items-center justify-center rounded-full border-2 ${
                  isSel ? 'border-primary' : 'border-input'
                }`}
              >
                {isSel && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="font-mono text-xs font-semibold text-gold-800">{ref}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{o.title}</span>
              {o.id === rec.optionId && <Badge variant="info">Recommandée</Badge>}
            </button>
          );
        })}
      </div>

      <Button size="sm" disabled={!selected} onClick={() => onConfirm(selection.id, selected)}>
        <Check aria-hidden />
        {selected === rec.optionId ? 'Confirmer la recommandation' : 'Retenir cette proposition'}
      </Button>
    </div>
  );
}
