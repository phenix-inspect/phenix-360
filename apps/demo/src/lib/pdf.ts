/**
 * Extraction RÉELLE du texte d'un PDF, 100 % locale (aucun réseau, aucune
 * dépendance) : on lit les flux de contenu du PDF, on décompresse le FlateDecode
 * avec l'API navigateur `DecompressionStream`, puis on extrait le texte des
 * opérateurs d'affichage (Tj / TJ / chaînes littérales et hexadécimales).
 *
 * Portée assumée : les PDF « texte » (générés par un logiciel de devis, Word,
 * LibreOffice…) sont lus réellement. Un PDF SCANNÉ (image, sans couche texte)
 * ne renvoie aucun texte → l'appelant le signale clairement (« semble être une
 * image »). Un vrai OCR viendra plus tard, derrière le même point d'entrée.
 */

const MIN_CHARS = 24;

/** Décompresse un flux zlib/deflate via l'API navigateur (sinon null). */
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format);
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
      const ab = await new Response(stream).arrayBuffer();
      const out = new Uint8Array(ab);
      if (out.length > 0) return out;
    } catch {
      /* format suivant */
    }
  }
  return null;
}

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  '(': '(',
  ')': ')',
  '\\': '\\',
};

/** Extrait le texte lisible d'un flux de contenu PDF (déjà décodé en latin1). */
function textFromContent(content: string): string {
  let out = '';
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i]!;
    if (c === '(') {
      // Chaîne littérale (…) avec parenthèses imbriquées et échappements.
      let depth = 1;
      i += 1;
      while (i < n && depth > 0) {
        const ch = content[i]!;
        if (ch === '\\') {
          const nx = content[i + 1] ?? '';
          if (nx >= '0' && nx <= '7') {
            let oct = nx;
            i += 2;
            let k = 0;
            while (k < 2 && content[i] && content[i]! >= '0' && content[i]! <= '7') {
              oct += content[i];
              i += 1;
              k += 1;
            }
            out += String.fromCharCode(parseInt(oct, 8) & 0xff);
            continue;
          }
          out += ESCAPES[nx] ?? nx;
          i += 2;
          continue;
        }
        if (ch === '(') {
          depth += 1;
          out += ch;
          i += 1;
          continue;
        }
        if (ch === ')') {
          depth -= 1;
          i += 1;
          if (depth === 0) break;
          out += ch;
          continue;
        }
        out += ch;
        i += 1;
      }
    } else if (c === '<' && content[i + 1] !== '<') {
      // Chaîne hexadécimale <48656C6C6F>.
      let j = i + 1;
      let hex = '';
      while (j < n && content[j] !== '>') {
        if (/[0-9A-Fa-f]/.test(content[j]!)) hex += content[j];
        j += 1;
      }
      i = j + 1;
      if (hex.length % 2) hex += '0';
      for (let k = 0; k + 1 < hex.length; k += 2)
        out += String.fromCharCode(parseInt(hex.substr(k, 2), 16) & 0xff);
    } else {
      // Déplacements de ligne → saut de ligne ; affichage de texte → espace. On
      // préserve ainsi la structure en lignes (utile aux motifs d'extraction).
      const op = content.substr(i, 2);
      if (op === 'Td' || op === 'TD' || op === 'T*') out += '\n';
      else if (op === 'Tj' || op === 'TJ') out += ' ';
      i += 1;
    }
  }
  return out;
}

/** Décode des octets en latin1 (1 octet ↔ 1 caractère : offsets = index string). */
function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/**
 * Extrait le texte d'un fichier PDF. `readable=false` quand rien d'exploitable
 * n'a pu être lu (PDF image/scanné, ou fichier non PDF).
 */
export async function extractPdfText(file: File): Promise<{ text: string; readable: boolean }> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bin = latin1(bytes);
    if (!bin.startsWith('%PDF')) return { text: '', readable: false };

    let out = '';
    let idx = 0;
    while (true) {
      const s = bin.indexOf('stream', idx);
      if (s < 0) break;
      const end = bin.indexOf('endstream', s);
      if (end < 0) break;
      // Le flux commence après « stream » + fin de ligne (\r\n, \n).
      let dataStart = s + 'stream'.length;
      if (bin[dataStart] === '\r') dataStart += 1;
      if (bin[dataStart] === '\n') dataStart += 1;
      const dictStart = Math.max(0, s - 400);
      const dict = bin.slice(dictStart, s);
      const raw = bytes.subarray(dataStart, end);

      let content: string | null = null;
      if (/\/FlateDecode/.test(dict)) {
        const inflated = await inflate(raw);
        if (inflated) content = latin1(inflated);
      } else if (!/\/(DCT|JPX|CCITT|JBIG2)Decode/.test(dict)) {
        content = latin1(raw);
      }
      if (content) out += textFromContent(content) + '\n';
      idx = end + 'endstream'.length;
    }

    const cleaned = out.replace(/\s+/g, ' ').trim();
    return { text: out, readable: cleaned.length >= MIN_CHARS };
  } catch {
    return { text: '', readable: false };
  }
}
