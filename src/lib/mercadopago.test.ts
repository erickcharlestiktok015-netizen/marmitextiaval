import { describe, expect, it } from 'vitest';
import { buildPreferenceItems, verifyWebhookSignature } from './mercadopago.server';

describe('Mercado Pago', () => {
  it('usa o preço do cardápio, não o do navegador', () => {
    const items = buildPreferenceItems([{ name: 'Feijão Tropeiro', sizeLabel: 'Só tropeiro grande · 750ml', quantity: 2 }], 'retirada', null);
    expect(items).toHaveLength(1);
    expect(items[0]!.unit_price).toBe(25);
  });
  it('cobra R$1,50 por km na entrega', () => {
    const items = buildPreferenceItems([{ name: 'X', sizeLabel: 'Pequena · 500ml', quantity: 1 }], 'entrega', 3.2);
    expect(items[1]!.unit_price).toBe(4.8);
  });
  it('recusa item que não existe no cardápio', () => {
    expect(() => buildPreferenceItems([{ name: 'X', sizeLabel: 'Gigante', quantity: 1 }], 'retirada', null)).toThrow();
  });
  it('recusa aviso com assinatura errada', async () => {
    expect(await verifyWebhookSignature({ signature: 'ts=1,v1=abc', requestId: 'r', dataId: '1', secret: 's' })).toBe(false);
  });
  it('aceita aviso com assinatura certa', async () => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('s'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('id:123;request-id:r;ts:1;')))].map(b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyWebhookSignature({ signature: `ts=1,v1=${sig}`, requestId: 'r', dataId: '123', secret: 's' })).toBe(true);
  });
});
