import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Cabecalho, Tabela, Vazio } from "@/components/painel";
import { Campo, SeloSituacao, Selecao, classesBotao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { listarMotoristas, listarTransportadoras } from "@/lib/painel/consultas";
import * as fmt from "@/lib/formato";

export const metadata: Metadata = { title: "Motoristas" };

export default async function Motoristas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; situacao?: string; transportadora?: string }>;
}) {
  const u = await exigirUsuario("motoristas");
  const { q = "", situacao = "", transportadora = "" } = await searchParams;
  const db = await getDb();
  const [motoristas, transportadoras] = await Promise.all([
    listarMotoristas(db, u.empresaId, { busca: q, situacao, transportadoraId: transportadora }),
    listarTransportadoras(db, u.empresaId),
  ]);

  return (
    <>
      <Cabecalho titulo="Motoristas" descricao={`${motoristas.length} motoristas encontrados.`} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Campo name="q" defaultValue={q} placeholder="Nome, CPF, telefone ou placa" className="pl-10" />
        </div>
        <Selecao name="situacao" defaultValue={situacao}>
          <option value="">Todas as situações</option>
          <option value="valida">Válida</option>
          <option value="vencendo">Vencendo em 30 dias</option>
          <option value="vencida">Vencida</option>
          <option value="pendente">Nunca concluiu</option>
        </Selecao>
        <Selecao name="transportadora" defaultValue={transportadora}>
          <option value="">Todas as transportadoras</option>
          {transportadoras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Selecao>
        <button className={classesBotao("primario")}>Filtrar</button>
      </form>

      {motoristas.length === 0 ? (
        <Vazio>Nenhum motorista com esses filtros.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Motorista</th>
              <th>Placa</th>
              <th>Transportadora</th>
              <th>Situação</th>
              <th>Última integração</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m) => (
              <tr key={m.id} className="hover:bg-stone-50">
                <td>
                  <Link href={`/painel/motoristas/${m.id}`} className="font-semibold hover:underline">
                    {m.nome}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {fmt.cpfMascarado(m.cpf)} · {fmt.telefone(m.telefone)}
                  </p>
                </td>
                <td className="font-mono">{fmt.placa(m.placa)}</td>
                <td className="text-stone-600">{m.transportadora ?? "—"}</td>
                <td>
                  <SeloSituacao situacao={m.situacao} />
                  {m.vigente_ate && <p className="mt-1 text-xs text-stone-500">até {fmt.data(m.vigente_ate)}</p>}
                </td>
                <td className="text-stone-600">
                  {m.emitido_em ? fmt.data(m.emitido_em) : "—"}
                  {m.integracoes > 1 && <p className="text-xs text-stone-500">{m.integracoes} integrações</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </>
  );
}
