"use client";

import { useActionState, useEffect, useRef } from "react";
import { AreaTexto, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { criarUnidade, criarUsuario, salvarEmpresa } from "../acoes";

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
