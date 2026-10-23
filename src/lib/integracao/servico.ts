import { z } from "zod";
import { type Db, um } from "@/lib/db";
import { canonico, hashComprovante, hashEvento, sha256, verificarCorrente } from "@/lib/hash";
import { codigoComprovante, tokenLink } from "@/lib/codigo";
import { cpfValido, nomeValido, normalizarNome, normalizarPlaca, soDigitos } from "@/lib/validacao";
import { avancarProgresso, videoConcluido } from "@/lib/video";
import { ESPERA_APOS_ERRO_MS, type Pergunta, perguntaPublica, sortearPerguntas } from "@/lib/quiz";
import * as fmt from "@/lib/formato";

export class ErroFluxo extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Quem fez a ação e quando (o horário é sempre o do servidor). */
export interface Contexto {
  db: Db;
  agora?: Date;
  ip?: string | null;
  userAgent?: string | null;
}

type Etapa = "boas_vindas" | "identificacao" | "video" | "quiz" | "termo" | "concluida" | "ja_valida";

interface Integracao {
  id: string;
  empresa_id: string;
  unidade_id: string;
  treinamento_id: string;
  versao_id: string | null;
  token: string;
  origem: "link" | "qr";
  nome_informado: string | null;
  telefone: string;
  transportadora_informada: string | null;
  expira_em: Date;
  etapa: Etapa;
  motorista_id: string | null;
  placa: string | null;
  transportadora_id: string | null;
  perguntas_ids: string[] | null;
  aberto_em: Date | null;
  iniciado_em: Date | null;
  video_iniciado_em: Date | null;
  video_concluido_em: Date | null;
  progresso_seg: number;
  ultimo_sinal_em: Date | null;
  saidas_tela: number;
  comprovante_vigente_id: string | null;
}

export interface Versao {
  id: string;
  treinamento_id: string;
  numero: number;
  video_url: string;
  legenda_url: string | null;
  duracao_seg: number;
  termo: string;
  perguntas: Pergunta[];
  perguntas_por_integracao: number | null;
  conteudo_hash: string | null;
  publicada_em: Date | null;
}

const agoraDe = (ctx: Contexto) => ctx.agora ?? new Date();

// ---------------------------------------------------------------------------
// Trilha de auditoria
// ---------------------------------------------------------------------------

/** Acrescenta um evento à corrente da integração. Chamar dentro de uma transação com a integração travada. */
export async function registrarEvento(
  db: Db,
  integracaoId: string,
  tipo: string,
  dados: Record<string, unknown>,
  ctx: Pick<Contexto, "ip" | "userAgent"> & { agora: Date },
) {
  const ultimo = await um<{ seq: number; hash: string }>(
    db,
    "select seq, hash from app.eventos where integracao_id = $1 order by seq desc limit 1",
    [integracaoId],
  );
  const json = JSON.stringify(dados);
  const evento = {
    seq: (ultimo?.seq ?? 0) + 1,
    tipo,
    dados: JSON.parse(json) as unknown,
    ocorrido_em: ctx.agora,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent ?? null,
    hash_anterior: ultimo?.hash ?? null,
  };
  const hash = hashEvento(evento);
  await db.query(
    `insert into app.eventos (integracao_id, seq, tipo, dados, ocorrido_em, ip, user_agent, hash_anterior, hash)
     values ($1, $2, $3, $4::text::jsonb, $5::timestamptz, $6, $7, $8, $9)`,
    [integracaoId, evento.seq, tipo, json, ctx.agora.toISOString(), evento.ip, evento.user_agent, evento.hash_anterior, hash],
  );
  return { seq: evento.seq, hash };
}

export interface EventoGravado {
  seq: number;
  tipo: string;
  dados: Record<string, unknown>;
  ocorrido_em: Date;
  ip: string | null;
  user_agent: string | null;
  hash_anterior: string | null;
  hash: string;
}

export function listarEventos(db: Db, integracaoId: string) {
  return db.query<EventoGravado>(
    "select seq, tipo, dados, ocorrido_em, ip, user_agent, hash_anterior, hash from app.eventos where integracao_id = $1 order by seq",
    [integracaoId],
  );
}

// ---------------------------------------------------------------------------
// Criação (link do painel ou QR da portaria)
// ---------------------------------------------------------------------------

export async function versaoPublicada(db: Db, treinamentoId: string) {
  return um<Versao>(
    db,
    `select * from app.versoes where treinamento_id = $1 and publicada_em is not null
     order by numero desc limit 1`,
    [treinamentoId],
  );
}

export async function criarIntegracao(
  ctx: Contexto,
  dados: {
    unidadeId: string;
    origem: "link" | "qr";
    telefone: string;
    nome?: string | null;
    transportadora?: string | null;
    criadoPor?: { id: string; nome: string } | null;
  },
) {
  const agora = agoraDe(ctx);
  return ctx.db.tx(async (db) => {
    const unidade = await um<{ id: string; nome: string; empresa_id: string; validade_link_dias: number }>(
      db,
      `select u.id, u.nome, u.empresa_id, e.validade_link_dias
         from app.unidades u join app.empresas e on e.id = u.empresa_id where u.id = $1`,
      [dados.unidadeId],
    );
    if (!unidade) throw new ErroFluxo(404, "Unidade não encontrada.");
    const treinamento = await um<{ id: string }>(
      db,
      "select id from app.treinamentos where empresa_id = $1 order by criado_em limit 1",
      [unidade.empresa_id],
    );
    if (!treinamento) throw new ErroFluxo(409, "A empresa ainda não tem treinamento cadastrado.");
    const versao = await versaoPublicada(db, treinamento.id);

    // Pelo QR o motorista começa na hora; o link enviado pelo WhatsApp vale alguns dias.
    const dias = dados.origem === "qr" ? 1 : unidade.validade_link_dias;
    const expira = new Date(agora.getTime() + dias * 86_400_000);
    const token = tokenLink();
    const nome = dados.nome?.trim() ? normalizarNome(dados.nome) : null;

    const criada = await um<{ id: string }>(
      db,
      `insert into app.integracoes
         (empresa_id, unidade_id, treinamento_id, versao_id, token, origem, nome_informado, telefone,
          transportadora_informada, criado_por, criado_em, expira_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
       returning id`,
      [
        unidade.empresa_id,
        unidade.id,
        treinamento.id,
        versao?.id ?? null,
        token,
        dados.origem,
        nome,
        dados.telefone,
        dados.transportadora?.trim() || null,
        dados.criadoPor?.id ?? null,
        agora.toISOString(),
        expira.toISOString(),
      ],
    );
    const id = criada!.id;
    await registrarEvento(
      db,
      id,
      dados.origem === "qr" ? "entrada_qr" : "link_gerado",
      {
        unidade: unidade.nome,
        telefone: dados.telefone,
        nome,
        transportadora: dados.transportadora?.trim() || null,
        por: dados.criadoPor?.nome ?? null,
        expira_em: expira.toISOString(),
      },
      { ...ctx, agora },
    );
    return { id, token, expiraEm: expira };
  });
}

// ---------------------------------------------------------------------------
// Estado da integração (o que o celular deve mostrar)
// ---------------------------------------------------------------------------

async function travar(db: Db, token: string) {
  const i = await um<Integracao>(db, "select * from app.integracoes where token = $1 for update", [token]);
  if (!i) throw new ErroFluxo(404, "Link não encontrado. Peça um novo link para a portaria.");
  return i;
}

async function carregarVersao(db: Db, i: Integracao) {
  if (!i.versao_id) throw new ErroFluxo(503, "A integração ainda não foi publicada pela empresa.");
  const v = await um<Versao>(db, "select * from app.versoes where id = $1", [i.versao_id]);
  if (!v) throw new ErroFluxo(503, "Conteúdo da integração não encontrado.");
  return v;
}

function perguntaAtual(v: Versao, i: Integracao, respostas: { pergunta_id: string; correta: boolean }[]) {
  const ids = i.perguntas_ids ?? v.perguntas.map((p) => p.id);
  const acertadas = new Set(respostas.filter((r) => r.correta).map((r) => r.pergunta_id));
  const indice = ids.findIndex((id) => !acertadas.has(id));
  if (indice < 0) return null;
  const pergunta = v.perguntas.find((p) => p.id === ids[indice]);
  if (!pergunta) throw new ErroFluxo(500, "Pergunta não encontrada na versão.");
  return { pergunta, indice, total: ids.length };
}

export function renderizarTermo(
  modelo: string,
  v: { nome: string; cpf: string; placa: string | null; empresa: string; transportadora: string | null },
) {
  return modelo
    .replaceAll("{nome}", v.nome)
    .replaceAll("{cpf}", fmt.cpf(v.cpf))
    .replaceAll("{placa}", fmt.placa(v.placa))
    .replaceAll("{empresa}", v.empresa)
    .replaceAll("{transportadora}", v.transportadora ?? "—");
}

async function montarEstado(db: Db, i: Integracao, agora: Date) {
  const empresa = (await um<{ nome: string; cor: string }>(db, "select nome, cor from app.empresas where id = $1", [
    i.empresa_id,
  ]))!;
  const unidade = (await um<{ nome: string }>(db, "select nome from app.unidades where id = $1", [i.unidade_id]))!;
  const treinamento = (await um<{ titulo: string }>(db, "select titulo from app.treinamentos where id = $1", [
    i.treinamento_id,
  ]))!;
  const base = {
    etapa: i.etapa as Etapa | "expirado",
    empresa,
    unidade: unidade.nome,
    treinamento: treinamento.titulo,
    origem: i.origem,
  };

  if (i.expira_em < agora && (i.etapa === "boas_vindas" || i.etapa === "identificacao")) {
    return { ...base, etapa: "expirado" as const };
  }

  switch (i.etapa) {
    case "boas_vindas": {
      const v = await carregarVersao(db, i);
      return {
        ...base,
        duracaoVideo: v.duracao_seg,
        totalPerguntas: i.perguntas_ids?.length ?? v.perguntas_por_integracao ?? v.perguntas.length,
      };
    }
    case "identificacao": {
      const transportadoras = await db.query<{ nome: string }>(
        "select nome from app.transportadoras where empresa_id = $1 order by nome",
        [i.empresa_id],
      );
      return {
        ...base,
        preenchido: {
          nome: i.nome_informado ?? "",
          telefone: i.telefone,
          transportadora: i.transportadora_informada ?? "",
        },
        transportadoras: transportadoras.map((t) => t.nome),
      };
    }
    case "video": {
      const v = await carregarVersao(db, i);
      return {
        ...base,
        video: { url: v.video_url, legenda: v.legenda_url, duracao: v.duracao_seg, progresso: i.progresso_seg },
      };
    }
    case "quiz": {
      const v = await carregarVersao(db, i);
      const respostas = await db.query<{ pergunta_id: string; correta: boolean }>(
        "select pergunta_id, correta from app.respostas where integracao_id = $1",
        [i.id],
      );
      const atual = perguntaAtual(v, i, respostas);
      if (!atual) throw new ErroFluxo(500, "Quiz sem pergunta pendente.");
      const erros = respostas.filter((r) => r.pergunta_id === atual.pergunta.id && !r.correta).length;
      return {
        ...base,
        pergunta: { ...perguntaPublica(atual.pergunta, i.id), indice: atual.indice, total: atual.total, erros },
      };
    }
    case "termo": {
      const v = await carregarVersao(db, i);
      const m = (await um<{ nome: string; cpf: string }>(db, "select nome, cpf from app.motoristas where id = $1", [
        i.motorista_id,
      ]))!;
      const transp = await um<{ nome: string }>(db, "select nome from app.transportadoras where id = $1", [
        i.transportadora_id,
      ]);
      return {
        ...base,
        termo: renderizarTermo(v.termo, {
          nome: m.nome,
          cpf: m.cpf,
          placa: i.placa,
          empresa: empresa.nome,
          transportadora: transp?.nome ?? null,
        }),
        motorista: m.nome,
      };
    }
    case "concluida":
    case "ja_valida": {
      const c = await um<{ codigo: string; emitido_em: Date; vigente_ate: Date; dados: { motorista: { nome: string } } }>(
        db,
        i.etapa === "concluida"
          ? "select codigo, emitido_em, vigente_ate, dados from app.comprovantes_situacao where integracao_id = $1"
          : "select codigo, emitido_em, vigente_ate, dados from app.comprovantes_situacao where id = $1",
        [i.etapa === "concluida" ? i.id : i.comprovante_vigente_id],
      );
      if (!c) throw new ErroFluxo(500, "Comprovante não encontrado.");
      return {
        ...base,
        comprovante: {
          codigo: c.codigo,
          nome: c.dados.motorista.nome,
          emitidoEm: c.emitido_em.toISOString(),
          vigenteAte: c.vigente_ate.toISOString(),
          vigente: c.vigente_ate > agora,
        },
      };
    }
  }
}

export type EstadoIntegracao = Awaited<ReturnType<typeof montarEstado>>;

/** Lê o estado e, no primeiro acesso, registra que o link foi aberto. */
export async function obterEstado(ctx: Contexto, token: string) {
  const agora = agoraDe(ctx);
  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    if (!i.aberto_em) {
      await db.query("update app.integracoes set aberto_em = $2::timestamptz where id = $1", [i.id, agora.toISOString()]);
      await registrarEvento(db, i.id, "link_aberto", {}, { ...ctx, agora });
      i.aberto_em = agora;
    }
    // Antes de começar, o motorista sempre recebe a versão publicada mais recente.
    if (i.etapa === "boas_vindas" || i.etapa === "identificacao") {
      const v = await versaoPublicada(db, i.treinamento_id);
      if (v && v.id !== i.versao_id) {
        await db.query("update app.integracoes set versao_id = $2 where id = $1", [i.id, v.id]);
        i.versao_id = v.id;
      }
    }
    return montarEstado(db, i, agora);
  });
}

function exigirEtapa(i: Integracao, ...etapas: Etapa[]) {
  if (!etapas.includes(i.etapa)) throw new ErroFluxo(409, "Esta etapa já foi concluída. Atualize a página.");
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

export async function iniciar(ctx: Contexto, token: string, dados: { veiculoParado: boolean }) {
  const agora = agoraDe(ctx);
  if (dados.veiculoParado !== true) throw new ErroFluxo(400, "Confirme que o veículo está parado.");
  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    if (i.expira_em < agora) throw new ErroFluxo(410, "Este link expirou. Peça um novo na portaria.");
    exigirEtapa(i, "boas_vindas");
    await carregarVersao(db, i);
    await db.query("update app.integracoes set etapa = 'identificacao', iniciado_em = $2::timestamptz where id = $1", [
      i.id,
      agora.toISOString(),
    ]);
    await registrarEvento(db, i.id, "inicio", { veiculo_parado: true }, { ...ctx, agora });
    return montarEstado(db, { ...i, etapa: "identificacao" }, agora);
  });
}

export const esquemaIdentificacao = z.object({
  nome: z.string().refine(nomeValido, "Informe nome e sobrenome."),
  cpf: z.string().refine(cpfValido, "CPF inválido. Confira os números."),
  placa: z.string().refine((p) => normalizarPlaca(p) !== null, "Placa inválida. Ex.: ABC1D23 ou ABC-1234."),
  transportadora: z.string().trim().min(2, "Informe a transportadora.").max(120),
  aceitePrivacidade: z.literal(true, { error: "É preciso aceitar o aviso de privacidade." }),
});

export async function identificar(ctx: Contexto, token: string, entrada: unknown) {
  const agora = agoraDe(ctx);
  const r = esquemaIdentificacao.safeParse(entrada);
  if (!r.success) throw new ErroFluxo(400, r.error.issues[0]?.message ?? "Dados inválidos.");
  const nome = normalizarNome(r.data.nome);
  const cpf = soDigitos(r.data.cpf);
  const placa = normalizarPlaca(r.data.placa)!;
  const transportadoraNome = r.data.transportadora.trim().replace(/\s+/g, " ");

  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    if (i.expira_em < agora) throw new ErroFluxo(410, "Este link expirou. Peça um novo na portaria.");
    exigirEtapa(i, "identificacao");
    const v = await carregarVersao(db, i);

    const transportadora = (await um<{ id: string; nome: string }>(
      db,
      `insert into app.transportadoras (empresa_id, nome) values ($1, $2)
       on conflict (empresa_id, lower(nome)) do update set nome = app.transportadoras.nome
       returning id, nome`,
      [i.empresa_id, transportadoraNome],
    ))!;
    const motorista = (await um<{ id: string }>(
      db,
      `insert into app.motoristas (empresa_id, nome, cpf, telefone, transportadora_id, criado_em, atualizado_em)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz)
       on conflict (empresa_id, cpf) do update
         set nome = excluded.nome, telefone = excluded.telefone,
             transportadora_id = excluded.transportadora_id, atualizado_em = excluded.atualizado_em
       returning id`,
      [i.empresa_id, nome, cpf, i.telefone, transportadora.id, agora.toISOString()],
    ))!;

    const dadosEvento = {
      nome,
      cpf,
      placa,
      transportadora: transportadora.nome,
      telefone: i.telefone,
      aceite_privacidade: true,
    };

    const vigente = await um<{ id: string; codigo: string; vigente_ate: Date }>(
      db,
      `select id, codigo, vigente_ate from app.comprovantes_situacao
        where motorista_id = $1 and treinamento_id = $2 and vigente_ate > $3::timestamptz
        order by emitido_em desc limit 1`,
      [motorista.id, i.treinamento_id, agora.toISOString()],
    );

    if (vigente) {
      await db.query(
        `update app.integracoes set etapa = 'ja_valida', motorista_id = $2, placa = $3, transportadora_id = $4,
           identificado_em = $5::timestamptz, comprovante_vigente_id = $6 where id = $1`,
        [i.id, motorista.id, placa, transportadora.id, agora.toISOString(), vigente.id],
      );
      await registrarEvento(db, i.id, "identificacao", dadosEvento, { ...ctx, agora });
      await registrarEvento(
        db,
        i.id,
        "integracao_vigente",
        { codigo: vigente.codigo, vigente_ate: vigente.vigente_ate.toISOString() },
        { ...ctx, agora },
      );
      return montarEstado(db, { ...i, etapa: "ja_valida", comprovante_vigente_id: vigente.id }, agora);
    }

    const perguntas = sortearPerguntas(v.perguntas, v.perguntas_por_integracao, i.id);
    await db.query(
      `update app.integracoes set etapa = 'video', motorista_id = $2, placa = $3, transportadora_id = $4,
         identificado_em = $5::timestamptz, perguntas_ids = $6::text::jsonb where id = $1`,
      [i.id, motorista.id, placa, transportadora.id, agora.toISOString(), JSON.stringify(perguntas)],
    );
    await registrarEvento(db, i.id, "identificacao", dadosEvento, { ...ctx, agora });
    return montarEstado(db, { ...i, etapa: "video", perguntas_ids: perguntas }, agora);
  });
}

export const esquemaSinal = z.object({
  acao: z.enum(["play", "progresso", "pausa", "fim"]),
  posicao: z.number().min(0).max(36_000),
  motivo: z.enum(["tela", "rede", "outro"]).optional(),
});

export type ResultadoSinal = { progresso: number; concluido: boolean };

/**
 * Sinais do player. O servidor decide o progresso: cada avanço é limitado pelo tempo real
 * desde o último sinal, e o vídeo só conta como concluído quando o progresso validado chega ao fim.
 */
export async function sinalVideo(ctx: Contexto, token: string, entrada: unknown): Promise<ResultadoSinal> {
  const agora = agoraDe(ctx);
  const r = esquemaSinal.safeParse(entrada);
  if (!r.success) throw new ErroFluxo(400, "Sinal inválido.");
  const { acao, posicao, motivo } = r.data;
  const meta = { ...ctx, agora };

  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    if (i.etapa !== "video") {
      if (["quiz", "termo", "concluida"].includes(i.etapa)) return { progresso: i.progresso_seg, concluido: true };
      throw new ErroFluxo(409, "O vídeo ainda não foi liberado.");
    }
    const v = await carregarVersao(db, i);
    const duracao = v.duracao_seg;
    const atualizar = (progresso: number, ultimoSinal: Date | null, extra = "") =>
      db.query(
        `update app.integracoes set progresso_seg = $2, ultimo_sinal_em = $3::timestamptz ${extra} where id = $1`,
        [i.id, progresso, ultimoSinal ? ultimoSinal.toISOString() : null],
      );
    const validado = avancarProgresso({ progresso: i.progresso_seg, ultimoSinal: i.ultimo_sinal_em }, posicao, duracao, agora);

    if (acao === "play" || (acao === "progresso" && !i.ultimo_sinal_em)) {
      if (i.ultimo_sinal_em) return { progresso: i.progresso_seg, concluido: false };
      const primeira = !i.video_iniciado_em;
      await atualizar(i.progresso_seg, agora, primeira ? ", video_iniciado_em = $3::timestamptz" : "");
      await registrarEvento(db, i.id, primeira ? "video_iniciado" : "video_retomado", { posicao: i.progresso_seg }, meta);
      return { progresso: i.progresso_seg, concluido: false };
    }

    if (acao === "progresso") {
      await atualizar(validado, agora);
      await registrarEvento(db, i.id, "video_progresso", { informado: Math.round(posicao * 10) / 10, validado }, meta);
      return { progresso: validado, concluido: false };
    }

    if (acao === "pausa") {
      if (!i.ultimo_sinal_em) return { progresso: i.progresso_seg, concluido: false };
      await atualizar(validado, null, motivo === "tela" ? ", saidas_tela = saidas_tela + 1" : "");
      await registrarEvento(db, i.id, "video_pausado", { motivo: motivo ?? "outro", validado }, meta);
      return { progresso: validado, concluido: false };
    }

    // acao === "fim"
    const final = avancarProgresso({ progresso: i.progresso_seg, ultimoSinal: i.ultimo_sinal_em }, duracao, duracao, agora);
    if (!videoConcluido(final, duracao)) {
      await atualizar(final, agora);
      await registrarEvento(db, i.id, "video_fim_recusado", { informado: posicao, validado: final }, meta);
      return { progresso: final, concluido: false };
    }
    await db.query(
      `update app.integracoes set etapa = 'quiz', progresso_seg = $2, ultimo_sinal_em = null,
         video_concluido_em = $3::timestamptz where id = $1`,
      [i.id, duracao, agora.toISOString()],
    );
    await registrarEvento(
      db,
      i.id,
      "video_concluido",
      {
        duracao_seg: duracao,
        assistido_desde: (i.video_iniciado_em ?? agora).toISOString(),
        saidas_tela: i.saidas_tela,
      },
      meta,
    );
    return { progresso: duracao, concluido: true };
  });
}

export const esquemaResposta = z.object({ perguntaId: z.string().min(1), alternativaId: z.string().min(1) });

export async function responder(ctx: Contexto, token: string, entrada: unknown) {
  const agora = agoraDe(ctx);
  const r = esquemaResposta.safeParse(entrada);
  if (!r.success) throw new ErroFluxo(400, "Resposta inválida.");

  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    exigirEtapa(i, "quiz");
    const v = await carregarVersao(db, i);
    const respostas = await db.query<{ pergunta_id: string; correta: boolean; respondida_em: Date }>(
      "select pergunta_id, correta, respondida_em from app.respostas where integracao_id = $1 order by id",
      [i.id],
    );
    const atual = perguntaAtual(v, i, respostas);
    if (!atual || atual.pergunta.id !== r.data.perguntaId) {
      throw new ErroFluxo(409, "Esta pergunta já foi respondida. Atualize a página.");
    }
    const anteriores = respostas.filter((x) => x.pergunta_id === atual.pergunta.id);
    const ultima = anteriores.at(-1);
    if (ultima && !ultima.correta && agora.getTime() - ultima.respondida_em.getTime() < ESPERA_APOS_ERRO_MS) {
      throw new ErroFluxo(429, "Aguarde um instante antes de responder de novo.");
    }
    if (!atual.pergunta.alternativas.some((a) => a.id === r.data.alternativaId)) {
      throw new ErroFluxo(400, "Alternativa inválida.");
    }
    const correta = atual.pergunta.correta === r.data.alternativaId;
    const tentativa = anteriores.length + 1;
    await db.query(
      `insert into app.respostas (integracao_id, pergunta_id, alternativa_id, correta, tentativa, respondida_em)
       values ($1, $2, $3, $4, $5, $6::timestamptz)`,
      [i.id, atual.pergunta.id, r.data.alternativaId, correta, tentativa, agora.toISOString()],
    );
    const alternativa = atual.pergunta.alternativas.find((a) => a.id === r.data.alternativaId)!;
    await registrarEvento(
      db,
      i.id,
      "resposta",
      { pergunta_id: atual.pergunta.id, pergunta: atual.pergunta.texto, resposta: alternativa.texto, correta, tentativa },
      { ...ctx, agora },
    );

    const terminou = correta && atual.indice === atual.total - 1;
    if (terminou) {
      await db.query("update app.integracoes set etapa = 'termo', quiz_concluido_em = $2::timestamptz where id = $1", [
        i.id,
        agora.toISOString(),
      ]);
      await registrarEvento(db, i.id, "quiz_concluido", { perguntas: atual.total }, { ...ctx, agora });
    }
    return { correta, terminou };
  });
}

export const esquemaAssinatura = z.object({
  imagem: z
    .string()
    .startsWith("data:image/png;base64,", "Assinatura inválida.")
    .max(400_000, "Assinatura muito grande."),
});

export async function assinar(ctx: Contexto, token: string, entrada: unknown) {
  const agora = agoraDe(ctx);
  const r = esquemaAssinatura.safeParse(entrada);
  if (!r.success) throw new ErroFluxo(400, r.error.issues[0]?.message ?? "Assinatura inválida.");
  const meta = { ...ctx, agora };

  return ctx.db.tx(async (db) => {
    const i = await travar(db, token);
    exigirEtapa(i, "termo");
    const v = await carregarVersao(db, i);
    const empresa = (await um<{ nome: string }>(db, "select nome from app.empresas where id = $1", [i.empresa_id]))!;
    const unidade = (await um<{ nome: string }>(db, "select nome from app.unidades where id = $1", [i.unidade_id]))!;
    const treinamento = (await um<{ titulo: string; validade_dias: number }>(
      db,
      "select titulo, validade_dias from app.treinamentos where id = $1",
      [i.treinamento_id],
    ))!;
    const m = (await um<{ id: string; nome: string; cpf: string; telefone: string }>(
      db,
      "select id, nome, cpf, telefone from app.motoristas where id = $1",
      [i.motorista_id],
    ))!;
    const transp = await um<{ nome: string }>(db, "select nome from app.transportadoras where id = $1", [i.transportadora_id]);
    const integ = (await um<{ video_iniciado_em: Date; video_concluido_em: Date; saidas_tela: number }>(
      db,
      "select video_iniciado_em, video_concluido_em, saidas_tela from app.integracoes where id = $1",
      [i.id],
    ))!;

    const termo = renderizarTermo(v.termo, {
      nome: m.nome,
      cpf: m.cpf,
      placa: i.placa,
      empresa: empresa.nome,
      transportadora: transp?.nome ?? null,
    });
    const termoHash = sha256(termo);
    const imagemHash = sha256(r.data.imagem);
    await db.query(
      `insert into app.assinaturas (integracao_id, imagem, termo_texto, termo_hash, assinada_em, ip, user_agent)
       values ($1, $2, $3, $4, $5::timestamptz, $6, $7)`,
      [i.id, r.data.imagem, termo, termoHash, agora.toISOString(), ctx.ip ?? null, ctx.userAgent ?? null],
    );
    await registrarEvento(db, i.id, "termo_assinado", { termo_hash: termoHash, assinatura_hash: imagemHash }, meta);

    const respostas = await db.query<{ pergunta_id: string; tentativa: number; correta: boolean }>(
      "select pergunta_id, tentativa, correta from app.respostas where integracao_id = $1 order by id",
      [i.id],
    );
    const ids = i.perguntas_ids ?? v.perguntas.map((p) => p.id);
    const validoAte = new Date(agora.getTime() + treinamento.validade_dias * 86_400_000);
    const codigo = await codigoLivre(db);
    const dados = {
      codigo,
      emitido_em: agora.toISOString(),
      valido_ate: validoAte.toISOString(),
      empresa: empresa.nome,
      unidade: unidade.nome,
      motorista: { nome: m.nome, cpf: m.cpf, telefone: m.telefone },
      placa: i.placa,
      transportadora: transp?.nome ?? null,
      origem: i.origem,
      treinamento: { titulo: treinamento.titulo, versao: v.numero, conteudo_hash: v.conteudo_hash },
      video: {
        duracao_seg: v.duracao_seg,
        iniciado_em: integ.video_iniciado_em.toISOString(),
        concluido_em: integ.video_concluido_em.toISOString(),
        saidas_tela: integ.saidas_tela,
      },
      perguntas: ids.map((id) => ({
        id,
        texto: v.perguntas.find((p) => p.id === id)?.texto ?? id,
        tentativas: respostas.filter((x) => x.pergunta_id === id).length,
      })),
      assinatura: { assinada_em: agora.toISOString(), termo_hash: termoHash, imagem_hash: imagemHash },
      integracao_id: i.id,
    };
    const ev = await registrarEvento(
      db,
      i.id,
      "comprovante_emitido",
      { codigo, valido_ate: validoAte.toISOString(), dados_hash: sha256(canonico(dados)) },
      meta,
    );
    await db.query(
      `insert into app.comprovantes
         (integracao_id, empresa_id, motorista_id, versao_id, codigo, emitido_em, valido_ate, dados, evento_seq, hash_corrente, hash)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::text::jsonb, $9, $10, $11)`,
      [
        i.id,
        i.empresa_id,
        m.id,
        v.id,
        codigo,
        agora.toISOString(),
        validoAte.toISOString(),
        JSON.stringify(dados),
        ev.seq,
        ev.hash,
        hashComprovante(dados, ev.hash),
      ],
    );
    await db.query("update app.integracoes set etapa = 'concluida', concluida_em = $2::timestamptz where id = $1", [
      i.id,
      agora.toISOString(),
    ]);
    return montarEstado(db, { ...i, etapa: "concluida" }, agora);
  });
}

async function codigoLivre(db: Db) {
  for (;;) {
    const codigo = codigoComprovante();
    const existe = await um(db, "select 1 from app.comprovantes where codigo = $1", [codigo]);
    if (!existe) return codigo;
  }
}

/** O porteiro confirma que viu o motorista pessoalmente (vale como testemunha). */
export async function conferirNaPortaria(
  ctx: Contexto,
  integracaoId: string,
  usuario: { id: string; nome: string; empresaId: string },
) {
  const agora = agoraDe(ctx);
  return ctx.db.tx(async (db) => {
    const i = await um<Integracao & { conferido_em: Date | null }>(
      db,
      "select * from app.integracoes where id = $1 and empresa_id = $2 for update",
      [integracaoId, usuario.empresaId],
    );
    if (!i) throw new ErroFluxo(404, "Integração não encontrada.");
    if (i.etapa !== "concluida" && i.etapa !== "ja_valida") throw new ErroFluxo(409, "A integração ainda não foi concluída.");
    if (i.conferido_em) return;
    await db.query("update app.integracoes set conferido_por = $2, conferido_em = $3::timestamptz where id = $1", [
      i.id,
      usuario.id,
      agora.toISOString(),
    ]);
    await registrarEvento(db, i.id, "conferido_portaria", { por: usuario.nome }, { ...ctx, agora });
  });
}

// ---------------------------------------------------------------------------
// Verificação pública do comprovante
// ---------------------------------------------------------------------------

export interface DadosComprovante {
  codigo: string;
  emitido_em: string;
  valido_ate: string;
  empresa: string;
  unidade: string;
  motorista: { nome: string; cpf: string; telefone: string };
  placa: string | null;
  transportadora: string | null;
  origem: "link" | "qr";
  treinamento: { titulo: string; versao: number; conteudo_hash: string | null };
  video: { duracao_seg: number; iniciado_em: string; concluido_em: string; saidas_tela: number };
  perguntas: { id: string; texto: string; tentativas: number }[];
  assinatura: { assinada_em: string; termo_hash: string; imagem_hash: string };
  integracao_id: string;
}

export async function verificarComprovante(db: Db, codigo: string, agora = new Date()) {
  const c = await um<{
    id: string;
    integracao_id: string;
    codigo: string;
    dados: DadosComprovante;
    evento_seq: number;
    hash_corrente: string;
    hash: string;
    emitido_em: Date;
    vigente_ate: Date;
    valido_ate: Date;
  }>(db, "select * from app.comprovantes_situacao where codigo = $1", [codigo]);
  if (!c) return null;
  const eventos = await listarEventos(db, c.integracao_id);
  const corrente = verificarCorrente(eventos);
  const eventoDoComprovante = eventos.find((e) => e.seq === c.evento_seq);
  const assinatura = await um<{ imagem: string; termo_texto: string; termo_hash: string }>(
    db,
    "select imagem, termo_texto, termo_hash from app.assinaturas where integracao_id = $1",
    [c.integracao_id],
  );
  const conteudoConfere =
    hashComprovante(c.dados, c.hash_corrente) === c.hash &&
    eventoDoComprovante?.hash === c.hash_corrente &&
    eventoDoComprovante?.dados.dados_hash === sha256(canonico(c.dados)) &&
    assinatura?.termo_hash === c.dados.assinatura.termo_hash &&
    sha256(assinatura?.imagem ?? "") === c.dados.assinatura.imagem_hash &&
    sha256(assinatura?.termo_texto ?? "") === assinatura?.termo_hash;
  return {
    comprovante: c,
    eventos,
    assinatura,
    corrente,
    autentico: corrente.valida && conteudoConfere,
    vigente: c.vigente_ate > agora,
  };
}
