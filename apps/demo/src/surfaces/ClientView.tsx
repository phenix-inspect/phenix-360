import { useEffect, useState } from 'react';
import { Badge, Card, CardContent } from '@phenix360/ui';
import { CalendarRange, ClipboardList, FileText, Lock, MessageCircle, Palette } from 'lucide-react';
import {
  SELECTION_STATUS_LABEL,
  bibliothequeImages,
  buildClientDecisions,
  buildClientShareReadiness,
  buildDecisionContent,
  clientFeed,
  decisionVisibility,
  filDuChantier,
  isPhenixDelegate,
  nextClientAction,
  pendingClientDecisions,
  userId,
  type ClientDecision,
  type EventActor,
  type Project,
} from '@phenix360/core';
import {
  demo,
  dossierOf,
  filOf,
  mostRecentPendingTeamMoment,
  nameOf,
  pendingTeamMessageCount,
  type DemoSnapshot,
} from '../store';
import { SmartBanner } from '../components/SmartBanner';
import { ClientDecisionBanner } from '../components/ClientDecisionBanner';
import { ProjectHero } from '../components/ProjectHero';
import { StepProgress } from '../components/StepProgress';
import { GrandesEtapes } from '../components/GrandesEtapes';
import { MomentCard } from '../components/MomentCard';
import { FilView } from '../components/fil/FilView';
import { DecisionResponder } from '../components/DecisionResponder';
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
  // Notification client : l'équipe a laissé un mot sur le récit (symétrique du
  // signal conducteur). Un clic emmène le client vers le récit.
  const teamMessages = pendingTeamMessageCount(snap, project.id);
  // Le Récit et la Bibliothèque sont deux vues d'une même section : le sommaire
  // pilote la vue affichée (Récit ↔ Bibliothèque) en plus du défilement.
  const [filView, setFilView] = useState<'fil' | 'bibliotheque'>('fil');
  const filMoments = filOf(snap, project.id).moments;
  const hasRecit = filDuChantier(filMoments, { viewer: 'client' }).some((e) => e.kind === 'moment');
  const hasBiblio = bibliothequeImages(filMoments, { viewer: 'client' }).length > 0;

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
  const action = nextClientAction(project, events);
  // La décision prioritaire est déjà portée par le bandeau : on liste le reste.
  const otherDecisions =
    action.kind === 'decision_attendue'
      ? decisions.filter((d) => d.eventId !== action.decision.eventId)
      : decisions;

  // Sommaire horizontal : un raccourci vers chaque section de la page. Aucun
  // nouvel écran — juste un défilement fluide. Une puce n'apparaît que si sa
  // section a du contenu (VISION Art. 11 : jamais d'entrée creuse).
  const goTo = (id: string): void =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const hasDecisions = clientDecision !== null || decisions.length > 0;
  const sommaire: { label: string; onClick: () => void }[] = [
    ...(hasDecisions ? [{ label: 'Décisions', onClick: () => goTo('section-decision') }] : []),
    ...(dossier ? [{ label: 'Planning', onClick: () => goTo('section-etapes') }] : []),
    ...(clientDocuments.length > 0
      ? [{ label: 'Documents', onClick: () => goTo('section-documents') }]
      : []),
    ...(comptesRendus.length > 0
      ? [{ label: 'Comptes rendus', onClick: () => goTo('section-comptes') }]
      : []),
    ...(hasRecit
      ? [
          {
            label: 'Récit',
            onClick: () => {
              setFilView('fil');
              goTo('section-fil');
            },
          },
        ]
      : []),
    ...(hasBiblio
      ? [
          {
            label: 'Bibliothèque',
            onClick: () => {
              setFilView('bibliotheque');
              goTo('section-fil');
            },
          },
        ]
      : []),
  ];

  // Navigation PHÉNIX : on ouvre l'écran ciblé (défilement + repère visuel).
  const clientTarget = snap.clientTarget;
  useEffect(() => {
    if (!clientTarget) return;
    const id =
      clientTarget.kind === 'document'
        ? `ev-${clientTarget.ref}`
        : clientTarget.kind === 'decision'
          ? 'section-decision'
          : clientTarget.kind === 'etapes'
            ? 'section-etapes'
            : 'section-fil';
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate?.(
        [
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
          { boxShadow: '0 0 0 4px rgba(169,128,58,0.55)' },
          { boxShadow: '0 0 0 0 rgba(169,128,58,0)' },
        ],
        { duration: 1600, easing: 'ease-out' },
      );
    }
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
      {sommaire.length > 0 && (
        <nav
          aria-label="Sommaire de votre espace"
          className="flex flex-wrap gap-2 border-b border-border pb-4"
        >
          {sommaire.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className="inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 hover:text-gold-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

      {teamMessages > 0 && (
        <button
          type="button"
          onClick={() => {
            // Clic = navigation directe vers le Moment concerné + marquage lu.
            // On s'assure d'abord que le Récit est à l'écran, puis le Récit
            // ouvre précisément le Moment (défilement + curseur de réponse).
            document
              .getElementById('section-fil')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const target = mostRecentPendingTeamMoment(snap, project.id);
            if (target) demo.focusMoment(target, actor.role);
          }}
          className="flex w-full items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-left text-sm font-medium text-gold-800 transition-colors duration-base hover:bg-gold-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold-600"
        >
          <MessageCircle aria-hidden />
          Votre équipe vous a laissé {teamMessages} message{teamMessages > 1 ? 's' : ''} — voir le
          récit
        </button>
      )}

      <div id="section-decision" className="scroll-mt-24 rounded-2xl">
        {clientDecision ? (
          <ClientDecisionBanner
            decision={clientDecision}
            onValidate={(optionId) => validateDecision(clientDecision, optionId)}
          />
        ) : (
          <SmartBanner project={project} events={events} actor={actor} />
        )}
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <ProjectHero project={project} clientName={nameOf(snap, project.clientId)} />
          {!dossier && <StepProgress current={project.currentStep} />}
        </CardContent>
      </Card>

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
                  {s.detail && <p className="truncate text-xs text-muted-foreground">{s.detail}</p>}
                </div>
                <Badge
                  variant={
                    s.statut === 'valide' ? 'success' : s.statut === 'propose' ? 'info' : 'neutral'
                  }
                >
                  {SELECTION_STATUS_LABEL[s.statut]}
                </Badge>
              </div>
            ))}
          </div>
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

      {clientDocuments.length > 0 && (
        <section id="section-documents" className="scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <FileText aria-hidden />
            <h2 className="font-serif text-lg font-semibold tracking-tight">Documents</h2>
          </div>
          <div className="space-y-4">
            {clientDocuments.map((e) => (
              <div key={e.id} id={`ev-${e.id}`} className="rounded-2xl">
                <MomentCard event={e} authorName={nameOf(snap, e.actor.userId)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {comptesRendus.length > 0 && (
        <section id="section-comptes" className="scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <ClipboardList aria-hidden />
            <h2 className="font-serif text-lg font-semibold tracking-tight">Comptes rendus</h2>
          </div>
          <div className="space-y-4">
            {comptesRendus.map((e) => (
              <div key={e.id} id={`ev-${e.id}`} className="rounded-2xl">
                <MomentCard event={e} authorName={nameOf(snap, e.actor.userId)} />
              </div>
            ))}
          </div>
        </section>
      )}

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
