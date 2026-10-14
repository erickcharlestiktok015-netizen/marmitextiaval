<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Online payment uses Mercado Pago Checkout Pro via a server function (`src/lib/payments.functions.ts`) and a signed webhook at `/api/public/mercadopago-webhook`; prices are recomputed server-side from `restaurant-data` so the browser can't change them.
- `vite.config.ts` switches the nitro preset to `vercel` when `VERCEL` is set, because the site is self-hosted on Vercel from GitHub while the Lovable build keeps its default target.
