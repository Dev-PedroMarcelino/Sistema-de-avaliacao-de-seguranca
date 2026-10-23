import { getDb, um } from "@/lib/db";
import { variaveisDeCadastroFaltando } from "@/lib/db/preparar";

export const dynamic = "force-dynamic";

/** Diagnóstico para o deploy: só sim/não e contagens, nunca valores de configuração. */
export async function GET() {
  const config = {
    banco_configurado: Boolean(process.env.DATABASE_URL),
    auth_secret: Boolean(process.env.AUTH_SECRET),
    demo: process.env.DEMO_MODE === "true",
    migrar_ao_iniciar: process.env.MIGRAR_AO_INICIAR === "true",
    conteudo_inicial: Boolean(process.env.CONTEUDO_INICIAL),
    cadastro_faltando: variaveisDeCadastroFaltando(),
  };
  try {
    const db = await getDb();
    const r = await um<{ empresas: number; unidades: number; versoes_publicadas: number; migracoes: number }>(
      db,
      `select (select count(*)::int from app.empresas) as empresas,
              (select count(*)::int from app.unidades) as unidades,
              (select count(*)::int from app.versoes where publicada_em is not null) as versoes_publicadas,
              (select count(*)::int from app.migracoes) as migracoes`,
    );
    return Response.json({ ok: true, banco: "conectado", ...r, config }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? "erro";
    return Response.json({ ok: false, banco: codigo, config }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
