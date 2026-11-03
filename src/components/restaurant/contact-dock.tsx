import { Instagram, MessageCircle } from 'lucide-react';
import { contacts } from '@/lib/restaurant-data';

export function ContactDock() {
  return <nav className="contact-dock" aria-label="Atendimento e redes sociais">
    {contacts.whatsapp && <a className="contact-dock__icon contact-dock__icon--whatsapp" href={contacts.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chamar a Tia Val no WhatsApp" title="WhatsApp">
      <MessageCircle aria-hidden="true" />
    </a>}
    {contacts.instagram && <a className="contact-dock__icon contact-dock__icon--instagram" href={contacts.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram da Tia Val" title="Instagram">
      <Instagram aria-hidden="true" />
    </a>}
  </nav>;
}