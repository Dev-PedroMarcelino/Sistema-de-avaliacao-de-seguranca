import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Botao, Campo, Logo } from "@/components/ui";
import { normalizarCodigo } from "@/lib/codigo";

export const metadata: Metadata = { title: "Verificar comprovante" };

async function verificar(form: FormData) {
  "use server";
  const codigo = normalizarCodigo(String(form.get("codigo") ?? ""));
  redirect(`/v/${encodeURIComponent(codigo || "-")}`);
}

export default function DigitarCodigo() {
  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="faixa-seguranca h-2" />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <Logo />
        <div>
          <h1 className="text-2xl font-extrabold">Verificar comprovante</h1>
          <p className="mt-1 text-stone-600">Digite o código impresso no comprovante de integração.</p>
        </div>
        <form action={verificar} className="space-y-3">
          <Campo
            name="codigo"
            placeholder="K7M2-9QX4"
            autoCapitalize="characters"
            className="text-center font-mono text-2xl tracking-widest uppercase"
            required
          />
          <Botao tamanho="lg" type="submit">
            Verificar
          </Botao>
        </form>
      </main>
    </div>
  );
}
