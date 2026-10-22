import type { Metadata } from "next";
import { Cabecalho } from "@/components/painel";
import { exigirUsuario } from "@/lib/auth/servidor";
import { FormSenha } from "./formulario";

export const metadata: Metadata = { title: "Minha senha" };

export default async function Conta() {
  const u = await exigirUsuario("conta");
  return (
    <>
      <Cabecalho titulo="Minha senha" descricao={`Acesso de ${u.nome}.`} />
      <section className="max-w-md rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <FormSenha />
      </section>
    </>
  );
}
