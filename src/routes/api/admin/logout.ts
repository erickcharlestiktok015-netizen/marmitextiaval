import { createFileRoute } from '@tanstack/react-router';
import { clearAdminCookie } from '@/lib/admin-auth.server';

export const Route = createFileRoute('/api/admin/logout')({
  server: {
    handlers: {
      POST: async () => Response.json({ ok: true }, { headers: { 'Set-Cookie': clearAdminCookie(), 'Cache-Control': 'no-store' } }),
    },
  },
});
