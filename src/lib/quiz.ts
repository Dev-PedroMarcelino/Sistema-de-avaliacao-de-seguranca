export interface Alternativa {
  id: string;
  texto: string;
}

export interface Pergunta {
  id: string;
  texto: string;
  alternativas: Alternativa[];
  correta: string;
}

/** Espera depois de um erro antes de poder responder de novo (desestimula o chute). */
export const ESPERA_APOS_ERRO_MS = 3000;

function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function aleatorio(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralhamento determinístico: a mesma integração vê sempre a mesma ordem, mesmo recarregando. */
export function embaralhar<T>(itens: readonly T[], chave: string): T[] {
  const r = aleatorio(semente(chave));
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Perguntas desta integração: todas na ordem, ou um sorteio quando o banco tem mais perguntas que o necessário. */
export function sortearPerguntas(perguntas: Pergunta[], quantidade: number | null, chave: string): string[] {
  const ids = perguntas.map((p) => p.id);
  if (!quantidade || quantidade >= ids.length) return ids;
  const escolhidas = new Set(embaralhar(ids, `${chave}:sorteio`).slice(0, quantidade));
  return ids.filter((id) => escolhidas.has(id));
}

/** Pergunta como vai para o celular: sem a resposta certa e com as alternativas embaralhadas. */
export function perguntaPublica(p: Pergunta, chave: string) {
  return { id: p.id, texto: p.texto, alternativas: embaralhar(p.alternativas, `${chave}:${p.id}`) };
}

export function validarPerguntas(perguntas: Pergunta[]): string | null {
  if (perguntas.length === 0) return "Cadastre ao menos uma pergunta.";
  for (const [i, p] of perguntas.entries()) {
    if (!p.texto.trim()) return `A pergunta ${i + 1} está sem texto.`;
    if (p.alternativas.length < 2) return `A pergunta ${i + 1} precisa de pelo menos 2 alternativas.`;
    if (p.alternativas.some((a) => !a.texto.trim())) return `A pergunta ${i + 1} tem alternativa vazia.`;
    if (!p.alternativas.some((a) => a.id === p.correta)) return `Marque a alternativa certa da pergunta ${i + 1}.`;
  }
  return null;
}
