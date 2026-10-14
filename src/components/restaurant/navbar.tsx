import { useState } from 'react';
import { Heart, Menu, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const links = [['Início', '#inicio'], ['Nossa cozinha', '#horarios'], ['Pratos do dia', '#pratos'], ['Como pedir', '#como-pedir']];
export function Navbar() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="nav-inner page-width">
    <a href="#inicio" className="brand" aria-label="Marmitex da Tia Val, início"><Heart className="brand-heart" /><span>Marmitex <em>da Tia Val</em></span></a>
    <nav className="desktop-nav" aria-label="Principal">{links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</nav>
    <Button asChild className="nav-call" variant="outline"><a href="tel:+553134454042"><Phone /> Fale com a Tia Val <Arrow /></a></Button>
    <Button className="menu-toggle" variant="ghost" size="icon" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
  </div>{open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Menu celular">{links.map(([label, href]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}<a href="tel:+553134454042"><Phone size={16} /> (31) 3445-4042</a></nav>}</header>;
}
function Arrow() { return <span aria-hidden="true">↗</span>; }