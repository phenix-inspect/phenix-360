/**
 * Ville d'un chantier, DÉRIVÉE de son adresse (aucune saisie en plus). On lit le
 * dernier segment de l'adresse (après la dernière virgule) et on retire un code
 * postal FR éventuel. Si rien d'exploitable, on renvoie `null` — on n'affiche
 * jamais une valeur inutile dans le filtre.
 */
export function cityOf(address?: string | null): string | null {
  if (!address) return null;
  const last = address.split(',').pop()?.trim() ?? '';
  const city = last.replace(/^\d{5}\s*/, '').trim();
  return city.length > 0 ? city : null;
}
