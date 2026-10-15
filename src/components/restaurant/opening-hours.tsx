import { useEffect, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { isRestaurantOpen, mapsUrl, openingHours } from '@/lib/restaurant-data';

export function OpeningHours() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOpen(isRestaurantOpen());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <section id="horarios" className="section opening-section">
    <div className="page-width opening-layout reveal">
      <div><p className="eyebrow"><Clock size={15} /> A HORA MAIS GOSTOSA DO DIA</p><h2>Dois clássicos.<br /><em>Todo dia, carinho.</em></h2><p className="opening-description">O almoço da Tia Val tem sempre dois pratos clássicos do dia. Comida caseira, feita com amor, aqui no Primeiro de Maio.</p></div>
      <div className="opening-info">
        <span role="status" className={`store-status${open ? ' is-open' : ''}`}><span className="status-dot" />{open === null ? 'Consultando horário…' : open ? 'Aberto agora' : 'Fechado agora'}</span>
        <h3>Hora do almoço</h3><p>{openingHours.weekdays}</p><p>{openingHours.sunday}</p><small>Horário de Belo Horizonte</small>
        <a className="opening-address" href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={17} /><span>Rua Padre Cyr Assumpção, 289<br />Primeiro de Maio · Belo Horizonte</span></a>
      </div>
    </div>
  </section>;
}