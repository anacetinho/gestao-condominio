import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatEuros, formatMesAno } from "@/lib/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function GrandesDespesasPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const grandes = await prisma.grandeDespesa.findMany({
    where: { condominioId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Grandes despesas</h1>
        <Button asChild>
          <Link href={`/${condominioId}/admin/grandes-despesas/nova`}>Nova proposta</Link>
        </Button>
      </div>

      <div className="space-y-2">
        {grandes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem propostas ainda.</p>
        ) : (
          grandes.map((g) => (
            <Link key={g.id} href={`/${condominioId}/admin/grandes-despesas/${g.id}`}>
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{g.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatEuros(g.valorTotalCents)} ÷ {g.numeroMeses} meses · Início{" "}
                      {formatMesAno(g.mesInicial, g.anoInicial)}
                    </p>
                  </div>
                  <Badge variant="outline">{g.estado}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
