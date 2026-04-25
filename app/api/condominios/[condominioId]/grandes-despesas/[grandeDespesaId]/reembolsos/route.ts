import { requireSession } from "@/lib/auth/session";
import { marcarReembolsoTratado } from "@/lib/grandes-despesas/workflow";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ condominioId: string; grandeDespesaId: string }> },
) {
  const session = await requireSession();
  const { condominioId, grandeDespesaId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx || !isAdmin(ctx)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const formData = await req.formData();
  const imputacaoId = String(formData.get("imputacaoId") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || undefined;
  if (!imputacaoId) {
    return NextResponse.json({ error: "imputacaoId obrigatório" }, { status: 400 });
  }

  await marcarReembolsoTratado({
    imputacaoId,
    membershipId: ctx.membershipId,
    notas,
  });

  return NextResponse.redirect(
    new URL(`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}/reembolsos`, req.url),
  );
}
