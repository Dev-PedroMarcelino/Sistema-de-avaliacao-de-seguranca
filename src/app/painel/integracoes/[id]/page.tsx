import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { SeloSituacao, classesBotao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { podeAcessar } from "@/lib/auth/sessao";
import { getDb } from "@/lib/db";
import { verificarCorrente } from "@/lib/hash";
import { listarEventos } from "@/lib/integracao/servico";
import { ROTULOS_EVENTO, detalheEvento } from "@/lib/integracao/rotulos";
import { NOME_ETAPA, detalheIntegracao, situacaoDe, situacaoLink } from "@/lib/painel/consultas";
import * as fmt from "@/lib/formato";
import { BotaoConferir } from "../../portaria/botao-conferir";
import { MostrarSinais } from "./mostrar-sinais";

export const metadata: Metadata = { title: "Integração" };

export default async function DetalheIntegracao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sinais?: string }>;
}) {
  const u = await exigirUsuario("motoristas");
  const { id } = await params;
  const { sinais } = await searchParams;
  const db = await getDb();
  const i = await detalheIntegracao(db, u.empresaId, id);
  if (!i) notFound();
  const eventos = await listarEventos(db, i.id);
  const corrente = verificarCorrente(eventos);
  const visiveis = sinais ? eventos : eventos.filter((e) => e.tipo !== "video_progresso");
  const situacao = situacaoLink(i);
  const concluida = i.etapa === "concluida" || i.etapa === "ja_valida";
  const verDossie = podeAcessar(u.perfil, "relatorios");

  return (
    <>
      <Link
        href={i.motorista_id ? `/painel/motoristas/${i.motorista_id}` : "/painel/links"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-tinta"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{i.motorista ?? i.nome_informado ?? "Motorista sem nome"}</h1>
          <p className="mt-1 text-stone-600">
            {fmt.telefone(i.telefone)} · {i.unidade} · {i.origem === "qr" ? "entrou pelo QR da portaria" : `link criado${i.criado_por ? ` por ${i.criado_por}` : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {concluida && i.codigo && (
            <>
              <a href={`/api/painel/comprovantes/${i.codigo}?tipo=comprovante`} className={classesBotao("contorno", "sm")}>
                <FileDown className="h-4 w-4" /> Comprovante
              </a>
              {verDossie && (
                <a href={`/api/painel/comprovantes/${i.codigo}?tipo=dossie`} className={classesBotao("primario", "sm")}>
                  <FileText className="h-4 w-4" /> Dossiê para o jurídico
                </a>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="mb-3 font-bold">Situação</h2>
            {concluida && i.vigente_ate ? (
              <SeloSituacao situacao={situacaoDe(i.vigente_ate)} />
            ) : (
              <SeloSituacao situacao={situacao === "expirado" ? "expirado" : situacao === "enviado" ? "pendente" : "andamento"}>
                {situacao === "enviado" ? "Link ainda não aberto" : situacao === "expirado" ? "Link expirado" : NOME_ETAPA[i.etapa]}
              </SeloSituacao>
            )}
            <dl className="mt-4 space-y-2.5 text-sm">
              <Linha rotulo="CPF" valor={i.cpf ? fmt.cpf(i.cpf) : "—"} />
              <Linha rotulo="Placa" valor={fmt.placa(i.placa)} />
              <Linha rotulo="Transportadora" valor={i.transportadora ?? "—"} />
              <Linha rotulo="Versão do conteúdo" valor={i.versao ? `v${i.versao}` : "—"} />
              {!concluida && i.duracao_seg ? (
                <Linha rotulo="Vídeo assistido" valor={`${fmt.duracao(i.progresso_seg)} de ${fmt.duracao(i.duracao_seg)}`} />
              ) : null}
              <Linha rotulo="Saídas da tela" valor={String(i.saidas_tela)} />
              {i.codigo && <Linha rotulo="Comprovante" valor={i.codigo} mono />}
              {i.vigente_ate && <Linha rotulo="Válida até" valor={fmt.data(i.vigente_ate)} />}
              {!concluida && <Linha rotulo="Link vale até" valor={fmt.dataHora(i.expira_em)} />}
            </dl>
          </section>

          {concluida && (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-2 font-bold">Portaria</h2>
              {i.conferido_em ? (
                <p className="text-sm text-stone-600">
                  Conferido por <strong>{i.conferido_por}</strong> em {fmt.dataHora(i.conferido_em)}.
                </p>
              ) : (
                <BotaoConferir integracaoId={i.id} />
              )}
            </section>
          )}

          <section
            className={`rounded-2xl p-5 ring-1 ${corrente.valida ? "bg-green-50 ring-green-200" : "bg-red-50 ring-red-200"}`}
          >
            <h2 className="flex items-center gap-2 font-bold">
              {corrente.valida ? <ShieldCheck className="h-5 w-5 text-green-700" /> : <ShieldAlert className="h-5 w-5 text-red-700" />}
              Trilha de auditoria {corrente.valida ? "íntegra" : "quebrada"}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {corrente.valida
                ? `${eventos.length} eventos encadeados por SHA-256. Nenhum foi alterado ou removido.`
                : `O evento #${corrente.quebraNoSeq} não confere: ${corrente.motivo}.`}
            </p>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Linha do tempo</h2>
            <MostrarSinais ativo={Boolean(sinais)} total={eventos.length - eventos.filter((e) => e.tipo !== "video_progresso").length} />
          </div>
          <ol className="relative space-y-0">
            {visiveis.map((e, k) => (
              <li key={e.seq} className="relative flex gap-4 pb-5">
                {k < visiveis.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-stone-200" />}
                <span
                  className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-white ${corDoEvento(e.tipo, e.dados)}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">{ROTULOS_EVENTO[e.tipo] ?? e.tipo}</p>
                    <p className="text-xs tabular-nums text-stone-500">{fmt.dataHora(e.ocorrido_em)}</p>
                  </div>
                  {detalheEvento(e.tipo, e.dados) && <p className="text-sm text-stone-600">{detalheEvento(e.tipo, e.dados)}</p>}
                  <p className="mt-0.5 truncate font-mono text-[11px] text-stone-400" title={`${e.user_agent ?? ""}\n${e.hash}`}>
                    #{e.seq} · {e.ip ?? "—"} · {e.hash.slice(0, 16)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function corDoEvento(tipo: string, dados: Record<string, unknown>) {
  if (tipo === "resposta") return dados.correta ? "bg-green-600" : "bg-red-600";
  if (tipo === "video_pausado" || tipo === "video_fim_recusado") return "bg-amber-500";
  if (tipo === "comprovante_emitido" || tipo === "conferido_portaria") return "bg-tinta";
  return "bg-stone-300";
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{rotulo}</dt>
      <dd className={`text-right font-semibold ${mono ? "font-mono" : ""}`}>{valor}</dd>
    </div>
  );
}
