import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, um } from "@/lib/db";
import { FormularioEntrada } from "./formulario";

export const metadata: Metadata = { title: "Entrada pela portaria", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Página aberta pelo QR Code impresso na portaria. */
export default async function Entrada({ params }: { params: Promise<{ unidade: string }> }) {
  const { unidade: slug } = await params;
  const db = await getDb();
  const unidade = await um<{ id: string; nome: string; empresa: string; cor: string }>(
    db,
    `select u.id, u.nome, e.nome as empresa, e.cor from app.unidades u join app.empresas e on e.id = u.empresa_id
      where u.slug = $1`,
    [slug],
  );
  if (!unidade) notFound();

  return (
    <div className="min-h-dvh bg-stone-100" style={{ "--marca": unidade.cor } as React.CSSProperties}>
      <div className="faixa-seguranca h-2" />
      <header className="bg-tinta text-white">
        <div className="mx-auto max-w-lg px-4 py-3">
          <p className="text-[15px] font-bold">{unidade.empresa}</p>
          <p className="text-xs text-stone-400">{unidade.nome}</p>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-6">
        <h1 className="text-[26px] font-extrabold leading-tight">Integração de segurança</h1>
        <p className="mt-2 text-stone-600">
          Antes de entrar, todo motorista precisa assistir ao vídeo de segurança e responder algumas perguntas. Leva
          poucos minutos.
        </p>
        <FormularioEntrada unidadeSlug={slug} />
      </main>
    </div>
  );
}
