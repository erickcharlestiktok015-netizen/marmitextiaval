import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bike, LockKeyhole, Smartphone, Stethoscope } from 'lucide-react';

export const Route = createFileRoute('/motoboy')({
  head: () => ({ meta: [{ title: 'Motoboy | Tia Val Entregas' }, { name: 'theme-color', content: '#25251f' }], links: [{ rel: 'manifest', href: '/manifest-motoboy.webmanifest' }] }),
  component: CourierLogin,
});

type Diagnostic = { title: string; detail: string; status?: number; ok: boolean };

function CourierLogin() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);

  async function diagnose() {
    setDiagnosing(true);
    setDiagnostic(null);
    try {
      const response = await fetch('/api/courier/orders?diagnostic=' + Date.now(), {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({})) as { error?: string; orders?: unknown[] };
      if (response.status === 401) {
        setDiagnostic({
          title: 'Sessão do motoboy não reconhecida (HTTP 401)',
          detail: 'O servidor não recebeu uma sessão válida. Faça login novamente. Se acontecer logo após aceitar a senha, a sessão/cookie não está sendo gravada ou validada corretamente.',
          status: response.status,
          ok: false,
        });
      } else if (response.status === 503) {
        setDiagnostic({
          title: 'Falha no servidor ou na consulta dos pedidos (HTTP 503)',
          detail: data.error || 'A API não conseguiu consultar as entregas. Verifique as variáveis de ambiente e os Runtime Logs da Vercel.',
          status: response.status,
          ok: false,
        });
      } else if (!response.ok) {
        setDiagnostic({
          title: 'A API respondeu com erro (HTTP ' + response.status + ')',
          detail: data.error || 'Resposta inesperada ao consultar a fila de entregas.',
          status: response.status,
          ok: false,
        });
      } else {
        setDiagnostic({
          title: 'Sessão válida e API de entregas funcionando (HTTP ' + response.status + ')',
          detail: 'A API respondeu corretamente e encontrou ' + (data.orders?.length ?? 0) + ' entrega(s) liberada(s). Se a tela ainda voltar ao login, o problema pode estar na navegação ou em outra versão/deployment da página.',
          status: response.status,
          ok: true,
        });
      }
    } catch {
      setDiagnostic({
        title: 'Não foi possível alcançar a API',
        detail: 'A requisição falhou antes de receber uma resposta. Verifique a conexão e se este deployment da Vercel está acessível; se continuar, confira a aba Network e os Runtime Logs.',
        ok: false,
      });
    } finally {
      setDiagnosing(false);
    }
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDiagnostic(null);
    try {
      const response = await fetch('/api/courier/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        console.warn('[courier-login-ui] Login recusado:', { status: response.status, message: data.error || 'Sem mensagem' });
        throw new Error((data.error || 'Não foi possível entrar.') + ' (HTTP ' + response.status + ')');
      }

      // Confirme que o navegador recebeu e está enviando o cookie antes de sair do login.
      // HTTP 200 com fila vazia ainda é sucesso: o painel deve abrir mesmo sem pedidos liberados.
      const sessionCheck = await fetch('/api/courier/orders?diagnostic=' + Date.now(), {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (sessionCheck.status === 401) {
        throw new Error('A senha foi aceita, mas a sessão não foi reconhecida. Verifique se o site está aberto pelo endereço HTTPS oficial e tente novamente. Se persistir, confira COURIER_SESSION_SECRET na Vercel.');
      }
      // Se a sessão foi aceita (200), ou se a API de pedidos está temporariamente
      // indisponível (503), abra o painel: ele próprio mostra os erros de carregamento.
      window.location.assign('/motoboy/entregas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar.');
    } finally {
      setBusy(false);
    }
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

      <div className="mt-5 rounded-xl border border-[#e5dfd2] p-4">
        <button type="button" onClick={diagnose} disabled={diagnosing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cfc6b4] px-3 text-sm font-semibold disabled:opacity-60">
          <Stethoscope size={18}/>{diagnosing ? 'Verificando acesso…' : 'Diagnosticar por que não abre as entregas'}
        </button>
        {diagnostic && <div role="status" className={`mt-3 rounded-lg p-3 text-sm ${diagnostic.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="font-bold">{diagnostic.title}</p>
          <p className="mt-1 leading-5">{diagnostic.detail}</p>
          {diagnostic.status !== undefined && <p className="mt-2 text-xs">Código HTTP: {diagnostic.status}</p>}
          <button type="button" onClick={() => void navigator.clipboard?.writeText('Diagnóstico Motoboy Tia Val\\n' + diagnostic.title + '\\n' + diagnostic.detail + (diagnostic.status === undefined ? '' : '\\nHTTP ' + diagnostic.status))} className="mt-3 underline underline-offset-2">Copiar diagnóstico</button>
        </div>}
      </div>

      <div className="mt-6 flex gap-3 rounded-xl bg-[#f8f1df] p-4"><Smartphone size={21} className="shrink-0 text-[#9a742a]"/><p className="text-sm leading-5">Para instalar: abra este endereço no Chrome ou Safari e escolha <strong>Adicionar à tela inicial</strong>. O ícone abre como aplicativo.</p></div>
      <p className="mt-5 text-center text-xs text-[#777266]">Acesso exclusivo para entregadores autorizados.</p>
    </section>
  </main>;
}
