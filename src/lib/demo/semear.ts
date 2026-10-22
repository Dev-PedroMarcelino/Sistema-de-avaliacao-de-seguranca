import { type Db, um } from "@/lib/db";
import { gerarHashSenha } from "@/lib/auth/senha";
import { TERMO_PADRAO, obterRascunho, publicarVersao, salvarRascunho } from "@/lib/integracao/conteudo";
import {
  type Contexto,
  type Versao,
  assinar,
  conferirNaPortaria,
  criarIntegracao,
  iniciar,
  identificar,
  obterEstado,
  responder,
  sinalVideo,
} from "@/lib/integracao/servico";
import type { Pergunta } from "@/lib/quiz";
import { assinaturaPng } from "./assinatura-png";

// Dados fictícios do modo demo, gerados pelo mesmo caminho do sistema real
// (a trilha de auditoria e os comprovantes são válidos de verdade).

export const DEMO_SENHA = process.env.DEMO_SENHA || "integra-demo";
export const USUARIOS_DEMO = [
  { email: "admin@demo.integra", nome: "Ana Ribeiro", perfil: "admin" },
  { email: "seguranca@demo.integra", nome: "Carlos Mendes", perfil: "seguranca" },
  { email: "portaria@demo.integra", nome: "Roberto Lima", perfil: "portaria" },
] as const;

export const PERGUNTAS_DEMO: Pergunta[] = [
  {
    id: "velocidade",
    texto: "Qual é a velocidade máxima dentro da área da mina?",
    alternativas: [
      { id: "a", texto: "30 km/h" },
      { id: "b", texto: "40 km/h" },
      { id: "c", texto: "60 km/h" },
      { id: "d", texto: "Não tem limite se estiver vazio" },
    ],
    correta: "a",
  },
  {
    id: "carregamento",
    texto: "Durante o carregamento, onde o motorista deve ficar?",
    alternativas: [
      { id: "a", texto: "Ao lado do caminhão, observando" },
      { id: "b", texto: "Dentro da cabine" },
      { id: "c", texto: "Em cima da carroceria" },
      { id: "d", texto: "Perto da escavadeira" },
    ],
    correta: "b",
  },
  {
    id: "sinaleiro",
    texto: "Nas frentes de lavra, quem orienta a manobra do caminhão?",
    alternativas: [
      { id: "a", texto: "Outro motorista" },
      { id: "b", texto: "O operador do britador" },
      { id: "c", texto: "O sinaleiro" },
      { id: "d", texto: "Ninguém, o motorista decide" },
    ],
    correta: "c",
  },
  {
    id: "farol",
    texto: "O que deve ficar ligado o tempo todo dentro da mina?",
    alternativas: [
      { id: "a", texto: "Pisca-alerta" },
      { id: "b", texto: "Rádio do caminhão" },
      { id: "c", texto: "Farol aceso e cinto afivelado" },
      { id: "d", texto: "Ar-condicionado" },
    ],
    correta: "c",
  },
  {
    id: "maquinas",
    texto: "Por que manter distância das máquinas pesadas?",
    alternativas: [
      { id: "a", texto: "O operador pode não enxergar o caminhão" },
      { id: "b", texto: "Para não sujar o caminhão" },
      { id: "c", texto: "Por causa do barulho" },
      { id: "d", texto: "Não é preciso manter distância" },
    ],
    correta: "a",
  },
];

const NOMES = [
  "José Carlos Pereira", "Marcos Antônio Silva", "Edson Ferreira Lima", "Valdir Souza Santos", "Reginaldo Alves",
  "Cláudio Roberto Dias", "Sebastião Gomes", "Antônio Marcos Rocha", "Luiz Fernando Costa", "Paulo Sérgio Nunes",
  "Adriano Batista", "Gilmar de Oliveira", "Wellington Moreira", "Rogério Teixeira", "João Batista Freitas",
  "Fábio Henrique Martins", "Ivanildo Barbosa", "Juliano Cardoso", "Márcio Vieira", "Osmar Ribeiro",
  "Daniel Araújo", "Rafael Lopes", "Elias Monteiro", "Valter Pinheiro", "Rodrigo Campos", "Sandro Mendes",
  "Leandro Correia", "Nilton Fonseca", "Ademir Carvalho", "Gustavo Rezende", "Moacir Duarte", "Benedito Ramos",
  "Everton Machado", "Vagner Siqueira", "Cristiano Brito", "Jair Nascimento", "Ronaldo Pires", "Silvano Cunha",
  "Derson Andrade", "Ailton Moraes", "Eduardo Prado", "Gerson Tavares",
];
const TRANSPORTADORAS = [
  "Transportes Rodoserra",
  "TransMinas Cargas",
  "Expresso Vale Verde",
  "Rápido Sorocabana",
  "LogBrita Transportes",
];
const APARELHOS = [
  "Mozilla/5.0 (Linux; Android 13; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; moto g54 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36",
];

function sorteador(semente: number) {
  let a = semente;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    int: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    item: <T>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)],
  };
}

function gerarCpf(s: ReturnType<typeof sorteador>) {
  const n = Array.from({ length: 9 }, () => s.int(0, 9));
  const dv = (base: number[]) => {
    const soma = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join("");
}

function gerarPlaca(s: ReturnType<typeof sorteador>) {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = () => L[s.int(0, 25)];
  return `${l()}${l()}${l()}${s.int(0, 9)}${l()}${s.int(0, 9)}${s.int(0, 9)}`;
}

const DIA = 86_400_000;
const seg = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

type Ate = "gerado" | "aberto" | "video" | "quiz" | "concluida";

export async function semearDemo(db: Db, agora = new Date()) {
  const s = sorteador(20261022);

  const empresa = (await um<{ id: string }>(
    db,
    `insert into app.empresas (nome, slug, cor) values ('Mineração Demo', 'demo', '#f59e0b') returning id`,
  ))!;
  const unidades = await db.query<{ id: string; nome: string }>(
    `insert into app.unidades (empresa_id, nome, slug) values
       ($1, 'Unidade Serra Azul', 'serra-azul'), ($1, 'Unidade Vale do Rio', 'vale-do-rio')
     returning id, nome`,
    [empresa.id],
  );
  const senha = await gerarHashSenha(DEMO_SENHA);
  const usuarios: Record<string, { id: string; nome: string; empresaId: string }> = {};
  for (const u of USUARIOS_DEMO) {
    const criado = (await um<{ id: string }>(
      db,
      "insert into app.usuarios (empresa_id, nome, email, senha_hash, perfil) values ($1, $2, $3, $4, $5) returning id",
      [empresa.id, u.nome, u.email, senha, u.perfil],
    ))!;
    usuarios[u.perfil] = { id: criado.id, nome: u.nome, empresaId: empresa.id };
  }
  const treinamento = (await um<{ id: string }>(
    db,
    `insert into app.treinamentos (empresa_id, titulo, validade_dias, criado_em)
     values ($1, 'Integração de segurança para motoristas externos', 365, $2::timestamptz) returning id`,
    [empresa.id, new Date(agora.getTime() - 430 * DIA).toISOString()],
  ))!;

  const conteudoBase = {
    video_url: "/demo/video/master.m3u8",
    legenda_url: "/demo/legenda.vtt",
    duracao_seg: 48,
    termo: TERMO_PADRAO,
  };

  // Versão 1: as 3 primeiras perguntas, todas obrigatórias.
  const v1 = await obterRascunho(db, treinamento.id);
  await salvarRascunho(db, v1, { ...conteudoBase, perguntas: PERGUNTAS_DEMO.slice(0, 3), perguntas_por_integracao: null });
  await publicarVersao(db, v1, { usuarioId: usuarios.admin.id, invalidaAnteriores: false, agora: new Date(agora.getTime() - 420 * DIA) });

  const ctx = (quando: Date, aparelho: string, ip: string): Contexto => ({ db, agora: quando, ip, userAgent: aparelho });
  let indiceNome = 0;
  const motoristas: { nome: string; cpf: string; telefone: string; placa: string; transportadora: string }[] = [];
  const novoMotorista = () => {
    const m = {
      nome: NOMES[indiceNome++ % NOMES.length],
      cpf: gerarCpf(s),
      telefone: `55${s.item(["15", "11", "19", "14"])}9${s.int(10000000, 99999999)}`,
      placa: gerarPlaca(s),
      transportadora: s.item(TRANSPORTADORAS),
    };
    motoristas.push(m);
    return m;
  };

  async function simular(quando: Date, ate: Ate, m = novoMotorista()) {
    const aparelho = s.item(APARELHOS);
    const ip = `177.${s.int(16, 200)}.${s.int(0, 255)}.${s.int(1, 254)}`;
    const origem = s.r() < 0.3 ? "qr" : "link";
    const unidade = s.r() < 0.7 ? unidades[0] : unidades[1];
    const criadoEm = origem === "qr" ? quando : new Date(quando.getTime() - s.int(1, 30) * 3_600_000);
    const { id, token } = await criarIntegracao(ctx(criadoEm, origem === "qr" ? aparelho : "Painel", "10.0.0.5"), {
      unidadeId: unidade.id,
      origem,
      telefone: m.telefone,
      nome: m.nome,
      transportadora: origem === "link" ? m.transportadora : null,
      criadoPor: origem === "link" ? s.item([usuarios.seguranca, usuarios.portaria]) : null,
    });
    if (ate === "gerado") return id;
    let t = quando;
    await obterEstado(ctx(t, aparelho, ip), token);
    if (ate === "aberto") return id;
    t = seg(t, s.int(15, 40));
    await iniciar(ctx(t, aparelho, ip), token, { veiculoParado: true });
    t = seg(t, s.int(40, 90));
    await identificar(ctx(t, aparelho, ip), token, {
      nome: m.nome,
      cpf: m.cpf,
      placa: m.placa,
      transportadora: m.transportadora,
      aceitePrivacidade: true,
    });

    t = seg(t, 5);
    await sinalVideo(ctx(t, aparelho, ip), token, { acao: "play", posicao: 0 });
    const saiuEm = s.r() < 0.35 ? s.int(1, 3) * 10 : -1;
    for (let p = 10; p < 48; p += 10) {
      t = seg(t, 10);
      await sinalVideo(ctx(t, aparelho, ip), token, { acao: "progresso", posicao: p });
      if (p === saiuEm) {
        await sinalVideo(ctx(seg(t, 1), aparelho, ip), token, { acao: "pausa", posicao: p, motivo: "tela" });
        t = seg(t, s.int(20, 90));
        await sinalVideo(ctx(t, aparelho, ip), token, { acao: "play", posicao: p });
      }
      if (ate === "video" && p >= 20) return id;
    }
    t = seg(t, 8.5);
    await sinalVideo(ctx(t, aparelho, ip), token, { acao: "fim", posicao: 48 });

    const versao = (await um<Versao>(
      db,
      "select v.* from app.versoes v join app.integracoes i on i.versao_id = v.id where i.id = $1",
      [id],
    ))!;
    for (let q = 0; q < 5; q++) {
      const estado = await obterEstado(ctx(t, aparelho, ip), token);
      if (estado.etapa !== "quiz" || !("pergunta" in estado)) break;
      const p = versao.perguntas.find((x) => x.id === estado.pergunta.id)!;
      if (s.r() < 0.25) {
        t = seg(t, s.int(6, 15));
        const errada = p.alternativas.find((a) => a.id !== p.correta)!;
        await responder(ctx(t, aparelho, ip), token, { perguntaId: p.id, alternativaId: errada.id });
      }
      if (ate === "quiz" && q === 1) return id;
      t = seg(t, s.int(6, 20));
      await responder(ctx(t, aparelho, ip), token, { perguntaId: p.id, alternativaId: p.correta });
    }
    t = seg(t, s.int(20, 60));
    await assinar(ctx(t, aparelho, ip), token, { imagem: assinaturaPng(s.int(1, 1000)) });
    if (s.r() < 0.5) {
      await conferirNaPortaria(ctx(seg(t, s.int(300, 1800)), "Painel", "10.0.0.5"), id, usuarios.portaria);
    }
    return id;
  }

  const diaUtil = (diasAtras: number) => {
    const d = new Date(agora.getTime() - diasAtras * DIA);
    d.setUTCHours(s.int(9, 20), s.int(0, 59), s.int(0, 59), 0); // 6h às 17h em Brasília
    return d;
  };

  // Integrações antigas, feitas na versão 1: algumas vencidas, outras vencendo.
  for (const dias of [400, 392, 385]) await simular(diaUtil(dias), "concluida");
  for (const dias of [358, 352, 347, 341]) await simular(diaUtil(dias), "concluida");

  // Versão 2: banco de 5 perguntas, sorteia 3 por motorista.
  const v2 = await obterRascunho(db, treinamento.id);
  await salvarRascunho(db, v2, { ...conteudoBase, perguntas: PERGUNTAS_DEMO, perguntas_por_integracao: 3 });
  await publicarVersao(db, v2, { usuarioId: usuarios.seguranca.id, invalidaAnteriores: false, agora: new Date(agora.getTime() - 120 * DIA) });

  for (let k = 0; k < 30; k++) await simular(diaUtil(s.int(1, 60)), "concluida");
  // Um motorista com integração vencida que refez agora.
  await simular(diaUtil(2), "concluida", motoristas[0]);
  // Hoje.
  for (let k = 0; k < 3; k++) {
    const hoje = new Date(agora.getTime() - s.int(20, 240) * 60_000);
    await simular(hoje, "concluida");
  }
  // Pendentes: link enviado sem abrir, parados no vídeo e no quiz, e um link expirado.
  await simular(new Date(agora.getTime() - 3 * 3_600_000), "gerado");
  await simular(new Date(agora.getTime() - 26 * 3_600_000), "gerado");
  await simular(new Date(agora.getTime() - 50 * 60_000), "aberto");
  await simular(new Date(agora.getTime() - 2 * DIA), "video");
  await simular(new Date(agora.getTime() - 90 * 60_000), "quiz");
  await simular(new Date(agora.getTime() - 20 * DIA), "gerado");

  // Rascunho da próxima versão, para mostrar o editor.
  await obterRascunho(db, treinamento.id);
  return { empresaId: empresa.id };
}

export async function semearSeVazio(db: Db) {
  const existe = await um(db, "select 1 from app.empresas limit 1");
  if (!existe) await semearDemo(db);
}
