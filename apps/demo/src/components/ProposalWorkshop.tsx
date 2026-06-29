import { Badge, Button, Input, Textarea } from '@phenix360/ui';
import { Image as ImageIcon, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { proposalNoun, type ClientSelection, type SelectionOption } from '@phenix360/core';
import { warmGradient } from './gradient';

const MAX_OPTIONS = 5;

/**
 * Atelier conducteur — « Propositions préparées par PHÉNIX ». Fidèle à la
 * promesse produit : PHÉNIX prépare, le conducteur RELIT et AJUSTE (titre,
 * texte, photo, suppression/ajout dans la limite de 5), puis ENVOIE au client.
 * Il ne compose jamais depuis une page vide. Le client ne voit rien de cet
 * atelier — seulement le résultat envoyé.
 */
export function ProposalWorkshop({
  selections,
  onChange,
}: {
  selections: ClientSelection[];
  onChange: (next: ClientSelection[]) => void;
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

  const sendToClient = (selId: string) => mutate(selId, (s) => ({ ...s, statut: 'propose' }));

  return (
    <div className="space-y-5">
      {prepared.map((s) => {
        const options = s.options ?? [];
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
                  s.statut === 'valide' ? 'success' : s.statut === 'propose' ? 'info' : 'neutral'
                }
              >
                {s.statut === 'valide'
                  ? 'Validé par le client'
                  : s.statut === 'propose'
                    ? 'Envoyé au client'
                    : 'À envoyer'}
              </Badge>
            </div>

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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground [&_svg]:size-3.5"
                        onClick={() => setOption(s.id, o.id, { imageSeed: crypto.randomUUID() })}
                      >
                        <RefreshCw aria-hidden />
                        Photo
                      </Button>
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
              <Button size="sm" disabled={options.length === 0} onClick={() => sendToClient(s.id)}>
                <Send aria-hidden />
                {s.statut === 'propose' ? 'Renvoyer au client' : 'Envoyer au client'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
