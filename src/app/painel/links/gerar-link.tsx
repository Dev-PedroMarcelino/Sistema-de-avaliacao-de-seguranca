"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Copy, MessageCircle, Plus } from "lucide-react";
import { Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import * as fmt from "@/lib/formato";
import { gerarLink } from "../acoes";

export function GerarLink({ unidades, transportadoras }: { unidades: { id: string; nome: string }[]; transportadoras: string[] }) {
  const [estado, acao, enviando] = useActionState(gerarLink, null);
  const [copiado, setCopiado] = useState<"" | "link" | "mensagem">("");
  const form = useRef<HTMLFormElement>(null);

  async function copiar(texto: string, qual: "link" | "mensagem") {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
    setTimeout(() => setCopiado(""), 1800);
  }

  const gerado = estado?.ok ? estado : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <form ref={form} action={acao} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="nome">Nome do motorista</Rotulo>
            <Campo id="nome" name="nome" placeholder="Opcional" />
          </div>
          <div>
            <Rotulo htmlFor="telefone">WhatsApp do motorista</Rotulo>
            <Campo id="telefone" name="telefone" inputMode="tel" placeholder="(19) 99999-1234" required />
          </div>
          <div>
            <Rotulo htmlFor="transportadora">Transportadora</Rotulo>
            <Campo id="transportadora" name="transportadora" list="transportadoras" placeholder="Opcional" />
            <datalist id="transportadoras">
              {transportadoras.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <Rotulo htmlFor="unidade">Unidade</Rotulo>
            <Selecao id="unidade" name="unidade" defaultValue={unidades[0]?.id}>
              {unidades.map((un) => (
                <option key={un.id} value={un.id}>
                  {un.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
        {estado && !estado.ok && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{estado.erro}</p>
        )}
        <Botao type="submit" disabled={enviando} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> {enviando ? "Gerando…" : "Gerar link"}
        </Botao>
      </form>

      <div className={`rounded-2xl p-5 ring-1 ${gerado ? "bg-green-50 ring-green-200" : "bg-stone-50 ring-stone-200"}`}>
        {gerado ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-green-800">Link pronto para {gerado.nome || fmt.telefone(gerado.telefone)}</p>
              <p className="text-xs text-green-700">Vale até {fmt.dataHora(gerado.expiraEm)}</p>
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-stone-700 ring-1 ring-green-200">{gerado.mensagem}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={gerado.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-green-600 px-4 font-semibold text-white hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
              </a>
              <Botao variante="contorno" onClick={() => copiar(gerado.link, "link")}>
                {copiado === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar link
              </Botao>
              <Botao variante="contorno" onClick={() => copiar(gerado.mensagem, "mensagem")}>
                {copiado === "mensagem" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar mensagem
              </Botao>
            </div>
            <button type="button" className="text-sm font-semibold text-stone-600 underline" onClick={() => form.current?.reset()}>
              Limpar formulário para o próximo
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-stone-600">
            <p className="font-semibold text-tinta">Como funciona</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Informe o WhatsApp do motorista e gere o link.</li>
              <li>Toque em “Enviar pelo WhatsApp”: a conversa abre com a mensagem pronta.</li>
              <li>O motorista assiste, responde e assina pelo celular.</li>
              <li>O comprovante aparece aqui e na portaria na hora.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
