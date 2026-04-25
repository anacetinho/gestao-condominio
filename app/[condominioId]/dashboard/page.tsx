import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import {
  EstadoGrandeDespesa,
  EstadoOcorrencia,
  EstadoQuota,
  EstadoReuniao,
  Role,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership } from "@/lib/tenancy";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Dashboard({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const isAdmin = ctx.role === Role.ADMINISTRADOR;
  const now = new Date();
  const mes = now.getUTCMonth() + 1;
  const ano = now.getUTCFullYear();

  // Própria quota do mês (se tiver fração).
  let quotaMes: { total: number; estado: string } | null = null;
  if (ctx.fracaoId) {
    const q = await prisma.quotaMensal.findUnique({
      where: { fracaoId_ano_mes: { fracaoId: ctx.fracaoId, ano, mes } },
      include: { imputacoes: { where: { estado: "APLICADA" } } },
    });
    if (q) {
      quotaMes = {
        total: q.valorBaseCents + q.imputacoes.reduce((s, i) => s + i.valorCents, 0),
        estado: q.estado,
      };
    }
  }

  // Cards admin.
  const [pendentesQuotas, grandesAprovadas, ocorrenciasAbertas, proximaReuniao] = await Promise.all(
    [
      isAdmin
        ? prisma.quotaMensal.count({
            where: { condominioId, ano, mes, estado: EstadoQuota.PENDENTE },
          })
        : 0,
      prisma.grandeDespesa.count({
        where: { condominioId, estado: EstadoGrandeDespesa.APROVADA },
      }),
      prisma.ocorrencia.count({
        where: {
          condominioId,
          estado: { in: [EstadoOcorrencia.ABERTA, EstadoOcorrencia.EM_ANALISE] },
        },
      }),
      prisma.reuniao.findFirst({
        where: { condominioId, estado: EstadoReuniao.AGENDADA, data: { gte: now } },
        orderBy: { data: "asc" },
      }),
    ],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard · {formatMesAno(mes, ano)}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ctx.fracaoId && (
          <Link href={`/${condominioId}/orcamento/minhas-contas`}>
            <Card className="hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle className="text-base">A minha quota</CardTitle>
              </CardHeader>
              <CardContent>
                {quotaMes ? (
                  <p className="text-xl font-semibold">
                    {formatEuros(quotaMes.total)}{" "}
                    <span className="text-sm text-muted-foreground">· {quotaMes.estado}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Quota deste mês ainda não foi gerada.
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grandes despesas activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{grandesAprovadas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ocorrências abertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{ocorrenciasAbertas}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próxima reunião</CardTitle>
          </CardHeader>
          <CardContent>
            {proximaReuniao ? (
              <p className="text-base">
                {proximaReuniao.titulo} —{" "}
                <span className="text-muted-foreground">{formatData(proximaReuniao.data)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem reuniões agendadas.</p>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotas pendentes este mês</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{pendentesQuotas}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
