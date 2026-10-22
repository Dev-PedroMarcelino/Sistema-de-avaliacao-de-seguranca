"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, um } from "@/lib/db";
import { conferirSenha } from "@/lib/auth/senha";
import { gravarSessao } from "@/lib/auth/servidor";
import { type Perfil, paginaInicial } from "@/lib/auth/sessao";
import { ErroFluxo } from "@/lib/integracao/servico";
import { ipDe, limitar } from "@/lib/requisicao";

interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  perfil: Perfil;
  senha_hash: string;
  ativo: boolean;
}

function destinoSeguro(proximo: string, perfil: Perfil) {
  return proximo.startsWith("/painel") && !proximo.startsWith("//") ? proximo : paginaInicial(perfil);
}

async function abrirSessao(u: Usuario, proximo: string): Promise<never> {
  const db = await getDb();
  await db.query("update app.usuarios set ultimo_acesso_em = now() where id = $1", [u.id]);
  await gravarSessao({ id: u.id, empresaId: u.empresa_id, nome: u.nome, perfil: u.perfil });
  redirect(destinoSeguro(proximo, u.perfil));
}

export async function entrar(_: { erro: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const proximo = String(form.get("proximo") ?? "");
  try {
    limitar(`login:${ipDe(await headers())}`, 10, 15 * 60_000);
  } catch (e) {
    return { erro: e instanceof ErroFluxo ? e.message : "Tente de novo." };
  }
  const db = await getDb();
  const u = await um<Usuario>(db, "select * from app.usuarios where email = $1", [email]);
  // Compara mesmo sem usuário, para não revelar quais e-mails existem pelo tempo de resposta.
  const ok = await conferirSenha(senha, u?.senha_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva").catch(
    () => false,
  );
  if (!u || !ok || !u.ativo) return { erro: "E-mail ou senha incorretos." };
  return abrirSessao(u, proximo);
}

/** Entrada com um clique no modo demo (portfólio). */
export async function entrarDemo(perfil: Perfil) {
  if (process.env.DEMO_MODE !== "true") return;
  const db = await getDb();
  const u = await um<Usuario>(
    db,
    `select u.* from app.usuarios u join app.empresas e on e.id = u.empresa_id
      where e.slug = 'demo' and u.perfil = $1 and u.ativo order by u.criado_em limit 1`,
    [perfil],
  );
  if (!u) return;
  return abrirSessao(u, "");
}
