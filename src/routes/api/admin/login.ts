import { createFileRoute } from '@tanstack/react-router';
import { createAdminCookie, verifyAdminPassword } from '@/lib/admin-auth.server';

export const Route = createFileRoute('/api/admin/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { password?: unknown };
        try { body = await request.json() as { password?: unknown }; }
        catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
        if (typeof body.password !== 'string' || body.password.length > 256) {
          return Response.json({ error: 'Informe a senha.' }, { status: 400 });
        }
        try {
          if (!verifyAdminPassword(body.password)) return Response.json({ error: 'Senha incorreta.' }, { status: 401 });
          return Response.json({ ok: true }, { headers: { 'Set-Cookie': await createAdminCookie(), 'Cache-Control': 'no-store' } });
        } catch (error) {
          console.error('Admin login configuration error', error);
          return Response.json({ error: 'Painel ainda não configurado no servidor.' }, { status: 503 });
        }
      },
    },
  },
});
