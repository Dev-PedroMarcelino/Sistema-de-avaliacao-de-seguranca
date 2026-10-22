import { getDb, um } from "@/lib/db";
import { dadosParaPdf, respostaPdf } from "@/lib/pdf/carregar";
import { pdfComprovante } from "@/lib/pdf/documentos";
import { urlBase } from "@/lib/requisicao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** O motorista baixa o próprio comprovante (o token do link é o segredo). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const c = await um<{ codigo: string }>(
    db,
    `select c.codigo from app.integracoes i
       join app.comprovantes c on c.id = coalesce(
         (select id from app.comprovantes where integracao_id = i.id), i.comprovante_vigente_id)
      where i.token = $1`,
    [token],
  );
  if (!c) return new Response("Comprovante ainda não emitido.", { status: 404 });
  const dados = await dadosParaPdf(db, c.codigo, urlBase(req.headers));
  if (!dados) return new Response("Comprovante não encontrado.", { status: 404 });
  return respostaPdf(await pdfComprovante(dados), `comprovante-${c.codigo}.pdf`);
}
