import { createFileRoute } from '@tanstack/react-router';
import { createCourierCookie, verifyCourierPassword } from '@/lib/courier-auth.server';
export const Route = createFileRoute('/api/courier/login')({
  server: { handlers: { POST: async ({ request }) => {
    let body: { password?: unknown };
    try { body = await request.json() as { password?: unknown }; } catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
    if (typeof body.password !== 'string' || body.password.length > 256) return Response.json({ error: 'Informe a senha.' }, { status: 400 });
    try {
      if (!verifyCourierPassword(body.password)) {
        console.warn('[courier-login] Senha inválida; nenhuma senha foi registrada.');
        return Response.json({ error: 'Senha incorreta.' }, { status: 401 });
      }
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': await createCourierCookie(), 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('[courier-login] Falha ao validar configuração ou criar sessão:', error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) });
      return Response.json({ error: 'Acesso do motoboy ainda não configurado no servidor.' }, { status: 503 });
    }
  } } },
});
