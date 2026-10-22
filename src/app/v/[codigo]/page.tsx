import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckBig, CircleX, Clock4, SearchX } from "lucide-react";
import { getDb } from "@/lib/db";
import { verificarComprovante } from "@/lib/integracao/servico";
import { normalizarCodigo } from "@/lib/codigo";
import * as fmt from "@/lib/formato";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificar comprovante", robots: { index: false } };

export default async function Verificar({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarCodigo(decodeURIComponent((await params).codigo));
  const r = await verificarComprovante(await getDb(), codigo);

  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="faixa-seguranca h-2" />
      <header className="bg-tinta">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/">
            <Logo claro />
          </Link>
          <span className="text-sm text-stone-400">Verificação de comprovante</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {!r ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center ring-1 ring-stone-200">
            <SearchX className="h-14 w-14 text-stone-400" />
            <h1 className="text-2xl font-extrabold">Comprovante não encontrado</h1>
            <p className="text-stone-600">
              Confira o código <strong className="font-mono">{codigo}</strong>. Ele tem 8 letras e números, como K7M2-9QX4.
            </p>
            <Link href="/v" className="font-semibold underline">
              Digitar outro código
            </Link>
          </div>
        ) : (
          <Resultado r={r} />
        )}
      </main>
    </div>
  );
}

function Resultado({ r }: { r: NonNullable<Awaited<ReturnType<typeof verificarComprovante>>> }) {
  const d = r.comprovante.dados;
  const ok = r.autentico;
  return (
    <div className="space-y-5">
      <div className={`rounded-3xl p-6 text-white ${ok ? "bg-green-700" : "bg-red-700"}`}>
        <div className="flex items-center gap-4">
          {ok ? <CircleCheckBig className="h-14 w-14 shrink-0" /> : <CircleX className="h-14 w-14 shrink-0" />}
          <div>
            <h1 className="text-2xl font-extrabold">{ok ? "Comprovante autêntico" : "Comprovante NÃO confere"}</h1>
            <p className="mt-0.5 text-white/85">
              {ok
                ? "Os registros estão íntegros: nada foi alterado desde a emissão."
                : "Os registros guardados não batem com o comprovante. Ele pode ter sido adulterado."}
            </p>
          </div>
        </div>
        <p className="mt-4 font-mono text-3xl font-black tracking-wider">{d.codigo}</p>
      </div>

      <div
        className={`flex items-center gap-3 rounded-2xl px-5 py-4 font-semibold ring-1 ${
          r.vigente ? "bg-white text-green-800 ring-stone-200" : "bg-amber-50 text-amber-900 ring-amber-200"
        }`}
      >
        <Clock4 className="h-5 w-5" />
        {r.vigente
          ? `Integração válida até ${fmt.data(r.comprovante.vigente_ate)}`
          : `Integração vencida em ${fmt.data(r.comprovante.vigente_ate)}`}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:grid-cols-2">
        <Item rotulo="Motorista" valor={d.motorista.nome} />
        <Item rotulo="CPF" valor={fmt.cpfMascarado(d.motorista.cpf)} />
        <Item rotulo="Placa" valor={fmt.placa(d.placa)} />
        <Item rotulo="Transportadora" valor={d.transportadora ?? "—"} />
        <Item rotulo="Empresa" valor={`${d.empresa} · ${d.unidade}`} />
        <Item rotulo="Emitido em" valor={fmt.dataHora(d.emitido_em)} />
        <Item rotulo="Treinamento" valor={`${d.treinamento.titulo} (v${d.treinamento.versao})`} />
        <Item rotulo="Vídeo" valor={`${fmt.duracao(d.video.duracao_seg)} assistidos até o fim`} />
      </dl>

      <details className="rounded-2xl bg-white p-5 text-sm ring-1 ring-stone-200">
        <summary className="cursor-pointer font-semibold">Como esta verificação funciona</summary>
        <div className="mt-3 space-y-2 text-stone-600">
          <p>
            Cada passo da integração (abrir o link, assistir ao vídeo, cada resposta, a assinatura) foi gravado com o
            horário do servidor e um resumo criptográfico SHA-256 que inclui o resumo do passo anterior. Se qualquer
            registro for mudado ou apagado, a corrente deixa de bater e esta página mostra que o comprovante não confere.
          </p>
          <p className="font-mono text-xs break-all">
            Eventos na corrente: {r.eventos.length} · {r.corrente.valida ? "corrente íntegra" : "corrente quebrada"}
            <br />
            SHA-256 do comprovante: {r.comprovante.hash}
            {d.treinamento.conteudo_hash && (
              <>
                <br />
                SHA-256 do conteúdo (vídeo e perguntas): {d.treinamento.conteudo_hash}
              </>
            )}
          </p>
        </div>
      </details>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border-b border-stone-100 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold">{valor}</dd>
    </div>
  );
}
