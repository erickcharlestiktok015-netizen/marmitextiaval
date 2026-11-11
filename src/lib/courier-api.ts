import { fetchPendingDeliveries } from '@/routes/api/courier/orders';

export { fetchPendingDeliveries };

export async function updateDeliveryStatus(code: string, status: 'accepted' | 'collected' | 'delivered') {
  return { success: true, code, status };
}
