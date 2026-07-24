/**
 * Extraction RÉELLE du texte d'un PDF, 100 % locale (aucun réseau) via pdf.js.
 * Les devis du logiciel officiel (Phenix-amo) sont des PDF à polices CID
 * Identity-H (le flux de contenu ne contient que des identifiants de glyphes) :
 * seul un vrai moteur PDF, qui lit les tables `ToUnicode` et les ressources par
 * page/XObject, en reconstruit le texte. pdf.js s'exécute en local (worker
 * embarqué par Vite) — rien ne sort de la machine.
 *
 * On reconstruit des LIGNES à partir des positions (`transform`) pour que les
 * motifs d'extraction (client, montant, dates…) retrouvent leurs repères.
 */
// Build LEGACY (compatibilité navigateurs large : évite les API JS trop
// récentes des builds modernes de pdf.js).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PageGeom } from '@phenix360/core';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** En dessous, on considère qu'aucun texte exploitable n'a été lu (scan probable). */
const MIN_CHARS = 24;

interface TextItemLike {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/**
 * Extrait le texte d'un fichier PDF. `readable=false` quand rien d'exploitable
 * n'a pu être lu (PDF image/scanné sans couche texte).
 */
export async function extractPdfText(file: File): Promise<{ text: string; readable: boolean }> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({
      data,
      // Extraction de texte pure : pas de polices système ni de ressources
      // distantes (tout est local, rien ne sort de la machine).
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;

    let out = '';
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      for (const raw of content.items) {
        const it = raw as TextItemLike;
        if (typeof it.str !== 'string') continue;
        const y = it.transform?.[5] ?? 0;
        // Nouvelle ligne quand la position verticale change nettement.
        if (lastY !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
        out += it.str;
        if (it.hasEOL) out += '\n';
        lastY = y;
      }
      out += '\n';
    }
    const destroy = (doc as unknown as { destroy?: () => Promise<void> }).destroy;
    if (typeof destroy === 'function') await destroy.call(doc);

    const cleaned = out.replace(/\s+/g, ' ').trim();
    return { text: out, readable: cleaned.length >= MIN_CHARS };
  } catch {
    return { text: '', readable: false };
  }
}

/**
 * Extrait la GÉOMÉTRIE d'un PDF (mots positionnés page par page) : matière
 * première du moteur natif de lecture des devis. Chaque mot connaît sa page, son
 * x, son y (repère PDF) et sa largeur — ce qui permet de reconstruire colonnes,
 * descriptions multi-lignes et de distinguer prestations, totaux et exclusions.
 * Renvoie un tableau VIDE si rien d'exploitable (PDF image/scanné, erreur).
 */
export async function extractPdfGeometry(file: File): Promise<PageGeom[]> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: false })
      .promise;
    const pages: PageGeom[] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const tokens = [];
      for (const raw of content.items) {
        const it = raw as TextItemLike & { width?: number };
        if (typeof it.str !== 'string' || !it.str.trim()) continue;
        tokens.push({
          x: Math.round(it.transform?.[4] ?? 0),
          y: Math.round(it.transform?.[5] ?? 0),
          w: Math.round(it.width ?? 0),
          str: it.str,
        });
      }
      pages.push({
        page: p,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        tokens,
      });
    }
    const destroy = (doc as unknown as { destroy?: () => Promise<void> }).destroy;
    if (typeof destroy === 'function') await destroy.call(doc);
    return pages;
  } catch {
    return [];
  }
}
