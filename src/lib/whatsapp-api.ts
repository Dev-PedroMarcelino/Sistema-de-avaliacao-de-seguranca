// Envio automático de WhatsApp pela uazapi (POST {UAZAPI_URL}/send/text com o token da instância).

export function whatsappConfigurado() {
  return Boolean(process.env.UAZAPI_URL?.trim() && process.env.UAZAPI_TOKEN?.trim());
}

export type EnviarWhatsApp = (numero: string, texto: string) => Promise<void>;

export const enviarWhatsApp: EnviarWhatsApp = async (numero, texto) => {
  const base = process.env.UAZAPI_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UAZAPI_TOKEN?.trim();
  if (!base || !token) throw new Error("WhatsApp automático não configurado (UAZAPI_URL e UAZAPI_TOKEN).");
  const r = await fetch(`${base}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: numero, text: texto }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`uazapi respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
};
