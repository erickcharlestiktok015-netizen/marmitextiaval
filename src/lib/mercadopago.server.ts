// Integração Mercado Pago (Checkout Pro). Só roda no servidor: usa MP_ACCESS_TOKEN.
import { meals, tomorrowMenu } from '@/lib/restaurant-data';
import { deliveryFeeForKm } from '@/lib/orders';

const MP_API = 'https://api.mercadopago.com';
export const MAX_DELIVERY_KM = 30;

export type PaymentItemInput = { name: string; sizeLabel: string; quantity: number };
export type OnlinePaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'ticket' | 'account_money';

// Preço sempre vem do cardápio, nunca do navegador.
export function priceForSizeLabel(label: string): number | null {
  for (const m of [...meals, ...tomorrowMenu]) {
    const s = m.sizes.find(x => x.label === label);
    if (s) return s.price;
  }
  return null;
}

export function buildPreferenceItems(items: PaymentItemInput[], fulfillment: 'entrega' | 'retirada', km: number | null) {
  const out = items.map((i, idx) => {
    const price = priceForSizeLabel(i.sizeLabel);
    if (price == null) throw new Error(`Item inválido: ${i.sizeLabel}`);
    return { id: `item-${idx + 1}`, title: `${i.name} — ${i.sizeLabel}`.slice(0, 250), quantity: i.quantity, unit_price: price, currency_id: 'BRL' };
  });
  if (fulfillment === 'entrega') {
    if (km == null || km <= 0 || km > MAX_DELIVERY_KM) throw new Error('Distância de entrega inválida');
    out.push({ id: 'entrega', title: `Entrega motoboy (${Math.ceil(km)} km)`, quantity: 1, unit_price: deliveryFeeForKm(km), currency_id: 'BRL' });
  }
  return out;
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ${name} não configurada`);
  return v;
}

export function siteUrl() {
  // Em Preview, use a URL do próprio deployment para que retorno e webhook usem o ambiente de teste.
  if (process.env['VERCEL_ENV'] === 'preview' && process.env['VERCEL_URL']) {
    return `https://${process.env['VERCEL_URL']}`;
  }
  return (process.env['SITE_URL'] || (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : '')).replace(/\/$/, '') || env('SITE_URL');
}

const paymentTypeByMethod: Record<OnlinePaymentMethod, string> = {
  pix: 'bank_transfer',
  credit_card: 'credit_card',
  debit_card: 'debit_card',
  ticket: 'ticket',
  account_money: 'account_money',
};
const allPaymentTypes = ['bank_transfer', 'credit_card', 'debit_card', 'ticket', 'account_money'];

export async function createPreference(args: {
  code: string;
  items: ReturnType<typeof buildPreferenceItems>;
  payer: { name: string; phone: string };
  onlineMethod: OnlinePaymentMethod;
}) {
  const base = siteUrl();
  const chosenType = paymentTypeByMethod[args.onlineMethod];
  const body = {
    items: args.items,
    external_reference: args.code,
    statement_descriptor: (process.env['MP_STATEMENT_DESCRIPTOR'] || 'TIAVAL').slice(0, 13),
    payer: { name: args.payer.name, phone: { area_code: args.payer.phone.slice(0, 2), number: args.payer.phone.slice(2) } },
    payment_methods: {
      installments: args.onlineMethod === 'credit_card' ? 12 : 1,
      // O Mercado Pago não permite excluir account_money; mantenha-o fora da lista de exclusões.
      // Isso evita HTTP 400, embora o Checkout Pro possa continuar oferecendo saldo em conta.
      excluded_payment_types: allPaymentTypes.filter(type => type !== chosenType && type !== 'account_money').map(id => ({ id })),
      excluded_payment_methods: [],
    },
    back_urls: {
      success: `${base}/pagamento?status=aprovado&pedido=${args.code}`,
      pending: `${base}/pagamento?status=pendente&pedido=${args.code}`,
      failure: `${base}/pagamento?status=recusado&pedido=${args.code}`,
    },
    auto_return: 'approved',
    notification_url: `${base}/api/public/mercadopago-webhook`,
    expires: true,
    expiration_date_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': args.code },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('Mercado Pago preference error', res.status, await res.text());
    throw new Error('Falha ao criar pagamento no Mercado Pago');
  }
  const data = (await res.json()) as { id: string | number; init_point: string; sandbox_init_point?: string };
  return {
    preferenceId: String(data.id),
    url: process.env['MP_USE_SANDBOX'] === 'true' && data.sandbox_init_point ? data.sandbox_init_point : data.init_point,
  };
}

export async function getPayment(id: string) {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}` } });
  if (!res.ok) throw new Error(`Pagamento ${id} não encontrado (${res.status})`);
  return (await res.json()) as { id: number; status: string; status_detail: string; external_reference: string; transaction_amount: number; payment_type_id: string; payment_method_id: string };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

// Valida o cabeçalho x-signature ("ts=...,v1=...") conforme a documentação do Mercado Pago.
export async function verifyWebhookSignature(opts: { signature: string | null; requestId: string | null; dataId: string | null; secret: string }) {
  if (!opts.signature) return false;
  const parts = Object.fromEntries(opts.signature.split(',').map(p => p.trim().split('=') as [string, string]));
  const ts = parts['ts'], v1 = parts['v1'];
  if (!ts || !v1) return false;
  let manifest = '';
  if (opts.dataId) manifest += `id:${opts.dataId.toLowerCase()};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(opts.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)));
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
