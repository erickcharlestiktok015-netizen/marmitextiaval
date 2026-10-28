import videoCaseirinho from '@/assets/video-caseirinho.mp4.asset.json';
import posterCaseirinho from '@/assets/poster-caseirinho.jpg.asset.json';
import photoFeijoada from '@/assets/feijoada.jpg.asset.json';
import videoTropeiro from '@/assets/video-tropeiro.mp4.asset.json';
import posterTropeiro from '@/assets/poster-tropeiro.jpg.asset.json';

export type MealSize = { id: string; label: string; price: number };
export type Meal = {
  id: string;
  name: string;
  description: string;
  video?: string;
  poster?: string;
  image?: string;
  badge: string | null;
  sizes: MealSize[];
};

const assetUrl = (url: string) => new URL(url, 'https://tia-val-eats-digital.lovable.app').toString();

// Vídeos novos da feijoada e do frango assado com salpicão (hospedados no CDN do Lovable).
const mediaHost = 'https://id-preview--2fff413a-7193-4dd0-902d-b541fb31df57.lovable.app';
const videoFeijoada = mediaHost + '/__l5e/assets-v1/50a063a6-4b19-4e13-950c-6ed6fa010c94/feijoada.mp4';
const posterFeijoada = mediaHost + '/__l5e/assets-v1/98c44e2a-0001-4869-82f4-a205f7d70d2f/poster-feijoada.jpg';
const videoFrangoSalpicao = mediaHost + '/__l5e/assets-v1/332c95e8-4614-4a3e-9782-e974ad8a8ee8/frango-salpicao.mp4';
const posterFrangoSalpicao = mediaHost + '/__l5e/assets-v1/edba03dc-06bc-4e3e-8619-bf461af5e6e0/poster-frango.jpg';

// Tropeiro fora do cardápio temporariamente. Para voltar, recoloque este item no início de `meals`.
export const tropeiroMeal: Meal = {
  id: 'tropeiro',
  name: 'Feijão Tropeiro',
  description: 'Tropeiro caprichado com torresmo, couve e ovo.',
  video: assetUrl(videoTropeiro.url),
  poster: assetUrl(posterTropeiro.url),
  badge: 'O mais pedido',
  sizes: [
    { id: 'pequena', label: 'Completa pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Completa grande · 750ml', price: 18 },
    { id: 'so-pequena', label: 'Só tropeiro pequena · 500ml', price: 20 },
    { id: 'so-grande', label: 'Só tropeiro grande · 750ml', price: 25 },
  ],
};

// Caseirinho: nos pratos do dia e em "Pratos de amanhã".
export const caseirinhoMeal: Meal = {
  id: 'caseirinho',
  name: 'Arroz, feijão, macarronada e linguiça',
  description: 'O clássico completo, do jeitinho de casa.',
  video: assetUrl(videoCaseirinho.url),
  poster: assetUrl(posterCaseirinho.url),
  badge: null,
  sizes: [
    { id: 'pequena', label: 'Pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Grande · 750ml', price: 18 },
  ],
};

// Vídeos novos (frango com quiabo e strogonoff).
const novoHost = 'https://id-preview--514ffa97-f293-4acf-afff-b74c58c15c56.lovable.app/__l5e/assets-v1/';
export const frangoQuiaboMeal: Meal = {
  id: 'frango-quiabo',
  name: 'Frango com quiabo',
  description: 'Frango caipira ensopado com quiabo, do jeitinho mineiro.',
  video: novoHost + '6dee4917-c2da-4580-a00c-0943867491d0/frango-quiabo.mp4',
  poster: novoHost + 'fdbb88e7-58b7-481f-877f-d1795d010a25/poster-frango-quiabo.jpg',
  badge: 'O mais pedido',
  sizes: [
    { id: 'pequena', label: 'Pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Grande · 750ml', price: 18 },
  ],
};
export const strogonoffMeal: Meal = {
  id: 'strogonoff',
  name: 'Strogonoff',
  description: 'Strogonoff cremoso, com arroz soltinho e batata palha.',
  video: novoHost + '4edafc47-2031-459a-a011-e53af21d3ff2/strogonoff.mp4',
  poster: novoHost + '10daedcf-920f-4b0c-a238-325e16dec0c3/poster-strogonoff.jpg',
  badge: null,
  sizes: [
    { id: 'pequena', label: 'Pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Grande · 750ml', price: 18 },
  ],
};

// Feijoada fora do cardápio por enquanto (reserva). Para voltar, recoloque em `meals`.
export const feijoadaMeal: Meal = {
  id: 'feijoada',
  name: 'Feijoada',
  description: 'Feijoada completa, com couve, laranja e torresmo.',
  video: videoFeijoada,
  poster: posterFeijoada,
  badge: 'O mais pedido',
  sizes: caseirinhoMeal.sizes,
};
// Pratos do dia de hoje: frango com quiabo e strogonoff.
export const meals: Meal[] = [
  frangoQuiaboMeal,
  strogonoffMeal,
];
export const feijoadaPhotoUrl = assetUrl(photoFeijoada.url);
// Pratos de amanhã: só o caseirinho (arroz, feijão, macarronada e linguiça).
export type TomorrowDish = { id: string; name: string; description: string; badge: string; image?: string | undefined; video?: string | undefined; poster?: string | undefined };
export const tomorrowDishes: TomorrowDish[] = [
  { id: 'caseirinho-amanha', name: caseirinhoMeal.name, description: caseirinhoMeal.description, badge: 'Amanhã', video: caseirinhoMeal.video, poster: caseirinhoMeal.poster },
];
// Opções para reservar amanhã.
export const tomorrowMenu: { id: string; name: string; sizes: MealSize[] }[] = [
  { id: 'caseirinho', name: caseirinhoMeal.name, sizes: caseirinhoMeal.sizes },
];
// Coordenadas da cozinha (Rua Padre Cyr Assumpção, 289 — Primeiro de Maio, HH).
export const restaurantLocation = { lat: -19.862767, lng: -43.929967 };
export const deliveryFeePerKm = 1.5; // R$1,50 por km de motoboye.
export const formatPrice = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const openingHours = { weekdays: 'Segunda a sábado · 11h Às 14h', sunday: 'Domingo · fechado' };
export function isRestaurantOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const minutes = Number(value('hour')) * 60 + Number(value('minute'));
  return value('weekday') !== 'Sun' && minutes >= 660 && minutes < 840;
}
// Only verified contact destinations belong here. Never derive WhatsApp from a landline.
export const contacts = {
  phone: 'tel:+553134454042',
  phoneLabel: '(31) 3445-4042',
  whatsapp: 'https://wa.me/553134454042' as string | null,
  instagram: 'https://www.instagram.com/marmitexdatiaval/' as string | null,
};
export const reviews = [
  { name: 'Deise Campos', quote: 'Ótima comida muito bem temperada feita com muito amor e carinho melhor da região toda.', initial: 'D' },
  { name: 'Ada Gomes', quote: 'Comida muito boa, bem feita, caseira de verdade, atendimento maravilhoso! Parabéns Val!!! Mãos de Ouro na Comida!!!', initial: 'A' },
  { name: 'Rodrigo Mendes', quote: 'Desde o atendimento até a entrega tudo perfeito. Comida chegou quentinha e o tempero bem gostoso. Parabéns Val.', initial: 'R' },
];
export const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Marmitex da tia val Rua Padre Cyr Assumpção 289 Belo Horizonte');
