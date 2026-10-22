import ExcelJS from "exceljs";
import { sessaoAtual } from "@/lib/auth/servidor";
import { podeAcessar } from "@/lib/auth/sessao";
import { getDb, um } from "@/lib/db";
import { relatorio } from "@/lib/painel/consultas";
import { respostaPdf } from "@/lib/pdf/carregar";
import { pdfRelatorio } from "@/lib/pdf/documentos";
import { filtroDaUrl, descreverFiltro, NOME_SITUACAO } from "@/lib/painel/filtro-relatorio";
import * as fmt from "@/lib/formato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = await sessaoAtual();
  if (!u || !podeAcessar(u.perfil, "relatorios")) return new Response("Sem permissão.", { status: 403 });
  const url = new URL(req.url);
  const filtro = filtroDaUrl(url.searchParams);
  const db = await getDb();
  const linhas = await relatorio(db, u.empresaId, filtro);
  const unidade = filtro.unidadeId
    ? (await um<{ nome: string }>(db, "select nome from app.unidades where id = $1", [filtro.unidadeId]))?.nome
    : undefined;
  const descricao = descreverFiltro(filtro, unidade);
  const nome = `integracoes-${filtro.de}-a-${filtro.ate}`;

  if (url.searchParams.get("formato") === "pdf") {
    const pdf = await pdfRelatorio(
      "Relatório de integrações de segurança",
      descricao,
      linhas.map((l) => ({
        data: l.emitido_em,
        nome: l.nome,
        cpf: l.cpf,
        placa: l.placa,
        transportadora: l.transportadora,
        unidade: l.unidade,
        codigo: l.codigo,
        vigenteAte: l.vigente_ate,
        situacao: NOME_SITUACAO[l.situacao],
        tentativas: l.tentativas,
      })),
    );
    return respostaPdf(pdf, `${nome}.pdf`);
  }

  const livro = new ExcelJS.Workbook();
  livro.creator = "Integra";
  const aba = livro.addWorksheet("Integrações", { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = [
    { header: "Data", key: "data", width: 18 },
    { header: "Motorista", key: "nome", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "WhatsApp", key: "telefone", width: 17 },
    { header: "Placa", key: "placa", width: 10 },
    { header: "Transportadora", key: "transportadora", width: 26 },
    { header: "Unidade", key: "unidade", width: 22 },
    { header: "Origem", key: "origem", width: 14 },
    { header: "Versão do conteúdo", key: "versao", width: 10 },
    { header: "Respostas (com erros)", key: "tentativas", width: 12 },
    { header: "Saídas da tela", key: "saidas", width: 10 },
    { header: "Conferido na portaria", key: "conferido", width: 12 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Válida até", key: "vigente", width: 12 },
    { header: "Situação", key: "situacao", width: 12 },
  ];
  for (const l of linhas) {
    aba.addRow({
      data: fmt.dataHora(l.emitido_em),
      nome: l.nome,
      cpf: fmt.cpf(l.cpf),
      telefone: fmt.telefone(l.telefone),
      placa: fmt.placa(l.placa),
      transportadora: l.transportadora ?? "",
      unidade: l.unidade,
      origem: l.origem === "qr" ? "QR portaria" : "Link WhatsApp",
      versao: l.versao,
      tentativas: l.tentativas,
      saidas: l.saidas,
      conferido: l.conferido ? "Sim" : "Não",
      codigo: l.codigo,
      vigente: fmt.data(l.vigente_ate),
      situacao: NOME_SITUACAO[l.situacao],
    });
  }
  const cabecalho = aba.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B0F19" } };
  aba.autoFilter = { from: "A1", to: "O1" };
  const info = livro.addWorksheet("Sobre");
  info.addRows([
    ["Relatório de integrações de segurança"],
    [descricao],
    [`Gerado em ${fmt.dataHora(new Date())} por ${u.nome}`],
    ["Cada código pode ser conferido na página /v/<código> do sistema."],
  ]);

  const buffer = await livro.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
