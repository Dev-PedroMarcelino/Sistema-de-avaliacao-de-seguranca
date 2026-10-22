"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, CaptionsOff, Loader2, Play, RotateCcw } from "lucide-react";
import { Botao } from "@/components/ui";
import { SINAL_A_CADA_MS } from "@/lib/video";
import { enviar, enviarBeacon } from "./api";

interface Video {
  url: string;
  legenda: string | null;
  duracao: number;
  progresso: number;
}

type Situacao = "parado" | "tocando" | "carregando" | "fora" | "validando" | "erro";

/**
 * Player sem controles: não pausa, não adianta, não muda a velocidade.
 * Sair da tela pausa e registra a saída. Quem decide que o vídeo acabou é o servidor.
 */
export function Player({ token, video, aoConcluir }: { token: string; video: Video; aoConcluir: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const maximo = useRef(video.progresso);
  const pausaNossa = useRef(false);
  const travaTela = useRef<WakeLockSentinel | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("parado");
  const [tempo, setTempo] = useState(video.progresso);
  const [duracao, setDuracao] = useState(video.duracao);
  const [legenda, setLegenda] = useState(true);
  const [erro, setErro] = useState("");
  const comecou = video.progresso > 0;
  const tocando = situacao === "tocando" || situacao === "carregando";

  // Carrega o vídeo (HLS adaptativo pelo hls.js; Safari/iPhone toca HLS nativo).
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let hls: import("hls.js").default | null = null;
    const hlsNativo = v.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (video.url.includes(".m3u8") && !hlsNativo) {
      void import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setErro("Este navegador não consegue tocar o vídeo. Abra o link no Chrome.");
          return;
        }
        hls = new Hls({ startPosition: video.progresso, capLevelToPlayerSize: true });
        hls.loadSource(video.url);
        hls.attachMedia(v);
      });
    } else {
      v.src = video.url;
    }
    return () => hls?.destroy();
  }, [video.url, video.progresso]);

  const sinal = useCallback(
    (acao: "play" | "progresso" | "pausa" | "fim", motivo?: "tela" | "rede" | "outro") =>
      enviar<{ progresso: number; concluido: boolean }>(token, "video", {
        acao,
        posicao: ref.current?.currentTime ?? 0,
        motivo,
      }),
    [token],
  );

  async function manterTelaLigada() {
    try {
      travaTela.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* sem suporte: segue */
    }
  }

  function tocar() {
    const v = ref.current;
    if (!v) return;
    setErro("");
    if (Math.abs(v.currentTime - maximo.current) > 1) v.currentTime = maximo.current;
    v.playbackRate = 1;
    // play() primeiro, ainda dentro do toque do usuário (exigência dos navegadores para vídeo com som).
    const reproducao = v.play();
    // Tela cheia do contêiner (Android). No iPhone fica a tela cheia por CSS, sem os controles nativos.
    if (!document.fullscreenElement && caixa.current?.requestFullscreen) {
      caixa.current
        .requestFullscreen()
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
        .catch(() => {});
    }
    void manterTelaLigada();
    reproducao
      .then(() => {
        setSituacao("tocando");
        sinal("play").catch(() => {});
      })
      .catch(() => setErro("Toque de novo para tocar o vídeo."));
  }

  // Sinal a cada 10 s enquanto toca.
  useEffect(() => {
    if (situacao !== "tocando") return;
    const id = setInterval(() => sinal("progresso").catch(() => {}), SINAL_A_CADA_MS);
    return () => clearInterval(id);
  }, [situacao, sinal]);

  // Sair da tela (trocar de app, bloquear o celular) pausa e registra.
  useEffect(() => {
    const aoMudar = () => {
      const v = ref.current;
      if (!v) return;
      if (document.visibilityState === "hidden" && !v.paused && !v.ended) {
        pausaNossa.current = true;
        v.pause();
        enviarBeacon(token, "video", { acao: "pausa", posicao: v.currentTime, motivo: "tela" });
        setSituacao("fora");
      }
      if (document.visibilityState === "visible" && travaTela.current?.released) void manterTelaLigada();
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, [token]);

  useEffect(() => () => void travaTela.current?.release().catch(() => {}), []);

  async function terminar() {
    setSituacao("validando");
    for (let tentativa = 0; tentativa < 15; tentativa++) {
      try {
        const r = await sinal("fim");
        if (r.concluido) {
          await travaTela.current?.release().catch(() => {});
          if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
          aoConcluir();
          return;
        }
        // O servidor ainda não validou o fim (rede ou relógio): espera e tenta de novo.
        maximo.current = Math.max(maximo.current, r.progresso);
      } catch {
        /* sem rede: tenta de novo */
      }
      await new Promise((ok) => setTimeout(ok, 2000));
    }
    setSituacao("erro");
    setErro("Não conseguimos confirmar o fim do vídeo. Verifique a internet e toque para tentar de novo.");
  }

  const eventos = {
    onTimeUpdate: () => {
      const v = ref.current!;
      // Qualquer tentativa de adiantar volta para o ponto já assistido.
      if (v.currentTime > maximo.current + 1.5) v.currentTime = maximo.current;
      else maximo.current = Math.max(maximo.current, v.currentTime);
      setTempo(v.currentTime);
    },
    onSeeking: () => {
      const v = ref.current!;
      if (v.currentTime > maximo.current + 1) v.currentTime = maximo.current;
    },
    onRateChange: () => {
      if (ref.current && ref.current.playbackRate !== 1) ref.current.playbackRate = 1;
    },
    onLoadedMetadata: () => {
      const v = ref.current!;
      if (Number.isFinite(v.duration)) setDuracao(v.duration);
      if (video.progresso > 0 && v.currentTime < video.progresso - 1) v.currentTime = video.progresso;
    },
    onWaiting: () => setSituacao((s) => (s === "tocando" ? "carregando" : s)),
    onPlaying: () => setSituacao((s) => (s === "carregando" || s === "tocando" ? "tocando" : s)),
    onPause: () => {
      const v = ref.current!;
      if (v.ended) return;
      if (pausaNossa.current) {
        pausaNossa.current = false;
        return;
      }
      // Pausa por fora do nosso controle (fone, controle do sistema): registra e pede para continuar.
      setSituacao((s) => (s === "tocando" || s === "carregando" ? "parado" : s));
      sinal("pausa", "outro").catch(() => {});
    },
    onEnded: () => void terminar(),
    onError: () => setErro("Falha ao carregar o vídeo. Verifique a internet e toque para tentar de novo."),
  };

  const restante = Math.max(0, duracao - tempo);
  const pct = duracao > 0 ? Math.min(100, (tempo / duracao) * 100) : 0;

  return (
    <div className="space-y-4">
      {!tocando && situacao !== "validando" && (
        <div>
          <h1 className="text-2xl font-extrabold">Vídeo de segurança</h1>
          <p className="mt-1 text-stone-600">
            Assista até o fim. As perguntas são liberadas quando o vídeo terminar.
          </p>
        </div>
      )}

      <div
        ref={caixa}
        className={
          tocando || situacao === "validando"
            ? "fixed inset-0 z-50 flex flex-col justify-center bg-black"
            : "relative overflow-hidden rounded-2xl bg-black"
        }
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={ref}
          className={tocando || situacao === "validando" ? "max-h-full w-full" : "aspect-video w-full"}
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          {...{ "x-webkit-airplay": "deny" }}
          controls={false}
          controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
          // Legenda em outro domínio (Storage) só carrega com CORS.
          crossOrigin={video.legenda?.startsWith("http") ? "anonymous" : undefined}
          {...eventos}
        >
          {video.legenda && <track kind="subtitles" src={video.legenda} srcLang="pt" label="Português" default={legenda} />}
        </video>

        {situacao === "carregando" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-white/80" />
          </div>
        )}
        {situacao === "validando" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="font-semibold">Confirmando que você assistiu…</p>
          </div>
        )}

        {(tocando || situacao === "validando") && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25" aria-hidden>
              <div className="h-full bg-marca transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-white/90">
              <span>Faltam {formatarTempo(restante)}</span>
              {video.legenda && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-white/10"
                  onClick={() => {
                    setLegenda((l) => !l);
                    const faixa = ref.current?.textTracks[0];
                    if (faixa) faixa.mode = legenda ? "hidden" : "showing";
                  }}
                >
                  {legenda ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
                  Legenda
                </button>
              )}
            </div>
          </div>
        )}

        {!tocando && situacao !== "validando" && (
          <button
            type="button"
            onClick={tocar}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-marca text-tinta shadow-xl">
              {situacao === "erro" ? <RotateCcw className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
            </span>
            <span className="px-6 text-center text-lg font-bold">
              {situacao === "fora"
                ? "Você saiu da tela. Toque para continuar."
                : comecou || tempo > 0
                  ? "Toque para continuar o vídeo"
                  : "Toque para começar o vídeo"}
            </span>
          </button>
        )}
      </div>

      {!tocando && situacao !== "validando" && (
        <>
          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{erro}</p>}
          {(comecou || tempo > 0) && (
            <p className="text-sm text-stone-600">
              Você já assistiu {formatarTempo(maximo.current)} de {formatarTempo(duracao)}. O vídeo continua de onde
              parou.
            </p>
          )}
          <Botao tamanho="lg" onClick={tocar}>
            <Play className="h-5 w-5 fill-current" /> {comecou || tempo > 0 ? "Continuar vídeo" : "Assistir vídeo"}
          </Botao>
        </>
      )}
    </div>
  );
}

function formatarTempo(seg: number) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
