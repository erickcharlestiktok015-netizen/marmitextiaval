const COOKIE_NAME = 'tia_val_admin';
const encoder = new TextEncoder();

function secret() {
  const value = process.env['ADMIN_SESSION_SECRET'];
  if (!value || value.length < 32) throw new Error('Configure ADMIN_SESSION_SECRET com pelo menos 32 caracteres.');
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base + '='.repeat((4 - (base.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export async function createAdminCookie() {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 12 })));
  const value = `${payload}.${await sign(payload)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export async function isAdminRequest(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const raw = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (!raw) return false;
    const [payload, signature] = raw.split('.');
    if (!payload || !signature) return false;
    const expected = await sign(payload);
    if (expected.length !== signature.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (difference !== 0) return false;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function verifyAdminPassword(value: string) {
  const candidates = [process.env['ADMIN_PASSWORD'], process.env['MOTHER_ADMIN_PASSWORD']].filter((candidate): candidate is string => Boolean(candidate));
  if (candidates.length === 0) throw new Error('Configure ADMIN_PASSWORD e/ou MOTHER_ADMIN_PASSWORD no servidor.');
  return candidates.some((expected) => {
    let diff = value.length ^ expected.length;
    const length = Math.max(value.length, expected.length);
    for (let i = 0; i < length; i++) diff |= (value.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
    return diff === 0;
  });
}
