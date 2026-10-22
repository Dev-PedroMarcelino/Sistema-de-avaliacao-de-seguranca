import type { EstadoIntegracao } from "@/lib/integracao/servico";

export type Estado = EstadoIntegracao;

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function lerResposta<T>(r: Response): Promise<T> {
  const corpo = await r.json().catch(() => ({ erro: "Sem conexão. Verifique a internet e tente de novo." }));
  if (!r.ok) throw new ErroApi(r.status, corpo.erro ?? "Algo deu errado.");
  return corpo as T;
}

export async function buscarEstado(token: string): Promise<Estado> {
  const r = await fetch(`/api/i/${token}`, { cache: "no-store" }).catch(() => {
    throw new ErroApi(0, "Sem conexão. Verifique a internet e tente de novo.");
  });
  return lerResposta<Estado>(r);
}

export async function enviar<T>(token: string, acao: string, corpo: unknown): Promise<T> {
  const r = await fetch(`/api/i/${token}/${acao}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  }).catch(() => {
    throw new ErroApi(0, "Sem conexão. Verifique a internet e tente de novo.");
  });
  return lerResposta<T>(r);
}

/** Envio que sobrevive à troca de app (o navegador entrega mesmo com a página indo para o fundo). */
export function enviarBeacon(token: string, acao: string, corpo: unknown) {
  const blob = new Blob([JSON.stringify(corpo)], { type: "application/json" });
  if (!navigator.sendBeacon?.(`/api/i/${token}/${acao}`, blob)) {
    void fetch(`/api/i/${token}/${acao}`, { method: "POST", body: blob, keepalive: true }).catch(() => {});
  }
}
