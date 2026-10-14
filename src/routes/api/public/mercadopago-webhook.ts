import { createFileRoute } from '@tanstack/react-router';

// Endereço para colar no painel do Mercado Pago (Suas integrações → Webhooks):
// https://SEU-DOMINIO/api/public/mercadopago-webhook  — evento "Pagamentos".
export const Route = createFileRoute('/api/public/mercadopago-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWebhookSignature, getPayment } = await import('@/lib/mercadopago.server');
        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
        const dataId = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : null);
        const type = url.searchParams.get('type') ?? body.type;

        const secret = process.env['MP_WEBHOOK_SECRET'];
        if (!secret) return new Response('MP_WEBHOOK_SECRET não configurado', { status: 500 });
        const ok = await verifyWebhookSignature({ signature: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'), dataId, secret });
        if (!ok) return new Response('Assinatura inválida', { status: 401 });

        if (type === 'payment' && dataId && /^\d+$/.test(dataId)) {
          // Confirma direto na API (não confia só no aviso).
          const p = await getPayment(dataId);
          console.log(`[Mercado Pago] pedido #${p.external_reference} · ${p.status} (${p.status_detail}) · ${p.payment_method_id} · R$ ${p.transaction_amount}`);
        }
        return new Response('ok');
      },
    },
  },
});
