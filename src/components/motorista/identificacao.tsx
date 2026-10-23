"use client";

import { useState } from "react";
import { Botao, Campo, Rotulo } from "@/components/ui";
import { telefone as formatarTelefone } from "@/lib/formato";
import { cpfValido, nomeValido, normalizarPlaca } from "@/lib/validacao";
import { type Estado, ErroApi, enviar } from "./api";

type EstadoIdentificacao = Extract<Estado, { preenchido: unknown }>;

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function Identificacao({
  token,
  estado,
  aoAvancar,
}: {
  token: string;
  estado: EstadoIdentificacao;
  aoAvancar: (e?: Estado) => void;
}) {
  const [nome, setNome] = useState(estado.preenchido.nome);
  const [cpf, setCpf] = useState("");
  const [placa, setPlaca] = useState("");
  const [transportadora, setTransportadora] = useState(estado.preenchido.transportadora);
  const [aceite, setAceite] = useState(false);
  const [verAviso, setVerAviso] = useState(false);
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const erros = {
    nome: nomeValido(nome) ? "" : "Informe nome e sobrenome.",
    cpf: cpfValido(cpf) ? "" : "CPF inválido.",
    // Opcionais: só valida a placa se ela for preenchida.
    placa: !placa.trim() || normalizarPlaca(placa) ? "" : "Placa inválida (ex.: ABC1D23).",
    transportadora: "",
  };
  const valido = Object.values(erros).every((e) => !e) && aceite;
  const mostrar = (campo: keyof typeof erros) => (tocado[campo] ? erros[campo] : "");
  const tocar = (campo: string) => () => setTocado((t) => ({ ...t, [campo]: true }));

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ nome: true, cpf: true, placa: true, transportadora: true });
    if (!valido) return;
    setEnviando(true);
    setErro("");
    try {
      aoAvancar(
        await enviar<Estado>(token, "identificacao", { nome, cpf, placa, transportadora, aceitePrivacidade: aceite }),
      );
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Algo deu errado.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={continuar} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold">Seus dados</h1>
        <p className="mt-1 text-stone-600">Eles vão no seu comprovante de integração.</p>
      </div>

      <div>
        <Rotulo htmlFor="nome">Nome completo</Rotulo>
        <Campo id="nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={tocar("nome")} />
        <Erro texto={mostrar("nome")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Rotulo htmlFor="cpf">CPF</Rotulo>
          <Campo
            id="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(mascaraCpf(e.target.value))}
            onBlur={tocar("cpf")}
          />
          <Erro texto={mostrar("cpf")} />
        </div>
        <div>
          <Rotulo htmlFor="placa">Placa (opcional)</Rotulo>
          <Campo
            id="placa"
            autoCapitalize="characters"
            placeholder="ABC1D23"
            maxLength={8}
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            onBlur={tocar("placa")}
          />
          <Erro texto={mostrar("placa")} />
        </div>
      </div>
      <div>
        <Rotulo htmlFor="transportadora">Transportadora (opcional)</Rotulo>
        <Campo
          id="transportadora"
          list="lista-transportadoras"
          value={transportadora}
          onChange={(e) => setTransportadora(e.target.value)}
          onBlur={tocar("transportadora")}
        />
        <datalist id="lista-transportadoras">
          {estado.transportadoras.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Erro texto={mostrar("transportadora")} />
      </div>
      <div className="rounded-xl bg-stone-200/60 px-3.5 py-2.5 text-sm text-stone-600">
        WhatsApp: <strong className="text-tinta">{formatarTelefone(estado.preenchido.telefone)}</strong>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-tinta"
          />
          <span className="text-sm leading-snug">
            Li e aceito o{" "}
            <button type="button" className="font-semibold underline" onClick={() => setVerAviso((v) => !v)}>
              aviso de privacidade
            </button>
            .
          </span>
        </label>
        {verAviso && (
          <p className="mt-3 border-t border-stone-100 pt-3 text-[13px] leading-relaxed text-stone-600">
            A {estado.empresa.nome} usa seu nome, CPF, telefone, placa, transportadora, respostas e assinatura apenas
            para comprovar que você recebeu a integração de segurança e para controlar o acesso à área. Também
            registramos data, hora, endereço IP e o aparelho usado. Os dados ficam guardados pelo prazo exigido para
            essa comprovação e não são vendidos nem usados para propaganda (Lei 13.709/2018, LGPD). Para pedir acesso
            ou correção, procure a portaria ou a área de segurança.
          </p>
        )}
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{erro}</p>}
      <Botao tamanho="lg" type="submit" disabled={enviando || !aceite}>
        {enviando ? "Salvando…" : "Continuar para o vídeo"}
      </Botao>
    </form>
  );
}

function Erro({ texto }: { texto: string }) {
  return texto ? <p className="mt-1 text-[13px] font-medium text-red-700">{texto}</p> : null;
}
