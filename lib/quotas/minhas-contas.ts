import { recordAudit } from "@/lib/audit";
import { AuditAction, EstadoImputacao, EstadoQuota } from "@/lib/constants";
import { prisma } from "@/lib/db";

export interface ExtraDoMes {
  id: string;
  grandeDespesaId: string;
  titulo: string;
  valorCents: number;
  prestacaoActual: number;
  prestacoesTotal: number;
  reuniaoId: string | null;
  reuniaoData: string | null; // ISO date
}

export interface QuotaDoMes {
  quotaId: string;
  mes: number;
  ano: number;
  valorBaseCents: number;
  extras: ExtraDoMes[];
  valorTotalCents: number;
  estado: string;
  pagaEm: Date | null;
  comprovativoUrl: string | null;
  correcaoMotivo: string | null;
  corrigidaEm: Date | null;
}

export interface QuotaResumo {
  quotaId: string;
  mes: number;
  ano: number;
  valorBaseCents: number;
  valorExtrasCents: number;
  valorTotalCents: number;
  estado: string;
  pagaEm: Date | null;
}

export interface MinhasContasPayload {
  mesCorrente: QuotaDoMes | null;
  historico: QuotaResumo[];
}

/**
 * Devolve a quota do mês corrente + histórico das últimas 12 meses
 * para uma fração específica (a do morador autenticado).
 *
 * Schema da resposta documentado em SPEC §4 Feature 3.
 */
export async function getMinhasContas(
  fracaoId: string,
  refMes?: number,
  refAno?: number,
): Promise<MinhasContasPayload> {
  const now = new Date();
  const mes = refMes ?? now.getUTCMonth() + 1;
  const ano = refAno ?? now.getUTCFullYear();

  const mesCorrenteRaw = await prisma.quotaMensal.findUnique({
    where: { fracaoId_ano_mes: { fracaoId, ano, mes } },
    include: {
      imputacoes: {
        where: { estado: EstadoImputacao.APLICADA },
        include: {
          grandeDespesa: { include: { decisao: { include: { reuniao: true } } } },
        },
      },
    },
  });

  const mesCorrente: QuotaDoMes | null = mesCorrenteRaw
    ? {
        quotaId: mesCorrenteRaw.id,
        mes: mesCorrenteRaw.mes,
        ano: mesCorrenteRaw.ano,
        valorBaseCents: mesCorrenteRaw.valorBaseCents,
        extras: mesCorrenteRaw.imputacoes.map((imp) => ({
          id: imp.id,
          grandeDespesaId: imp.grandeDespesaId,
          titulo: imp.grandeDespesa.titulo,
          valorCents: imp.valorCents,
          prestacaoActual: imp.prestacaoActual,
          prestacoesTotal: imp.prestacoesTotal,
          reuniaoId: imp.grandeDespesa.decisao?.reuniaoId ?? null,
          reuniaoData: imp.grandeDespesa.decisao?.reuniao.data.toISOString() ?? null,
        })),
        valorTotalCents:
          mesCorrenteRaw.valorBaseCents +
          mesCorrenteRaw.imputacoes.reduce((s, i) => s + i.valorCents, 0),
        estado: mesCorrenteRaw.estado,
        pagaEm: mesCorrenteRaw.pagaEm,
        comprovativoUrl: mesCorrenteRaw.comprovativoUrl,
        correcaoMotivo: mesCorrenteRaw.correcaoMotivo,
        corrigidaEm: mesCorrenteRaw.corrigidaEm,
      }
    : null;

  // Histórico: últimas 12 meses (não incluindo a do mês corrente).
  const historicoRaw = await prisma.quotaMensal.findMany({
    where: {
      fracaoId,
      NOT: { AND: [{ ano }, { mes }] },
    },
    include: {
      imputacoes: { where: { estado: EstadoImputacao.APLICADA } },
    },
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
    take: 12,
  });

  const historico: QuotaResumo[] = historicoRaw.map((q) => {
    const valorExtrasCents = q.imputacoes.reduce((s, i) => s + i.valorCents, 0);
    return {
      quotaId: q.id,
      mes: q.mes,
      ano: q.ano,
      valorBaseCents: q.valorBaseCents,
      valorExtrasCents,
      valorTotalCents: q.valorBaseCents + valorExtrasCents,
      estado: q.estado,
      pagaEm: q.pagaEm,
    };
  });

  return { mesCorrente, historico };
}

export async function marcarQuotaPaga(params: {
  quotaId: string;
  membershipId: string;
  comprovativoUrl?: string;
}) {
  const quota = await prisma.quotaMensal.findUnique({
    where: { id: params.quotaId },
  });
  if (!quota) throw new Error("Quota não encontrada");
  if (quota.estado === EstadoQuota.PAGA) return quota;

  const updated = await prisma.quotaMensal.update({
    where: { id: quota.id },
    data: {
      estado: EstadoQuota.PAGA,
      pagaEm: new Date(),
      comprovativoUrl: params.comprovativoUrl,
    },
  });

  await recordAudit({
    condominioId: quota.condominioId,
    membershipId: params.membershipId,
    action: AuditAction.QUOTA_PAGA,
    entityType: "QuotaMensal",
    entityId: quota.id,
    payload: { mes: quota.mes, ano: quota.ano },
  });
  return updated;
}
