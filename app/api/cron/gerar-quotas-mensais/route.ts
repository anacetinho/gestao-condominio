import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/lib/constants";
import { gerarQuotasMensais, mesActualUtc } from "@/lib/quotas/geracao";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mes, ano } = body.mes && body.ano ? body : mesActualUtc();
  const condominioId: string | undefined = body.condominioId;

  const result = await gerarQuotasMensais(mes, ano, condominioId);

  // Audit por condomínio.
  for (const cid of Object.keys(result.porCondominio)) {
    const c = result.porCondominio[cid];
    if (c.criadas > 0) {
      await recordAudit({
        condominioId: cid,
        action: AuditAction.QUOTAS_GERADAS,
        payload: { mes, ano, criadas: c.criadas, jaExistiam: c.jaExistiam },
      });
    }
  }

  return NextResponse.json({ ok: true, mes, ano, ...result });
}

// Útil em GET para ferramentas de cron simples (Vercel Cron usa GET por defeito).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { mes, ano } = mesActualUtc();
  const result = await gerarQuotasMensais(mes, ano);

  for (const cid of Object.keys(result.porCondominio)) {
    const c = result.porCondominio[cid];
    if (c.criadas > 0) {
      await recordAudit({
        condominioId: cid,
        action: AuditAction.QUOTAS_GERADAS,
        payload: { mes, ano, criadas: c.criadas },
      });
    }
  }

  return NextResponse.json({ ok: true, mes, ano, ...result });
}
