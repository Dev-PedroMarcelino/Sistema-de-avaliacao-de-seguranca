"use client";

import { usePathname, useRouter } from "next/navigation";

export function MostrarSinais({ ativo, total }: { ativo: boolean; total: number }) {
  const router = useRouter();
  const caminho = usePathname();
  if (total === 0) return null;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
      <input
        type="checkbox"
        checked={ativo}
        onChange={(e) => router.replace(e.target.checked ? `${caminho}?sinais=1` : caminho, { scroll: false })}
        className="h-4 w-4 accent-tinta"
      />
      Mostrar os {total} sinais do player (a cada 10 s)
    </label>
  );
}
