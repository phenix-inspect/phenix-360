import { useEffect } from 'react';
import { Badge, Card, CardContent } from '@phenix360/ui';
import { CalendarRange, FileText, Palette } from 'lucide-react';
import {
  SELECTION_STATUS_LABEL,
  buildClientDecisions,
  buildDecisionContent,
  clientFeed,
  decisionVisibility,
  isPhenixDelegate,
  nextClientAction,
  pendingClientDecisions,
  userId,
  type ClientDecision,
  type EventActor,
  type Project,
} from '@phenix360/core';
import { demo, dossierOf, nameOf, type DemoSnapshot } from '../store';
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
  // Le client ne voit le planning qu'une fois la date de démarrage validée.
  const dossierDated = Boolean(dossier?.infos.startDate);
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

  const requestModification = async (d: ClientDecision, message: string) => {
    if (!dossier) return;
    const sel = dossier.selections.find((s) => s.id === d.id);
    if (!sel) return;
    demo.saveDossier(project.id, {
      ...dossier,
      selections: dossier.selections.map((s) =>
        s.id === d.id ? { ...s, statut: 'a_choisir', modificationRequested: true } : s,
      ),
    });
    const content = buildDecisionContent({
      kind: 'modification',
      origin: 'client',
      selection: sel,
      statutApres: 'a_choisir',
      message,
    });
    await demo.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility('modification'),
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

  return (
    <div className="space-y-6">
      <div id="section-decision" className="rounded-2xl">
        {clientDecision ? (
          <ClientDecisionBanner
            decision={clientDecision}
            onValidate={(optionId) => validateDecision(clientDecision, optionId)}
            onModify={(message) => requestModification(clientDecision, message)}
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

      <div id="section-fil" className="rounded-2xl">
        <FilView snap={snap} project={project} actor={actor} canCompose={false} />
      </div>

      {dossier && dossierDated && (
        <section id="section-etapes" className="space-y-3 rounded-2xl">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <CalendarRange aria-hidden />
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              Les grandes étapes du chantier
            </h2>
          </div>
          <GrandesEtapes dossier={dossier} />
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

      {updates.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
            <FileText aria-hidden />
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              Comptes rendus & documents
            </h2>
          </div>
          <div className="space-y-4">
            {updates.map((e) => (
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
