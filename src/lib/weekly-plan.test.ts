import { describe, expect, it } from 'vitest';
import {
  PLAN_DAYS,
  dishForDateKey,
  encodePlanNotes,
  buildPlanPreferenceItems,
  nextPlanDays,
  parsePlanNotes,
  planDeliveredCount,
  planDeliveryTotal,
  planPrice,
} from '@/lib/weekly-plan';

describe('preços oficiais do Plano 7 Dias', () => {
  it('Completa Pequena com Coca custa R$ 130', () => {
    expect(planPrice('pequena', true)).toBe(130);
  });
  it('Completa Grande com Coca custa R$ 150', () => {
    expect(planPrice('grande', true)).toBe(150);
  });
  it('sem a Coca desconta R$ 35 (7 latas × R$ 5)', () => {
    expect(planPrice('pequena', false)).toBe(95);
    expect(planPrice('grande', false)).toBe(115);
  });
});

describe('frete do plano', () => {
  it('dentro do Primeiro de Maio (até 1 km) é grátis nos 7 dias', () => {
    expect(planDeliveryTotal(0.8)).toBe(0);
    expect(planDeliveryTotal(1)).toBe(0);
  });
  it('fora do bairro cobra R$ 1,50/km excedente por dia, vezes 7', () => {
    // 3 km de rota: 2 km fora do bairro × R$ 1,50 = R$ 3/dia → R$ 21 no plano
    expect(planDeliveryTotal(3)).toBe(21);
  });
  it('prepara os itens de preferência com preço do plano e todos os fretes', () => {
    const items = buildPlanPreferenceItems('grande', true, planDeliveryTotal(3));
    expect(items).toHaveLength(2);
    expect(items[0]?.unit_price).toBe(150);
    expect(items[1]?.unit_price).toBe(21);
    expect(items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)).toBe(171);
  });
  it('não cria item de frete quando as sete entregas são gratuitas', () => {
    expect(buildPlanPreferenceItems('pequena', false, 0)).toEqual([
      expect.objectContaining({ id: 'plano-7-dias', unit_price: 95 }),
    ]);
  });
});

describe('calendário do plano', () => {
  it('só oferece dias de segunda a sábado (nunca domingo)', () => {
    const days = nextPlanDays(14, new Date('2026-11-06T15:00:00-03:00'));
    expect(days).toHaveLength(14);
    for (const key of days) {
      expect(new Date(`${key}T12:00:00-03:00`).getDay()).not.toBe(0);
    }
  });
  it('todo dia útil tem um prato fixo do cardápio semanal', () => {
    for (const key of nextPlanDays(7, new Date('2026-11-06T15:00:00-03:00'))) {
      expect(dishForDateKey(key)?.name).toBeTruthy();
    }
  });
});

describe('metadados do plano em orders.notes', () => {
  const meta = { sizeId: 'grande' as const, withCoke: true, dates: nextPlanDays(PLAN_DAYS), window: '11h às 12h' as const, perDayFee: 0 };
  it('grava e lê sem perder nada', () => {
    expect(parsePlanNotes(encodePlanNotes(meta))).toEqual(meta);
  });
  it('pedidos comuns (sem o prefixo) não são plano', () => {
    expect(parsePlanNotes(null)).toBeNull();
    expect(parsePlanNotes('sem cebola')).toBeNull();
  });
  it('conta as entregas já vencidas (mínimo 1, máximo 7)', () => {
    const done = planDeliveredCount(meta, new Date('2099-01-01T12:00:00-03:00'));
    expect(done).toBe(PLAN_DAYS);
  });
});
