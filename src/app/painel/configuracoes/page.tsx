import type { Metadata } from "next";
import { Cabecalho } from "@/components/painel";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb, um } from "@/lib/db";
import { listarUnidades, obterEmpresa, ultimosAlertas } from "@/lib/painel/consultas";
import { whatsappConfigurado } from "@/lib/whatsapp-api";
import * as fmt from "@/lib/formato";
import { alternarUsuario } from "../acoes";
import { FormAlertas, FormEmpresa, FormUnidade, FormUsuario } from "./formularios";

export const metadata: Metadata = { title: "Configurações" };

const PERFIS = { admin: "Administrador", seguranca: "Segurança", portaria: "Portaria" };

export default async function Configuracoes() {
  const u = await exigirUsuario("configuracoes");
  const db = await getDb();
  const [empresa, unidades, alertas, treinamento, usuarios] = await Promise.all([
    obterEmpresa(db, u.empresaId),
    listarUnidades(db, u.empresaId),
    ultimosAlertas(db, u.empresaId),
    um<{ validade_dias: number }>(db, "select validade_dias from app.treinamentos where empresa_id = $1 order by criado_em limit 1", [
      u.empresaId,
    ]),
    db.query<{ id: string; nome: string; email: string; perfil: keyof typeof PERFIS; ativo: boolean; ultimo_acesso_em: Date | null }>(
      "select id, nome, email, perfil, ativo, ultimo_acesso_em from app.usuarios where empresa_id = $1 order by nome",
      [u.empresaId],
    ),
  ]);
  const validade = treinamento?.validade_dias ?? 365;
  const automatico = whatsappConfigurado();

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

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:col-span-2">
          <h2 className="font-bold">Aviso de integração vencida</h2>
          <p className="mb-4 mt-1 text-sm text-stone-600">
            Quando a integração de um motorista vence ({validade} dias depois de feita), o sistema manda um WhatsApp para estes
            números avisando para barrar a entrada até ele refazer. Cada vencimento é avisado uma vez só.
            {!automatico && (
              <strong className="mt-1 block text-amber-800">
                O envio automático ainda não está ligado no servidor (faltam UAZAPI_URL e UAZAPI_TOKEN).
              </strong>
            )}
          </p>
          <FormAlertas numeros={empresa!.whatsapp_alertas} />
          {alertas.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100 text-sm">
              {alertas.map((a, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{a.nome}</span> · {fmt.placa(a.placa)}
                  </span>
                  <span className={a.status === "enviado" ? "text-green-700" : "text-red-700"} title={a.ultimo_erro ?? ""}>
                    {a.status === "enviado" ? `avisado ${fmt.dataHora(a.enviado_em)}` : `falhou: ${a.ultimo_erro?.slice(0, 60) ?? a.status}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
