import { data, diaLocal } from "@/lib/formato";
import type { FiltroRelatorio, SituacaoMotorista } from "./consultas";

export const NOME_SITUACAO: Record<SituacaoMotorista, string> = {
  valida: "Válida",
  vencendo: "Vencendo",
  vencida: "Vencida",
  pendente: "Pendente",
};

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros da URL, com padrão dos últimos 30 dias. */
export function filtroDaUrl(p: URLSearchParams | Record<string, string | undefined>): FiltroRelatorio {
  const ler = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k]) ?? "";
  const hoje = new Date();
  const de = ler("de");
  const ate = ler("ate");
  return {
    de: DIA_VALIDO.test(de) ? de : diaLocal(new Date(hoje.getTime() - 30 * 86_400_000)),
    ate: DIA_VALIDO.test(ate) ? ate : diaLocal(hoje),
    unidadeId: ler("unidade"),
    transportadora: ler("transportadora"),
    situacao: ler("situacao"),
  };
}

export function descreverFiltro(f: FiltroRelatorio, unidade?: string) {
  const partes = [`De ${data(`${f.de}T12:00:00-03:00`)} a ${data(`${f.ate}T12:00:00-03:00`)}`];
  if (unidade) partes.push(unidade);
  if (f.transportadora) partes.push(f.transportadora);
  if (f.situacao) partes.push(NOME_SITUACAO[f.situacao as SituacaoMotorista] ?? f.situacao);
  return partes.join(" · ");
}

export function consultaDoFiltro(f: FiltroRelatorio) {
  const q = new URLSearchParams({ de: f.de, ate: f.ate });
  if (f.unidadeId) q.set("unidade", f.unidadeId);
  if (f.transportadora) q.set("transportadora", f.transportadora);
  if (f.situacao) q.set("situacao", f.situacao);
  return q.toString();
}
