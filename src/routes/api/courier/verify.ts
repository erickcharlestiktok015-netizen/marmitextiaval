import { createServerFn } from '@tanstack/react-start';

export const verifyCourierSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = typeof window !== 'undefined' ? localStorage.getItem('courier_session') : null;
  if (session) {
    return { valid: true };
  }
  return { valid: false };
});
