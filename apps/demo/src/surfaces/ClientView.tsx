import { useEffect, useState } from 'react';
import { Badge, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@phenix360/ui';
import { CalendarRange, FileText, Lock, MessageCircle, Palette } from 'lucide-react';
import {
  SELECTION_STATUS_LABEL,
  momentsCoulisses,
  buildClientDecisions,
  buildClientShareReadiness,
  buildDecisionContent,
  clientFeed,
  decisionVisibility,
  demandesPourPhenix,
  isPhenixDelegate,
  nextClientAction,
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
  filOf,
  mostRecentPendingTeamMoment,
  nameOf,
  pendingTeamMessageCount,
  type DemoSnapshot,
} from '../store';
import { NotificationsFeed } from '../components/NotificationsFeed';
import { SmartBanner } from '../components/SmartBanner';
import { ClientDecisionBanner } from '../components/ClientDecisionBanner';
import { ProjectHero } from '../components/ProjectHero';
import { StepProgress } from '../components/StepProgress';
import { GrandesEtapes } from '../components/GrandesEtapes';
import { ClientDocuments } from '../components/ClientDocuments';
import { FilView } from '../components/fil/FilView';
import { DecisionResponder } from '../components/DecisionResponder';
import { DemandeThread } from '../components/DemandeThread';
import { PhenixWidget } from '../components/PhenixWidget';

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
  // Décision client la plus urgente que le client peut traiter (un choix
  // proposé à valider). Prioritaire sur le bandeau intelligent générique.
  const clientDecision = dossier
    ? (buildClientDecisions(dossier).find((d) => d.clientActionable) ?? null)
    : null;
  // Le Fil porte le récit visuel (photos, moments). Ici on ne conserve que les
  // éléments de suivi utiles au client et absents du Fil : comptes rendus et
  // documents publiés. Les décisions vivent dans le bandeau et « Vos choix ».
  const updates = clientFeed(events).filter(
    (e) => e.type === 'compte_rendu' || e.type === 'document',
  );
  // Sections distinctes et lisibles pour le client (VISION Art. 11) : les
  // documents d'un côté, les comptes rendus de l'autre.
  const clientDocuments = updates.filter((e) => e.type === 'document');
  const comptesRendus = updates.filter((e) => e.type === 'compte_rendu');
  // Les demandes faites par le client à PHÉNIX (question → réponse, sa mémoire).
  const clientDemandes = demandesPourPhenix(events).filter((e) => e.actor.role === 'client');
  // Notification client : l'équipe a laissé un mot sur le récit (symétrique du
  // signal conducteur). Un clic emmène le client vers le récit.
  const teamMessages = pendingTeamMessageCount(snap, project.id);
  // Le Récit et la Bibliothèque sont deux vues d'une même section : le sommaire
  // pilote la vue affichée (Récit ↔ Bibliothèque) en plus du défilement.
  const [filView, setFilView] = useState<'fil' | 'bibliotheque'>('fil');
  // Un onglet = un univers (même philosophie que le conducteur) : Aujourd'hui
  // (boîte de réception), Le projet (où en est le chantier), Dans les coulisses
  // (photos), Documents (tout PDF). Défaut : la boîte de réception.
  const [clientTab, setClientTab] = useState<'aujourdhui' | 'projet' | 'coulisses' | 'documents'>(
    'aujourdhui',
  );
  // « Dans les coulisses » côté client = albums photo partagés UNIQUEMENT (pas de
  // comptes rendus / PV / documents : ceux-ci ont leurs propres sections).
  const filMoments = momentsCoulisses(filOf(snap, project.id).moments);

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

  const decisions = pendingClientDecisions(events);
  // Une demande de DOCUMENT n'est pas une « décision » : c'est un échange
  // documentaire (le document est l'élément principal). On la sort du bandeau
  // « Une décision vous attend » et on la place dans sa propre liste, toujours
  // atteignable. Le bandeau ne raisonne donc que sur les vraies décisions.
  const docRequests = decisions.filter((d) => d.attendu === 'document');
  const decisionRequests = decisions.filter((d) => d.attendu !== 'document');
  const docRequestIds = new Set(docRequests.map((d) => d.eventId));
  const bannerEvents = events.filter((e) => !docRequestIds.has(e.id));
  const action = nextClientAction(project, bannerEvents);
  // La décision prioritaire est portée par le SmartBanner — mais seulement quand il
  // s'affiche (pas de décision d'ambiance qui occupe déjà le bandeau). Sinon on la
  // laisse dans la liste pour qu'aucune décision ne devienne inatteignable.
  const otherDecisions =
    !clientDecision && action.kind === 'decision_attendue'
      ? decisionRequests.filter((d) => d.eventId !== action.decision.eventId)
      : decisionRequests;

  // Boîte de réception : ce que l'équipe a publié (photos, comptes rendus, documents).
  const clientNotificationsList = clientNotifications(snap, project.id);
  // Ouvrir une notification : basculer sur le BON onglet, éteindre le signal, puis
  // défiler jusqu'à l'élément concerné (après le rendu de l'onglet).
  const openNotif = (n: (typeof clientNotificationsList)[number]): void => {
    demo.markSeen('client', n.seenKeys);
    if (n.clientTab) setClientTab(n.clientTab);
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
    const tab =
      clientTarget.kind === 'document'
        ? 'documents'
        : clientTarget.kind === 'decision'
          ? 'aujourdhui'
          : clientTarget.kind === 'etapes'
            ? 'projet'
            : 'coulisses';
    setClientTab(tab);
    const id =
      clientTarget.kind === 'document'
        ? `ev-${clientTarget.ref}`
        : clientTarget.kind === 'decision'
          ? 'section-decision'
          : clientTarget.kind === 'etapes'
            ? 'section-etapes'
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
  // s'affiche (récit, documents, décisions, planning), aucune fuite possible.
  const share = buildClientShareReadiness(dossier);
  if (!share.shareable) return <EspaceClientNonPret missing={share.missing} />;

  return (
    <div className="space-y-6">
      <Tabs
        value={clientTab}
        onValueChange={(v) =>
          setClientTab(v as 'aujourdhui' | 'projet' | 'coulisses' | 'documents')
        }
      >
        <TabsList>
          <TabsTrigger value="aujourdhui">Aujourd’hui</TabsTrigger>
          <TabsTrigger value="projet">Le projet</TabsTrigger>
          <TabsTrigger value="coulisses">Dans les coulisses</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* AUJOURD'HUI — la boîte de réception : tout ce qui attend une réaction. */}
        <TabsContent value="aujourdhui">
          <div className="space-y-6">
            {teamMessages > 0 && (
              <button
                type="button"
                onClick={() => {
                  // Ouvre les coulisses au Moment concerné (défilement + curseur).
                  setClientTab('coulisses');
                  const target = mostRecentPendingTeamMoment(snap, project.id);
                  if (target) demo.focusMoment(target, actor.role);
                }}
                className="flex w-full items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-left text-sm font-medium text-gold-800 transition-colors duration-base hover:bg-gold-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600"
              >
                <MessageCircle aria-hidden />
                Votre équipe vous a laissé {teamMessages} message{teamMessages > 1 ? 's' : ''} —
                voir les coulisses
              </button>
            )}

            {/* Notifications : ce que l'ÉQUIPE a publié. Un clic ouvre le bon onglet. */}
            <NotificationsFeed notifications={clientNotificationsList} onOpen={openNotif} />

            {/* Suivi de mes demandes. Le client ne crée aucun ticket : il parle
                simplement à Léon (widget flottant), qui répond ou transmet au
                conducteur. Les demandes transmises se retrouvent ici (mémoire). */}
            {clientDemandes.length > 0 && (
              <section id="section-demandes-client" className="scroll-mt-24 space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  Vos demandes ({clientDemandes.length})
                </h3>
                <ul className="space-y-2">
                  {clientDemandes.map((d) => (
                    <li key={d.id}>
                      <DemandeThread demande={d} actor={actor} nameOf={(u) => nameOf(snap, u)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div id="section-decision" className="scroll-mt-24 rounded-2xl">
              {clientDecision ? (
                <ClientDecisionBanner
                  decision={clientDecision}
                  onValidate={(optionId) => validateDecision(clientDecision, optionId)}
                />
              ) : (
                <SmartBanner project={project} events={bannerEvents} actor={actor} />
              )}
            </div>

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

            {otherDecisions.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  Autres décisions en attente ({otherDecisions.length})
                </h3>
                <ul className="space-y-2">
                  {otherDecisions.map((d) => (
                    <li key={d.eventId} className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-sm text-foreground">{d.question}</p>
                      <DecisionResponder decision={d} actor={actor} className="mt-2" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </TabsContent>

        {/* LE PROJET — où en est mon chantier : étapes, planning, choix. Rassure. */}
        <TabsContent value="projet">
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-5 p-6">
                {/* Statut seulement, JAMAIS le lot en cours (info interne conducteur). */}
                <ProjectHero
                  project={project}
                  clientName={nameOf(snap, project.clientId)}
                  showStep={false}
                />
                {!dossier && <StepProgress current={project.currentStep} />}
              </CardContent>
            </Card>

            {dossier && (
              <section id="section-etapes" className="scroll-mt-24 space-y-3 rounded-2xl">
                <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
                  <CalendarRange aria-hidden />
                  <h2 className="font-serif text-lg font-semibold tracking-tight">
                    Les grandes étapes du chantier
                  </h2>
                </div>
                <GrandesEtapes status={project.status} dossier={dossier} />
              </section>
            )}

            {dossier && dossier.selections.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
                  <Palette aria-hidden />
                  <h2 className="font-serif text-lg font-semibold tracking-tight">Vos choix</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dossier.selections.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
                          {s.categorie}
                        </p>
                        <p className="truncate text-sm text-foreground">{s.label}</p>
                        {s.detail && (
                          <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          s.statut === 'valide'
                            ? 'success'
                            : s.statut === 'propose'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {SELECTION_STATUS_LABEL[s.statut]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        {/* DANS LES COULISSES — l'Instagram du projet : photos, ❤️, 💬. */}
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
      </Tabs>

      <PhenixWidget snap={snap} project={project} actor={actor} />
    </div>
  );
}

/**
 * Écran INTERNE conducteur (jamais montré au client) : le dossier n'est pas encore
 * partageable. On liste précisément ce qui bloque, sans afficher AUCUN contenu
 * client (récit, documents, décisions, planning) → aucune fuite possible.
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
