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
import { normalizarPlaca, normalizarTelefone } from "@/lib/validacao";
import { linkWhatsApp, preencherMensagem } from "@/lib/whatsapp";
import {
  type EstadoWhatsApp,
  conectarInstancia,
  criarEnviador,
  criarInstancia,
  desconectarInstancia,
  statusInstancia,
  uazapiPodeCriarInstancia,
  whatsappConfigurado,
} from "@/lib/whatsapp-api";
import { numerosDeAlerta } from "@/lib/alertas/vencimentos";

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
// Placas e transportadoras do motorista
// ---------------------------------------------------------------------------

async function motoristaDaEmpresa(empresaId: string, motoristaId: string) {
  const db = await getDb();
  const m = await um(db, "select 1 from app.motoristas where id = $1 and empresa_id = $2", [motoristaId, empresaId]);
  if (!m) throw new ErroFluxo(404, "Motorista não encontrado.");
  return db;
}

export async function vincularPlaca(motoristaId: string, placaInformada: string): Promise<Resultado> {
  const u = await exigirUsuario("motoristas");
  try {
    const placa = normalizarPlaca(placaInformada);
    if (!placa) throw new ErroFluxo(400, "Placa inválida. Ex.: ABC1D23 ou ABC-1234.");
    const db = await motoristaDaEmpresa(u.empresaId, motoristaId);
    await db.query(
      "insert into app.motorista_placas (motorista_id, placa, origem) values ($1, $2, 'painel') on conflict do nothing",
      [motoristaId, placa],
    );
    revalidatePath("/painel/portaria");
    revalidatePath(`/painel/motoristas/${motoristaId}`);
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function removerPlaca(motoristaId: string, placa: string): Promise<Resultado> {
  const u = await exigirUsuario("motoristas");
  try {
    const db = await motoristaDaEmpresa(u.empresaId, motoristaId);
    await db.query("delete from app.motorista_placas where motorista_id = $1 and placa = $2", [motoristaId, placa]);
    revalidatePath(`/painel/motoristas/${motoristaId}`);
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function vincularTransportadora(motoristaId: string, nomeInformado: string): Promise<Resultado> {
  const u = await exigirUsuario("motoristas");
  try {
    const nome = nomeInformado.trim().replace(/\s+/g, " ");
    if (nome.length < 2) throw new ErroFluxo(400, "Informe o nome da transportadora.");
    const db = await motoristaDaEmpresa(u.empresaId, motoristaId);
    const t = (await um<{ id: string }>(
      db,
      `insert into app.transportadoras (empresa_id, nome) values ($1, $2)
       on conflict (empresa_id, lower(nome)) do update set nome = app.transportadoras.nome returning id`,
      [u.empresaId, nome],
    ))!;
    await db.query(
      "insert into app.motorista_transportadoras (motorista_id, transportadora_id, origem) values ($1, $2, 'painel') on conflict do nothing",
      [motoristaId, t.id],
    );
    revalidatePath(`/painel/motoristas/${motoristaId}`);
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

export async function removerTransportadora(motoristaId: string, transportadoraId: string): Promise<Resultado> {
  const u = await exigirUsuario("motoristas");
  try {
    const db = await motoristaDaEmpresa(u.empresaId, motoristaId);
    await db.query("delete from app.motorista_transportadoras where motorista_id = $1 and transportadora_id = $2", [
      motoristaId,
      transportadoraId,
    ]);
    revalidatePath(`/painel/motoristas/${motoristaId}`);
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

export async function salvarAlertas(_: unknown, form: FormData): Promise<Resultado | null> {
  const u = await exigirUsuario("configuracoes");
  try {
    const bruto = String(form.get("whatsapp_alertas") ?? "").trim();
    const numeros = numerosDeAlerta(bruto);
    if (bruto && numeros.length === 0) throw new ErroFluxo(400, "Número inválido. Use DDD + número, ex.: (19) 99999-1234.");
    const antecedencia = Number(form.get("aviso_antecedencia_dias") ?? 15);
    if (!Number.isInteger(antecedencia) || antecedencia < 0 || antecedencia > 90) {
      throw new ErroFluxo(400, "Antecedência entre 0 e 90 dias (0 desliga o aviso prévio).");
    }
    await (await getDb()).query(
      "update app.empresas set whatsapp_alertas = $2, aviso_antecedencia_dias = $3, avisar_motorista = $4 where id = $1",
      [u.empresaId, numeros.length ? numeros.join(",") : null, antecedencia, form.get("avisar_motorista") === "on"],
    );
    revalidatePath("/painel/configuracoes");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

const falhaWhatsApp = (e: unknown): { ok: false; erro: string } =>
  e instanceof Error && !(e instanceof ErroFluxo) ? { ok: false, erro: e.message } : falha(e);

async function tokenDaEmpresa(empresaId: string) {
  return (await um<{ whatsapp_token: string | null }>(await getDb(), "select whatsapp_token from app.empresas where id = $1", [
    empresaId,
  ]))?.whatsapp_token ?? null;
}

export async function testarAlerta(): Promise<Resultado> {
  const u = await exigirUsuario("configuracoes");
  try {
    const token = await tokenDaEmpresa(u.empresaId);
    if (!whatsappConfigurado(token)) throw new ErroFluxo(400, "Conecte antes o WhatsApp do sistema.");
    const empresa = (await obterEmpresa(await getDb(), u.empresaId))!;
    const numeros = numerosDeAlerta(empresa.whatsapp_alertas);
    if (!numeros.length) throw new ErroFluxo(400, "Salve antes o número que recebe os avisos.");
    const texto = `✅ Teste do Integra (${empresa.nome}): este número vai receber os avisos de integração vencida para barrar o motorista na portaria.`;
    const enviar = criarEnviador(token);
    for (const n of numeros) await enviar(n, texto);
    return { ok: true };
  } catch (e) {
    return falhaWhatsApp(e);
  }
}

/** Cria a instância da empresa (se ainda não houver) e devolve o QR Code para ler no celular. */
export async function conectarWhatsApp(): Promise<Resultado<{ estado: EstadoWhatsApp }>> {
  const u = await exigirUsuario("configuracoes");
  try {
    const db = await getDb();
    let token = await tokenDaEmpresa(u.empresaId);
    if (!token) {
      if (!uazapiPodeCriarInstancia()) {
        throw new ErroFluxo(400, "O servidor ainda não tem UAZAPI_URL e UAZAPI_ADMIN_TOKEN para criar a instância.");
      }
      const empresa = (await obterEmpresa(db, u.empresaId))!;
      const nome = `integra-${empresa.slug}`;
      token = await criarInstancia(nome);
      await db.query("update app.empresas set whatsapp_instancia = $2, whatsapp_token = $3 where id = $1", [u.empresaId, nome, token]);
    }
    const estado = await conectarInstancia(token);
    return { ok: true, estado };
  } catch (e) {
    return falhaWhatsApp(e);
  }
}

export async function statusWhatsApp(): Promise<Resultado<{ estado: EstadoWhatsApp | null }>> {
  const u = await exigirUsuario("configuracoes");
  try {
    const token = await tokenDaEmpresa(u.empresaId);
    return { ok: true, estado: token ? await statusInstancia(token) : null };
  } catch (e) {
    return falhaWhatsApp(e);
  }
}

export async function desconectarWhatsApp(): Promise<Resultado> {
  const u = await exigirUsuario("configuracoes");
  try {
    const token = await tokenDaEmpresa(u.empresaId);
    if (token) await desconectarInstancia(token);
    return { ok: true };
  } catch (e) {
    return falhaWhatsApp(e);
  }
}

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
