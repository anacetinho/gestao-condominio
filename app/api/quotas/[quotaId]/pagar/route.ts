import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { marcarQuotaPaga } from "@/lib/quotas/minhas-contas";
import { getMembership } from "@/lib/tenancy";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ quotaId: string }> }) {
  const session = await requireSession();
  const { quotaId } = await params;

  const quota = await prisma.quotaMensal.findUnique({
    where: { id: quotaId },
    include: { fracao: true },
  });
  if (!quota) {
    return NextResponse.json({ error: "Quota não encontrada" }, { status: 404 });
  }

  const ctx = await getMembership(session.userId, quota.condominioId);
  if (!ctx) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  // Só o morador da fração ou um admin podem marcar como pago.
  if (ctx.role !== "ADMINISTRADOR" && ctx.fracaoId !== quota.fracaoId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  await marcarQuotaPaga({ quotaId, membershipId: ctx.membershipId });

  return NextResponse.redirect(new URL(`/${quota.condominioId}/orcamento/minhas-contas`, req.url));
}
