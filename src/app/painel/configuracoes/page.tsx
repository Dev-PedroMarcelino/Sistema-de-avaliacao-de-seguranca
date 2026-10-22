import type { Metadata } from "next";
import { Cabecalho } from "@/components/painel";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { listarUnidades, obterEmpresa } from "@/lib/painel/consultas";
import * as fmt from "@/lib/formato";
import { alternarUsuario } from "../acoes";
import { FormEmpresa, FormUnidade, FormUsuario } from "./formularios";

export const metadata: Metadata = { title: "Configurações" };

const PERFIS = { admin: "Administrador", seguranca: "Segurança", portaria: "Portaria" };

export default async function Configuracoes() {
  const u = await exigirUsuario("configuracoes");
  const db = await getDb();
  const [empresa, unidades, usuarios] = await Promise.all([
    obterEmpresa(db, u.empresaId),
    listarUnidades(db, u.empresaId),
    db.query<{ id: string; nome: string; email: string; perfil: keyof typeof PERFIS; ativo: boolean; ultimo_acesso_em: Date | null }>(
      "select id, nome, email, perfil, ativo, ultimo_acesso_em from app.usuarios where empresa_id = $1 order by nome",
      [u.empresaId],
    ),
  ]);

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:row-span-2">
          <h2 className="mb-4 font-bold">Empresa e mensagem do WhatsApp</h2>
          <FormEmpresa empresa={empresa!} />
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="mb-3 font-bold">Unidades (portarias)</h2>
          <ul className="mb-4 divide-y divide-stone-100 text-sm">
            {unidades.map((un) => (
              <li key={un.id} className="flex justify-between py-2">
                <span className="font-semibold">{un.nome}</span>
                <span className="font-mono text-xs text-stone-500">/entrada/{un.slug}</span>
              </li>
            ))}
          </ul>
          <FormUnidade />
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="mb-3 font-bold">Pessoas com acesso</h2>
          <ul className="mb-4 divide-y divide-stone-100 text-sm">
            {usuarios.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className={p.ativo ? "" : "text-stone-400 line-through"}>
                  <span className="block font-semibold">{p.nome}</span>
                  <span className="text-xs text-stone-500">
                    {p.email} · {PERFIS[p.perfil]} · último acesso {p.ultimo_acesso_em ? fmt.dataHora(p.ultimo_acesso_em) : "nunca"}
                  </span>
                </span>
                {p.id !== u.id && (
                  <form action={alternarUsuario.bind(null, p.id)}>
                    <button className="text-xs font-semibold text-stone-600 underline">{p.ativo ? "Desativar" : "Reativar"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <FormUsuario />
        </section>
      </div>
    </>
  );
}
