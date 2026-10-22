"use client";

import { useActionState } from "react";
import { Botao, Campo, Rotulo } from "@/components/ui";
import { entrarPeloQr } from "./acoes";

export function FormularioEntrada({ unidadeSlug }: { unidadeSlug: string }) {
  const [estado, acao, enviando] = useActionState(entrarPeloQr, null);
  return (
    <form action={acao} className="mt-6 space-y-4">
      <input type="hidden" name="unidade" value={unidadeSlug} />
      <div>
        <Rotulo htmlFor="nome">Nome completo</Rotulo>
        <Campo id="nome" name="nome" autoComplete="name" required />
      </div>
      <div>
        <Rotulo htmlFor="telefone">Seu WhatsApp (com DDD)</Rotulo>
        <Campo id="telefone" name="telefone" inputMode="tel" autoComplete="tel" placeholder="(19) 99999-1234" required />
      </div>
      {estado?.erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{estado.erro}</p>}
      <Botao tamanho="lg" type="submit" disabled={enviando}>
        {enviando ? "Abrindo…" : "Começar integração"}
      </Botao>
      <p className="text-center text-xs text-stone-500">Faça com o veículo parado, em local seguro.</p>
    </form>
  );
}
