import crypto from 'crypto';

/**
 * Cria hash SHA-256 de uma string
 * @param data String para ser hashificada
 * @returns Hash em hexadecimal SHA-256
 */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Prepara dados do usuário para envio à API de Conversões do Facebook
 * @param email Email do cliente (já deve estar minúsculo e sem espaços)
 * @param phone Telefone do cliente (deve conter apenas números com DDI 55)
 * @param firstName Primeiro nome do cliente
 * @param ipAddress Endereço IP do cliente (opcional)
 * @param userAgent User agent do cliente (opcional)
 * @returns Objeto com dados do usuário prontos para envio
 */
function prepareUserData(
  email: string,
  phone: string,
  firstName: string,
  ipAddress?: string,
  userAgent?: string
) {
  const userData: Record<string, string> = {};

  // Email: minúsculo e sem espaços, depois hash
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    userData.emails = [sha256(normalizedEmail)];
  }

  // Telefone: apenas números com DDI 55 (Brasil)
  if (phone) {
    const numbersOnly = phone.replace(/\D/g, '');
    // Garante que começa com 55 (DDI Brasil)
    const normalizedPhone = numbersOnly.startsWith('55') ? numbersOnly : `55${numbersOnly}`;
    userData.phones = [sha256(normalizedPhone)];
  }

  // Nome: primeiro nome em hash
  if (firstName) {
    const normalizedFirstName = firstName.trim().split(' ')[0]; // Primeiro nome
    userData.fn = sha256(normalizedFirstName);
  }

  // IP e User Agent (se disponíveis)
  if (ipAddress) userData.client_ip_address = ipAddress;
  if (userAgent) userData.client_user_agent = userAgent;

  return userData;
}

/**
 * Envia evento para a API de Conversões (CAPI) do Facebook/Meta
 * @param eventName Nome do evento ('Purchase' ou 'InitiateCheckout')
 * @param eventId ID único do evento (geralmente o código do pedido)
 * @param order Objeto contendo dados do pedido
 * @param req Objeto de request (opcional, para obter IP e user agent)
 */
export async function sendFacebookServerEvent({
  eventName,
  eventId,
  order,
  req,
}: {
  eventName: 'Purchase' | 'InitiateCheckout';
  eventId: string;
  order: {
    code: string;
    total: number;
    customer: {
      name: string;
      phone: string;
    };
  };
  req?: Request;
}) {
  try {
    const accessToken = process.env.FB_ACCESS_TOKEN;
    const pixelId = process.env.FB_PIXEL_ID;

    if (!accessToken || !pixelId) {
      console.warn('Variáveis de ambiente FB_ACCESS_TOKEN ou FB_PIXEL_ID não configuradas');
      return;
    }

    // Extrai dados do cliente
    const { name, phone } = order.customer;

    // Separa primeiro nome (para o campo fn)
    const firstName = name.trim().split(' ')[0] || '';

    // Prepara dados do usuário
    const userData = prepareUserData(
      // Email não está disponível no objeto order, então deixamos vazio
      '', // email
      phone,
      firstName,
      // Tenta obter IP e user agent do request
      req ? req.headers.get('x-forwarded-for')?.split(',')[0] || undefined : undefined,
      req ? req.headers.get('user-agent') || undefined : undefined
    );

    // Remove campos vazios
    Object.keys(userData).forEach(key => {
      if (!userData[key] || (Array.isArray(userData[key]) && userData[key].length === 0)) {
        delete userData[key];
      }
    });

    // Prepara o payload
    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000), // timestamp em segundos
          event_id: eventId, // código do pedido para desduplicação
          action_source: 'website',
          user_data: userData,
          custom_data: {
            currency: 'BRL',
            value: order.total,
            order_id: order.code,
          },
        },
      ],
    };

    // Envia para a API do Facebook
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API do Facebook: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Evento CAPI ${eventName} enviado com sucesso para pedido ${order.code}:`, result);
    return result;
  } catch (error) {
    console.error('Falha ao enviar evento para a API de Conversões do Facebook:', error);
    // Não lançamos o erro para não quebrar o fluxo principal
    return undefined;
  }
}