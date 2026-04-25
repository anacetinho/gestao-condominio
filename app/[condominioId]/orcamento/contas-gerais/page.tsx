import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { EstadoGrandeDespesa, EstadoQuota, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership } from "@/lib/tenancy";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function ContasGeraisPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  const isAdmin = ctx.role === Role.ADMINISTRADOR;

  const [quotasPagas, despesasCorrentes, grandes, fracoes] = await Promise.all([
    prisma.quotaMensal.aggregate({
      where: { condominioId, estado: EstadoQuota.PAGA },
      _sum: { valorBaseCents: true },
    }),
    prisma.despesaCorrente.findMany({
      where: { condominioId, anuladaEm: null },
      orderBy: { data: "desc" },
      take: 50,
    }),
    prisma.grandeDespesa.findMany({
      where: { condominioId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { imputacoes: true } } },
    }),
    prisma.fracao.count({ where: { condominioId } }),
  ]);

  // Soma também imputações APLICADAS em quotas pagas (extras pagos):
  const extrasPagos = await prisma.imputacaoExtra.aggregate({
    where: {
      grandeDespesa: { condominioId },
      estado: "APLICADA",
      quotaMensal: { estado: EstadoQuota.PAGA },
    },
    _sum: { valorCents: true },
  });

  const totalReceitas = (quotasPagas._sum.valorBaseCents ?? 0) + (extrasPagos._sum.valorCents ?? 0);

  const totalCorrentes = despesasCorrentes.reduce((s, d) => s + d.valorCents, 0);
  const totalGrandesExecutadas = grandes
    .filter((g) => g.estado === EstadoGrandeDespesa.EXECUTADA)
    .reduce((s, g) => s + (g.valorFinalCents ?? g.valorTotalCents), 0);

  const saldo = totalReceitas - totalCorrentes - totalGrandesExecutadas;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contas gerais</h1>

      <Card>
        <CardHeader>
          <CardTitle>Saldo do fundo comum</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatEuros(saldo)}</p>
          <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
            <Stat label="Receitas (quotas pagas)" value={totalReceitas} />
            <Stat label="Correntes pagas" value={totalCorrentes} negative />
            <Stat label="Grandes despesas executadas" value={totalGrandesExecutadas} negative />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Fração{fracoes === 1 ? "" : "ões"}: {fracoes}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Despesas correntes</CardTitle>
        </CardHeader>
        <CardContent>
          {despesasCorrentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos.</p>
          ) : (
            <div className="space-y-2">
              {despesasCorrentes.map((d) => (
                <div
                  key={d.id}
                  className="flex justify-between border-b last:border-0 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{d.descricao}</p>
                    <p className="text-muted-foreground">
                      {formatData(d.data)}
                      {d.categoria ? ` · ${d.categoria}` : ""}
                    </p>
                  </div>
                  <p className="font-medium">{formatEuros(d.valorCents)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grandes despesas</CardTitle>
        </CardHeader>
        <CardContent>
          {grandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos.</p>
          ) : (
            <div className="space-y-2">
              {grandes.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between border-b last:border-0 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{g.titulo}</p>
                    <p className="text-muted-foreground">
                      {formatEuros(g.valorTotalCents)} ÷ {g.numeroMeses} meses · Início{" "}
                      {formatMesAno(g.mesInicial, g.anoInicial)}
                    </p>
                  </div>
                  <Badge variant="outline">{g.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && <QuotasNominais condominioId={condominioId} />}
    </div>
  );
}

function Stat({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${negative ? "text-orange-600" : ""}`}>
        {negative ? "-" : ""}
        {formatEuros(value)}
      </p>
    </div>
  );
}

async function QuotasNominais({ condominioId }: { condominioId: string }) {
  const now = new Date();
  const ano = now.getUTCFullYear();
  const mes = now.getUTCMonth() + 1;

  const quotas = await prisma.quotaMensal.findMany({
    where: { condominioId, ano, mes },
    include: {
      fracao: { include: { memberships: { include: { user: true } } } },
    },
    orderBy: { fracao: { identificador: "asc" } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quem pagou — {formatMesAno(mes, ano)} (admin)</CardTitle>
      </CardHeader>
      <CardContent>
        {quotas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Quotas ainda não geradas para este mês.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {quotas.map((q) => (
              <div key={q.id} className="flex justify-between border-b last:border-0 py-1.5">
                <span>
                  Fração {q.fracao.identificador} ·{" "}
                  {q.fracao.memberships[0]?.user.nome ?? "(sem morador)"}
                </span>
                <Badge
                  variant={
                    q.estado === EstadoQuota.PAGA
                      ? "success"
                      : q.estado === EstadoQuota.EM_ATRASO
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {q.estado}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
