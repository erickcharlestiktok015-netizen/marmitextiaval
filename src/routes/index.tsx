import { createFileRoute } from "@tanstack/react-router";
import { RestaurantPage } from '@/components/restaurant/restaurant-page';

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Marmitex da Tia Val | Comida caseira feita com amor em BH' },
    { name: 'description', content: 'Conheça a Marmitex da Tia Val no Primeiro de Maio, Belo Horizonte. Comida caseira, carinho e tempero de casa. Consulte os pratos pelo (31) 3445-4042.' },
    { property: 'og:title', content: 'Marmitex da Tia Val | Comida caseira feita com amor' },
    { property: 'og:description', content: 'Um pedacinho de casa no seu dia. Conheça a comida e as avaliações da Marmitex da Tia Val em Belo Horizonte.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: RestaurantPage,
});
