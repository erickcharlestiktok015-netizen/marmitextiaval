// Plano 7 Dias: 7 marmitas + 7 bebidas, com agendamento de seg a sáb.
// Os preços oficiais vivem aqui e são validados também no servidor (orders.functions.ts).
import { deliveryFeeForKm, type SubmitResult } from '@/lib/orders';

export type PlanSizeId = 'pequena' | 'grande';
export type PlanSize = {
  id: PlanSizeId;
  label: string;
  volume: string;
  priceWithCoke: number;
  priceWithoutCoke: number;
};

// Tabela oficial do Plano 7 Dias.
// Coca-Cola (normal ou zero) inclusa; sem a Coca, desconta R$ 5 por lata (7 × R$ 5 = R$ 35).
export const PLAN_DAYS = 7;
export const PLAN_COKE_DISCOUNT_PER_CAN = 5;
export const PLAN_COKE_DISCOUNT_TOTAL = PLAN_COKE_DISCOUNT_PER_CAN * PLAN_DAYS; // R$ 35

export const planSizes: PlanSize[] = [
  { id: 'pequena', label: 'Completa Pequena', volume: '500ml', priceWithCoke: 130, priceWithoutCoke: 95 },
  { id: 'grande', label: 'Completa Grande', volume: '750ml', priceWithCoke: 150, priceWithoutCoke: 115 },
];

export const planWindows = ['11h às 12h', '12h às 13h', '13h às 14h'] as const;
export type PlanWindow = (typeof planWindows)[number];

// Cardápio fixo da semana (segunda a sábado). Domingo a cozinha fecha.
// Pratos reais do cardápio da Tia Val; confirme a ordem dos dias com a cozinha.
export const weeklyMenu: Record<number, { name: string; description: string }> = {
  1: { name: 'Arroz, feijão, macarronada e linguiça', description: 'O clássico completo, do jeitinho de casa.' },
  2: { name: 'Frango com quiabo', description: 'Frango caipira ensopado com quiabo, do jeitinho mineiro.' },
  3: { name: 'Strogonoff', description: 'Strogonoff cremoso, com arroz soltinho e batata palha.' },
  4: { name: 'Feijão Tropeiro', description: 'Tropeiro caprichado com torresmo, couve e ovo.' },
  5: { name: 'Feijoada', description: 'Feijoada completa, com couve, laranja e torresmo.' },
  6: { name: 'Arroz, feijão, salpicão e frango assado', description: 'Frango assado douradinho com salpicão cremoso.' },
};

export const planPrice = (sizeId: PlanSizeId, withCoke: boolean): number => {
  const size = planSizes.find(s => s.id === sizeId);
  if (!size) throw new Error('Tamanho de plano inválido.');
  return withCoke ? size.priceWithCoke : size.priceWithoutCoke;
};

// Frete do plano: a taxa de um dia (km fora do Primeiro de Maio a R$ 1,50/km) vezes 7 entregas.
export const planDeliveryTotal = (km: number): number =>
  Math.round(deliveryFeeForKm(km) * PLAN_DAYS * 100) / 100;

// Mercado Pago recebe o plano e o frete total como itens separados; a soma deve bater com o total do pedido.
export function buildPlanPreferenceItems(sizeId: PlanSizeId, withCoke: boolean, deliveryFee: number) {
  const items = [
    { id: 'plano-7-dias', title: `Plano 7 Dias ${sizeId === 'pequena' ? 'Pequeno' : 'Grande'}${withCoke ? ' + 7 Coca-Cola' : ''}`, quantity: 1, unit_price: planPrice(sizeId, withCoke), currency_id: 'BRL' },
    ...(deliveryFee > 0 ? [{ id: 'frete-plano-7-dias', title: 'Fretes das 7 entregas', quantity: 1, unit_price: Math.round(deliveryFee * 100) / 100, currency_id: 'BRL' }] : []),
  ];
  return items;
}

const SP_TZ = 'America/Sao_Paulo';

// Data (AAAA-MM-DD) no fuso de Brasília.
export const spDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const parseKey = (key: string): Date => new Date(`${key}T12:00:00-03:00`);

// Próximos dias úteis para agendar (seg–sáb), a partir de amanhã, até juntar `count` dias.
export function nextPlanDays(count = 14, from = new Date()): string[] {
  const days: string[] = [];
  const cursor = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  while (days.length < count) {
    const key = spDateKey(cursor);
    const weekday = parseKey(key).getDay();
    if (weekday !== 0) days.push(key); // domingo fechado
    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

export const dishForDateKey = (key: string) => weeklyMenu[parseKey(key).getDay()] ?? null;

export const planDateLabel = (key: string): string => {
  const d = parseKey(key);
  const weekday = d.toLocaleDateString('pt-BR', { timeZone: SP_TZ, weekday: 'short' }).replace('.', '');
  const day = d.toLocaleDateString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit' });
  return `${weekday} ${day}`;
};

// Metadados do plano gravados em orders.notes (prefixo PLANO7: + JSON), sem mudar o schema.
export type PlanMeta = {
  sizeId: PlanSizeId;
  withCoke: boolean;
  dates: string[]; // 7 datas AAAA-MM-DD
  window: PlanWindow;
  perDayFee: number;
};

const PLAN_PREFIX = 'PLANO7:';

export const encodePlanNotes = (meta: PlanMeta): string => PLAN_PREFIX + JSON.stringify(meta);

export function parsePlanNotes(notes: string | null | undefined): PlanMeta | null {
  if (!notes || !notes.startsWith(PLAN_PREFIX)) return null;
  try {
    const raw = JSON.parse(notes.slice(PLAN_PREFIX.length)) as Partial<PlanMeta>;
    if (!raw || (raw.sizeId !== 'pequena' && raw.sizeId !== 'grande')) return null;
    if (!Array.isArray(raw.dates) || raw.dates.length !== PLAN_DAYS) return null;
    if (raw.dates.some(d => typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
    if (typeof raw.window !== 'string' || !(planWindows as readonly string[]).includes(raw.window)) return null;
    return {
      sizeId: raw.sizeId,
      withCoke: raw.withCoke !== false,
      dates: raw.dates as string[],
      window: raw.window as PlanWindow,
      perDayFee: typeof raw.perDayFee === 'number' ? raw.perDayFee : 0,
    };
  } catch {
    return null;
  }
}

// Quantas entregas do plano já deveriam ter acontecido até hoje (1 a 7).
export function planDeliveredCount(meta: PlanMeta, today = new Date()): number {
  const todayKey = spDateKey(today);
  const elapsed = meta.dates.filter(d => d <= todayKey).length;
  return Math.max(1, Math.min(PLAN_DAYS, elapsed));
}

export const planItemName = 'Plano 7 Dias — Marmita Completa';
export const planSizeLabel = (meta: Pick<PlanMeta, 'sizeId' | 'withCoke'>): string => {
  const size = planSizes.find(s => s.id === meta.sizeId)!;
  return `${size.label} · ${size.volume} · 7 marmitas${meta.withCoke ? ' + 7 Coca-Cola (normal ou zero)' : ' · sem bebida'}`;
};

// Envio do pedido do plano (a gravação real acontece no servidor, em orders.functions.ts).
export type PlanOrderInput = {
  sizeId: PlanSizeId;
  withCoke: boolean;
  dates: string[];
  window: PlanWindow;
  customer: { name: string; phone: string; email?: string | undefined };
  address: { cep: string; street: string; number: string; complement: string; bairro: string; latitude?: number | undefined; longitude?: number | undefined };
  distanceKm: number;
  payment: 'online' | 'entrega-pix' | 'entrega-dinheiro' | 'entrega-cartao';
  onlineMethod?: 'pix' | 'credit_card' | 'debit_card' | 'ticket' | 'account_money' | undefined;
  changeFor?: number | null;
};

export async function submitPlanOrder(input: PlanOrderInput): Promise<SubmitResult> {
  const { createPlanOrder } = await import('@/lib/orders.functions');
  return createPlanOrder({ data: input });
}
