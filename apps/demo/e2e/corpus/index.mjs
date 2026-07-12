/**
 * MANIFESTE DU CORPUS DE QUALIFICATION du moteur natif de lecture des devis.
 * =============================================================================
 * Chaque entrée = un devis RÉEL anonymisé + sa VÉRITÉ ATTENDUE, établie À LA MAIN
 * en lisant le document original. Le harnais (`corpus-qualification.test.mjs`)
 * mesure, pour chaque document : prestations attendues/détectées, lignes
 * oubliées/inventées, descriptions tronquées, montants incorrects, lots
 * incorrects, options/exclusions mal classées, écarts HT/TVA/TTC.
 *
 * RÈGLE : on ne corrige JAMAIS le moteur pour un seul document. Toute correction
 * doit rester générique (une famille de mise en page, pas une fixture). On
 * n'ANNONCE « opérationnel » qu'une fois les seuils d'acceptation atteints sur le
 * corpus critique ET les familles couvertes (natifs + scannés).
 *
 * Ajouter un document : voir `README.md` (extraction géométrie → anonymisation →
 * vérité attendue). `critique: true` = le document compte pour le verdict.
 *
 * Champs de la vérité (`truth`) :
 *   source        Logiciel/origine (« Obat », « Tolteck », « Excel→PDF »…).
 *   type          'natif' | 'scanne'.
 *   critique      Compté dans le verdict d'acceptation.
 *   lots          Nombre de lots attendus.
 *   prestations   Nombre de prestations FERMES attendues (hors exclusions/options).
 *   exclusions    Nombre de mentions d'exclusion attendues.
 *   options       Nombre d'options/variantes attendues.
 *   totalHT/TTC   Totaux déclarés sur le document.
 *   attendus[]    Une entrée par prestation ferme : { cle, montantHT?, doitContenir? }
 *                 - cle          fragment DISTINCTIF du libellé (insensible casse) ;
 *                 - montantHT    montant HT attendu (départage les libellés proches) ;
 *                 - doitContenir fragment qui DOIT rester dans le libellé (preuve que
 *                                la description multi-lignes n'est pas tronquée).
 */

export const CORPUS = [
  {
    id: 'phenix-amo-reference',
    geomPath: '../fixtures/devis-reel-geometrie.json',
    truth: {
      source: 'Phenix-amo / Obat (PDF natif colonné)',
      type: 'natif',
      critique: true,
      lots: 13,
      prestations: 21,
      exclusions: 1,
      options: 0,
      totalHT: 39773.03,
      totalTTC: 43993.35,
      attendus: [
        { cle: 'Installation de chantier', montantHT: 850 },
        { cle: 'Dépose cuisine', montantHT: 1900, doitContenir: 'Evacuation' },
        { cle: 'cloison de distribution', montantHT: 3523.5, doitContenir: 'comprenant' },
        { cle: 'isolation par panneau', montantHT: 1552.95 },
        { cle: 'doublage BA13', montantHT: 2306.05 },
        { cle: 'Installation électrique', montantHT: 5802.78, doitContenir: 'communication' },
        { cle: "salle d'eau", montantHT: 2713.11 },
        { cle: 'chauffe-eau', montantHT: 887.01 },
        { cle: 'pack WC', montantHT: 396 },
        { cle: 'Modification alimentation', montantHT: 420 },
        { cle: 'Vérification ventilation', montantHT: 820 },
        { cle: 'enduit de ragréage', montantHT: 847.78 },
        { cle: 'lame PVC', montantHT: 1862 },
        { cle: 'plinthe bois', montantHT: 610 },
        { cle: "Faïence d'une douche", montantHT: 557.23 },
        { cle: 'peinture mate', montantHT: 1542.42 },
        { cle: 'peinture mate', montantHT: 4573.8 },
        { cle: "aménagement d'une cuisine", montantHT: 1961.74 },
        { cle: 'bloc-porte', montantHT: 1080, doitContenir: 'alvéolaire' },
        { cle: 'terrasse', montantHT: 1400, doitContenir: 'claustra' },
        { cle: 'agencement et de la décoration', montantHT: 4166.66, doitContenir: 'clé en main' },
      ],
    },
  },
  {
    id: 'phenix-agencement-027',
    geomPath: '../fixtures/corpus/phenix-agencement-027.geom.json',
    truth: {
      source: 'Phenix-amo (devis mono-poste / forfait)',
      type: 'natif',
      critique: true,
      lots: 1,
      prestations: 1,
      exclusions: 0,
      options: 0,
      totalHT: 4166.66,
      totalTTC: 4999.99,
      attendus: [{ cle: 'agencement', montantHT: 4166.66, doitContenir: 'clé en main' }],
    },
  },
  {
    id: 'renovely-ventilation-028',
    geomPath: '../fixtures/corpus/renovely-ventilation-028.geom.json',
    truth: {
      source: 'Renovely (autre logiciel, multi-TVA 10/20 %)',
      type: 'natif',
      critique: true,
      lots: 5,
      prestations: 8,
      exclusions: 0,
      options: 0,
      totalHT: 2624.83,
      totalTTC: 2902.31,
      attendus: [
        { cle: 'Installation de chantier', montantHT: 190 },
        { cle: "groupe d'extraction", montantHT: 659.83 },
        { cle: 'ligne electrique', montantHT: 430 },
        { cle: 'thermostat connecté', montantHT: 543 },
        { cle: 'grilles de ventilation', montantHT: 360 },
        { cle: 'Dépose grille', montantHT: 202 },
        { cle: 'Nettoyage de fin de chantier', montantHT: 90 },
        { cle: 'Frais de services', montantHT: 150 },
      ],
    },
  },
  {
    id: 'bon-commande-martos',
    geomPath: '../fixtures/corpus/bon-commande-martos.geom.json',
    truth: {
      source: 'Bon de commande (sections SANS numéro, sous-totaux par section)',
      type: 'natif',
      critique: true,
      lots: 10,
      prestations: 34,
      exclusions: 0,
      options: 0,
      totalHT: 25014,
      totalTTC: 27408.9,
      // Contrôles ponctuels (les montants globaux sont garantis par la réconciliation).
      attendus: [
        { cle: 'Dépose et évacuation de poste salle de bain', montantHT: 200 },
        { cle: "Ouverture mur extérieur (1,7", montantHT: 400 },
        { cle: 'Coffrage et bétonnage linteau', montantHT: 300 },
        { cle: 'Nettoyage complet de fin de chantier', montantHT: 100 },
        { cle: 'carrelage', montantHT: 3735 },
      ],
    },
  },
  {
    id: 'revel-multitrade-decroix',
    geomPath: '../fixtures/corpus/revel-multitrade-decroix.geom.json',
    truth: {
      source: 'Revel (devis 18 pages, multi-corps d’état, numérotation à 3 niveaux)',
      type: 'natif',
      critique: false, // CAS DUR partiellement traité — vérité attendue à établir à la main
      // prestations: null → le harnais imprime les métriques sans les asserter :
      // la numérotation profonde (1 / 2.1 / 2.1.1) et la TVA héritée par section
      // restent à qualifier document en main avant de le passer « critique ».
      prestations: null,
      lots: null,
      exclusions: 0,
      options: 0,
      totalHT: null,
      totalTTC: null,
    },
  },
  // ⬇️ Ajouter ici les FAMILLES MANQUANTES (Obat, Tolteck, Excel→PDF, Word→PDF,
  //    devis avec options/avenants, PDF SCANNÉS). Cf. README.md.
];

/** Les 12 familles de mise en page à couvrir avant tout verdict « opérationnel ». */
export const FAMILLES_CIBLES = [
  'Obat',
  'Tolteck',
  'Excel→PDF',
  'Word→PDF',
  'logiciel artisan',
  'devis avec tableaux',
  'devis forfaitaire',
  'devis multi-TVA',
  'devis avec options',
  'devis avec avenants',
  'PDF natif',
  'PDF scanné',
];
