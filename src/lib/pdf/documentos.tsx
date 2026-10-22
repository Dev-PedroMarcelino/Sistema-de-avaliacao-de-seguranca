import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { DadosComprovante, EventoGravado } from "@/lib/integracao/servico";
import { ROTULOS_EVENTO, detalheEvento } from "@/lib/integracao/rotulos";
import * as fmt from "@/lib/formato";

const TINTA = "#0b0f19";
const CINZA = "#57534e";
const LINHA = "#e7e5e4";

const s = StyleSheet.create({
  pagina: { paddingTop: 0, paddingBottom: 48, paddingHorizontal: 0, fontSize: 9.5, color: TINTA, fontFamily: "Helvetica" },
  topo: { backgroundColor: TINTA, paddingHorizontal: 36, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between" },
  faixa: { height: 5 },
  topoTitulo: { color: "white", fontSize: 15, fontFamily: "Helvetica-Bold" },
  topoSub: { color: "#a8a29e", fontSize: 9, marginTop: 2 },
  selo: { backgroundColor: "#f59e0b", color: TINTA, fontFamily: "Helvetica-Bold", fontSize: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, alignSelf: "flex-start" },
  corpo: { paddingHorizontal: 36, paddingTop: 18 },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6, color: CINZA, marginTop: 12, marginBottom: 5 },
  grade: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: LINHA },
  celula: { width: "50%", paddingVertical: 5, paddingRight: 8, borderBottomWidth: 1, borderColor: LINHA },
  rotulo: { fontSize: 7.5, color: CINZA, marginBottom: 1.5 },
  valor: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  // Altura de linha em pontos: o valor sem unidade sai exagerado no react-pdf.
  texto: { lineHeight: "12.5pt" },
  codigo: { fontSize: 22, fontFamily: "Courier-Bold", letterSpacing: 2 },
  rodape: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: CINZA, flexDirection: "row", justifyContent: "space-between" },
  tabelaLinha: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINHA, paddingVertical: 3.5 },
  mono: { fontFamily: "Courier", fontSize: 7 },
});

function Faixa() {
  return (
    <View style={[s.faixa, { flexDirection: "row" }]}>
      {Array.from({ length: 60 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? TINTA : "#f59e0b" }} />
      ))}
    </View>
  );
}

function Topo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <>
      <View style={s.topo}>
        <View>
          <Text style={s.topoTitulo}>{titulo}</Text>
          <Text style={s.topoSub}>{sub}</Text>
        </View>
        <Text style={s.selo}>SEGURANÇA DO TRABALHO</Text>
      </View>
      <Faixa />
    </>
  );
}

function Rodape({ texto }: { texto: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text>{texto}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function Campo({ rotulo, valor, largo }: { rotulo: string; valor: string; largo?: boolean }) {
  return (
    <View style={[s.celula, largo ? { width: "100%" } : {}]}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

export interface EntradaComprovante {
  dados: DadosComprovante;
  hash: string;
  vigenteAte: Date;
  assinatura: { imagem: string; termo_texto: string } | null;
  urlVerificacao: string;
  conferidoPor?: string | null;
}

function BlocoComprovante({ e, qr }: { e: EntradaComprovante; qr: string }) {
  const d = e.dados;
  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={s.rotulo}>CÓDIGO DO COMPROVANTE</Text>
          <Text style={s.codigo}>{d.codigo}</Text>
          <Text style={{ marginTop: 4, fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#15803d" }}>
            Integração válida até {fmt.data(e.vigenteAte)}
          </Text>
          <Text style={{ marginTop: 2, color: CINZA }}>Emitido em {fmt.dataHora(d.emitido_em)}</Text>
        </View>
        <Image src={qr} style={{ width: 86, height: 86 }} />
      </View>

      <Text style={s.h2}>Motorista</Text>
      <View style={s.grade}>
        <Campo rotulo="Nome" valor={d.motorista.nome} />
        <Campo rotulo="CPF" valor={fmt.cpf(d.motorista.cpf)} />
        <Campo rotulo="WhatsApp" valor={fmt.telefone(d.motorista.telefone)} />
        <Campo rotulo="Placa" valor={fmt.placa(d.placa)} />
        <Campo rotulo="Transportadora" valor={d.transportadora ?? "—"} />
        <Campo rotulo="Local" valor={`${d.empresa} · ${d.unidade}`} />
      </View>

      <Text style={s.h2}>Treinamento</Text>
      <View style={s.grade}>
        <Campo rotulo="Conteúdo" valor={`${d.treinamento.titulo} (versão ${d.treinamento.versao})`} largo />
        <Campo rotulo="Vídeo assistido até o fim" valor={`${fmt.duracao(d.video.duracao_seg)} · validado pelo servidor`} />
        <Campo rotulo="Saídas da tela durante o vídeo" valor={String(d.video.saidas_tela)} />
        <Campo rotulo="Início do vídeo" valor={fmt.dataHora(d.video.iniciado_em)} />
        <Campo rotulo="Fim do vídeo" valor={fmt.dataHora(d.video.concluido_em)} />
        <Campo rotulo="Origem" valor={d.origem === "qr" ? "QR Code da portaria" : "Link enviado por WhatsApp"} />
        <Campo rotulo="Conferido na portaria" valor={e.conferidoPor ?? "Não"} />
      </View>

      <Text style={s.h2}>Perguntas de verificação</Text>
      {d.perguntas.map((p, i) => (
        <View key={p.id} style={s.tabelaLinha}>
          <Text style={{ width: 18, color: CINZA }}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}>{p.texto}</Text>
          <Text style={{ width: 120, textAlign: "right", fontFamily: "Helvetica-Bold" }}>
            {p.tentativas === 1 ? "Acertou de primeira" : `Acertou na ${p.tentativas}ª tentativa`}
          </Text>
        </View>
      ))}

      <Text style={s.h2}>Termo de ciência</Text>
      <Text style={s.texto}>{e.assinatura?.termo_texto ?? ""}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
        <View style={{ width: 220 }}>
          {e.assinatura && <Image src={e.assinatura.imagem} style={{ width: 200, height: 66, objectFit: "contain" }} />}
          <View style={{ borderTopWidth: 1, borderColor: TINTA, paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>{d.motorista.nome}</Text>
            <Text style={{ fontSize: 7, color: CINZA }}>Assinado eletronicamente em {fmt.dataHora(d.assinatura.assinada_em)}</Text>
          </View>
        </View>
      </View>

      <Text style={s.h2}>Autenticidade</Text>
      <Text style={[s.texto, { color: CINZA, fontSize: 8 }]}>
        Este comprovante é parte de uma trilha de auditoria em que cada evento guarda o resumo criptográfico (SHA-256) do
        anterior. Para conferir se ele é autêntico e não foi alterado, leia o QR Code ou acesse {e.urlVerificacao}.
      </Text>
      <Text style={[s.mono, { marginTop: 4 }]}>SHA-256: {e.hash}</Text>
    </>
  );
}

export async function pdfComprovante(e: EntradaComprovante) {
  const qr = await QRCode.toDataURL(e.urlVerificacao, { margin: 0, width: 300 });
  return renderToBuffer(
    <Document title={`Comprovante ${e.dados.codigo}`} author={e.dados.empresa} subject="Integração de segurança">
      <Page size="A4" style={s.pagina}>
        <Topo titulo="Comprovante de integração de segurança" sub={`${e.dados.empresa} · ${e.dados.unidade}`} />
        <View style={s.corpo}>
          <BlocoComprovante e={e} qr={qr} />
        </View>
        <Rodape texto={`Comprovante ${e.dados.codigo} · gerado em ${fmt.dataHora(new Date())}`} />
      </Page>
    </Document>,
  );
}

/** Dossiê para o jurídico: comprovante + linha do tempo completa + dados técnicos. */
export async function pdfDossie(e: EntradaComprovante & { eventos: EventoGravado[]; correnteValida: boolean }) {
  const qr = await QRCode.toDataURL(e.urlVerificacao, { margin: 0, width: 300 });
  const eventos = e.eventos.filter((ev) => ev.tipo !== "video_progresso");
  const sinais = e.eventos.length - eventos.length;
  return renderToBuffer(
    <Document title={`Dossiê ${e.dados.codigo}`} author={e.dados.empresa} subject="Dossiê de integração de segurança">
      <Page size="A4" style={s.pagina}>
        <Topo titulo="Dossiê de integração de segurança" sub={`${e.dados.motorista.nome} · ${e.dados.empresa}`} />
        <View style={s.corpo}>
          <BlocoComprovante e={e} qr={qr} />
        </View>
        <Rodape texto={`Dossiê ${e.dados.codigo} · gerado em ${fmt.dataHora(new Date())}`} />
      </Page>
      <Page size="A4" style={s.pagina}>
        <Topo titulo="Linha do tempo registrada" sub={`Comprovante ${e.dados.codigo} · horários do servidor (Brasília)`} />
        <View style={s.corpo}>
          <Text style={[s.texto, { marginBottom: 8 }]}>
            Corrente de auditoria:{" "}
            <Text style={{ fontFamily: "Helvetica-Bold", color: e.correnteValida ? "#15803d" : "#b91c1c" }}>
              {e.correnteValida ? "íntegra (nenhum evento alterado ou removido)" : "QUEBRADA: há registro alterado"}
            </Text>
            . {sinais} sinais periódicos do player (a cada 10 s) foram omitidos desta lista e constam na base.
          </Text>
          {eventos.map((ev) => (
            <View key={ev.seq} style={s.tabelaLinha} wrap={false}>
              <Text style={{ width: 22, color: CINZA }}>#{ev.seq}</Text>
              <Text style={{ width: 92 }}>{fmt.dataHora(ev.ocorrido_em)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{ROTULOS_EVENTO[ev.tipo] ?? ev.tipo}</Text>
                {detalheEvento(ev.tipo, ev.dados) ? <Text style={{ color: CINZA }}>{detalheEvento(ev.tipo, ev.dados)}</Text> : null}
                <Text style={[s.mono, { color: "#a8a29e" }]}>
                  {ev.ip ?? "—"} · {(ev.user_agent ?? "").slice(0, 70)} · {ev.hash.slice(0, 16)}…
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Rodape texto={`Dossiê ${e.dados.codigo}`} />
      </Page>
    </Document>,
  );
}

export interface LinhaRelatorio {
  data: Date;
  nome: string;
  cpf: string;
  placa: string | null;
  transportadora: string | null;
  unidade: string;
  codigo: string;
  vigenteAte: Date;
  situacao: string;
  tentativas: number;
}

export async function pdfRelatorio(titulo: string, filtro: string, linhas: LinhaRelatorio[]) {
  const colunas: [string, number, (l: LinhaRelatorio) => string][] = [
    ["Data", 78, (l) => fmt.dataHora(l.data).slice(0, 17)],
    ["Motorista", 0, (l) => l.nome],
    ["CPF", 66, (l) => fmt.cpfMascarado(l.cpf)],
    ["Placa", 46, (l) => fmt.placa(l.placa)],
    ["Transportadora", 96, (l) => l.transportadora ?? "—"],
    ["Código", 58, (l) => l.codigo],
    ["Válida até", 52, (l) => fmt.data(l.vigenteAte)],
    ["Situação", 50, (l) => l.situacao],
  ];
  return renderToBuffer(
    <Document title={titulo}>
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <Topo titulo={titulo} sub={filtro} />
        <View style={s.corpo}>
          <View style={[s.tabelaLinha, { borderBottomWidth: 1.5, borderColor: TINTA }]} fixed>
            {colunas.map(([nome, largura]) => (
              <Text key={nome} style={[{ fontFamily: "Helvetica-Bold", fontSize: 8 }, largura ? { width: largura } : { flex: 1 }]}>
                {nome}
              </Text>
            ))}
          </View>
          {linhas.map((l) => (
            <View key={l.codigo} style={s.tabelaLinha} wrap={false}>
              {colunas.map(([nome, largura, valor]) => (
                <Text key={nome} style={[{ fontSize: 8.5 }, largura ? { width: largura } : { flex: 1 }]}>
                  {valor(l)}
                </Text>
              ))}
            </View>
          ))}
          <Text style={{ marginTop: 10, color: CINZA }}>{linhas.length} integrações.</Text>
        </View>
        <Rodape texto={`${titulo} · gerado em ${fmt.dataHora(new Date())}`} />
      </Page>
    </Document>,
  );
}
