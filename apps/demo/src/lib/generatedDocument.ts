import {
  DIFFUSION_LABEL,
  PROJECT_STEP_LABEL,
  ROLE_LABEL,
  pointsPourAudience,
  type CrAudience,
  type DocumentEvent,
  type Event,
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
      <div class="point-album">${p.photos
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
  // Le libellé « Version client / artisan » ne concerne QUE les comptes rendus à
  // points (jamais un devis ou une facture).
  const isCrPoints =
    event.type === 'compte_rendu' && !!event.content.points && event.content.points.length > 0;
  const audienceLabel =
    isCrPoints && audience === 'client'
      ? 'Version client'
      : isCrPoints && audience === 'artisan'
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
      ? event.content.points && event.content.points.length > 0
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
