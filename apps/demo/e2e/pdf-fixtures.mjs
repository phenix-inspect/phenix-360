/**
 * Fabrique de PDF minimalistes mais VALIDES pour les tests e2e :
 *  • `textPdf(lines)` → un PDF avec une vraie couche texte (flux de contenu non
 *    compressé, opérateurs Td/Tj) que l'extracteur lit réellement ;
 *  • `imagePdf()` → un PDF sans aucune couche texte (simule un scan/image).
 * Aucun xref « exact » n'est nécessaire : l'extracteur balaie les flux.
 */

function buildPdf(contentStream) {
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${Buffer.byteLength(contentStream, 'latin1')}>>\nstream\n${contentStream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];
  let pdf = '%PDF-1.4\n';
  objs.forEach((body, i) => {
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  pdf += 'trailer\n<</Root 1 0 R/Size 6>>\n%%EOF';
  return Buffer.from(pdf, 'latin1');
}

/** Un PDF « texte » : chaque ligne est affichée via Td (nouvelle ligne) + Tj. */
export function textPdf(lines) {
  const esc = (s) => s.replace(/([\\()])/g, '\\$1');
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

/** Devis d'exemple, réaliste, en texte lisible. */
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
