import { QuotaCard } from "@/components/domain/QuotaCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { EstadoQuota } from "@/lib/constants";
import { getMinhasContas } from "@/lib/quotas/minhas-contas";
import { getMembership } from "@/lib/tenancy";
import { formatEuros, formatMesAno } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function MinhasContasPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  if (!ctx.fracaoId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Minhas contas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Não tem fração associada a esta conta. (Administradores sem fração não têm quota
            individual.)
          </p>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const mes = now.getUTCMonth() + 1;
  const ano = now.getUTCFullYear();

  const { mesCorrente, historico } = await getMinhasContas(ctx.fracaoId, mes, ano);

  const totalAnualPago = historico
    .filter((h) => h.estado === EstadoQuota.PAGA)
    .reduce((s, h) => s + h.valorTotalCents, 0);
  const totalAnualPendente = historico
    .filter((h) => h.estado !== EstadoQuota.PAGA)
    .reduce((s, h) => s + h.valorTotalCents, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minhas contas</h1>

      <QuotaCard condominioId={condominioId} quota={mesCorrente} mesRef={mes} anoRef={ano} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div
                  key={h.quotaId}
                  className="flex items-center justify-between border-b last:border-0 py-2"
                >
                  <div>
                    <p className="font-medium">{formatMesAno(h.mes, h.ano)}</p>
                    <p className="text-sm text-muted-foreground">
                      Base {formatEuros(h.valorBaseCents)}
                      {h.valorExtrasCents > 0 && (
                        <>
                          {" "}
                          · Extras{" "}
                          <span className="text-orange-600 dark:text-orange-400">
                            {formatEuros(h.valorExtrasCents)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatEuros(h.valorTotalCents)}</p>
                    <Badge
                      variant={
                        h.estado === EstadoQuota.PAGA
                          ? "success"
                          : h.estado === EstadoQuota.EM_ATRASO
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {h.estado}
                    </Badge>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                <div>
                  <p className="text-muted-foreground">Total pago</p>
                  <p className="font-semibold text-green-600">{formatEuros(totalAnualPago)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total pendente/atraso</p>
                  <p className="font-semibold">{formatEuros(totalAnualPendente)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
