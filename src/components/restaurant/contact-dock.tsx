import { Instagram, MessageCircle, Phone, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contacts } from '@/lib/restaurant-data';

export function ContactDock() {
  return <nav className="contact-dock" aria-label="Atalhos de atendimento">
    <Button asChild variant="ghost"><a href="#pratos"><Utensils /><span>Cardápio</span></a></Button>
    {contacts.instagram && <Button asChild variant="ghost"><a href={contacts.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram da Tia Val"><Instagram /><span>Instagram</span></a></Button>}
    <Button asChild><a href={contacts.whatsapp || contacts.phone} target={contacts.whatsapp ? '_blank' : undefined} rel={contacts.whatsapp ? 'noopener noreferrer' : undefined}>{contacts.whatsapp ? <MessageCircle /> : <Phone />}<span>{contacts.whatsapp ? 'WhatsApp' : 'Falar com a Tia Val'}</span></a></Button>
  </nav>;
}