/**
 * PHÉNIX 360 — PROFIL SPÉCIALISÉ OBAT (lecture prioritaire des devis OBAT)
 * =============================================================================
 * Les devis du conducteur sont générés par OBAT (compte « Phenix-amo »). OBAT a
 * un gabarit récurrent : en-tête « N° DÉSIGNATION QTÉ U. PRIX U. TVA TOTAL HT »,
 * pied de page « Page X sur Y », bloc de totaux « Total net HT / TVA / Total TTC
 * / NET À PAYER », ligne « Valable jusqu'au », ventilation « Taux TVA / Base HT »,
 * garantie décennale. Ce module :
 *
 *   1. RECONNAÎT un devis OBAT avec un score de confiance (`detecterObat`) ;
 *   2. l'analyse avec un PROFIL SPÉCIALISÉ : colonnes ANCRÉES SUR L'EN-TÊTE OBAT
 *      (positions fixes, fiables même sur un devis à une seule ligne) plutôt
 *      qu'apprises des données — là où l'apprentissage générique peut vaciller ;
 *   3. sinon, laisse la main au moteur GÉNÉRIQUE (`analyserDevisGeo`).
 *
 * Règle de priorité : OBAT reconnu avec assez de confiance → profil OBAT ; sinon
 * générique ; jamais le parseur OBAT sur un document non reconnu. Le pipeline de
 * lecture (reconstruction, classification, contrôles) est PARTAGÉ : le profil ne
 * change que la façon d'ancrer les colonnes, pas les règles métier.
 */
import {
  analyserDevisGeo,
  colonnesObat,
  type DevisAnalyseGeo,
  type PageGeom,
} from './devis-geometry.js';

/** Résultat de la reconnaissance OBAT. */
export interface ObatDetection {
  estObat: boolean;
  /** Score de confiance 0–1 (proportion d'indices OBAT trouvés). */
  confiance: number;
  /** Indices reconnus (traçabilité de la décision). */
  indices: string[];
}

/** Seuil de confiance minimal pour appliquer le profil OBAT. */
const SEUIL_OBAT = 0.5;

/** Les indices signant le gabarit OBAT (ancres sémantiques, pas des coordonnées). */
const INDICES_OBAT: { cle: string; re: RegExp }[] = [
  { cle: 'en-tête colonnes', re: /d[eé]signation[\s\S]{0,60}?qt[eé][\s\S]{0,80}?total\s*ht/i },
  { cle: 'prix U. + TVA', re: /prix\s*u\.?[\s\S]{0,40}?tva/i },
  { cle: 'total net HT', re: /total\s+net\s+ht/i },
  { cle: 'net à payer', re: /net\s+à\s+payer/i },
  { cle: 'validité', re: /valable\s+jusqu['’]/i },
  { cle: 'pied « Page X sur Y »', re: /page\s+\d+\s+sur\s+\d+/i },
  { cle: 'ventilation TVA', re: /taux\s+tva[\s\S]{0,40}?base\s+ht/i },
  { cle: 'garantie décennale', re: /garantie\s+décennale/i },
];

/**
 * Reconnaît un devis OBAT à partir de son texte (toutes pages). Déterministe :
 * on compte les indices du gabarit ; l'en-tête des colonnes et le bloc de totaux
 * sont les signaux forts. `estObat` dès que la moitié des indices sont réunis.
 */
export function detecterObat(pages: PageGeom[]): ObatDetection {
  const texte = pages
    .flatMap((p) => p.tokens.map((t) => t.str))
    .join(' ')
    .replace(/\s+/g, ' ');
  const indices = INDICES_OBAT.filter((i) => i.re.test(texte)).map((i) => i.cle);
  const confiance = indices.length / INDICES_OBAT.length;
  // Signal fort obligatoire : l'en-tête de colonnes OBAT (sinon, pas OBAT).
  const enTete = indices.includes('en-tête colonnes');
  return { estObat: enTete && confiance >= SEUIL_OBAT, confiance, indices };
}

/**
 * Analyse un devis avec le PROFIL OBAT (colonnes ancrées sur l'en-tête). Si
 * l'en-tête OBAT n'est pas exploitable, retombe sur l'analyse générique.
 */
export function analyserDevisObat(pages: PageGeom[]): DevisAnalyseGeo {
  const colonnes = colonnesObat(pages);
  if (!colonnes) return analyserDevisGeo(pages);
  return analyserDevisGeo(pages, { colonnes, profil: 'obat' });
}

/**
 * POINT D'ENTRÉE unique : reconnaît le format et applique le bon profil. OBAT
 * reconnu (confiance suffisante) → profil OBAT spécialisé ; sinon → moteur
 * générique. Ne jamais appliquer OBAT à un document non reconnu.
 */
export function analyserDevis(pages: PageGeom[]): DevisAnalyseGeo & { detection: ObatDetection } {
  const detection = detecterObat(pages);
  const analyse = detection.estObat ? analyserDevisObat(pages) : analyserDevisGeo(pages);
  return { ...analyse, detection };
}
