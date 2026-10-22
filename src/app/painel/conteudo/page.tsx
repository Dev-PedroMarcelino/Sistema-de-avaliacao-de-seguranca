import type { Metadata } from "next";
import { Cabecalho } from "@/components/painel";
import { Botao, Campo, Rotulo } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/servidor";
import { getDb, um } from "@/lib/db";
import { obterRascunho } from "@/lib/integracao/conteudo";
import type { Pergunta } from "@/lib/quiz";
import * as fmt from "@/lib/formato";
import { salvarValidade } from "../acoes";
import { EditorConteudo } from "./editor";

export const metadata: Metadata = { title: "Vídeo e perguntas" };

interface Versao {
  id: string;
  numero: number;
  video_url: string;
  legenda_url: string | null;
  duracao_seg: number;
  termo: string;
  perguntas: Pergunta[];
  perguntas_por_integracao: number | null;
  invalida_anteriores: boolean;
  conteudo_hash: string | null;
  publicada_em: Date | null;
  publicada_por: string | null;
  usos: number;
}

export default async function Conteudo() {
  const u = await exigirUsuario("conteudo");
  const db = await getDb();
  const treinamento = (await um<{ id: string; titulo: string; validade_dias: number }>(
    db,
    "select id, titulo, validade_dias from app.treinamentos where empresa_id = $1 order by criado_em limit 1",
    [u.empresaId],
  ))!;
  const rascunhoId = await obterRascunho(db, treinamento.id);
  const versoes = await db.query<Versao>(
    `select v.*, us.nome as publicada_por,
            (select count(*)::int from app.comprovantes c where c.versao_id = v.id) as usos
       from app.versoes v left join app.usuarios us on us.id = v.publicada_por
      where v.treinamento_id = $1 order by v.numero desc`,
    [treinamento.id],
  );
  const rascunho = versoes.find((v) => v.id === rascunhoId)!;
  const publicadas = versoes.filter((v) => v.publicada_em);

  return (
    <>
      <Cabecalho
        titulo="Vídeo e perguntas"
        descricao="Edite o rascunho e publique. Cada versão publicada fica congelada: o comprovante aponta para a versão exata que o motorista viu."
      />

      <form action={salvarValidade} className="mb-6 grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:grid-cols-[1fr_200px_auto]">
        <div>
          <Rotulo htmlFor="titulo">Nome do treinamento</Rotulo>
          <Campo id="titulo" name="titulo" defaultValue={treinamento.titulo} />
        </div>
        <div>
          <Rotulo htmlFor="validade_dias">Validade (dias)</Rotulo>
          <Campo id="validade_dias" name="validade_dias" type="number" min={1} max={1825} defaultValue={treinamento.validade_dias} />
        </div>
        <div className="flex items-end">
          <Botao variante="contorno" type="submit">
            Salvar
          </Botao>
        </div>
        <p className="text-xs text-stone-500 sm:col-span-3">
          A validade vale para os comprovantes emitidos a partir de agora. Depois dela, o motorista precisa refazer a integração.
        </p>
      </form>

      <EditorConteudo
        numero={rascunho.numero}
        inicial={{
          video_url: rascunho.video_url,
          legenda_url: rascunho.legenda_url,
          duracao_seg: rascunho.duracao_seg,
          termo: rascunho.termo,
          perguntas: rascunho.perguntas,
          perguntas_por_integracao: rascunho.perguntas_por_integracao,
        }}
      />

      <h2 className="mb-3 mt-10 text-lg font-bold">Versões publicadas</h2>
      <ul className="space-y-2">
        {publicadas.map((v, k) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200">
            <div>
              <p className="font-semibold">
                Versão {v.numero} {k === 0 && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">em uso</span>}
              </p>
              <p className="text-sm text-stone-500">
                Publicada em {fmt.dataHora(v.publicada_em)}
                {v.publicada_por ? ` por ${v.publicada_por}` : ""} · {v.perguntas.length} perguntas
                {v.perguntas_por_integracao ? ` (sorteia ${v.perguntas_por_integracao})` : ""} · {fmt.duracao(v.duracao_seg)} de vídeo
                {v.invalida_anteriores ? " · invalidou as integrações anteriores" : ""}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{v.usos} comprovantes</p>
              <p className="font-mono text-[11px] text-stone-400" title={v.conteudo_hash ?? ""}>
                SHA-256 {v.conteudo_hash?.slice(0, 16)}…
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
