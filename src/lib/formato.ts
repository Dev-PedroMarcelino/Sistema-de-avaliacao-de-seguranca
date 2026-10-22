const FUSO = "America/Sao_Paulo";

export function dataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "medium" });
}

export function data(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function hora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function cpf(c: string): string {
  return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** CPF com o meio escondido, para listas (LGPD). */
export function cpfMascarado(c: string): string {
  return c.replace(/^(\d{3})\d{6}(\d{2})$/, "$1.***.***-$2");
}

export function telefone(t: string): string {
  const local = t.startsWith("55") ? t.slice(2) : t;
  return local.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
}

export function placa(p: string | null | undefined): string {
  if (!p) return "—";
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function duracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

/** Dia (AAAA-MM-DD) no fuso de São Paulo. */
export function diaLocal(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}
