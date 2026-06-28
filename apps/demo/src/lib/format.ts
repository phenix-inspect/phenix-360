export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });
