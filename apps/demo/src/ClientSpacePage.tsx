/**
 * PHÉNIX 360 — Espace client par LIEN + CODE (M7.1 → M7.2.2)
 * ===========================================================================
 * Page AUTONOME, atteinte par un lien `…/#/c/<projectId>` : le client (SANS
 * compte) saisit le code communiqué par son artisan. Le code est vérifié CÔTÉ
 * SERVEUR (fonction Supabase `client_space`, SECURITY DEFINER) ; sans le bon
 * code, rien ne s'affiche. La page ne montre QUE ce qui est visible au client
 * (récit, photos, documents, décisions, demandes) — miroir de `isVisibleToClient`.
 *
 * Volontairement séparée de l'app conducteur (AUCUN accès au store local) : elle
 * ne peut donc rien casser côté conducteur. Le client peut désormais ÉCRIRE, via
 * des RPC code-gardées : répondre à une demande (M7.2.1), valider un choix / le
 * confier à PHÉNIX (M7.2.2), et écrire un message libre au conducteur (M7.2.3).
 * Chaque écriture ne pose qu'une trace au journal, que le conducteur relit (et
 * reçoit en temps réel, M6) — jamais d'accès direct en écriture (RLS).
 */
import { useEffect, useMemo, useState } from 'react';
import { BrandMark, Button, Input, Textarea } from '@phenix360/ui';
import {
  PHENIX_DELEGATE_ID,
  PROJECT_STATUS_LABEL,
  type EventAttachment,
  type ProjectStatus,
} from '@phenix360/core';
import { getSupabaseClient } from './lib/supabase';
import { openAttachment } from './lib/document';

interface ClientEvent {
  id: string;
  type: string;
  author_role: string;
  visibility: string;
  state: string;
  created_at: string;
  content: Record<string, unknown>;
}
interface ClientProject {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  status: ProjectStatus;
  current_step: string | null;
  created_at: string;
}
interface ClientSpaceData {
  project: ClientProject;
  events: ClientEvent[];
}

/** Mémoire de session : évite de redemander le code à chaque rechargement. */
const codeKey = (projectId: string): string => `phenix-client-code:${projectId}`;

export function ClientSpacePage({ projectId }: { projectId: string }): React.JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ClientSpaceData | null>(null);
  // Code validé de la session (pour les écritures : répondre à une demande).
  const [activeCode, setActiveCode] = useState('');

  const fetchSpace = async (theCode: string): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const client = await getSupabaseClient();
      if (!client) throw new Error('config');
      const res = await client.rpc('client_space', {
        p_project: projectId,
        p_code: theCode.trim(),
      });
      if (res.error || !res.data || !(res.data as ClientSpaceData).project)
        throw new Error('denied');
      setData(res.data as ClientSpaceData);
      setActiveCode(theCode.trim());
      try {
        sessionStorage.setItem(codeKey(projectId), theCode.trim());
      } catch {
        /* stockage indisponible : on continue */
      }
    } catch {
      setError(
        'Code incorrect, ou chantier introuvable. Vérifiez le code communiqué par votre artisan.',
      );
      try {
        sessionStorage.removeItem(codeKey(projectId));
      } catch {
        /* rien */
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Le client RÉPOND à une demande (écriture via RPC code-gardée). Renvoie
   * l'espace à jour (la fonction serveur le recalcule) ⇒ l'UI se met à jour.
   * Lève en cas d'échec pour que le formulaire affiche l'erreur.
   */
  const respondDemande = async (eventId: string, texte: string): Promise<void> => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('config');
    const res = await client.rpc('client_respond_demande', {
      p_project: projectId,
      p_code: activeCode,
      p_event: eventId,
      p_texte: texte,
    });
    if (res.error || !res.data || !(res.data as ClientSpaceData).project) {
      throw new Error(res.error?.message ?? 'échec');
    }
    setData(res.data as ClientSpaceData);
  };

  /**
   * Le client VALIDE un choix (option retenue) ou le CONFIE à PHÉNIX (option =
   * `PHENIX_DELEGATE_ID`). Écriture via RPC code-gardée ; renvoie l'espace à jour.
   */
  const validateChoix = async (
    carrierEventId: string,
    optionId: string,
    comment: string,
  ): Promise<void> => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('config');
    const res = await client.rpc('client_validate_choix', {
      p_project: projectId,
      p_code: activeCode,
      p_event: carrierEventId,
      p_option: optionId,
      p_message: comment || null,
    });
    if (res.error || !res.data || !(res.data as ClientSpaceData).project) {
      throw new Error(res.error?.message ?? 'échec');
    }
    setData(res.data as ClientSpaceData);
  };

  /**
   * Le client ÉCRIT UN MESSAGE au conducteur (écriture via RPC code-gardée). La
   * fonction serveur crée une demande adressée au conducteur et renvoie l'espace
   * à jour (le client voit son message aussitôt).
   */
  const sendMessage = async (texte: string): Promise<void> => {
    const client = await getSupabaseClient();
    if (!client) throw new Error('config');
    const res = await client.rpc('client_message', {
      p_project: projectId,
      p_code: activeCode,
      p_texte: texte,
    });
    if (res.error || !res.data || !(res.data as ClientSpaceData).project) {
      throw new Error(res.error?.message ?? 'échec');
    }
    setData(res.data as ClientSpaceData);
  };

  // Reprise silencieuse : si le code de cette session est déjà connu, on entre.
  useEffect(() => {
    let saved = '';
    try {
      saved = sessionStorage.getItem(codeKey(projectId)) ?? '';
    } catch {
      saved = '';
    }
    if (saved) void fetchSpace(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (data)
    return (
      <ClientSpace
        data={data}
        onRespond={respondDemande}
        onValidateChoix={validateChoix}
        onSendMessage={sendMessage}
      />
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <BrandMark className="mx-auto size-16" />
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Votre chantier
          </h1>
          <p className="text-sm text-muted-foreground">
            Saisissez le code que votre artisan vous a communiqué pour suivre l’avancement.
          </p>
        </div>
        <div className="space-y-2 text-left">
          <Input
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-label="Code d’accès"
            placeholder="Code d’accès"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) =>
              e.key === 'Enter' && !busy && code.trim().length >= 4 && void fetchSpace(code)
            }
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => void fetchSpace(code)}
          disabled={busy || code.trim().length < 4}
        >
          {busy ? 'Un instant…' : 'Voir mon chantier'}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Le récit (lecture seule)
 * -------------------------------------------------------------------------- */

function ClientSpace({
  data,
  onRespond,
  onValidateChoix,
  onSendMessage,
}: {
  data: ClientSpaceData;
  onRespond: (eventId: string, texte: string) => Promise<void>;
  onValidateChoix: (carrierEventId: string, optionId: string, comment: string) => Promise<void>;
  onSendMessage: (texte: string) => Promise<void>;
}): React.JSX.Element {
  const { project, events } = data;
  // Les CHOIX (événements `decision`) sont regroupés par sélection et présentés à
  // part (« Vos choix ») : le client doit d'abord savoir ce qu'il a à décider.
  const choix = useMemo(() => deriveChoix(events), [events]);
  // Le fil d'actualité : tout le reste, le plus récent en haut.
  const feed = useMemo(
    () =>
      events
        .filter((e) => e.type !== 'decision')
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [events],
  );
  const statusLabel = PROJECT_STATUS_LABEL[project.status] ?? '';
  const pending = choix.filter((c) => !c.resolved);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <BrandMark className="size-9" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg font-semibold tracking-tight text-foreground">
              {project.name}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {project.address ? `${project.address} · ` : ''}
              {statusLabel}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-5 py-6">
        {choix.length > 0 && (
          <section className="space-y-3" aria-label="Vos choix">
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
              {pending.length > 0
                ? pending.length > 1
                  ? `${pending.length} choix vous attendent`
                  : 'Un choix vous attend'
                : 'Vos choix'}
            </h2>
            {choix.map((c) => (
              <ChoixCard key={c.selectionId} choix={c} onValidate={onValidateChoix} />
            ))}
          </section>
        )}

        {feed.length === 0 && choix.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            Votre chantier démarre. Les actualités de votre artisan apparaîtront ici.
          </p>
        ) : (
          feed.map((e) => <EventCard key={e.id} event={e} onRespond={onRespond} />)
        )}

        <MessageComposer onSend={onSendMessage} />

        <p className="pt-4 text-center text-xs text-muted-foreground">Suivi de chantier PHÉNIX</p>
      </main>
    </div>
  );
}

/** Composer « Écrire à votre conducteur » : un message libre (écriture code-gardée). */
function MessageComposer({
  onSend,
}: {
  onSend: (texte: string) => Promise<void>;
}): React.JSX.Element {
  const [texte, setTexte] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy || texte.trim().length === 0) return;
    setBusy(true);
    setError('');
    try {
      await onSend(texte.trim());
      setTexte('');
      setSent(true);
    } catch {
      setError('Votre message n’a pas pu être envoyé. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      aria-label="Écrire à votre conducteur"
    >
      <p className="text-sm font-medium text-foreground">Une question, une remarque ?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Écrivez à votre conducteur — il vous répondra ici.
      </p>
      <Textarea
        className="mt-2"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setError('');
          setSent(false);
        }}
        placeholder="Votre message…"
        rows={3}
        aria-label="Votre message"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {sent && !error && (
        <p role="status" className="mt-2 text-sm text-success">
          Message envoyé — votre conducteur vous répondra ici.
        </p>
      )}
      <Button
        className="mt-2"
        size="sm"
        onClick={() => void submit()}
        disabled={busy || texte.trim().length === 0}
      >
        {busy ? 'Envoi…' : 'Envoyer mon message'}
      </Button>
    </section>
  );
}

function EventCard({
  event,
  onRespond,
}: {
  event: ClientEvent;
  onRespond: (eventId: string, texte: string) => Promise<void>;
}): React.JSX.Element | null {
  const date = formatDate(event.created_at);
  const c = event.content;

  if (event.type === 'document') {
    const att = (c.attachment ?? {}) as Partial<EventAttachment>;
    const libelle = (c.libelle as string) || att.fileName || 'Document';
    return (
      <Card date={date} tag="Document">
        <p className="text-sm font-medium text-foreground">{libelle}</p>
        {att.dataUrl && (
          // Ouverture via URL d'objet (Blob) : les navigateurs BLOQUENT la
          // navigation directe vers une URL `data:` (page noire). Même mécanique
          // que côté conducteur (lib/document → openAttachment).
          <button
            type="button"
            onClick={() => openAttachment(att as EventAttachment)}
            className="mt-1 inline-block text-sm text-gold-700 underline-offset-2 hover:underline"
          >
            Ouvrir le document
          </button>
        )}
      </Card>
    );
  }

  if (event.type === 'demande') {
    const question = (c.question as string) ?? '';
    const resolution = c.resolution as
      { texte?: string; photos?: { imageUrl?: string }[] } | undefined;
    const destinataire = c.destinataire as string;
    const reponsePhotos = resolutionImages(resolution);

    // Message DU client au conducteur (`destinataire='phenix'`) : on le lui rappelle
    // et on affiche la réponse du conducteur (texte + photos) quand elle arrive.
    if (destinataire === 'phenix') {
      const hasReponse = Boolean(resolution?.texte) || reponsePhotos.length > 0;
      return (
        <Card date={date} tag="Votre message">
          <p className="text-sm text-foreground">{question}</p>
          {hasReponse ? (
            <div className="mt-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-success">
                Réponse de votre conducteur
              </p>
              {resolution?.texte && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {resolution.texte}
                </p>
              )}
              <PhotoGrid srcs={reponsePhotos} alt="Photo de votre conducteur" />
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              En attente de la réponse de votre conducteur.
            </p>
          )}
        </Card>
      );
    }

    // Demande adressée au client et encore ouverte ⇒ il peut RÉPONDRE.
    const canReply =
      destinataire === 'client' &&
      event.state === 'ouverte' &&
      !resolution?.texte &&
      reponsePhotos.length === 0;
    return (
      <Card date={date} tag="Demande">
        <p className="text-sm text-foreground">{question}</p>
        {resolution?.texte || reponsePhotos.length > 0 ? (
          <div className="mt-2 rounded-lg bg-background px-3 py-2">
            {resolution?.texte && (
              <p className="text-sm text-muted-foreground">Votre réponse : {resolution.texte}</p>
            )}
            <PhotoGrid srcs={reponsePhotos} alt="Photo jointe" />
          </div>
        ) : canReply ? (
          <DemandeResponder eventId={event.id} onRespond={onRespond} />
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">En attente de votre réponse.</p>
        )}
      </Card>
    );
  }

  // Les choix (`decision`) sont regroupés par sélection et rendus par ChoixCard.
  if (event.type === 'decision') return null;

  // compte_rendu / photo : texte + photos éventuelles.
  const texte = (c.texte as string) ?? '';
  const photos = extractPhotos(c);
  if (!texte && photos.length === 0) return null;
  return (
    <Card date={date} tag="Avancement">
      {texte && <p className="whitespace-pre-wrap text-sm text-foreground">{texte}</p>}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Photo du chantier"
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Formulaire de réponse du client à une demande (écriture via RPC code-gardée). */
function DemandeResponder({
  eventId,
  onRespond,
}: {
  eventId: string;
  onRespond: (eventId: string, texte: string) => Promise<void>;
}): React.JSX.Element {
  const [texte, setTexte] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    if (busy || texte.trim().length === 0) return;
    setBusy(true);
    setError('');
    try {
      await onRespond(eventId, texte.trim());
      // Succès : l'espace est rafraîchi par le parent (la carte passera en « répondu »).
    } catch {
      setError('Votre réponse n’a pas pu être envoyée. Réessayez.');
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setError('');
        }}
        placeholder="Votre réponse…"
        rows={3}
        aria-label="Votre réponse"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button size="sm" onClick={() => void submit()} disabled={busy || texte.trim().length === 0}>
        {busy ? 'Envoi…' : 'Envoyer ma réponse'}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Les choix (décisions) — regroupés par sélection
 * -------------------------------------------------------------------------- */

interface ChoixOption {
  id: string;
  ref?: string;
  title: string;
  description?: string;
  imageUrl?: string;
}
interface ClientChoix {
  selectionId: string;
  /** Événement d'envoi (porte la présentation) — cible de la validation. */
  carrierEventId: string;
  categorie: string;
  titre: string;
  contexte?: string;
  options: ChoixOption[];
  photos: string[];
  createdAt: string;
  /** Résolu (validé ou confié à PHÉNIX) ? */
  resolved: boolean;
  delegated: boolean;
  chosenOptionId?: string;
  chosenLabel?: string;
  comment?: string;
}

/**
 * Reconstruit les choix depuis les événements `decision` du journal : l'ENVOI
 * (`envoyee`/`renvoyee`) porte la présentation (options, photos, contexte) ; la
 * RÉSOLUTION (`validee`/`deleguee`) porte l'option retenue. On regroupe par
 * `selectionId` (le plus récent fait foi de chaque côté). Sans envoi, un choix
 * n'est pas présentable : on l'ignore. Récents d'abord.
 */
function deriveChoix(events: ClientEvent[]): ClientChoix[] {
  const carriers = new Map<string, ClientEvent>();
  const resolutions = new Map<string, ClientEvent>();
  for (const e of events) {
    if (e.type !== 'decision') continue;
    const selId = e.content.selectionId as string | undefined;
    if (!selId) continue;
    const kind = e.content.kind as string;
    const bucket =
      kind === 'envoyee' || kind === 'renvoyee'
        ? carriers
        : kind === 'validee' || kind === 'deleguee'
          ? resolutions
          : null;
    if (!bucket) continue;
    const prev = bucket.get(selId);
    if (!prev || e.created_at > prev.created_at) bucket.set(selId, e);
  }

  const out: ClientChoix[] = [];
  for (const [selId, carrier] of carriers) {
    const cc = (carrier.content.choix ?? {}) as {
      titre?: string;
      contexte?: string;
      options?: ChoixOption[];
      photos?: string[];
    };
    const resolution = resolutions.get(selId);
    const rContent = resolution?.content ?? {};
    out.push({
      selectionId: selId,
      carrierEventId: carrier.id,
      categorie: (carrier.content.categorie as string) ?? '',
      titre: cc.titre || (carrier.content.categorie as string) || 'Un choix vous concerne',
      contexte: cc.contexte,
      options: Array.isArray(cc.options) ? cc.options : [],
      photos: Array.isArray(cc.photos) ? cc.photos : [],
      createdAt: carrier.created_at,
      resolved: Boolean(resolution),
      delegated: rContent.kind === 'deleguee',
      chosenOptionId: rContent.optionId as string | undefined,
      chosenLabel: rContent.optionLabel as string | undefined,
      comment: rContent.message as string | undefined,
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Repère A, B, C… d'une option (utilise `ref` si fourni, sinon l'index). */
function optionLetter(opt: ChoixOption, index: number): string {
  return opt.ref || String.fromCharCode(65 + index);
}

/** Une carte de choix : à valider (options + délégation) ou déjà résolue. */
function ChoixCard({
  choix,
  onValidate,
}: {
  choix: ClientChoix;
  onValidate: (carrierEventId: string, optionId: string, comment: string) => Promise<void>;
}): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const date = formatDate(choix.createdAt);

  const submit = async (optionId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onValidate(choix.carrierEventId, optionId, comment.trim());
      // Succès : l'espace est rafraîchi par le parent (la carte passe en « validé »).
    } catch {
      setError('Votre choix n’a pas pu être envoyé. Réessayez.');
      setBusy(false);
    }
  };

  // Choix déjà résolu : rappel en lecture seule (fait foi).
  if (choix.resolved) {
    return (
      <Card date={date} tag="Choix">
        <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
          {choix.categorie}
        </p>
        <p className="text-sm font-medium text-foreground">{choix.titre}</p>
        <div className="mt-2 rounded-lg border border-success/40 bg-success/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">Votre choix</p>
          <p className="text-sm font-semibold text-foreground">
            {choix.delegated ? 'Vous nous avez confié ce choix' : (choix.chosenLabel ?? 'Validé')}
          </p>
          {choix.comment && (
            <p className="mt-1 text-sm italic text-muted-foreground">« {choix.comment} »</p>
          )}
        </div>
      </Card>
    );
  }

  // Choix à valider : options présentées, sélection puis validation.
  return (
    <Card date={date} tag="Choix">
      <p className="text-xs font-medium uppercase tracking-wide text-gold-700">{choix.categorie}</p>
      <p className="text-sm font-medium text-foreground">{choix.titre}</p>
      {choix.contexte && <p className="mt-1 text-sm text-muted-foreground">{choix.contexte}</p>}
      {choix.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {choix.photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Illustration du choix"
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {choix.options.length > 0 && (
        <ul className="mt-3 space-y-2">
          {choix.options.map((opt, i) => {
            const isSel = selected === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => setSelected(isSel ? null : opt.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                    isSel
                      ? 'border-gold-500 bg-gold-50 ring-1 ring-gold-500'
                      : 'border-border bg-surface hover:border-gold-300'
                  }`}
                >
                  {opt.imageUrl ? (
                    <img
                      src={opt.imageUrl}
                      alt={opt.title}
                      className="size-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-background text-lg font-semibold text-gold-700">
                      {optionLetter(opt, i)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      Option {optionLetter(opt, i)} — {opt.title}
                    </span>
                    {opt.description && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Textarea
        className="mt-3"
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setError('');
        }}
        placeholder="Un commentaire pour votre conducteur ? (facultatif)"
        rows={2}
        aria-label="Commentaire (facultatif)"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => selected && void submit(selected)}
          disabled={busy || !selected}
        >
          {busy ? 'Envoi…' : 'Valider mon choix'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void submit(PHENIX_DELEGATE_ID)}
          disabled={busy}
        >
          Je vous laisse choisir
        </Button>
      </div>
    </Card>
  );
}

function Card({
  date,
  tag,
  children,
}: {
  date: string;
  tag: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tag}
        </span>
        <time className="text-xs text-muted-foreground">{date}</time>
      </div>
      {children}
    </article>
  );
}

/** Récupère les URLs d'images affichables (data URL base64) d'un contenu. */
function extractPhotos(content: Record<string, unknown>): string[] {
  const raw = content.photos;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === 'object' ? (p as { imageUrl?: string }).imageUrl : undefined))
    .filter((u): u is string => typeof u === 'string' && u.startsWith('data:'));
}

/** Photos jointes à une RÉPONSE (résolution d'une demande) — mêmes conventions. */
function resolutionImages(resolution: { photos?: { imageUrl?: string }[] } | undefined): string[] {
  const raw = resolution?.photos;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === 'object' ? p.imageUrl : undefined))
    .filter(
      (u): u is string => typeof u === 'string' && (u.startsWith('data:') || u.startsWith('http')),
    );
}

/** Grille de photos affichables (rien si la liste est vide). */
function PhotoGrid({ srcs, alt }: { srcs: string[]; alt: string }): React.JSX.Element | null {
  if (srcs.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {srcs.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={alt}
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
