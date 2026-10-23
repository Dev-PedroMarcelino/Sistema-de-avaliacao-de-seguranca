import { type Db, um } from "@/lib/db";
import { diaLocal } from "@/lib/formato";
import type { Pergunta } from "@/lib/quiz";
import { soDigitos } from "@/lib/validacao";

export type SituacaoMotorista = "valida" | "vencendo" | "vencida" | "pendente";
export type SituacaoLink = "enviado" | "andamento" | "concluida" | "expirado";

const DIA = 86_400_000;
export const AVISO_VENCIMENTO_DIAS = 30;

export function situacaoDe(vigenteAte: Date | null | undefined, agora = new Date()): SituacaoMotorista {
  if (!vigenteAte) return "pendente";
  if (vigenteAte <= agora) return "vencida";
  if (vigenteAte.getTime() - agora.getTime() < AVISO_VENCIMENTO_DIAS * DIA) return "vencendo";
  return "valida";
}

export function situacaoLink(i: { etapa: string; expira_em: Date; aberto_em: Date | null }, agora = new Date()): SituacaoLink {
  if (i.etapa === "concluida" || i.etapa === "ja_valida") return "concluida";
  if (i.expira_em < agora && (i.etapa === "boas_vindas" || i.etapa === "identificacao")) return "expirado";
  if (!i.aberto_em) return "enviado";
  return "andamento";
}

export const NOME_ETAPA: Record<string, string> = {
  boas_vindas: "Abriu o link",
  identificacao: "Preenchendo dados",
  video: "Assistindo ao vídeo",
  quiz: "Respondendo perguntas",
  termo: "Assinando o termo",
  concluida: "Concluída",
  ja_valida: "Já tinha integração válida",
};

/** Início do dia e do mês no horário de Brasília (sem horário de verão desde 2019). */
function inicioDoDia(agora: Date) {
  return new Date(`${diaLocal(agora)}T00:00:00-03:00`);
}
function inicioDoMes(agora: Date) {
  return new Date(`${diaLocal(agora).slice(0, 8)}01T00:00:00-03:00`);
}

// ---------------------------------------------------------------------------

export interface LinhaMotorista {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  transportadora: string | null;
  placa: string | null;
  codigo: string | null;
  emitido_em: Date | null;
  vigente_ate: Date | null;
  integracoes: number;
  situacao: SituacaoMotorista;
}

export async function listarMotoristas(
  db: Db,
  empresaId: string,
  filtro: { busca?: string; situacao?: string; transportadoraId?: string } = {},
  agora = new Date(),
) {
  const busca = (filtro.busca ?? "").trim();
  const digitos = soDigitos(busca);
  const placa = busca.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const linhas = await db.query<Omit<LinhaMotorista, "situacao">>(
    `select m.id, m.nome, m.cpf, m.telefone, t.nome as transportadora, c.codigo, c.emitido_em, c.vigente_ate,
            (select i.placa from app.integracoes i where i.motorista_id = m.id and i.placa is not null
              order by i.criado_em desc limit 1) as placa,
            (select count(*)::int from app.comprovantes cc where cc.motorista_id = m.id) as integracoes
       from app.motoristas m
       left join app.transportadoras t on t.id = m.transportadora_id
       left join lateral (
         select codigo, emitido_em, vigente_ate from app.comprovantes_situacao cs
          where cs.motorista_id = m.id order by emitido_em desc limit 1
       ) c on true
      where m.empresa_id = $1
        and ($2::text = '' or m.nome ilike '%' || $2 || '%'
             or ($3::text <> '' and (m.cpf like $3 || '%' or m.telefone like '%' || $3 || '%'))
             or ($4::text <> '' and exists (select 1 from app.integracoes i where i.motorista_id = m.id and i.placa like $4 || '%')))
        and ($5::text = '' or m.transportadora_id::text = $5)
      order by coalesce(c.emitido_em, m.criado_em) desc
      limit 500`,
    [empresaId, busca, digitos.length >= 3 ? digitos : "", placa.length >= 3 ? placa : "", filtro.transportadoraId ?? ""],
  );
  const comSituacao = linhas.map((l) => ({ ...l, situacao: situacaoDe(l.vigente_ate, agora) }));
  return filtro.situacao ? comSituacao.filter((l) => l.situacao === filtro.situacao) : comSituacao;
}

export async function detalheMotorista(db: Db, empresaId: string, id: string) {
  const m = await um<{ id: string; nome: string; cpf: string; telefone: string; transportadora: string | null; criado_em: Date }>(
    db,
    `select m.id, m.nome, m.cpf, m.telefone, t.nome as transportadora, m.criado_em
       from app.motoristas m left join app.transportadoras t on t.id = m.transportadora_id
      where m.id = $1 and m.empresa_id = $2`,
    [id, empresaId],
  );
  if (!m) return null;
  const integracoes = await db.query<{
    id: string;
    etapa: string;
    origem: string;
    placa: string | null;
    criado_em: Date;
    concluida_em: Date | null;
    expira_em: Date;
    aberto_em: Date | null;
    unidade: string;
    codigo: string | null;
    vigente_ate: Date | null;
    versao: number | null;
  }>(
    `select i.id, i.etapa, i.origem, i.placa, i.criado_em, i.concluida_em, i.expira_em, i.aberto_em, u.nome as unidade,
            c.codigo, c.vigente_ate, v.numero as versao
       from app.integracoes i
       join app.unidades u on u.id = i.unidade_id
       left join app.comprovantes_situacao c on c.integracao_id = i.id
       left join app.versoes v on v.id = i.versao_id
      where i.motorista_id = $1 order by i.criado_em desc`,
    [id],
  );
  return { motorista: m, integracoes };
}

export interface LinhaLink {
  id: string;
  token: string;
  origem: string;
  nome: string | null;
  telefone: string;
  etapa: string;
  criado_em: Date;
  expira_em: Date;
  aberto_em: Date | null;
  unidade: string;
  por: string | null;
  situacao: SituacaoLink;
}

export async function listarLinks(db: Db, empresaId: string, filtro: { situacao?: string } = {}, agora = new Date()) {
  const linhas = await db.query<Omit<LinhaLink, "situacao">>(
    `select i.id, i.token, i.origem, coalesce(m.nome, i.nome_informado) as nome, i.telefone, i.etapa, i.criado_em,
            i.expira_em, i.aberto_em, un.nome as unidade, us.nome as por
       from app.integracoes i
       join app.unidades un on un.id = i.unidade_id
       left join app.motoristas m on m.id = i.motorista_id
       left join app.usuarios us on us.id = i.criado_por
      where i.empresa_id = $1
      order by i.criado_em desc limit 300`,
    [empresaId],
  );
  const comSituacao = linhas.map((l) => ({ ...l, situacao: situacaoLink(l, agora) }));
  return filtro.situacao ? comSituacao.filter((l) => l.situacao === filtro.situacao) : comSituacao;
}

export async function detalheIntegracao(db: Db, empresaId: string, id: string) {
  return um<{
    id: string;
    token: string;
    origem: string;
    etapa: string;
    nome_informado: string | null;
    telefone: string;
    placa: string | null;
    criado_em: Date;
    expira_em: Date;
    aberto_em: Date | null;
    concluida_em: Date | null;
    progresso_seg: number;
    saidas_tela: number;
    motorista_id: string | null;
    motorista: string | null;
    cpf: string | null;
    transportadora: string | null;
    unidade: string;
    versao: number | null;
    duracao_seg: number | null;
    codigo: string | null;
    vigente_ate: Date | null;
    conferido_em: Date | null;
    conferido_por: string | null;
    criado_por: string | null;
  }>(
    db,
    `select i.id, i.token, i.origem, i.etapa, i.nome_informado, i.telefone, i.placa, i.criado_em, i.expira_em, i.aberto_em,
            i.concluida_em, i.progresso_seg, i.saidas_tela, i.motorista_id, m.nome as motorista, m.cpf,
            t.nome as transportadora, un.nome as unidade, v.numero as versao, v.duracao_seg,
            coalesce(c.codigo, cv.codigo) as codigo, coalesce(c.vigente_ate, cv.vigente_ate) as vigente_ate,
            i.conferido_em, uc.nome as conferido_por, ug.nome as criado_por
       from app.integracoes i
       join app.unidades un on un.id = i.unidade_id
       left join app.motoristas m on m.id = i.motorista_id
       left join app.transportadoras t on t.id = i.transportadora_id
       left join app.versoes v on v.id = i.versao_id
       left join app.comprovantes_situacao c on c.integracao_id = i.id
       left join app.comprovantes_situacao cv on cv.id = i.comprovante_vigente_id
       left join app.usuarios uc on uc.id = i.conferido_por
       left join app.usuarios ug on ug.id = i.criado_por
      where i.id = $1 and i.empresa_id = $2`,
    [id, empresaId],
  );
}

/** Busca da portaria: placa, CPF ou nome. Mostra a integração mais recente de cada motorista. */
export async function buscarNaPortaria(db: Db, empresaId: string, termo: string, agora = new Date()) {
  const t = termo.trim();
  if (t.length < 3) return [];
  const placa = t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digitos = soDigitos(t);
  const linhas = await db.query<{
    motorista_id: string;
    nome: string;
    cpf: string;
    transportadora: string | null;
    integracao_id: string | null;
    placa: string | null;
    codigo: string | null;
    vigente_ate: Date | null;
    conferido_em: Date | null;
    etapa: string | null;
  }>(
    `select m.id as motorista_id, m.nome, m.cpf, t.nome as transportadora, ult.id as integracao_id, ult.placa,
            c.codigo, c.vigente_ate, ult.conferido_em, ult.etapa
       from app.motoristas m
       left join app.transportadoras t on t.id = m.transportadora_id
       left join lateral (
         select cs.* from app.comprovantes_situacao cs where cs.motorista_id = m.id order by cs.emitido_em desc limit 1
       ) c on true
       left join lateral (
         select i.id, i.placa, i.conferido_em, i.etapa from app.integracoes i
          where i.motorista_id = m.id order by (i.etapa in ('concluida', 'ja_valida')) desc, i.criado_em desc limit 1
       ) ult on true
      where m.empresa_id = $1
        and (m.nome ilike '%' || $2 || '%'
             or ($3::text <> '' and m.cpf like $3 || '%')
             or ($4::text <> '' and exists (select 1 from app.integracoes i where i.motorista_id = m.id and i.placa = $4)))
      order by c.vigente_ate desc nulls last limit 20`,
    [empresaId, t, digitos.length >= 3 ? digitos : "", placa.length >= 7 ? placa : ""],
  );
  return linhas.map((l) => ({ ...l, situacao: situacaoDe(l.vigente_ate, agora) }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function resumoPainel(db: Db, empresaId: string, agora = new Date()) {
  const hoje = inicioDoDia(agora);
  const mes = inicioDoMes(agora);
  const trintaDias = new Date(agora.getTime() - 30 * DIA);
  const iso = (d: Date) => d.toISOString();

  const kpi = (await um<{ hoje: number; mes: number; pendentes: number }>(
    db,
    `select
       (select count(*)::int from app.comprovantes where empresa_id = $1 and emitido_em >= $2::timestamptz) as hoje,
       (select count(*)::int from app.comprovantes where empresa_id = $1 and emitido_em >= $3::timestamptz) as mes,
       (select count(*)::int from app.integracoes where empresa_id = $1 and etapa not in ('concluida', 'ja_valida')
          and not (expira_em < $4::timestamptz and etapa in ('boas_vindas', 'identificacao'))) as pendentes`,
    [empresaId, iso(hoje), iso(mes), iso(agora)],
  ))!;

  const ultimos = await db.query<{ vigente_ate: Date }>(
    `select distinct on (motorista_id) vigente_ate from app.comprovantes_situacao
      where empresa_id = $1 order by motorista_id, emitido_em desc`,
    [empresaId],
  );
  const vigentes = ultimos.filter((u) => u.vigente_ate > agora).length;
  const vencendo = ultimos.filter((u) => situacaoDe(u.vigente_ate, agora) === "vencendo").length;

  const funilBruto = (await um<Record<string, number>>(
    db,
    `select count(*)::int as criados,
            count(aberto_em)::int as abertos,
            count(identificado_em)::int as identificados,
            count(video_concluido_em)::int as video,
            count(quiz_concluido_em)::int as quiz,
            count(concluida_em)::int as assinados
       from app.integracoes where empresa_id = $1 and criado_em >= $2::timestamptz and etapa <> 'ja_valida'`,
    [empresaId, iso(trintaDias)],
  ))!;
  const funil = [
    { etapa: "Link criado", total: funilBruto.criados },
    { etapa: "Abriu o link", total: funilBruto.abertos },
    { etapa: "Informou os dados", total: funilBruto.identificados },
    { etapa: "Assistiu ao vídeo", total: funilBruto.video },
    { etapa: "Acertou as perguntas", total: funilBruto.quiz },
    { etapa: "Assinou o termo", total: funilBruto.assinados },
  ];

  const emitidos = await db.query<{ emitido_em: Date }>(
    "select emitido_em from app.comprovantes where empresa_id = $1 and emitido_em >= $2::timestamptz",
    [empresaId, iso(new Date(inicioDoDia(agora).getTime() - 29 * DIA))],
  );
  const porDia = Array.from({ length: 30 }, (_, i) => {
    const d = diaLocal(new Date(agora.getTime() - (29 - i) * DIA));
    return { dia: d, total: 0 };
  });
  for (const e of emitidos) {
    const d = porDia.find((p) => p.dia === diaLocal(e.emitido_em));
    if (d) d.total++;
  }

  const textos = new Map<string, string>();
  const versoes = await db.query<{ perguntas: Pergunta[] }>(
    `select v.perguntas from app.versoes v join app.treinamentos t on t.id = v.treinamento_id
      where t.empresa_id = $1 order by v.numero`,
    [empresaId],
  );
  for (const v of versoes) for (const p of v.perguntas) textos.set(p.id, p.texto);
  const erros = await db.query<{ pergunta_id: string; respondidas: number; erraram: number }>(
    `select r.pergunta_id,
            count(distinct r.integracao_id)::int as respondidas,
            count(distinct r.integracao_id) filter (where r.tentativa = 1 and not r.correta)::int as erraram
       from app.respostas r join app.integracoes i on i.id = r.integracao_id
      where i.empresa_id = $1 and r.respondida_em >= $2::timestamptz
      group by r.pergunta_id`,
    [empresaId, iso(new Date(agora.getTime() - 90 * DIA))],
  );
  const errosPorPergunta = erros
    .map((e) => ({ ...e, texto: textos.get(e.pergunta_id) ?? e.pergunta_id, taxa: e.respondidas ? e.erraram / e.respondidas : 0 }))
    .sort((a, b) => b.taxa - a.taxa);

  const porTransportadora = await db.query<{ transportadora: string; total: number }>(
    `select coalesce(dados->>'transportadora', '—') as transportadora, count(*)::int as total
       from app.comprovantes where empresa_id = $1 and emitido_em >= $2::timestamptz
      group by 1 order by 2 desc limit 8`,
    [empresaId, iso(trintaDias)],
  );

  const tempos = (await um<{ medio: number | null; saidas: number | null }>(
    db,
    `select avg(extract(epoch from (concluida_em - iniciado_em)))::float as medio, avg(saidas_tela)::float as saidas
       from app.integracoes where empresa_id = $1 and concluida_em >= $2::timestamptz`,
    [empresaId, iso(trintaDias)],
  ))!;

  const recentes = await db.query<{ integracao_id: string; nome: string; placa: string | null; emitido_em: Date; codigo: string }>(
    `select integracao_id, dados->'motorista'->>'nome' as nome, dados->>'placa' as placa, emitido_em, codigo
       from app.comprovantes where empresa_id = $1 order by emitido_em desc limit 6`,
    [empresaId],
  );

  return { kpi: { ...kpi, vigentes, vencendo }, funil, porDia, errosPorPergunta, porTransportadora, tempos, recentes };
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

export interface FiltroRelatorio {
  de: string;
  ate: string;
  unidadeId?: string;
  transportadora?: string;
  situacao?: string;
}

export async function relatorio(db: Db, empresaId: string, f: FiltroRelatorio, agora = new Date()) {
  const de = new Date(`${f.de}T00:00:00-03:00`);
  const ate = new Date(new Date(`${f.ate}T00:00:00-03:00`).getTime() + DIA);
  const linhas = await db.query<{
    integracao_id: string;
    emitido_em: Date;
    codigo: string;
    vigente_ate: Date;
    nome: string;
    cpf: string;
    telefone: string;
    placa: string | null;
    transportadora: string | null;
    unidade: string;
    origem: string;
    saidas: number;
    tentativas: number;
    versao: number;
    conferido: boolean;
  }>(
    `select c.integracao_id, c.emitido_em, c.codigo, c.vigente_ate,
            c.dados->'motorista'->>'nome' as nome, c.dados->'motorista'->>'cpf' as cpf,
            c.dados->'motorista'->>'telefone' as telefone, c.dados->>'placa' as placa,
            c.dados->>'transportadora' as transportadora, un.nome as unidade, i.origem,
            (c.dados->'video'->>'saidas_tela')::int as saidas,
            (select count(*)::int from app.respostas r where r.integracao_id = c.integracao_id) as tentativas,
            (c.dados->'treinamento'->>'versao')::int as versao,
            i.conferido_em is not null as conferido
       from app.comprovantes_situacao c
       join app.integracoes i on i.id = c.integracao_id
       join app.unidades un on un.id = i.unidade_id
      where c.empresa_id = $1 and c.emitido_em >= $2::timestamptz and c.emitido_em < $3::timestamptz
        and ($4::text = '' or i.unidade_id::text = $4)
        and ($5::text = '' or c.dados->>'transportadora' = $5)
      order by c.emitido_em desc`,
    [empresaId, de.toISOString(), ate.toISOString(), f.unidadeId ?? "", f.transportadora ?? ""],
  );
  const comSituacao = linhas.map((l) => ({ ...l, situacao: situacaoDe(l.vigente_ate, agora) }));
  return f.situacao ? comSituacao.filter((l) => l.situacao === f.situacao) : comSituacao;
}

export function listarUnidades(db: Db, empresaId: string) {
  return db.query<{ id: string; nome: string; slug: string }>(
    "select id, nome, slug from app.unidades where empresa_id = $1 order by nome",
    [empresaId],
  );
}

export function listarTransportadoras(db: Db, empresaId: string) {
  return db.query<{ id: string; nome: string }>(
    "select id, nome from app.transportadoras where empresa_id = $1 order by nome",
    [empresaId],
  );
}

export function obterEmpresa(db: Db, empresaId: string) {
  return um<{
    id: string;
    nome: string;
    slug: string;
    cor: string;
    mensagem_whatsapp: string;
    validade_link_dias: number;
    whatsapp_alertas: string | null;
    aviso_antecedencia_dias: number;
    avisar_motorista: boolean;
  }>(
    db,
    "select id, nome, slug, cor, mensagem_whatsapp, validade_link_dias, whatsapp_alertas, aviso_antecedencia_dias, avisar_motorista from app.empresas where id = $1",
    [empresaId],
  );
}

export function ultimosAlertas(db: Db, empresaId: string) {
  return db.query<{ nome: string; placa: string | null; tipo: string; status: string; criado_em: Date; enviado_em: Date | null; ultimo_erro: string | null }>(
    `select c.dados->'motorista'->>'nome' as nome, c.dados->>'placa' as placa, a.tipo, a.status, a.criado_em, a.enviado_em, a.ultimo_erro
       from app.alertas_vencimento a join app.comprovantes c on c.id = a.comprovante_id
      where a.empresa_id = $1 order by a.criado_em desc limit 10`,
    [empresaId],
  );
}
