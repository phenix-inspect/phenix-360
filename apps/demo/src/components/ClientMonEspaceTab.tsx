import { useEffect, useId, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@phenix360/ui';
import type { Project } from '@phenix360/core';
import {
  Bell,
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Lock,
  MapPin,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { clientSettingsOf, demo, type ClientNotifPrefKey, type DemoSnapshot } from '../store';

/**
 * « Mon espace » — le client gère son ACCÈS, ses INVITÉS et ses PRÉFÉRENCES, sans
 * quitter l'UX premium de l'Espace client. Cinq encarts sobres, aucune page
 * technique : accès au chantier (code modifiable), personnes invitées (levier de
 * découverte PHÉNIX), préférences de notification, confidentialité/cookies,
 * sécurité. Tout est local à la démo (store) — remplaçable par un backend sans
 * toucher l'écran.
 */
export function ClientMonEspaceTab({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const settings = clientSettingsOf(snap, project.id);

  return (
    <div className="space-y-6">
      <AccesChantier snap={snap} project={project} />
      <PersonnesInvitees snap={snap} project={project} />
      <PreferencesNotification snap={snap} project={project} />
      <Confidentialite snap={snap} />
      <Securite />

      {/* Rappel discret : combien de personnes suivent le chantier. */}
      {settings.invitees.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {settings.invitees.length} personne{settings.invitees.length > 1 ? 's' : ''} invitée
          {settings.invitees.length > 1 ? 's' : ''} à suivre votre chantier.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Encart générique (titre + icône + contenu), pour une cohérence visuelle.
 * -------------------------------------------------------------------------- */
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-gold-600">
        {icon}
        <h2 className="font-serif text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ------------------------------ 1. Accès -------------------------------- */
function AccesChantier({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const settings = clientSettingsOf(snap, project.id);
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <Section icon={<Lock aria-hidden />} title="Accès au chantier">
      <dl className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <dt className="text-muted-foreground">Chantier</dt>
          <dd className="font-medium text-foreground">{project.name}</dd>
        </div>
        {project.address && (
          <div className="flex flex-wrap items-center justify-between gap-1">
            <dt className="text-muted-foreground">Adresse</dt>
            <dd className="flex items-center gap-1 font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
              <MapPin aria-hidden />
              {project.address}
            </dd>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <dt className="text-muted-foreground">Code d’accès</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono tracking-widest text-foreground" data-testid="code-affiche">
              {reveal ? settings.accessCode : '•'.repeat(Math.max(8, settings.accessCode.length))}
            </span>
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4"
              aria-label={reveal ? 'Masquer le code' : 'Afficher le code'}
            >
              {reveal ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          </dd>
        </div>
      </dl>

      {demo.isSaaS() && <LienDeSuivi projectId={project.id} code={settings.accessCode} />}

      {saved && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success [&_svg]:size-4"
        >
          <Check aria-hidden />
          Votre code d’accès a été mis à jour.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        Modifier mon code d’accès
      </Button>

      <ChangerCodeDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(code) => {
          demo.setClientAccessCode(project.id, code);
          setOpen(false);
          setReveal(false);
          setSaved(true);
        }}
      />
    </Section>
  );
}

/**
 * Lien de suivi à donner au client (mode SaaS). Le client ouvre ce lien et saisit
 * le code d'accès ci-dessus — aucun compte à créer. Bouton « Copier » pour le
 * partager par SMS / email.
 */
function LienDeSuivi({
  projectId,
  code,
}: {
  projectId: Project['id'];
  code: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}#/c/${projectId}`;
  // Garantit que le code courant est publié côté serveur (le lien fonctionne même
  // pour un chantier créé avant cette fonctionnalité). Best-effort, idempotent.
  useEffect(() => {
    demo.publishClientAccess(projectId);
  }, [projectId]);
  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le client peut sélectionner le texte à la main */
    }
  };
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-border bg-background/60 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
        <Link2 aria-hidden />
        Lien de suivi du client
      </p>
      <p className="text-xs text-muted-foreground">
        Envoyez ce lien à votre client (SMS, email) avec son code d’accès. Il suit son chantier sans
        créer de compte.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2 py-1.5 text-xs text-foreground">
          {link}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(link)}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Code à communiquer : <span className="font-mono font-medium text-foreground">{code}</span>
      </p>
    </div>
  );
}

function ChangerCodeDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (code: string) => void;
}): React.JSX.Element {
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const confirmId = useId();

  const reset = (): void => {
    setCode('');
    setConfirm('');
    setError(null);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError('Votre code doit contenir au moins 6 caractères.');
      return;
    }
    if (code !== confirm) {
      setError('Les deux codes ne correspondent pas.');
      return;
    }
    onSave(code.trim());
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier mon code d’accès</DialogTitle>
          <DialogDescription>
            Choisissez un nouveau code d’au moins 6 caractères. Il vous sera demandé pour accéder à
            votre espace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={codeId} className="text-sm font-medium text-foreground">
              Nouveau code d’accès
            </label>
            <Input
              id={codeId}
              type="password"
              autoComplete="new-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Au moins 6 caractères"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={confirmId} className="text-sm font-medium text-foreground">
              Confirmer le code
            </label>
            <Input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Retapez le code"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer le code</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- 2. Personnes invitées ------------------------- */
const ROLE_SUGGESTIONS = [
  'Conjoint',
  'Parent',
  'Investisseur',
  'Associé',
  'Locataire',
  'Architecte',
  'Décorateur',
];

function PersonnesInvitees({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const settings = clientSettingsOf(snap, project.id);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const listeId = useId();

  const canInvite = prenom.trim() !== '' && email.trim() !== '' && /.+@.+\..+/.test(email);

  const invite = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!canInvite) return;
    demo.inviteClientPerson(project.id, { prenom, nom, email, role: role || 'Invité' });
    setPrenom('');
    setNom('');
    setEmail('');
    setRole('');
  };

  return (
    <Section
      icon={<UserPlus aria-hidden />}
      title="Personnes invitées"
      description="Invitez une personne de confiance à suivre l’avancement de votre chantier."
    >
      <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
        <Input
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          placeholder="Prénom"
          aria-label="Prénom"
        />
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom"
          aria-label="Nom"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Rôle (ex. conjoint, investisseur…)"
          aria-label="Rôle"
          list={listeId}
        />
        <datalist id={listeId}>
          {ROLE_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!canInvite}>
            Inviter
          </Button>
        </div>
      </form>

      {settings.invitees.length > 0 && (
        <ul className="mt-5 space-y-2">
          {settings.invitees.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.prenom} {p.nom}{' '}
                  {p.role && <span className="font-normal text-muted-foreground">· {p.role}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.statut === 'actif' ? 'success' : 'gold'}>
                  {p.statut === 'actif' ? 'Actif' : 'Invité'}
                </Badge>
                <button
                  type="button"
                  onClick={() => demo.removeClientInvitee(project.id, p.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive [&_svg]:size-4"
                  aria-label={`Retirer l’accès de ${p.prenom} ${p.nom}`}
                >
                  <Trash2 aria-hidden />
                  Retirer l’accès
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* --------------------- 3. Préférences de notification -------------------- */
const NOTIF_LABELS: { key: ClientNotifPrefKey; label: string }[] = [
  { key: 'photos', label: 'Nouvelles photos' },
  { key: 'documents', label: 'Nouveaux documents' },
  { key: 'reponse', label: 'Réponse de PHÉNIX' },
  { key: 'decision', label: 'Décision attendue' },
  { key: 'rappelReception', label: 'Rappel avant réception' },
];

function PreferencesNotification({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const settings = clientSettingsOf(snap, project.id);
  return (
    <Section
      icon={<Bell aria-hidden />}
      title="Préférences de notification"
      description="Choisissez ce dont vous souhaitez être informé."
    >
      <ul className="divide-y divide-border">
        {NOTIF_LABELS.map(({ key, label }) => (
          <li
            key={key}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-foreground">{label}</span>
            <Toggle
              checked={settings.notifPrefs[key]}
              label={label}
              onChange={(v) => demo.setClientNotifPref(project.id, key, v)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform duration-base',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/* ---------------------- 4. Confidentialité / cookies --------------------- */
function Confidentialite({ snap }: { snap: DemoSnapshot }): React.JSX.Element {
  return (
    <Section icon={<ShieldCheck aria-hidden />} title="Cookies et confidentialité">
      <p className="flex items-center gap-2 text-sm text-foreground [&_svg]:size-4 [&_svg]:text-success">
        {snap.cookieConsent ? (
          <>
            <Check aria-hidden />
            Cookies nécessaires acceptés.
          </>
        ) : (
          <span className="text-muted-foreground">En attente de votre acceptation.</span>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        PHÉNIX 360 n’utilise que des cookies nécessaires au bon fonctionnement de votre espace
        client. Aucune donnée n’est revendue.
      </p>
    </Section>
  );
}

/* ------------------------------ 5. Sécurité ------------------------------ */
function Securite(): React.JSX.Element {
  return (
    <Section icon={<Lock aria-hidden />} title="Sécurité">
      <p className="text-sm text-muted-foreground">
        Votre espace est privé. Seules les personnes disposant d’un accès peuvent consulter les
        informations du chantier.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- *
 * Bandeau cookies — première connexion client. V1 : cookies nécessaires
 * uniquement, consentement stocké localement, ne réapparaît plus après acceptation.
 * -------------------------------------------------------------------------- */
export function CookieConsentBanner(): React.JSX.Element {
  const [details, setDetails] = useState(false);
  return (
    <div
      role="dialog"
      aria-label="Cookies et confidentialité"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-4 shadow-lg sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <p className="text-sm text-foreground">
        PHÉNIX 360 utilise des cookies nécessaires au bon fonctionnement de votre espace client.
      </p>
      {details && (
        <p className="mt-2 text-xs text-muted-foreground">
          Ces cookies conservent votre session et vos préférences d’affichage. Aucun cookie
          publicitaire, aucun traceur tiers, aucune revente de données.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => demo.acceptCookies()}>
          Accepter
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setDetails((v) => !v)}>
          En savoir plus
        </Button>
      </div>
    </div>
  );
}
