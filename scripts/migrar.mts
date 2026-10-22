// Aplica as migrações de supabase/migrations no banco de DATABASE_URL.
// Uso: npm run db:migrate

import { aplicarMigracoes, getDb } from "../src/lib/db";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* sem .env.local: usa o ambiente */
}

if (!process.env.DATABASE_URL) {
  console.error("Defina DATABASE_URL (conexão do Postgres do Supabase). Sem ela o sistema usa o banco embutido, que migra sozinho.");
  process.exit(1);
}

const db = await getDb();
const aplicadas = await aplicarMigracoes(db);
console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(", ")}` : "Banco já está atualizado.");
process.exit(0);
