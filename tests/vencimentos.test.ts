import { beforeAll, describe, expect, it } from "vitest";
import { type Db, aplicarMigracoes, criarPglite, um } from "@/lib/db";
import { semearDemo } from "@/lib/demo/semear";
import { verificarCorrente } from "@/lib/hash";
import { listarEventos } from "@/lib/integracao/servico";
import { mensagemVencimento, numerosDeAlerta, processarVencimentos } from "@/lib/alertas/vencimentos";

const AGORA = new Date("2026-10-22T12:00:00Z");
let db: Db;

beforeAll(async () => {
  db = await criarPglite();
  await aplicarMigracoes(db);
  await semearDemo(db, AGORA);
  await db.query("update app.empresas set whatsapp_alertas = '5519999991234'");
});

describe("aviso de integração vencida", () => {
  it("entende os números digitados", () => {
    expect(numerosDeAlerta("(19) 99999-1234; 11 98888-7777, lixo, 19999991234")).toEqual(["5519999991234", "5511988887777"]);
    expect(numerosDeAlerta(null)).toEqual([]);
  });

  it("monta a mensagem com CPF mascarado", () => {
    const m = mensagemVencimento({
      empresa: "Mineração X",
      nome: "José Silva",
      cpf: "52998224725",
      placa: "ABC1234",
      transportadora: "Transp",
      vigenteAte: AGORA,
      urlPortaria: "https://x/painel/portaria?q=ABC1234",
    });
    expect(m).toContain("529.***.***-25");
    expect(m).toContain("ABC-1234");
    expect(m).not.toContain("52998224725");
  });

  it("avisa uma vez cada vencido recente e ignora quem já refez", async () => {
    const enviados: string[] = [];
    const r = await processarVencimentos(db, { agora: AGORA, enviar: async (n, t) => void enviados.push(`${n}|${t}`) });
    // A demo tem vencidos há 35, 27 e 20 dias; o de 35 dias está fora da janela e já refez.
    expect(r).toEqual({ enviados: 2, erros: 0 });
    expect(enviados.every((e) => e.startsWith("5519999991234|"))).toBe(true);

    const deNovo = await processarVencimentos(db, { agora: AGORA, enviar: async () => void enviados.push("x") });
    expect(deNovo).toEqual({ enviados: 0, erros: 0 });
    expect(enviados).toHaveLength(2);
  });

  it("registra o aviso na trilha sem quebrar a corrente", async () => {
    const a = (await um<{ integracao_id: string }>(
      db,
      "select c.integracao_id from app.alertas_vencimento a join app.comprovantes c on c.id = a.comprovante_id limit 1",
    ))!;
    const eventos = await listarEventos(db, a.integracao_id);
    expect(eventos.at(-1)?.tipo).toBe("vencimento_avisado");
    expect(verificarCorrente(eventos).valida).toBe(true);
  });

  it("falha no envio fica para nova tentativa", async () => {
    const depois = new Date(AGORA.getTime() + 20 * 86_400_000); // vencem os da demo que estavam "vencendo"
    const falha = await processarVencimentos(db, {
      agora: depois,
      enviar: async () => {
        throw new Error("fora do ar");
      },
    });
    expect(falha.erros).toBeGreaterThan(0);
    const ok = await processarVencimentos(db, { agora: depois, enviar: async () => {} });
    expect(ok.enviados).toBe(falha.erros);
  });
});
