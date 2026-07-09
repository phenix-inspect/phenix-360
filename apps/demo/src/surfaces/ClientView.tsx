import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@phenix360/ui';
import { Check, FileText, Lock, MessageCircle } from 'lucide-react';
import {
  buildClientDecisions,
  buildClientShareReadiness,
  buildDecisionContent,
  clientFeed,
  decisionVisibility,
  isPhenixDelegate,
  pendingClientDecisions,
  userId,
  type ClientDecision,
  type EventActor,
  type Project,
} from '@phenix360/core';
import {
  clientNotifications,
  demo,
  dossierOf,
  mostRecentPendingTeamMoment,
  nameOf,
  pendingTeamMessageCount,
  type DemoSnapshot,
} from '../store';
import { NotificationsFeed } from '../components/NotificationsFeed';
import { ClientDecisionBanner } from '../components/ClientDecisionBanner';
import { ClientDocuments } from '../components/ClientDocuments';
import { ClientDemandesTab } from '../components/ClientDemandesTab';
import { ClientChoixTab } from '../components/ClientChoixTab';
import { ClientMonEspaceTab, CookieConsentBanner } from '../components/ClientMonEspaceTab';
import { FilView } from '../components/fil/FilView';
import { DecisionResponder } from '../components/DecisionResponder';
import { PhenixWidget } from '../components/PhenixWidget';

type ClientTab = 'aujourdhui' | 'demandes' | 'choix' | 'documents' | 'coulisses' | 'monespace';

function clientActor(snap: DemoSnapshot, project: Project): EventActor {
  const member = snap.members.find((m) => m.projectId === project.id && m.role === 'client');
  const id = member?.userId ?? project.clientId ?? userId('client-demo');
  return { userId: id, role: 'client', displayName: nameOf(snap, id) };
}

export function ClientView({
  snap,
  project,
}: {
  snap: DemoSnapshot;
  project: Project;
}): React.JSX.Element {
  const actor = clientActor(snap, project);
  const events = snap.events.filter((e) => e.projectId === project.id);
  const dossier = dossierOf(snap, project.id);

  // « Vos choix » : toutes les décisions demandées au client (dossier), avec leur
  // statut. Celles actionnables (une proposition à valider) sont aussi des ACTIONS
  // du jour → surfacées dans « Aujourd'hui ».
  const clientChoix = dossier ? buildClientDecisions(dossier) : [];
  const actionableChoix = clientChoix.filter((d) => d.clientActionable);

  // Documents & comptes rendus publiés (onglet Documents).
  const updates = clientFeed(events).filter(
    (e) => e.type === 'compte_rendu' || e.type === 'document',
  );
  const clientDocuments = updates.filter((e) => e.type === 'document');
  const comptesRendus = updates.filter((e) => e.type === 'compte_rendu');

  const teamMessages = pendingTeamMessageCount(snap, project.id);
  const [filView, setFilView] = useState<'fil' | 'bibliotheque'>('fil');
  const [clientTab, setClientTab] = useState<ClientTab>('aujourdhui');

  const validateDecision = async (d: ClientDecision, optionId?: string) => {
    if (!dossier) return;
    const sel = dossier.selections.find((s) => s.id === d.id);
    if (!sel) return;
    const delegated = isPhenixDelegate(optionId);
    const chosen = d.options.find((o) => o.id === optionId);
    const detail = delegated ? 'Choix confié à PHÉNIX' : chosen?.title;
    demo.saveDossier(project.id, {
      ...dossier,
      selections: dossier.selections.map((s) =>
        s.id === d.id
          ? {
              ...s,
              statut: 'valide',
              chosenOptionId: optionId,
              detail: detail ?? s.detail,
              delegatedToPhenix: delegated,
              modificationRequested: false,
            }
          : s,
      ),
    });
    const content = buildDecisionContent({
      kind: delegated ? 'deleguee' : 'validee',
      origin: 'client',
      selection: sel,
      statutApres: 'valide',
      optionId,
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility(content.kind),
      state: 'publie',
      content,
    });
  };

  // Décisions demandées via le Journal (échange documentaire ou question) — des
  // ACTIONS du jour, distinctes des choix préparés du dossier.
  const decisions = pendingClientDecisions(events);
  const docRequests = decisions.filter((d) => d.attendu === 'document');
  const decisionRequests = decisions.filter((d) => d.attendu !== 'document');

  // Boîte de réception : ce que l'équipe a publié (photos, comptes rendus, documents).
  const clientNotificationsList = clientNotifications(snap, project.id);
  const hasNotifs = clientNotificationsList.length > 0 || teamMessages > 0;
  const hasActions =
    actionableChoix.length > 0 || docRequests.length > 0 || decisionRequests.length > 0;

  // Ouvrir une notification : basculer sur le BON onglet, éteindre le signal, puis
  // défiler jusqu'à l'élément concerné (après le rendu de l'onglet).
  const openNotif = (n: (typeof clientNotificationsList)[number]): void => {
    demo.markSeen('client', n.seenKeys);
    if (n.clientTab) setClientTab(n.clientTab as ClientTab);
    if (n.clientView) setFilView(n.clientView);
    requestAnimationFrame(() =>
      document
        .getElementById(n.clientSection ?? '')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  // Navigation PHÉNIX (depuis Léon) : on ouvre le BON onglet + défilement/repère.
  const clientTarget = snap.clientTarget;
  useEffect(() => {
    if (!clientTarget) return;
    const tab: ClientTab =
      clientTarget.kind === 'document'
        ? 'documents'
        : clientTarget.kind === 'decision'
          ? 'choix'
          : 'coulisses'; // 'etapes' / 'fil' → le récit visuel du chantier
    setClientTab(tab);
    const id =
      clientTarget.kind === 'document'
        ? `ev-${clientTarget.ref}`
        : clientTarget.kind === 'decision'
          ? 'section-choix'
          : 'section-fil';
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate?.(
        [
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
          { boxShadow: '0 0 0 4px rgba(169,128,58,0.55)' },
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
        ],
        { duration: 1600, easing: 'ease-out' },
      );
    });
    demo.clearClientTarget();
  }, [clientTarget]);

  // GARDE-FOU PARTAGE : tant que les 3 bloquants ne sont pas validés (devis signé,
  // acompte payé, date officielle fixée à la main), le dossier n'est PAS
  // partageable. Le conducteur voit un écran INTERNE — aucun contenu client ne
  // s'affiche, aucune fuite possible.
  const share = buildClientShareReadiness(dossier);
  if (!share.shareable) return <EspaceClientNonPret missing={share.missing} />;

  return (
    <div className="space-y-6">
      <Tabs value={clientTab} onValueChange={(v) => setClientTab(v as ClientTab)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="aujourdhui">Aujourd’hui</TabsTrigger>
          <TabsTrigger value="demandes">Vos demandes</TabsTrigger>
          <TabsTrigger value="choix">Vos choix</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="coulisses">Dans les coulisses</TabsTrigger>
          <TabsTrigger value="monespace">Mon espace</TabsTrigger>
        </TabsList>

        {/* AUJOURD'HUI — un tableau d'ACTIONS : notifications d'abord, puis ce qui
            attend une action. Si rien n'attend le client, un seul message : il peut
            profiter de sa journée. */}
        <TabsContent value="aujourdhui">
          {hasNotifs || hasActions ? (
            <div className="space-y-6">
              {/* 1) Notifications importantes, AVANT les actions. */}
              {(teamMessages > 0 || clientNotificationsList.length > 0) && (
                <div className="space-y-3">
                  {teamMessages > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientTab('coulisses');
                        const target = mostRecentPendingTeamMoment(snap, project.id);
                        if (target) demo.focusMoment(target, actor.role);
                      }}
                      className="flex w-full items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-left text-sm font-medium text-gold-800 transition-colors duration-base hover:bg-gold-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600"
                    >
                      <MessageCircle aria-hidden />
                      Votre équipe vous a laissé {teamMessages} message{teamMessages > 1 ? 's' : ''}{' '}
                      — voir les coulisses
                    </button>
                  )}
                  <NotificationsFeed notifications={clientNotificationsList} onOpen={openNotif} />
                </div>
              )}

              {/* 2) Actions attendues du client. */}
              {actionableChoix.length > 0 && (
                <div id="section-decision" className="scroll-mt-24 space-y-3">
                  {actionableChoix.map((d) => (
                    <ClientDecisionBanner
                      key={d.id}
                      decision={d}
                      onValidate={(optionId) => validateDecision(d, optionId)}
                    />
                  ))}
                </div>
              )}

              {docRequests.length > 0 && (
                <section id="section-documents-demandes" className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Documents demandés ({docRequests.length})
                  </h3>
                  <ul className="space-y-2">
                    {docRequests.map((d) => (
                      <li
                        key={d.eventId}
                        className="rounded-xl border border-gold-200 bg-gold-50 p-4"
                      >
                        <p className="flex items-center gap-2 text-sm text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600">
                          <FileText aria-hidden />
                          {d.question}
                        </p>
                        <DecisionResponder decision={d} actor={actor} className="mt-2" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {decisionRequests.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Décisions en attente ({decisionRequests.length})
                  </h3>
                  <ul className="space-y-2">
                    {decisionRequests.map((d) => (
                      <li
                        key={d.eventId}
                        className="rounded-xl border border-border bg-surface p-4"
                      >
                        <p className="text-sm text-foreground">{d.question}</p>
                        <DecisionResponder decision={d} actor={actor} className="mt-2" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <ClientRienAFaire />
          )}
        </TabsContent>

        {/* VOS DEMANDES — l'historique des échanges avec PHÉNIX (via Léon). */}
        <TabsContent value="demandes">
          <ClientDemandesTab snap={snap} project={project} actor={actor} />
        </TabsContent>

        {/* VOS CHOIX — l'historique des décisions demandées au client. */}
        <TabsContent value="choix">
          <div id="section-choix" className="scroll-mt-24">
            <ClientChoixTab decisions={clientChoix} onValidate={validateDecision} />
          </div>
        </TabsContent>

        {/* DOCUMENTS — tout PDF (devis, factures, comptes rendus, PV…), ouvrable
            et téléchargeable. On ne cherche jamais ailleurs. */}
        <TabsContent value="documents">
          <section id="section-documents" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
              <FileText aria-hidden />
              <h2 className="font-serif text-lg font-semibold tracking-tight">Vos documents</h2>
            </div>
            <ClientDocuments events={[...clientDocuments, ...comptesRendus]} audience="client" />
          </section>
        </TabsContent>

        {/* DANS LES COULISSES — le récit visuel du projet : photos, ❤️, 💬. */}
        <TabsContent value="coulisses">
          <div id="section-fil" className="scroll-mt-24 rounded-2xl">
            <FilView
              snap={snap}
              project={project}
              actor={actor}
              canCompose={false}
              view={filView}
              onViewChange={setFilView}
            />
          </div>
        </TabsContent>

        {/* MON ESPACE — le client gère son accès, ses invités et ses préférences. */}
        <TabsContent value="monespace">
          <div id="section-monespace" className="scroll-mt-24">
            <ClientMonEspaceTab snap={snap} project={project} />
          </div>
        </TabsContent>
      </Tabs>

      <PhenixWidget snap={snap} project={project} actor={actor} />

      {/* Première connexion : bandeau cookies (consentement stocké localement). */}
      {!snap.cookieConsent && <CookieConsentBanner />}
    </div>
  );
}

/**
 * État vide de l'Espace client : rien à faire, aucune notification. Un seul
 * message rassurant — le client peut profiter de sa journée. Aucun autre contenu.
 */
function ClientRienAFaire(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-success-foreground [&_svg]:size-8">
        <Check aria-hidden />
      </span>
      <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-foreground">
        Vous n’avez rien à faire.
      </h2>
      <p className="mt-2 text-base text-muted-foreground">Tout est à jour.</p>
      <p className="mt-1 text-base text-muted-foreground">
        Votre équipe PHÉNIX veille sur votre chantier.
      </p>
    </div>
  );
}

/**
 * Écran INTERNE conducteur (jamais montré au client) : le dossier n'est pas encore
 * partageable. On liste précisément ce qui bloque, sans afficher AUCUN contenu
 * client → aucune fuite possible.
 */
function EspaceClientNonPret({ missing }: { missing: string[] }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="space-y-4 rounded-2xl border border-gold-300 bg-gold-50 p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-100 text-gold-700 [&_svg]:size-7">
          <Lock aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Espace client non prêt
          </h2>
          <p className="text-sm text-muted-foreground">
            Le dossier n’est pas encore partageable. Ces éléments sont obligatoires avant d’ouvrir
            l’espace au client.
          </p>
        </div>
        <ul className="mx-auto max-w-sm space-y-1.5 text-left">
          {missing.map((m) => (
            <li
              key={m}
              className="flex items-center gap-2 rounded-lg border border-gold-200 bg-surface px-3 py-2 text-sm text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-destructive"
            >
              <Lock aria-hidden />
              Il manque : <span className="font-medium">{m}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Complétez ces points dans l’onglet Préparation pour partager l’espace client.
        </p>
      </div>
    </div>
  );
}
