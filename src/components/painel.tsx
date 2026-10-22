import type { ReactNode } from "react";

/** Cor única das barras (tom escuro do âmbar da marca, contraste ≥ 3:1 no branco). */
const COR_BARRA = "#b45309";

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-stone-600">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string | number; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${destaque ? "bg-tinta text-white ring-tinta" : "bg-white ring-stone-200"}`}>
      <p className={`text-sm ${destaque ? "text-stone-300" : "text-stone-500"}`}>{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{valor}</p>
      {detalhe && <p className={`mt-1 text-xs ${destaque ? "text-stone-400" : "text-stone-500"}`}>{detalhe}</p>}
    </div>
  );
}

export function Painel({ titulo, subtitulo, children, className = "" }: { titulo: string; subtitulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 ring-1 ring-stone-200 ${className}`}>
      <h2 className="font-bold">{titulo}</h2>
      {subtitulo && <p className="text-sm text-stone-500">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Barras horizontais de uma série, com o valor na ponta e dica ao passar o mouse. */
export function BarrasHorizontais({
  itens,
  formatar = (v) => String(v),
  maximo,
}: {
  itens: { rotulo: string; valor: number; dica?: string }[];
  formatar?: (v: number) => string;
  maximo?: number;
}) {
  const teto = maximo ?? Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) return <p className="text-sm text-stone-500">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.rotulo} className="group relative" title={i.dica ?? `${i.rotulo}: ${formatar(i.valor)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-stone-700">{i.rotulo}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatar(i.valor)}</span>
          </div>
          <div className="h-3 rounded-r bg-stone-100">
            <div
              className="h-3 rounded-r transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(i.valor > 0 ? 1.5 : 0, (i.valor / teto) * 100)}%`, background: COR_BARRA }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Colunas por dia, com dica (dia e total) no hover e eixo com valores redondos. */
export function Colunas({ itens }: { itens: { rotulo: string; dica: string; valor: number }[] }) {
  const teto = Math.max(1, ...itens.map((i) => i.valor));
  const passo = teto <= 4 ? 1 : Math.ceil(teto / 4);
  const topo = Math.ceil(teto / passo) * passo;
  const marcas = Array.from({ length: topo / passo + 1 }, (_, k) => k * passo);
  return (
    <div className="flex gap-2">
      <div className="relative h-44 w-6 text-right text-[11px] tabular-nums text-stone-400">
        {marcas.map((m) => (
          <span key={m} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(m / topo) * 100}%` }}>
            {m}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-44">
          {marcas.map((m) => (
            <div key={m} className="absolute inset-x-0 border-t border-stone-100" style={{ bottom: `${(m / topo) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {itens.map((i) => (
              <div key={i.rotulo} className="group relative flex h-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-6 rounded-t"
                  style={{ height: `${(i.valor / topo) * 100}%`, background: i.valor ? COR_BARRA : "transparent" }}
                />
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-tinta px-2 py-1 text-xs text-white group-hover:block">
                  {i.dica}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-stone-400">
          <span>{itens[0]?.rotulo}</span>
          <span>{itens.at(-1)?.rotulo}</span>
        </div>
      </div>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white px-6 py-12 text-center text-stone-500 ring-1 ring-stone-200">{children}</div>;
}

export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-stone-500 [&_thead]:border-b [&_thead]:border-stone-200 [&_tbody_tr]:border-b [&_tbody_tr]:border-stone-100 [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}
