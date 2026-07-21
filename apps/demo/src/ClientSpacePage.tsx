/**
 * PHÉNIX 360 — Espace client par LIEN + CODE (M7.1, lecture seule)
 * ===========================================================================
 * Page AUTONOME, atteinte par un lien `…/#/c/<projectId>` : le client (SANS
 * compte) saisit le code communiqué par son artisan. Le code est vérifié CÔTÉ
 * SERVEUR (fonction Supabase `client_space`, SECURITY DEFINER) ; sans le bon
 * code, rien ne s'affiche. La page ne montre QUE ce qui est visible au client
 * (récit, photos, documents, décisions, demandes) — miroir de `isVisibleToClient`.
 *
 * Volontairement séparée de l'app conducteur (AUCUN accès au store local) : elle
 * ne peut donc rien casser côté conducteur. La possibilité de RÉPONDRE (valider
 * un choix, répondre à une demande) viendra dans une tranche ultérieure (M7.2).
 */
import { useEffect, useMemo, useState } from 'react';
import { BrandMark, Button, Input } from '@phenix360/ui';
import { PROJECT_STATUS_LABEL, type EventAttachment, type ProjectStatus } from '@phenix360/core';
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

  if (data) return <ClientSpace data={data} />;

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

function ClientSpace({ data }: { data: ClientSpaceData }): React.JSX.Element {
  const { project, events } = data;
  // Ordre anté-chronologique : le plus récent en haut (un fil d'actualité).
  const feed = useMemo(
    () => [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [events],
  );
  const statusLabel = PROJECT_STATUS_LABEL[project.status] ?? '';

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
        {feed.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            Votre chantier démarre. Les actualités de votre artisan apparaîtront ici.
          </p>
        ) : (
          feed.map((e) => <EventCard key={e.id} event={e} />)
        )}
        <p className="pt-4 text-center text-xs text-muted-foreground">
          Suivi de chantier PHÉNIX · lecture seule
        </p>
      </main>
    </div>
  );
}

function EventCard({ event }: { event: ClientEvent }): React.JSX.Element | null {
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
    const resolution = c.resolution as { texte?: string } | undefined;
    return (
      <Card date={date} tag="Demande">
        <p className="text-sm text-foreground">{question}</p>
        {resolution?.texte ? (
          <p className="mt-2 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">
            Votre réponse : {resolution.texte}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">En attente de votre réponse.</p>
        )}
      </Card>
    );
  }

  if (event.type === 'decision') {
    const titre = (c.titre as string) || (c.libelle as string) || 'Un choix vous concerne';
    return (
      <Card date={date} tag="Choix">
        <p className="text-sm font-medium text-foreground">{titre}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Détails et validation bientôt disponibles dans votre espace.
        </p>
      </Card>
    );
  }

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
