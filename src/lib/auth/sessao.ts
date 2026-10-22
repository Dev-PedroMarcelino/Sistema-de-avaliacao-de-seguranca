import { SignJWT, jwtVerify } from "jose";

// Só usa jose: roda também no middleware (edge).

export const COOKIE_SESSAO = "integra_sessao";
export const DURACAO_SESSAO_SEG = 12 * 3600;

export type Perfil = "admin" | "seguranca" | "portaria";

export interface Sessao {
  id: string;
  empresaId: string;
  nome: string;
  perfil: Perfil;
}

const SEGREDO_DEV = "dev-integra-segredo-local-nao-usar-em-producao";

function chave() {
  const segredo = process.env.AUTH_SECRET;
  const fraco = !segredo || segredo.length < 32 || segredo.startsWith("troque");
  if (fraco && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("Defina AUTH_SECRET com pelo menos 32 caracteres aleatórios.");
  }
  return new TextEncoder().encode(fraco ? SEGREDO_DEV : segredo);
}

export async function criarTokenSessao(s: Sessao) {
  return new SignJWT({ empresaId: s.empresaId, nome: s.nome, perfil: s.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.id)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEG}s`)
    .sign(chave());
}

export async function lerTokenSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return {
      id: payload.sub as string,
      empresaId: payload.empresaId as string,
      nome: payload.nome as string,
      perfil: payload.perfil as Perfil,
    };
  } catch {
    return null;
  }
}

export const AREAS = {
  dashboard: ["admin", "seguranca"],
  links: ["admin", "seguranca", "portaria"],
  motoristas: ["admin", "seguranca", "portaria"],
  portaria: ["admin", "seguranca", "portaria"],
  conteudo: ["admin", "seguranca"],
  relatorios: ["admin", "seguranca"],
  configuracoes: ["admin"],
  conta: ["admin", "seguranca", "portaria"],
} satisfies Record<string, Perfil[]>;

export type Area = keyof typeof AREAS;

export const podeAcessar = (perfil: Perfil, area: Area) => (AREAS[area] as Perfil[]).includes(perfil);

export const paginaInicial = (perfil: Perfil) => (perfil === "portaria" ? "/painel/portaria" : "/painel");
