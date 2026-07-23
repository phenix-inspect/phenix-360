/**
 * PHÉNIX 360 — Export « Dossier de chantier » (PDF)
 * ===========================================================================
 * Assemble, depuis la vérité du store (journal + dossier + Fil), un dossier PDF
 * complet du chantier : couverture, synthèse, comptes rendus, choix, réserves,
 * documents et album des coulisses. Livrable pour le client ET archive lisible
 * (au-delà des données brutes déjà sauvegardées côté Supabase).
 *
 * jsPDF ne sait pas charger une image DISTANTE de façon synchrone : les photos
 * servies par Supabase Storage (URL https) sont donc pré-résolues ici en data URL
 * (fetch → blob → base64) AVANT de construire le PDF. Résolution best-effort et
 * plafonnée : une photo illisible devient un simple cadre gris, jamais un échec.
 */
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STEP_LABEL,
  SELECTION_STATUS_LABEL,
  deriveProjectStatus,
  isCompteRendu,
  isDocument,
  isPublished,
  momentCover,
  momentsCoulisses,
  reserveEvents,
  reserveStatut,
  reservesOuvertes,
  type Event,
  type Moment,
  type Project,
  type ProjectDossier,
} from '@phenix360/core';
import { buildChantierDossierPdf, type ChantierDossierInput, type DossierPhoto } from './pdfEngine';
import { DOC_FAMILY_LABEL, documentFamily } from './documentFilter';
import { downloadPdfDocument } from './document';
import { isRemoteUrl } from './mediaStore';
import { recordError } from './diagnostics';

/** Nombre maximum de photos embarquées (poids/perf du PDF). */
const MAX_PHOTOS = 40;

/** Une image distante (Storage) → data URL ; sinon (déjà data URL) inchangée. */
async function resolvePhoto(
  url: string,
  cache: Map<string, string | undefined>,
): Promise<string | undefined> {
  if (!isRemoteUrl(url)) return url; // déjà une data URL (démo)
  if (cache.has(url)) return cache.get(url);
  let out: string | undefined;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      out = await new Promise<string | undefined>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : undefined);
        fr.onerror = () => resolve(undefined);
        fr.readAsDataURL(blob);
      });
    }
  } catch (e) {
    recordError('error', `dossier photo: ${e instanceof Error ? e.message : String(e)}`);
  }
  cache.set(url, out);
  return out;
}

/**
 * Génère et télécharge le dossier PDF du chantier. Best-effort sur les images.
 */
export async function exportChantierDossier(args: {
  project: Project;
  events: Event[];
  dossier?: ProjectDossier | null;
  moments: Moment[];
  clientName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { project, events, dossier, moments } = args;
  try {
    const cache = new Map<string, string | undefined>();
    let budget = MAX_PHOTOS;
    // Résout une liste de photos (imageUrl) en data URL, dans la limite du budget.
    const resolveMany = async (urls: (string | undefined)[]): Promise<DossierPhoto[]> => {
      const out: DossierPhoto[] = [];
      for (const u of urls) {
        if (!u) continue;
        if (budget <= 0) break;
        budget -= 1;
        out.push({ imageUrl: await resolvePhoto(u, cache) });
      }
      return out;
    };

    // — Comptes rendus publiés (récent → ancien) —
    const crEvents = events
      .filter(isCompteRendu)
      .filter(isPublished)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const comptesRendus: ChantierDossierInput['comptesRendus'] = [];
    for (const e of crEvents) {
      const c = e.content;
      const pointPhotos = (c.points ?? []).flatMap((pt) => pt.photos ?? []);
      const texte =
        c.texte?.trim() ||
        (c.points ?? [])
          .map((pt) => pt.comment)
          .filter(Boolean)
          .join(' · ');
      comptesRendus.push({
        date: e.createdAt,
        ...(c.docTitre ? { titre: c.docTitre } : {}),
        texte: texte ?? '',
        photos: await resolveMany(pointPhotos.map((ph) => ph.imageUrl)),
      });
    }

    // — Choix du client (dossier synthétisé / préparé) —
    const choix: ChantierDossierInput['choix'] = (dossier?.selections ?? []).map((s) => ({
      categorie: s.categorie ?? '',
      label: s.label,
      statut: SELECTION_STATUS_LABEL[s.statut] ?? s.statut,
      ...(s.detail ? { detail: s.detail } : {}),
    }));

    // — Réserves (ouvertes en premier) —
    const reserves: ChantierDossierInput['reserves'] = reserveEvents(events)
      .map((r) => ({
        numero: r.content.numero,
        libelle: r.content.libelle,
        ouverte: reserveStatut(r, events) === 'ouverte',
        date: r.createdAt,
      }))
      .sort((a, b) => Number(b.ouverte) - Number(a.ouverte) || a.numero - b.numero);

    // — Documents —
    const documents: ChantierDossierInput['documents'] = events
      .filter(isDocument)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((e) => ({
        libelle: e.content.libelle || e.content.attachment?.fileName || 'Document',
        famille: DOC_FAMILY_LABEL[documentFamily(e)],
        date: e.createdAt,
      }));

    // — Album « Dans les coulisses » —
    const albumMoments = momentsCoulisses(moments)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const album: ChantierDossierInput['album'] = [];
    for (const m of albumMoments) {
      const cover = momentCover(m);
      album.push({
        ...(m.title?.trim() ? { titre: m.title } : {}),
        ...(cover?.legende ? { legende: cover.legende } : {}),
        date: m.createdAt,
        photos: await resolveMany(m.photos.map((ph) => ph.imageUrl)),
      });
    }

    const input: ChantierDossierInput = {
      project: {
        name: project.name,
        ...(project.code ? { code: project.code } : {}),
        ...(project.address ? { address: project.address } : {}),
        ...(args.clientName ? { clientName: args.clientName } : {}),
        statusLabel: PROJECT_STATUS_LABEL[deriveProjectStatus(project, events)],
        ...(project.currentStep ? { stepLabel: PROJECT_STEP_LABEL[project.currentStep] } : {}),
        createdAt: project.createdAt,
      },
      generatedAt: new Date().toISOString(),
      synthese: {
        comptesRendus: comptesRendus.length,
        choix: choix.length,
        documents: documents.length,
        reservesOuvertes: reservesOuvertes(events).length,
      },
      comptesRendus,
      choix,
      reserves,
      documents,
      album,
    };

    const bytes = buildChantierDossierPdf(input);
    downloadPdfDocument(bytes, `Dossier de chantier — ${project.name}`);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    recordError('error', `exportChantierDossier: ${error}`);
    return { ok: false, error: 'La génération du dossier a échoué.' };
  }
}
