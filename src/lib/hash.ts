import { createHash } from "node:crypto";

/** JSON com chaves ordenadas: o mesmo objeto sempre gera o mesmo texto (o jsonb do Postgres reordena chaves). */
export function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (typeof valor !== "object") return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map((v) => canonico(v)).join(",")}]`;
  const obj = valor as Record<string, unknown>;
  const partes = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonico(obj[k])}`);
  return `{${partes.join(",")}}`;
}

export function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

export interface EventoParaHash {
  seq: number;
  tipo: string;
  dados: unknown;
  ocorrido_em: Date;
  ip: string | null;
  user_agent: string | null;
  hash_anterior: string | null;
}

export const GENESIS = "GENESIS";

export function hashEvento(e: EventoParaHash): string {
  return sha256(
    [
      e.hash_anterior ?? GENESIS,
      e.seq,
      e.tipo,
      canonico(e.dados),
      e.ocorrido_em.toISOString(),
      e.ip ?? "",
      e.user_agent ?? "",
    ].join("|"),
  );
}

export type ResultadoCorrente =
  | { valida: true; ultimoHash: string | null; total: number }
  | { valida: false; quebraNoSeq: number; motivo: string };

/** Recalcula a corrente inteira. Evento alterado, removido ou fora de ordem é detectado. */
export function verificarCorrente(eventos: (EventoParaHash & { hash: string })[]): ResultadoCorrente {
  let anterior: string | null = null;
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    if (e.seq !== i + 1) {
      return { valida: false, quebraNoSeq: e.seq, motivo: "sequência com falha (evento removido ou fora de ordem)" };
    }
    if (e.hash_anterior !== anterior) {
      return { valida: false, quebraNoSeq: e.seq, motivo: "elo com o evento anterior não confere" };
    }
    if (hashEvento(e) !== e.hash) {
      return { valida: false, quebraNoSeq: e.seq, motivo: "conteúdo do evento foi alterado" };
    }
    anterior = e.hash;
  }
  return { valida: true, ultimoHash: anterior, total: eventos.length };
}

export function hashComprovante(dados: unknown, hashCorrente: string): string {
  return sha256(`${canonico(dados)}|${hashCorrente}`);
}
