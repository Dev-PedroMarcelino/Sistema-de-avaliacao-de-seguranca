"use client";

import { Printer } from "lucide-react";
import { Botao } from "@/components/ui";

export function BotaoImprimir({ rotulo = "Imprimir" }: { rotulo?: string }) {
  return (
    <Botao variante="contorno" tamanho="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {rotulo}
    </Botao>
  );
}
