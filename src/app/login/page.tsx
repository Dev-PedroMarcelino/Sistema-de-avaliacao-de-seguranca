import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HardHat, ShieldCheck, UserCog } from "lucide-react";
import { Logo } from "@/components/ui";
import { sessaoAtual } from "@/lib/auth/servidor";
import { paginaInicial } from "@/lib/auth/sessao";
import { entrarDemo } from "./acoes";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

const DEMOS = [
  { perfil: "admin", titulo: "Administrador", texto: "Tudo, inclusive usuários e configurações", icone: UserCog },
  { perfil: "seguranca", titulo: "Segurança do trabalho", texto: "Dashboard, conteúdo, motoristas e relatórios", icone: ShieldCheck },
  { perfil: "portaria", titulo: "Portaria", texto: "Consulta de placa/CPF e geração de links", icone: HardHat },
] as const;

export default async function Login({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const sessao = await sessaoAtual();
  if (sessao) redirect(paginaInicial(sessao.perfil));
  const { proximo = "" } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-tinta p-10 text-white lg:flex">
        <div className="faixa-seguranca absolute inset-x-0 top-0 h-2" />
        <Link href="/">
          <Logo claro />
        </Link>
        <div>
          <p className="text-4xl font-extrabold leading-tight">
            Prova de que cada motorista
            <br />
            foi instruído antes de entrar.
          </p>
          <p className="mt-4 max-w-md text-stone-400">
            Vídeo que não pode ser pulado, perguntas de verificação, termo assinado e uma trilha de auditoria que denuncia
            qualquer alteração.
          </p>
        </div>
        <p className="text-sm text-stone-500">Integra · Segurança do trabalho</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Entrar no painel</h1>
            <p className="mt-1 text-stone-600">Área da segurança do trabalho e da portaria.</p>
          </div>
          <FormularioLogin proximo={proximo} />

          {demo && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <span className="h-px flex-1 bg-stone-300" /> Demonstração <span className="h-px flex-1 bg-stone-300" />
              </div>
              {DEMOS.map((d) => (
                <form key={d.perfil} action={entrarDemo.bind(null, d.perfil)}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-left transition hover:border-tinta"
                  >
                    <d.icone className="h-5 w-5 shrink-0 text-stone-500" />
                    <span>
                      <span className="block text-[15px] font-semibold">Entrar como {d.titulo}</span>
                      <span className="block text-xs text-stone-500">{d.texto}</span>
                    </span>
                  </button>
                </form>
              ))}
              <p className="text-center text-xs text-stone-500">Dados fictícios da “Mineração Demo”.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
