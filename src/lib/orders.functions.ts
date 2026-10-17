// Orders functions - lógica de criação e processamento de pedidos

import { db } from '@/lib/db';
import { sendFacebookServerEvent } from '../lib/facebook-capi.server';

/**
 * Verifica se um pedido já foi processado (evita duplicatas)
 * @param orderCode Código do pedido
 * @returns true se o pedido já foi processado
 */
async function isOrderProcessed(orderCode: string): boolean {
  const result = await db.query(
    'SELECT COUNT(*) as count FROM orders WHERE code = ? AND status IN ('pago', 'concluido')',
    [orderCode]
  );
  return result.rowCount > 0;
}

/**
 * Processa o pedido e dispara o evento CAPI de Purchase
 * @param order Objeto com dados do pedido
 * @returns Resultado da operação
 */
async function createOrder(order: {
  code: string;
  total: number;
  customer: {
    name: string;
    phone: string;
  };
  fulfillment: 'entrega' | 'retirada';
  distanceKm?: number;
}): Promise<{ code: string; purchaseUrl?: string }> {
  // Evita duplicação
  if (isOrderProcessed(order.code)) {
    console.warn(`Pedido ${order.code} já foi processado. Ignorando.`);
    return { code: order.code };
  }

  // Marca como pago temporariamente
  await db.query(
    'UPDATE orders SET status = ? WHERE code = ?',
    ['pago', order.code]
  );

  // Dispara evento CAPI de Purchase
  try {
    await sendFacebookServerEvent({
      eventName: 'Purchase',
      eventId: order.code,
      order: order,
      req: undefined,
    });
  } catch (error) {
    console.error(`Falha ao enviar evento Purchase para pedido ${order.code}:`, error);
    // Continua mesmo com erro no Facebook, mas marca como processado
  }

  // Cria o pedido no banco
  await db.query(
    `INSERT INTO orders (
      code, total, customer, fulfillment, distanceKm, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [order.code, order.total, order.customer, order.fulfillment, order.distanceKm, 'pago']
  );

  // Dispara evento CAPI de InitiateCheckout
  try {
    await sendFacebookServerEvent({
      eventName: 'InitiateCheckout',
      eventId: order.code,
      order: order,
      req: undefined,
    });
  } catch (error) {
    console.error(`Falha ao enviar evento InitiateCheckout para pedido ${order.code}:`, error);
  }

  return { code: order.code };
}

/**
 * Verifica se o pagamento foi aprovado via Pix
 * @param order Código do pedido
 * @returns true se o pagamento foi aprovado
 */
async function checkPixPayment(orderCode: string): Promise<boolean> {
  const result = await db.query(
    'SELECT status FROM payments WHERE id = ?',
    [orderCode]
  );
  return result.rowCount > 0 && result.rows[0].status === 'aprovado';
}

/**
 * Atualiza o status do pedido para concluído
 * @param orderCode Código do pedido
 * @returns true se a atualização foi bem-sucedida
 */
async function updateOrderStatusToCompleted(orderCode: string): Promise<boolean> {
  const result = await db.query(
    'UPDATE orders SET status = ? WHERE code = ?',
    ['concluido', orderCode]
  );
  return result.rowCount > 0;
}
