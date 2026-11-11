// Regras de qual entrega o motoboy vê no mapa e quando a rota aparece.
type RouteOrder = { id: string; order_status: string };

export const isRouteableStatus = (status: string) => ['pronto_entrega', 'saiu_entrega'].includes(status);

/** Entrega em foco: a escolhida pelo motoboy; senão a primeira em rota; senão a primeira pronta; senão a primeira da fila. */
export function pickRouteOrder<T extends RouteOrder>(orders: T[], selectedId: string | null): T | null {
  if (selectedId) {
    const found = orders.find((o) => o.id === selectedId);
    if (found) return found;
  }
  return (
    orders.find((o) => o.order_status === 'saiu_entrega') ||
    orders.find((o) => o.order_status === 'pronto_entrega') ||
    orders[0] ||
    null
  );
}

/** A rota aparece sozinha assim que o pedido fica pronto ou sai para entrega, ou quando o motoboy toca em "Ver rota". */
export function shouldShowRoute(order: RouteOrder | null, routeActiveFor: string | null): boolean {
  if (!order) return false;
  return isRouteableStatus(order.order_status) || routeActiveFor === order.id;
}
