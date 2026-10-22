export function preencherMensagem(modelo: string, valores: { nome?: string | null; empresa: string; link: string }) {
  const primeiroNome = (valores.nome ?? "").trim().split(/\s+/)[0] || "motorista";
  return modelo
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{empresa}", valores.empresa)
    .replaceAll("{link}", valores.link);
}

/** Abre o WhatsApp (app ou Web) com a mensagem pronta para o número. */
export function linkWhatsApp(telefone: string, mensagem: string) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
