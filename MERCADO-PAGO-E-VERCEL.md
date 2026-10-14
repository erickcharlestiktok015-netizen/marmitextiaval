# Como colocar o site no ar com Mercado Pago

## Formas de pagamento do site
- **Pagar agora online (Mercado Pago):** Pix, cartão de crédito (até 12x), débito virtual, boleto, saldo Mercado Pago e Linha de Crédito. Aparecem as formas que a sua conta tiver ativas.
- **Pix na entrega**, **Cartão na entrega (maquininha)**, **Dinheiro na entrega** (com troco).
- PayPal, Google Pay e Apple Pay não são oferecidos pelo Mercado Pago para sites no Brasil.

## 1. GitHub
1. Descompacte o arquivo baixado.
2. Crie um repositório novo no GitHub e envie todos os arquivos da pasta (inclusive os que começam com ponto).

## 2. Vercel
1. Na Vercel: **Add New → Project →** escolha o repositório. Pode deixar tudo no padrão e clicar em **Deploy**.
2. Vá em **Settings → Environment Variables** e crie:

| Nome | Onde pegar |
|---|---|
| `MP_ACCESS_TOKEN` | Mercado Pago → [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → sua aplicação → **Credenciais de produção → Access Token** (começa com `APP_USR-`) |
| `MP_WEBHOOK_SECRET` | Mesma aplicação → **Webhooks** → depois de salvar (passo 3), copie a **Assinatura secreta** |
| `SITE_URL` | O endereço do site, ex.: `https://seudominio.com.br` (sem `/` no final) |
| `MP_STATEMENT_DESCRIPTOR` | Opcional. Nome na fatura do cartão, até 13 letras |

3. Depois de criar as variáveis: **Deployments → ⋯ → Redeploy**.

## 3. Avisos de pagamento (Webhook)
No Mercado Pago → sua aplicação → **Webhooks → Configurar notificações**:
- URL de produção: `https://SEU-DOMINIO/api/public/mercadopago-webhook`
- Evento: **Pagamentos**
- Salve, copie a **Assinatura secreta** para `MP_WEBHOOK_SECRET` na Vercel e faça Redeploy.

Os pagamentos confirmados aparecem em **Vercel → Logs** (`[Mercado Pago] pedido #...`) e no painel do Mercado Pago.

## 4. Domínio da Hostinger
1. Vercel → **Settings → Domains** → adicione seu domínio.
2. Na Hostinger → **DNS**: crie os registros que a Vercel mostrar (normalmente `A @ 76.76.21.21` e `CNAME www cname.vercel-dns.com`).
3. Atualize `SITE_URL` e a URL do webhook para o domínio novo e faça Redeploy.

## Testar sem dinheiro de verdade
Use as **Credenciais de teste** no `MP_ACCESS_TOKEN`, coloque `MP_USE_SANDBOX=true` e pague com os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards). Depois volte para as credenciais de produção e `MP_USE_SANDBOX=false`.
