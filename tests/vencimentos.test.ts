import { beforeAll, describe, expect, it } from "vitest";
import { type Db, aplicarMigracoes, criarPglite, um } from "@/lib/db";
import { semearDemo } from "@/lib/demo/semear";
import { verificarCorrente } from "@/lib/hash";
import { listarEventos } from "@/lib/integracao/servico";
import { mensagemAntecedencia, mensagemVencimento, numerosDeAlerta, processarVencimentos } from "@/lib/alertas/vencimentos";

const AGORA = new Date("2026-10-22T12:00:00Z");
const ALERTA = "5519999991234";
let db: Db;

beforeAll(async () => {
  db = await criarPglite();
  await aplicarMigracoes(db);
  await semearDemo(db, AGORA);
  await db.query("update app.empresas set whatsapp_alertas = $1, avisar_motorista = true", [ALERTA]);
});

const dados = {
  empresa: "Mineração X",
  nome: "José Silva",
  cpf: "52998224725",
  placa: "ABC1234",
  transportadora: "Transp",
  vigenteAte: AGORA,
  urlPortaria: "https://x/painel/portaria?q=ABC1234",
};

describe("avisos de vencimento", () => {
  it("entende os números digitados", () => {
    expect(numerosDeAlerta("(19) 99999-1234; 11 98888-7777, lixo, 19999991234")).toEqual(["5519999991234", "5511988887777"]);
    expect(numerosDeAlerta(null)).toEqual([]);
  });

  it("monta as mensagens com CPF mascarado e dias que faltam", () => {
    const m = mensagemVencimento(dados);
    expect(m).toContain("529.***.***-25");
    expect(m).not.toContain("52998224725");
    const p = mensagemAntecedencia({ ...dados, vigenteAte: new Date(AGORA.getTime() + 15 * 86_400_000) }, AGORA);
    expect(p).toContain("vence em 15 dias");
  });

  it("avisa vencidos e quem vence em 15 dias, uma vez só, e manda o link ao motorista", async () => {
    const enviados: { numero: string; texto: string }[] = [];
    const r = await processarVencimentos(db, {
      agora: AGORA,
      urlBase: "https://integra.test",
      enviador: () => async (numero, texto) => void enviados.push({ numero, texto }),
    });
    // Demo: vencidos há 27 e 20 dias (o de 35 dias já refez) + vencendo em 7 e 13 dias.
    expect(r).toEqual({ enviados: 4, erros: 0 });
    const paraPortaria = enviados.filter((e) => e.numero === ALERTA);
    expect(paraPortaria.filter((e) => e.texto.includes("vencida"))).toHaveLength(2);
    expect(paraPortaria.filter((e) => e.texto.includes("vence em"))).toHaveLength(2);
    const paraMotoristas = enviados.filter((e) => e.numero !== ALERTA);
    expect(paraMotoristas).toHaveLength(2);
    expect(paraMotoristas.every((e) => /https:\/\/integra\.test\/i\/[\w-]+/.test(e.texto))).toBe(true);

    const deNovo = await processarVencimentos(db, { agora: AGORA, enviador: () => async () => void enviados.push({ numero: "x", texto: "" }) });
    expect(deNovo).toEqual({ enviados: 0, erros: 0 });
  });

  it("registra o aviso na trilha sem quebrar a corrente", async () => {
    const a = (await um<{ integracao_id: string }>(
      db,
      "select c.integracao_id from app.alertas_vencimento a join app.comprovantes c on c.id = a.comprovante_id where a.tipo = 'vencimento' limit 1",
    ))!;
    const eventos = await listarEventos(db, a.integracao_id);
    expect(eventos.at(-1)?.tipo).toBe("vencimento_avisado");
    expect(verificarCorrente(eventos).valida).toBe(true);
  });

  it("com antecedência 0 não há aviso prévio; falha no envio fica para nova tentativa", async () => {
    await db.query("update app.empresas set aviso_antecedencia_dias = 0, avisar_motorista = false");
    const depois = new Date(AGORA.getTime() + 20 * 86_400_000);
    const falha = await processarVencimentos(db, {
      agora: depois,
      enviador: () => async () => {
        throw new Error("fora do ar");
      },
    });
    expect(falha.erros).toBeGreaterThan(0);
    const tipos = await db.query<{ tipo: string }>("select distinct tipo from app.alertas_vencimento where status = 'erro'");
    expect(tipos.map((t) => t.tipo)).toEqual(["vencimento"]);
    const ok = await processarVencimentos(db, { agora: depois, enviador: () => async () => {} });
    expect(ok.enviados).toBe(falha.erros);
  });
});
