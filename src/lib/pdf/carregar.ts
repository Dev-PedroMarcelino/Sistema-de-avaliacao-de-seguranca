import { type Db, um } from "@/lib/db";
import { verificarComprovante } from "@/lib/integracao/servico";

/** Junta tudo o que o comprovante e o dossiê em PDF precisam. */
export async function dadosParaPdf(db: Db, codigo: string, urlBase: string) {
  const v = await verificarComprovante(db, codigo);
  if (!v) return null;
  const conferido = await um<{ nome: string; conferido_em: Date }>(
    db,
    `select u.nome, i.conferido_em from app.integracoes i join app.usuarios u on u.id = i.conferido_por
      where i.id = $1`,
    [v.comprovante.integracao_id],
  );
  return {
    dados: v.comprovante.dados,
    hash: v.comprovante.hash,
    vigenteAte: v.comprovante.vigente_ate,
    assinatura: v.assinatura ?? null,
    urlVerificacao: `${urlBase}/v/${codigo}`,
    conferidoPor: conferido ? `${conferido.nome}` : null,
    eventos: v.eventos,
    correnteValida: v.corrente.valida && v.autentico,
  };
}

export function respostaPdf(pdf: Buffer, nome: string, baixar = true) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
