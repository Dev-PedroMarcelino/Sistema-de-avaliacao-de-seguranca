"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { Botao } from "@/components/ui";
import { conferir } from "../acoes";

/** O porteiro confirma que viu o motorista pessoalmente: fica registrado na trilha como testemunha. */
export function BotaoConferir({ integracaoId, tamanho = "sm" }: { integracaoId: string; tamanho?: "sm" | "md" }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  return (
    <div>
      <Botao
        tamanho={tamanho}
        variante="contorno"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await conferir(integracaoId);
            if (!r.ok) setErro(r.erro);
          })
        }
      >
        <UserCheck className="h-4 w-4" /> {pendente ? "Registrando…" : "Conferi pessoalmente"}
      </Botao>
      {erro && <p className="mt-1 text-xs text-red-700">{erro}</p>}
    </div>
  );
}
