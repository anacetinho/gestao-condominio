import { ModoRateio } from "@/lib/constants";

export interface FracaoMin {
  id: string;
  permilagem: number;
}

export interface ImputacaoCalculada {
  fracaoId: string;
  valorPorPrestacaoCents: number;
}

/**
 * Distribui `valorTotalCents` por N frações em M prestações.
 *
 * Regras:
 * - Modo IGUAL: divide igualmente por fração (resto distribuído pelas primeiras frações).
 * - Modo PERMILAGEM: usa permilagem (somam 1000), com correcção do resto na última fração.
 *
 * Devolve o valor *por prestação* (já dividido por numeroMeses).
 * O resto entre meses é distribuído pelas primeiras prestações.
 */
export function calcularImputacaoPorFracao(
  valorTotalCents: number,
  fracoes: FracaoMin[],
  modo: ModoRateio,
): { fracaoId: string; valorTotalCents: number }[] {
  if (valorTotalCents <= 0) throw new Error("valorTotalCents tem de ser > 0");
  if (fracoes.length === 0) throw new Error("é preciso pelo menos 1 fracção");

  if (modo === ModoRateio.IGUAL) {
    const base = Math.floor(valorTotalCents / fracoes.length);
    const resto = valorTotalCents - base * fracoes.length;
    return fracoes.map((f, i) => ({
      fracaoId: f.id,
      valorTotalCents: base + (i < resto ? 1 : 0),
    }));
  }

  // PERMILAGEM
  const totalPermilagem = fracoes.reduce((s, f) => s + f.permilagem, 0);
  if (totalPermilagem !== 1000) {
    throw new Error(`Permilagens têm de somar 1000 (actual: ${totalPermilagem})`);
  }
  let acumulado = 0;
  const result = fracoes.map((f, i) => {
    if (i === fracoes.length - 1) {
      // Última fração absorve o resto para garantir soma exacta.
      const valor = valorTotalCents - acumulado;
      return { fracaoId: f.id, valorTotalCents: valor };
    }
    const valor = Math.floor((valorTotalCents * f.permilagem) / 1000);
    acumulado += valor;
    return { fracaoId: f.id, valorTotalCents: valor };
  });
  return result;
}

/**
 * Para uma imputação de €X numa fração ao longo de N meses, devolve o
 * valor *por prestação* — distribuição com resto na última prestação.
 */
export function dividirPorPrestacoes(valorTotalCents: number, numeroMeses: number): number[] {
  if (numeroMeses < 1) throw new Error("numeroMeses tem de ser ≥ 1");
  const base = Math.floor(valorTotalCents / numeroMeses);
  const resto = valorTotalCents - base * numeroMeses;
  // distribui o resto pelas primeiras prestações (1 cêntimo cada)
  return Array.from({ length: numeroMeses }, (_, i) => base + (i < resto ? 1 : 0));
}

/**
 * Gera o (mes, ano) da prestação `i` (0-based) a partir de (mesInicial, anoInicial).
 */
export function calcularMesPrestacao(
  mesInicial: number,
  anoInicial: number,
  i: number,
): { mes: number; ano: number } {
  const totalMeses = anoInicial * 12 + (mesInicial - 1) + i;
  const ano = Math.floor(totalMeses / 12);
  const mes = (totalMeses % 12) + 1;
  return { mes, ano };
}
