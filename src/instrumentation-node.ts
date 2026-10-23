import { getDb } from "./lib/db";
import { iniciarAgendador } from "./lib/alertas/agendador";

if (process.env.DATABASE_URL) {
  await getDb().catch((erro) => console.error("[integra] falha ao preparar o banco:", erro));
  iniciarAgendador();
}
