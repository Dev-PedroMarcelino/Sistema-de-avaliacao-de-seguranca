import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import clsx from "clsx";
import { MessageCircle, QrCode } from "lucide-react";
import { Cabecalho, Tabela, Vazio } from "@/components/painel";
import { SeloSituacao, type Situacao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { NOME_ETAPA, type SituacaoLink, listarLinks, listarUnidades, listarTransportadoras, obterEmpresa } from "@/lib/painel/consultas";
import { urlBase } from "@/lib/requisicao";
import { linkWhatsApp, preencherMensagem } from "@/lib/whatsapp";
import * as fmt from "@/lib/formato";
import { GerarLink } from "./gerar-link";

export const metadata: Metadata = { title: "Enviar link" };

const FILTROS: { valor: SituacaoLink | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "enviado", rotulo: "Não abertos" },
  { valor: "andamento", rotulo: "Em andamento" },
  { valor: "concluida", rotulo: "Concluídos" },
  { valor: "expirado", rotulo: "Expirados" },
];

const SELO: Record<SituacaoLink, Situacao> = { enviado: "pendente", andamento: "andamento", concluida: "valida", expirado: "expirado" };
const TEXTO_SELO: Record<SituacaoLink, string> = { enviado: "Não aberto", andamento: "Em andamento", concluida: "Concluído", expirado: "Expirado" };

export default async function Links({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const u = await exigirUsuario("links");
  const { situacao = "" } = await searchParams;
  const db = await getDb();
  const [links, unidades, transportadoras, empresa] = await Promise.all([
    listarLinks(db, u.empresaId, { situacao }),
    listarUnidades(db, u.empresaId),
    listarTransportadoras(db, u.empresaId),
    obterEmpresa(db, u.empresaId),
  ]);
  const base = urlBase(await headers());

  return (
    <>
      <Cabecalho
        titulo="Enviar link pelo WhatsApp"
        descricao="Cada motorista recebe um link só dele. O botão abre o WhatsApp com a mensagem pronta: é só apertar enviar."
        acoes={
          <Link href="/painel/portaria#qr" className="flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-tinta">
            <QrCode className="h-4 w-4" /> QR Code da portaria
          </Link>
        }
      />
      <GerarLink unidades={unidades} transportadoras={transportadoras.map((t) => t.nome)} />

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Links enviados</h2>
        <nav className="flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={f.valor ? `/painel/links?situacao=${f.valor}` : "/painel/links"}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                situacao === f.valor ? "bg-tinta text-white" : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {f.rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {links.length === 0 ? (
        <Vazio>Nenhum link nesta situação.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th>Motorista</th>
              <th>Situação</th>
              <th>Origem</th>
              <th>Criado</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => {
              const reenviar =
                (l.situacao === "enviado" || l.situacao === "andamento") &&
                linkWhatsApp(
                  l.telefone,
                  preencherMensagem(empresa!.mensagem_whatsapp, { nome: l.nome, empresa: empresa!.nome, link: `${base}/i/${l.token}` }),
                );
              return (
                <tr key={l.id}>
                  <td>
                    <p className="font-semibold">{l.nome ?? "Sem nome"}</p>
                    <p className="text-xs text-stone-500">{fmt.telefone(l.telefone)}</p>
                  </td>
                  <td>
                    <SeloSituacao situacao={SELO[l.situacao]}>{TEXTO_SELO[l.situacao]}</SeloSituacao>
                    {l.situacao === "andamento" && <p className="mt-1 text-xs text-stone-500">{NOME_ETAPA[l.etapa]}</p>}
                  </td>
                  <td className="text-stone-600">
                    {l.origem === "qr" ? "QR da portaria" : `Link${l.por ? ` · ${l.por}` : ""}`}
                    <p className="text-xs text-stone-500">{l.unidade}</p>
                  </td>
                  <td className="whitespace-nowrap text-stone-600">{fmt.dataHora(l.criado_em)}</td>
                  <td>
                    <div className="flex justify-end gap-3">
                      {reenviar && (
                        <a
                          href={reenviar}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-semibold text-green-700 hover:underline"
                        >
                          <MessageCircle className="h-4 w-4" /> Reenviar
                        </a>
                      )}
                      <Link href={`/painel/integracoes/${l.id}`} className="font-semibold hover:underline">
                        Detalhes
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
    </>
  );
}
