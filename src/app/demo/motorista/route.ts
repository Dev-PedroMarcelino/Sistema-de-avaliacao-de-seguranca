import { getDb, um } from "@/lib/db";
import { criarIntegracao } from "@/lib/integracao/servico";
import { ipDe, limitar, urlBase, userAgentDe } from "@/lib/requisicao";

export const dynamic = "force-dynamic";

/** Modo demo: cria uma integração na hora para o visitante experimentar o fluxo do motorista. */
export async function GET(req: Request) {
  if (process.env.DEMO_MODE !== "true") return new Response("Modo demo desligado.", { status: 404 });
  limitar(`demo:${ipDe(req.headers)}`, 20, 60 * 60_000);
  const db = await getDb();
  const unidade = await um<{ id: string }>(
    db,
    "select u.id from app.unidades u join app.empresas e on e.id = u.empresa_id where e.slug = 'demo' order by u.nome limit 1",
  );
  if (!unidade) return new Response("Dados de demonstração não encontrados.", { status: 404 });
  const telefone = `5519${9}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const { token } = await criarIntegracao(
    { db, ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) },
    { unidadeId: unidade.id, origem: "link", telefone, nome: "Visitante Demo", transportadora: "Transportes Rodoserra" },
  );
  return Response.redirect(`${urlBase(req.headers)}/i/${token}`, 303);
}
