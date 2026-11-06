import { createFileRoute } from "@tanstack/react-router";
import { DeliveryHome } from '@/components/delivery/delivery-home';

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Marmitex da Tia Val | Peça sua marmita caseira em BH' },
    { name: 'description', content: 'Peça a marmita do dia da Tia Val no Primeiro de Maio, BH. Entrega em 15–25 min, Pix, cartão ou pagamento na entrega. Acompanhe seu pedido ao vivo.' },
    { property: 'og:title', content: 'Marmitex da Tia Val | Peça sua marmita caseira' },
    { property: 'og:description', content: 'Comida caseira há 6 anos no Primeiro de Maio. Escolha, pague e acompanhe a entrega pelo celular.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: DeliveryHome,
});
