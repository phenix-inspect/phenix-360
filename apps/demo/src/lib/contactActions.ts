/**
 * Liens profonds (deep-links) vers les apps natives — V1 100 % locale, sans
 * backend, sans envoi réel. PHÉNIX ouvre l'app native ; il ne l'intègre pas.
 * Fonctionne sur mobile (tel/sms/mailto/whatsapp/maps).
 */
const digits = (s: string): string => s.replace(/[^\d+]/g, '');

export const telHref = (phone: string): string => `tel:${digits(phone)}`;

export const smsHref = (phone: string, body?: string): string =>
  `sms:${digits(phone)}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;

export const whatsappHref = (number: string, text?: string): string =>
  `https://wa.me/${digits(number).replace(/^\+/, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const mailtoHref = (email: string, subject?: string, body?: string): string => {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : null,
    body ? `body=${encodeURIComponent(body)}` : null,
  ]
    .filter(Boolean)
    .join('&');
  return `mailto:${email}${params ? `?${params}` : ''}`;
};

export const mapsHref = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
