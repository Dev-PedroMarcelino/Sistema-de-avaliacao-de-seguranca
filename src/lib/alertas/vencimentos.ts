import { type Db, um } from "@/lib/db";
import { registrarEvento } from "@/lib/integracao/servico";
import { normalizarTelefone } from "@/lib/validacao";
import type { EnviarWhatsApp } from "@/lib/whatsapp-api";
import * as fmt from "@/lib/formato";

/** Só avisa vencimentos recentes: ligar o recurso não dispara mensagens de vencimentos antigos. */
export const JANELA_AVISO_DIAS = 30;
export const MAX_TENTATIVAS = 5;

/** "(19) 99999-1234, 5511988887777" -> ["5519999991234", "5511988887777"] */
export function numerosDeAlerta(texto: string | null | undefined): string[] {
  const numeros = (texto ?? "")
    .split(/[,;\n]+/)
    .map((n) => normalizarTelefone(n))
    .filter((n): n is string => Boolean(n));
  return [...new Set(numeros)];
}

export function mensagemVencimento(v: {
  empresa: string;
  nome: string;
  cpf: string;
  placa: string | null;
  transportadora: string | null;
  vigenteAte: Date;
  urlPortaria: string | null;
}) {
  return [
    "⚠️ *Integração de segurança vencida*",
    v.empresa,
    "",
    `Motorista: ${v.nome}`,
    `CPF: ${fmt.cpfMascarado(v.cpf)}`,
    `Placa: ${fmt.placa(v.placa)}`,
    `Transportadora: ${v.transportadora ?? "—"}`,
    `Venceu em: ${fmt.data(v.vigenteAte)}`,
    "",
    "🚫 Não liberar a entrada até ele refazer a integração.",
    ...(v.urlPortaria ? [`Consultar: ${v.urlPortaria}`] : []),
  ].join("\n");
}

interface Vencido {
  id: string;
  codigo: string;
  vigente_ate: Date;
  empresa_id: string;
  integracao_id: string;
  empresa: string;
  whatsapp_alertas: string;
  whatsapp_token: string | null;
  dados: { motorista: { nome: string; cpf: string }; placa: string | null; transportadora: string | null };
}

/**
 * Procura comprovantes que venceram e avisa os números da empresa.
 * Um aviso por comprovante (a linha em alertas_vencimento é reservada antes do envio);
 * não avisa quem já refez a integração; falhas ficam para nova tentativa.
 */
export async function processarVencimentos(
  db: Db,
  opcoes: { agora?: Date; enviador: (tokenEmpresa: string | null) => EnviarWhatsApp; urlBase?: string | null },
) {
  const agora = opcoes.agora ?? new Date();
  const desde = new Date(agora.getTime() - JANELA_AVISO_DIAS * 86_400_000);
  const vencidos = await db.query<Vencido>(
    `select cs.id, cs.codigo, cs.vigente_ate, cs.empresa_id, cs.integracao_id, cs.dados,
            e.nome as empresa, e.whatsapp_alertas, e.whatsapp_token
       from app.comprovantes_situacao cs
       join app.empresas e on e.id = cs.empresa_id
       left join app.alertas_vencimento a on a.comprovante_id = cs.id
      where cs.vigente_ate <= $1::timestamptz and cs.vigente_ate > $2::timestamptz
        and coalesce(e.whatsapp_alertas, '') <> ''
        and (a.comprovante_id is null or (a.status = 'erro' and a.tentativas < $3))
        and not exists (
          select 1 from app.comprovantes_situacao n
           where n.motorista_id = cs.motorista_id and n.treinamento_id = cs.treinamento_id
             and n.emitido_em > cs.emitido_em)
      order by cs.vigente_ate
      limit 50`,
    [agora.toISOString(), desde.toISOString(), MAX_TENTATIVAS],
  );

  const resultado = { enviados: 0, erros: 0 };
  for (const v of vencidos) {
    const destinos = numerosDeAlerta(v.whatsapp_alertas);
    if (!destinos.length) continue;
    // Reserva o aviso: se outro processo já pegou, pula.
    const reservado = await um(
      db,
      `insert into app.alertas_vencimento (comprovante_id, empresa_id, status, destinos, tentativas)
       values ($1, $2, 'enviando', $3, 1)
       on conflict (comprovante_id) do update
         set status = 'enviando', tentativas = app.alertas_vencimento.tentativas + 1, destinos = excluded.destinos
         where app.alertas_vencimento.status = 'erro'
       returning comprovante_id`,
      [v.id, v.empresa_id, destinos.join(",")],
    );
    if (!reservado) continue;

    const texto = mensagemVencimento({
      empresa: v.empresa,
      nome: v.dados.motorista.nome,
      cpf: v.dados.motorista.cpf,
      placa: v.dados.placa,
      transportadora: v.dados.transportadora,
      vigenteAte: v.vigente_ate,
      urlPortaria: opcoes.urlBase
        ? `${opcoes.urlBase}/painel/portaria?q=${encodeURIComponent(v.dados.placa ?? v.dados.motorista.cpf)}`
        : null,
    });
    try {
      const enviar = opcoes.enviador(v.whatsapp_token);
      for (const numero of destinos) await enviar(numero, texto);
      await db.tx(async (t) => {
        await t.query(
          "update app.alertas_vencimento set status = 'enviado', enviado_em = $2::timestamptz, ultimo_erro = null where comprovante_id = $1",
          [v.id, agora.toISOString()],
        );
        await t.query("select id from app.integracoes where id = $1 for update", [v.integracao_id]);
        await registrarEvento(
          t,
          v.integracao_id,
          "vencimento_avisado",
          { codigo: v.codigo, vigente_ate: v.vigente_ate.toISOString(), destinos: destinos.map((d) => `…${d.slice(-4)}`) },
          { agora, ip: null, userAgent: "agendador" },
        );
      });
      resultado.enviados++;
    } catch (erro) {
      await db.query("update app.alertas_vencimento set status = 'erro', ultimo_erro = $2 where comprovante_id = $1", [
        v.id,
        String((erro as Error)?.message ?? erro).slice(0, 500),
      ]);
      resultado.erros++;
    }
  }
  return resultado;
}
