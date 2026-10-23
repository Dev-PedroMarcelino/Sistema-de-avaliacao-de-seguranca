// WhatsApp automático pela uazapi.
// - UAZAPI_URL: servidor; UAZAPI_ADMIN_TOKEN: cria instâncias pelo painel.
// - O token da instância de cada empresa fica no banco (app.empresas.whatsapp_token);
//   UAZAPI_TOKEN continua aceito como instância fixa, para quem preferir configurar à mão.

type Json = Record<string, unknown>;

const base = () => process.env.UAZAPI_URL?.trim().replace(/\/+$/, "") ?? "";

export function uazapiServidorConfigurado() {
  return Boolean(base());
}
export function uazapiPodeCriarInstancia() {
  return Boolean(base() && process.env.UAZAPI_ADMIN_TOKEN?.trim());
}

/** Há como enviar? (token da empresa no banco ou UAZAPI_TOKEN fixo). */
export function whatsappConfigurado(tokenEmpresa?: string | null) {
  return Boolean(base() && (tokenEmpresa || process.env.UAZAPI_TOKEN?.trim()));
}

async function chamar(caminho: string, opcoes: { metodo?: string; token?: string; admin?: boolean; corpo?: Json }) {
  if (!base()) throw new Error("Servidor da uazapi não configurado (UAZAPI_URL).");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (opcoes.admin) headers.admintoken = process.env.UAZAPI_ADMIN_TOKEN?.trim() ?? "";
  if (opcoes.token) headers.token = opcoes.token;
  const r = await fetch(`${base()}${caminho}`, {
    method: opcoes.metodo ?? "POST",
    headers,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const texto = await r.text().catch(() => "");
  if (!r.ok) throw new Error(`uazapi respondeu ${r.status}: ${texto.slice(0, 200)}`);
  try {
    return JSON.parse(texto) as Json;
  } catch {
    return {} as Json;
  }
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Json) : {});
const str = (...vs: unknown[]) => vs.find((v): v is string => typeof v === "string" && v.length > 0) ?? null;

export type EnviarWhatsApp = (numero: string, texto: string) => Promise<void>;

export function criarEnviador(tokenEmpresa?: string | null): EnviarWhatsApp {
  return async (numero, texto) => {
    const token = tokenEmpresa || process.env.UAZAPI_TOKEN?.trim();
    if (!token) throw new Error("WhatsApp do sistema não conectado.");
    await chamar("/send/text", { token, corpo: { number: numero, text: texto } });
  };
}

/** Cria uma instância nova e devolve o token dela. */
export async function criarInstancia(nome: string) {
  const r = await chamar("/instance/create", { admin: true, corpo: { name: nome } });
  const token = str(r.token, obj(r.instance).token);
  if (!token) throw new Error("A uazapi não devolveu o token da instância criada.");
  return token;
}

export interface EstadoWhatsApp {
  status: "connected" | "connecting" | "disconnected" | "hibernated" | "desconhecido";
  numero: string | null;
  nomePerfil: string | null;
  qrcode: string | null;
  codigoPareamento: string | null;
}

function lerEstado(r: Json): EstadoWhatsApp {
  const inst = obj(r.instance);
  const st = obj(r.status);
  const conectado = r.connected === true || st.connected === true || inst.status === "connected";
  const bruto = str(inst.status, typeof r.status === "string" ? r.status : null);
  const status = conectado
    ? "connected"
    : (["connecting", "disconnected", "hibernated"].includes(bruto ?? "") ? bruto : "desconhecido") as EstadoWhatsApp["status"];
  const jid = str(inst.owner, st.jid, r.jid, inst.jid);
  let qrcode = str(inst.qrcode, r.qrcode, r.base64);
  if (qrcode && !qrcode.startsWith("data:")) qrcode = `data:image/png;base64,${qrcode}`;
  return {
    status,
    numero: jid ? jid.split(/[@:]/)[0] : null,
    nomePerfil: str(inst.profileName, r.profileName),
    qrcode: conectado ? null : qrcode,
    codigoPareamento: conectado ? null : str(inst.paircode, r.paircode, r.pairingCode),
  };
}

/** Inicia a conexão: devolve o QR Code (ou o código de pareamento, se vier o telefone). */
export async function conectarInstancia(token: string, telefone?: string | null) {
  return lerEstado(await chamar("/instance/connect", { token, corpo: telefone ? { phone: telefone } : {} }));
}

export async function statusInstancia(token: string) {
  return lerEstado(await chamar("/instance/status", { metodo: "GET", token }));
}

export async function desconectarInstancia(token: string) {
  await chamar("/instance/disconnect", { token, corpo: {} });
}
