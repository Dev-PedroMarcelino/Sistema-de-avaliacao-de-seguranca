import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import { BotaoLink } from "@/components/ui";
import { BarrasHorizontais, Cabecalho, Colunas, Kpi, Painel } from "@/components/painel";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { resumoPainel } from "@/lib/painel/consultas";
import * as fmt from "@/lib/formato";

export const metadata: Metadata = { title: "Visão geral" };

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function Dashboard() {
  const u = await exigirUsuario("dashboard");
  const r = await resumoPainel(await getDb(), u.empresaId);
  const criados = r.funil[0].total || 1;

  return (
    <>
      <Cabecalho
        titulo="Visão geral"
        descricao="Integrações de segurança dos motoristas externos."
        acoes={
          <BotaoLink href="/painel/links" variante="marca">
            <Link2 className="h-4 w-4" /> Enviar link
          </BotaoLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Concluídas hoje" valor={r.kpi.hoje} destaque />
        <Kpi rotulo="Concluídas no mês" valor={r.kpi.mes} />
        <Kpi rotulo="Motoristas liberados" valor={r.kpi.vigentes} detalhe="com integração válida" />
        <Kpi rotulo="Vencendo em 30 dias" valor={r.kpi.vencendo} detalhe="precisam refazer em breve" />
        <Kpi rotulo="Em aberto" valor={r.kpi.pendentes} detalhe="links enviados não concluídos" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Painel titulo="Integrações concluídas por dia" subtitulo="Últimos 30 dias" className="lg:col-span-2">
          <Colunas
            itens={r.porDia.map((d) => ({
              rotulo: fmt.data(`${d.dia}T12:00:00-03:00`).slice(0, 5),
              dica: `${fmt.data(`${d.dia}T12:00:00-03:00`)}: ${d.total} ${d.total === 1 ? "integração" : "integrações"}`,
              valor: d.total,
            }))}
          />
        </Painel>
        <Painel titulo="Tempo e atenção" subtitulo="Integrações concluídas nos últimos 30 dias">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-stone-500">Tempo médio do início à assinatura</dt>
              <dd className="text-2xl font-bold tabular-nums">{r.tempos.medio ? fmt.duracao(r.tempos.medio) : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Saídas da tela por motorista (média)</dt>
              <dd className="text-2xl font-bold tabular-nums">
                {r.tempos.saidas != null ? r.tempos.saidas.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
              </dd>
            </div>
          </dl>
        </Painel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel titulo="Funil das integrações" subtitulo="Links criados nos últimos 30 dias: onde os motoristas param">
          <BarrasHorizontais
            itens={r.funil.map((f) => ({ rotulo: f.etapa, valor: f.total, dica: `${f.etapa}: ${f.total} (${pct(f.total / criados)})` }))}
            formatar={(v) => `${v} · ${pct(v / criados)}`}
            maximo={criados}
          />
        </Painel>
        <Painel titulo="Perguntas que mais erram" subtitulo="Erraram na 1ª tentativa, últimos 90 dias: sinal do que reforçar no vídeo">
          <BarrasHorizontais
            itens={r.errosPorPergunta.map((e) => ({
              rotulo: e.texto,
              valor: e.taxa,
              dica: `${e.erraram} de ${e.respondidas} motoristas erraram de primeira`,
            }))}
            formatar={pct}
            maximo={1}
          />
        </Painel>
        <Painel titulo="Por transportadora" subtitulo="Concluídas nos últimos 30 dias">
          <BarrasHorizontais itens={r.porTransportadora.map((t) => ({ rotulo: t.transportadora, valor: t.total }))} />
        </Painel>
        <Painel titulo="Últimas concluídas">
          <ul className="divide-y divide-stone-100">
            {r.recentes.map((c) => (
              <li key={c.codigo}>
                <Link
                  href={`/painel/integracoes/${c.integracao_id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-amber-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.nome}</span>
                    <span className="text-xs text-stone-500">
                      {fmt.placa(c.placa)} · {fmt.dataHora(c.emitido_em)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-stone-500">
                    {c.codigo} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Painel>
      </div>
    </>
  );
}
