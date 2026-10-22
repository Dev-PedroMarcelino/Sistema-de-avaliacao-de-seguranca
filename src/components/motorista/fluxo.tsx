"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Botao } from "@/components/ui";
import { type Estado, ErroApi, buscarEstado } from "./api";
import { BoasVindas } from "./boas-vindas";
import { Identificacao } from "./identificacao";
import { Player } from "./player";
import { Quiz } from "./quiz";
import { Termo } from "./termo";
import { Concluido, LinkExpirado } from "./concluido";

const PASSOS = [
  { etapa: "boas_vindas", nome: "Início" },
  { etapa: "identificacao", nome: "Dados" },
  { etapa: "video", nome: "Vídeo" },
  { etapa: "quiz", nome: "Perguntas" },
  { etapa: "termo", nome: "Termo" },
] as const;

export function Fluxo({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setEstado(await buscarEstado(token));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi(0, "Algo deu errado."));
    }
  }, [token]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (estado) document.documentElement.style.setProperty("--marca", estado.empresa.cor);
  }, [estado]);

  if (erro && !estado) {
    return (
      <Moldura>
        <div className="surgir flex flex-col items-center gap-4 py-16 text-center">
          <WifiOff className="h-12 w-12 text-stone-400" />
          <p className="text-lg font-semibold">{erro.message}</p>
          {erro.status !== 404 && (
            <Botao onClick={recarregar} variante="contorno">
              Tentar de novo
            </Botao>
          )}
        </div>
      </Moldura>
    );
  }
  if (!estado) {
    return (
      <Moldura>
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-stone-400" aria-label="Carregando" />
        </div>
      </Moldura>
    );
  }

  const indice = PASSOS.findIndex((p) => p.etapa === estado.etapa);
  const atualizar = (novo?: Estado) => (novo ? setEstado(novo) : recarregar());

  return (
    <Moldura empresa={estado.empresa.nome} unidade={estado.unidade}>
      {indice >= 0 && (
        <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Etapas">
          {PASSOS.map((p, i) => (
            <li key={p.etapa} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${i <= indice ? "bg-marca" : "bg-stone-200"}`} />
              <span className={`text-[11px] font-medium ${i === indice ? "text-tinta" : "text-stone-400"}`}>{p.nome}</span>
            </li>
          ))}
        </ol>
      )}
      {erro && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro.message}</p>}
      <div key={estado.etapa} className="surgir">
        {estado.etapa === "boas_vindas" && "duracaoVideo" in estado && (
          <BoasVindas token={token} estado={estado} aoAvancar={atualizar} />
        )}
        {estado.etapa === "identificacao" && "preenchido" in estado && (
          <Identificacao token={token} estado={estado} aoAvancar={atualizar} />
        )}
        {estado.etapa === "video" && "video" in estado && (
          <Player token={token} video={estado.video} aoConcluir={() => recarregar()} />
        )}
        {estado.etapa === "quiz" && "pergunta" in estado && (
          <Quiz key={estado.pergunta.id} token={token} pergunta={estado.pergunta} aoAvancar={() => recarregar()} />
        )}
        {estado.etapa === "termo" && "termo" in estado && (
          <Termo token={token} termo={estado.termo} aoAvancar={atualizar} />
        )}
        {(estado.etapa === "concluida" || estado.etapa === "ja_valida") && "comprovante" in estado && (
          <Concluido token={token} jaValida={estado.etapa === "ja_valida"} comprovante={estado.comprovante} />
        )}
        {estado.etapa === "expirado" && <LinkExpirado empresa={estado.empresa.nome} />}
      </div>
    </Moldura>
  );
}

function Moldura({ children, empresa, unidade }: { children: React.ReactNode; empresa?: string; unidade?: string }) {
  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="faixa-seguranca h-2" />
      <header className="bg-tinta text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">{empresa ?? "Integração de segurança"}</p>
            {unidade && <p className="truncate text-xs text-stone-400">{unidade}</p>}
          </div>
          <span className="rounded-md bg-marca px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-tinta">
            Segurança
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}
