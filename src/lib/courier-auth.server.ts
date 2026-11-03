const COOKIE_NAME = 'tia_val_courier';
const encoder = new TextEncoder();
function secret() {
  const value = process.env['COURIER_SESSION_SECRET'] || process.env['ADMIN_SESSION_SECRET'];
  if (!value || value.length < 32) throw new Error('Configure COURIER_SESSION_SECRET com pelo menos 32 caracteres.');
  return value;
}
function b64(bytes: Uint8Array) {
  let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64(value: string) {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base + '='.repeat((4 - base.length % 4) % 4)), c => c.charCodeAt(0));
}
async function sign(value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
export async function createCourierCookie() {
  const payload = b64(encoder.encode(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 12 })));
  return `${COOKIE_NAME}=${payload}.${await sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}
export async function isCourierRequest(request: Request) {
  try {
    const raw = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + '='))?.slice(COOKIE_NAME.length + 1);
    if (!raw) return false;
    const [payload, signature] = raw.split('.');
    if (!payload || !signature) return false;
    const expected = await sign(payload);
    if (expected.length !== signature.length) return false;
    let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (diff) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64(payload))) as { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch { return false; }
}
export function clearCourierCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export function verifyCourierPassword(value: string) {
  const expected = process.env['COURIER_PASSWORD'];
  if (!expected) throw new Error('Configure COURIER_PASSWORD no servidor.');
  let diff = value.length ^ expected.length;
  for (let i = 0; i < Math.max(value.length, expected.length); i++) diff |= (value.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  return diff === 0;
}
