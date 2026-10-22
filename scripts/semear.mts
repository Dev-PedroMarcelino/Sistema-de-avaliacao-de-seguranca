// Prepara o banco de DATABASE_URL.
//
//   npm run db:seed -- demo
//       Empresa fictícia "Mineração Demo" com histórico (para o deploy de portfólio).
//
//   npm run db:seed -- empresa "Nome da Empresa" "Nome da Unidade" "Nome do Admin" admin@empresa.com.br
//       Cliente real: empresa, unidade, treinamento vazio e o primeiro administrador.
//       A senha vem de ADMIN_SENHA ou é gerada e mostrada uma vez.

import { randomBytes } from "node:crypto";
import { getDb } from "../src/lib/db";
import { semearDemo } from "../src/lib/demo/semear";
import { criarEmpresa } from "../src/lib/integracao/empresa";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* sem .env.local: usa o ambiente */
}

const [modo, ...args] = process.argv.slice(2);
const db = await getDb();

if (modo === "demo") {
  await semearDemo(db);
  console.log("Dados de demonstração criados.");
} else if (modo === "empresa" && args.length === 4) {
  const [empresa, unidade, nome, email] = args;
  const senha = process.env.ADMIN_SENHA || randomBytes(9).toString("base64url");
  await criarEmpresa(db, { empresa, unidade, admin: { nome, email, senha } });
  console.log(`Empresa criada. Acesso do administrador: ${email}`);
  if (!process.env.ADMIN_SENHA) console.log(`Senha inicial (anote, não será mostrada de novo): ${senha}`);
  console.log("Próximo passo: entre no painel, vá em “Vídeo e perguntas”, cole o link do vídeo e publique.");
} else {
  console.error('Uso: npm run db:seed -- demo\n     npm run db:seed -- empresa "Empresa" "Unidade" "Nome do admin" email');
  process.exit(1);
}
process.exit(0);
