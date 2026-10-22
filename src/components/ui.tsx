import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variante = "primario" | "marca" | "contorno" | "perigo" | "fantasma";
type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-tinta text-white hover:bg-black disabled:bg-stone-400",
  marca: "bg-marca text-tinta hover:brightness-95 disabled:opacity-50",
  contorno: "border-2 border-tinta/15 bg-white text-tinta hover:border-tinta/40 disabled:opacity-50",
  perigo: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  fantasma: "text-tinta hover:bg-tinta/5 disabled:opacity-50",
};
const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-14 px-6 text-lg rounded-2xl gap-2.5 w-full",
};

export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center font-semibold transition select-none disabled:cursor-not-allowed",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca",
    VARIANTES[variante],
    TAMANHOS[tamanho],
    extra,
  );
}

export function Botao({
  variante,
  tamanho,
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamanho?: Tamanho }) {
  return <button className={classesBotao(variante, tamanho, className)} {...props} />;
}

export function BotaoLink({
  variante,
  tamanho,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamanho?: Tamanho }) {
  return <Link className={classesBotao(variante, tamanho, className)} {...props} />;
}

export function Cartao({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl border border-stone-200 bg-white", className)} {...props} />;
}

export function Rotulo({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-stone-700">
      {children}
    </label>
  );
}

export const classesCampo =
  "block w-full rounded-xl border-2 border-stone-200 bg-white px-3.5 py-2.5 text-[16px] text-tinta outline-none transition " +
  "placeholder:text-stone-400 focus:border-tinta disabled:bg-stone-100 disabled:text-stone-500";

export function Campo({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(classesCampo, className)} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(classesCampo, "min-h-28", className)} {...props} />;
}

export function Selecao({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(classesCampo, "pr-8", className)} {...props} />;
}

export type Situacao = "valida" | "vencendo" | "vencida" | "pendente" | "expirado" | "andamento";

const SITUACOES: Record<Situacao, { texto: string; classe: string }> = {
  valida: { texto: "Válida", classe: "bg-green-100 text-green-800" },
  vencendo: { texto: "Vencendo", classe: "bg-amber-100 text-amber-900" },
  vencida: { texto: "Vencida", classe: "bg-red-100 text-red-800" },
  pendente: { texto: "Pendente", classe: "bg-stone-200 text-stone-700" },
  andamento: { texto: "Em andamento", classe: "bg-sky-100 text-sky-800" },
  expirado: { texto: "Link expirado", classe: "bg-stone-200 text-stone-500" },
};

export function SeloSituacao({ situacao, children }: { situacao: Situacao; children?: ReactNode }) {
  const s = SITUACOES[situacao];
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.classe)}>
      {children ?? s.texto}
    </span>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "info" | "ok"; children: ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={clsx(
        "rounded-xl px-4 py-3 text-sm font-medium",
        tipo === "erro" && "bg-red-50 text-red-800 ring-1 ring-red-200",
        tipo === "info" && "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
        tipo === "ok" && "bg-green-50 text-green-900 ring-1 ring-green-200",
      )}
    >
      {children}
    </div>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-extrabold tracking-tight", claro ? "text-white" : "text-tinta")}>
      <span className="faixa-seguranca inline-block h-6 w-6 rounded-md ring-2 ring-marca" aria-hidden />
      Integra
    </span>
  );
}
