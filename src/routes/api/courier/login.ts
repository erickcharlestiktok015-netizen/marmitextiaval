import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const loginCourier = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const expectedPassword = process.env['COURIER_PASSWORD'];
    if (!expectedPassword) {
      return { success: false, error: 'Sistema não configurado' };
    }
    if (data.password === expectedPassword) {
      return { success: true, sessionToken: 'courier-session-active' };
    }
    return { success: false, error: 'Senha incorreta' };
  });
