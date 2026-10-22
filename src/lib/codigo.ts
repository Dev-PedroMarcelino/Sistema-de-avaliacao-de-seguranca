import { randomBytes } from "node:crypto";

// Sem 0/O, 1/I/L e U: fácil de ditar e digitar na portaria.
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Código do comprovante, ex.: K7M2-9QX4. */
export function codigoComprovante(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizarCodigo(entrada: string): string {
  const s = entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

/** Token do link do motorista: 128 bits, impossível de adivinhar. */
export function tokenLink(): string {
  return randomBytes(16).toString("base64url");
}
