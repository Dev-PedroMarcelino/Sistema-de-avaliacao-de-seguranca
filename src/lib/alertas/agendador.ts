import { getDb } from "@/lib/db";
import { enviarWhatsApp, whatsappConfigurado } from "@/lib/whatsapp-api";
import { processarVencimentos } from "./vencimentos";

const A_CADA_MS = 60 * 60_000;
const global = globalThis as unknown as { __integraAgendador?: boolean };

/** Verifica vencimentos 1 min depois de subir e depois de hora em hora (só fora do modo demo). */
export function iniciarAgendador() {
  if (global.__integraAgendador || process.env.DEMO_MODE === "true") return;
  global.__integraAgendador = true;
  const rodar = async () => {
    if (!whatsappConfigurado()) return;
    try {
      const r = await processarVencimentos(await getDb(), {
        enviar: enviarWhatsApp,
        urlBase: process.env.APP_URL?.replace(/\/$/, "") ?? null,
      });
      if (r.enviados || r.erros) console.log(`[integra] avisos de vencimento: ${r.enviados} enviados, ${r.erros} com erro`);
    } catch (erro) {
      console.error("[integra] falha ao verificar vencimentos:", erro);
    }
  };
  setTimeout(rodar, 60_000);
  setInterval(rodar, A_CADA_MS);
  if (!whatsappConfigurado()) console.log("[integra] aviso de vencimento desligado: defina UAZAPI_URL e UAZAPI_TOKEN");
}
