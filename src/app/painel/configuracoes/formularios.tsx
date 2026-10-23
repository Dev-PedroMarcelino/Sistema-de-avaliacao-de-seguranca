"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AreaTexto, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { telefone } from "@/lib/formato";
import {
  conectarWhatsApp,
  criarUnidade,
  criarUsuario,
  desconectarWhatsApp,
  salvarAlertas,
  salvarEmpresa,
  statusWhatsApp,
  testarAlerta,
} from "../acoes";

type Estado = { ok: true } | { ok: false; erro: string } | null;

function Retorno({ estado, ok }: { estado: Estado; ok: string }) {
  if (!estado) return null;
  return estado.ok ? <Aviso tipo="ok">{ok}</Aviso> : <Aviso>{estado.erro}</Aviso>;
}

function useLimparAoSalvar(estado: Estado) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);
  return ref;
}

export function FormEmpresa({
  empresa,
}: {
  empresa: { nome: string; cor: string; mensagem_whatsapp: string; validade_link_dias: number };
}) {
  const [estado, acao, enviando] = useActionState(salvarEmpresa, null);
  return (
    <form action={acao} className="space-y-4">
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <div>
          <Rotulo htmlFor="nome">Nome</Rotulo>
          <Campo id="nome" name="nome" defaultValue={empresa.nome} />
        </div>
        <div>
          <Rotulo htmlFor="cor">Cor</Rotulo>
          <Campo id="cor" name="cor" type="color" defaultValue={empresa.cor} className="h-[46px] p-1" />
        </div>
      </div>
      <div>
        <Rotulo htmlFor="mensagem">Mensagem enviada com o link</Rotulo>
        <AreaTexto id="mensagem" name="mensagem" rows={5} defaultValue={empresa.mensagem_whatsapp} />
        <p className="mt-1 text-xs text-stone-500">
          Use <code>{"{nome}"}</code> (primeiro nome), <code>{"{empresa}"}</code> e <code>{"{link}"}</code>.
        </p>
      </div>
      <div className="w-48">
        <Rotulo htmlFor="validade_link_dias">Link vale por (dias)</Rotulo>
        <Campo id="validade_link_dias" name="validade_link_dias" type="number" min={1} max={90} defaultValue={empresa.validade_link_dias} />
      </div>
      <Retorno estado={estado} ok="Salvo." />
      <Botao type="submit" disabled={enviando}>
        Salvar
      </Botao>
    </form>
  );
}

export function FormAlertas({
  numeros,
  antecedencia,
  avisarMotorista,
}: {
  numeros: string | null;
  antecedencia: number;
  avisarMotorista: boolean;
}) {
  const [estado, acao, enviando] = useActionState(salvarAlertas, null);
  const [teste, setTeste] = useState<Estado>(null);
  const [testando, iniciar] = useTransition();
  const atuais = (numeros ?? "").split(",").filter(Boolean).map(telefone).join(", ");
  return (
    <form action={acao} className="space-y-3">
      <div>
        <Rotulo htmlFor="whatsapp_alertas">WhatsApp que recebe o aviso (portaria ou segurança)</Rotulo>
        <Campo
          id="whatsapp_alertas"
          name="whatsapp_alertas"
          defaultValue={atuais}
          placeholder="(19) 99999-1234 — separe por vírgula para mais de um"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
        <div>
          <Rotulo htmlFor="aviso_antecedencia_dias">Avisar quantos dias antes</Rotulo>
          <Campo id="aviso_antecedencia_dias" name="aviso_antecedencia_dias" type="number" min={0} max={90} defaultValue={antecedencia} />
        </div>
        <label className="flex items-start gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="avisar_motorista" defaultChecked={avisarMotorista} className="mt-0.5 h-4 w-4 accent-tinta" />
          <span>No aviso prévio, mandar também ao motorista um link para refazer a integração antes de vencer</span>
        </label>
      </div>
      <p className="text-xs text-stone-500">0 desliga o aviso prévio. O aviso do dia do vencimento continua sempre ligado.</p>
      <Retorno estado={estado} ok="Números salvos." />
      {teste && (teste.ok ? <Aviso tipo="ok">Mensagem de teste enviada.</Aviso> : <Aviso>{teste.erro}</Aviso>)}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" disabled={enviando}>
          Salvar
        </Botao>
        <Botao
          type="button"
          variante="contorno"
          disabled={testando}
          onClick={() => iniciar(async () => setTeste(await testarAlerta()))}
        >
          {testando ? "Enviando…" : "Enviar mensagem de teste"}
        </Botao>
      </div>
    </form>
  );
}

type Estado2 = Awaited<ReturnType<typeof statusWhatsApp>>;
type EstadoWa = Extract<Estado2, { ok: true }>["estado"];

/** Conecta o WhatsApp do sistema lendo um QR Code, como no WhatsApp Web. */
export function ConexaoWhatsApp({ podeCriar }: { podeCriar: boolean }) {
  const [estado, setEstado] = useState<EstadoWa>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      const r = await statusWhatsApp();
      if (!ativo) return;
      setCarregando(false);
      if (r.ok) setEstado((atual) => (r.estado?.status === "connected" || !atual?.qrcode ? r.estado : { ...atual, ...r.estado, qrcode: atual.qrcode }));
      else setErro(r.erro);
    };
    void atualizar();
    // Enquanto o QR está na tela, confere a cada 3 s se o celular já leu.
    const id = setInterval(atualizar, estado?.qrcode ? 3000 : 30000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [estado?.qrcode]);

  const conectar = () =>
    iniciar(async () => {
      setErro("");
      const r = await conectarWhatsApp();
      if (r.ok) setEstado(r.estado);
      else setErro(r.erro);
    });
  const desconectar = () =>
    iniciar(async () => {
      if (!window.confirm("Desconectar o WhatsApp do sistema? Os avisos automáticos param até conectar de novo.")) return;
      const r = await desconectarWhatsApp();
      if (r.ok) setEstado((e) => (e ? { ...e, status: "disconnected", qrcode: null } : e));
      else setErro(r.erro);
    });

  const conectado = estado?.status === "connected";
  return (
    <div className="space-y-3">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ${
          conectado ? "bg-green-50 ring-green-200" : "bg-stone-50 ring-stone-200"
        }`}
      >
        <p className="text-sm">
          {carregando ? (
            "Verificando…"
          ) : conectado ? (
            <>
              <strong className="text-green-800">Conectado</strong>
              {estado?.numero ? ` · ${telefone(estado.numero)}` : ""}
              {estado?.nomePerfil ? ` · ${estado.nomePerfil}` : ""}
            </>
          ) : estado?.qrcode ? (
            <strong>Aguardando a leitura do QR Code…</strong>
          ) : (
            <strong className="text-stone-700">Não conectado</strong>
          )}
        </p>
        {conectado ? (
          <Botao variante="contorno" tamanho="sm" disabled={pendente} onClick={desconectar}>
            Desconectar
          </Botao>
        ) : (
          <Botao tamanho="sm" disabled={pendente || (!podeCriar && !estado)} onClick={conectar}>
            {pendente ? "Gerando QR…" : estado?.qrcode ? "Gerar novo QR" : "Conectar WhatsApp"}
          </Botao>
        )}
      </div>
      {!conectado && estado?.qrcode && (
        <div className="flex flex-wrap items-center gap-5 rounded-xl bg-white p-4 ring-1 ring-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={estado.qrcode} alt="QR Code para conectar o WhatsApp" className="h-56 w-56" />
          <ol className="max-w-xs list-decimal space-y-1 pl-5 text-sm text-stone-700">
            <li>No celular que vai enviar os avisos, abra o WhatsApp.</li>
            <li>
              Toque em <strong>Mais opções</strong> (ou Configurações) → <strong>Dispositivos conectados</strong>.
            </li>
            <li>
              Toque em <strong>Conectar um dispositivo</strong> e aponte a câmera para este código.
            </li>
            <li>O QR expira em cerca de 1 minuto; se vencer, gere outro.</li>
          </ol>
        </div>
      )}
      {!podeCriar && !estado && (
        <p className="text-xs text-amber-800">Falta configurar UAZAPI_URL e UAZAPI_ADMIN_TOKEN no servidor.</p>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </div>
  );
}

export function FormUnidade() {
  const [estado, acao, enviando] = useActionState(criarUnidade, null);
  const ref = useLimparAoSalvar(estado);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <div className="flex gap-2">
        <Campo name="nome" placeholder="Nome da nova unidade" />
        <Botao type="submit" variante="contorno" disabled={enviando}>
          Adicionar
        </Botao>
      </div>
      <Retorno estado={estado} ok="Unidade criada. O QR Code dela já está na tela da portaria." />
    </form>
  );
}

export function FormUsuario() {
  const [estado, acao, enviando] = useActionState(criarUsuario, null);
  const ref = useLimparAoSalvar(estado);
  return (
    <form ref={ref} action={acao} className="space-y-3 rounded-xl bg-stone-50 p-4">
      <p className="text-sm font-semibold">Dar acesso a alguém</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo name="nome" placeholder="Nome" />
        <Campo name="email" type="email" placeholder="E-mail" />
        <Campo name="senha" type="password" placeholder="Senha inicial (10+ caracteres)" autoComplete="new-password" />
        <Selecao name="perfil" defaultValue="portaria">
          <option value="portaria">Portaria</option>
          <option value="seguranca">Segurança</option>
          <option value="admin">Administrador</option>
        </Selecao>
      </div>
      <Retorno estado={estado} ok="Acesso criado. Passe a senha inicial pessoalmente." />
      <Botao type="submit" variante="contorno" disabled={enviando}>
        Criar acesso
      </Botao>
    </form>
  );
}
