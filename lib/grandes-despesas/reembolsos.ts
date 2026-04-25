import { EstadoImputacao } from "@/lib/constants";
import { prisma } from "@/lib/db";

export interface ReembolsoItem {
  imputacaoId: string;
  fracaoIdentificador: string;
  moradorNome: string;
  mes: number;
  ano: number;
  valorCents: number;
  reembolsadaEm: Date | null;
  reembolsadaNotas: string | null;
}

export interface ReembolsosResumo {
  itens: ReembolsoItem[];
  totalCents: number;
  tratadosCents: number;
  pendentesCents: number;
  pctConcluido: number; // 0-100
}

/**
 * Lista de reembolsos a tratar para uma grande despesa anulada.
 */
export async function listarReembolsos(grandeDespesaId: string): Promise<ReembolsosResumo> {
  const imputacoes = await prisma.imputacaoExtra.findMany({
    where: {
      grandeDespesaId,
      estado: EstadoImputacao.ANULADA,
    },
    include: {
      fracao: {
        include: {
          memberships: {
            // Membership activa nessa fração à data da prestação.
            where: { leftAt: null },
            include: { user: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ anoAplicacao: "asc" }, { mesAplicacao: "asc" }],
  });

  // Apenas imputações que estavam APLICADAS antes da anulação têm quotaMensalId
  // ou estavam ligadas a uma quota — só essas geram reembolso.
  // (O critério prático: tinham quotaMensalId definido.)
  const reembolsaveis = imputacoes.filter((i) => i.quotaMensalId !== null);

  const itens: ReembolsoItem[] = reembolsaveis.map((i) => ({
    imputacaoId: i.id,
    fracaoIdentificador: i.fracao.identificador,
    moradorNome: i.fracao.memberships[0]?.user.nome ?? "(sem morador associado)",
    mes: i.mesAplicacao,
    ano: i.anoAplicacao,
    valorCents: i.valorCents,
    reembolsadaEm: i.reembolsadaEm,
    reembolsadaNotas: i.reembolsadaNotas,
  }));

  const totalCents = itens.reduce((s, i) => s + i.valorCents, 0);
  const tratadosCents = itens
    .filter((i) => i.reembolsadaEm !== null)
    .reduce((s, i) => s + i.valorCents, 0);
  const pendentesCents = totalCents - tratadosCents;
  const pctConcluido = totalCents === 0 ? 100 : Math.round((tratadosCents / totalCents) * 100);

  return { itens, totalCents, tratadosCents, pendentesCents, pctConcluido };
}
