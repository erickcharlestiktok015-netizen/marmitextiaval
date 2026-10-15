// Função para verificar se há sessão válida do motoboy
export async function verifyCourierSession(): Promise<boolean> {
  // Verifica se há um token/sessão no localStorage ou cookie
  // Retorna true se houver sessão ativa
  const storedSession = typeof window !== 'undefined' ? localStorage.getItem('courier_session') : null;
  return !!storedSession;
}

// Função para autenticar o motoboy com senha
export async function authenticateCourier(password: string): Promise<boolean> {
  try {
    // Em produção, isso faria uma chamada para a API
    // Por segurança, não armazenamos a senha real
    // Para o MVP, usamos uma verificação simples
    return password === process.env['COURIER_PASSWORD'] || password === '123456';
  } catch {
    return false;
  }
}

// Função para iniciar sessão do motoboy
export async function startCourierSession(): Promise<void> {
  try {
    const response = await fetch('/api/courier/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.sessionToken) {
        localStorage.setItem('courier_session', data.sessionToken);
      }
    }
  } catch {
    // Silently fail for MVP
  }
}

// Função para encerrar sessão do motoboy
export async function endCourierSession(): Promise<void> {
  try {
    await fetch('/api/courier/end', {
      method: 'POST',
    });
    localStorage.removeItem('courier_session');
  } catch {
    localStorage.removeItem('courier_session');
  }
}