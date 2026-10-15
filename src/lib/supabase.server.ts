const getConfig = () => {
  const url = process.env['SUPABASE_URL']?.replace(/\/$/, '');
  const key = process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no servidor.');
  return { url, key };
};

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Supabase request failed', response.status, detail.slice(0, 500));
    throw new Error('Não foi possível salvar ou consultar os pedidos.');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

export async function insertOrderRecord(order: Record<string, unknown>, items: Record<string, unknown>[]) {
  const created = await supabaseRequest<Array<{ id: string }>>('orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(order),
  });
  const id = created[0]?.id;
  if (!id) throw new Error('O banco não retornou o pedido criado.');
  await supabaseRequest('order_items', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(items.map((item) => ({ ...item, order_id: id }))),
  });
  return id;
}
