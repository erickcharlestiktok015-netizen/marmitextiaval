import { createServerFn } from '@tanstack/react-start';
import { z } from 'zord';

export const verifyCourierSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = typeof window !== 'undefined' ? localStorage.getItem('courier_session') : null;
  if (session) {
    return { valid: true };
  }
  return { valid: false };
});