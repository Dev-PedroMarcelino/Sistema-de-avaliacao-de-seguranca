import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Cabecalho, Tabela, Vazio } from "@/components/painel";
import { Campo, Rotulo, SeloSituacao, Selecao, classesBotao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { listarTransportadoras, listarUnidades, relatorio } from "@/lib/painel/consultas";
import { consultaDoFiltro, descreverFiltro, filtroDaUrl } from "@/lib/painel/filtro-relatorio";
import * as fmt from "@/lib/formato";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Relatorios({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await exigirUsuario("relatorios");
  const filtro = filtroDaUrl(await searchParams);
  const db = await getDb();
  const [linhas, unidades, transportadoras] = await Promise.all([
    relatorio(db, u.empresaId, filtro),
    listarUnidades(db, u.empresaId),
    listarTransportadoras(db, u.empresaId),
  ]);
  const consulta = consultaDoFiltro(filtro);
  const unidade = unidades.find((un) => un.id === filtro.unidadeId)?.nome;

  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao={descreverFiltro(filtro, unidade)}
        acoes={
          <>
            <a href={`/api/painel/relatorio?${consulta}`} className={classesBotao("contorno", "sm")}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
            <a href={`/api/painel/relatorio?${consulta}&formato=pdf`} className={classesBotao("primario", "sm")}>
              <FileDown className="h-4 w-4" /> PDF
            </a>
          </>
        }
      />
      <form className="mb-5 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <Rotulo htmlFor="de">De</Rotulo>
          <Campo id="de" name="de" type="date" defaultValue={filtro.de} />
        </div>
        <div>
          <Rotulo htmlFor="ate">Até</Rotulo>
          <Campo id="ate" name="ate" type="date" defaultValue={filtro.ate} />
        </div>
        <div>
          <Rotulo htmlFor="unidade">Unidade</Rotulo>
          <Selecao id="unidade" name="unidade" defaultValue={filtro.unidadeId}>
            <option value="">Todas</option>
            {unidades.map((un) => (
              <option key={un.id} value={un.id}>
                {un.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="transportadora">Transportadora</Rotulo>
          <Selecao id="transportadora" name="transportadora" defaultValue={filtro.transportadora}>
            <option value="">Todas</option>
            {transportadoras.map((t) => (
              <option key={t.id} value={t.nome}>
                {t.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="situacao">Situação</Rotulo>
          <Selecao id="situacao" name="situacao" defaultValue={filtro.situacao}>
            <option value="">Todas</option>
            <option value="valida">Válida</option>
            <option value="vencendo">Vencendo</option>
            <option value="vencida">Vencida</option>
          </Selecao>
        </div>
        <div className="flex items-end">
          <button className={classesBotao("primario", "md", "w-full")}>Aplicar</button>
        </div>
      </form>

      {linhas.length === 0 ? (
        <Vazio>Nenhuma integração concluída no período.</Vazio>
      ) : (
        <>
          <p className="mb-2 text-sm text-stone-600">{linhas.length} integrações concluídas.</p>
          <Tabela>
            <thead>
              <tr>
                <th>Data</th>
                <th>Motorista</th>
                <th>Placa</th>
                <th>Transportadora</th>
                <th>Código</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap">{fmt.dataHora(l.emitido_em)}</td>
                  <td>
                    <Link href={`/painel/integracoes/${l.integracao_id}`} className="font-semibold hover:underline">
                      {l.nome}
                    </Link>
                    <p className="text-xs text-stone-500">{fmt.cpfMascarado(l.cpf)}</p>
                  </td>
                  <td className="font-mono">{fmt.placa(l.placa)}</td>
                  <td className="text-stone-600">{l.transportadora}</td>
                  <td className="font-mono text-xs">{l.codigo}</td>
                  <td>
                    <SeloSituacao situacao={l.situacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </>
      )}
    </>
  );
}
