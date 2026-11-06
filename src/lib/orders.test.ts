import { describe, expect, it } from 'vitest';
import { calculateTotals, deliveryFeeForKm } from './orders';

describe('taxa de entrega', () => {
  it('não cobra os km dentro do Primeiro de Maio', () => {
    expect(deliveryFeeForKm(0.8)).toBe(0);
    expect(deliveryFeeForKm(1)).toBe(0);
  });
  it('cobra R$ 1,50 por km só depois do bairro', () => {
    expect(deliveryFeeForKm(3.2)).toBe(3.3);
  });
  it('soma entrega ao subtotal', () => {
    const t = calculateTotals([{ name: 'Tropeiro', sizeLabel: 'Só tropeiro grande', unitPrice: 25, quantity: 2 }], 'entrega', 5);
    expect(t).toEqual({ subtotal: 50, deliveryFee: 6, total: 56 });
  });
  it('retirada não tem taxa', () => {
    expect(calculateTotals([{ name: 'X', sizeLabel: 'P', unitPrice: 16, quantity: 1 }], 'retirada', 5).total).toBe(16);
  });
});
