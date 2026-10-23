import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CircleCheckBig, CircleX, Clock4, Search, UserCheck } from "lucide-react";
import { Cabecalho } from "@/components/painel";
import { BotaoImprimir } from "@/components/imprimir";
import { Campo, classesBotao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb } from "@/lib/db";
import { buscarNaPortaria, listarUnidades, placaDoTermo } from "@/lib/painel/consultas";
import { urlBase } from "@/lib/requisicao";
import * as fmt from "@/lib/formato";
import { BotaoConferir } from "./botao-conferir";
import { VincularPlacaRapido } from "../motoristas/vinculos";

export const metadata: Metadata = { title: "Portaria" };

export default async function Portaria({ searchParams }: { searchParams: Promise<{ q?: string; placa?: string }> }) {
  const u = await exigirUsuario("portaria");
  const { q = "", placa = "" } = await searchParams;
  const db = await getDb();
  const resultados = q ? await buscarNaPortaria(db, u.empresaId, q) : [];
  // Placa digitada que não achou ninguém, e a que veio junto na busca pelo motorista (para vincular).
  const placaBuscada = placaDoTermo(q);
  const placaParaVincular = placaDoTermo(placa) ?? placaBuscada;
  const base = urlBase(await headers());
  const unidades = await listarUnidades(db, u.empresaId);
  const qrs = await Promise.all(
    unidades.map(async (un) => ({
      ...un,
      url: `${base}/entrada/${un.slug}`,
      qr: await QRCode.toDataURL(`${base}/entrada/${un.slug}`, { margin: 1, width: 480 }),
    })),
  );

  return (
    <>
      <div className="nao-imprimir">
        <Cabecalho titulo="Portaria" descricao="Digite a placa, o CPF ou o nome do motorista para ver se ele pode entrar." />
      </div>

      <form className="nao-imprimir flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <Campo
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Placa (ABC1D23), CPF ou nome"
            className="h-14 pl-12 text-lg uppercase placeholder:normal-case"
          />
        </div>
        <button className={classesBotao("primario", "md", "h-14 px-6")}>Consultar</button>
      </form>

      <div className="nao-imprimir mt-5 space-y-3">
        {q && resultados.length === 0 && placaBuscada && (
          <div className="flex items-start gap-4 rounded-2xl bg-amber-500 p-5 text-tinta">
            <CircleX className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold">Caminhão {fmt.placa(placaBuscada)} não está cadastrado</p>
              <p className="mt-0.5">
                A integração é do motorista, não do caminhão. Procure pelo <strong>CPF ou nome</strong> de quem está dirigindo:
                se ele tiver integração válida, pode entrar, e você vincula esta placa ao cadastro dele.
              </p>
              <form className="mt-3 flex gap-2" role="search">
                <input type="hidden" name="placa" value={placaBuscada} />
                <Campo name="q" placeholder="CPF ou nome do motorista" className="h-12 bg-white" autoFocus />
                <button className={classesBotao("primario", "md", "h-12 px-5")}>Buscar motorista</button>
              </form>
            </div>
          </div>
        )}
        {q && resultados.length === 0 && !placaBuscada && (
          <div className="flex items-center gap-4 rounded-2xl bg-red-700 p-5 text-white">
            <CircleX className="h-12 w-12 shrink-0" />
            <div>
              <p className="text-xl font-extrabold">Nenhuma integração encontrada</p>
              <p className="text-red-100">
                Este motorista ainda não fez a integração. Envie um link pelo WhatsApp ou peça para ler o QR Code abaixo.
              </p>
              <Link href="/painel/links" className="mt-2 inline-block font-semibold underline">
                Enviar link agora
              </Link>
            </div>
          </div>
        )}
        {resultados.map((r) => {
          const liberado = r.situacao === "valida" || r.situacao === "vencendo";
          const emAndamento = !r.codigo && r.etapa && r.etapa !== "concluida";
          return (
            <div
              key={r.motorista_id}
              className={`flex flex-wrap items-center gap-4 rounded-2xl p-5 ${
                liberado ? "bg-green-700 text-white" : "bg-red-700 text-white"
              }`}
            >
              {liberado ? <CircleCheckBig className="h-12 w-12 shrink-0" /> : <CircleX className="h-12 w-12 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">
                  {liberado ? "Integração válida · pode entrar" : r.situacao === "vencida" ? "Integração vencida" : "Sem integração"}
                </p>
                <p className="truncate text-xl font-extrabold">{r.nome}</p>
                <p className="text-sm opacity-90">
                  {fmt.cpfMascarado(r.cpf)}
                  {r.placas.length > 0 && ` · placas ${r.placas.map((p) => fmt.placa(p)).join(", ")}`}
                  {r.transportadoras.length > 0 && ` · ${r.transportadoras.join(", ")}`}
                </p>
                {placaParaVincular && !r.placas.includes(placaParaVincular) && (
                  <div className="mt-2 inline-block rounded-xl bg-white p-1 text-tinta">
                    <VincularPlacaRapido motoristaId={r.motorista_id} placa={placaParaVincular} />
                  </div>
                )}
                {r.vigente_ate && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    <Clock4 className="h-4 w-4" />
                    {liberado ? `Válida até ${fmt.data(r.vigente_ate)}` : `Venceu em ${fmt.data(r.vigente_ate)}`}
                    {r.codigo && <span className="font-mono opacity-80">· {r.codigo}</span>}
                  </p>
                )}
                {emAndamento && <p className="mt-1 text-sm">Integração começada, ainda não concluída.</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                {liberado && r.integracao_id && !r.conferido_em && (
                  <div className="rounded-xl bg-white p-1">
                    <BotaoConferir integracaoId={r.integracao_id} tamanho="md" />
                  </div>
                )}
                {r.conferido_em && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
                    <UserCheck className="h-4 w-4" /> Conferido {fmt.dataHora(r.conferido_em)}
                  </p>
                )}
                <Link href={`/painel/motoristas/${r.motorista_id}`} className="text-sm font-semibold underline">
                  Ver histórico
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <section id="qr" className="mt-10">
        <div className="nao-imprimir mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">QR Code da portaria</h2>
            <p className="text-sm text-stone-600">
              Imprima e cole na portaria. Quem chegar sem integração lê o código, digita o WhatsApp e faz na hora.
            </p>
          </div>
          <BotaoImprimir rotulo="Imprimir cartaz" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {qrs.map((un) => (
            <div key={un.id} className="break-inside-avoid overflow-hidden rounded-2xl bg-white text-center ring-1 ring-stone-200 print:ring-2 print:ring-black">
              <div className="faixa-seguranca h-3" />
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Motorista externo</p>
                <p className="mt-1 text-2xl font-extrabold leading-tight">Faça a integração de segurança antes de entrar</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={un.qr} alt={`QR Code de entrada da ${un.nome}`} className="mx-auto my-4 h-56 w-56" />
                <p className="font-semibold">Aponte a câmera do celular</p>
                <p className="text-sm text-stone-500">{un.nome}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-stone-400">{un.url}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
