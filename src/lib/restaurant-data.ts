import mealBeef from '@/assets/meal-beef.jpg';
import mealChicken from '@/assets/meal-chicken.jpg';

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

// Pratos do dia na ordem em que aparecem no site: tropeiro primeiro, depois o caseirinho.
export const meals: Meal[] = [
  {
    id: 'tropeiro',
    name: 'Feijão Tropeiro',
    description: 'Tropeiro caprichado com torresmo, couve e ovo.',
    image: mealBeef,
    badge: 'O mais pedido',
    sizes: [
      { id: 'pequena', label: 'Completa pequena · 500ml', price: 16 },
      { id: 'grande', label: 'Completa grande · 750ml', price: 18 },
      { id: 'so-pequena', label: 'Só tropeiro pequena · 500ml', price: 20 },
      { id: 'so-grande', label: 'Só tropeiro grande · 750ml', price: 25 },
    ],
  },
  {
    id: 'caseirinho',
    name: 'Arroz, feijão, macarronada e linguiça',
    description: 'O clássico completo, do jeitinho de casa.',
    image: mealChicken,
    badge: null,
    sizes: [
      { id: 'pequena', label: 'Pequena · 500ml', price: 16 },
      { id: 'grande', label: 'Grande · 750ml', price: 18 },
    ],
  },
];
export const feijoadaPhotoUrl = mealBeef;

// Pratos que saem amanhã: a feijoada e o caseirinho.
export type TomorrowDish = { id: string; name: string; description: string; badge: string; image?: string; video?: string; poster?: string };
export const tomorrowDishes: TomorrowDish[] = [
  { id: 'feijoada-amanha', name: 'Feijoada', description: 'Feijoada encorpada, cheia de sabor e carinho.', badge: 'Amanhã', image: mealBeef },
  { id: 'caseirinho-amanha', name: 'Arroz, feijão, macarronada e linguiça', description: 'Sai todo dia, amanhã também. O clássico completo, do jeitinho de casa.', badge: 'Todo dia', image: mealChicken },
];
// Opções para reservar amanhã (mesma regra de preço: completa 16/18, só feijoada 20/25).
export const tomorrowMenu: { id: string; name: string; sizes: MealSize[] }[] = [
  { id: 'feijoada', name: 'Feijoada', sizes: [
    { id: 'pequena', label: 'Completa pequena · 500ml', price: 16 },
    { id: 'grande', label: 'Completa grande · 750ml', price: 18 },
    { id: 'so-pequena', label: 'Só feijoada pequena · 500ml', price: 20 },
    { id: 'so-grande', label: 'Só feijoada grande · 750ml', price: 25 },
  ] },
  { id: 'caseirinho', name: 'Arroz, feijão, macarronada e linguiça', sizes: meals[1]!.sizes },
];
// Coordenadas da cozinha (Rua Padre Cyr Assumpção, 289 — Primeiro de Maio, BH).
export const restaurantLocation = { lat: -19.862767, lng: -43.929967 };
export const deliveryFeePerKm = 1; // R$1 por km de motoboy.
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
  whatsapp: null as string | null,
  instagram: null as string | null,
};
export const reviews = [
  { name: 'Deise Campos', quote: 'Ótima comida muito bem temperada feita com muito amor e carinho melhor da região toda.', initial: 'D' },
  { name: 'Ada Gomes', quote: 'Comida muito boa, bem feita, caseira de verdade, atendimento maravilhoso! Parabéns Val!!! Mãos de Ouro na Comida!!!', initial: 'A' },
  { name: 'Rodrigo Mendes', quote: 'Desde o atendimento até a entrega tudo perfeito. Comida chegou quentinha e o tempero bem gostoso. Parabéns Val.', initial: 'R' },
];
export const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Marmitex da tia val Rua Padre Cyr Assumpção 289 Belo Horizonte');
