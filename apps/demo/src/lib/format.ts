export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });

/** Date courte (jour/mois) à partir d'une date ISO (YYYY-MM-DD ou complète). */
export const fmtDateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

/** Montant en euros, sans décimales (présentation). */
export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
