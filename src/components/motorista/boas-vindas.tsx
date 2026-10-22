"use client";

import { useState } from "react";
import { Clock, ListChecks, PenLine, ShieldAlert, Smartphone, Volume2 } from "lucide-react";
import { Botao } from "@/components/ui";
import { type Estado, ErroApi, enviar } from "./api";

type EstadoBoasVindas = Extract<Estado, { duracaoVideo: number }>;

export function BoasVindas({
  token,
  estado,
  aoAvancar,
}: {
  token: string;
  estado: EstadoBoasVindas;
  aoAvancar: (e?: Estado) => void;
}) {
  const [parado, setParado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const minutos = Math.max(1, Math.round(estado.duracaoVideo / 60));

  async function comecar() {
    setEnviando(true);
    setErro("");
    try {
      aoAvancar(await enviar<Estado>(token, "inicio", { veiculoParado: true }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Algo deu errado.");
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight">Integração de segurança</h1>
        <p className="mt-1.5 text-stone-600">{estado.treinamento}. É obrigatória para entrar na área.</p>
      </div>

      <ul className="grid grid-cols-3 gap-2 text-center">
        <Item icone={<Clock className="h-5 w-5" />} titulo={`${minutos} min`} texto="de vídeo" />
        <Item icone={<ListChecks className="h-5 w-5" />} titulo={`${estado.totalPerguntas}`} texto="perguntas" />
        <Item icone={<PenLine className="h-5 w-5" />} titulo="1" texto="assinatura" />
      </ul>

      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <Dica icone={<Volume2 className="h-5 w-5" />}>Aumente o volume ou use fone de ouvido.</Dica>
        <Dica icone={<Smartphone className="h-5 w-5" />}>
          Fique nesta tela até o fim. Se sair, o vídeo pausa e espera você voltar.
        </Dica>
        <Dica icone={<ShieldAlert className="h-5 w-5" />}>O vídeo não pode ser adiantado.</Dica>
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${
          parado ? "border-green-600 bg-green-50" : "border-marca bg-amber-50"
        }`}
      >
        <input
          type="checkbox"
          checked={parado}
          onChange={(e) => setParado(e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 accent-green-700"
        />
        <span className="text-[15px] font-semibold leading-snug">
          Confirmo que estou com o veículo parado, em local seguro. Não vou fazer a integração dirigindo.
        </span>
      </label>

      {erro && <p className="text-sm font-medium text-red-700">{erro}</p>}
      <Botao tamanho="lg" disabled={!parado || enviando} onClick={comecar}>
        {enviando ? "Abrindo…" : "Começar"}
      </Botao>
    </div>
  );
}

function Item({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <li className="rounded-2xl bg-white px-2 py-3 ring-1 ring-stone-200">
      <span className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-marca/20 text-tinta">{icone}</span>
      <p className="text-lg font-extrabold leading-none">{titulo}</p>
      <p className="text-xs text-stone-500">{texto}</p>
    </li>
  );
}

function Dica({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-[15px] text-stone-700">
      <span className="mt-0.5 text-stone-500">{icone}</span>
      <span>{children}</span>
    </p>
  );
}
