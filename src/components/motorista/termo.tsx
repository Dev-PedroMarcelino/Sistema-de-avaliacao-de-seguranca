"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";
import { Botao } from "@/components/ui";
import { type Estado, ErroApi, enviar } from "./api";

const LARGURA_PNG = 600;
const ALTURA_PNG = 200;

export function Termo({ token, termo, aoAvancar }: { token: string; termo: string; aoAvancar: (e?: Estado) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);
  const [pontos, setPontos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const canvas = tela.current!;
    const ajustar = () => {
      const escala = Math.max(window.devicePixelRatio || 1, 1);
      const dados = pad.current?.toData();
      canvas.width = canvas.offsetWidth * escala;
      canvas.height = canvas.offsetHeight * escala;
      canvas.getContext("2d")!.scale(escala, escala);
      pad.current?.clear();
      if (dados) pad.current?.fromData(dados);
    };
    pad.current = new SignaturePad(canvas, { penColor: "#111827", minWidth: 1.2, maxWidth: 3, backgroundColor: "rgba(0,0,0,0)" });
    pad.current.addEventListener("endStroke", () => {
      setPontos(pad.current!.toData().reduce((n, traco) => n + traco.points.length, 0));
    });
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      pad.current?.off();
    };
  }, []);

  function limpar() {
    pad.current?.clear();
    setPontos(0);
  }

  /** Reduz para um PNG pequeno antes de enviar (o canvas em tela retina é enorme). */
  function exportar() {
    const origem = tela.current!;
    const destino = document.createElement("canvas");
    destino.width = LARGURA_PNG;
    destino.height = Math.round((LARGURA_PNG * origem.height) / origem.width) || ALTURA_PNG;
    destino.getContext("2d")!.drawImage(origem, 0, 0, destino.width, destino.height);
    return destino.toDataURL("image/png");
  }

  async function assinar() {
    setEnviando(true);
    setErro("");
    try {
      aoAvancar(await enviar<Estado>(token, "assinatura", { imagem: exportar() }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Algo deu errado.");
      setEnviando(false);
    }
  }

  const assinou = pontos >= 12;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Termo de ciência</h1>
        <p className="mt-1 text-stone-600">Leia e assine com o dedo para concluir.</p>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-stone-800 ring-1 ring-stone-200">
        {termo}
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Sua assinatura</span>
          <button type="button" onClick={limpar} className="flex items-center gap-1 text-sm font-semibold text-stone-600">
            <Eraser className="h-4 w-4" /> Limpar
          </button>
        </div>
        <div className="relative rounded-2xl border-2 border-dashed border-stone-300 bg-white">
          <canvas ref={tela} className="block h-44 w-full touch-none" />
          {pontos === 0 && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-stone-400">
              Assine aqui com o dedo
            </span>
          )}
          <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-stone-300" />
        </div>
      </div>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{erro}</p>}
      <Botao tamanho="lg" disabled={!assinou || enviando} onClick={assinar}>
        {enviando ? "Gerando comprovante…" : "Assinar e concluir"}
      </Botao>
    </div>
  );
}
