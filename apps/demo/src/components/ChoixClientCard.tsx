import { Badge } from '@phenix360/ui';
import { Check, Image as ImageIcon, MessageSquare, Sparkles } from 'lucide-react';
import { isPhenixDelegate, type ClientSelection } from '@phenix360/core';
import { warmGradient } from './gradient';
import { fmtDateTime } from '../lib/format';

/** Statut d'un choix client, tel que suivi côté conducteur. */
export type ChoixStatus = 'non_lu' | 'en_attente' | 'repondu';

const STATUS_LABEL: Record<ChoixStatus, string> = {
  non_lu: 'Non lu',
  en_attente: 'En attente de réponse',
  repondu: 'Répondu',
};
const STATUS_VARIANT: Record<ChoixStatus, 'info' | 'warning' | 'success'> = {
  non_lu: 'info',
  en_attente: 'warning',
  repondu: 'success',
};

/** Repère A, B, C… d'une option selon sa position. */
const optionLetter = (i: number): string => String.fromCharCode(65 + i);

/**
 * Carte d'une DEMANDE DE CHOIX, vue CONDUCTEUR (dans « Demandes client »). Un
 * objet pilotable : titre, texte, date, statut, options proposées (avec photos)
 * et — quand le client a répondu — l'option CHOISIE en clair (libellé + photo)
 * plus son commentaire. On n'affiche JAMAIS un simple « Option 2 ».
 */
export function ChoixClientCard({
  selection,
  createdAt,
  status,
}: {
  selection: ClientSelection;
  createdAt: string;
  status: ChoixStatus;
}): React.JSX.Element {
  const options = selection.options ?? [];
  const chosenIndex = options.findIndex((o) => o.id === selection.chosenOptionId);
  const chosen = chosenIndex >= 0 ? options[chosenIndex] : undefined;
  const delegated = isPhenixDelegate(selection.chosenOptionId) || selection.delegatedToPhenix;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold">Choix client</Badge>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        <span className="text-xs text-muted-foreground">{fmtDateTime(createdAt)}</span>
      </div>

      <div className="space-y-1">
        <h3 className="font-serif text-base font-semibold text-foreground">
          {selection.categorie}
        </h3>
        {selection.contexte && (
          <p className="text-sm leading-relaxed text-muted-foreground">{selection.contexte}</p>
        )}
      </div>

      {/* Photos d'illustration de la demande (hors options). */}
      {selection.photos && selection.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selection.photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="size-20 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      {/* Réponse du client — l'option CHOISIE en clair (jamais « Option 2 »). */}
      {status === 'repondu' && (
        <div className="rounded-xl border border-success/40 bg-success/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success [&_svg]:size-4">
            <Check aria-hidden />
            Le client a choisi
          </p>
          {delegated ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
              <Sparkles aria-hidden />
              Choix confié à PHÉNIX
            </p>
          ) : chosen ? (
            <div className="mt-2 flex items-start gap-3">
              <OptionThumb option={chosen} index={chosenIndex} className="size-20" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Option {optionLetter(chosenIndex)} — {chosen.title}
                </p>
                {chosen.description && (
                  <p className="text-xs text-muted-foreground">{chosen.description}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-foreground">
              {selection.detail ?? 'Choix validé'}
            </p>
          )}
          {selection.clientComment && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
              <MessageSquare aria-hidden />
              <span className="italic">« {selection.clientComment} »</span>
            </p>
          )}
        </div>
      )}

      {/* Options proposées (avec photo si disponible). */}
      {options.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {options.length} option{options.length > 1 ? 's' : ''} proposée
            {options.length > 1 ? 's' : ''}
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((o, i) => {
              const isChosen = o.id === selection.chosenOptionId;
              return (
                <li
                  key={o.id}
                  className={`flex gap-2 rounded-lg border p-2 ${
                    isChosen ? 'border-success bg-success/5' : 'border-border bg-surface'
                  }`}
                >
                  <OptionThumb option={o} index={i} className="size-12" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {optionLetter(i)} · {o.title}
                    </p>
                    {o.description && (
                      <p className="truncate text-[11px] text-muted-foreground">{o.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Vignette d'une option : sa photo si disponible, sinon un dégradé éditorial. */
function OptionThumb({
  option,
  index,
  className,
}: {
  option: { id: string; title: string; imageUrl?: string };
  index: number;
  className: string;
}): React.JSX.Element {
  if (option.imageUrl)
    return (
      <img
        src={option.imageUrl}
        alt={option.title}
        className={`shrink-0 rounded-md object-cover ${className}`}
      />
    );
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-md text-paper-0 [&_svg]:size-4 ${className}`}
      style={{ ...warmGradient(`${option.id}-${index}`), opacity: 0.9 }}
    >
      <ImageIcon />
    </span>
  );
}
