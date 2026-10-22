import { type Db, um } from "@/lib/db";
import { gerarHashSenha } from "@/lib/auth/senha";
import { obterRascunho } from "./conteudo";

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Cadastra um cliente novo: empresa, primeira unidade, treinamento (rascunho vazio) e o primeiro administrador. */
export async function criarEmpresa(
  db: Db,
  dados: { empresa: string; unidade: string; admin: { nome: string; email: string; senha: string } },
) {
  return db.tx(async (t) => {
    const s = slug(dados.empresa);
    const empresa = (await um<{ id: string }>(t, "insert into app.empresas (nome, slug) values ($1, $2) returning id", [
      dados.empresa,
      s,
    ]))!;
    await t.query("insert into app.unidades (empresa_id, nome, slug) values ($1, $2, $3)", [
      empresa.id,
      dados.unidade,
      slug(`${s}-${dados.unidade}`),
    ]);
    const treinamento = (await um<{ id: string }>(
      t,
      "insert into app.treinamentos (empresa_id, titulo) values ($1, 'Integração de segurança para motoristas externos') returning id",
      [empresa.id],
    ))!;
    await obterRascunho(t, treinamento.id);
    await t.query("insert into app.usuarios (empresa_id, nome, email, senha_hash, perfil) values ($1, $2, $3, $4, 'admin')", [
      empresa.id,
      dados.admin.nome,
      dados.admin.email.toLowerCase(),
      await gerarHashSenha(dados.admin.senha),
    ]);
    return empresa.id;
  });
}
