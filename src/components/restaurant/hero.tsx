import { ArrowDown, ArrowUpRight, Heart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollAnimation } from './scroll-animation';

export function Hero() {
  return <section id="inicio" className="hero" aria-labelledby="hero-title">
    <ScrollAnimation />
    <div className="hero-content page-width">
      <div className="hero-copy">
        <p className="eyebrow"><span className="small-line" /> BELO HORIZONTE · PRIMEIRO DE MAIO</p>
        <h1 id="hero-title">Marmitex<br /><span>da Tia Val</span><Heart className="hero-heart" aria-hidden="true" /></h1>
        <p className="hero-slogan">COMIDA CASEIRA FEITA COM AMOR</p>
        <p className="hero-description">Tempero de casa. Carinho em cada detalhe.<br />Aquela comida que abraça de verdade.</p>
      </div>
        <div className="hero-actions">
          <Button asChild size="lg"><a href="#pratos">Ver o cardápio <ArrowUpRight /></a></Button>
          <a className="hero-rating" href="#avaliacoes"><Star className="filled-star" /><strong>4,9</strong><span>no Google<br /><small>50 avaliações</small></span></a>
        </div>
    </div>
    <div className="hero-bottom page-width"><a href="#horarios" className="scroll-cue"><span className="scroll-icon"><ArrowDown size={14} /></span> DESÇA PARA CONHECER NOSSA COZINHA</a><span className="hero-location">DOIS CLÁSSICOS DO DIA · FEITOS COM AMOR</span></div>
  </section>;
}