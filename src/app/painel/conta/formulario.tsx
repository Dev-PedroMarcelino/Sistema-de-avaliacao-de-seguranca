"use client";

import { useActionState, useEffect, useRef } from "react";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { alterarSenha } from "../acoes";

export function FormSenha() {
  const [estado, acao, enviando] = useActionState(alterarSenha, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={acao} className="space-y-4">
      <div>
        <Rotulo htmlFor="atual">Senha atual</Rotulo>
        <Campo id="atual" name="atual" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Rotulo htmlFor="nova">Nova senha (10+ caracteres)</Rotulo>
        <Campo id="nova" name="nova" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div>
        <Rotulo htmlFor="confirmacao">Repita a nova senha</Rotulo>
        <Campo id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      {estado && (estado.ok ? <Aviso tipo="ok">Senha alterada.</Aviso> : <Aviso>{estado.erro}</Aviso>)}
      <Botao type="submit" disabled={enviando}>
        Trocar senha
      </Botao>
    </form>
  );
}
