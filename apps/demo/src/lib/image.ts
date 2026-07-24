/**
 * Conversion d'un fichier image en `imageUrl` exploitable tout de suite (data
 * URL), redimensionnée pour rester légère — la démo persiste dans localStorage,
 * sans backend. Quand un vrai stockage existera, on remplacera cette fonction
 * par un upload qui renvoie une URL distante, sans toucher au reste.
 */
export async function fileToImageUrl(file: File, max = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image illisible'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, max / Math.max(img.width, img.height) || 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  try {
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    // Canvas non exportable (ex. SVG « tainted ») → on garde l'image d'origine.
    return dataUrl;
  }
}
