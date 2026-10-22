/** Folga para atrasos de rede e arredondamento do player, em segundos. */
export const FOLGA_SEG = 2;
/** Intervalo dos sinais do player. */
export const SINAL_A_CADA_MS = 10_000;

/**
 * Novo progresso validado pelo servidor.
 * O progresso nunca avança mais do que o tempo real passado desde o último sinal,
 * então "pular" o vídeo pelo navegador não adianta.
 */
export function avancarProgresso(
  atual: { progresso: number; ultimoSinal: Date | null },
  posicaoInformada: number,
  duracao: number,
  agora: Date,
): number {
  if (!atual.ultimoSinal) return atual.progresso;
  const decorrido = Math.max(0, (agora.getTime() - atual.ultimoSinal.getTime()) / 1000);
  const teto = atual.progresso + decorrido + FOLGA_SEG;
  const novo = Math.min(Math.max(0, posicaoInformada), teto, duracao);
  return Math.round(Math.max(atual.progresso, novo) * 10) / 10;
}

export function videoConcluido(progresso: number, duracao: number): boolean {
  return duracao > 0 && progresso >= duracao - FOLGA_SEG;
}
