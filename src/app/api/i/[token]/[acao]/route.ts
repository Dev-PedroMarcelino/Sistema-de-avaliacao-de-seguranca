import { getDb } from "@/lib/db";
import { ErroFluxo, assinar, iniciar, identificar, responder, sinalVideo } from "@/lib/integracao/servico";
import { ipDe, limitar, responderJson, userAgentDe } from "@/lib/requisicao";

export const dynamic = "force-dynamic";

const ACOES = {
  inicio: iniciar,
  identificacao: identificar,
  video: sinalVideo,
  resposta: responder,
  assinatura: assinar,
} as const;

export async function POST(req: Request, { params }: { params: Promise<{ token: string; acao: string }> }) {
  const { token, acao } = await params;
  return responderJson(async () => {
    const fn = ACOES[acao as keyof typeof ACOES];
    if (!fn) throw new ErroFluxo(404, "Ação desconhecida.");
    limitar(`acao:${token}`, 60, 60_000);
    // O player usa sendBeacon ao sair da tela, que pode chegar como texto.
    let corpo: unknown;
    try {
      corpo = JSON.parse(await req.text());
    } catch {
      throw new ErroFluxo(400, "Requisição inválida.");
    }
    const ctx = { db: await getDb(), ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) };
    return (fn as (c: typeof ctx, t: string, e: unknown) => Promise<unknown>)(ctx, token, corpo);
  });
}
