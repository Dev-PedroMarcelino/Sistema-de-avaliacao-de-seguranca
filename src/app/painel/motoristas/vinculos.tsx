"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Botao, Campo } from "@/components/ui";
import { placa as formatarPlaca } from "@/lib/formato";
import { removerPlaca, removerTransportadora, vincularPlaca, vincularTransportadora } from "../acoes";

/** Na portaria: vincula na hora a placa que não estava no cadastro do motorista. */
export function VincularPlacaRapido({ motoristaId, placa }: { motoristaId: string; placa: string }) {
  const [pendente, iniciar] = useTransition();
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState("");
  if (feito) return <p className="text-sm font-semibold">Placa {formatarPlaca(placa)} vinculada.</p>;
  return (
    <div>
      <Botao
        tamanho="sm"
        variante="contorno"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await vincularPlaca(motoristaId, placa);
            if (r.ok) setFeito(true);
            else setErro(r.erro);
          })
        }
      >
        <Plus className="h-4 w-4" /> Vincular placa {formatarPlaca(placa)}
      </Botao>
      {erro && <p className="mt-1 text-xs">{erro}</p>}
    </div>
  );
}

/** Na página do motorista: lista, inclui e remove placas e transportadoras. */
export function VinculosMotorista({
  motoristaId,
  placas,
  transportadoras,
}: {
  motoristaId: string;
  placas: string[];
  transportadoras: { id: string; nome: string }[];
}) {
  const [pendente, iniciar] = useTransition();
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novaTransp, setNovaTransp] = useState("");
  const [erro, setErro] = useState("");
  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, limpar?: () => void) =>
    iniciar(async () => {
      setErro("");
      const r = await fn();
      if (r.ok) limpar?.();
      else setErro(r.erro ?? "Algo deu errado.");
    });

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-700">Placas ({placas.length})</h3>
        <ul className="mb-3 flex flex-wrap gap-2">
          {placas.map((p) => (
            <li key={p} className="flex items-center gap-1 rounded-lg bg-stone-100 py-1 pl-2.5 pr-1 font-mono text-sm">
              {formatarPlaca(p)}
              <button
                type="button"
                title="Remover placa"
                disabled={pendente}
                onClick={() => executar(() => removerPlaca(motoristaId, p))}
                className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {placas.length === 0 && <li className="text-sm text-stone-500">Nenhuma placa.</li>}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => vincularPlaca(motoristaId, novaPlaca), () => setNovaPlaca(""));
          }}
        >
          <Campo value={novaPlaca} onChange={(e) => setNovaPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} />
          <Botao type="submit" variante="contorno" disabled={pendente || !novaPlaca.trim()}>
            Adicionar
          </Botao>
        </form>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-700">Transportadoras ({transportadoras.length})</h3>
        <ul className="mb-3 flex flex-wrap gap-2">
          {transportadoras.map((t) => (
            <li key={t.id} className="flex items-center gap-1 rounded-lg bg-stone-100 py-1 pl-2.5 pr-1 text-sm">
              {t.nome}
              <button
                type="button"
                title="Remover transportadora"
                disabled={pendente}
                onClick={() => executar(() => removerTransportadora(motoristaId, t.id))}
                className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {transportadoras.length === 0 && <li className="text-sm text-stone-500">Nenhuma transportadora.</li>}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => vincularTransportadora(motoristaId, novaTransp), () => setNovaTransp(""));
          }}
        >
          <Campo value={novaTransp} onChange={(e) => setNovaTransp(e.target.value)} placeholder="Nome da transportadora" />
          <Botao type="submit" variante="contorno" disabled={pendente || !novaTransp.trim()}>
            Adicionar
          </Botao>
        </form>
      </div>
      {erro && <p className="text-sm font-medium text-red-700 sm:col-span-2">{erro}</p>}
    </div>
  );
}
