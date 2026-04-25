import { Role } from "@/lib/constants";
import { prisma } from "@/lib/db";

export interface MembershipContext {
  membershipId: string;
  condominioId: string;
  userId: string;
  role: string;
  fracaoId: string | null;
  condominioNome: string;
}

/**
 * Resolve o membership actual para um (userId, condominioId).
 * Devolve null se o user não pertence ao condomínio (cross-tenant block).
 */
export async function getMembership(
  userId: string,
  condominioId: string,
): Promise<MembershipContext | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId, condominioId, leftAt: null },
    include: { condominio: true },
  });
  if (!membership) return null;

  return {
    membershipId: membership.id,
    condominioId: membership.condominioId,
    userId: membership.userId,
    role: membership.role,
    fracaoId: membership.fracaoId,
    condominioNome: membership.condominio.nome,
  };
}

export function isAdmin(ctx: MembershipContext): boolean {
  return ctx.role === Role.ADMINISTRADOR;
}

export function requireAdmin(ctx: MembershipContext): asserts ctx is MembershipContext {
  if (!isAdmin(ctx)) {
    throw new Error("Operação restrita a administradores");
  }
}

/**
 * Lista os condomínios em que o user é membro.
 */
export async function listMembershipsForUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId, leftAt: null },
    include: { condominio: true, fracao: true },
    orderBy: { joinedAt: "asc" },
  });
}
