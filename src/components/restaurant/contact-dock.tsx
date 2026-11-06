import { Instagram, MessageCircle, Phone } from 'lucide-react';
import { contacts } from '@/lib/restaurant-data';

export function ContactDock() {
  const instagramUrl = contacts.instagram || 'https://www.instagram.com/marmitexdatiaval/';
  const phoneHref = contacts.phone || 'tel:+553134454042';
  const whatsappHref = contacts.whatsapp || 'https://wa.me/553134454042';

  return (
    <nav className="contact-dock" aria-label="Atendimento, telefone fixo e redes sociais">
      {whatsappHref && (
        <a
          className="contact-dock__icon contact-dock__icon--whatsapp"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chamar no WhatsApp: ${contacts.phoneLabel}`}
          title={`WhatsApp: ${contacts.phoneLabel}`}
        >
          <MessageCircle aria-hidden="true" />
        </a>
      )}
      {instagramUrl && (
        <a
          className="contact-dock__icon contact-dock__icon--instagram"
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram da Tia Val: @marmitexdatiaval"
          title="Instagram da Tia Val: @marmitexdatiaval"
        >
          <Instagram aria-hidden="true" />
        </a>
      )}
      {phoneHref && (
        <a
          className="contact-dock__icon contact-dock__icon--phone"
          href={phoneHref}
          aria-label={`Ligar no telefone fixo: ${contacts.phoneLabel} (mesmo do WhatsApp)`}
          title={`Ligar no fixo: ${contacts.phoneLabel}`}
        >
          <Phone aria-hidden="true" />
        </a>
      )}
    </nav>
  );
}
