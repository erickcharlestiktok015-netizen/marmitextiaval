import { createServerFn } from '@tanstack/react-start';

export const endCourierSession = createServerFn({ method: 'POST' }).handler(async () => {
  typeof window !== 'undefined' && localStorage.removeItem('courier_session');
  return { success: true };
});