/**
 * Fabrique de PDF de test VALIDES et lisibles par pdf.js :
 *  • `textPdf(lines)` → PDF « texte » simple (Helvetica, WinAnsi) ;
 *  • `imagePdf()` → PDF sans couche texte (simule un scan/image) ;
 *  • `phenixDevisPdf(opts)` → reproduit la MISE EN PAGE du format « Phenix-amo »
 *    (le logiciel de devis du conducteur), avec des données anonymisées, pour
 *    tester durablement le lecteur expert sans embarquer de vrai devis.
 */

function buildPdf(contentStream) {
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${Buffer.byteLength(contentStream, 'latin1')}>>\nstream\n${contentStream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];
  let pdf = '%PDF-1.4\n';
  objs.forEach((body, i) => {
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  pdf += 'trailer\n<</Root 1 0 R/Size 6>>\n%%EOF';
  return Buffer.from(pdf, 'latin1');
}

// Échappe pour une chaîne littérale PDF ; « € » → octal WinAnsi \200.
const esc = (s) => s.replace(/([\\()])/g, '\\$1').replace(/€/g, '\\200');

/** Un PDF « texte » : chaque ligne est affichée via Td (nouvelle ligne) + Tj. */
export function textPdf(lines) {
  let content = 'BT /F1 12 Tf 50 800 Td ';
  lines.forEach((line, i) => {
    if (i > 0) content += '0 -16 Td ';
    content += `(${esc(line)}) Tj `;
  });
  content += 'ET';
  return buildPdf(content);
}

/** Un PDF « image » : un flux de contenu SANS aucun opérateur de texte. */
export function imagePdf() {
  return buildPdf('q 1 0 0 1 0 0 cm 0 0 200 200 re f Q');
}

/** Devis d'exemple GÉNÉRIQUE (hors format Phenix-amo), en texte lisible. */
export const DEVIS_LINES = [
  'RENOV BATIMENT SARL',
  'SIRET 812 345 678 00019',
  'Devis N DEV-2025-014',
  'Date : 12/03/2025',
  'Client : Mme Camille Martin',
  'Chantier : 24 rue Bugeaud, 69006 Lyon',
  'Renovation appartement',
  'Lot 1 - Depose et demolition',
  'Lot 2 - Plomberie sanitaire salle de bain',
  'Lot 3 - Electricite sejour et chambre',
  'Lot 4 - Carrelage et faience',
  'Lot 5 - Peinture',
  'Materiaux : carrelage gres cerame, parquet chene',
  'Delai d execution : 8 semaines',
  'Acompte de 30 % a la commande',
  'Total HT : 42 000,00 EUR',
  'Total TTC : 46 200,00 EUR',
];

/** Les lignes du devis « Phenix-amo » anonymisé (mise en page réelle). */
export function phenixDevisLines(opts = {}) {
  const o = {
    client: 'M. Jean Testeur',
    rue: '5 rue des Essais',
    ville: '69100 Villeurbanne',
    numero: 'D-202601-001',
    date: '15/01/2026',
    debut: '01/03/2026',
    duree: '3 mois',
    ttc: '11 000,00',
    ht: '9 166,67',
    acompte: 'Acompte de 30 % a la signature soit 3 300,00 € TTC',
    ...opts,
  };
  return [
    'Phenix-amo',
    '17 Rue Grand Rabbin Haguenauer',
    '54000',
    'NANCY',
    'France',
    'TVA N° FR18100527407',
    'Email : phenix.strategie@gmail.com',
    'Devis',
    `N° ${o.numero}`,
    `En date du : ${o.date}`,
    "Valable jusqu' au : 20/06/2026",
    `Début des travaux le : ${o.debut} - Durée estimée à : ${o.duree}`,
    'N° DÉSIGNATION QTÉ U. PRIX U. TVA TOTAL HT',
    '1 1. INSTALLATION / PREPARATION 850,00 €',
    '1.1 Installation de chantier, protection des sols, cuisine et salle de bain',
    '1,00 u 850,00 € 10,00 % 850,00 €',
    '2 DEMOLITION / DEPOSE 1 900,00 €',
    '2.1 Depose cuisine existante, carrelage et parquet',
    '3 PLOMBERIE / SANITAIRE 4 416,12 €',
    '4 ELECTRICITE 5 802,78 €',
    o.client,
    o.rue,
    o.ville,
    'France',
    'Phenix-amo - 17 Rue Grand Rabbin Haguenauer, 54000 NANCY, France - SASU au capital de 500 €',
    `Total net HT ${o.ht} €`,
    'TVA 20,00 % 1 833,33 €',
    `Total TTC ${o.ttc} €`,
    `NET À PAYER ${o.ttc} €`,
    'Pour le client',
    o.acompte,
  ];
}

/**
 * Reproduit la mise en page du format « Phenix-amo » (anonymisée). Le lecteur
 * expert doit y retrouver client, adresse, montant, date, lots, délais, acompte.
 */
export function phenixDevisPdf(opts = {}) {
  return textPdf(phenixDevisLines(opts));
}

/** Le même devis en TEXTE BRUT (pour tester le collage manuel). */
export function phenixDevisText(opts = {}) {
  return phenixDevisLines(opts).join('\n');
}
