import { useEffect, useState } from 'react';
import { Heart, Menu, Phone, X } from 'lucide-react';
import { isRestaurantOpen } from '@/lib/restaurant-data';
import { Button } from '@/components/ui/button';

const links = [['Início', '#inicio'], ['Nossa cozinha', '#horarios'], ['Pratos do dia', '#pratos'], ['Como pedir', '#como-pedir']];
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  useEffect(() => {
    const updateStatus = () => setStoreOpen(isRestaurantOpen());
    updateStatus();
    const timer = window.setInterval(updateStatus, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <header className="site-header"><div className="nav-inner page-width">
    <a href="#inicio" className="brand" aria-label="Marmitex da Tia Val, início"><Heart className="brand-heart" /><span>Marmitex <em>da Tia Val</em></span></a>
    <nav className="desktop-nav" aria-label="Principal">{links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</nav>
    <span role="status" aria-live="polite" className={`store-status nav-store-status${storeOpen ? ' is-open' : ''}`}><span className="status-dot" />{storeOpen ? 'Aberto agora' : 'Fechado agora'}</span>
    <Button asChild className="nav-call" variant="outline"><a href="tel:+553134454042"><Phone /> Fale com a Tia Val <Arrow /></a></Button>
    <Button className="menu-toggle" variant="ghost" size="icon" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
  </div>{open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Menu celular">{links.map(([label, href]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}<a href="tel:+553134454042"><Phone size={16} /> (31) 3445-4042</a></nav>}</header>;
}
function Arrow() { return <span aria-hidden="true">↗</span>; }