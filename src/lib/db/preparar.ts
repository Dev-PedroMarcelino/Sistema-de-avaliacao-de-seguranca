import { type Db, aplicarMigracoes, um } from "./index";
import type { ConteudoVersao } from "../integracao/conteudo";

/**
 * Preparo do banco ao iniciar (deploy em container, sem acesso a console):
 * - MIGRAR_AO_INICIAR=true aplica as migrações pendentes;
 * - com o banco vazio e DEMO_MODE=true, gera a Mineração Demo;
 * - com o banco vazio e EMPRESA_NOME/UNIDADE_NOME/ADMIN_NOME/ADMIN_EMAIL/ADMIN_SENHA, cadastra o cliente;
 *   se CONTEUDO_INICIAL vier junto (JSON ou JSON em base64), publica esse conteúdo como versão 1.
 */
export async function prepararBanco(db: Db) {
  if (process.env.MIGRAR_AO_INICIAR === "true") {
    const aplicadas = await aplicarMigracoes(db);
    if (aplicadas.length) console.log(`[integra] migrações aplicadas: ${aplicadas.join(", ")}`);
  }

  const temEmpresa = await um(db, "select 1 from app.empresas limit 1").catch(() => null);
  if (temEmpresa !== undefined) return; // já tem dados, ou o schema ainda não existe

  if (process.env.DEMO_MODE === "true") {
    const { semearDemo } = await import("../demo/semear");
    await semearDemo(db);
    console.log("[integra] dados de demonstração criados");
    return;
  }

  const { EMPRESA_NOME, UNIDADE_NOME, ADMIN_NOME, ADMIN_EMAIL, ADMIN_SENHA, CONTEUDO_INICIAL } = process.env;
  if (!(EMPRESA_NOME && UNIDADE_NOME && ADMIN_NOME && ADMIN_EMAIL && ADMIN_SENHA)) return;

  const { criarEmpresa } = await import("../integracao/empresa");
  const empresaId = await criarEmpresa(db, {
    empresa: EMPRESA_NOME,
    unidade: UNIDADE_NOME,
    admin: { nome: ADMIN_NOME, email: ADMIN_EMAIL, senha: ADMIN_SENHA },
  });
  console.log(`[integra] empresa "${EMPRESA_NOME}" criada; administrador: ${ADMIN_EMAIL}`);

  if (CONTEUDO_INICIAL) {
    try {
      const versao = await publicarConteudoInicial(db, empresaId, lerConteudo(CONTEUDO_INICIAL));
      console.log(`[integra] conteúdo inicial publicado (versão ${versao})`);
    } catch (erro) {
      console.error("[integra] conteúdo inicial inválido; ajuste no painel em Vídeo e perguntas:", erro);
    }
  }
}

export function lerConteudo(texto: string): ConteudoVersao {
  const json = texto.trim().startsWith("{") ? texto : Buffer.from(texto.trim(), "base64").toString("utf8");
  const c = JSON.parse(json) as Partial<ConteudoVersao>;
  if (!c.video_url || !c.duracao_seg || !Array.isArray(c.perguntas)) {
    throw new Error("CONTEUDO_INICIAL precisa de video_url, duracao_seg e perguntas.");
  }
  return {
    video_url: c.video_url,
    legenda_url: c.legenda_url ?? null,
    duracao_seg: Number(c.duracao_seg),
    termo: c.termo ?? "",
    perguntas: c.perguntas,
    perguntas_por_integracao: c.perguntas_por_integracao ?? null,
  };
}

async function publicarConteudoInicial(db: Db, empresaId: string, conteudo: ConteudoVersao) {
  const { TERMO_PADRAO, obterRascunho, publicarVersao, salvarRascunho } = await import("../integracao/conteudo");
  const treinamento = (await um<{ id: string }>(db, "select id from app.treinamentos where empresa_id = $1", [empresaId]))!;
  const rascunho = await obterRascunho(db, treinamento.id);
  await salvarRascunho(db, rascunho, { ...conteudo, termo: conteudo.termo || TERMO_PADRAO });
  await publicarVersao(db, rascunho, { usuarioId: null, invalidaAnteriores: false });
  return (await um<{ numero: number }>(db, "select numero from app.versoes where id = $1", [rascunho]))!.numero;
}
