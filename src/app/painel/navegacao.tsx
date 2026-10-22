"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, FileSpreadsheet, LayoutDashboard, Link2, Settings, ShieldCheck, Users, Video } from "lucide-react";
import type { Area } from "@/lib/auth/sessao";

const ICONES = {
  painel: LayoutDashboard,
  link: Link2,
  portaria: ShieldCheck,
  motoristas: Users,
  conteudo: Video,
  relatorios: FileSpreadsheet,
  config: Settings,
  grafico: BarChart3,
};

export interface ItemNav {
  href: string;
  area: Area;
  rotulo: string;
  icone: keyof typeof ICONES;
}

export function Navegacao({ itens }: { itens: ItemNav[] }) {
  const caminho = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-4">
      {itens.map((item) => {
        const ativo = item.href === "/painel" ? caminho === "/painel" : caminho.startsWith(item.href);
        const Icone = ICONES[item.icone];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              ativo ? "bg-white text-tinta" : "text-stone-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icone className={clsx("h-4 w-4", ativo ? "text-amber-700" : "")} />
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
