"use client";

import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { CircleCheck, Plus, Timer, Trash2, Upload } from "lucide-react";
import { AreaTexto, Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import type { ConteudoVersao } from "@/lib/integracao/conteudo";
import type { Pergunta } from "@/lib/quiz";
import { validarPerguntas } from "@/lib/quiz";
import { duracao } from "@/lib/formato";
import { salvarConteudo } from "../acoes";

const novaId = () => Math.random().toString(36).slice(2, 10);
const LETRAS = "ABCDEF";

export function EditorConteudo({ numero, inicial }: { numero: number; inicial: ConteudoVersao }) {
  const [c, setC] = useState<ConteudoVersao>(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [invalidar, setInvalidar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [detectando, setDetectando] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const atualizar = (parcial: Partial<ConteudoVersao>) => setC((x) => ({ ...x, ...parcial }));
  const mudarPergunta = (i: number, p: Partial<Pergunta>) =>
    atualizar({ perguntas: c.perguntas.map((q, k) => (k === i ? { ...q, ...p } : q)) });

  function detectarDuracao() {
    const v = video.current;
    if (!v || !c.video_url) return;
    setDetectando(true);
    const pronto = async () => {
      let d = v.duration;
      if (!Number.isFinite(d) && c.video_url.includes(".m3u8")) d = await duracaoHls(c.video_url);
      setDetectando(false);
      if (Number.isFinite(d) && d > 0) atualizar({ duracao_seg: Math.round(d * 10) / 10 });
      else setAviso({ tipo: "erro", texto: "Não consegui ler a duração. Informe manualmente." });
    };
    if (c.video_url.includes(".m3u8") && !v.canPlayType("application/vnd.apple.mpegurl")) {
      void duracaoHls(c.video_url).then((d) => {
        setDetectando(false);
        if (d > 0) atualizar({ duracao_seg: Math.round(d * 10) / 10 });
        else setAviso({ tipo: "erro", texto: "Não consegui ler a duração. Informe manualmente." });
      });
      return;
    }
    v.onloadedmetadata = () => void pronto();
    v.onerror = () => {
      setDetectando(false);
      setAviso({ tipo: "erro", texto: "Não consegui abrir o vídeo nesse link." });
    };
    v.src = c.video_url;
  }

  function salvar(publicar: boolean) {
    setAviso(null);
    if (publicar) {
      const erro = validarPerguntas(c.perguntas);
      if (erro) return setAviso({ tipo: "erro", texto: erro });
      const mensagem = invalidar
        ? "Publicar e INVALIDAR as integrações anteriores? Todos os motoristas vão precisar refazer."
        : "Publicar esta versão? A partir de agora, novos motoristas verão este conteúdo.";
      if (!window.confirm(mensagem)) return;
    }
    iniciar(async () => {
      const r = await salvarConteudo(c, publicar ? { invalidaAnteriores: invalidar } : null);
      if (!r.ok) setAviso({ tipo: "erro", texto: r.erro });
      else setAviso({ tipo: "ok", texto: publicar ? `Versão ${numero} publicada.` : "Rascunho salvo." });
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-3 ring-1 ring-amber-200">
        <p className="text-sm font-semibold text-amber-900">Rascunho da versão {numero}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="contorno" tamanho="sm" disabled={pendente} onClick={() => salvar(false)}>
            Salvar rascunho
          </Botao>
          <Botao tamanho="sm" disabled={pendente} onClick={() => salvar(true)}>
            <Upload className="h-4 w-4" /> Publicar
          </Botao>
        </div>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <h2 className="font-bold">Vídeo</h2>
          <div>
            <Rotulo htmlFor="video">Link do vídeo (MP4 ou HLS .m3u8)</Rotulo>
            <Campo
              id="video"
              value={c.video_url}
              onChange={(e) => atualizar({ video_url: e.target.value })}
              placeholder="https://…/integracao/master.m3u8"
            />
            <p className="mt-1 text-xs text-stone-500">
              Converta com <code className="rounded bg-stone-100 px-1">npm run video:preparar -- video.mp4</code>, suba a pasta no
              Storage do Supabase e cole o link do master.m3u8.
            </p>
          </div>
          <div>
            <Rotulo htmlFor="legenda">Legenda .vtt (opcional, recomendada)</Rotulo>
            <Campo id="legenda" value={c.legenda_url ?? ""} onChange={(e) => atualizar({ legenda_url: e.target.value || null })} />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-40">
              <Rotulo htmlFor="duracao">Duração (segundos)</Rotulo>
              <Campo
                id="duracao"
                type="number"
                min={0}
                step={0.1}
                value={c.duracao_seg || ""}
                onChange={(e) => atualizar({ duracao_seg: Number(e.target.value) })}
              />
            </div>
            <Botao variante="contorno" onClick={detectarDuracao} disabled={!c.video_url || detectando}>
              <Timer className="h-4 w-4" /> {detectando ? "Lendo…" : "Detectar"}
            </Botao>
            {c.duracao_seg > 0 && <span className="pb-3 text-sm text-stone-500">{duracao(c.duracao_seg)}</span>}
          </div>
        </div>
        <video ref={video} className="hidden" preload="metadata" muted />
        <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
          <p className="font-semibold text-tinta">Dicas para o vídeo</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>4 a 5 minutos prendem a atenção.</li>
            <li>Narração clara e legenda: a mina é barulhenta.</li>
            <li>Mostre o lugar real: rotas, pontos de parada e sinaleiros.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Perguntas ({c.perguntas.length})</h2>
            <p className="text-sm text-stone-500">Marque a alternativa certa. A ordem das alternativas é embaralhada para cada motorista.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-tinta"
              checked={c.perguntas_por_integracao != null}
              onChange={(e) => atualizar({ perguntas_por_integracao: e.target.checked ? Math.min(3, c.perguntas.length) || 1 : null })}
            />
            Sortear
            <input
              type="number"
              min={1}
              max={c.perguntas.length}
              disabled={c.perguntas_por_integracao == null}
              value={c.perguntas_por_integracao ?? ""}
              onChange={(e) => atualizar({ perguntas_por_integracao: Number(e.target.value) || 1 })}
              className="w-14 rounded-lg border-2 border-stone-200 px-2 py-1 disabled:opacity-40"
            />
            por motorista (evita “cola” no grupo)
          </label>
        </div>

        <ol className="space-y-4">
          {c.perguntas.map((p, i) => (
            <li key={p.id} className="rounded-2xl border-2 border-stone-200 p-4">
              <div className="flex gap-3">
                <span className="mt-2.5 text-sm font-bold text-stone-400">{i + 1}.</span>
                <div className="flex-1 space-y-3">
                  <Campo
                    value={p.texto}
                    onChange={(e) => mudarPergunta(i, { texto: e.target.value })}
                    placeholder="Texto da pergunta"
                    className="font-semibold"
                  />
                  <ul className="space-y-2">
                    {p.alternativas.map((a, k) => (
                      <li key={a.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Marcar como certa"
                          onClick={() => mudarPergunta(i, { correta: a.id })}
                          className={clsx(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            p.correta === a.id ? "bg-green-600 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200",
                          )}
                        >
                          {p.correta === a.id ? <CircleCheck className="h-5 w-5" /> : LETRAS[k]}
                        </button>
                        <Campo
                          value={a.texto}
                          onChange={(e) =>
                            mudarPergunta(i, {
                              alternativas: p.alternativas.map((x) => (x.id === a.id ? { ...x, texto: e.target.value } : x)),
                            })
                          }
                          placeholder={`Alternativa ${LETRAS[k]}`}
                          className="py-2"
                        />
                        {p.alternativas.length > 2 && (
                          <button
                            type="button"
                            className="p-2 text-stone-400 hover:text-red-600"
                            title="Remover alternativa"
                            onClick={() =>
                              mudarPergunta(i, {
                                alternativas: p.alternativas.filter((x) => x.id !== a.id),
                                correta: p.correta === a.id ? "" : p.correta,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between">
                    {p.alternativas.length < 6 ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-stone-600 hover:text-tinta"
                        onClick={() => mudarPergunta(i, { alternativas: [...p.alternativas, { id: novaId(), texto: "" }] })}
                      >
                        + Alternativa
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-700 hover:underline"
                      onClick={() => atualizar({ perguntas: c.perguntas.filter((_, k) => k !== i) })}
                    >
                      Remover pergunta
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Botao
          variante="contorno"
          className="mt-4"
          onClick={() =>
            atualizar({
              perguntas: [
                ...c.perguntas,
                { id: novaId(), texto: "", correta: "", alternativas: Array.from({ length: 4 }, () => ({ id: novaId(), texto: "" })) },
              ],
            })
          }
        >
          <Plus className="h-4 w-4" /> Adicionar pergunta
        </Botao>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="font-bold">Termo de ciência</h2>
        <p className="mb-3 text-sm text-stone-500">
          Campos trocados automaticamente: <code>{"{nome}"}</code> <code>{"{cpf}"}</code> <code>{"{placa}"}</code>{" "}
          <code>{"{transportadora}"}</code> <code>{"{empresa}"}</code>. Valide o texto com o jurídico.
        </p>
        <AreaTexto value={c.termo} onChange={(e) => atualizar({ termo: e.target.value })} rows={6} />
      </section>

      <label className="flex items-start gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-red-600" checked={invalidar} onChange={(e) => setInvalidar(e.target.checked)} />
        <span className="text-sm">
          <span className="font-semibold">Ao publicar, invalidar as integrações anteriores</span>
          <span className="block text-stone-500">
            Use quando a regra mudou de verdade (nova rota, novo procedimento). Todos os motoristas precisarão refazer.
          </span>
        </span>
      </label>
    </div>
  );
}

/** Soma a duração dos segmentos de uma playlist HLS (segue o master até a primeira variante). */
async function duracaoHls(url: string): Promise<number> {
  try {
    let texto = await (await fetch(url)).text();
    let base = url;
    if (texto.includes("#EXT-X-STREAM-INF")) {
      const variante = texto.split("\n").find((l) => l.trim() && !l.startsWith("#"));
      if (!variante) return 0;
      base = new URL(variante.trim(), new URL(url, window.location.href)).toString();
      texto = await (await fetch(base)).text();
    }
    return [...texto.matchAll(/#EXTINF:([\d.]+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  } catch {
    return 0;
  }
}
