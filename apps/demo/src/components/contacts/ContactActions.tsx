import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@phenix360/ui';
import { CONTACT_ROLE_LABEL, type Contact, type ProjectId } from '@phenix360/core';
import { MapPin, MessageCircle, MessageSquare, Phone, Send } from 'lucide-react';
import { demo } from '../../store';
import { mailtoHref, mapsHref, smsHref, telHref, whatsappHref } from '../../lib/contactActions';
import { COMM_TEMPLATES, buildCommMessage, type CommTemplateKind } from '../../lib/commTemplates';

type Canal = 'sms' | 'whatsapp' | 'email';

/**
 * Actions de communication d'un contact : appeler, SMS, WhatsApp, mail,
 * itinéraire. L'app native s'ouvre (deep-link) ; PHÉNIX TRACE l'action au Journal
 * du chantier (interne, jamais côté client — VISION Art. 9). Pour SMS/WhatsApp/
 * mail, PHÉNIX propose un message pré-rempli selon le contexte (Art. 7).
 */
export function ContactActions({
  contact,
  projectId = null,
  chantierName,
  compact = false,
}: {
  contact: Contact;
  projectId?: ProjectId | null;
  chantierName?: string;
  compact?: boolean;
}): React.JSX.Element {
  const [canal, setCanal] = useState<Canal | null>(null);
  const roleLabel = CONTACT_ROLE_LABEL[contact.role];

  const log = (c: 'appel' | 'sms' | 'whatsapp' | 'email' | 'itineraire', sujet?: string): void => {
    void demo.logCommunication(projectId, {
      canal: c,
      contactNom: contact.nom,
      contactId: contact.id,
      role: roleLabel,
      ...(sujet ? { sujet } : {}),
    });
  };

  const btn =
    'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-base hover:border-gold-300 hover:bg-gold-50 [&_svg]:size-4 [&_svg]:text-gold-600';
  const waNumber = contact.whatsapp || contact.phone;

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${compact ? 'text-xs' : ''}`}>
        {contact.phone && (
          <a href={telHref(contact.phone)} className={btn} onClick={() => log('appel')}>
            <Phone aria-hidden /> Appeler
          </a>
        )}
        {contact.phone && (
          <button type="button" className={btn} onClick={() => setCanal('sms')}>
            <MessageSquare aria-hidden /> SMS
          </button>
        )}
        {waNumber && (
          <button type="button" className={btn} onClick={() => setCanal('whatsapp')}>
            <MessageCircle aria-hidden /> WhatsApp
          </button>
        )}
        {contact.email && (
          <button type="button" className={btn} onClick={() => setCanal('email')}>
            <Send aria-hidden /> Mail
          </button>
        )}
        {contact.address && (
          <a
            href={mapsHref(contact.address)}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
            onClick={() => log('itineraire')}
          >
            <MapPin aria-hidden /> Itinéraire
          </a>
        )}
      </div>

      {canal && (
        <MessageComposer
          canal={canal}
          contact={contact}
          chantierName={chantierName}
          onSend={(sujet) => {
            log(canal, sujet);
            setCanal(null);
          }}
          onClose={() => setCanal(null)}
        />
      )}
    </>
  );
}

const CANAL_LABEL: Record<Canal, string> = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'e-mail' };

function MessageComposer({
  canal,
  contact,
  chantierName,
  onSend,
  onClose,
}: {
  canal: Canal;
  contact: Contact;
  chantierName?: string;
  onSend: (sujet: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const defaultKind: CommTemplateKind =
    contact.role === 'client' ? 'message_client' : 'relance_artisan';
  const [kind, setKind] = useState<CommTemplateKind>(defaultKind);
  const initial = buildCommMessage(defaultKind, {
    contactNom: contact.nom,
    chantier: chantierName,
  });
  const [subject, setSubject] = useState(initial.subject ?? '');
  const [body, setBody] = useState(initial.body);
  const [sujet, setSujet] = useState(initial.sujet);

  const applyTemplate = (k: CommTemplateKind): void => {
    setKind(k);
    const m = buildCommMessage(k, { contactNom: contact.nom, chantier: chantierName });
    setSubject(m.subject ?? '');
    setBody(m.body);
    setSujet(m.sujet);
  };

  const href =
    canal === 'sms'
      ? smsHref(contact.phone ?? '', body)
      : canal === 'whatsapp'
        ? whatsappHref(contact.whatsapp || contact.phone || '', body)
        : mailtoHref(contact.email ?? '', subject, body);
  const external = canal === 'whatsapp';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {CANAL_LABEL[canal]} — {contact.nom}
          </DialogTitle>
          <DialogDescription>
            PHÉNIX prépare le message. Vous l'ajustez, puis l'app {CANAL_LABEL[canal]} s'ouvre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Message proposé</span>
            <select
              value={kind}
              onChange={(e) => applyTemplate(e.target.value as CommTemplateKind)}
              aria-label="Modèle de message"
              className="h-10 rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
            >
              {COMM_TEMPLATES.map((t) => (
                <option key={t.kind} value={t.kind}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {canal === 'email' && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Objet</span>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Message</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            onClick={() => onSend(sujet)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold-600 px-4 py-2 text-sm font-semibold text-paper-0 transition-colors duration-base hover:bg-gold-700 [&_svg]:size-4"
          >
            <Send aria-hidden /> Ouvrir {CANAL_LABEL[canal]}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
