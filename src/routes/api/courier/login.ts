import { createFileRoute } from '@tanstack/react-router';
import { createCourierCookie, verifyCourierPassword } from '@/lib/courier-auth.server';
export const Route = createFileRoute('/api/courier/login')({
  server: { handlers: { POST: async ({ request }) => {
    let body: { password?: unknown };
    const formSubmission = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
    try {
      if (formSubmission) {
        const form = new URLSearchParams(await request.text());
        body = { password: form.get('password') };
      } else {
        body = await request.json() as { password?: unknown };
      }
    } catch { return Response.json({ error: 'Requisição inválida.' }, { status: 400 }); }
    if (typeof body.password !== 'string' || body.password.length > 256) return Response.json({ error: 'Informe a senha.' }, { status: 400 });
    try {
      if (!verifyCourierPassword(body.password)) {
        if (formSubmission) return new Response(null, { status: 303, headers: { Location: new URL('/motoboy?loginError=1', request.url).toString(), 'Cache-Control': 'no-store' } });
        return Response.json({ error: 'Senha incorreta.' }, { status: 401 });
      }
      const cookie = await createCourierCookie();
      if (formSubmission) return new Response(null, { status: 303, headers: { Location: new URL('/motoboy/entregas', request.url).toString(), 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
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
