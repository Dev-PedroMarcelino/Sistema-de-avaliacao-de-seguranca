"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Volume2, X } from "lucide-react";
import { ESPERA_APOS_ERRO_MS } from "@/lib/quiz";
import { ErroApi, enviar } from "./api";

interface PerguntaPublica {
  id: string;
  texto: string;
  alternativas: { id: string; texto: string }[];
  indice: number;
  total: number;
  erros: number;
}

type Resultado = "certa" | "errada" | null;

/** Errou: borda vermelha, tremida e vibração, e continua na mesma pergunta até acertar. */
export function Quiz({ token, pergunta, aoAvancar }: { token: string; pergunta: PerguntaPublica; aoAvancar: () => void }) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado>(pergunta.erros > 0 ? "errada" : null);
  const [erradas, setErradas] = useState<Set<string>>(new Set());
  const [espera, setEspera] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tremendo, setTremendo] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function ouvir() {
    const fala = window.speechSynthesis;
    if (!fala) return;
    fala.cancel();
    const texto = [pergunta.texto, ...pergunta.alternativas.map((a, i) => `Opção ${i + 1}: ${a.texto}.`)].join(" ");
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 0.95;
    fala.speak(u);
  }

  async function responder(alternativaId: string) {
    if (enviando || espera > 0 || resultado === "certa") return;
    setEscolhida(alternativaId);
    setEnviando(true);
    setAviso("");
    try {
      const r = await enviar<{ correta: boolean; terminou: boolean }>(token, "resposta", {
        perguntaId: pergunta.id,
        alternativaId,
      });
      if (r.correta) {
        setResultado("certa");
        navigator.vibrate?.(40);
        setTimeout(aoAvancar, 900);
        return;
      }
      setResultado("errada");
      setErradas((s) => new Set(s).add(alternativaId));
      setEspera(Math.ceil(ESPERA_APOS_ERRO_MS / 1000));
      setTremendo(true);
      setTimeout(() => setTremendo(false), 500);
      navigator.vibrate?.([120, 60, 120]);
      caixa.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setAviso(e instanceof ErroApi ? e.message : "Algo deu errado.");
      if (e instanceof ErroApi && e.status === 409) setTimeout(aoAvancar, 800);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Pergunta {pergunta.indice + 1} de {pergunta.total}
        </p>
        <button
          type="button"
          onClick={ouvir}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-white"
        >
          <Volume2 className="h-4 w-4" /> Ouvir
        </button>
      </div>

      <div
        ref={caixa}
        className={clsx(
          "rounded-3xl border-4 bg-white p-5 transition-colors",
          resultado === "errada" && "border-red-600 bg-red-50",
          resultado === "certa" && "border-green-600 bg-green-50",
          resultado === null && "border-transparent ring-1 ring-stone-200",
          tremendo && "tremer",
        )}
      >
        <h1 className="text-[22px] font-extrabold leading-snug">{pergunta.texto}</h1>

        {resultado === "errada" && (
          <p className="mt-3 flex items-center gap-2 font-bold text-red-700" role="alert">
            <X className="h-5 w-5" strokeWidth={3} /> Resposta errada. Pense no vídeo e tente de novo.
          </p>
        )}
        {resultado === "certa" && (
          <p className="mt-3 flex items-center gap-2 font-bold text-green-700" role="status">
            <Check className="h-5 w-5" strokeWidth={3} /> Correto!
          </p>
        )}

        <ul className="mt-5 space-y-2.5">
          {pergunta.alternativas.map((a, i) => {
            const marcada = escolhida === a.id;
            const jaErrou = erradas.has(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={enviando || espera > 0 || resultado === "certa"}
                  onClick={() => responder(a.id)}
                  className={clsx(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[16px] font-semibold transition",
                    "disabled:cursor-not-allowed",
                    marcada && resultado === "certa" && "border-green-600 bg-green-600 text-white",
                    marcada && resultado === "errada" && "border-red-600 bg-red-100 text-red-900",
                    !marcada && jaErrou && "border-red-200 bg-white text-stone-400 line-through",
                    !marcada && !jaErrou && "border-stone-200 bg-white hover:border-tinta active:bg-stone-50",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      marcada && resultado === "certa" ? "bg-white text-green-700" : "bg-stone-100 text-stone-600",
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {a.texto}
                </button>
              </li>
            );
          })}
        </ul>

        {espera > 0 && (
          <p className="mt-4 text-center text-sm font-semibold text-red-700">Responda de novo em {espera} s…</p>
        )}
      </div>
      {aviso && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{aviso}</p>}
    </div>
  );
}
