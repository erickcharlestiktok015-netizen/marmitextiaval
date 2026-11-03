import { describe, expect, it } from 'vitest';
import { calculateTotals, deliveryFeeForKm } from './orders';

describe('pedido', () => {
  it('cobra R$1,50 por km', () => {
    expect(deliveryFeeForKm(3.2)).toBe(4.8);
    expect(deliveryFeeForKm(0.4)).toBe(0.6);
  });
  it('soma marmitas + entrega', () => {
    const t = calculateTotals([{ name: 'Tropeiro', sizeLabel: 'Só tropeiro grande', unitPrice: 25, quantity: 2 }], 'entrega', 5);
    expect(t).toEqual({ subtotal: 50, deliveryFee: 7.5, total: 57.5 });
  });
  it('retirada não cobra entrega', () => {
    expect(calculateTotals([{ name: 'X', sizeLabel: 'P', unitPrice: 16, quantity: 1 }], 'retirada', 5).total).toBe(16);
  });
});
