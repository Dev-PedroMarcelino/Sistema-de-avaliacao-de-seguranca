import { describe, expect, it } from "vitest";
import { canonico, hashEvento, verificarCorrente } from "@/lib/hash";
import { cpfValido, normalizarNome, normalizarPlaca, normalizarTelefone } from "@/lib/validacao";
import { avancarProgresso, videoConcluido } from "@/lib/video";
import { embaralhar, sortearPerguntas } from "@/lib/quiz";
import { PERGUNTAS_DEMO } from "@/lib/demo/semear";

describe("validação de dados do motorista", () => {
  it("aceita CPF válido e recusa inválido", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
  it("normaliza placas antiga e Mercosul", () => {
    expect(normalizarPlaca("abc-1234")).toBe("ABC1234");
    expect(normalizarPlaca("BRA2E19")).toBe("BRA2E19");
    expect(normalizarPlaca("AB12345")).toBeNull();
  });
  it("põe o DDI 55 no telefone", () => {
    expect(normalizarTelefone("(19) 99999-1234")).toBe("5519999991234");
    expect(normalizarTelefone("123")).toBeNull();
  });
  it("arruma maiúsculas do nome", () => {
    expect(normalizarNome("  JOSÉ  da silva ")).toBe("José da Silva");
  });
});

describe("regra do vídeo (servidor)", () => {
  const inicio = new Date("2026-10-22T12:00:00Z");
  it("não deixa o progresso andar mais rápido que o relógio", () => {
    const depois = new Date(inicio.getTime() + 10_000);
    // O celular diz que está em 200 s, mas só passaram 10 s.
    expect(avancarProgresso({ progresso: 0, ultimoSinal: inicio }, 200, 300, depois)).toBe(12);
  });
  it("aceita o avanço normal", () => {
    const depois = new Date(inicio.getTime() + 10_000);
    expect(avancarProgresso({ progresso: 30, ultimoSinal: inicio }, 40, 300, depois)).toBe(40);
  });
  it("não credita tempo com o vídeo pausado (fora da tela)", () => {
    expect(avancarProgresso({ progresso: 30, ultimoSinal: null }, 290, 300, new Date())).toBe(30);
  });
  it("só conclui perto do fim", () => {
    expect(videoConcluido(297, 300)).toBe(false);
    expect(videoConcluido(298.5, 300)).toBe(true);
  });
});

describe("corrente de hash", () => {
  const eventos = () => {
    const lista: Parameters<typeof verificarCorrente>[0] = [];
    let anterior: string | null = null;
    for (let seq = 1; seq <= 4; seq++) {
      const e = {
        seq,
        tipo: `t${seq}`,
        dados: { b: seq, a: "x" },
        ocorrido_em: new Date(1_700_000_000_000 + seq * 1000),
        ip: "1.2.3.4",
        user_agent: "ua",
        hash_anterior: anterior,
      };
      const hash = hashEvento(e);
      lista.push({ ...e, hash });
      anterior = hash;
    }
    return lista;
  };
  it("JSON canônico ignora a ordem das chaves", () => {
    expect(canonico({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonico({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
  it("valida uma corrente íntegra", () => {
    expect(verificarCorrente(eventos()).valida).toBe(true);
  });
  it("detecta evento alterado", () => {
    const l = eventos();
    l[1].dados = { b: 999, a: "x" };
    expect(verificarCorrente(l)).toMatchObject({ valida: false, quebraNoSeq: 2 });
  });
  it("detecta evento removido", () => {
    const l = eventos();
    l.splice(2, 1);
    expect(verificarCorrente(l)).toMatchObject({ valida: false, quebraNoSeq: 4 });
  });
});

describe("quiz", () => {
  it("embaralha de forma estável por integração", () => {
    expect(embaralhar([1, 2, 3, 4, 5], "abc")).toEqual(embaralhar([1, 2, 3, 4, 5], "abc"));
  });
  it("sorteia do banco sem repetir e na ordem original", () => {
    const ids = sortearPerguntas(PERGUNTAS_DEMO, 3, "integracao-1");
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const ordem = PERGUNTAS_DEMO.map((p) => p.id);
    expect([...ids].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))).toEqual(ids);
  });
});
