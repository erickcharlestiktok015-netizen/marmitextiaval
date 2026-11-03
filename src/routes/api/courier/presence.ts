import { createFileRoute } from '@tanstack/react-router';
import { isCourierRequest } from '@/lib/courier-auth.server';
import { supabaseRequest } from '@/lib/supabase.server';

type Presence = { id: string; is_online: boolean; updated_at: string };

export const Route = createFileRoute('/api/courier/presence')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }
      try {
        const rows = await supabaseRequest<Presence[]>(
          'courier_presence?select=id,is_online,updated_at&id=eq.motoboy&limit=1',
        );
        return Response.json(
          { is_online: rows[0]?.is_online ?? false, updated_at: rows[0]?.updated_at ?? null },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      } catch {
        return Response.json(
          { error: 'Não foi possível ler sua disponibilidade. Aplique a migration courier_presence no Supabase e tente novamente.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    },
    PATCH: async ({ request }) => {
      if (!(await isCourierRequest(request))) {
        return Response.json({ error: 'Faça login como motoboy.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }
      let body: { is_online?: unknown };
      try { body = await request.json() as { is_online?: unknown }; }
      catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
      if (typeof body.is_online !== 'boolean') {
        return Response.json({ error: 'Informe se deseja ficar online ou offline.' }, { status: 400 });
      }
      const updatedAt = new Date().toISOString();
      try {
        const rows = await supabaseRequest<Presence[]>('courier_presence?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({ id: 'motoboy', is_online: body.is_online, updated_at: updatedAt }),
        });
        return Response.json(
          { is_online: rows[0]?.is_online ?? body.is_online, updated_at: rows[0]?.updated_at ?? updatedAt },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch {
        return Response.json(
          { error: 'Não foi possível salvar sua disponibilidade. Confira se a migration courier_presence foi aplicada no Supabase.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    },
  } },
});
