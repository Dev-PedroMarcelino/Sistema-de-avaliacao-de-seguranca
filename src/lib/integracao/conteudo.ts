import { type Db, um } from "@/lib/db";
import { canonico, sha256 } from "@/lib/hash";
import { type Pergunta, validarPerguntas } from "@/lib/quiz";
import { ErroFluxo } from "./servico";

export const TERMO_PADRAO =
  "Eu, {nome}, CPF {cpf}, motorista da transportadora {transportadora}, conduzindo o veículo de placa {placa}, " +
  "declaro que assisti por completo ao vídeo de integração de segurança da {empresa}, respondi às perguntas de " +
  "verificação e compreendi as regras de circulação e segurança da área. Comprometo-me a cumpri-las durante toda a " +
  "minha permanência e estou ciente de que o descumprimento pode resultar no impedimento do meu acesso.";

export interface ConteudoVersao {
  video_url: string;
  legenda_url: string | null;
  duracao_seg: number;
  termo: string;
  perguntas: Pergunta[];
  perguntas_por_integracao: number | null;
}

export function hashConteudo(c: ConteudoVersao) {
  return sha256(
    canonico({
      video_url: c.video_url,
      legenda_url: c.legenda_url,
      duracao_seg: c.duracao_seg,
      termo: c.termo,
      perguntas: c.perguntas,
      perguntas_por_integracao: c.perguntas_por_integracao,
    }),
  );
}

export function validarConteudo(c: ConteudoVersao): string | null {
  if (!c.video_url.trim()) return "Informe o link do vídeo.";
  if (!(c.duracao_seg > 0)) return "Informe a duração do vídeo (use o botão para detectar).";
  if (c.termo.trim().length < 40) return "O termo de ciência está muito curto.";
  const erro = validarPerguntas(c.perguntas);
  if (erro) return erro;
  if (c.perguntas_por_integracao != null) {
    if (c.perguntas_por_integracao < 1) return "Sorteie ao menos 1 pergunta.";
    if (c.perguntas_por_integracao > c.perguntas.length) return "O sorteio pede mais perguntas do que existem no banco.";
  }
  return null;
}

/** Rascunho atual (cria um a partir da última versão, se não houver). */
export async function obterRascunho(db: Db, treinamentoId: string) {
  const rascunho = await um<{ id: string }>(
    db,
    "select id from app.versoes where treinamento_id = $1 and publicada_em is null order by numero desc limit 1",
    [treinamentoId],
  );
  if (rascunho) return rascunho.id;
  const ultima = await um<ConteudoVersao & { numero: number }>(
    db,
    "select * from app.versoes where treinamento_id = $1 order by numero desc limit 1",
    [treinamentoId],
  );
  const nova = await um<{ id: string }>(
    db,
    `insert into app.versoes (treinamento_id, numero, video_url, legenda_url, duracao_seg, termo, perguntas, perguntas_por_integracao)
     values ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8) returning id`,
    [
      treinamentoId,
      (ultima?.numero ?? 0) + 1,
      ultima?.video_url ?? "",
      ultima?.legenda_url ?? null,
      ultima?.duracao_seg ?? 0,
      ultima?.termo ?? TERMO_PADRAO,
      JSON.stringify(ultima?.perguntas ?? []),
      ultima?.perguntas_por_integracao ?? null,
    ],
  );
  return nova!.id;
}

export async function salvarRascunho(db: Db, versaoId: string, c: ConteudoVersao) {
  await db.query(
    `update app.versoes set video_url = $2, legenda_url = $3, duracao_seg = $4, termo = $5, perguntas = $6::text::jsonb,
       perguntas_por_integracao = $7 where id = $1 and publicada_em is null`,
    [
      versaoId,
      c.video_url.trim(),
      c.legenda_url?.trim() || null,
      c.duracao_seg,
      c.termo.trim(),
      JSON.stringify(c.perguntas),
      c.perguntas_por_integracao,
    ],
  );
}

/** Publica o rascunho: a partir daqui ele fica congelado (o banco recusa alterações). */
export async function publicarVersao(
  db: Db,
  versaoId: string,
  opcoes: { usuarioId: string | null; invalidaAnteriores: boolean; agora?: Date },
) {
  const v = await um<ConteudoVersao & { publicada_em: Date | null }>(db, "select * from app.versoes where id = $1", [
    versaoId,
  ]);
  if (!v) throw new ErroFluxo(404, "Versão não encontrada.");
  if (v.publicada_em) throw new ErroFluxo(409, "Esta versão já foi publicada.");
  const erro = validarConteudo(v);
  if (erro) throw new ErroFluxo(400, erro);
  await db.query(
    `update app.versoes set conteudo_hash = $2, publicada_em = $3::timestamptz, publicada_por = $4,
       invalida_anteriores = $5 where id = $1`,
    [versaoId, hashConteudo(v), (opcoes.agora ?? new Date()).toISOString(), opcoes.usuarioId, opcoes.invalidaAnteriores],
  );
}
