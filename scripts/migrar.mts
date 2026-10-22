// Aplica as migrações de supabase/migrations no banco de DATABASE_URL.
// Uso: ENV_FILE=.env.producao.local npm run db:migrate

import { exigirBanco } from "./ambiente.mts";
import { aplicarMigracoes, getDb } from "../src/lib/db";

exigirBanco();
const db = await getDb();
const aplicadas = await aplicarMigracoes(db);
console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(", ")}` : "Banco já está atualizado.");
process.exit(0);
