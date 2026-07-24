/**
 * PHÉNIX 360 — MOTEUR PDF UNIQUE (documents générés)
 * ===========================================================================
 * Un SEUL moteur pour TOUS les documents générés par PHÉNIX (compte rendu,
 * pré-réception client/artisan, réception client, et tout futur document). Il
 * produit un VRAI PDF (octets `%PDF-`, MIME `application/pdf`) — jamais du HTML.
 *
 * Les documents IMPORTÉS (un vrai fichier déposé) ne passent JAMAIS par ici :
 * on ouvre / télécharge le fichier d'origine, sans aucune conversion.
 *
 * Rendu VECTORIEL (jsPDF) depuis le MODÈLE (l'événement) — même source de vérité
 * que l'aperçu HTML. Mise en page paginée A4 : en-tête (marque, chantier, adresse,
 * client, n° devis, avenants, références), corps selon le type, réserves en rouge,
 * signatures, filigrane BROUILLON tant que non validé, photos, pagination. Les
 * encarts (réserves, signatures) ne sont JAMAIS coupés entre deux pages.
 */
import { jsPDF } from 'jspdf';
import {
  DIFFUSION_LABEL,
  PRERECEPTION_SYNTHESE_LABEL,
  PRESTATION_STATUT_LABEL,
  PRESTATION_STATUT_LABEL_CLIENT,
  PROJECT_STEP_LABEL,
  RESERVE_RESPONSABLE_LABEL,
  ROLE_LABEL,
  RECEPTION_CONCLUSION_AUCUNE,
  RECEPTION_CONCLUSION_FINALE,
  RECEPTION_CONCLUSION_LEVEES,
  isDraft,
  pointPhotos,
  pointsPourAudience,
  prereceptionReference,
  prereceptionSynthese,
  receptionReference,
  receptionSynthese,
  type CrAudience,
  type Event,
  type PrereceptionData,
  type PrereceptionPhoto,
  type PrestationStatut,
  type PrestationVerif,
  type ReceptionData,
  type ReceptionReserve,
} from '@phenix360/core';
import { fmtDate } from './format';
import {
  generatedDocumentTitle,
  type ArtisanSignataire,
  type DocumentContext,
} from './generatedDocument';

/* ------------------------------- Palette ---------------------------------- */
type RGB = [number, number, number];
const GOLD: RGB = [169, 128, 58];
const INK: RGB = [34, 28, 18];
const MUTED: RGB = [138, 128, 105];
const LINE: RGB = [224, 214, 194];
const RED: RGB = [192, 57, 43];
const REDINK: RGB = [161, 43, 30];
const TILE: RGB = [255, 250, 240];
const REDTILE: RGB = [253, 242, 241];
const REDLINE: RGB = [217, 195, 192];
const WHITE: RGB = [255, 255, 255];

const STATUT_COLOR: Record<PrestationStatut, RGB> = {
  fait: [46, 160, 67],
  reserve: [192, 57, 43],
  non_fait: [201, 145, 32],
  moins_value: [80, 74, 66],
};

/* --------------------------- Moteur de mise en page ----------------------- */
/** Un document PDF paginé, avec curseur vertical, filigrane et pagination. */
class Pdf {
  private doc: jsPDF;
  private W: number;
  private H: number;
  private mx = 48; // marge horizontale
  private mt = 52; // marge haute
  private mb = 56; // marge basse
  private y: number;
  private draft: boolean;

  constructor(draft: boolean) {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.y = this.mt;
    this.draft = draft;
    this.watermark();
  }

  get contentW(): number {
    return this.W - this.mx * 2;
  }
  get left(): number {
    return this.mx;
  }
  /** Accès bas niveau (dessin avancé au sein du module). */
  get raw(): jsPDF {
    return this.doc;
  }
  get yPos(): number {
    return this.y;
  }
  set yPos(v: number) {
    this.y = v;
  }
  private get bottom(): number {
    return this.H - this.mb;
  }

  /** Filigrane BROUILLON (diagonal, discret) — dessiné derrière le contenu. */
  private watermark(): void {
    if (!this.draft) return;
    this.doc.saveGraphicsState();
    this.doc.setTextColor(238, 214, 210);
    this.doc.setFontSize(96);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('BROUILLON', this.W / 2, this.H / 2, {
      align: 'center',
      angle: 28,
      baseline: 'middle',
    });
    this.doc.restoreGraphicsState();
  }

  /** Ajoute une page (avec son filigrane) et remonte le curseur. */
  addPage(): void {
    this.doc.addPage();
    this.y = this.mt;
    this.watermark();
  }

  /** Garantit `h` points d'espace ; sinon saute à une nouvelle page. */
  ensure(h: number): void {
    if (this.y + h > this.bottom) this.addPage();
  }

  gap(h: number): void {
    this.y += h;
  }

  private lineH(size: number): number {
    return size * 1.36;
  }

  /** Découpe un texte à la largeur donnée (retour à la ligne). */
  private wrap(text: string, size: number, maxW: number, bold = false): string[] {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    return this.doc.splitTextToSize(text, maxW) as string[];
  }

  /** Hauteur qu'occuperait un texte (sans le dessiner) — pour le « keep-together ». */
  measure(text: string, size: number, maxW: number, bold = false): number {
    return this.wrap(text, size, maxW, bold).length * this.lineH(size);
  }

  /** Écrit un bloc de texte multi-lignes ; avance le curseur ; renvoie la hauteur. */
  text(
    text: string,
    opts: { size?: number; color?: RGB; bold?: boolean; x?: number; maxW?: number } = {},
  ): number {
    const size = opts.size ?? 10.5;
    const x = opts.x ?? this.left;
    const maxW = opts.maxW ?? this.contentW;
    const lines = this.wrap(text, size, maxW, opts.bold);
    const lh = this.lineH(size);
    this.doc.setTextColor(...(opts.color ?? INK));
    for (const ln of lines) {
      this.ensure(lh);
      this.doc.text(ln, x, this.y, { baseline: 'top' });
      this.y += lh;
    }
    return lines.length * lh;
  }

  /** Titre de section (petites capitales dorées). */
  sectionTitle(label: string): void {
    this.ensure(26);
    this.gap(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...GOLD);
    this.doc.text(label.toUpperCase(), this.left, this.y, { baseline: 'top', charSpace: 0.6 });
    this.y += 15;
  }

  hr(): void {
    this.doc.setDrawColor(...LINE);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.left, this.y, this.left + this.contentW, this.y);
    this.y += 1;
  }

  /** Une ligne d'en-tête « label : valeur » (valeur repliée si nécessaire). */
  metaRow(label: string, value: string): void {
    const labelW = 128;
    const valW = this.contentW - labelW;
    const lines = this.wrap(value, 10, valW);
    const h = Math.max(this.lineH(10), lines.length * this.lineH(10));
    this.ensure(h);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...MUTED);
    this.doc.text(label, this.left, this.y, { baseline: 'top' });
    this.doc.setTextColor(...INK);
    this.doc.setFont('helvetica', 'bold');
    let yy = this.y;
    for (const ln of lines) {
      this.doc.text(ln, this.left + labelW, yy, { baseline: 'top' });
      yy += this.lineH(10);
    }
    this.y += h;
  }

  /** Pastille de statut : un disque plein coloré (jamais un emoji). */
  statutDot(x: number, yTop: number, statut: PrestationStatut): void {
    this.doc.setFillColor(...STATUT_COLOR[statut]);
    this.doc.circle(x + 3, yTop + 4.5, 3, 'F');
  }

  /** Une image (data URL) ; en cas d'échec de décodage → cadre gris « Photo ». */
  image(dataUrl: string, x: number, yTop: number, w: number, h: number): void {
    const fmt = /^data:image\/(jpe?g)/i.test(dataUrl) ? 'JPEG' : 'PNG';
    try {
      this.doc.addImage(dataUrl, fmt, x, yTop, w, h, undefined, 'FAST');
    } catch {
      this.doc.setFillColor(244, 240, 232);
      this.doc.setDrawColor(...LINE);
      this.doc.roundedRect(x, yTop, w, h, 4, 4, 'FD');
      this.doc.setTextColor(...MUTED);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7);
      this.doc.text('Photo', x + w / 2, yTop + h / 2, { align: 'center', baseline: 'middle' });
    }
  }

  /** Bandeau de photos (miniatures) ; renvoie la hauteur consommée. */
  photoRow(photos: { imageUrl?: string }[], thumb = 68): number {
    const shown = photos.filter((p) => p.imageUrl).slice(0, 3);
    if (shown.length === 0) return 0;
    this.ensure(thumb + 6);
    let x = this.left;
    for (const p of shown) {
      this.image(p.imageUrl as string, x, this.y, thumb, thumb * 0.75);
      x += thumb + 8;
    }
    this.y += thumb * 0.75 + 8;
    return thumb * 0.75 + 8;
  }

  /** Quatre tuiles de synthèse (nombre + libellé). */
  tiles(items: { n: number; label: string; alerte?: boolean }[]): void {
    const gap = 10;
    const w = (this.contentW - gap * 3) / 4;
    const h = 56;
    this.ensure(h + 6);
    let x = this.left;
    for (const t of items) {
      this.doc.setFillColor(...(t.alerte ? REDTILE : TILE));
      this.doc.setDrawColor(...(t.alerte ? REDLINE : LINE));
      this.doc.roundedRect(x, this.y, w, h, 6, 6, 'FD');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(20);
      this.doc.setTextColor(...(t.alerte ? RED : INK));
      this.doc.text(String(t.n), x + w / 2, this.y + 20, { align: 'center', baseline: 'middle' });
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...MUTED);
      const ll = this.wrap(t.label, 7.5, w - 10);
      let ly = this.y + 34;
      for (const l of ll.slice(0, 2)) {
        this.doc.text(l, x + w / 2, ly, { align: 'center', baseline: 'middle' });
        ly += 9;
      }
      x += w + gap;
    }
    this.y += h + 4;
  }

  /** Rectangle de fond (encart) ; l'appelant a déjà réservé la hauteur. */
  panel(h: number, accent?: RGB): { x: number; y: number; w: number } {
    const x = this.left;
    const y = this.y;
    this.doc.setFillColor(...TILE);
    this.doc.setDrawColor(...LINE);
    this.doc.roundedRect(x, y, this.contentW, h, 6, 6, 'FD');
    if (accent) {
      this.doc.setFillColor(...accent);
      this.doc.rect(x, y + 3, 3, h - 6, 'F');
    }
    return { x, y, w: this.contentW };
  }

  /** Pied de page (référence + pagination) apposé sur TOUTES les pages. */
  finalize(reference?: string): Uint8Array {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      const fy = this.H - 30;
      this.doc.setDrawColor(...LINE);
      this.doc.setLineWidth(0.6);
      this.doc.line(this.mx, fy, this.W - this.mx, fy);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      const left = `Document généré par PHÉNIX 360${reference ? ` · ${reference}` : ''}`;
      this.doc.text(left, this.mx, fy + 12, { baseline: 'top' });
      this.doc.text(`Page ${i} / ${total}`, this.W - this.mx, fy + 12, {
        align: 'right',
        baseline: 'top',
      });
    }
    return new Uint8Array(this.doc.output('arraybuffer'));
  }

  /* -- Encarts de signature (PHÉNIX + second signataire) --------------------- */
  signatures(second: 'client' | 'artisan', artisan?: ArtisanSignataire): void {
    const phenix = { titre: 'PHÉNIX', champs: [row('Nom'), row('Qualité'), row('Date')] };
    const clientBox = {
      titre: 'Client ou son représentant',
      champs: [row('Nom'), row('Qualité / représentation'), row('Date')],
    };
    const artisanBox = {
      titre: 'Artisan ou son représentant',
      champs: [
        row('Entreprise', artisan?.entreprise),
        row('Lot', artisan?.lot),
        row('Nom du signataire', artisan?.nom),
        row('Qualité / représentation'),
        row('Date'),
      ],
    };
    const boxes = [phenix, second === 'client' ? clientBox : artisanBox];
    const rowsMax = Math.max(...boxes.map((b) => b.champs.length));
    const boxH = 24 + rowsMax * 20 + 46; // titre + champs + zone signature
    this.sectionTitle('Signatures');
    this.ensure(boxH + 4);
    const gap = 16;
    const w = (this.contentW - gap) / 2;
    const yTop = this.y;
    boxes.forEach((b, i) => {
      const x = this.left + i * (w + gap);
      this.doc.setDrawColor(...LINE);
      this.doc.setFillColor(...WHITE);
      this.doc.roundedRect(x, yTop, w, boxH, 6, 6, 'FD');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...GOLD);
      this.doc.text(b.titre.toUpperCase(), x + 12, yTop + 16, { baseline: 'top', charSpace: 0.4 });
      let ry = yTop + 34;
      for (const c of b.champs) {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...MUTED);
        this.doc.text(c.label, x + 12, ry, { baseline: 'top' });
        if (c.value) {
          this.doc.setFont('helvetica', 'bold');
          this.doc.setTextColor(...INK);
          this.doc.text(c.value, x + 108, ry, { baseline: 'top', maxWidth: w - 120 });
        } else {
          this.doc.setDrawColor(...LINE);
          this.doc.line(x + 108, ry + 9, x + w - 12, ry + 9);
        }
        ry += 20;
      }
      // Zone de signature (compatible signature manuscrite / électronique).
      this.doc.setDrawColor(...LINE);
      this.doc.setLineDashPattern([2, 2], 0);
      this.doc.roundedRect(x + 12, ry + 2, w - 24, 34, 4, 4, 'S');
      this.doc.setLineDashPattern([], 0);
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...MUTED);
      this.doc.text('Signature', x + 12, ry - 4, { baseline: 'top' });
    });
    this.y = yTop + boxH + 6;
  }
}

const row = (label: string, value?: string): { label: string; value?: string } => ({
  label,
  ...(value ? { value } : {}),
});

/* ------------------------------ En-tête ----------------------------------- */
function header(
  pdf: Pdf,
  event: Event,
  ctx: DocumentContext,
  audience: CrAudience,
  kind: DocKind,
  reception?: ReceptionData,
  reference?: string,
): void {
  const isDual = kind === 'prereception' || kind === 'cr-points';
  const audienceLabel =
    isDual && audience === 'client'
      ? 'Version client'
      : isDual && audience === 'artisan'
        ? 'Version artisan'
        : '';
  // Marque + libellé de version.
  pdf.text(`PHÉNIX 360${audienceLabel ? `  ·  ${audienceLabel}` : ''}`, {
    size: 8.5,
    color: GOLD,
    bold: true,
  });
  pdf.gap(2);
  pdf.text(generatedDocumentTitle(event), { size: 21, color: INK, bold: true });
  pdf.gap(8);
  pdf.hr();
  pdf.gap(8);

  const step =
    event.type === 'compte_rendu' && event.content.etapeConfirmee
      ? PROJECT_STEP_LABEL[event.content.etapeConfirmee]
      : undefined;
  const presents =
    event.type === 'compte_rendu' && event.content.presents && event.content.presents.length > 0
      ? event.content.presents.join(', ')
      : undefined;
  const categorie = event.type === 'document' ? event.content.categorie : undefined;
  const isPr = kind === 'prereception';
  const isRec = kind === 'reception';
  // Le DOCUMENT CLIENT ne porte AUCUN code système interne (PR-…/REC-…) : ce sont
  // des identifiants techniques de plomberie, sans valeur contractuelle pour le
  // client. On conserve, côté client, les seules références utiles : n° de devis,
  // avenants, adresse, dates. Les versions artisan / conducteur gardent tout.
  const isClient = audience === 'client';

  const rows: [string, string | undefined][] = [
    // Le CODE CHANTIER est la référence commune à tous (client compris) : en tête.
    ['Code chantier', ctx.projectCode],
    ['Chantier', ctx.projectName],
    ['Adresse', ctx.address],
    ['Client', ctx.clientName],
    ['Référence', isPr && !isClient ? reference : undefined],
    ['Date', fmtDate(event.createdAt)],
    ['Conducteur', isPr || isRec ? ctx.authorName : undefined],
    ['N° du devis', reception?.devisRef],
    [
      'Avenants intégrés',
      reception && reception.avenants.length > 0
        ? reception.avenants.map((n) => `n°${n}`).join(', ')
        : undefined,
    ],
    ['Réf. Pré-réception', isClient ? undefined : reception?.prereceptionRef],
    ['Réf. Réception', isRec && !isClient ? reference : undefined],
    [
      'Rédigé par',
      isPr || isRec ? undefined : `${ctx.authorName} · ${ROLE_LABEL[event.actor.role]}`,
    ],
    ['Étape', step],
    ['Présents', presents],
    ['Catégorie', categorie],
  ];
  for (const [label, value] of rows) if (value) pdf.metaRow(label, value);
  pdf.gap(6);
  pdf.hr();
}

/* ------------------------------ Corps : CR points ------------------------- */
function crPointsBody(pdf: Pdf, event: Event, audience: CrAudience): void {
  if (event.type !== 'compte_rendu') return;
  const points = pointsPourAudience(event.content.points, audience);
  pdf.sectionTitle('Compte rendu');
  if (points.length === 0) {
    pdf.text('Aucun point pour ce destinataire.', { size: 10, color: MUTED });
    return;
  }
  points.forEach((p, i) => {
    const photos = pointPhotos(p).filter((ph) => ph.imageUrl);
    const commentH = pdf.measure(p.comment, 11, pdf.contentW);
    pdf.ensure((photos.length ? 60 : 0) + commentH + 22);
    pdf.gap(6);
    if (photos.length) pdf.photoRow(photos, 76);
    pdf.text(p.comment || `Point ${i + 1}`, { size: 11, color: INK });
    if (audience === 'conducteur') {
      pdf.text(DIFFUSION_LABEL[p.diffusion], { size: 8, color: GOLD, bold: true });
    }
    pdf.gap(4);
    pdf.hr();
  });
}

/* ------------------------------ Corps : CR texte -------------------------- */
function crTextBody(pdf: Pdf, event: Event): void {
  if (event.type !== 'compte_rendu') return;
  const c = event.content;
  if (c.texte.trim()) {
    pdf.sectionTitle('Compte rendu');
    for (const para of c.texte.split(/\n{2,}/)) pdf.text(para, { size: 10.5 });
  }
  const list = (title: string, items: string[]): void => {
    if (items.length === 0) return;
    pdf.sectionTitle(title);
    for (const it of items) pdf.text(`•  ${it}`, { size: 10 });
  };
  list(
    'Décisions',
    (c.decisions ?? []).map((d) =>
      [d.libelle, d.quiDecide ? `décidé par ${d.quiDecide}` : null, d.impact]
        .filter(Boolean)
        .join(' — '),
    ),
  );
  list(
    'Actions à suivre',
    (c.actions ?? []).map((a) =>
      [a.label, a.responsable ? `resp. ${a.responsable}` : null, a.echeance]
        .filter(Boolean)
        .join(' — '),
    ),
  );
  list(
    'Questions du client',
    (c.questionsClient ?? []).map((q) => q.libelle),
  );
  list('Manquants / réserves relevés', c.manquants ?? []);
}

/* ------------------------------ Corps : pré-réception --------------------- */
function prestationRow(pdf: Pdf, p: PrestationVerif, audience: CrAudience): void {
  const isClient = audience === 'client';
  const statutLabel = (isClient ? PRESTATION_STATUT_LABEL_CLIENT : PRESTATION_STATUT_LABEL)[
    p.statut
  ];
  const estReserve = p.statut === 'reserve';
  pdf.ensure(30);
  pdf.gap(6);
  const yTop = pdf.yPos;
  pdf.statutDot(pdf.left, yTop, p.statut);
  // Libellé + statut sur la même ligne (statut à droite).
  pdf.text(p.label, { size: 10.5, bold: true, x: pdf.left + 12, maxW: pdf.contentW - 150 });
  const doc = pdf.raw;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...(estReserve ? RED : MUTED));
  doc.text(statutLabel, pdf.left + pdf.contentW, yTop, { align: 'right', baseline: 'top' });
  // Détails de réserve (commentaire rouge + photos + méta interne).
  if (estReserve && p.reserve) {
    if (p.reserve.commentaire.trim())
      pdf.text(p.reserve.commentaire, { size: 10, color: REDINK, x: pdf.left + 12 });
    const photos = p.reserve.photos.filter((ph) => ph.imageUrl);
    if (photos.length) pdf.photoRow(photos, 60);
    if (!isClient) {
      const meta = [
        `Responsable : ${RESERVE_RESPONSABLE_LABEL[p.reserve.responsable]}`,
        p.reserve.dateReprise ? `Reprise prévue : ${fmtDate(p.reserve.dateReprise)}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ');
      if (meta) pdf.text(meta, { size: 9, color: MUTED, x: pdf.left + 12 });
    }
  } else if (p.statut === 'non_fait' && !isClient && (p.commentaireNonFait ?? '').trim()) {
    pdf.text(p.commentaireNonFait as string, { size: 10, color: INK, x: pdf.left + 12 });
  } else if (p.statut === 'moins_value' && !isClient && (p.motifMoinsValue ?? '').trim()) {
    pdf.text(`Motif : ${p.motifMoinsValue} · À déduire de la facture finale`, {
      size: 9,
      color: MUTED,
      x: pdf.left + 12,
    });
  }
  pdf.gap(4);
  pdf.hr();
}

function prereceptionBody(
  pdf: Pdf,
  data: PrereceptionData,
  audience: CrAudience,
  artisan?: ArtisanSignataire,
): void {
  const s = prereceptionSynthese(data.prestations);
  pdf.sectionTitle('Synthèse de la pré-réception');
  pdf.tiles([
    { n: s.conformes, label: PRERECEPTION_SYNTHESE_LABEL.conformes },
    { n: s.avecReserve, label: PRERECEPTION_SYNTHESE_LABEL.avecReserve, alerte: s.avecReserve > 0 },
    { n: s.restantes, label: PRERECEPTION_SYNTHESE_LABEL.restantes },
    { n: s.supprimees, label: PRERECEPTION_SYNTHESE_LABEL.supprimees },
  ]);

  const order: string[] = [];
  const byLot = new Map<string, PrestationVerif[]>();
  for (const p of data.prestations) {
    if (!byLot.has(p.lotLabel)) {
      byLot.set(p.lotLabel, []);
      order.push(p.lotLabel);
    }
    byLot.get(p.lotLabel)?.push(p);
  }
  for (const lot of order) {
    pdf.sectionTitle(lot);
    for (const p of byLot.get(lot) ?? []) prestationRow(pdf, p, audience);
  }

  if (data.commentaireGeneral.trim()) {
    pdf.sectionTitle('Commentaire général de pré-réception');
    for (const para of data.commentaireGeneral.split(/\n{2,}/)) pdf.text(para, { size: 10.5 });
  }
  pdf.signatures(audience === 'client' ? 'client' : 'artisan', artisan);
}

/* ------------------------------ Corps : réception ------------------------- */
function receptionReserve(pdf: Pdf, r: ReceptionReserve): void {
  const innerW = pdf.contentW - 24;
  const hComment = pdf.measure(r.commentaireInitial || '—', 10, innerW);
  const hLevee = pdf.measure(r.levee?.commentaire || '—', 10, innerW);
  const hasPhotos =
    r.photosAvant.some((p) => p.imageUrl) || (r.levee?.photos ?? []).some((p) => p.imageUrl);
  const photoH = hasPhotos ? 66 : 0;
  const h = 20 + 16 + 30 + hComment + 30 + hLevee + photoH + 16;
  pdf.ensure(h + 8);
  pdf.gap(8);
  pdf.panel(h, GOLD);
  const doc = pdf.raw;
  let yy = pdf.yPos + 12;
  const x = pdf.left + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text(`RÉSERVE N°${r.numero}`, x, yy, { baseline: 'top', charSpace: 0.4 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(r.lotLabel, pdf.left + pdf.contentW - 14, yy, { align: 'right', baseline: 'top' });
  yy += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(r.prestationLabel, x, yy, { baseline: 'top', maxWidth: pdf.contentW - 28 });
  yy += 18;
  const block = (title: string, value: string): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(title.toUpperCase(), x, yy, { baseline: 'top', charSpace: 0.4 });
    yy += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(value || '—', pdf.contentW - 28) as string[];
    for (const ln of lines) {
      doc.text(ln, x, yy, { baseline: 'top' });
      yy += 13.6;
    }
    yy += 6;
  };
  block('Commentaire initial', r.commentaireInitial);
  block('Commentaire de levée', r.levee?.commentaire ?? '');
  if (hasPhotos) {
    const drawPhotos = (label: string, photos: PrereceptionPhoto[], px: number): void => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), px, yy, { baseline: 'top', charSpace: 0.4 });
      const shown = photos.filter((p) => p.imageUrl).slice(0, 2);
      let ix = px;
      for (const ph of shown) {
        pdf.image(ph.imageUrl as string, ix, yy + 11, 46, 40);
        ix += 52;
      }
    };
    drawPhotos('Photo avant', r.photosAvant, x);
    drawPhotos('Photo après', r.levee?.photos ?? [], x + (pdf.contentW - 28) / 2);
  }
  pdf.yPos += h + 6;
}

function receptionBody(pdf: Pdf, data: ReceptionData): void {
  const s = receptionSynthese(data);
  pdf.sectionTitle('Résumé — Pré-réception');
  pdf.tiles([
    { n: s.prestationsTotal, label: 'Prestations' },
    { n: s.reservesCreees, label: 'Réserves créées' },
    { n: s.reservesLevees, label: 'Réserves levées' },
    { n: s.reservesRestantes, label: 'Réserves restantes', alerte: s.reservesRestantes > 0 },
  ]);
  if (data.reserves.length > 0) {
    pdf.sectionTitle('Levée des réserves');
    for (const r of data.reserves) receptionReserve(pdf, r);
  }
  if ((data.commentaireGeneral ?? '').trim()) {
    pdf.sectionTitle('Commentaire général');
    for (const para of (data.commentaireGeneral ?? '').split(/\n{2,}/))
      pdf.text(para, { size: 10.5 });
  }
  pdf.sectionTitle('Conclusion');
  pdf.text(data.reserves.length > 0 ? RECEPTION_CONCLUSION_LEVEES : RECEPTION_CONCLUSION_AUCUNE, {
    size: 10.5,
  });
  pdf.text(RECEPTION_CONCLUSION_FINALE, { size: 12.5, bold: true, color: INK });
  pdf.signatures('client');
}

/* --------------------------- Sélection du corps --------------------------- */
type DocKind = 'reception' | 'prereception' | 'cr-points' | 'cr-text' | 'document';

function docKind(event: Event): DocKind {
  if (event.type === 'compte_rendu') {
    if (event.content.reception) return 'reception';
    if (event.content.prereception) return 'prereception';
    if (event.content.points && event.content.points.length > 0) return 'cr-points';
    return 'cr-text';
  }
  return 'document';
}

/**
 * Construit le PDF (octets réels) d'un document GÉNÉRÉ par PHÉNIX. Même signature
 * que `buildDocumentHtml` : (événement, contexte, destinataire). Ne JAMAIS appeler
 * sur un document importé (on ouvre alors le fichier d'origine).
 */
export function buildDocumentPdf(
  event: Event,
  ctx: DocumentContext,
  audience: CrAudience = 'conducteur',
): Uint8Array {
  const kind = docKind(event);
  const reception = event.type === 'compte_rendu' ? event.content.reception : undefined;
  const prereception = event.type === 'compte_rendu' ? event.content.prereception : undefined;
  const draft = (kind === 'prereception' || kind === 'reception') && isDraft(event);
  const reference =
    kind === 'prereception'
      ? prereceptionReference(event.createdAt, prereception?.version ?? 1)
      : kind === 'reception'
        ? receptionReference(event.createdAt, reception?.version ?? 1)
        : undefined;

  const pdf = new Pdf(draft);
  header(pdf, event, ctx, audience, kind, reception, reference);

  if (kind === 'reception' && reception) receptionBody(pdf, reception);
  else if (kind === 'prereception' && prereception)
    prereceptionBody(pdf, prereception, audience, ctx.artisan);
  else if (kind === 'cr-points') crPointsBody(pdf, event, audience);
  else if (kind === 'cr-text') crTextBody(pdf, event);

  // Le pied de page ne porte le code système (PR-…/REC-…) que pour les versions
  // internes (artisan / conducteur). Le document CLIENT n'en montre aucun.
  return pdf.finalize(audience === 'client' ? undefined : reference);
}

/* ========================================================================== *
 * DOSSIER DE CHANTIER — synthèse multi-sections (livrable / archive lisible)
 * ========================================================================== *
 * Un SEUL document qui raconte tout le chantier : couverture, synthèse chiffrée,
 * avancement, comptes rendus, choix du client, réserves, documents et album des
 * coulisses. Fonction PURE : elle reçoit des données déjà calculées et des
 * `imageUrl` déjà en data URL (les URL Storage sont résolues par l'appelant, jsPDF
 * ne sachant pas charger une image distante de façon synchrone). */

/** Une photo pour le dossier (imageUrl idéalement en data URL, sinon cadre gris). */
export interface DossierPhoto {
  imageUrl?: string;
}

export interface ChantierDossierInput {
  /** Logo PHÉNIX en data URL (résolu par l'appelant) — dessiné en tête de couverture. */
  logo?: string;
  project: {
    name: string;
    code?: string;
    address?: string;
    clientName?: string;
    statusLabel: string;
    stepLabel?: string;
    createdAt: string;
  };
  generatedAt: string;
  synthese: { comptesRendus: number; choix: number; documents: number; reservesOuvertes: number };
  comptesRendus: { date: string; titre?: string; texte: string; photos: DossierPhoto[] }[];
  choix: { categorie: string; label: string; statut: string; detail?: string }[];
  reserves: { numero: number; libelle: string; ouverte: boolean; date: string }[];
  documents: { libelle: string; famille?: string; date: string }[];
  album: { titre?: string; legende?: string; date: string; photos: DossierPhoto[] }[];
}

/** Construit le PDF (octets réels) du dossier de chantier. */
export function buildChantierDossierPdf(input: ChantierDossierInput): Uint8Array {
  const pdf = new Pdf(false);
  const p = input.project;

  // — Couverture (logo + marque PHÉNIX en tête) —
  if (input.logo) {
    pdf.image(input.logo, pdf.left, pdf.yPos, 46, 46);
    pdf.gap(52);
  }
  pdf.text('PHÉNIX 360', { size: 8.5, color: GOLD, bold: true });
  pdf.gap(2);
  pdf.text('Dossier de chantier', { size: 22, bold: true });
  pdf.gap(2);
  pdf.text(p.name, { size: 14, bold: true, color: GOLD });
  pdf.gap(8);
  pdf.hr();
  pdf.gap(8);
  if (p.code) pdf.metaRow('Code chantier', p.code);
  if (p.address) pdf.metaRow('Adresse', p.address);
  if (p.clientName) pdf.metaRow('Client', p.clientName);
  pdf.metaRow('Statut', p.statusLabel);
  if (p.stepLabel) pdf.metaRow('Étape en cours', p.stepLabel);
  pdf.metaRow('Ouvert le', fmtDate(p.createdAt));
  pdf.metaRow('Document généré le', fmtDate(input.generatedAt));

  // — Synthèse chiffrée —
  pdf.sectionTitle('Synthèse');
  pdf.tiles([
    { n: input.synthese.comptesRendus, label: 'Comptes rendus' },
    { n: input.synthese.choix, label: 'Choix' },
    { n: input.synthese.documents, label: 'Documents' },
    {
      n: input.synthese.reservesOuvertes,
      label: 'Réserves ouvertes',
      alerte: input.synthese.reservesOuvertes > 0,
    },
  ]);

  // — Comptes rendus —
  if (input.comptesRendus.length > 0) {
    pdf.sectionTitle('Comptes rendus');
    for (const cr of input.comptesRendus) {
      pdf.gap(4);
      pdf.text(`${fmtDate(cr.date)}${cr.titre ? ` · ${cr.titre}` : ''}`, {
        size: 10.5,
        bold: true,
      });
      if (cr.texte.trim()) pdf.text(cr.texte, { size: 10, color: MUTED });
      if (cr.photos.some((x) => x.imageUrl)) pdf.photoRow(cr.photos);
    }
  }

  // — Choix du client —
  if (input.choix.length > 0) {
    pdf.sectionTitle('Choix du client');
    for (const c of input.choix) {
      pdf.gap(3);
      pdf.text(`${c.categorie ? `${c.categorie} — ` : ''}${c.label}`, { size: 10.5, bold: true });
      pdf.text(`${c.statut}${c.detail ? ` · ${c.detail}` : ''}`, { size: 10, color: MUTED });
    }
  }

  // — Réserves —
  if (input.reserves.length > 0) {
    pdf.sectionTitle('Réserves');
    for (const r of input.reserves) {
      pdf.gap(2);
      pdf.text(`Réserve n° ${r.numero} — ${r.libelle}`, {
        size: 10.5,
        bold: true,
        color: r.ouverte ? REDINK : INK,
      });
      pdf.text(`${r.ouverte ? 'Ouverte' : 'Levée'} · ${fmtDate(r.date)}`, {
        size: 9.5,
        color: MUTED,
      });
    }
  }

  // — Documents —
  if (input.documents.length > 0) {
    pdf.sectionTitle('Documents');
    for (const d of input.documents) {
      pdf.text(`•  ${d.libelle}${d.famille ? `  (${d.famille})` : ''} · ${fmtDate(d.date)}`, {
        size: 10,
      });
    }
  }

  // — Album « Dans les coulisses » —
  const album = input.album.filter((m) => m.photos.some((x) => x.imageUrl));
  if (album.length > 0) {
    pdf.sectionTitle('Dans les coulisses');
    for (const m of album) {
      pdf.gap(3);
      const cap = m.titre?.trim() || m.legende?.trim();
      if (cap) pdf.text(`${cap} · ${fmtDate(m.date)}`, { size: 10, bold: true });
      pdf.photoRow(m.photos, 92);
    }
  }

  return pdf.finalize();
}
