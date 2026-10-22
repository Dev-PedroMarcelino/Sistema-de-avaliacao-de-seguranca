import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { podeAcessar } from "@/lib/auth/sessao";
import { obterEmpresa } from "@/lib/painel/consultas";
import { getDb } from "@/lib/db";
import { sair } from "./acoes";
import { Navegacao, type ItemNav } from "./navegacao";

export const dynamic = "force-dynamic";

const ITENS: ItemNav[] = [
  { href: "/painel", area: "dashboard", rotulo: "Visão geral", icone: "painel" },
  { href: "/painel/links", area: "links", rotulo: "Enviar link", icone: "link" },
  { href: "/painel/portaria", area: "portaria", rotulo: "Portaria", icone: "portaria" },
  { href: "/painel/motoristas", area: "motoristas", rotulo: "Motoristas", icone: "motoristas" },
  { href: "/painel/conteudo", area: "conteudo", rotulo: "Vídeo e perguntas", icone: "conteudo" },
  { href: "/painel/relatorios", area: "relatorios", rotulo: "Relatórios", icone: "relatorios" },
  { href: "/painel/configuracoes", area: "configuracoes", rotulo: "Configurações", icone: "config" },
];

const PERFIS = { admin: "Administrador", seguranca: "Segurança", portaria: "Portaria" };

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const empresa = await obterEmpresa(await getDb(), usuario.empresaId);
  const itens = ITENS.filter((i) => podeAcessar(usuario.perfil, i.area));

  return (
    <div className="min-h-dvh bg-stone-100 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="nao-imprimir sticky top-0 z-30 bg-tinta text-white lg:h-dvh lg:overflow-y-auto">
        <div className="faixa-seguranca h-1.5" />
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Logo claro />
          <p className="hidden truncate pt-1 text-sm text-stone-400 lg:block">{empresa?.nome}</p>
        </div>
        <Navegacao itens={itens} />
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-semibold">{usuario.nome}</p>
          <p className="text-xs text-stone-400">{PERFIS[usuario.perfil]}</p>
          <form action={sair} className="mt-3">
            <button className="flex items-center gap-2 text-sm text-stone-400 hover:text-white">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        <form action={sair} className="nao-imprimir px-4 pb-8 text-center lg:hidden">
          <button className="text-sm text-stone-500 underline">
            Sair ({usuario.nome})
          </button>
        </form>
      </div>
    </div>
  );
}
