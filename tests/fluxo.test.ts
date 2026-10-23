import { beforeAll, describe, expect, it } from "vitest";
import { type Db, aplicarMigracoes, criarPglite, um } from "@/lib/db";
import { semearDemo } from "@/lib/demo/semear";
import { assinaturaPng } from "@/lib/demo/assinatura-png";
import {
  type Contexto,
  type Versao,
  ErroFluxo,
  assinar,
  criarIntegracao,
  iniciar,
  identificar,
  obterEstado,
  responder,
  sinalVideo,
  verificarComprovante,
} from "@/lib/integracao/servico";

let db: Db;
let unidadeId: string;
const T0 = new Date("2026-10-22T13:00:00Z");
const em = (s: number): Contexto => ({ db, agora: new Date(T0.getTime() + s * 1000), ip: "200.1.2.3", userAgent: "Teste/1.0" });

beforeAll(async () => {
  db = await criarPglite();
  await aplicarMigracoes(db);
  await semearDemo(db, new Date("2026-10-22T12:00:00Z"));
  unidadeId = (await um<{ id: string }>(db, "select id from app.unidades where slug = 'serra-azul'"))!.id;
});

async function novaIntegracao() {
  return criarIntegracao(em(0), { unidadeId, origem: "link", telefone: "5519988887777", nome: "teste da silva" });
}

describe("fluxo completo do motorista", () => {
  it("leva do link ao comprovante verificável", async () => {
    const { token } = await novaIntegracao();
    expect((await obterEstado(em(1), token)).etapa).toBe("boas_vindas");
    await iniciar(em(5), token, { veiculoParado: true });
    const estado = await identificar(em(30), token, {
      nome: "Teste da Silva",
      cpf: "529.982.247-25",
      placa: "ABC1D23",
      transportadora: "Transportes Teste",
      aceitePrivacidade: true,
    });
    expect(estado.etapa).toBe("video");

    // Não dá para pular o vídeo: o servidor recusa o fim antes da hora.
    await sinalVideo(em(40), token, { acao: "play", posicao: 0 });
    const pulo = await sinalVideo(em(45), token, { acao: "fim", posicao: 48 });
    expect(pulo.concluido).toBe(false);
    expect(pulo.progresso).toBeLessThan(10);

    // Perguntas bloqueadas enquanto o vídeo não termina.
    await expect(responder(em(46), token, { perguntaId: "x", alternativaId: "a" })).rejects.toBeInstanceOf(ErroFluxo);

    // Saiu da tela: o tempo fora não conta.
    await sinalVideo(em(50), token, { acao: "pausa", posicao: 10, motivo: "tela" });
    await sinalVideo(em(500), token, { acao: "play", posicao: 10 });
    for (let s = 510; s <= 550; s += 10) await sinalVideo(em(s), token, { acao: "progresso", posicao: s - 500 + 10 });
    const fim = await sinalVideo(em(549), token, { acao: "fim", posicao: 48 });
    expect(fim.concluido).toBe(true);

    const integ = (await um<{ id: string; saidas_tela: number }>(
      db,
      "select id, saidas_tela from app.integracoes where token = $1",
      [token],
    ))!;
    expect(integ.saidas_tela).toBe(1);
    const versao = (await um<Versao>(
      db,
      "select v.* from app.versoes v join app.integracoes i on i.versao_id = v.id where i.token = $1",
      [token],
    ))!;

    // Quiz: errar mantém na mesma pergunta; responder logo depois do erro é bloqueado.
    let t = 560;
    let primeira = true;
    for (;;) {
      const e = await obterEstado(em(t), token);
      if (e.etapa !== "quiz" || !("pergunta" in e)) break;
      const p = versao.perguntas.find((x) => x.id === e.pergunta.id)!;
      expect(JSON.stringify(e.pergunta)).not.toContain("correta");
      if (primeira) {
        const errada = p.alternativas.find((a) => a.id !== p.correta)!;
        expect((await responder(em(t), token, { perguntaId: p.id, alternativaId: errada.id })).correta).toBe(false);
        await expect(responder(em(t + 1), token, { perguntaId: p.id, alternativaId: p.correta })).rejects.toMatchObject({
          status: 429,
        });
        const mesma = await obterEstado(em(t + 2), token);
        expect("pergunta" in mesma && mesma.pergunta.id).toBe(p.id);
        t += 5;
        primeira = false;
      }
      expect((await responder(em(t), token, { perguntaId: p.id, alternativaId: p.correta })).correta).toBe(true);
      t += 10;
    }

    const final = await assinar(em(t + 30), token, { imagem: assinaturaPng(7) });
    expect(final.etapa).toBe("concluida");
    const codigo = "comprovante" in final ? final.comprovante.codigo : "";
    const v = await verificarComprovante(db, codigo, new Date(T0.getTime() + 3600_000));
    expect(v?.autentico).toBe(true);
    expect(v?.vigente).toBe(true);
    expect(v?.comprovante.dados.perguntas[0].tentativas).toBe(2);
    expect(v?.comprovante.dados.video.saidas_tela).toBe(1);

    // Um novo link para o mesmo CPF reconhece a integração ainda válida.
    const outro = await novaIntegracao();
    await obterEstado(em(t + 100), outro.token);
    await iniciar(em(t + 101), outro.token, { veiculoParado: true });
    const jaValida = await identificar(em(t + 120), outro.token, {
      nome: "Teste da Silva",
      cpf: "52998224725",
      placa: "ABC1D23",
      transportadora: "transportes teste",
      aceitePrivacidade: true,
    });
    expect(jaValida.etapa).toBe("ja_valida");
  });
});

describe("placa e transportadora opcionais", () => {
  it("identifica só com nome e CPF, e o termo diz 'não informada'", async () => {
    const { token } = await novaIntegracao();
    await obterEstado(em(1), token);
    await iniciar(em(2), token, { veiculoParado: true });
    const e = await identificar(em(3), token, { nome: "Sem Placa Souza", cpf: "11144477735", aceitePrivacidade: true });
    expect(e.etapa).toBe("video");
    const i = (await um<{ placa: string | null; transportadora_id: string | null }>(
      db,
      "select placa, transportadora_id from app.integracoes where token = $1",
      [token],
    ))!;
    expect(i).toEqual({ placa: null, transportadora_id: null });
    await expect(
      identificar(em(4), (await novaIntegracao()).token, { nome: "X Y", cpf: "11144477735", placa: "123", aceitePrivacidade: true }),
    ).rejects.toThrow();
  });
});

describe("várias placas e transportadoras por motorista", () => {
  it("acumula no cadastro e a portaria acha o motorista por qualquer placa", async () => {
    const { buscarNaPortaria } = await import("@/lib/painel/consultas");
    const cpf = "39053344705";
    for (const [placa, transportadora] of [
      ["AAA1A11", "Transp Um"],
      ["BBB2B22", "Transp Dois"],
    ]) {
      const { token } = await novaIntegracao();
      await obterEstado(em(1), token);
      await iniciar(em(2), token, { veiculoParado: true });
      await identificar(em(3), token, { nome: "Varias Placas Lima", cpf, placa, transportadora, aceitePrivacidade: true });
    }
    const m = (await um<{ id: string; empresa_id: string }>(db, "select id, empresa_id from app.motoristas where cpf = $1", [cpf]))!;
    const placas = await db.query<{ placa: string }>("select placa from app.motorista_placas where motorista_id = $1 order by placa", [m.id]);
    expect(placas.map((p) => p.placa)).toEqual(["AAA1A11", "BBB2B22"]);
    const transp = await db.query("select 1 from app.motorista_transportadoras where motorista_id = $1", [m.id]);
    expect(transp).toHaveLength(2);
    for (const placa of ["AAA1A11", "BBB2B22"]) {
      const achados = await buscarNaPortaria(db, m.empresa_id, placa);
      expect(achados.map((a) => a.motorista_id)).toContain(m.id);
    }
    expect(await buscarNaPortaria(db, m.empresa_id, "ZZZ9Z99")).toHaveLength(0);
  });
});

describe("registros de prova", () => {
  it("o banco recusa alterar ou apagar eventos", async () => {
    await expect(db.query("update app.eventos set tipo = 'x'")).rejects.toThrow(/não pode ser alterado/);
    await expect(db.query("delete from app.respostas")).rejects.toThrow(/não pode ser alterado/);
  });

  it("versão publicada não pode ser editada", async () => {
    await expect(db.query("update app.versoes set termo = 'x' where publicada_em is not null")).rejects.toThrow(/publicada/);
  });

  it("a verificação detecta adulteração feita direto no banco", async () => {
    const c = (await um<{ codigo: string; integracao_id: string }>(
      db,
      "select codigo, integracao_id from app.comprovantes order by emitido_em desc limit 1",
    ))!;
    expect((await verificarComprovante(db, c.codigo))?.autentico).toBe(true);
    // Simula alguém com acesso de administrador desligando a trava e mudando uma resposta.
    await db.exec("alter table app.eventos disable trigger eventos_imutaveis");
    await db.query(
      "update app.eventos set dados = jsonb_set(dados, '{correta}', 'true') where integracao_id = $1 and tipo = 'resposta'",
      [c.integracao_id],
    );
    await db.exec("alter table app.eventos enable trigger eventos_imutaveis");
    const depois = await verificarComprovante(db, c.codigo);
    expect(depois?.autentico).toBe(false);
  });

  it("o modo demo gera comprovantes íntegros", async () => {
    const codigos = await db.query<{ codigo: string }>("select codigo from app.comprovantes order by emitido_em limit 5");
    for (const { codigo } of codigos) expect((await verificarComprovante(db, codigo))?.autentico).toBe(true);
  });
});
