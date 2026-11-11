import { describe, expect, it } from 'vitest';
import { pickRouteOrder, shouldShowRoute } from './courier-route';

describe('rota do motoboy', () => {
  it('mostra a rota quando a cozinha marca pronto para entrega', () => {
    expect(shouldShowRoute({ id: 'a', order_status: 'pronto_entrega' }, null)).toBe(true);
  });
  it('mostra a rota quando o pedido está em rota', () => {
    expect(shouldShowRoute({ id: 'a', order_status: 'saiu_entrega' }, null)).toBe(true);
  });
  it('não mostra rota sozinha para pedido ainda em preparo', () => {
    expect(shouldShowRoute({ id: 'a', order_status: 'preparando' }, null)).toBe(false);
  });
  it('prioriza o pedido pronto sobre os em preparo', () => {
    const orders = [{ id: 'p', order_status: 'preparando' }, { id: 'r', order_status: 'pronto_entrega' }];
    expect(pickRouteOrder(orders, null)?.id).toBe('r');
  });
  it('respeita a entrega escolhida pelo motoboy', () => {
    const orders = [{ id: 'r', order_status: 'pronto_entrega' }, { id: 'p', order_status: 'preparando' }];
    expect(pickRouteOrder(orders, 'p')?.id).toBe('p');
  });
});
