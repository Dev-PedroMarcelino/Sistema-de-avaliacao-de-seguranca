import { afterEach, describe, expect, it } from "vitest";
import { criarPglite, um } from "@/lib/db";
import { prepararBanco } from "@/lib/db/preparar";

const VARIAVEIS = ["MIGRAR_AO_INICIAR", "DEMO_MODE", "EMPRESA_NOME", "UNIDADE_NOME", "ADMIN_NOME", "ADMIN_EMAIL", "ADMIN_SENHA"];
const original = Object.fromEntries(VARIAVEIS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of VARIAVEIS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("preparo do banco no deploy", () => {
  it("migra e cadastra o cliente a partir das variáveis, uma vez só", async () => {
    Object.assign(process.env, {
      MIGRAR_AO_INICIAR: "true",
      DEMO_MODE: "false",
      EMPRESA_NOME: "Pedreira Teste",
      UNIDADE_NOME: "Portaria Principal",
      ADMIN_NOME: "Admin Teste",
      ADMIN_EMAIL: "Admin@Teste.local",
      ADMIN_SENHA: "senha-de-teste-123",
    });
    const db = await criarPglite();
    await prepararBanco(db);
    await prepararBanco(db);
    const contagem = await um<{ empresas: number; usuarios: number; rascunhos: number }>(
      db,
      `select (select count(*)::int from app.empresas) as empresas,
              (select count(*)::int from app.usuarios where email = 'admin@teste.local' and perfil = 'admin') as usuarios,
              (select count(*)::int from app.versoes where publicada_em is null) as rascunhos`,
    );
    expect(contagem).toEqual({ empresas: 1, usuarios: 1, rascunhos: 1 });
  });

  it("sem migração e sem schema, não faz nada", async () => {
    delete process.env.MIGRAR_AO_INICIAR;
    const db = await criarPglite();
    await expect(prepararBanco(db)).resolves.toBeUndefined();
  });
});
