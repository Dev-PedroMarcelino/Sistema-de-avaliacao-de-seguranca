import { getDb } from "@/lib/db";
import { obterEstado } from "@/lib/integracao/servico";
import { ipDe, limitar, responderJson, userAgentDe } from "@/lib/requisicao";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return responderJson(async () => {
    limitar(`estado:${ipDe(req.headers)}`, 120, 60_000);
    return obterEstado({ db: await getDb(), ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) }, token);
  });
}
