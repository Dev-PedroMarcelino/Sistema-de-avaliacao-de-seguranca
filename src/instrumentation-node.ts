import { getDb } from "./lib/db";

if (process.env.DATABASE_URL) {
  await getDb().catch((erro) => console.error("[integra] falha ao preparar o banco:", erro));
}
