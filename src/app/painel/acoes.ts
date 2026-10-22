"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, um } from "@/lib/db";
import { apagarSessao, exigirUsuario } from "@/lib/auth/servidor";
import { conferirSenha, gerarHashSenha } from "@/lib/auth/senha";
import { ErroFluxo, conferirNaPortaria, criarIntegracao } from "@/lib/integracao/servico";
import { type ConteudoVersao, obterRascunho, publicarVersao, salvarRascunho, validarConteudo } from "@/lib/integracao/conteudo";
import { obterEmpresa } from "@/lib/painel/consultas";
import { ipDe, urlBase, userAgentDe } from "@/lib/requisicao";
import { normalizarTelefone } from "@/lib/validacao";
import { linkWhatsApp, preencherMensagem } from "@/lib/whatsapp";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const falha = (e: unknown): { ok: false; erro: string } => {
  if (e instanceof ErroFluxo) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: "Algo deu errado. Tente de novo." };
};

export async function sair() {
  await apagarSessao();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export interface LinkGerado {
  link: string;
  mensagem: string;
  whatsapp: string;
  nome: string;
  telefone: string;
  expiraEm: string;
}

export async function gerarLink(_: unknown, form: FormData): Promise<Resultado<LinkGerado> | null> {
  const u = await exigirUsuario("links");
  const h = await headers();
  try {
    const telefone = normalizarTelefone(String(form.get("telefone") ?? ""));
    if (!telefone) throw new ErroFluxo(400, "Informe o WhatsApp com DDD, ex.: (19) 99999-1234.");
    const nome = String(form.get("nome") ?? "").trim();
    const unidadeId = String(form.get("unidade") ?? "");
    const db = await getDb();
    const unidade = await um(db, "select 1 from app.unidades where id = $1 and empresa_id = $2", [unidadeId, u.empresaId]);
    if (!unidade) throw new ErroFluxo(400, "Escolha a unidade.");
    const criada = await criarIntegracao(
      { db, ip: ipDe(h), userAgent: userAgentDe(h) },
      {
        unidadeId,
        origem: "link",
        telefone,
        nome: nome || null,
        transportadora: String(form.get("transportadora") ?? "") || null,
        criadoPor: { id: u.id, nome: u.nome },
      },
    );
    const empresa = (await obterEmpresa(db, u.empresaId))!;
    const link = `${urlBase(h)}/i/${criada.token}`;
    const mensagem = preencherMensagem(empresa.mensagem_whatsapp, { nome, empresa: empresa.nome, link });
    revalidatePath("/painel/links");
    return {
      ok: true,
      link,
      mensagem,
      whatsapp: linkWhatsApp(telefone, mensagem),
      nome,
      telefone,
      expiraEm: criada.expiraEm.toISOString(),
    };
  } catch (e) {
    return falha(e);
  }
}

// ---------------------------------------------------------------------------
// Portaria
// ---------------------------------------------------------------------------

export async function conferir(integracaoId: string): Promise<Resultado> {
  const u = await exigirUsuario("portaria");
  const h = await headers();
  try {
    await conferirNaPortaria({ db: await getDb(), ip: ipDe(h), userAgent: userAgentDe(h) }, integracaoId, {
      id: u.id,
      nome: u.nome,
      empresaId: u.empresaId,
    });
    revalidatePath("/painel/portaria");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

// ---------------------------------------------------------------------------
// Conteúdo (vídeo, perguntas e termo)
// ---------------------------------------------------------------------------

const esquemaConteudo = z.object({
  video_url: z.string().max(2000),
  legenda_url: z.string().max(2000).nullable(),
  duracao_seg: z.number().min(0).max(36_000),
  termo: z.string().max(5000),
  perguntas_por_integracao: z.number().int().min(1).nullable(),
  perguntas: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        texto: z.string().max(400),
        alternativas: z.array(z.object({ id: z.string().min(1).max(20), texto: z.string().max(200) })).max(6),
        correta: z.string(),
      }),
    )
    .max(30),
});

async function treinamentoDaEmpresa(empresaId: string) {
  const db = await getDb();
  const t = await um<{ id: string }>(db, "select id from app.treinamentos where empresa_id = $1 order by criado_em limit 1", [
    empresaId,
  ]);
  if (!t) throw new ErroFluxo(404, "Treinamento não encontrado.");
  return { db, treinamentoId: t.id };
}

export async function salvarConteudo(conteudo: ConteudoVersao, publicar: { invalidaAnteriores: boolean } | null): Promise<Resultado> {
  const u = await exigirUsuario("conteudo");
  try {
    const r = esquemaConteudo.safeParse(conteudo);
    if (!r.success) throw new ErroFluxo(400, "Conteúdo inválido.");
    const { db, treinamentoId } = await treinamentoDaEmpresa(u.empresaId);
    await db.tx(async (t) => {
      const rascunho = await obterRascunho(t, treinamentoId);
      await salvarRascunho(t, rascunho, r.data);
      if (publicar) {
        const erro = validarConteudo(r.data);
        if (erro) throw new ErroFluxo(400, erro);
        await publicarVersao(t, rascunho, { usuarioId: u.id, invalidaAnteriores: publicar.invalidaAnteriores });
      }
    });
    revalidatePath("/painel/conteudo");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function salvarValidade(form: FormData) {
  const u = await exigirUsuario("conteudo");
  const dias = Number(form.get("validade_dias"));
  const titulo = String(form.get("titulo") ?? "").trim();
  if (!Number.isInteger(dias) || dias < 1 || dias > 1825 || titulo.length < 3) return;
  const { db, treinamentoId } = await treinamentoDaEmpresa(u.empresaId);
  await db.query("update app.treinamentos set validade_dias = $2, titulo = $3 where id = $1", [treinamentoId, dias, titulo]);
  revalidatePath("/painel/conteudo");
}

// ---------------------------------------------------------------------------
// Configurações (só admin)
// ---------------------------------------------------------------------------

export async function salvarEmpresa(_: unknown, form: FormData): Promise<Resultado | null> {
  const u = await exigirUsuario("configuracoes");
  try {
    const nome = String(form.get("nome") ?? "").trim();
    const cor = String(form.get("cor") ?? "");
    const mensagem = String(form.get("mensagem") ?? "").trim();
    const dias = Number(form.get("validade_link_dias"));
    if (nome.length < 2) throw new ErroFluxo(400, "Informe o nome da empresa.");
    if (!/^#[0-9a-fA-F]{6}$/.test(cor)) throw new ErroFluxo(400, "Cor inválida.");
    if (!mensagem.includes("{link}")) throw new ErroFluxo(400, "A mensagem precisa ter {link}.");
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) throw new ErroFluxo(400, "Validade do link entre 1 e 90 dias.");
    await (await getDb()).query(
      "update app.empresas set nome = $2, cor = $3, mensagem_whatsapp = $4, validade_link_dias = $5 where id = $1",
      [u.empresaId, nome, cor, mensagem, dias],
    );
    revalidatePath("/painel", "layout");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

function slugificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function criarUnidade(_: unknown, form: FormData): Promise<Resultado | null> {
  const u = await exigirUsuario("configuracoes");
  try {
    const nome = String(form.get("nome") ?? "").trim();
    if (nome.length < 3) throw new ErroFluxo(400, "Informe o nome da unidade.");
    const db = await getDb();
    const empresa = (await obterEmpresa(db, u.empresaId))!;
    let slug = slugificar(`${empresa.slug}-${nome}`);
    if (await um(db, "select 1 from app.unidades where slug = $1", [slug])) slug = `${slug}-${Date.now().toString(36)}`;
    await db.query("insert into app.unidades (empresa_id, nome, slug) values ($1, $2, $3)", [u.empresaId, nome, slug]);
    revalidatePath("/painel/configuracoes");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function criarUsuario(_: unknown, form: FormData): Promise<Resultado | null> {
  const u = await exigirUsuario("configuracoes");
  try {
    const nome = String(form.get("nome") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const senha = String(form.get("senha") ?? "");
    const perfil = String(form.get("perfil") ?? "");
    if (nome.length < 3) throw new ErroFluxo(400, "Informe o nome.");
    if (!z.email().safeParse(email).success) throw new ErroFluxo(400, "E-mail inválido.");
    if (senha.length < 10) throw new ErroFluxo(400, "A senha precisa ter pelo menos 10 caracteres.");
    if (!["admin", "seguranca", "portaria"].includes(perfil)) throw new ErroFluxo(400, "Escolha o perfil.");
    const db = await getDb();
    if (await um(db, "select 1 from app.usuarios where email = $1", [email])) throw new ErroFluxo(409, "Este e-mail já tem acesso.");
    await db.query("insert into app.usuarios (empresa_id, nome, email, senha_hash, perfil) values ($1, $2, $3, $4, $5)", [
      u.empresaId,
      nome,
      email,
      await gerarHashSenha(senha),
      perfil,
    ]);
    revalidatePath("/painel/configuracoes");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

// ---------------------------------------------------------------------------
// Minha conta (qualquer perfil)
// ---------------------------------------------------------------------------

export async function alterarSenha(_: unknown, form: FormData): Promise<Resultado | null> {
  const u = await exigirUsuario("conta");
  try {
    const atual = String(form.get("atual") ?? "");
    const nova = String(form.get("nova") ?? "");
    if (nova.length < 10) throw new ErroFluxo(400, "A nova senha precisa ter pelo menos 10 caracteres.");
    if (nova !== String(form.get("confirmacao") ?? "")) throw new ErroFluxo(400, "A confirmação não bate com a nova senha.");
    if (nova === atual) throw new ErroFluxo(400, "A nova senha precisa ser diferente da atual.");
    const db = await getDb();
    const registro = await um<{ senha_hash: string }>(db, "select senha_hash from app.usuarios where id = $1", [u.id]);
    if (!registro || !(await conferirSenha(atual, registro.senha_hash))) throw new ErroFluxo(400, "Senha atual incorreta.");
    await db.query("update app.usuarios set senha_hash = $2 where id = $1", [u.id, await gerarHashSenha(nova)]);
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function alternarUsuario(id: string) {
  const u = await exigirUsuario("configuracoes");
  if (id === u.id) return;
  await (await getDb()).query("update app.usuarios set ativo = not ativo where id = $1 and empresa_id = $2", [id, u.empresaId]);
  revalidatePath("/painel/configuracoes");
}
