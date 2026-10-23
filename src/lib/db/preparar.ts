import { type Db, aplicarMigracoes, um } from "./index";

/**
 * Preparo do banco ao iniciar (deploy em container, sem acesso a console):
 * - MIGRAR_AO_INICIAR=true aplica as migrações pendentes;
 * - com o banco vazio e DEMO_MODE=true, gera a Mineração Demo;
 * - com o banco vazio e EMPRESA_NOME/UNIDADE_NOME/ADMIN_NOME/ADMIN_EMAIL/ADMIN_SENHA, cadastra o cliente.
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

  const { EMPRESA_NOME, UNIDADE_NOME, ADMIN_NOME, ADMIN_EMAIL, ADMIN_SENHA } = process.env;
  if (EMPRESA_NOME && UNIDADE_NOME && ADMIN_NOME && ADMIN_EMAIL && ADMIN_SENHA) {
    const { criarEmpresa } = await import("../integracao/empresa");
    await criarEmpresa(db, {
      empresa: EMPRESA_NOME,
      unidade: UNIDADE_NOME,
      admin: { nome: ADMIN_NOME, email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    console.log(`[integra] empresa "${EMPRESA_NOME}" criada; administrador: ${ADMIN_EMAIL}`);
  }
}
