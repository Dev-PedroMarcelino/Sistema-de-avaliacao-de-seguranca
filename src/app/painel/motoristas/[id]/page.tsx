import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Tabela } from "@/components/painel";
import { SeloSituacao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { NOME_ETAPA, detalheMotorista, situacaoDe, situacaoLink } from "@/lib/painel/consultas";
import * as fmt from "@/lib/formato";

export const metadata: Metadata = { title: "Motorista" };

export default async function Motorista({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario("motoristas");
  const { id } = await params;
  const r = await detalheMotorista(await getDb(), u.empresaId, id);
  if (!r) notFound();
  const { motorista: m, integracoes } = r;
  const ultima = integracoes.find((i) => i.vigente_ate);
  const situacao = situacaoDe(ultima?.vigente_ate);

  return (
    <>
      <Link href="/painel/motoristas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-tinta">
        <ArrowLeft className="h-4 w-4" /> Motoristas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <div>
          <h1 className="text-2xl font-extrabold">{m.nome}</h1>
          <p className="mt-1 text-stone-600">
            CPF {fmt.cpf(m.cpf)} · {fmt.telefone(m.telefone)} · {m.transportadora ?? "sem transportadora"}
          </p>
          <p className="mt-1 text-xs text-stone-500">Cadastrado em {fmt.data(m.criado_em)}</p>
        </div>
        <div className="text-right">
          <SeloSituacao situacao={situacao} />
          {ultima?.vigente_ate && (
            <p className="mt-1 text-sm text-stone-600">
              {situacao === "vencida" ? "Venceu em" : "Válida até"} {fmt.data(ultima.vigente_ate)}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold">Histórico de integrações</h2>
      <Tabela>
        <thead>
          <tr>
            <th>Data</th>
            <th>Situação</th>
            <th>Placa</th>
            <th>Unidade</th>
            <th>Comprovante</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {integracoes.map((i) => {
            const s = situacaoLink(i);
            return (
              <tr key={i.id} className="hover:bg-stone-50">
                <td className="whitespace-nowrap">{fmt.dataHora(i.concluida_em ?? i.criado_em)}</td>
                <td>
                  {i.vigente_ate ? (
                    <SeloSituacao situacao={situacaoDe(i.vigente_ate)} />
                  ) : (
                    <SeloSituacao situacao={s === "expirado" ? "expirado" : "andamento"}>
                      {s === "concluida" ? NOME_ETAPA[i.etapa] : s === "expirado" ? "Expirado" : NOME_ETAPA[i.etapa]}
                    </SeloSituacao>
                  )}
                </td>
                <td className="font-mono">{fmt.placa(i.placa)}</td>
                <td className="text-stone-600">
                  {i.unidade}
                  <p className="text-xs text-stone-500">{i.origem === "qr" ? "QR da portaria" : "Link WhatsApp"}{i.versao ? ` · v${i.versao}` : ""}</p>
                </td>
                <td className="font-mono text-xs">{i.codigo ?? "—"}</td>
                <td className="text-right">
                  <Link href={`/painel/integracoes/${i.id}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                    Linha do tempo <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>
    </>
  );
}
