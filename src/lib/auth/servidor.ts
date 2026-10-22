import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, um } from "@/lib/db";
import { type Area, COOKIE_SESSAO, DURACAO_SESSAO_SEG, type Sessao, criarTokenSessao, lerTokenSessao, paginaInicial, podeAcessar } from "./sessao";

export async function sessaoAtual(): Promise<Sessao | null> {
  const loja = await cookies();
  const sessao = await lerTokenSessao(loja.get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;
  // Usuário desativado perde o acesso na hora, mesmo com a sessão ainda válida.
  const db = await getDb();
  const u = await um<{ ativo: boolean; perfil: Sessao["perfil"] }>(db, "select ativo, perfil from app.usuarios where id = $1", [
    sessao.id,
  ]);
  if (!u?.ativo) return null;
  return { ...sessao, perfil: u.perfil };
}

/** Garante usuário logado (e com acesso à área). Redireciona se não tiver. */
export async function exigirUsuario(area?: Area): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  if (area && !podeAcessar(sessao.perfil, area)) redirect(paginaInicial(sessao.perfil));
  return sessao;
}

export async function gravarSessao(s: Sessao) {
  const loja = await cookies();
  loja.set(COOKIE_SESSAO, await criarTokenSessao(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SESSAO_SEG,
  });
}

export async function apagarSessao() {
  const loja = await cookies();
  loja.delete(COOKIE_SESSAO);
}
