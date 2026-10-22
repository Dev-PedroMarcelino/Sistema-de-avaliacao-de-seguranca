import { sessaoAtual } from "@/lib/auth/servidor";
import { podeAcessar } from "@/lib/auth/sessao";
import { getDb, um } from "@/lib/db";
import { dadosParaPdf, respostaPdf } from "@/lib/pdf/carregar";
import { pdfComprovante, pdfDossie } from "@/lib/pdf/documentos";
import { urlBase } from "@/lib/requisicao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const u = await sessaoAtual();
  if (!u) return new Response("Sessão expirada.", { status: 401 });
  const { codigo } = await params;
  const tipo = new URL(req.url).searchParams.get("tipo") === "dossie" ? "dossie" : "comprovante";
  if (tipo === "dossie" && !podeAcessar(u.perfil, "relatorios")) return new Response("Sem permissão.", { status: 403 });

  const db = await getDb();
  const daEmpresa = await um(db, "select 1 from app.comprovantes where codigo = $1 and empresa_id = $2", [codigo, u.empresaId]);
  if (!daEmpresa) return new Response("Comprovante não encontrado.", { status: 404 });
  const dados = await dadosParaPdf(db, codigo, urlBase(req.headers));
  if (!dados) return new Response("Comprovante não encontrado.", { status: 404 });
  return tipo === "dossie"
    ? respostaPdf(await pdfDossie(dados), `dossie-${codigo}.pdf`)
    : respostaPdf(await pdfComprovante(dados), `comprovante-${codigo}.pdf`);
}
