import { type Db, um } from "@/lib/db";
import { criarIntegracao, registrarEvento } from "@/lib/integracao/servico";
import { normalizarTelefone } from "@/lib/validacao";
import type { EnviarWhatsApp } from "@/lib/whatsapp-api";
import * as fmt from "@/lib/formato";

/** Só avisa vencimentos recentes: ligar o recurso não dispara mensagens de vencimentos antigos. */
export const JANELA_AVISO_DIAS = 30;
export const MAX_TENTATIVAS = 5;
const DIA = 86_400_000;

export type TipoAviso = "antecedencia" | "vencimento";

/** "(19) 99999-1234, 5511988887777" -> ["5519999991234", "5511988887777"] */
export function numerosDeAlerta(texto: string | null | undefined): string[] {
  const numeros = (texto ?? "")
    .split(/[,;\n]+/)
    .map((n) => normalizarTelefone(n))
    .filter((n): n is string => Boolean(n));
  return [...new Set(numeros)];
}

interface DadosAviso {
  empresa: string;
  nome: string;
  cpf: string;
  placa: string | null;
  transportadora: string | null;
  vigenteAte: Date;
  urlPortaria: string | null;
}

export function mensagemVencimento(v: DadosAviso) {
  return [
    "⚠️ *Integração de segurança vencida*",
    v.empresa,
    "",
    ...linhasMotorista(v),
    `Venceu em: ${fmt.data(v.vigenteAte)}`,
    "",
    "🚫 Não liberar a entrada até ele refazer a integração.",
    ...(v.urlPortaria ? [`Consultar: ${v.urlPortaria}`] : []),
  ].join("\n");
}

export function mensagemAntecedencia(v: DadosAviso, agora: Date) {
  const dias = Math.max(1, Math.ceil((v.vigenteAte.getTime() - agora.getTime()) / DIA));
  return [
    `⏳ *Integração de segurança vence em ${dias} ${dias === 1 ? "dia" : "dias"}*`,
    v.empresa,
    "",
    ...linhasMotorista(v),
    `Vence em: ${fmt.data(v.vigenteAte)}`,
    "",
    "Peça para ele refazer a integração antes do vencimento, para não ser barrado na portaria.",
    ...(v.urlPortaria ? [`Consultar: ${v.urlPortaria}`] : []),
  ].join("\n");
}

export function mensagemParaMotorista(v: { nome: string; empresa: string; vigenteAte: Date; link: string }) {
  const primeiro = v.nome.split(/\s+/)[0];
  return [
    `Olá, ${primeiro}! Sua integração de segurança da ${v.empresa} vence em ${fmt.data(v.vigenteAte)}.`,
    "Refaça agora para não ter a entrada barrada. Leva poucos minutos; faça com o veículo parado:",
    v.link,
  ].join("\n");
}

function linhasMotorista(v: DadosAviso) {
  return [
    `Motorista: ${v.nome}`,
    `CPF: ${fmt.cpfMascarado(v.cpf)}`,
    `Placa: ${fmt.placa(v.placa)}`,
    `Transportadora: ${v.transportadora ?? "—"}`,
  ];
}

interface Candidato {
  id: string;
  codigo: string;
  vigente_ate: Date;
  empresa_id: string;
  integracao_id: string;
  unidade_id: string;
  empresa: string;
  whatsapp_alertas: string;
  whatsapp_token: string | null;
  avisar_motorista: boolean;
  dados: { motorista: { nome: string; cpf: string; telefone: string }; placa: string | null; transportadora: string | null };
}

// Seleção comum: a última integração do motorista, com aviso ainda não enviado (ou com falha a tentar de novo).
const SQL_CANDIDATOS = (filtroPrazo: string) => `
  select cs.id, cs.codigo, cs.vigente_ate, cs.empresa_id, cs.integracao_id, i.unidade_id, cs.dados,
         e.nome as empresa, e.whatsapp_alertas, e.whatsapp_token, e.avisar_motorista
    from app.comprovantes_situacao cs
    join app.integracoes i on i.id = cs.integracao_id
    join app.empresas e on e.id = cs.empresa_id
    left join app.alertas_vencimento a on a.comprovante_id = cs.id and a.tipo = $3
   where ${filtroPrazo}
     and coalesce(e.whatsapp_alertas, '') <> ''
     and (a.comprovante_id is null or (a.status = 'erro' and a.tentativas < $4))
     and not exists (
       select 1 from app.comprovantes_situacao n
        where n.motorista_id = cs.motorista_id and n.treinamento_id = cs.treinamento_id
          and n.emitido_em > cs.emitido_em)
   order by cs.vigente_ate
   limit 50`;

/**
 * Avisos por WhatsApp de cada comprovante:
 * - "antecedencia": faltando até N dias (configurável por empresa) para vencer;
 * - "vencimento": quando venceu, para a portaria barrar.
 * Um aviso de cada tipo por comprovante (a linha é reservada antes do envio); não avisa quem já refez;
 * falhas ficam para nova tentativa.
 */
export async function processarVencimentos(
  db: Db,
  opcoes: { agora?: Date; enviador: (tokenEmpresa: string | null) => EnviarWhatsApp; urlBase?: string | null },
) {
  const agora = opcoes.agora ?? new Date();
  const resultado = { enviados: 0, erros: 0 };

  const proximos = await db.query<Candidato>(
    SQL_CANDIDATOS(
      `e.aviso_antecedencia_dias > 0 and cs.vigente_ate > $1::timestamptz
       and cs.vigente_ate <= $1::timestamptz + make_interval(days => e.aviso_antecedencia_dias)
       and $2::text is not null`,
    ),
    [agora.toISOString(), "-", "antecedencia", MAX_TENTATIVAS],
  );
  const vencidos = await db.query<Candidato>(
    SQL_CANDIDATOS("cs.vigente_ate <= $1::timestamptz and cs.vigente_ate > $2::timestamptz"),
    [agora.toISOString(), new Date(agora.getTime() - JANELA_AVISO_DIAS * DIA).toISOString(), "vencimento", MAX_TENTATIVAS],
  );

  for (const [tipo, lista] of [
    ["antecedencia", proximos],
    ["vencimento", vencidos],
  ] as const) {
    for (const c of lista) {
      const r = await avisar(db, c, tipo, agora, opcoes);
      if (r === "enviado") resultado.enviados++;
      if (r === "erro") resultado.erros++;
    }
  }
  return resultado;
}

async function avisar(
  db: Db,
  c: Candidato,
  tipo: TipoAviso,
  agora: Date,
  opcoes: { enviador: (tokenEmpresa: string | null) => EnviarWhatsApp; urlBase?: string | null },
): Promise<"enviado" | "erro" | "pulado"> {
  const destinos = numerosDeAlerta(c.whatsapp_alertas);
  if (!destinos.length) return "pulado";
  const reservado = await um(
    db,
    `insert into app.alertas_vencimento (comprovante_id, tipo, empresa_id, status, destinos, tentativas)
     values ($1, $2, $3, 'enviando', $4, 1)
     on conflict (comprovante_id, tipo) do update
       set status = 'enviando', tentativas = app.alertas_vencimento.tentativas + 1, destinos = excluded.destinos
       where app.alertas_vencimento.status = 'erro'
     returning comprovante_id`,
    [c.id, tipo, c.empresa_id, destinos.join(",")],
  );
  if (!reservado) return "pulado";

  const base: DadosAviso = {
    empresa: c.empresa,
    nome: c.dados.motorista.nome,
    cpf: c.dados.motorista.cpf,
    placa: c.dados.placa,
    transportadora: c.dados.transportadora,
    vigenteAte: c.vigente_ate,
    urlPortaria: opcoes.urlBase
      ? `${opcoes.urlBase}/painel/portaria?q=${encodeURIComponent(c.dados.placa ?? c.dados.motorista.cpf)}`
      : null,
  };
  try {
    const enviar = opcoes.enviador(c.whatsapp_token);
    const texto = tipo === "vencimento" ? mensagemVencimento(base) : mensagemAntecedencia(base, agora);
    for (const numero of destinos) await enviar(numero, texto);

    // No aviso prévio, o motorista pode receber um link novo para refazer antes de vencer.
    let motoristaAvisado = false;
    if (tipo === "antecedencia" && c.avisar_motorista && opcoes.urlBase) {
      const nova = await criarIntegracao(
        { db, agora, ip: null, userAgent: "agendador" },
        { unidadeId: c.unidade_id, origem: "link", telefone: c.dados.motorista.telefone, nome: c.dados.motorista.nome },
      );
      await enviar(
        c.dados.motorista.telefone,
        mensagemParaMotorista({ nome: base.nome, empresa: c.empresa, vigenteAte: c.vigente_ate, link: `${opcoes.urlBase}/i/${nova.token}` }),
      );
      motoristaAvisado = true;
    }

    await db.tx(async (t) => {
      await t.query(
        `update app.alertas_vencimento set status = 'enviado', enviado_em = $3::timestamptz, ultimo_erro = null
          where comprovante_id = $1 and tipo = $2`,
        [c.id, tipo, agora.toISOString()],
      );
      await t.query("select id from app.integracoes where id = $1 for update", [c.integracao_id]);
      await registrarEvento(
        t,
        c.integracao_id,
        tipo === "vencimento" ? "vencimento_avisado" : "vencimento_proximo_avisado",
        {
          codigo: c.codigo,
          vigente_ate: c.vigente_ate.toISOString(),
          destinos: destinos.map((d) => `…${d.slice(-4)}`),
          ...(tipo === "antecedencia" ? { motorista_avisado: motoristaAvisado } : {}),
        },
        { agora, ip: null, userAgent: "agendador" },
      );
    });
    return "enviado";
  } catch (erro) {
    await db.query("update app.alertas_vencimento set status = 'erro', ultimo_erro = $3 where comprovante_id = $1 and tipo = $2", [
      c.id,
      tipo,
      String((erro as Error)?.message ?? erro).slice(0, 500),
    ]);
    return "erro";
  }
}
