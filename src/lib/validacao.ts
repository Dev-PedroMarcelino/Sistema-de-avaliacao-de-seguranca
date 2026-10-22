export const soDigitos = (s: string) => s.replace(/\D/g, "");

export function cpfValido(entrada: string): boolean {
  const cpf = soDigitos(entrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). Devolve normalizada ou null. */
export function normalizarPlaca(entrada: string): string | null {
  const placa = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa) ? placa : null;
}

/** Celular ou fixo brasileiro com DDD; devolve com DDI 55 (ex.: 5519999991234) ou null. */
export function normalizarTelefone(entrada: string): string | null {
  let tel = soDigitos(entrada);
  if (tel.length === 10 || tel.length === 11) tel = `55${tel}`;
  return /^55[1-9][0-9][0-9]{8,9}$/.test(tel) ? tel : null;
}

export function nomeValido(nome: string): boolean {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length >= 2);
  return partes.length >= 2 && nome.trim().length <= 120;
}

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** "JOSÉ  da silva" -> "José da Silva". */
export function normalizarNome(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .map((p, i) => {
      const baixa = p.toLocaleLowerCase("pt-BR");
      if (i > 0 && MINUSCULAS.has(baixa)) return baixa;
      return baixa.charAt(0).toLocaleUpperCase("pt-BR") + baixa.slice(1);
    })
    .join(" ");
}
