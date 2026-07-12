import {
  DIFFUSION_LABEL,
  PRESTATION_STATUT_LABEL,
  PRESTATION_STATUT_LABEL_CLIENT,
  PROJECT_STEP_LABEL,
  RESERVE_RESPONSABLE_LABEL,
  ROLE_LABEL,
  pointPhotos,
  pointsPourAudience,
  prereceptionSynthese,
  type CrAudience,
  type DocumentEvent,
  type Event,
  type PrereceptionData,
  type PrestationVerif,
} from '@phenix360/core';
import { eventTitle } from './eventText';
import { fmtDate } from './format';

/** Contexte de rendu d'un document (résolu depuis le snapshot par le store). */
export interface DocumentContext {
  projectName: string;
  authorName: string;
}

/** Échappement HTML (le contenu métier est saisi par l'utilisateur). */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Titre du document généré (le titre projeté d'une mission prime : « PV de réception »…). */
export function generatedDocumentTitle(event: Event): string {
  if (event.type === 'compte_rendu' && event.content.docTitre) return event.content.docTitre;
  return eventTitle(event);
}

const line = (label: string, value: string | undefined): string =>
  value ? `<div class="meta"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : '';

const listBlock = (title: string, items: string[]): string =>
  items.length === 0
    ? ''
    : `<section><h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;

const paragraphs = (texte: string): string =>
  texte
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

/** Corps spécifique d'un compte rendu (texte + sections métier structurées). */
function compteRenduBody(event: Extract<Event, { type: 'compte_rendu' }>): string {
  const c = event.content;
  const decisions = (c.decisions ?? []).map((d) =>
    [d.libelle, d.quiDecide ? `décidé par ${d.quiDecide}` : null, d.impact]
      .filter(Boolean)
      .join(' — '),
  );
  const actions = (c.actions ?? []).map((a) =>
    [
      a.label,
      a.responsable ? `resp. ${a.responsable}` : null,
      a.echeance ? `échéance ${a.echeance}` : null,
    ]
      .filter(Boolean)
      .join(' — '),
  );
  const questions = (c.questionsClient ?? []).map((q) => q.libelle);
  return [
    c.texte ? `<section>${paragraphs(c.texte)}</section>` : '',
    listBlock('Décisions', decisions),
    listBlock('Actions à suivre', actions),
    listBlock('Questions du client', questions),
    listBlock('Manquants / réserves relevés', c.manquants ?? []),
  ].join('');
}

/**
 * Corps d'un compte rendu À POINTS (photo + commentaire + cible de diffusion),
 * FILTRÉ par destinataire : le PDF client ne montre que les points client + les
 * deux ; le PDF artisan que les points artisan + les deux ; le conducteur voit
 * tout (avec le badge de diffusion). Chaque point : sa photo, son commentaire.
 */
function compteRenduPointsBody(
  event: Extract<Event, { type: 'compte_rendu' }>,
  audience: CrAudience,
): string {
  const points = pointsPourAudience(event.content.points, audience);
  if (points.length === 0)
    return `<section><p class="muted">Aucun point pour ce destinataire.</p></section>`;
  return `<section class="points">${points
    .map(
      (p, i) => `<article class="point">
      <div class="point-album">${pointPhotos(p)
        .filter((ph) => ph.imageUrl)
        .map((ph) => `<img class="point-photo" src="${ph.imageUrl}" alt="Point ${i + 1}"/>`)
        .join('')}</div>
      <div class="point-body">
        <p class="point-comment">${esc(p.comment)}</p>
        ${
          audience === 'conducteur'
            ? `<span class="badge">${esc(DIFFUSION_LABEL[p.diffusion])}</span>`
            : ''
        }
      </div>
    </article>`,
    )
    .join('')}</section>`;
}

/* -------------------------- PRÉ-RÉCEPTION -------------------------------- */

const STATUT_DOT: Record<PrestationVerif['statut'], string> = {
  fait: '🟢',
  reserve: '🟠',
  non_fait: '🟡',
  moins_value: '⚫',
};

/**
 * Une prestation vérifiée, rendue selon le destinataire. Le CLIENT ne voit
 * JAMAIS le responsable, la date de reprise, ni les remarques internes (non fait
 * / motif de moins-value) : il voit le statut et, s'il y a une réserve, ses
 * photos et son commentaire. L'artisan (et le conducteur) voient tout.
 */
function prestationRow(p: PrestationVerif, audience: CrAudience): string {
  const isClient = audience === 'client';
  const statutLabel = (isClient ? PRESTATION_STATUT_LABEL_CLIENT : PRESTATION_STATUT_LABEL)[
    p.statut
  ];
  const details: string[] = [];
  if (p.statut === 'reserve' && p.reserve) {
    const r = p.reserve;
    if (r.commentaire.trim()) details.push(`<p class="pv-comment">${esc(r.commentaire)}</p>`);
    const photos = r.photos.filter((ph) => ph.imageUrl);
    if (photos.length > 0)
      details.push(
        `<div class="pv-album">${photos
          .map((ph) => `<img class="pv-photo" src="${ph.imageUrl}" alt="Réserve"/>`)
          .join('')}</div>`,
      );
    if (!isClient) {
      const meta = [
        `Responsable : ${RESERVE_RESPONSABLE_LABEL[r.responsable]}`,
        r.dateReprise ? `Reprise prévue : ${fmtDate(r.dateReprise)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      if (meta) details.push(`<p class="pv-meta">${esc(meta)}</p>`);
    }
  } else if (p.statut === 'non_fait' && !isClient && (p.commentaireNonFait ?? '').trim()) {
    details.push(`<p class="pv-comment">${esc(p.commentaireNonFait ?? '')}</p>`);
  } else if (p.statut === 'moins_value' && !isClient && (p.motifMoinsValue ?? '').trim()) {
    details.push(
      `<p class="pv-meta">${esc(`Motif : ${p.motifMoinsValue ?? ''} · À déduire de la facture finale`)}</p>`,
    );
  }
  return `<article class="pv-item">
    <div class="pv-head"><span class="pv-dot">${STATUT_DOT[p.statut]}</span><span class="pv-plabel">${esc(
      p.label,
    )}</span><span class="pv-statut">${esc(statutLabel)}</span></div>
    ${details.join('')}
  </article>`;
}

/** Corps d'une pré-réception : synthèse + prestations (groupées par lot) + mot. */
function prereceptionBody(data: PrereceptionData, audience: CrAudience): string {
  const s = prereceptionSynthese(data.prestations);
  const synth = `<section><h2>Synthèse</h2><div class="pv-synth">
    <div><b>${s.conformes}</b><span>Conformes</span></div>
    <div><b>${s.avecReserve}</b><span>Avec réserve</span></div>
    <div><b>${s.restantes}</b><span>Restant à réaliser</span></div>
    <div><b>${s.supprimees}</b><span>Supprimées</span></div>
  </div></section>`;

  // Regroupement par lot (corps d'état), dans l'ordre d'apparition.
  const order: string[] = [];
  const byLot = new Map<string, PrestationVerif[]>();
  for (const p of data.prestations) {
    if (!byLot.has(p.lotLabel)) {
      byLot.set(p.lotLabel, []);
      order.push(p.lotLabel);
    }
    byLot.get(p.lotLabel)?.push(p);
  }
  const prestations = order
    .map(
      (lot) =>
        `<section><h2>${esc(lot)}</h2>${(byLot.get(lot) ?? [])
          .map((p) => prestationRow(p, audience))
          .join('')}</section>`,
    )
    .join('');

  const mot = data.commentaireGeneral.trim()
    ? `<section><h2>Commentaire général</h2>${paragraphs(data.commentaireGeneral)}</section>`
    : '';

  return `${synth}${prestations}${mot}`;
}

/** Corps d'un document de référence sans fichier joint (fiche de couverture). */
function documentBody(event: DocumentEvent): string {
  const att = event.content.attachment;
  return `<section><p>Ce document a été enregistré dans PHÉNIX${
    att?.fileName ? ` sous le nom <b>${esc(att.fileName)}</b>` : ''
  }.</p><p class="muted">Document de référence généré par PHÉNIX — 100 % hors-ligne, aucune donnée transmise.</p></section>`;
}

/**
 * Rend un document GÉNÉRÉ par PHÉNIX en page HTML autonome (lisible, imprimable).
 * Appelé UNIQUEMENT quand il n'y a pas de fichier réel à ouvrir : le compte rendu,
 * le PV de réception, la liste de points à reprendre, ou la fiche de référence
 * d'un document sans pièce jointe. Aucune logique métier — pure présentation.
 */
export function buildDocumentHtml(
  event: Event,
  ctx: DocumentContext,
  audience: CrAudience = 'conducteur',
): string {
  const title = generatedDocumentTitle(event);
  // Le libellé « Version client / artisan » concerne les documents à double
  // destinataire : comptes rendus à points ET pré-réceptions (jamais un devis).
  const isCrPoints =
    event.type === 'compte_rendu' && !!event.content.points && event.content.points.length > 0;
  const isPrereception = event.type === 'compte_rendu' && !!event.content.prereception;
  const audienceLabel =
    (isCrPoints || isPrereception) && audience === 'client'
      ? 'Version client'
      : (isCrPoints || isPrereception) && audience === 'artisan'
        ? 'Version artisan'
        : '';
  const step =
    event.type === 'compte_rendu' && event.content.etapeConfirmee
      ? PROJECT_STEP_LABEL[event.content.etapeConfirmee]
      : undefined;
  const presents =
    event.type === 'compte_rendu' && event.content.presents && event.content.presents.length > 0
      ? event.content.presents.join(', ')
      : undefined;
  const categorie = event.type === 'document' ? event.content.categorie : undefined;
  const body =
    event.type === 'compte_rendu'
      ? event.content.prereception
        ? prereceptionBody(event.content.prereception, audience)
        : event.content.points && event.content.points.length > 0
          ? compteRenduPointsBody(event, audience)
          : compteRenduBody(event)
      : event.type === 'document'
        ? documentBody(event)
        : '';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — ${esc(ctx.projectName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f7f4ee; color: #2a2620; font-family: ui-serif, Georgia, 'Times New Roman', serif; line-height: 1.6; }
  .sheet { max-width: 760px; margin: 32px auto; background: #fffdf9; border: 1px solid #e7dfce; border-radius: 14px; padding: 40px 44px; box-shadow: 0 10px 40px rgba(60,48,20,0.08); }
  .brand { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #a9803a; font-weight: 700; }
  h1 { font-size: 28px; margin: 6px 0 18px; color: #221c12; }
  .metas { display: grid; gap: 4px; margin: 0 0 24px; padding: 16px 0; border-top: 1px solid #ece3d2; border-bottom: 1px solid #ece3d2; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; }
  .meta { display: flex; gap: 10px; }
  .meta span { min-width: 130px; color: #8a8069; }
  .meta b { color: #2a2620; font-weight: 600; }
  h2 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #a9803a; margin: 26px 0 8px; }
  p { margin: 0 0 12px; }
  .muted { color: #8a8069; font-size: 14px; }
  ul { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 0 0 6px; }
  .points { margin-top: 4px; }
  .point { padding: 18px 0; border-bottom: 1px solid #ece3d2; page-break-inside: avoid; }
  .point:last-child { border-bottom: none; }
  .point-album { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .point-photo { width: 200px; height: 150px; object-fit: cover; border-radius: 10px; border: 1px solid #e7dfce; }
  .point-body { min-width: 0; }
  .point-comment { font-size: 17px; margin: 0 0 8px; }
  .badge { display: inline-block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #a9803a; background: #f6edda; border-radius: 999px; padding: 3px 10px; }
  .pv-synth { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: ui-sans-serif, system-ui, sans-serif; margin: 4px 0 8px; }
  .pv-synth > div { border: 1px solid #ece3d2; border-radius: 12px; padding: 12px; text-align: center; background: #fffaf0; }
  .pv-synth b { display: block; font-size: 24px; color: #221c12; }
  .pv-synth span { font-size: 12px; color: #8a8069; }
  .pv-item { padding: 12px 0; border-bottom: 1px solid #f0e9da; page-break-inside: avoid; }
  .pv-item:last-child { border-bottom: none; }
  .pv-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .pv-dot { font-size: 13px; }
  .pv-plabel { font-weight: 600; color: #221c12; }
  .pv-statut { margin-left: auto; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; color: #8a8069; }
  .pv-comment { margin: 8px 0 6px; }
  .pv-meta { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; color: #8a8069; margin: 0 0 4px; }
  .pv-album { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
  .pv-photo { width: 150px; height: 112px; object-fit: cover; border-radius: 10px; border: 1px solid #e7dfce; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ece3d2; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; color: #8a8069; }
  @media print { body { background: #fff; } .sheet { border: none; box-shadow: none; margin: 0; } }
</style></head>
<body><article class="sheet">
  <div class="brand">PHÉNIX 360${audienceLabel ? ` · ${esc(audienceLabel)}` : ''}</div>
  <h1>${esc(title)}</h1>
  <div class="metas">
    ${line('Chantier', ctx.projectName)}
    ${line('Date', fmtDate(event.createdAt))}
    ${line('Rédigé par', `${ctx.authorName} · ${ROLE_LABEL[event.actor.role]}`)}
    ${line('Étape', step)}
    ${line('Présents', presents)}
    ${line('Catégorie', categorie)}
  </div>
  ${body}
  <footer>Document généré par PHÉNIX 360 — consultable à tout moment.</footer>
</article></body></html>`;
}
