export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });

/** Date courte (jour/mois) à partir d'une date ISO (YYYY-MM-DD ou complète). */
export const fmtDateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

/**
 * Durée estimée exprimée en langage naturel (« environ 3 mois », « ~6 semaines »).
 * Une estimation arrondie, jamais une valeur exacte trompeuse.
 */
export const fmtDuree = (jours: number): string => {
  if (jours <= 0) return '—';
  if (jours < 14) return `environ ${jours} jour${jours > 1 ? 's' : ''}`;
  if (jours < 60) {
    const semaines = Math.round(jours / 7);
    return `environ ${semaines} semaines`;
  }
  const mois = Math.round(jours / 30);
  return `environ ${mois} mois`;
};

/** Mois + année d'une date ISO (lecture calendaire de la frise). */
export const fmtMonth = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/** Montant en euros, sans décimales (présentation). */
export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
