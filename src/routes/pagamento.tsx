import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { contacts } from '@/lib/restaurant-data';

const search = z.object({ status: z.enum(['aprovado', 'pendente', 'recusado']).catch('pendente'), pedido: z.string().max(12).optional() });

const texts = {
  aprovado: { title: 'Pagamento aprovado!', body: 'Recebemos seu pagamento. A Tia Val já vai preparar sua marmita com carinho.' },
  pendente: { title: 'Pagamento em análise', body: 'Se você escolheu Pix ou boleto, é só concluir o pagamento. Assim que cair, seu pedido segue.' },
  recusado: { title: 'Pagamento não aprovado', body: 'Não deu certo dessa vez. Tente outra forma de pagamento ou escolha pagar na entrega.' },
};

export const Route = createFileRoute('/pagamento')({
  validateSearch: search,
  head: () => ({ meta: [
    { title: 'Pagamento do pedido | Marmitex da Tia Val' },
    { name: 'description', content: 'Acompanhe o pagamento do seu pedido na Marmitex da Tia Val.' },
    { property: 'og:title', content: 'Pagamento do pedido | Marmitex da Tia Val' },
    { property: 'og:description', content: 'Situação do pagamento do seu pedido pelo Mercado Pago.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex' },
  ] }),
  component: PaymentPage,
});

function PaymentPage() {
  const { status, pedido } = Route.useSearch();
  const t = texts[status];
  return <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
    <div className="max-w-md w-full text-center space-y-4 rounded-2xl border bg-card p-8">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      {pedido && <p className="text-muted-foreground">Pedido <strong>#{pedido}</strong></p>}
      <p>{t.body}</p>
      <p className="text-sm text-muted-foreground">Dúvidas? Ligue {contacts.phoneLabel}.</p>
      <Button asChild><Link to="/">Voltar para o site</Link></Button>
    </div>
  </main>;
}
