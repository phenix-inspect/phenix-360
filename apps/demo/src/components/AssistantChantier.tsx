import { useMemo, useState } from 'react';
import {
  CHECKLIST_STATUT_LABEL,
  COMMANDE_STATUT_LABEL,
  PHOTO_PHASE_LABEL,
  preparerAssistantChantier,
  type AssistantChantierPlan,
  type ProjectDossier,
} from '@phenix360/core';
import {
  Sparkles,
  Package,
  ClipboardList,
  MessageCircleQuestion,
  ListChecks,
  AlertTriangle,
  FileText,
  Camera,
  ChevronDown,
  Lock,
} from 'lucide-react';

/**
 * ASSISTANT CHANTIER — le copilote interne de la Préparation. Il exploite le
 * CONTRAT VALIDÉ pour PRÉPARER des brouillons (matériel, commandes, choix,
 * check-list, vigilances, documents, photos) — il ne DÉCIDE jamais et n'exécute
 * aucune action. Le conducteur vérifie, corrige, puis déclenche l'action via les
 * points d'entrée officiels (Commandes, « Demander au client »…). Lecture seule
 * ici : aucune interaction client (aucun doublon avec « Demandes client »).
 */
export function AssistantChantier({ dossier }: { dossier: ProjectDossier }): React.JSX.Element {
  const plan = useMemo<AssistantChantierPlan>(
    () => preparerAssistantChantier(dossier, dossier.avenants ?? []),
    [dossier],
  );

  if (!plan.contratValide) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
          <Sparkles aria-hidden />
          Assistant Chantier
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
          <Lock aria-hidden />
          Le contrat doit être analysé et validé pour préparer le chantier.
        </p>
      </section>
    );
  }

  const r = plan.resume;
  const stats: { icon: React.ReactNode; n: number; label: string }[] = [
    { icon: <Package aria-hidden />, n: r.materiels, label: 'matériels détectés' },
    { icon: <ClipboardList aria-hidden />, n: r.commandes, label: 'commandes probables' },
    { icon: <MessageCircleQuestion aria-hidden />, n: r.choix, label: 'choix à demander' },
    { icon: <AlertTriangle aria-hidden />, n: r.vigilances, label: 'points de vigilance' },
    { icon: <FileText aria-hidden />, n: r.documents, label: 'documents à récupérer' },
    { icon: <Camera aria-hidden />, n: r.photos, label: 'photos recommandées' },
    {
      icon: <ListChecks aria-hidden />,
      n: r.controlesPreReception,
      label: 'contrôles de pré-réception',
    },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-gold-200 bg-gold-50/40 p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground [&_svg]:size-5 [&_svg]:text-gold-600">
          <Sparkles aria-hidden />
          PHÉNIX 360 a préparé votre chantier
        </div>
        <p className="text-sm text-muted-foreground">
          À partir du contrat validé. Tout est en <b>brouillon</b> : vérifiez, corrigez, puis
          déclenchez l’action via les points d’entrée officiels. PHÉNIX prépare, vous décidez.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center"
          >
            <div className="flex items-center justify-center gap-1 text-xl font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-gold-600">
              {s.icon}
              {s.n}
            </div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Accordion
          icon={<Package aria-hidden />}
          title="Matériel à commander"
          count={plan.materiels.length}
        >
          <ul className="space-y-1.5">
            {plan.materiels.map((m, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{m.désignation}</span>
                {m.quantité != null && (
                  <span className="text-muted-foreground">
                    {' '}
                    — {m.quantité}
                    {m.unité ? ` ${m.unité}` : ''}
                  </span>
                )}
                {m.dimensions && <span className="text-muted-foreground"> · {m.dimensions}</span>}
                <Trace lot={m.lot} page={m.sources[0]?.sourcePage} />
                {m.mentions.map((mention) => (
                  <Tag key={mention}>{mention}</Tag>
                ))}
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<ClipboardList aria-hidden />}
          title="Préparation des commandes"
          count={plan.commandes.length}
        >
          <ul className="space-y-1.5">
            {plan.commandes.map((c, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{c.désignation}</span>
                <span className="ml-1.5 rounded-full bg-paper-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {COMMANDE_STATUT_LABEL[c.statut]}
                </span>
                <Trace lot={c.lot} page={c.sources[0]?.sourcePage} />
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<MessageCircleQuestion aria-hidden />}
          title="Choix à demander au client"
          count={plan.choix.length}
        >
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            Brouillons uniquement. Un choix se demande via « Nouvelle mission → Demander au client
            », après votre validation.
          </p>
          <ul className="space-y-1.5">
            {plan.choix.map((c, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{c.libellé}</span>
                <span className="text-muted-foreground"> — {c.raison}</span>
                <Trace lot={c.lot} />
                <Tag>À analyser</Tag>
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<ListChecks aria-hidden />}
          title="Check-list de préparation"
          count={plan.checklist.length}
        >
          <ul className="space-y-1.5">
            {plan.checklist.map((c, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{c.libellé}</span>
                <span className="ml-1.5 rounded-full bg-paper-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {CHECKLIST_STATUT_LABEL[c.statut]}
                </span>
                <Trace lot={c.origineLot} page={c.sourcePage} />
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<AlertTriangle aria-hidden />}
          title="Points de vigilance"
          count={plan.vigilances.length}
        >
          <ul className="space-y-1.5">
            {plan.vigilances.map((v, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-xs text-foreground">
                <span
                  aria-hidden
                  className={v.gravité === 'attention' ? 'text-warning' : 'text-muted-foreground'}
                >
                  {v.gravité === 'attention' ? '⚠️' : '•'}
                </span>
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<FileText aria-hidden />}
          title="Documents à récupérer"
          count={plan.documents.length}
        >
          <ul className="space-y-1.5">
            {plan.documents.map((d, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{d.libellé}</span>
                <Trace lot={d.origineLot} />
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion
          icon={<Camera aria-hidden />}
          title="Photos recommandées"
          count={plan.photos.length}
        >
          <ul className="space-y-1.5">
            {plan.photos.map((p, i) => (
              <li key={i} className="text-xs text-foreground">
                <span className="font-medium">{p.libellé}</span>
                <span className="ml-1.5 rounded-full bg-paper-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {PHOTO_PHASE_LABEL[p.phase]}
                </span>
                <Trace lot={p.origineLot} />
              </li>
            ))}
          </ul>
        </Accordion>
      </div>
    </section>
  );
}

/** Trace contractuelle discrète (lot + page source) sous une suggestion. */
function Trace({ lot, page }: { lot: string; page?: number }): React.JSX.Element {
  return (
    <span className="ml-1.5 text-[10px] text-muted-foreground">
      · {lot}
      {page != null ? ` · p. ${page}` : ''}
    </span>
  );
}

/** Petite étiquette « à vérifier / à confirmer ». */
function Tag({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
      {children}
    </span>
  );
}

function Accordion({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  // Section vide : on affiche une ligne claire « Aucun » plutôt qu'un bouton
  // grisé désactivé (qui donne l'impression d'un élément cassé).
  if (count === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
        <span className="ml-auto text-xs">Aucun pour le moment</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-gold-600"
      >
        {icon}
        {title}
        <span className="rounded-full bg-paper-50 px-1.5 text-xs text-muted-foreground">
          {count}
        </span>
        <ChevronDown
          aria-hidden
          className={`ml-auto !size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-border px-3.5 py-2.5">{children}</div>}
    </div>
  );
}
