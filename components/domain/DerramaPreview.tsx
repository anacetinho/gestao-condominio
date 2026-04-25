"use client";

import type { ModoRateio } from "@/lib/constants";
import {
  calcularImputacaoPorFracao,
  calcularMesPrestacao,
  dividirPorPrestacoes,
} from "@/lib/grandes-despesas/calculo";
import { formatEuros, formatMesAno } from "@/lib/utils";
import { useMemo } from "react";

export interface FracaoView {
  id: string;
  identificador: string;
  permilagem: number;
}

interface Props {
  valorTotalCents: number;
  numeroMeses: number;
  mesInicial: number;
  anoInicial: number;
  modoRateio: ModoRateio;
  fracoes: FracaoView[];
}

/**
 * Preview reactivo client-side: dado o input do form, mostra o impacto por
 * fração e mês.
 */
export function DerramaPreview({
  valorTotalCents,
  numeroMeses,
  mesInicial,
  anoInicial,
  modoRateio,
  fracoes,
}: Props) {
  const distribuicao = useMemo(() => {
    if (valorTotalCents <= 0 || fracoes.length === 0 || numeroMeses < 1) {
      return null;
    }
    try {
      return calcularImputacaoPorFracao(valorTotalCents, fracoes, modoRateio);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [valorTotalCents, fracoes, modoRateio, numeroMeses]);

  if (!distribuicao) return null;
  if ("error" in distribuicao) {
    return <p className="text-sm text-destructive">{distribuicao.error}</p>;
  }

  const meses = Array.from({ length: numeroMeses }, (_, i) =>
    calcularMesPrestacao(mesInicial, anoInicial, i),
  );

  return (
    <div className="rounded-md border p-4 space-y-3 bg-muted/30">
      <p className="text-sm font-medium">
        Preview · {formatEuros(valorTotalCents)} ÷ {numeroMeses} mês
        {numeroMeses === 1 ? "" : "es"} ÷ {fracoes.length} fração
        {fracoes.length === 1 ? "" : "ões"}
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-1">Fração</th>
              <th className="text-right p-1">Total</th>
              <th className="text-right p-1">Por prestação</th>
            </tr>
          </thead>
          <tbody>
            {distribuicao.map((d) => {
              const fracao = fracoes.find((f) => f.id === d.fracaoId);
              const prest = dividirPorPrestacoes(d.valorTotalCents, numeroMeses);
              return (
                <tr key={d.fracaoId} className="border-b last:border-0">
                  <td className="p-1">{fracao?.identificador}</td>
                  <td className="p-1 text-right">{formatEuros(d.valorTotalCents)}</td>
                  <td className="p-1 text-right">{formatEuros(prest[0])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Período: {formatMesAno(meses[0].mes, meses[0].ano)} →{" "}
        {formatMesAno(meses[meses.length - 1].mes, meses[meses.length - 1].ano)}
      </p>
    </div>
  );
}
