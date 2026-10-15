import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, LockKeyhole, Smartphone } from 'lucide-react';

export const Route = createFileRoute('/motoboy')({
  head: () => ({ meta: [{ title: 'Motoboy | Tia Val Entregas' }, { name: 'theme-color', content: '#25251f' }], links: [{ rel: 'manifest', href: '/manifest-motoboy.webmanifest' }] }),
  component: CourierLogin,
});

function CourierLogin() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/courier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
      window.location.href = '/motoboy/entregas';
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao entrar.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f4ed] px-4 py-10 text-[#25251f]">
    <section className="w-full max-w-md rounded-3xl border border-[#e5dfd2] bg-white p-6 shadow-sm sm:p-8">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#25251f] text-[#e9c878]"><Bike size={30}/></div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-[#9a742a]">Marmitex da Tia Val</p>
      <h1 className="mt-2 text-3xl font-bold">Área do motoboy</h1>
      <p className="mt-2 text-sm leading-6 text-[#777266]">Entre para ver entregas liberadas, abrir rotas no Waze e avisar o cliente quando chegar.</p>
      <form onSubmit={login} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold">Senha do motoboy
          <span className="mt-2 flex items-center gap-2 rounded-xl border border-[#d9d2c4] px-3"><LockKeyhole size={18} className="text-[#777266]"/><input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256} className="min-h-12 w-full bg-transparent outline-none" placeholder="Digite sua senha"/></span>
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#25251f] px-4 font-semibold text-white disabled:opacity-60">{busy?'Entrando…':'Entrar nas entregas'}</button>
      </form>
      <div className="mt-6 flex gap-3 rounded-xl bg-[#f8f1df] p-4"><Smartphone size={21} className="shrink-0 text-[#9a742a]"/><p className="text-sm leading-5">Para instalar: abra este endereço no Chrome ou Safari e escolha <strong>Adicionar à tela inicial</strong>. O ícone abre como aplicativo.</p></div>
      <p className="mt-5 text-center text-xs text-[#777266]">Acesso exclusivo para entregadores autorizados.</p>
    </section>
  </main>;
}
