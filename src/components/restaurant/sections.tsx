import { ArrowUpRight, Heart, ChefHat, Utensils, Phone, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapsUrl, reviews, openingHours, tomorrowDishes } from '@/lib/restaurant-data';
import { ReserveTomorrowButton } from './reserve-dialog';

export function BrandValues() {
  return <div className="values-band"><div className="page-width values-inner">{[{ icon: ChefHat, title: 'Tempero de casa', subtitle: 'O gostinho que a gente conhece.' }, { icon: Heart, title: 'Feita com carinho', subtitle: 'Amor em cada refeição.' }, { icon: Utensils, title: 'Para o seu dia a dia', subtitle: 'Seu almoço, com sabor de casa.' }].map(({ icon: Icon, title, subtitle }) => <div className="value-item" key={title}><Icon /><div><strong>{title}</strong><p>{subtitle}</p></div></div>)}</div></div>;
}
export function Promotions() {
  return <section id="promocoes" className="section promotions-section"><div className="page-width reveal">
    <div className="tomorrow-head"><p className="eyebrow">NOVIDADES · PRÓXIMO DIA</p><h2>Pratos de<br /><em>amanhã.</em></h2><p>Já vai se programando e reserve a sua!</p></div>
    <div className="tomorrow-grid">{tomorrowDishes.map((dish, index) => <article key={dish.id} className={`tomorrow-card${index === 0 ? ' is-next' : ''}`}>
      <span className="tomorrow-badge">{dish.badge}</span>
      {dish.video
        ? <video className="tomorrow-media" src={dish.video} poster={dish.poster} autoPlay muted loop playsInline preload="metadata" aria-label={dish.name + ' — vídeo ilustrativo'} onCanPlay={event => { event.currentTarget.play().catch(() => {}); }} />
        : <img className="tomorrow-media" src={dish.image} alt={dish.name} loading="lazy" />}
      <div className="tomorrow-dish"><span className="tomorrow-num">0{index + 1}</span><div><h3>{dish.name}</h3><p>{dish.description}</p></div></div>
    </article>)}</div>
    <ReserveTomorrowButton />
  </div></section>;
}
export function Reviews() {
  return <section id="avaliacoes" className="section reviews-section"><div className="page-width"><div className="section-heading reveal"><div><p className="eyebrow">QUEM PROVOU, CONTA</p><h2>Carinho que volta<br /><em>em palavras.</em></h2></div><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="google-rating"><span className="google-letter">G</span><div><strong>4,9 <span className="stars">★★★★★</span></strong><p>50 avaliações no Google <ArrowUpRight size={13} /></p></div></a></div><div className="reviews-grid">{reviews.map(review => <article key={review.name} className="review-card reveal"><div className="stars" aria-label="5 estrelas">★★★★★</div><blockquote>“{review.quote}”</blockquote><div className="review-author"><span>{review.initial}</span><div><strong>{review.name}</strong><small>Avaliação no Google</small></div><span className="review-google">G</span></div></article>)}</div><p className="review-source">Avaliações reproduzidas do material do Google Maps enviado pela loja.</p></div></section>;
}
export function HowToOrder() {
  return <section id="como-pedir" className="section order-section"><div className="page-width"><div className="order-heading reveal"><p className="eyebrow">DO NOSSO FOGÃO PARA SUA MESA</p><h2>Seu almoço, <em>sem complicação.</em></h2></div><div className="steps-grid">{[['Confira os pratos', 'Consulte com a Tia Val o que está saindo da cozinha hoje.'], ['Escolha sua refeição', 'Veja os acompanhamentos e confirme o valor do seu prato.'], ['Fale com a Tia Val', 'Combine seu pedido, retirada ou entrega pelo telefone.']].map(([title, description], index) => <div className="order-step reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></div>)}</div><div className="contact-band reveal"><div><Heart /><span>Hoje tem comida com carinho.<strong>Vamos conversar?</strong></span></div><Button asChild size="lg"><a href="tel:+553134454042"><Phone /> (31) 3445-4042 <ArrowUpRight /></a></Button></div><p className="demo-note">Agora dá pra fazer o pedido pelo site. Pagamento online chega em breve.</p></div></section>;
}
export function Footer() {
  return <footer className="site-footer"><div className="page-width footer-main"><div><a href="#inicio" className="brand footer-brand"><Heart className="brand-heart" /><span>Marmitex <em>da Tia Val</em></span></a><p className="footer-slogan">COMIDA CASEIRA FEITA COM AMOR</p><p>Um pedacinho de casa no seu dia.</p></div><div><h3>Venha nos encontrar</h3><a href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={17} /><span>Rua Padre Cyr Assumpção, 289<br />Primeiro de Maio · Belo Horizonte, MG<br />CEP 31810-600</span></a></div><div><h3>Fale com a gente</h3><a href="tel:+553134454042"><Phone size={16} />(31) 3445-4042</a><p className="footer-hours"><Clock size={16} /><span>{openingHours.weekdays}<br />{openingHours.sunday}</span></p><a href={mapsUrl} target="_blank" rel="noopener noreferrer">Ver no Google Maps <ArrowUpRight size={15} /></a></div></div><div className="page-width footer-bottom"><span>© {new Date().getFullYear()} Marmitex da Tia Val</span><span>Feito com carinho, como a nossa comida. <Heart size={12} /></span></div></footer>;
}
