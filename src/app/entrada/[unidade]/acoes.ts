"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, um } from "@/lib/db";
import { ErroFluxo, criarIntegracao } from "@/lib/integracao/servico";
import { ipDe, limitar, userAgentDe } from "@/lib/requisicao";
import { nomeValido, normalizarTelefone } from "@/lib/validacao";

export async function entrarPeloQr(_: { erro: string } | null, form: FormData) {
  const h = await headers();
  const slug = String(form.get("unidade") ?? "");
  const nome = String(form.get("nome") ?? "");
  const telefone = normalizarTelefone(String(form.get("telefone") ?? ""));
  if (!nomeValido(nome)) return { erro: "Informe nome e sobrenome." };
  if (!telefone) return { erro: "Informe o WhatsApp com DDD, ex.: (19) 99999-1234." };

  let token: string;
  try {
    limitar(`qr:${ipDe(h)}`, 10, 10 * 60_000);
    const db = await getDb();
    const unidade = await um<{ id: string }>(db, "select id from app.unidades where slug = $1", [slug]);
    if (!unidade) return { erro: "Unidade não encontrada." };
    ({ token } = await criarIntegracao(
      { db, ip: ipDe(h), userAgent: userAgentDe(h) },
      { unidadeId: unidade.id, origem: "qr", telefone, nome },
    ));
  } catch (e) {
    return { erro: e instanceof ErroFluxo ? e.message : "Algo deu errado. Tente de novo." };
  }
  redirect(`/i/${token}`);
}
