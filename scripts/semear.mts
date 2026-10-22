// Prepara o banco de DATABASE_URL (lido de ENV_FILE, padrão .env.local).
//
//   ENV_FILE=.env.demo.local npm run db:seed -- demo
//       Empresa fictícia "Mineração Demo" com histórico (deploy de portfólio).
//
//   ENV_FILE=.env.producao.local npm run db:seed -- empresa "Empresa" "Unidade" "Nome do Admin" admin@empresa.com.br
//       Cliente real: empresa, unidade, treinamento vazio e o primeiro administrador.
//       A senha vem de ADMIN_SENHA (no mesmo arquivo) ou é gerada e mostrada uma vez.

import { randomBytes } from "node:crypto";
import { exigirBanco } from "./ambiente.mts";
import { getDb, um } from "../src/lib/db";
import { semearDemo } from "../src/lib/demo/semear";
import { criarEmpresa } from "../src/lib/integracao/empresa";

exigirBanco();
const [modo, ...args] = process.argv.slice(2);
const db = await getDb();

if (modo === "demo") {
  if (await um(db, "select 1 from app.empresas where slug = 'demo'")) {
    console.log("A Mineração Demo já existe neste banco. Nada a fazer.");
  } else {
    await semearDemo(db);
    console.log("Dados de demonstração criados.");
  }
} else if (modo === "empresa" && args.length === 4) {
  const [empresa, unidade, nome, email] = args;
  const senha = process.env.ADMIN_SENHA || randomBytes(9).toString("base64url");
  await criarEmpresa(db, { empresa, unidade, admin: { nome, email, senha } });
  console.log(`Empresa criada. Acesso do administrador: ${email}`);
  if (!process.env.ADMIN_SENHA) console.log(`Senha inicial (anote, não será mostrada de novo): ${senha}`);
  console.log("Próximo passo: entre no painel, troque a senha em “Minha senha”, cole o vídeo em “Vídeo e perguntas” e publique.");
} else {
  console.error('Uso: npm run db:seed -- demo\n     npm run db:seed -- empresa "Empresa" "Unidade" "Nome do admin" email');
  process.exit(1);
}
process.exit(0);
