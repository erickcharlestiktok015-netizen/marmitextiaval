import { createFileRoute } from '@tanstack/react-router';
import { createCourierCookie, verifyCourierPassword } from '@/lib/courier-auth.server';
export const Route = createFileRoute('/api/courier/login')({
  server: { handlers: { POST: async ({ request }) => {
    let body: { password?: unknown };
    try { body = await request.json() as { password?: unknown }; } catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
    if (typeof body.password !== 'string' || body.password.length > 256) return Response.json({ error: 'Informe a senha.' }, { status: 400 });
    try {
      if (!verifyCourierPassword(body.password)) {
        return Response.json({ error: 'Senha incorreta.' }, { status: 401 });
      }
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': await createCourierCookie(), 'Cache-Control': 'no-store' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const safeMessage = message.includes('COURIER_PASSWORD')
        ? 'Falta configurar COURIER_PASSWORD nas variáveis de ambiente da Vercel.'
        : message.includes('COURIER_SESSION_SECRET')
          ? 'Configure COURIER_SESSION_SECRET com pelo menos 32 caracteres na Vercel.'
          : 'Não foi possível iniciar a sessão do motoboy. Confira os logs do servidor.';
      console.error('[courier-login] Falha na configuração da sessão:', { type: message.includes('COURIER_PASSWORD') ? 'missing_password' : message.includes('COURIER_SESSION_SECRET') ? 'missing_session_secret' : 'session_error' });
      return Response.json({ error: safeMessage }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  } } },
});
