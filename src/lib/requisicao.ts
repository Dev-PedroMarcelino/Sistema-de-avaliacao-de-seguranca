import { ErroFluxo } from "@/lib/integracao/servico";

export function ipDe(h: Headers): string | null {
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return h.get("x-real-ip");
}

export const userAgentDe = (h: Headers) => h.get("user-agent")?.slice(0, 400) ?? null;

// Limite simples por processo (no Vercel vale por instância; suficiente contra abuso casual).
const janelas = new Map<string, { total: number; reinicia: number }>();

export function limitar(chave: string, maximo: number, janelaMs: number) {
  const agora = Date.now();
  const j = janelas.get(chave);
  if (!j || j.reinicia < agora) {
    janelas.set(chave, { total: 1, reinicia: agora + janelaMs });
    if (janelas.size > 10_000) for (const [k, v] of janelas) if (v.reinicia < agora) janelas.delete(k);
    return;
  }
  j.total++;
  if (j.total > maximo) throw new ErroFluxo(429, "Muitas tentativas. Aguarde um pouco e tente de novo.");
}

/** Responde JSON e traduz ErroFluxo em status HTTP com mensagem para o usuário. */
export async function responderJson(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    if (erro instanceof ErroFluxo) return Response.json({ erro: erro.message }, { status: erro.status });
    console.error(erro);
    return Response.json({ erro: "Algo deu errado. Tente de novo em instantes." }, { status: 500 });
  }
}

export function urlBase(h: Headers) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
