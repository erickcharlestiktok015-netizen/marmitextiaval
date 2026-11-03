import { createFileRoute } from '@tanstack/react-router';
import { clearCourierCookie } from '@/lib/courier-auth.server';
export const Route = createFileRoute('/api/courier/logout')({
  server: { handlers: { POST: async () => Response.json({ ok: true }, { headers: { 'Set-Cookie': clearCourierCookie(), 'Cache-Control': 'no-store' } }) } },
});
