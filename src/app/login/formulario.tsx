"use client";

import { useActionState } from "react";
import { Botao, Campo, Rotulo } from "@/components/ui";
import { entrar } from "./acoes";

export function FormularioLogin({ proximo }: { proximo: string }) {
  const [estado, acao, enviando] = useActionState(entrar, null);
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />
      <div>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Campo id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <Campo id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      {estado?.erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{estado.erro}</p>}
      <Botao type="submit" tamanho="lg" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
