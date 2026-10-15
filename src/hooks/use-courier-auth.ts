import { useState, useEffect } from 'react';
import { loginCourier, verifyCourierSession, endCourierSession } from '@/routes/api/courier';
import { z } from 'zod';

export function useCourierAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Verify session on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const result = await verifyCourierSession({});
      setIsAuthenticated(result.valid);
    } catch (err) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await loginCourier({ password });
      if (result.success) {
        setIsAuthenticated(true);
        return true;
      } else {
        setError(result.error || 'Login falhou');
        return false;
      }
    } catch (err) {
      setError('Erro de conexão');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await endCourierSession({});
      setIsAuthenticated(false);
    } catch (err) {
      // Ignore errors on logout
    } finally {
      setIsLoading(false);
    }
  };

  return { isAuthenticated, isLoading, error, login, logout };
}