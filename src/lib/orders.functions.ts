// Orders functions - lógica de criação e processamento de pedidos

import { sendFacebookServerEvent } from './facebook-capi.server.ts';

/**
 * Processa o pedido e dispara o evento CAPI de InitiateCheckout
 * @param order Objeto com dados do pedido
 * @param req Objeto de requisição para obter IP e user-agent
 */
export async function createOrder(order: {
  code: string;
  total: number;
  customer: { name: string; phone: string };
  fulfillment: 'entrega' | 'retirada';
  distanceKm?: number;
}, req?: Request) {
  // Dispara evento CAPI de InitiateCheckout ao registrar o pedido
  try {
    await sendFacebookServerEvent({
      eventName: 'InitiateCheckout',
      eventId: order.code,
      order,
      req,
    });
  } catch (error) {
    console.error(`Falha ao enviar evento InitiateCheckout para pedido ${order.code}:`, error);
    // Não lançamos erro para não quebrar o fluxo
  }

  return { code: order.code };
}

/**
 * Dispara evento CAPI de Purchase quando pagamento Pix for aprovado
 * @param orderCode Código do pedido
 * @param order Dados do pedido
 * @param req Objeto de requisição para obter IP e user-agent
 */
export async function checkPixPayment(orderCode: string, order: {
  code: string;
  total: number;
  customer: { name: string; phone: string };
  fulfillment: 'entrega' | 'retirada';
}, req?: Request): Promise<boolean> {
  try {
    await sendFacebookServerEvent({
      eventName: 'Purchase',
      eventId: orderCode,
      order,
      req,
    });
    return true;
  } catch (error) {
    console.error(`Falha ao enviar evento Purchase para pedido ${orderCode}:`, error);
    return false;
  }
}

/**
 * Atualiza status do pedido para concluído e dispara Purchase via CAPI
 * @param orderCode Código do pedido
 * @param order Dados do pedido
 * @param req Objeto de requisição para obter IP e user-agent
 */
export async function updateOrderStatusToCompleted(orderCode: string, order: {
  code: string;
  total: number;
  customer: { name: string; phone: string };
}, req?: Request): Promise<boolean> {
  try {
    await sendFacebookServerEvent({
      eventName: 'Purchase',
      eventId: orderCode,
      order,
      req,
    });
    return true;
  } catch (error) {
    console.error(`Falha ao enviar evento Purchase para pedido ${orderCode}:`, error);
    return false;
  }
}
