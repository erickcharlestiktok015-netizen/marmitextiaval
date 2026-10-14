import { describe, expect, it } from 'vitest';
import { calculateTotals, deliveryFeeForKm } from './orders';

describe('pedido', () => {
  it('cobra R$1 por km, arredondando pra cima', () => {
    expect(deliveryFeeForKm(3.2)).toBe(4);
    expect(deliveryFeeForKm(0.4)).toBe(1);
  });
  it('soma marmitas + entrega', () => {
    const t = calculateTotals([{ name: 'Tropeiro', sizeLabel: 'Só tropeiro grande', unitPrice: 25, quantity: 2 }], 'entrega', 5);
    expect(t).toEqual({ subtotal: 50, deliveryFee: 5, total: 55 });
  });
  it('retirada não cobra entrega', () => {
    expect(calculateTotals([{ name: 'X', sizeLabel: 'P', unitPrice: 16, quantity: 1 }], 'retirada', 5).total).toBe(16);
  });
});
