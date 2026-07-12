# Corpus de qualification du moteur de lecture des devis

Ce dossier qualifie le moteur natif (`packages/core/src/devis-geometry.ts`) sur un
corpus **réel et hétérogène** de devis anonymisés. Objectif : démontrer que le
moteur est **opérationnel** en conditions réelles — pas seulement performant sur le
devis de référence.

## Objectif de couverture (≥ 15 documents)

Au minimum, une entrée par famille de mise en page :

Obat · Tolteck · Excel → PDF · Word → PDF · logiciel artisan · devis avec tableaux ·
devis forfaitaire · devis multi-TVA · devis avec options · devis avec avenants ·
PDF natifs · PDF scannés.

## Ajouter un devis réel

1. **Anonymiser à la source si possible.** Sinon, préparer un fichier de
   remplacements `anon.json` :
   ```json
   { "Nom Client": "Client Test", "12 rue Réelle": "1 rue Exemple", "D-2026-047": "D-000-000" }
   ```
2. **Fabriquer la fixture de géométrie** (extraction identique à l'app) :
   ```
   node apps/demo/e2e/corpus/build-fixture.mjs chemin/devis.pdf <id> anon.json
   ```
   → écrit `apps/demo/e2e/fixtures/corpus/<id>.geom.json` et imprime le texte
   reconstruit page par page. **Vérifier qu'aucune donnée personnelle ne subsiste.**
3. **Établir la vérité attendue À LA MAIN** en lisant le devis original, puis
   ajouter une entrée dans `corpus/index.mjs` (`geomPath`, `truth` : lots,
   prestations, exclusions, options, totaux HT/TTC, et un `attendus[]` par
   prestation — `cle` distinctive, `montantHT`, `doitContenir` pour prouver que la
   description multi-lignes n'est pas tronquée).
4. **Mesurer** :
   ```
   node apps/demo/e2e/corpus-qualification.test.mjs
   ```
   Le harnais imprime la batterie de métriques par document et vérifie les seuils
   d'acceptation sur le corpus **critique**.

## Règle d'or

On ne corrige **jamais** le moteur pour un seul document. Toute correction reste
**générique** (une famille de mise en page, pas une fixture). Un écho de correction
calée sur une fixture est un échec, pas un succès.

## Seuils d'acceptation (avant tout « opérationnel »)

- **0 prestation inventée** sur le corpus critique ;
- **100 % des écarts financiers réels détectés** (jamais masqués) ;
- **toutes les lignes incertaines signalées** (confiance ≠ Fiable) ;
- **PDF natifs ET scannés couverts** (l'OCR local alimente la même géométrie) ;
- **validation manuelle complète possible** (cycle Importé → Analyse à vérifier →
  Transcription validée, lot par lot).

Le harnais imprime un **VERDICT DE READINESS** honnête : tant que ces conditions ne
sont pas réunies, il affiche `OPÉRATIONNEL : NON`.

## PDF scannés (OCR local)

Les PDF scannés / images n'ont pas de couche texte. L'OCR **local** (moteur
tesseract.js et données FR embarquées, aucun réseau) produira la même structure de
géométrie (mots positionnés) que `extractPdfGeometry`, avec une confiance dégradée
par défaut. Le cycle reste : Importé → Analyse à vérifier → validation humaine. Une
fixture scannée porte `type: 'scanne'` dans sa vérité attendue.
