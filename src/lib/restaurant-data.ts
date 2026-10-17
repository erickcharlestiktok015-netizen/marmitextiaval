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

// Foto do prato novo (arroz, feijão, salpicão e frango assado).
const photoFrangoSalpicao = 'https://id-preview--e76ff772-d67c-44fc-990c-3e212e1c0cb4.lovable.app/__l5e/assets-v1/6fba9cfc-5df9-4004-b83c-1bb32c1e3faa/frango-salpicao.jpg';

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

// Pratos do dia na ordem em que aparecem no site: feijoada primeiro, depois o caseirinho.
// "Só feijoada" (sem acompanhamentos) custa 20 (pequena) e 25 (grande); a completa é preço normal.
export const meals: Meal[] = [
  {
    id: 'feijoada',
    name: 'Feijoada',
    description: 'Feijoada encorpada, cheia de sabor e carinho.',
    image: assetUrl(photoFeijoada.url),
    badge: 'O mais pedido',
    sizes: [
      { id: 'pequena', label: 'Completa pequena · 500ml', price: 16 },
      { id: 'grande', label: 'Completa grande · 750ml', price: 18 },
      { id: 'so-pequena', label: 'Só feijoada pequena · 500ml', price: 20 },
      { id: 'so-grande', label: 'Só feijoada grande · 750ml', price: 25 },
    ],
  },
  {
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
  },
];
export const feijoadaPhotoUrl = assetUrl(photoFeijoada.url);
// Pratos que saem amanhã: o frango assado com salpicão e o caseirinho, que sai todo dia — amanhã também.
export type TomorrowDish = { id: string; name: string; description: string; badge: string; image?: string; video?: string; poster?: string };
export const tomorrowDishes: TomorrowDish[] = [
  { id: 'frango-amanha', name: 'Arroz, feijão, salpicão e frango assado', description: 'Frango assado douradinho com salpicão cremoso, arroz e feijão.', badge: 'Amanhã', image: photoFrangoSalpicao },
  { id: 'caseirinho-amanha', name: 'Arroz, feijão, macarronada e linguiça', description: 'Sai todo dia, amanhã também. O clássico completo, do jeitinho de casa.', badge: 'Todo dia', video: assetUrl(videoCaseirinho.url), poster: assetUrl(posterCaseirinho.url) },
];
// Opções para reservar amanhã.
export const tomorrowMenu: { id: string; name: string; sizes: MealSize[] }[] = [
  { id: 'frango-salpicao', name: 'Arroz, feijão, salpicão e frango assado', sizes: [
    { id: 'pequena', label: 'Pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Grande · 750ml', price: 18 },
  ] },
  { id: 'caseirinho', name: 'Arroz, feijão, macarronada e linguiça', sizes: meals[1]!.sizes },
];
// Coordenadas da cozinha (Rua Padre Cyr Assumpção, 289 — Primeiro de Maio, BH).
export const restaurantLocation = { lat: -19.862767, lng: -43.929967 };
export const deliveryFeePerKm = 1.5; // R$1,50 por km de motoboy.
export const formatPrice = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const openingHours = { weekdays: 'Segunda a sábado · 11h às 14h', sunday: 'Domingo · fechado' };
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
