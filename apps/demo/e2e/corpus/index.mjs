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
  // ⬇️ Ajouter ici chaque devis réel anonymisé (Obat, Tolteck, Excel→PDF,
  //    Word→PDF, logiciel artisan, forfaitaire, multi-TVA, options, avenants,
  //    natifs ET scannés). Cf. README.md.
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
