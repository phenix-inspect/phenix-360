import { useCallback, useEffect, useState } from 'react';
import {
  ActivityItem,
  Badge,
  BrandLockup,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
  Timeline,
} from '@phenix360/ui';
import { PROJECT_STEPS, PROJECT_STEP_LABEL, type ProjectStep } from '@phenix360/core';
import { allItems, clearAll, enqueue, type QueuedSaisie } from './offline/queue';
import { drainOutbox, type SendFn } from './offline/sync';

const fmt = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export function App(): React.JSX.Element {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [forcedOffline, setForcedOffline] = useState(false);
  const effectiveOnline = isOnline && !forcedOffline;

  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState<ProjectStep>('gros_oeuvre');
  const [items, setItems] = useState<QueuedSaisie[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => setItems(await allItems()), []);

  // « Serveur » simulé : échoue tant qu'on est (effectivement) hors-ligne.
  const makeSend = useCallback(
    (): SendFn => async () => {
      if (!navigator.onLine || forcedOffline) throw new Error('hors-ligne');
      await new Promise((resolve) => setTimeout(resolve, 400)); // latence simulée
    },
    [forcedOffline],
  );

  const sync = useCallback(async () => {
    const { sent, failed } = await drainOutbox(makeSend());
    await refresh();
    if (sent > 0) {
      setFlash(`${sent} saisie(s) synchronisée(s)${failed > 0 ? ` · ${failed} en attente` : ''}`);
    }
  }, [makeSend, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Rejeu directement au retour réseau (fiable), + maj de l'indicateur.
    const on = () => {
      setIsOnline(true);
      void sync();
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [sync]);

  // Rejeu aussi quand on lève le « hors-ligne simulé » (sans event réseau).
  useEffect(() => {
    if (effectiveOnline) void sync();
  }, [effectiveOnline, sync]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (texte.trim().length === 0) return;
    await enqueue({ texte: texte.trim(), etape });
    setTexte('');
    setFlash(effectiveOnline ? 'Saisie enregistrée' : 'Saisie enregistrée hors-ligne (en file)');
    await refresh();
    if (effectiveOnline) void sync();
  };

  const reset = async () => {
    await clearAll();
    setFlash(null);
    await refresh();
  };

  const pending = items.filter((i) => i.status === 'pending');
  const synced = items.filter((i) => i.status === 'synced');

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <BrandLockup subtitle />
        <div className="flex items-center gap-2">
          {effectiveOnline ? (
            <Badge variant="success">En ligne</Badge>
          ) : (
            <Badge variant="danger">Hors ligne</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForcedOffline((v) => !v)}
          >
            {forcedOffline ? 'Rétablir le réseau' : 'Couper le réseau'}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle saisie</CardTitle>
          <CardDescription>
            Un compte rendu + une étape. Fonctionne même sans réseau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSave}>
            <Textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. Dalle coulée, séchage en cours…"
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground" htmlFor="etape">
                Étape
              </label>
              <select
                id="etape"
                value={etape}
                onChange={(e) => setEtape(e.target.value as ProjectStep)}
                className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {PROJECT_STEPS.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STEP_LABEL[s]}
                  </option>
                ))}
              </select>
              <Button type="submit" className="ml-auto">
                Enregistrer la saisie
              </Button>
            </div>
          </form>
          {flash && <p className="mt-3 text-sm text-muted-foreground">{flash}</p>}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">
            File d'attente <span className="text-muted-foreground">({pending.length})</span>
          </h2>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void sync()}>
              Synchroniser
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void reset()}>
              Vider
            </Button>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien en attente.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{item.texte}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROJECT_STEP_LABEL[item.etape]} · {fmt(item.createdAt)}
                  </p>
                </div>
                <Badge variant="warning">En attente</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">
          Synchronisées <span className="text-muted-foreground">({synced.length})</span>
        </h2>
        {synced.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune saisie synchronisée pour l'instant.
          </p>
        ) : (
          <Timeline>
            {synced.map((item) => (
              <ActivityItem
                key={item.id}
                type="compte_rendu"
                title={PROJECT_STEP_LABEL[item.etape]}
                author="Compagnon (PoC)"
                authorRole="compagnon"
                date={fmt(item.syncedAt ?? item.createdAt)}
                description={item.texte}
              />
            ))}
          </Timeline>
        )}
      </section>
    </main>
  );
}
