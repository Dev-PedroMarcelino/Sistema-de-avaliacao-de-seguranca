// Textos da linha do tempo (usados no painel e no dossiê em PDF).

export const ROTULOS_EVENTO: Record<string, string> = {
  link_gerado: "Link gerado no painel",
  entrada_qr: "Entrada pelo QR Code da portaria",
  link_aberto: "Link aberto no celular",
  inicio: "Confirmou veículo parado e começou",
  identificacao: "Informou os dados",
  integracao_vigente: "Já tinha integração válida",
  video_iniciado: "Começou o vídeo",
  video_retomado: "Retomou o vídeo",
  video_progresso: "Sinal do player",
  video_pausado: "Vídeo pausado",
  video_fim_recusado: "Fim do vídeo recusado pelo servidor",
  video_concluido: "Assistiu ao vídeo até o fim",
  resposta: "Respondeu pergunta",
  quiz_concluido: "Concluiu as perguntas",
  termo_assinado: "Assinou o termo de ciência",
  comprovante_emitido: "Comprovante emitido",
  conferido_portaria: "Conferido pessoalmente na portaria",
  vencimento_avisado: "Integração vencida: aviso enviado por WhatsApp",
  vencimento_proximo_avisado: "Vencimento próximo: aviso enviado por WhatsApp",
};

const seg = (n: unknown) => `${Math.round(Number(n) || 0)} s`;

export function detalheEvento(tipo: string, d: Record<string, unknown>): string {
  switch (tipo) {
    case "link_gerado":
      return [d.por && `por ${d.por}`, d.nome && `para ${d.nome}`].filter(Boolean).join(", ");
    case "entrada_qr":
      return `${d.nome ?? ""} · ${d.unidade ?? ""}`;
    case "identificacao":
      return `${d.nome} · placa ${d.placa} · ${d.transportadora}`;
    case "integracao_vigente":
      return `comprovante ${d.codigo}`;
    case "video_iniciado":
    case "video_retomado":
      return `a partir de ${seg(d.posicao)}`;
    case "video_progresso":
      return `posição validada ${seg(d.validado)}`;
    case "video_pausado":
      return d.motivo === "tela" ? `saiu da tela em ${seg(d.validado)}` : `pausado em ${seg(d.validado)}`;
    case "video_fim_recusado":
      return `celular informou fim, mas só ${seg(d.validado)} foram validados`;
    case "video_concluido":
      return `${seg(d.duracao_seg)} · saídas da tela: ${d.saidas_tela}`;
    case "resposta":
      return `"${d.pergunta}": "${d.resposta}" (${d.correta ? "certa" : "errada"}, tentativa ${d.tentativa})`;
    case "termo_assinado":
      return `hash do termo ${String(d.termo_hash).slice(0, 12)}…`;
    case "comprovante_emitido":
      return `código ${d.codigo}`;
    case "conferido_portaria":
      return `por ${d.por}`;
    case "vencimento_avisado":
      return `para ${(d.destinos as string[] | undefined)?.join(", ") ?? "—"}`;
    case "vencimento_proximo_avisado":
      return `para ${(d.destinos as string[] | undefined)?.join(", ") ?? "—"}${d.motorista_avisado ? " e link novo ao motorista" : ""}`;
    default:
      return "";
  }
}
