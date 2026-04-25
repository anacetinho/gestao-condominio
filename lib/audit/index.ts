import type { AuditAction } from "@/lib/constants";
import { prisma } from "@/lib/db";

export async function recordAudit(params: {
  condominioId: string;
  membershipId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      condominioId: params.condominioId,
      membershipId: params.membershipId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
}

export async function listAudit(condominioId: string, limit = 200) {
  return prisma.auditLog.findMany({
    where: { condominioId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { membership: { include: { user: true } } },
  });
}
